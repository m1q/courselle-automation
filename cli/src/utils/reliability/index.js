/**
 * Reliability Engine - Main entry point for reliability features
 */

const { loadReliabilityConfig, validateConfig } = require('../../config/reliability-config');
const { loadEnvConfig } = require('../../config/env-config');
const { StructuredLogger } = require('../logging/structured-logger');
const {
  CourselleError,
  TransientError,
  PermanentError,
  ResourceError,
  ERROR_CATEGORIES,
  classifyError,
  createError,
  shouldRetry,
  extractErrorDetails,
} = require('./error-categorizer');
const { ResourceManager, createResourceManager } = require('./resource-manager');
const { OutputValidator, createOutputValidator } = require('./output-validator');
const { TimeoutManager, TimeoutError, createTimeoutManager } = require('./timeout');

/**
 * Reliability Engine class
 */
class ReliabilityEngine {
  constructor(projectManifest = {}, env = process.env) {
    // Load configuration
    this.config = loadReliabilityConfig(projectManifest, env);
    this.envConfig = loadEnvConfig(env);

    // Initialize logger
    this.logger = new StructuredLogger({
      level: this.config.logging.level,
      format: this.config.logging.format,
      file: {
        enabled: this.config.logging.file.enabled,
        path: this.config.logging.file.path,
        maxFiles: this.config.logging.file.maxFiles,
        maxSizeMb: this.config.logging.file.maxSizeMb,
      },
      console: {
        enabled: this.config.logging.console.enabled,
        colors: this.config.logging.console.colors,
        timestamps: this.config.logging.console.timestamps,
      },
    });

    // State
    this.metrics = {
      startTime: null,
      operations: [],
      errors: [],
      retries: 0,
    };

    this.circuitBreakerState = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: null,
      halfOpenAttempts: 0,
    };

    // Initialize resource manager
    this.resourceManager = new ResourceManager(this.config.resourceManagement, this.logger);

    // Initialize output validator
    this.outputValidator = new OutputValidator(this.config.validation, this.logger);

    // Initialize timeout manager
    this.timeoutManager = new TimeoutManager(this.config.timeout);

