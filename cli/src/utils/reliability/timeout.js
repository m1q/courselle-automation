/**
 * Timeout handling utilities for reliability engine
 */

const { createError } = require('./error-categorizer');

/**
 * Timeout error class
 */
class TimeoutError extends Error {
  constructor(message, operation, timeoutMs) {
    super(message);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.timestamp = new Date().toISOString();
    this.category = 'TRANSIENT';
    this.retryable = true;
  }
}

/**
 * Timeout utility class
 */
class TimeoutManager {
  constructor(config = {}) {
    this.config = {
      pageLoadMs: config.pageLoadMs || 30000,
      screenshotMs: config.screenshotMs || 10000,
      browserLaunchMs: config.browserLaunchMs || 60000,
      navigationMs: config.navigationMs || 15000,
      fontLoadMs: config.fontLoadMs || 5000,
      ...config,
    };
  }

  /**
   * Wrap a promise with a timeout
   * @param {Promise} promise - The promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operationName - Name of the operation for error reporting
   * @returns {Promise} Promise that rejects with TimeoutError if timeout is exceeded
   */
  withTimeout(promise, timeoutMs, operationName) {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(
          `Operation "${operationName}" timed out after ${timeoutMs}ms`,
          operationName,
          timeoutMs
        ));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute page load with timeout
   * @param {Promise} pageLoadPromise - Promise from page.goto or similar
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  pageLoad(pageLoadPromise, options = {}) {
    const timeoutMs = options.timeoutMs || this.config.pageLoadMs;
    const operationName = options.operationName || 'page_load';

    return this.withTimeout(pageLoadPromise, timeoutMs, operationName);
  }

  /**
   * Execute screenshot with timeout
   * @param {Promise} screenshotPromise - Promise from page.screenshot or similar
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  screenshot(screenshotPromise, options = {}) {
    const timeoutMs = options.timeoutMs || this.config.screenshotMs;
    const operationName = options.operationName || 'screenshot';

    return this.withTimeout(screenshotPromise, timeoutMs, operationName);
  }

  /**
   * Execute browser launch with timeout
   * @param {Promise} browserLaunchPromise - Promise from browser.launch
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  browserLaunch(browserLaunchPromise, options = {}) {
    const timeoutMs = options.timeoutMs || this.config.browserLaunchMs;
    const operationName = options.operationName || 'browser_launch';

    return this.withTimeout(browserLaunchPromise, timeoutMs, operationName);
  }

  /**
   * Execute navigation with timeout
   * @param {Promise} navigationPromise - Promise from page.goto, page.waitForNavigation, etc.
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  navigation(navigationPromise, options = {}) {
    const timeoutMs = options.timeoutMs || this.config.navigationMs;
    const operationName = options.operationName || 'navigation';

    return this.withTimeout(navigationPromise, timeoutMs, operationName);
  }

  /**
   * Execute font load with timeout
   * @param {Promise} fontLoadPromise - Promise from document.fonts.ready or similar
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  fontLoad(fontLoadPromise, options = {}) {
    const timeoutMs = options.timeoutMs || this.config.fontLoadMs;
    const operationName = options.operationName || 'font_load';

    return this.withTimeout(fontLoadPromise, timeoutMs, operationName);
  }

  /**
   * Generic operation with timeout using config key
   * @param {Promise} promise - The promise to wrap
   * @param {string} configKey - Config key (pageLoadMs, screenshotMs, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise} Promise with timeout
   */
  operation(promise, configKey, options = {}) {
    const defaultTimeout = this.config[configKey] || 30000;
    const timeoutMs = options.timeoutMs || defaultTimeout;
    const operationName = options.operationName || configKey;

    return this.withTimeout(promise, timeoutMs, operationName);
  }

  /**
   * Create a timeout promise (rejects after specified time)
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} message - Custom error message
   * @returns {Promise} Promise that rejects after timeout
   */
  createTimeout(timeoutMs, message = null) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          message || `Timeout after ${timeoutMs}ms`,
          'custom_timeout',
          timeoutMs
        ));
      }, timeoutMs);
    });
  }

  /**
   * Race a promise against a timeout
   * @param {Promise} promise - The promise to race
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of promise or timeout rejection
   */
  race(promise, timeoutMs, operationName = 'operation') {
    return Promise.race([
      promise,
      this.createTimeout(timeoutMs, `Operation "${operationName}" timed out after ${timeoutMs}ms`)
    ]);
  }

  /**
   * Get timeout configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update timeout configuration
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }
}

module.exports = {
  TimeoutError,
  TimeoutManager,
  createTimeoutManager: (config) => new TimeoutManager(config),
};