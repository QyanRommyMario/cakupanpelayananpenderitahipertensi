/**
 * Logger Utility - Production-ready logging
 * Menggantikan console.log/error dengan sistem logging yang lebih terkontrol
 * 
 * Di production: Log hanya error kritis, tidak ada console output
 * Di development: Log semua level untuk debugging
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Current log level (ERROR only in production)
const currentLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

/**
 * Format log message with timestamp and context
 */
function formatMessage(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    message,
    ...context,
  };
}

/**
 * Send log to external service (untuk production monitoring)
 * TODO: Integrasikan dengan Sentry, LogRocket, atau service lain
 */
function sendToExternalService(logData) {
  // Placeholder untuk integrasi dengan external logging service
  // Contoh: Sentry, LogRocket, Datadog, dll.
  
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureMessage(logData.message, logData.level.toLowerCase());
  // }
}

/**
 * Debug log - hanya muncul di development
 */
export function debug(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.DEBUG) {
    const logData = formatMessage("DEBUG", message, context);
    console.debug(`[DEBUG] ${message}`, context);
  }
}

/**
 * Info log - informasi umum
 */
export function info(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.INFO) {
    const logData = formatMessage("INFO", message, context);
    console.info(`[INFO] ${message}`, context);
  }
}

/**
 * Warning log - peringatan non-kritis
 */
export function warn(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.WARN) {
    const logData = formatMessage("WARN", message, context);
    console.warn(`[WARN] ${message}`, context);
  }
}

/**
 * Error log - error yang perlu ditangani
 * Selalu di-log, baik di development maupun production
 */
export function error(message, errorObj = null, context = {}) {
  const logData = formatMessage("ERROR", message, {
    ...context,
    error: errorObj ? {
      message: errorObj.message,
      stack: isDevelopment ? errorObj.stack : undefined,
      name: errorObj.name,
    } : null,
  });

  // Di development, tampilkan di console
  if (isDevelopment) {
    console.error(`[ERROR] ${message}`, errorObj, context);
  }

  // Di production, kirim ke external service
  if (!isDevelopment) {
    sendToExternalService(logData);
  }
}

/**
 * Log API error dengan context yang lebih lengkap
 */
export function apiError(operation, error, additionalContext = {}) {
  const context = {
    operation,
    errorCode: error?.code,
    errorMessage: error?.message,
    ...additionalContext,
  };

  error(`API Error: ${operation}`, error, context);
}

/**
 * Log validation error
 */
export function validationError(field, value, expectedType) {
  warn(`Validation Error: ${field}`, {
    field,
    receivedValue: value,
    expectedType,
  });
}

// Default export sebagai object
const logger = {
  debug,
  info,
  warn,
  error,
  apiError,
  validationError,
};

export default logger;
