/**
 * Reliability configuration schema and defaults
 */

const defaultConfig = {
  // Retry configuration
  retry: {
    enabled: false, // Disabled by default for backward compatibility
    maxAttempts: 3,
    backoffFactor: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    jitter: 0.1, // ±10% jitter
  },

  // Circuit breaker configuration
  circuitBreaker: {
    enabled: false, // Disabled by default
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 2,
  },

  // Timeout configuration (in milliseconds)
  timeout: {
    pageLoadMs: 30000,
    screenshotMs: 10000,
    browserLaunchMs: 60000,
    navigationMs: 15000,
    fontLoadMs: 5000,
  },

  // Validation configuration
  validation: {
    enabled: false, // Disabled by default
    checkFileSize: true,
    minFileSizeBytes: 1024, // 1KB
    maxFileSizeBytes: 10485760, // 10MB
    verifyChecksum: false,
    validatePngHeader: true,
  },

  // Resource management configuration
  resourceManagement: {
    enabled: false, // Disabled by default
    maxBrowserInstances: 3,
    browserReuse: true,
    maxPagesPerBrowser: 10,
    cleanupIntervalMs: 300000, // 5 minutes
    maxMemoryUsageMb: 512,
  },

  // Logging configuration
  logging: {
    level: 'info', // debug, info, warn, error
    format: 'pretty', // json, pretty, simple
    file: {
      enabled: false,
      path: './logs/courselle-{timestamp}.log',
      maxFiles: 10,
      maxSizeMb: 10,
    },
    console: {
      enabled: true,
      colors: true,
      timestamps: true,
    },
  },

  // Metrics configuration
  metrics: {
    enabled: false, // Disabled by default
    collectPerformance: true,
    collectResourceUsage: true,
    collectErrorStats: true,
    output: {
      file: {
        enabled: true,
        path: './logs/metrics-{timestamp}.json',
      },
      console: {
        enabled: false,
        summaryOnly: true,
      },
    },
  },
};

/**
 * Load reliability configuration from multiple sources
 * Priority: Environment variables > Project manifest > Defaults
 */
function loadReliabilityConfig(projectManifest = {}, env = process.env) {
  const config = JSON.parse(JSON.stringify(defaultConfig));

  // Merge project manifest reliability config if present
  if (projectManifest.reliability) {
    mergeConfig(config, projectManifest.reliability);
  }

  // Apply environment variable overrides
  applyEnvOverrides(config, env);

  return config;
}

/**
 * Deep merge source into target
 */
