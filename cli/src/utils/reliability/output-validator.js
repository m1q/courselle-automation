/**
 * Output Validator - PNG file validation and integrity checks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StructuredLogger } = require('../logging/structured-logger');
const { createError } = require('./error-categorizer');

/**
 * PNG file signature (first 8 bytes)
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * PNG chunk structure
 */
class PngChunk {
  constructor(data) {
    this.length = data.readUInt32BE(0);
    this.type = data.toString('ascii', 4, 8);
    this.data = data.slice(8, 8 + this.length);
    this.crc = data.readUInt32BE(8 + this.length);
  }

  /**
   * Validate chunk CRC
   */
  validateCRC() {
    const crcData = Buffer.concat([
      Buffer.from(this.type, 'ascii'),
      this.data
    ]);

    const crc = crypto.createHash('crc32').update(crcData).digest('hex');
    const expectedCRC = this.crc.toString(16).padStart(8, '0');
    return crc === expectedCRC;
  }
}

/**
 * Output Validator class
 */
class OutputValidator {
  constructor(config = {}, logger = null) {
    this.config = {
      enabled: config.enabled || false,
      checkFileSize: config.checkFileSize !== false,
      minFileSizeBytes: config.minFileSizeBytes || 1024, // 1KB
      maxFileSizeBytes: config.maxFileSizeBytes || 10485760, // 10MB
      verifyChecksum: config.verifyChecksum || false,
      validatePngHeader: config.validatePngHeader !== false,
      ...config,
    };

    this.logger = logger || new StructuredLogger({
      level: 'info',
      format: 'simple',
    });

    // Validation results cache
    this.validationCache = new Map();
    this.cacheTTL = 60000; // 1 minute
  }

