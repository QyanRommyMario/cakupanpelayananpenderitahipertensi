import { supabase } from "./supabase";

/**
 * Fetch unique indicators from achievements table
 * Since there's no master table for indicators, we derive them from existing data
 * @returns {Promise<Array<{indicator_name: string, unit: string}>>}
 */
export async function getUniqueIndicators() {
  const { data, error } = await supabase
    .from("achievements")
    .select("indicator_name, unit");

  if (error) {
    console.error("Error fetching indicators:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Use Map to get unique indicators with their units
  const indicatorMap = new Map();
  data.forEach((row) => {
    if (row.indicator_name && !indicatorMap.has(row.indicator_name)) {
      indicatorMap.set(row.indicator_name, {
        indicator_name: row.indicator_name,
        unit: row.unit || "Orang",
      });
    }
  });

  // Convert to array and sort alphabetically
  return Array.from(indicatorMap.values()).sort((a, b) =>
    a.indicator_name.localeCompare(b.indicator_name, "id"),
  );
}

/**
 * Fetch all puskesmas from database
 * @param {boolean} excludeKab - Whether to exclude KAB (Dinas Kesehatan) from results
 * @returns {Promise<Array<{id: number, code: string, name: string, email: string}>>}
 */
export async function getAllPuskesmas(excludeKab = false) {
  let query = supabase.from("puskesmas").select("*").order("name");

  if (excludeKab) {
    query = query.neq("code", "KAB");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching puskesmas:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get puskesmas by code
 * @param {string} code - Puskesmas code
 * @returns {Promise<{id: number, code: string, name: string, email: string} | null>}
 */
export async function getPuskesmasByCode(code) {
  const { data, error } = await supabase
    .from("puskesmas")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error) {
    console.error("Error fetching puskesmas by code:", error);
    return null;
  }

  return data;
}

/**
 * Fetch achievements for a specific puskesmas and optional period
 * @param {string} puskesmasCode - Puskesmas code
 * @param {string} period - Optional period filter (e.g., "2026-01")
 * @returns {Promise<Array>}
 */
export async function getAchievements(puskesmasCode, period = null) {
  let query = supabase
    .from("achievements")
    .select("*")
    .eq("puskesmas_code", puskesmasCode.toUpperCase());

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching achievements:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get unique periods from achievements
 * @returns {Promise<Array<string>>}
 */
export async function getUniquePeriods() {
  const { data, error } = await supabase.from("achievements").select("period");

  if (error) {
    console.error("Error fetching periods:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get unique periods and sort descending (newest first)
  const periods = [...new Set(data.map((d) => d.period).filter(Boolean))];
  return periods.sort().reverse();
}

/**
 * Upsert achievements data
 * @param {Array<{puskesmas_code: string, indicator_name: string, period: string, target_qty: number, realization_qty: number, unit: string}>} records
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function upsertAchievements(records) {
  const { error } = await supabase.from("achievements").upsert(records, {
    onConflict: "puskesmas_code,indicator_name,period",
  });

  if (error) {
    console.error("Error upserting achievements:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Calculate achievement metrics
 * @param {number} target
 * @param {number} realization
 * @returns {{percentage: string, unserved: number, isTuntas: boolean}}
 */
export function calculateMetrics(target, realization) {
  const targetNum = Number(target) || 0;
  const realizationNum = Number(realization) || 0;

  const percentage = targetNum > 0 ? (realizationNum / targetNum) * 100 : 0;
  const unserved = Math.max(0, targetNum - realizationNum);

  return {
    percentage: percentage.toFixed(2),
    unserved,
    isTuntas: percentage >= 100,
  };
}

/**
 * Get current user's puskesmas info from their email
 * @param {string} email - User email (e.g., "ant@dinkes.go.id")
 * @returns {{code: string, isAdmin: boolean}}
 */
export function parseUserEmail(email) {
  if (!email) return { code: null, isAdmin: false };

  const adminEmails = ["kab@dinkes.go.id", "admin@dinkes.go.id"];
  if (adminEmails.includes(email.toLowerCase())) {
    return { code: "KAB", isAdmin: true };
  }

  const code = email.split("@")[0].toUpperCase();
  return { code, isAdmin: false };
}

/**
 * Generate period options for dropdown
 * @param {number} yearsBack - How many years back to generate
 * @returns {Array<{value: string, label: string}>}
 */
export function generatePeriodOptions(yearsBack = 2) {
  const options = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const months = [
    { num: "01", name: "Januari" },
    { num: "02", name: "Februari" },
    { num: "03", name: "Maret" },
    { num: "04", name: "April" },
    { num: "05", name: "Mei" },
    { num: "06", name: "Juni" },
    { num: "07", name: "Juli" },
    { num: "08", name: "Agustus" },
    { num: "09", name: "September" },
    { num: "10", name: "Oktober" },
    { num: "11", name: "November" },
    { num: "12", name: "Desember" },
  ];

  for (let year = currentYear; year >= currentYear - yearsBack; year--) {
    const maxMonth = year === currentYear ? currentMonth : 12;
    for (let m = maxMonth; m >= 1; m--) {
      const monthData = months[m - 1];
      options.push({
        value: `${year}-${monthData.num}`,
        label: `${monthData.name} ${year}`,
      });
    }
  }

  return options;
}
