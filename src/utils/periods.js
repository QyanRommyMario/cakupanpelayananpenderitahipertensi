/**
 * Period Utility Functions
 * Generates quarterly (Triwulan) period options for SPM Dashboard
 */

/**
 * Generate array of quarterly period options
 * Format: ['TW1-2025', 'TW2-2025', 'TW3-2025', 'TW4-2025', ...]
 * Covers: Previous year, current year, and next year + Annual recap options
 *
 * @returns {Array<{value: string, label: string, type: 'quarter'|'annual'}>}
 */
export function generateTriwulanOptions() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const options = [];

  // Generate quarters for each year
  years.forEach((year) => {
    for (let tw = 1; tw <= 4; tw++) {
      options.push({
        value: `TW${tw}-${year}`,
        label: `Triwulan ${tw} Tahun ${year}`,
        type: "quarter",
        year: year,
        quarter: tw,
      });
    }

    // Add annual recap option for each year
    options.push({
      value: `REKAP-${year}`,
      label: `📊 REKAP TAHUN ${year}`,
      type: "annual",
      year: year,
      quarter: null,
    });
  });

  return options;
}

/**
 * Get current quarter based on current date
 * Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
 *
 * @returns {string} Current period value (e.g., 'TW1-2026')
 */
export function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let quarter;
  if (month <= 3) quarter = 1;
  else if (month <= 6) quarter = 2;
  else if (month <= 9) quarter = 3;
  else quarter = 4;

  return `TW${quarter}-${year}`;
}

/**
 * Parse period string to get components
 *
 * @param {string} period - Period string (e.g., 'TW1-2025' or 'REKAP-2025')
 * @returns {{type: string, year: number, quarter: number|null, label: string}}
 */
export function parsePeriod(period) {
  if (!period) return null;

  if (period.startsWith("REKAP-")) {
    const year = parseInt(period.replace("REKAP-", ""));
    return {
      type: "annual",
      year: year,
      quarter: null,
      label: `Rekap Tahun ${year}`,
    };
  }

  const match = period.match(/^TW(\d)-(\d{4})$/);
  if (match) {
    const quarter = parseInt(match[1]);
    const year = parseInt(match[2]);
    return {
      type: "quarter",
      year: year,
      quarter: quarter,
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
 * Get all quarterly periods for a specific year (for annual recap calculation)
 *
 * @param {number} year - Year to get quarters for
 * @returns {string[]} Array of quarter period strings
 */
export function getQuartersForYear(year) {
  return [`TW1-${year}`, `TW2-${year}`, `TW3-${year}`, `TW4-${year}`];
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

  // Quarter date ranges
  const quarterMonths = {
    1: { start: 0, end: 2 }, // Jan-Mar
    2: { start: 3, end: 5 }, // Apr-Jun
    3: { start: 6, end: 8 }, // Jul-Sep
    4: { start: 9, end: 11 }, // Oct-Dec
  };

  const months = quarterMonths[parsed.quarter];
  return {
    start: new Date(parsed.year, months.start, 1),
    end: new Date(parsed.year, months.end + 1, 0), // Last day of end month
  };
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

  const quarterNames = [
    "",
    "Januari - Maret",
    "April - Juni",
    "Juli - September",
    "Oktober - Desember",
  ];
  return `Triwulan ${parsed.quarter} (${quarterNames[parsed.quarter]}) ${parsed.year}`;
}
