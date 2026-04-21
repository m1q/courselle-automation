/**
 * Structured logging with multiple output formats and levels
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class StructuredLogger extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      level: config.level || 'info',
      format: config.format || 'pretty',
      file: {
        enabled: config.file?.enabled || false,
        path: config.file?.path || './logs/courselle-{timestamp}.log',
        maxFiles: config.file?.maxFiles || 10,
        maxSizeMb: config.file?.maxSizeMb || 10,
        ...config.file,
      },
      console: {
        enabled: config.console?.enabled !== false,
        colors: config.console?.colors !== false,
        timestamps: config.console?.timestamps !== false,
        ...config.console,
      },
    };

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    this.currentLevel = this.levels[this.config.level] || this.levels.info;
    this.logFile = null;
    this.logStream = null;
    this.logCount = 0;

    // Initialize file logging if enabled
    if (this.config.file.enabled) {
      this.initFileLogging();
    }

    // Emit events for external listeners
    this.on('log', (entry) => {
      // Can be used by metrics or monitoring systems
    });
  }

  /**
   * Initialize file logging
   */
  initFileLogging() {
    try {
      const logPath = this.resolveLogPath(this.config.file.path);
      const logDir = path.dirname(logPath);

      // Create log directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Open log file stream
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
      this.logFile = logPath;

      // Handle stream errors
      this.logStream.on('error', (err) => {
        console.error(`Log file error: ${err.message}`);
        this.logStream = null;
        this.logFile = null;
      });

      // Rotate logs if file gets too large
      this.checkLogRotation();

    } catch (error) {
      console.error(`Failed to initialize file logging: ${error.message}`);
      this.config.file.enabled = false;
    }
  }

  /**
   * Resolve log path with placeholders
   */
  resolveLogPath(template) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return template.replace('{timestamp}', timestamp);
  }

  /**
   * Check if log file needs rotation
   */
  checkLogRotation() {
    if (!this.logFile || !fs.existsSync(this.logFile)) {
      return;
    }

    try {
      const stats = fs.statSync(this.logFile);
      const fileSizeMb = stats.size / (1024 * 1024);

      if (fileSizeMb >= this.config.file.maxSizeMb) {
        this.rotateLogs();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Rotate log files
   */
  rotateLogs() {
    if (!this.logFile) return;

    try {
      // Close current stream
      if (this.logStream) {
        this.logStream.end();
      }

      // Rename current log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = this.logFile.replace('.log', `-${timestamp}.log`);
      fs.renameSync(this.logFile, rotatedPath);

      // Reopen log file
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

      // Clean up old log files
      this.cleanupOldLogs();

    } catch (error) {
      console.error(`Log rotation failed: ${error.message}`);
      // Try to reopen stream to original file
      try {
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      } catch (err) {
        this.config.file.enabled = false;
      }
    }
  }

  /**
   * Clean up old log files
   */
  cleanupOldLogs() {
    if (!this.logFile) return;

    const logDir = path.dirname(this.logFile);
    const logBase = path.basename(this.logFile, '.log');

    try {
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(logBase) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          time: fs.statSync(path.join(logDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // Newest first

      // Remove files beyond maxFiles limit
      if (files.length > this.config.file.maxFiles) {
        const toRemove = files.slice(this.config.file.maxFiles);
        toRemove.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            // Ignore deletion errors
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Format log entry based on configuration
   */
  formatLogEntry(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    // Add process info for errors
    if (level === 'error' && meta.error) {
      entry.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        code: meta.error.code,
      };
    }

    switch (this.config.format) {
      case 'json':
        return JSON.stringify(entry);

      case 'simple':
        const time = new Date().toISOString().split('T')[1].split('.')[0];
        return `[${time}] ${level.toUpperCase()}: ${message}`;

      case 'pretty':
      default:
        return this.formatPretty(entry);
    }
  }

  /**
   * Format pretty console output with colors
   */
  formatPretty(entry) {
    const colors = this.config.console.colors ? {
      debug: '\x1b[90m', // gray
      info: '\x1b[36m',  // cyan
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      reset: '\x1b[0m',
      timestamp: '\x1b[90m',
    } : {
      debug: '', info: '', warn: '', error: '', reset: '', timestamp: '',
    };

    const levelColors = {
      debug: colors.debug,
      info: colors.info,
      warn: colors.warn,
      error: colors.error,
    };

    const time = entry.timestamp.split('T')[1].split('.')[0];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const color = levelColors[entry.level] || colors.info;

    let output = '';

    if (this.config.console.timestamps) {
      output += `${colors.timestamp}[${time}]${colors.reset} `;
    }

    output += `${color}${levelStr}${colors.reset} ${entry.message}`;

    // Add error details if present
    if (entry.error) {
      output += `\n${colors.error}  Error: ${entry.error.message}${colors.reset}`;
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(0, 3);
        output += `\n${colors.error}  Stack: ${stackLines.join('\n         ')}${colors.reset}`;
      }
    }

    // Add context if present
    if (entry.context) {
      output += ` ${colors.debug}(${JSON.stringify(entry.context)})${colors.reset}`;
    }

    return output;
  }

  /**
   * Check if logging is enabled for given level
   */
  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  /**
   * Write log entry to all configured outputs
   */
  writeLog(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatLogEntry(level, message, meta);

    // Write to console
    if (this.config.console.enabled) {
      const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          level === 'info' ? console.log :
                          console.debug;
      consoleMethod(formatted);
    }

    // Write to file (without colors)
    if (this.config.file.enabled && this.logStream) {
      // For file logging, use JSON format regardless of console format
      const fileEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
      };

      if (meta.error) {
        fileEntry.error = {
          message: meta.error.message,
          stack: meta.error.stack,
          code: meta.error.code,
        };
      }

      this.logStream.write(JSON.stringify(fileEntry) + '\n');
      this.logCount++;

      // Check rotation every 100 log entries
      if (this.logCount % 100 === 0) {
        this.checkLogRotation();
      }
    }

    // Emit event for external listeners
    this.emit('log', {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    });
  }

  /**
   * Log methods
   */
  debug(message, meta = {}) {
    this.writeLog('debug', message, meta);
  }

  info(message, meta = {}) {
    this.writeLog('info', message, meta);
  }

  warn(message, meta = {}) {
    this.writeLog('warn', message, meta);
  }

  error(message, meta = {}) {
    this.writeLog('error', message, meta);
  }

  /**
   * Log with context (for compatibility with existing console.log patterns)
   */
  log(message, ...args) {
    const meta = {};

    // Extract error object if present
    if (args.length > 0 && args[0] instanceof Error) {
      meta.error = args[0];
      meta.context = args.slice(1);
    } else if (args.length > 0) {
      meta.context = args;
    }

    this.info(message, meta);
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    const childLogger = new StructuredLogger(this.config);

    // Override writeLog to add context
    const originalWriteLog = childLogger.writeLog.bind(childLogger);
    childLogger.writeLog = (level, message, meta = {}) => {
      const enhancedMeta = {
        ...context,
        ...meta,
      };
      originalWriteLog(level, message, enhancedMeta);
    };

    return childLogger;
  }

  /**
   * Close log file stream
   */
  close() {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// Create default logger instance
const defaultLogger = new StructuredLogger();

module.exports = {
  StructuredLogger,
  defaultLogger,
  logger: defaultLogger,
};