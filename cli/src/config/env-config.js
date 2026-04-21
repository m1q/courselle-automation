/**
 * Environment variable configuration and validation
 */

const envSchema = {
  // Core export settings (existing)
  VIEWPORT_WIDTH: {
    description: 'Viewport width in pixels',
    type: 'integer',
    default: 1080,
    min: 100,
    max: 3840,
    env: 'VIEWPORT_WIDTH',
  },
  VIEWPORT_HEIGHT: {
    description: 'Viewport height in pixels',
    type: 'integer',
    default: 1350,
    min: 100,
    max: 3840,
    env: 'VIEWPORT_HEIGHT',
  },
  WAIT_MS: {
    description: 'Milliseconds to wait before screenshot',
    type: 'integer',
    default: 700,
    min: 0,
    max: 30000,
    env: 'WAIT_MS',
  },
  EXPORT_FIRST_ONLY: {
    description: 'Export only first slide when set to "1"',
    type: 'boolean',
    default: false,
    env: 'EXPORT_FIRST_ONLY',
  },
  PROJECTS_ROOT: {
    description: 'Path to projects directory',
    type: 'string',
    default: './projects',
    env: 'PROJECTS_ROOT',
  },
  WIN_DOWNLOADS: {
    description: 'Windows Downloads path in WSL',
    type: 'string',
    default: '/mnt/c/Users/user/Downloads',
    env: 'WIN_DOWNLOADS',
  },

  // Reliability settings (new)
  COURSELLE_RETRY_ENABLED: {
    description: 'Enable retry logic for transient failures',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_RETRY_ENABLED',
  },
  COURSELLE_MAX_RETRIES: {
    description: 'Maximum number of retry attempts',
    type: 'integer',
    default: 3,
    min: 1,
    max: 10,
    env: 'COURSELLE_MAX_RETRIES',
  },
  COURSELLE_CIRCUIT_BREAKER_ENABLED: {
    description: 'Enable circuit breaker pattern',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_CIRCUIT_BREAKER_ENABLED',
  },
  COURSELLE_TIMEOUT_PAGE_LOAD: {
    description: 'Page load timeout in milliseconds',
    type: 'integer',
    default: 30000,
    min: 1000,
    max: 120000,
    env: 'COURSELLE_TIMEOUT_PAGE_LOAD',
  },
  COURSELLE_TIMEOUT_SCREENSHOT: {
    description: 'Screenshot timeout in milliseconds',
    type: 'integer',
    default: 10000,
    min: 100,
    max: 30000,
    env: 'COURSELLE_TIMEOUT_SCREENSHOT',
  },
  COURSELLE_TIMEOUT_BROWSER_LAUNCH: {
    description: 'Browser launch timeout in milliseconds',
    type: 'integer',
    default: 60000,
    min: 5000,
    max: 300000,
    env: 'COURSELLE_TIMEOUT_BROWSER_LAUNCH',
  },
  COURSELLE_LOG_LEVEL: {
    description: 'Logging level (debug, info, warn, error)',
    type: 'enum',
    default: 'info',
    options: ['debug', 'info', 'warn', 'error'],
    env: 'COURSELLE_LOG_LEVEL',
  },
  COURSELLE_LOG_FORMAT: {
    description: 'Logging format (json, pretty, simple)',
    type: 'enum',
    default: 'pretty',
    options: ['json', 'pretty', 'simple'],
    env: 'COURSELLE_LOG_FORMAT',
  },
  COURSELLE_LOG_TO_FILE: {
    description: 'Enable file logging',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_LOG_TO_FILE',
  },
  COURSELLE_METRICS_ENABLED: {
    description: 'Enable metrics collection',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_METRICS_ENABLED',
  },
  COURSELLE_VALIDATION_ENABLED: {
    description: 'Enable output validation',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_VALIDATION_ENABLED',
  },
  COURSELLE_RESOURCE_MANAGEMENT_ENABLED: {
    description: 'Enable resource management',
    type: 'boolean',
    default: false,
    env: 'COURSELLE_RESOURCE_MANAGEMENT_ENABLED',
  },
  COURSELLE_MAX_BROWSER_INSTANCES: {
    description: 'Maximum browser instances for pooling',
    type: 'integer',
    default: 3,
    min: 1,
    max: 10,
    env: 'COURSELLE_MAX_BROWSER_INSTANCES',
  },
};

/**
 * Parse environment variable value based on type
 */
function parseEnvValue(value, schema) {
  if (value === undefined || value === '') {
    return schema.default;
  }

  switch (schema.type) {
    case 'integer':
      const intValue = parseInt(value, 10);
      if (isNaN(intValue)) {
        throw new Error(`Invalid integer value for ${schema.env}: ${value}`);
      }
      if (schema.min !== undefined && intValue < schema.min) {
        throw new Error(`${schema.env} must be >= ${schema.min}, got ${intValue}`);
      }
      if (schema.max !== undefined && intValue > schema.max) {
        throw new Error(`${schema.env} must be <= ${schema.max}, got ${intValue}`);
      }
      return intValue;

    case 'boolean':
      return value === 'true' || value === '1' || value === 'yes';

    case 'enum':
      if (!schema.options.includes(value)) {
        throw new Error(`${schema.env} must be one of: ${schema.options.join(', ')}, got ${value}`);
      }
      return value;

    case 'string':
      return value;

    default:
      return value;
  }
}

/**
 * Load and validate all environment variables
 */
function loadEnvConfig(env = process.env) {
  const config = {};
  const errors = [];

  for (const [key, schema] of Object.entries(envSchema)) {
    try {
      const envValue = env[schema.env];
      config[key] = parseEnvValue(envValue, schema);
    } catch (error) {
      errors.push(error.message);
      config[key] = schema.default;
    }
  }

  if (errors.length > 0) {
    console.warn('Environment variable validation warnings:');
    errors.forEach(error => console.warn(`  ⚠️  ${error}`));
  }

  return config;
}

/**
 * Get environment variable description for help text
 */
function getEnvDescriptions() {
  const descriptions = [];

  for (const [key, schema] of Object.entries(envSchema)) {
    descriptions.push({
      name: schema.env,
      description: schema.description,
      default: schema.default,
      type: schema.type,
    });
  }

  return descriptions;
}

/**
 * Generate help text for environment variables
 */
function generateEnvHelpText() {
  const lines = ['Environment Variables:'];

  for (const [key, schema] of Object.entries(envSchema)) {
    const defaultValue = typeof schema.default === 'string' ? `"${schema.default}"` : schema.default;
    const typeInfo = schema.type === 'enum' ? `[${schema.options.join('|')}]` : schema.type;

    lines.push(`  ${schema.env.padEnd(35)} ${schema.description}`);
    lines.push(`    Default: ${defaultValue}, Type: ${typeInfo}`);

    if (schema.min !== undefined || schema.max !== undefined) {
      const constraints = [];
      if (schema.min !== undefined) constraints.push(`min: ${schema.min}`);
      if (schema.max !== undefined) constraints.push(`max: ${schema.max}`);
      lines.push(`    Constraints: ${constraints.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  envSchema,
  loadEnvConfig,
  getEnvDescriptions,
  generateEnvHelpText,
  parseEnvValue,
};