/**
 * Error categorization and classification for Courselle reliability engine
 */

class CourselleError extends Error {
  constructor(message, category, retryable = false) {
    super(message);
    this.name = 'CourselleError';
    this.category = category;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CourselleError);
    }
  }
}

class TransientError extends CourselleError {
  constructor(message, details = {}) {
    super(message, 'TRANSIENT', true);
    this.details = details;
    this.name = 'TransientError';
  }
}

class PermanentError extends CourselleError {
  constructor(message, details = {}) {
    super(message, 'PERMANENT', false);
    this.details = details;
    this.name = 'PermanentError';
  }
}

class ResourceError extends CourselleError {
  constructor(message, details = {}) {
    super(message, 'RESOURCE', true); // Resource errors may be retryable after cleanup
    this.details = details;
    this.name = 'ResourceError';
    this.requiresCleanup = true;
  }
}

/**
 * Error categories and classification logic
 */
const ERROR_CATEGORIES = {
  // Transient errors (retryable)
  TRANSIENT: {
    NETWORK_TIMEOUT: 'Network timeout or connection failure',
    BROWSER_CONNECTION: 'Browser connection lost',
    PAGE_LOAD_TIMEOUT: 'Page load timeout',
    SCRIPT_TIMEOUT: 'Script execution timeout',
    TEMPORARY_UNAVAILABLE: 'Temporary service unavailable',
  },

  // Permanent errors (non-retryable)
  PERMANENT: {
    INVALID_HTML: 'Invalid or malformed HTML',
    MISSING_DIRECTORY: 'Required directory does not exist',
    INVALID_CONFIG: 'Invalid configuration',
    PERMISSION_DENIED: 'File system permission denied',
    UNSUPPORTED_FORMAT: 'Unsupported file format',
  },

  // Resource errors (may require cleanup)
  RESOURCE: {
    BROWSER_CRASH: 'Browser process crashed',
    MEMORY_EXHAUSTION: 'Memory limit exceeded',
    FILE_DESCRIPTOR_LIMIT: 'Too many open files',
    PROCESS_LIMIT: 'Too many processes',
  },
};

/**
 * Classify an error into appropriate category
 * @param {Error} error - The error to classify
 * @param {Object} context - Additional context about the operation
 * @returns {Object} Classification result with category, retryable flag, and details
 */
function classifyError(error, context = {}) {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name || '';
  const errorCode = error.code || '';

  // Check for transient patterns
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('econnrefused') ||
      errorName === 'TimeoutError') {
    return {
      category: 'TRANSIENT',
      retryable: true,
      type: 'NETWORK_TIMEOUT',
      details: { errorMessage, errorName, errorCode, ...context },
    };
  }

  // Check for browser-related errors
  if (errorMessage.includes('browser') ||
      errorMessage.includes('chromium') ||
      errorMessage.includes('playwright') ||
      errorMessage.includes('protocol') ||
      errorName === 'BrowserError') {
    return {
      category: 'TRANSIENT',
      retryable: true,
      type: 'BROWSER_CONNECTION',
      details: { errorMessage, errorName, errorCode, ...context },
    };
  }

  // Check for resource errors
  if (errorMessage.includes('memory') ||
      errorMessage.includes('out of memory') ||
      errorMessage.includes('heap') ||
      errorMessage.includes('too many') ||
      errorMessage.includes('limit') ||
      errorCode === 'EMFILE' || errorCode === 'ENFILE') {
    return {
      category: 'RESOURCE',
      retryable: true,
      requiresCleanup: true,
      type: 'RESOURCE_EXHAUSTION',
      details: { errorMessage, errorName, errorCode, ...context },
    };
  }

  // Check for file system errors
  if (errorMessage.includes('no such file') ||
      errorMessage.includes('directory') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('access') ||
      errorCode === 'ENOENT' || errorCode === 'EACCES') {
    return {
      category: 'PERMANENT',
      retryable: false,
      type: 'FILE_SYSTEM_ERROR',
      details: { errorMessage, errorName, errorCode, ...context },
    };
  }

  // Default classification (treat as permanent error)
  return {
    category: 'PERMANENT',
    retryable: false,
    type: 'UNKNOWN_ERROR',
    details: { errorMessage, errorName, errorCode, ...context },
  };
}

/**
 * Create a standardized error object with classification
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @param {string} options.category - Error category (TRANSIENT, PERMANENT, RESOURCE)
 * @param {boolean} options.retryable - Whether the error is retryable
 * @param {Object} options.details - Additional error details
 * @returns {CourselleError} Classified error instance
 */
function createError(message, options = {}) {
  const { category = 'PERMANENT', retryable = false, details = {} } = options;

  switch (category) {
    case 'TRANSIENT':
      return new TransientError(message, details);
    case 'RESOURCE':
      return new ResourceError(message, details);
    case 'PERMANENT':
    default:
      return new PermanentError(message, details);
  }
}

/**
 * Determine if an error should trigger a retry based on classification and retry configuration
 * @param {Error} error - The error to check
 * @param {Object} retryConfig - Retry configuration
 * @param {number} retryConfig.maxAttempts - Maximum retry attempts
 * @param {number} attemptCount - Current attempt count
 * @returns {boolean} True if error should be retried
 */
function shouldRetry(error, retryConfig, attemptCount) {
  if (attemptCount >= retryConfig.maxAttempts) {
    return false;
  }

  // Check if error is retryable
  if (error.retryable === false) {
    return false;
  }

  // Resource errors may require special handling
  if (error.requiresCleanup) {
    // Only retry resource errors if we haven't exceeded max attempts
    return true;
  }

  return error.retryable === true;
}

/**
 * Extract error details for logging and reporting
 * @param {Error} error - The error to extract details from
 * @returns {Object} Structured error details
 */
function extractErrorDetails(error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    category: error.category,
    retryable: error.retryable,
    timestamp: error.timestamp || new Date().toISOString(),
    requiresCleanup: error.requiresCleanup,
    details: error.details || {},
  };
}

module.exports = {
  CourselleError,
  TransientError,
  PermanentError,
  ResourceError,
  ERROR_CATEGORIES,
  classifyError,
  createError,
  shouldRetry,
  extractErrorDetails,
};