    // Bind methods
    this.executeWithRetry = this.executeWithRetry.bind(this);
    this.executeWithCircuitBreaker = this.executeWithCircuitBreaker.bind(this);
    this.recordOperation = this.recordOperation.bind(this);
  }

  /**
   * Start reliability tracking for an operation
   */
  startOperation(name, context = {}) {
    const operation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      success: false,
      error: null,
      retries: 0,
      context,
    };

    this.metrics.operations.push(operation);

    this.logger.debug(`Starting operation: ${name}`, { operationId: operation.id, context });

    return operation.id;
  }

  /**
   * End reliability tracking for an operation
   */
  endOperation(operationId, success = true, error = null) {
    const operation = this.metrics.operations.find(op => op.id === operationId);
    if (!operation) {
      this.logger.warn(`Cannot find operation with ID: ${operationId}`);
      return;
    }

    operation.endTime = Date.now();
    operation.durationMs = operation.endTime - operation.startTime;
    operation.success = success;
    operation.error = error;

    if (error) {
      this.metrics.errors.push({
        operationId,
        error,
        timestamp: new Date().toISOString(),
      });

      const classification = classifyError(error, { operationId });
      this.logger.error(`Operation failed: ${operation.name}`, {
        operationId,
        durationMs: operation.durationMs,
        error: extractErrorDetails(error),
        classification,
      });
    } else {
      this.logger.info(`Operation completed: ${operation.name}`, {
        operationId,
        durationMs: operation.durationMs,
      });
    }

    return operation;
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry(operationName, operationFn, context = {}) {
    const operationId = this.startOperation(operationName, context);
    let lastError = null;
    let attempt = 1;

    while (attempt <= this.config.retry.maxAttempts) {
      try {
        this.logger.debug(`Attempt ${attempt}/${this.config.retry.maxAttempts} for ${operationName}`);

        const result = await operationFn();

        this.endOperation(operationId, true);
        return result;
      } catch (error) {
        lastError = error;

        // Classify error
        const classification = classifyError(error, { operationName, attempt });
        const errorWithClassification = createError(error.message, {
          category: classification.category,
          retryable: classification.retryable,
          details: { ...classification.details, originalError: error },
        });

        // Check if we should retry
        if (!shouldRetry(errorWithClassification, this.config.retry, attempt)) {
          this.endOperation(operationId, false, errorWithClassification);
          throw errorWithClassification;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn(`Retryable error occurred, retrying in ${delay}ms`, {
          operationName,
          attempt,
          delay,
          error: extractErrorDetails(errorWithClassification),
        });

        // Wait before retry
        await this.sleep(delay);
        attempt++;
        this.metrics.retries++;
      }
    }

    // All retries exhausted
    this.endOperation(operationId, false, lastError);
    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.config.retry.initialDelayMs * Math.pow(this.config.retry.backoffFactor, attempt - 1);
    const maxDelay = this.config.retry.maxDelayMs;
    const jitter = this.config.retry.jitter;

    let delay = Math.min(baseDelay, maxDelay);

    // Add jitter (±jitter%)
    if (jitter > 0) {
      const jitterRange = delay * jitter;
      delay += (Math.random() * 2 - 1) * jitterRange;
    }

    return Math.max(0, Math.min(delay, maxDelay));
  }

  /**
   * Execute an operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker(operationName, operationFn, context = {}) {
    // Check circuit breaker state
    if (this.circuitBreakerState.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreakerState.lastFailureTime;

      if (timeSinceFailure < this.config.circuitBreaker.resetTimeoutMs) {
        throw new TransientError(
          `Circuit breaker is OPEN for ${operationName}. Too many failures.`,
          { timeSinceFailure, resetTimeoutMs: this.config.circuitBreaker.resetTimeoutMs }
        );
      }

      // Circuit breaker reset timeout expired, transition to HALF-OPEN
      this.circuitBreakerState.isOpen = false;
      this.circuitBreakerState.halfOpenAttempts = 0;
      this.logger.info(`Circuit breaker transitioned to HALF-OPEN for ${operationName}`);
    }

    try {
      const result = await operationFn();

      // Operation succeeded
      if (this.circuitBreakerState.halfOpenAttempts > 0) {
        // Success in half-open state, reset circuit breaker
        this.circuitBreakerState.failureCount = 0;
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.halfOpenAttempts = 0;
        this.logger.info(`Circuit breaker reset after successful half-open attempt for ${operationName}`);
      }

      return result;
    } catch (error) {
      // Operation failed
      this.circuitBreakerState.failureCount++;

      if (this.circuitBreakerState.halfOpenAttempts > 0) {
        // Failed in half-open state, open circuit again
        this.circuitBreakerState.isOpen = true;
        this.circuitBreakerState.lastFailureTime = Date.now();
        this.logger.warn(`Circuit breaker re-opened after half-open failure for ${operationName}`);
      } else if (this.circuitBreakerState.failureCount >= this.config.circuitBreaker.failureThreshold) {
        // Threshold reached, open circuit
        this.circuitBreakerState.isOpen = true;
        this.circuitBreakerState.lastFailureTime = Date.now();
        this.logger.warn(`Circuit breaker opened for ${operationName} after ${this.circuitBreakerState.failureCount} failures`);
      }

      throw error;
    }
  }

  /**
   * Record a metric
   */
  recordMetric(name, value, tags = {}) {
    if (!this.config.metrics.enabled) {
      return;
    }

    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    // In a real implementation, this would send to a metrics backend
    this.logger.debug(`Metric recorded: ${name} = ${value}`, { tags });
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    const successfulOps = this.metrics.operations.filter(op => op.success);
    const failedOps = this.metrics.operations.filter(op => !op.success && op.endTime);
    const pendingOps = this.metrics.operations.filter(op => !op.endTime);

    const totalDuration = successfulOps.reduce((sum, op) => sum + (op.durationMs || 0), 0);
    const avgDuration = successfulOps.length > 0 ? totalDuration / successfulOps.length : 0;

    return {
      totalOperations: this.metrics.operations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      pendingOperations: pendingOps.length,
      retryCount: this.metrics.retries,
      errorCount: this.metrics.errors.length,
      averageDurationMs: Math.round(avgDuration),
      circuitBreakerState: { ...this.circuitBreakerState },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export metrics to file
   */
  exportMetrics(filePath = null) {
    if (!this.config.metrics.enabled) {
      return null;
    }

    const outputPath = filePath || this.config.metrics.output.file.path.replace(
      '{timestamp}',
      new Date().toISOString().replace(/[:.]/g, '-')
    );

    const metricsData = {
      summary: this.getMetricsSummary(),
      operations: this.metrics.operations,
      errors: this.metrics.errors,
      timestamp: new Date().toISOString(),
      config: this.config,
    };

    // In a real implementation, this would write to a file
    this.logger.info(`Metrics exported to ${outputPath}`, { operationCount: this.metrics.operations.length });

    return {
      path: outputPath,
      data: metricsData,
    };
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Clean up resource manager
    if (this.resourceManager) {
      await this.resourceManager.cleanup();
    }

    // Clear output validator cache
    if (this.outputValidator) {
      this.outputValidator.clearCache();
    }

    // Close logger
    if (this.logger) {
      this.logger.close();
    }

    // Export metrics on cleanup if enabled
    if (this.config.metrics.enabled && this.config.metrics.output.file.enabled) {
      this.exportMetrics();
    }
  }
}

module.exports = {
  // Core engine
  ReliabilityEngine,

  // Configuration
  loadReliabilityConfig,
  validateConfig,
  loadEnvConfig,

  // Logging
  StructuredLogger,

  // Error handling
  CourselleError,
  TransientError,
  PermanentError,
  ResourceError,
  ERROR_CATEGORIES,
  classifyError,
  createError,
  shouldRetry,
  extractErrorDetails,

  // Resource management
  ResourceManager,
  createResourceManager,

  // Output validation
  OutputValidator,
  createOutputValidator,

  // Timeout handling
  TimeoutManager,
  TimeoutError,
  createTimeoutManager,

  // Convenience instances
  createEngine: (projectManifest, env) => new ReliabilityEngine(projectManifest, env),
};