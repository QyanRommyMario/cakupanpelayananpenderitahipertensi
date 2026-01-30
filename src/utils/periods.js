/**
 * Period Utility Functions
 * Generates monthly period options for SPM Dashboard
 * Updated: Support monthly periods until end of 2026
 */

/**
 * Generate array of monthly period options
 * Format: ['2025-01', '2025-02', ..., '2026-12']
 * Covers: From January 2025 to December 2026 + Annual recap options
 *
 * @returns {Array<{value: string, label: string, type: 'month'|'annual'}>}
 */
export function generateTriwulanOptions() {
  const options = [];
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // Generate months from 2025 to 2026 only
  const years = [2025, 2026];

  years.forEach((year) => {
    // Generate all 12 months for each year FIRST
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, "0");
      options.push({
        value: `${year}-${monthStr}`,
        label: `${monthNames[month - 1]} ${year}`,
        type: "month",
        year: year,
        month: month,
      });
    }

    // Add annual recap option at the END of each year
    options.push({
      value: `REKAP-${year}`,
      label: `📊 REKAP TAHUN ${year}`,
      type: "annual",
      year: year,
      month: null,
    });
  });

  return options;
}

/**
 * Get current month period based on current date
 *
 * @returns {string} Current period value (e.g., '2026-01')
 */
export function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // If current year is beyond 2026, default to Dec 2026
  if (year > 2026) {
    return "2026-12";
  }
  // If current year is before 2025, default to Jan 2025
  if (year < 2025) {
    return "2025-01";
  }

  const monthStr = month.toString().padStart(2, "0");
  return `${year}-${monthStr}`;
}

/**
 * Parse period string to get components
 *
 * @param {string} period - Period string (e.g., '2025-01' or 'REKAP-2025')
 * @returns {{type: string, year: number, month: number|null, label: string}}
 */
export function parsePeriod(period) {
  if (!period) return null;

  if (period.startsWith("REKAP-")) {
    const year = parseInt(period.replace("REKAP-", ""));
    return {
      type: "annual",
      year: year,
      month: null,
      quarter: null,
      label: `Rekap Tahun ${year}`,
    };
  }

  // Monthly format: YYYY-MM
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1]);
    const month = parseInt(monthMatch[2]);
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return {
      type: "month",
      year: year,
      month: month,
      quarter: null,
      label: `${monthNames[month - 1]} ${year}`,
    };
  }

  // Legacy Triwulan format: TW1-2025
  const twMatch = period.match(/^TW(\d)-(\d{4})$/);
  if (twMatch) {
    const quarter = parseInt(twMatch[1]);
    const year = parseInt(twMatch[2]);
    return {
      type: "quarter",
      year: year,
      quarter: quarter,
      month: null,
      label: `Triwulan ${quarter} ${year}`,
    };
  }

  return null;
}

/**
 * Check if period is annual recap type
 *
 * @param {string} period - Period string
 * @returns {boolean}
 */
export function isAnnualPeriod(period) {
  return period?.startsWith("REKAP-");
}

/**
 * Get all monthly periods for a specific year (for annual recap calculation)
 *
 * @param {number} year - Year to get months for
 * @returns {string[]} Array of monthly period strings
 */
export function getQuartersForYear(year) {
  // Return all 12 months for the year
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthStr = m.toString().padStart(2, "0");
    months.push(`${year}-${monthStr}`);
  }
  return months;
}

/**
 * Get date range for a period
 *
 * @param {string} period - Period string
 * @returns {{start: Date, end: Date}|null}
 */
export function getPeriodDateRange(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return null;

  if (parsed.type === "annual") {
    return {
      start: new Date(parsed.year, 0, 1),
      end: new Date(parsed.year, 11, 31),
    };
  }

  if (parsed.type === "month") {
    return {
      start: new Date(parsed.year, parsed.month - 1, 1),
      end: new Date(parsed.year, parsed.month, 0), // Last day of month
    };
  }

  // Legacy quarter support
  if (parsed.type === "quarter") {
    const quarterMonths = {
      1: { start: 0, end: 2 },
      2: { start: 3, end: 5 },
      3: { start: 6, end: 8 },
      4: { start: 9, end: 11 },
    };
    const months = quarterMonths[parsed.quarter];
    return {
      start: new Date(parsed.year, months.start, 1),
      end: new Date(parsed.year, months.end + 1, 0),
    };
  }

  return null;
}

/**
 * Format period for display
 *
 * @param {string} period - Period string
 * @returns {string} Formatted label
 */
export function formatPeriodLabel(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return period;

  if (parsed.type === "annual") {
    return `Rekap Tahunan ${parsed.year}`;
  }

  if (parsed.type === "month") {
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${monthNames[parsed.month - 1]} ${parsed.year}`;
  }

  // Legacy quarter
  if (parsed.type === "quarter") {
    const quarterNames = [
      "",
      "Januari - Maret",
      "April - Juni",
      "Juli - September",
      "Oktober - Desember",
    ];
    return `Triwulan ${parsed.quarter} (${quarterNames[parsed.quarter]}) ${parsed.year}`;
  }

  return period;
}
