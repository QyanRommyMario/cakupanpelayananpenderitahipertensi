import { supabase } from "./supabase";
import { isValidProgramType } from "@/utils/constants";

/**
 * Fetch unique indicators from achievements table
 * Since there's no master table for indicators, we derive them from existing data
 * @param {string} programType - Program type filter (HIPERTENSI, DIABETES, ODGJ) - OPTIONAL for backward compatibility
 * @returns {Promise<Array<{indicator_name: string, unit: string}>>}
 */
export async function getUniqueIndicators(programType = null) {
  let query = supabase
    .from("achievements")
    .select("indicator_name, unit");

  // Filter by program type if provided
  if (programType) {
    if (!isValidProgramType(programType)) {
      throw new Error(`getUniqueIndicators: programType tidak valid: "${programType}"`);
    }
    query = query.eq("program_type", programType);
  }

  const { data, error } = await query;

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
 * @param {string} programType - WAJIB: Program type (HIPERTENSI, DIABETES, ODGJ)
 * @returns {Promise<Array>}
 * @throws {Error} if programType is not provided or invalid
 */
export async function getAchievements(puskesmasCode, period = null, programType) {
  // KEAMANAN: Validasi programType - WAJIB
  if (!programType) {
    throw new Error(
      "getAchievements: programType WAJIB diisi. " +
      "Jangan gunakan default value untuk mencegah Silent Data Corruption."
    );
  }

  if (!isValidProgramType(programType)) {
    throw new Error(
      `getAchievements: programType tidak valid: "${programType}". ` +
      `Gunakan nilai dari PROGRAM_TYPES (constants.js).`
    );
  }

  let query = supabase
    .from("achievements")
    .select("*")
    .eq("puskesmas_code", puskesmasCode.toUpperCase())
    .eq("program_type", programType); // FILTER BY PROGRAM TYPE

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
 * @param {Array<{puskesmas_code: string, indicator_name: string, period: string, program_type: string, target_qty: number, realization_qty: number, unit: string}>} records
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function upsertAchievements(records) {
  // KEAMANAN: Validasi setiap record harus punya program_type
  for (const record of records) {
    if (!record.program_type) {
      return { 
        success: false, 
        error: "upsertAchievements: Setiap record WAJIB memiliki program_type." 
      };
    }
    if (!isValidProgramType(record.program_type)) {
      return { 
        success: false, 
        error: `upsertAchievements: program_type tidak valid: "${record.program_type}"` 
      };
    }
  }

  const { error } = await supabase.from("achievements").upsert(records, {
    onConflict: "puskesmas_code,indicator_name,period,program_type",
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

/**
 * ============================================
 * GLOBAL SUMMARY FUNCTIONS - Command Center
 * ============================================
 */

/**
 * Fetch Global Summary - Aggregated data for ALL programs and ALL Puskesmas
 * Used for the Command Center Overview page
 * @param {string} period - Period to filter (from periods.js)
 * @param {Array<string>} periods - Array of periods (for annual recap)
 * @returns {Promise<{
 *   puskesmasScores: Array<{code: string, name: string, hipertensi: number, diabetes: number, odgj: number, avg: number}>,
 *   programTotals: {hipertensi: {target: number, realization: number, percentage: number}, ...},
 *   grandTotal: {target: number, realization: number, percentage: number}
 * }>}
 */
export async function getGlobalSummary(period = null, periods = null) {
  try {
    // Fetch all Puskesmas first
    const puskesmasList = await getAllPuskesmas(true); // exclude KAB
    
    // Build query for achievements
    let query = supabase
      .from("achievements")
      .select("puskesmas_code, program_type, target_qty, realization_qty, indicator_name")
      .neq("puskesmas_code", "KAB");

    // Filter by period(s)
    if (periods && periods.length > 0) {
      query = query.in("period", periods);
    } else if (period) {
      query = query.eq("period", period);
    }

    const { data: achievements, error } = await query;

    if (error) {
      console.error("Error fetching global summary:", error);
      throw error;
    }

    // Initialize result structure
    const puskesmasMap = {};
    puskesmasList.forEach((pkm) => {
      puskesmasMap[pkm.code] = {
        code: pkm.code,
        name: pkm.name,
        hipertensi: { target: 0, realization: 0 },
        diabetes: { target: 0, realization: 0 },
        odgj: { target: 0, realization: 0 },
      };
    });

    // Program totals
    const programTotals = {
      HIPERTENSI: { target: 0, realization: 0 },
      DIABETES: { target: 0, realization: 0 },
      ODGJ: { target: 0, realization: 0 },
    };

    // Aggregate data - Only count "JUMLAH YANG HARUS DILAYANI" for main metric
    (achievements || []).forEach((row) => {
      if (row.indicator_name !== "JUMLAH YANG HARUS DILAYANI") return;
      
      const code = row.puskesmas_code;
      const program = row.program_type;
      const target = parseFloat(row.target_qty) || 0;
      const realization = parseFloat(row.realization_qty) || 0;

      if (puskesmasMap[code] && program) {
        const programKey = program.toLowerCase();
        if (puskesmasMap[code][programKey]) {
          puskesmasMap[code][programKey].target += target;
          puskesmasMap[code][programKey].realization += realization;
        }
      }

      // Add to program totals
      if (programTotals[program]) {
        programTotals[program].target += target;
        programTotals[program].realization += realization;
      }
    });

    // Calculate percentages and format output
    const puskesmasScores = Object.values(puskesmasMap).map((pkm) => {
      const calcPct = (data) => {
        if (data.target === 0) return 0;
        return Math.round((data.realization / data.target) * 100 * 10) / 10;
      };

      const hipertensiPct = calcPct(pkm.hipertensi);
      const diabetesPct = calcPct(pkm.diabetes);
      const odgjPct = calcPct(pkm.odgj);

      // Calculate average (only count programs with data)
      let validPrograms = 0;
      let totalPct = 0;
      if (pkm.hipertensi.target > 0) { validPrograms++; totalPct += hipertensiPct; }
      if (pkm.diabetes.target > 0) { validPrograms++; totalPct += diabetesPct; }
      if (pkm.odgj.target > 0) { validPrograms++; totalPct += odgjPct; }

      const avg = validPrograms > 0 ? Math.round((totalPct / validPrograms) * 10) / 10 : 0;

      return {
        code: pkm.code,
        name: pkm.name,
        hipertensi: hipertensiPct,
        hipertensiData: pkm.hipertensi,
        diabetes: diabetesPct,
        diabetesData: pkm.diabetes,
        odgj: odgjPct,
        odgjData: pkm.odgj,
        avg,
      };
    });

    // Sort by average ascending (worst performers first)
    puskesmasScores.sort((a, b) => a.avg - b.avg);

    // Format program totals with percentages
    const formattedProgramTotals = {};
    Object.keys(programTotals).forEach((program) => {
      const data = programTotals[program];
      formattedProgramTotals[program.toLowerCase()] = {
        target: data.target,
        realization: data.realization,
        percentage: data.target > 0 
          ? Math.round((data.realization / data.target) * 100 * 10) / 10 
          : 0,
      };
    });

    // Grand total
    const grandTarget = Object.values(programTotals).reduce((sum, p) => sum + p.target, 0);
    const grandRealization = Object.values(programTotals).reduce((sum, p) => sum + p.realization, 0);

    return {
      puskesmasScores,
      programTotals: formattedProgramTotals,
      grandTotal: {
        target: grandTarget,
        realization: grandRealization,
        percentage: grandTarget > 0 
          ? Math.round((grandRealization / grandTarget) * 100 * 10) / 10 
          : 0,
      },
    };
  } catch (err) {
    console.error("getGlobalSummary error:", err);
    throw err;
  }
}

/**
 * Get detailed data for a specific program - ALL Puskesmas, ALL indicators
 * @param {string} programType - HIPERTENSI, DIABETES, or ODGJ
 * @param {string} period - Period filter
 * @param {Array<string>} periods - Array of periods (for annual recap)
 * @returns {Promise<Array<{
 *   puskesmasCode: string,
 *   puskesmasName: string,
 *   indicators: Array<{name: string, target: number, realization: number, percentage: number}>,
 *   totalTarget: number,
 *   totalRealization: number,
 *   percentage: number
 * }>>}
 */
export async function getProgramDetailData(programType, period = null, periods = null) {
  if (!isValidProgramType(programType)) {
    throw new Error(`getProgramDetailData: programType tidak valid: "${programType}"`);
  }

  try {
    const puskesmasList = await getAllPuskesmas(true);

    let query = supabase
      .from("achievements")
      .select("*")
      .eq("program_type", programType)
      .neq("puskesmas_code", "KAB");

    if (periods && periods.length > 0) {
      query = query.in("period", periods);
    } else if (period) {
      query = query.eq("period", period);
    }

    const { data: achievements, error } = await query;

    if (error) throw error;

    // Group by puskesmas
    const pkmMap = {};
    puskesmasList.forEach((pkm) => {
      pkmMap[pkm.code] = {
        puskesmasCode: pkm.code,
        puskesmasName: pkm.name,
        indicators: {},
        totalTarget: 0,
        totalRealization: 0,
      };
    });

    // Aggregate data
    (achievements || []).forEach((row) => {
      const code = row.puskesmas_code;
      if (!pkmMap[code]) return;

      const indName = row.indicator_name;
      if (!pkmMap[code].indicators[indName]) {
        pkmMap[code].indicators[indName] = {
          name: indName,
          unit: row.unit || "Orang",
          target: 0,
          realization: 0,
        };
      }

      pkmMap[code].indicators[indName].target += parseFloat(row.target_qty) || 0;
      pkmMap[code].indicators[indName].realization += parseFloat(row.realization_qty) || 0;
    });

    // Calculate totals and format
    return Object.values(pkmMap).map((pkm) => {
      const indicatorList = Object.values(pkm.indicators).map((ind) => ({
        ...ind,
        percentage: ind.target > 0 
          ? Math.round((ind.realization / ind.target) * 100 * 10) / 10 
          : 0,
        unserved: Math.max(0, ind.target - ind.realization),
      }));

      // Main metric is "JUMLAH YANG HARUS DILAYANI"
      const mainIndicator = indicatorList.find(i => i.name === "JUMLAH YANG HARUS DILAYANI");
      const totalTarget = mainIndicator?.target || 0;
      const totalRealization = mainIndicator?.realization || 0;

      return {
        puskesmasCode: pkm.puskesmasCode,
        puskesmasName: pkm.puskesmasName,
        indicators: indicatorList,
        totalTarget,
        totalRealization,
        percentage: totalTarget > 0 
          ? Math.round((totalRealization / totalTarget) * 100 * 10) / 10 
          : 0,
        unserved: Math.max(0, totalTarget - totalRealization),
      };
    }).sort((a, b) => a.percentage - b.percentage); // Worst first
  } catch (err) {
    console.error("getProgramDetailData error:", err);
    throw err;
  }
}