function mergeConfig(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeConfig(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Apply environment variable overrides to config
 */
function applyEnvOverrides(config, env) {
  // Retry configuration
  if (env.COURSELLE_RETRY_ENABLED !== undefined) {
    config.retry.enabled = env.COURSELLE_RETRY_ENABLED === 'true' || env.COURSELLE_RETRY_ENABLED === '1';
  }
  if (env.COURSELLE_MAX_RETRIES !== undefined) {
    config.retry.maxAttempts = parseInt(env.COURSELLE_MAX_RETRIES, 10);
  }

  // Circuit breaker configuration
  if (env.COURSELLE_CIRCUIT_BREAKER_ENABLED !== undefined) {
    config.circuitBreaker.enabled = env.COURSELLE_CIRCUIT_BREAKER_ENABLED === 'true' || env.COURSELLE_CIRCUIT_BREAKER_ENABLED === '1';
  }

  // Timeout configuration
  if (env.COURSELLE_TIMEOUT_PAGE_LOAD !== undefined) {
    config.timeout.pageLoadMs = parseInt(env.COURSELLE_TIMEOUT_PAGE_LOAD, 10);
  }
  if (env.COURSELLE_TIMEOUT_SCREENSHOT !== undefined) {
    config.timeout.screenshotMs = parseInt(env.COURSELLE_TIMEOUT_SCREENSHOT, 10);
  }
  if (env.COURSELLE_TIMEOUT_BROWSER_LAUNCH !== undefined) {
    config.timeout.browserLaunchMs = parseInt(env.COURSELLE_TIMEOUT_BROWSER_LAUNCH, 10);
  }

  // Logging configuration
  if (env.COURSELLE_LOG_LEVEL !== undefined) {
    config.logging.level = env.COURSELLE_LOG_LEVEL;
  }
  if (env.COURSELLE_LOG_FORMAT !== undefined) {
    config.logging.format = env.COURSELLE_LOG_FORMAT;
  }
  if (env.COURSELLE_LOG_TO_FILE !== undefined) {
    config.logging.file.enabled = env.COURSELLE_LOG_TO_FILE === 'true' || env.COURSELLE_LOG_TO_FILE === '1';
  }

  // Metrics configuration
  if (env.COURSELLE_METRICS_ENABLED !== undefined) {
    config.metrics.enabled = env.COURSELLE_METRICS_ENABLED === 'true' || env.COURSELLE_METRICS_ENABLED === '1';
  }

  // Validation configuration
  if (env.COURSELLE_VALIDATION_ENABLED !== undefined) {
    config.validation.enabled = env.COURSELLE_VALIDATION_ENABLED === 'true' || env.COURSELLE_VALIDATION_ENABLED === '1';
  }

  // Resource management configuration
  if (env.COURSELLE_RESOURCE_MANAGEMENT_ENABLED !== undefined) {
    config.resourceManagement.enabled = env.COURSELLE_RESOURCE_MANAGEMENT_ENABLED === 'true' || env.COURSELLE_RESOURCE_MANAGEMENT_ENABLED === '1';
  }
  if (env.COURSELLE_MAX_BROWSER_INSTANCES !== undefined) {
    config.resourceManagement.maxBrowserInstances = parseInt(env.COURSELLE_MAX_BROWSER_INSTANCES, 10);
  }
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];

  // Validate retry config
  if (config.retry.enabled) {
    if (config.retry.maxAttempts < 1 || config.retry.maxAttempts > 10) {
      errors.push('retry.maxAttempts must be between 1 and 10');
    }
    if (config.retry.backoffFactor < 1 || config.retry.backoffFactor > 10) {
      errors.push('retry.backoffFactor must be between 1 and 10');
    }
    if (config.retry.initialDelayMs < 0 || config.retry.initialDelayMs > 60000) {
      errors.push('retry.initialDelayMs must be between 0 and 60000ms');
    }
    if (config.retry.maxDelayMs < config.retry.initialDelayMs) {
      errors.push('retry.maxDelayMs must be >= retry.initialDelayMs');
    }
  }

  // Validate timeout config
  if (config.timeout.pageLoadMs < 1000 || config.timeout.pageLoadMs > 120000) {
    errors.push('timeout.pageLoadMs must be between 1000 and 120000ms');
  }
  if (config.timeout.screenshotMs < 100 || config.timeout.screenshotMs > 30000) {
    errors.push('timeout.screenshotMs must be between 100 and 30000ms');
  }
  if (config.timeout.browserLaunchMs < 5000 || config.timeout.browserLaunchMs > 300000) {
    errors.push('timeout.browserLaunchMs must be between 5000 and 300000ms');
  }

  // Validate resource management config
  if (config.resourceManagement.enabled) {
    if (config.resourceManagement.maxBrowserInstances < 1 || config.resourceManagement.maxBrowserInstances > 10) {
      errors.push('resourceManagement.maxBrowserInstances must be between 1 and 10');
    }
    if (config.resourceManagement.maxPagesPerBrowser < 1 || config.resourceManagement.maxPagesPerBrowser > 100) {
      errors.push('resourceManagement.maxPagesPerBrowser must be between 1 and 100');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid reliability configuration: ${errors.join('; ')}`);
  }

  return true;
}

module.exports = {
  defaultConfig,
  loadReliabilityConfig,
  validateConfig,
  mergeConfig,
  applyEnvOverrides,
};