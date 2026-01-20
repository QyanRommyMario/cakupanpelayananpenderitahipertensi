/**
 * ============================================
 * SPM HEALTH DASHBOARD - GOOGLE APPS SCRIPT
 * ETL Script for Google Sheets to Next.js API
 * ============================================
 *
 * This script extracts data from a Pivot Table in Google Sheets,
 * transforms it into a normalized JSON format, and sends it to
 * the Next.js API for storage in Supabase.
 */

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const CONFIG = {
  // Your Next.js API URL (update after deployment)
  // For local dev: "http://localhost:3000/api/sync"
  // For production: "https://your-app.vercel.app/api/sync"
  API_URL: "http://localhost:3000/api/sync",

  // Security token (must match SYNC_TOKEN in .env.local)
  SYNC_TOKEN: "spm-dashboard-sync-token-2025",

  // Sheet configuration
  SHEET_NAME: "Capaian PKM",

  // Current reporting period
  PERIOD: "TW4-2025",

  // Row where data starts (1-indexed, after headers)
  DATA_START_ROW: 3,

  // Column where indicator names are located (1-indexed)
  INDICATOR_COLUMN: 1,

  // Column where data blocks start (1-indexed)
  DATA_START_COLUMN: 2,
};

// ============================================
// PUSKESMAS MAPPING
// Order must match column order in the sheet
// ============================================
const PUSKESMAS_CODES = [
  "ANT", // Antapani
  "BTR", // Batununggal
  "BTL", // Buahbatu
  "CBI", // Cibiru
  "CBL", // Cibeunying
  "CDG", // Cidadap
  "CGR", // Cigereleng
  "CKL", // Cikutra
  "CMH", // Cimahi
  "GDJ", // Gede Bage
  "KBN", // Kiaracondong
  "LBK", // Lembang
  "MJL", // Majalaya
  "RCG", // Rancaekek
  "SBR", // Soreang
];

const NUM_PUSKESMAS = PUSKESMAS_CODES.length; // 15

/**
 * Main function to sync data
 * Run this manually or set up a time-based trigger
 */