  /**
   * Validate a PNG file
   * @param {string} filePath - Path to PNG file
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validatePngFile(filePath, options = {}) {
    const startTime = Date.now();
    const validationId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check cache
    const cacheKey = `${filePath}_${JSON.stringify(options)}`;
    const cached = this.validationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
      return cached.result;
    }

    const result = {
      id: validationId,
      filePath,
      fileName: path.basename(filePath),
      valid: false,
      errors: [],
      warnings: [],
      checks: {
        fileExists: false,
        fileSize: false,
        pngSignature: false,
        pngStructure: false,
        checksum: null,
      },
      metadata: {},
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Check if validation is enabled
      if (!this.config.enabled && !options.force) {
        result.valid = true;
        result.warnings.push('Validation is disabled, skipping checks');
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // 1. Check file exists
      if (!fs.existsSync(filePath)) {
        result.errors.push(`File does not exist: ${filePath}`);
        result.durationMs = Date.now() - startTime;
        return result;
      }
      result.checks.fileExists = true;

      // 2. Get file stats
      const stats = fs.statSync(filePath);
      result.metadata.fileSize = stats.size;
      result.metadata.createdAt = stats.birthtime.toISOString();
      result.metadata.modifiedAt = stats.mtime.toISOString();

      // 3. Validate file size
      if (this.config.checkFileSize) {
        const sizeValid = stats.size >= this.config.minFileSizeBytes &&
                         stats.size <= this.config.maxFileSizeBytes;

        result.checks.fileSize = sizeValid;

        if (!sizeValid) {
          result.errors.push(
            `File size ${stats.size} bytes is outside valid range ` +
            `[${this.config.minFileSizeBytes}-${this.config.maxFileSizeBytes}]`
          );
        }
      } else {
        result.checks.fileSize = true;
      }

      // 4. Validate PNG signature
      if (this.config.validatePngHeader) {
        const signatureValid = await this.validatePngSignature(filePath);
        result.checks.pngSignature = signatureValid;

        if (!signatureValid) {
          result.errors.push('Invalid PNG signature (file may be corrupted or not a PNG)');
        }
      } else {
        result.checks.pngSignature = true;
      }

      // 5. Validate PNG structure (basic)
      if (this.config.validatePngHeader) {
        const structureValid = await this.validatePngStructure(filePath);
        result.checks.pngStructure = structureValid;

        if (!structureValid) {
          result.errors.push('PNG file structure appears to be invalid');
        }
      } else {
        result.checks.pngStructure = true;
      }

      // 6. Verify checksum (optional)
      if (this.config.verifyChecksum) {
        try {
          const checksum = await this.calculateFileChecksum(filePath);
          result.checks.checksum = checksum;
          result.metadata.checksum = checksum;
        } catch (error) {
          result.warnings.push(`Failed to calculate checksum: ${error.message}`);
        }
      }

      // Determine overall validity
      const hasErrors = result.errors.length > 0;
      const allChecksPassed = Object.values(result.checks)
        .filter(val => typeof val === 'boolean')
        .every(val => val === true);

      result.valid = !hasErrors && allChecksPassed;

      // Log validation result
      if (result.valid) {
        this.logger.debug(`PNG validation passed: ${filePath}`, {
          validationId,
          fileSize: stats.size,
          durationMs: result.durationMs,
        });
      } else {
        this.logger.warn(`PNG validation failed: ${filePath}`, {
          validationId,
          errors: result.errors,
          warnings: result.warnings,
        });
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      this.logger.error(`PNG validation error for ${filePath}: ${error.message}`, {
        validationId,
        error,
      });
    }

    result.durationMs = Date.now() - startTime;

    // Cache result
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Validate PNG file signature (first 8 bytes)
   */
  async validatePngSignature(filePath) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { start: 0, end: 7 });

      stream.on('data', (data) => {
        if (data.length !== 8) {
          resolve(false);
          return;
        }

        const signatureValid = data.equals(PNG_SIGNATURE);
        resolve(signatureValid);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Validate basic PNG structure
   */
  async validatePngStructure(filePath) {
    return new Promise((resolve, reject) => {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(8);

      try {
        // Read signature
        fs.readSync(fd, buffer, 0, 8, 0);

        if (!buffer.equals(PNG_SIGNATURE)) {
          fs.closeSync(fd);
          resolve(false);
          return;
        }

        // Check for IHDR chunk (should be first chunk after signature)
        const ihdrBuffer = Buffer.alloc(12);
        fs.readSync(fd, ihdrBuffer, 0, 12, 8);

        if (ihdrBuffer.length < 12) {
          fs.closeSync(fd);
          resolve(false);
          return;
        }

        const chunkLength = ihdrBuffer.readUInt32BE(0);
        const chunkType = ihdrBuffer.toString('ascii', 4, 8);

        // IHDR chunk should be 13 bytes of data
        if (chunkType !== 'IHDR' || chunkLength !== 13) {
          fs.closeSync(fd);
          resolve(false);
          return;
        }

        // Check for IEND chunk (should be at end of file)
        const fileSize = fs.statSync(filePath).size;
        const iendBuffer = Buffer.alloc(12);
        fs.readSync(fd, iendBuffer, 0, 12, fileSize - 12);

        const endChunkType = iendBuffer.toString('ascii', 4, 8);
        const hasValidEnd = endChunkType === 'IEND';

        fs.closeSync(fd);
        resolve(hasValidEnd);

      } catch (error) {
        try { fs.closeSync(fd); } catch {}
        reject(error);
      }
    });
  }

  /**
   * Calculate file checksum (SHA-256)
   */
  async calculateFileChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Validate multiple PNG files
   */
  async validatePngFiles(filePaths, options = {}) {
    const results = [];
    const startTime = Date.now();

    for (const filePath of filePaths) {
      try {
        const result = await this.validatePngFile(filePath, options);
        results.push(result);
      } catch (error) {
        results.push({
          filePath,
          valid: false,
          errors: [`Validation error: ${error.message}`],
          warnings: [],
          durationMs: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const summary = this.generateValidationSummary(results);
    summary.totalDurationMs = Date.now() - startTime;

    return {
      results,
      summary,
    };
  }

  /**
   * Generate validation summary
   */
  generateValidationSummary(results) {
    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.filter(r => !r.valid).length;
    const totalFiles = results.length;

    const errors = results.flatMap(r => r.errors);
    const warnings = results.flatMap(r => r.warnings);

    const avgDuration = results.length > 0
      ? results.reduce((sum, r) => sum + (r.durationMs || 0), 0) / results.length
      : 0;

    return {
      totalFiles,
      validFiles: validCount,
      invalidFiles: invalidCount,
      successRate: totalFiles > 0 ? (validCount / totalFiles) * 100 : 0,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      averageDurationMs: Math.round(avgDuration),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    const cacheSize = this.validationCache.size;
    const cacheEntries = Array.from(this.validationCache.entries())
      .map(([key, entry]) => ({
        key: key.substring(0, 50) + '...',
        timestamp: new Date(entry.timestamp).toISOString(),
        ageMs: Date.now() - entry.timestamp,
        valid: entry.result.valid,
      }));

    return {
      config: this.config,
      cacheSize,
      cacheEntries,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    const clearedCount = this.validationCache.size;
    this.validationCache.clear();
    this.logger.debug(`Cleared validation cache (${clearedCount} entries)`);
    return clearedCount;
  }

  /**
   * Create a validation error
   */
  createValidationError(message, details = {}) {
    return createError(message, {
      category: 'PERMANENT',
      retryable: false,
      details: { ...details, validation: true },
    });
  }
}

module.exports = {
  PNG_SIGNATURE,
  PngChunk,
  OutputValidator,
  createOutputValidator: (config, logger) => new OutputValidator(config, logger),
};