function syncDataToAPI() {
  try {
    Logger.log("Starting data sync...");

    // Get the active spreadsheet and sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found`);
    }

    // Extract and transform data
    const payload = extractAndTransformData(sheet);

    if (payload.data.length === 0) {
      Logger.log("No data to sync");
      return;
    }

    Logger.log(`Extracted ${payload.data.length} records`);

    // Send to API
    const response = sendToAPI(payload);

    Logger.log("Sync completed successfully");
    Logger.log("API Response: " + JSON.stringify(response));

    // Show success message
    SpreadsheetApp.getUi().alert(
      "Sync Successful",
      `Successfully synced ${payload.data.length} records for period ${CONFIG.PERIOD}\n\nUpserted: ${response.upserted || 0}`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (error) {
    Logger.log("Sync failed: " + error.message);
    SpreadsheetApp.getUi().alert(
      "Sync Failed",
      "Error: " + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

/**
 * Extract data from the Pivot Table and transform to normalized format
 *
 * Sheet Structure (Pivot Table):
 * - Column 1: Indicator names
 * - Columns 2-16: Block A (Target/Sasaran) for 15 Puskesmas
 * - Columns 17-31: Block B (Realization/Terlayani) for 15 Puskesmas
 * - Columns 32-46: Block C (Unserved/Belum Terlayani) for 15 Puskesmas
 *
 * @param {Sheet} sheet - The Google Sheet object
 * @returns {Object} - Payload object with period and data array
 */
function extractAndTransformData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // Validate sheet has enough columns for 3 blocks × 15 puskesmas + 1 indicator column
  const expectedColumns = 1 + NUM_PUSKESMAS * 3; // 46 columns
  if (lastCol < expectedColumns) {
    Logger.log(
      `Warning: Expected ${expectedColumns} columns, found ${lastCol}`,
    );
  }

  // Get all data at once (more efficient than cell-by-cell)
  const dataRange = sheet.getRange(
    CONFIG.DATA_START_ROW,
    1,
    lastRow - CONFIG.DATA_START_ROW + 1,
    lastCol,
  );
  const values = dataRange.getValues();

  const transformedData = [];

  // Iterate through each row (each indicator)
  for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
    const row = values[rowIdx];
    const indicatorName = String(row[CONFIG.INDICATOR_COLUMN - 1] || "").trim();

    // Skip empty rows or summary rows
    if (
      !indicatorName ||
      indicatorName === "" ||
      indicatorName.toLowerCase().includes("total")
    ) {
      continue;
    }

    // Calculate column offsets for each block
    // Block A (Target): columns 2-16 (indices 1-15)
    // Block B (Realization): columns 17-31 (indices 16-30)
    // Block C (Unserved): columns 32-46 (indices 31-45)
    const targetOffset = CONFIG.DATA_START_COLUMN - 1; // Index 1
    const realizationOffset = targetOffset + NUM_PUSKESMAS; // Index 16
    const unservedOffset = realizationOffset + NUM_PUSKESMAS; // Index 31

    // Iterate through each Puskesmas
    for (let pkmIdx = 0; pkmIdx < NUM_PUSKESMAS; pkmIdx++) {
      const puskesmasCode = PUSKESMAS_CODES[pkmIdx];

      // Extract values from each block
      const targetValue = parseNumericValue(row[targetOffset + pkmIdx]);
      const realizationValue = parseNumericValue(
        row[realizationOffset + pkmIdx],
      );
      const unservedValue = parseNumericValue(row[unservedOffset + pkmIdx]);

      // Only add record if at least one value is non-zero
      if (targetValue > 0 || realizationValue > 0 || unservedValue > 0) {
        transformedData.push({
          puskesmas_code: puskesmasCode,
          indicator_name: indicatorName,
          target_qty: targetValue,
          realization_qty: realizationValue,
          unserved_qty: unservedValue,
        });
      }
    }
  }

  return {
    period: CONFIG.PERIOD,
    data: transformedData,
  };
}

/**
 * Parse a cell value to a numeric value
 * Handles various formats: numbers, strings, percentages, etc.
 *
 * @param {*} value - The cell value
 * @returns {number} - Parsed numeric value
 */
function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return isNaN(value) ? 0 : value;
  }

  // Convert to string and clean up
  let strValue = String(value).trim();

  // Remove common non-numeric characters
  strValue = strValue.replace(/[,%\s]/g, "");

  // Handle dash or hyphen as zero
  if (strValue === "-" || strValue === "—") {
    return 0;
  }

  const parsed = parseFloat(strValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Send payload to the Next.js API
 *
 * @param {Object} payload - The data payload to send
 * @returns {Object} - Parsed JSON response from API
 */
function sendToAPI(payload) {
  const options = {
    method: "POST",
    contentType: "application/json",
    headers: {
      "x-sync-token": CONFIG.SYNC_TOKEN,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  Logger.log(`API Response Code: ${responseCode}`);
  Logger.log(`API Response Body: ${responseBody}`);

  if (responseCode !== 200) {
    throw new Error(`API returned status ${responseCode}: ${responseBody}`);
  }

  return JSON.parse(responseBody);
}

/**
 * Create a custom menu in Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📊 SPM Dashboard")
    .addItem("🔄 Sync Data to Dashboard", "syncDataToAPI")
    .addItem("🔍 Preview Data", "previewData")
    .addItem("⚙️ Test Connection", "testConnection")
    .addSeparator()
    .addItem("⏰ Setup Daily Sync", "createDailyTrigger")
    .addToUi();
}

/**
 * Preview the extracted data without sending to API
 */
function previewData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found`);
    }

    const payload = extractAndTransformData(sheet);

    // Show first 5 records as preview
    const preview = payload.data.slice(0, 5);
    const message =
      `Period: ${payload.period}\n` +
      `Total Records: ${payload.data.length}\n\n` +
      `Preview (first 5 records):\n` +
      JSON.stringify(preview, null, 2);

    Logger.log(message);

    SpreadsheetApp.getUi().alert(
      "Data Preview",
      `Period: ${payload.period}\nTotal Records: ${payload.data.length}\n\nCheck Logger (View > Logs) for full preview`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      "Preview Failed",
      "Error: " + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

/**
 * Test the API connection
 */
function testConnection() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL, {
      method: "GET",
      muteHttpExceptions: true,
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      SpreadsheetApp.getUi().alert(
        "Connection Test",
        "✅ Successfully connected to API!\n\nEndpoint: " +
          CONFIG.API_URL +
          "\n\nResponse: " +
          responseBody,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
    } else {
      throw new Error(`API returned status ${responseCode}`);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      "Connection Test Failed",
      "❌ Could not connect to API\n\nError: " +
        error.message +
        "\n\nPlease check:\n1. API_URL is correct\n2. The app is deployed\n3. Network connection",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

/**
 * Set up a time-based trigger for automatic sync
 * Run this once to create the trigger
 */
function createDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === "syncDataToAPI") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new daily trigger at 6 AM
  ScriptApp.newTrigger("syncDataToAPI")
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  Logger.log("Daily trigger created for 6 AM");
  SpreadsheetApp.getUi().alert(
    "Trigger Created",
    "✅ Automatic daily sync scheduled for 6:00 AM\n\nThe data will be synced automatically every day.",
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}
