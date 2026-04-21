/**
 * Resource Manager - Browser connection pooling and resource management
 */

const { chromium } = require('playwright');
const { StructuredLogger } = require('../logging/structured-logger');
const { createError } = require('./error-categorizer');

/**
 * Browser instance wrapper with usage tracking
 */
class BrowserInstance {
  constructor(browser, id, config) {
    this.browser = browser;
    this.id = id;
    this.config = config;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.pageCount = 0;
    this.isActive = true;
    this.isClosing = false;
  }

  /**
   * Create a new page from this browser
   */
  async createPage(viewport = { width: 1080, height: 1350 }) {
    if (!this.isActive || this.isClosing) {
      throw new Error('Browser instance is not active');
    }

    if (this.pageCount >= this.config.maxPagesPerBrowser) {
      throw new Error(`Maximum pages per browser reached (${this.config.maxPagesPerBrowser})`);
    }

    const page = await this.browser.newPage({ viewport });
    this.pageCount++;
    this.lastUsedAt = Date.now();

    // Track page closure
    page.once('close', () => {
      this.pageCount--;
      this.lastUsedAt = Date.now();
    });

    return page;
  }

  /**
   * Check if browser is idle (no pages and hasn't been used for a while)
   */
  isIdle(cleanupIntervalMs) {
    const idleTime = Date.now() - this.lastUsedAt;
    return this.pageCount === 0 && idleTime > cleanupIntervalMs;
  }

  /**
   * Close the browser instance
   */
  async close() {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;
    this.isActive = false;

    try {
      await this.browser.close();
    } catch (error) {
      // Ignore close errors, browser might already be closed
    }
  }
}

/**
 * Resource Manager for browser pooling and resource management
 */
class ResourceManager {
  constructor(config = {}, logger = null) {
    this.config = {
      enabled: config.enabled || false,
      maxBrowserInstances: config.maxBrowserInstances || 3,
      browserReuse: config.browserReuse !== false,
      maxPagesPerBrowser: config.maxPagesPerBrowser || 10,
      cleanupIntervalMs: config.cleanupIntervalMs || 300000, // 5 minutes
      maxMemoryUsageMb: config.maxMemoryUsageMb || 512,
      ...config,
    };

    this.logger = logger || new StructuredLogger({
      level: 'info',
      format: 'simple',
    });

    // Browser pool state
    this.browsers = new Map(); // id -> BrowserInstance
    this.pendingRequests = [];
    this.cleanupInterval = null;
    this.isShuttingDown = false;

    // Metrics
    this.metrics = {
      browsersCreated: 0,
      browsersClosed: 0,
      pagesCreated: 0,
      pagesClosed: 0,
      acquireRequests: 0,
      acquireSuccess: 0,
      acquireFailures: 0,
      poolSize: 0,
    };

    // Start cleanup timer if enabled
    if (this.config.enabled && this.config.browserReuse) {
      this.startCleanupTimer();
    }

    // Handle process termination
    this.setupShutdownHandlers();
  }

  /**
   * Acquire a browser instance (creates new or reuses existing)
   */
  async acquireBrowser(viewport = { width: 1080, height: 1350 }) {
    this.metrics.acquireRequests++;

    if (!this.config.enabled || !this.config.browserReuse) {
      // Create a new browser instance (no pooling)
      try {
        const browser = await this.createBrowserInstance();
        const page = await browser.createPage(viewport);
        this.metrics.acquireSuccess++;
        return { browser: browser.browser, page, instanceId: browser.id };
      } catch (error) {
        this.metrics.acquireFailures++;
        throw error;
      }
    }

    // Try to find an available browser instance
    let browserInstance = this.findAvailableBrowserInstance();

    if (!browserInstance && this.browsers.size < this.config.maxBrowserInstances) {
      // Create new browser instance
      browserInstance = await this.createBrowserInstance();
      this.browsers.set(browserInstance.id, browserInstance);
    }

    if (!browserInstance) {
      // No available browsers and max reached
      this.metrics.acquireFailures++;
      throw new Error('Maximum browser instances reached, cannot acquire browser');
    }

    try {
      const page = await browserInstance.createPage(viewport);
      this.metrics.acquireSuccess++;
      return { browser: browserInstance.browser, page, instanceId: browserInstance.id };
    } catch (error) {
      this.metrics.acquireFailures++;
      throw error;
    }
  }

  /**
   * Release a browser instance (mark as available for reuse)
   */
  releaseBrowser(instanceId) {
    if (!this.config.enabled || !this.config.browserReuse) {
      return; // Nothing to release in non-pooled mode
    }

    const browserInstance = this.browsers.get(instanceId);
    if (!browserInstance) {
      return;
    }

    // Update last used timestamp
    browserInstance.lastUsedAt = Date.now();

    // If browser has no pages and we're shutting down, close it
    if (this.isShuttingDown && browserInstance.pageCount === 0) {
      this.closeBrowserInstance(browserInstance.id);
    }
  }

  /**
   * Create a new browser instance
   */
  async createBrowserInstance() {
    this.logger.debug('Creating new browser instance');

    try {
      const browser = await chromium.launch({ headless: true });
      const instanceId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const browserInstance = new BrowserInstance(browser, instanceId, this.config);

      this.browsers.set(instanceId, browserInstance);
      this.metrics.browsersCreated++;
      this.metrics.poolSize = this.browsers.size;

      // Monitor browser for crashes
      browser.once('disconnected', () => {
        this.handleBrowserDisconnect(instanceId);
      });

      this.logger.info(`Browser instance created: ${instanceId}`);
      return browserInstance;

    } catch (error) {
      this.logger.error(`Failed to create browser instance: ${error.message}`, { error });
      throw createError(`Failed to create browser: ${error.message}`, {
        category: 'RESOURCE',
        retryable: true,
        details: { originalError: error },
      });
    }
  }

  /**
   * Find an available browser instance (with capacity for new pages)
   */
  findAvailableBrowserInstance() {
    for (const [id, browserInstance] of this.browsers) {
      if (browserInstance.isActive &&
          !browserInstance.isClosing &&
          browserInstance.pageCount < this.config.maxPagesPerBrowser) {
        return browserInstance;
      }
    }
    return null;
  }

  /**
   * Handle browser disconnect (crash)
   */
  handleBrowserDisconnect(instanceId) {
    const browserInstance = this.browsers.get(instanceId);
    if (!browserInstance) {
      return;
    }

    browserInstance.isActive = false;
    this.logger.warn(`Browser instance disconnected: ${instanceId}`);

    // Clean up from pool
    setTimeout(() => {
      this.browsers.delete(instanceId);
      this.metrics.poolSize = this.browsers.size;
    }, 100);
  }

  /**
   * Close a browser instance
   */
  async closeBrowserInstance(instanceId) {
    const browserInstance = this.browsers.get(instanceId);
    if (!browserInstance) {
      return;
    }

    try {
      await browserInstance.close();
      this.browsers.delete(instanceId);
      this.metrics.browsersClosed++;
      this.metrics.poolSize = this.browsers.size;
      this.logger.debug(`Browser instance closed: ${instanceId}`);
    } catch (error) {
      this.logger.warn(`Error closing browser instance ${instanceId}: ${error.message}`);
    }
  }

  /**
   * Close idle browser instances
   */
  cleanupIdleBrowsers() {
    if (!this.config.enabled || !this.config.browserReuse) {
      return;
    }

    let closedCount = 0;

    for (const [instanceId, browserInstance] of this.browsers) {
      if (browserInstance.isIdle(this.config.cleanupIntervalMs)) {
        this.closeBrowserInstance(instanceId);
        closedCount++;
      }
    }

    if (closedCount > 0) {
      this.logger.debug(`Cleaned up ${closedCount} idle browser instances`);
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, Math.min(this.config.cleanupIntervalMs, 60000)); // Check at most every minute

    // Unref to allow process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Setup shutdown handlers for graceful cleanup
   */
  setupShutdownHandlers() {
    const shutdown = async () => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      this.logger.info('Shutting down resource manager...');

      // Stop cleanup timer
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Close all browser instances
      const closePromises = [];
      for (const [instanceId] of this.browsers) {
        closePromises.push(this.closeBrowserInstance(instanceId));
      }

      await Promise.allSettled(closePromises);
      this.logger.info('Resource manager shutdown complete');
    };

    // Handle process termination signals
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    process.once('beforeExit', shutdown);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const activeBrowsers = Array.from(this.browsers.values()).filter(b => b.isActive);
    const idleBrowsers = Array.from(this.browsers.values()).filter(b => b.isIdle(this.config.cleanupIntervalMs));
    const totalPages = Array.from(this.browsers.values()).reduce((sum, b) => sum + b.pageCount, 0);

    return {
      ...this.metrics,
      activeBrowsers: activeBrowsers.length,
      idleBrowsers: idleBrowsers.length,
      totalPages,
      config: {
        enabled: this.config.enabled,
        maxBrowserInstances: this.config.maxBrowserInstances,
        browserReuse: this.config.browserReuse,
        maxPagesPerBrowser: this.config.maxPagesPerBrowser,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current pool status
   */
  getStatus() {
    const browsers = Array.from(this.browsers.values()).map(b => ({
      id: b.id,
      pageCount: b.pageCount,
      isActive: b.isActive,
      isClosing: b.isClosing,
      createdAt: new Date(b.createdAt).toISOString(),
      lastUsedAt: new Date(b.lastUsedAt).toISOString(),
      idle: b.isIdle(this.config.cleanupIntervalMs),
    }));

    return {
      enabled: this.config.enabled,
      browserReuse: this.config.browserReuse,
      totalBrowsers: this.browsers.size,
      maxBrowserInstances: this.config.maxBrowserInstances,
      browsers,
    };
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    this.isShuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all browser instances
    const closePromises = [];
    for (const [instanceId] of this.browsers) {
      closePromises.push(this.closeBrowserInstance(instanceId));
    }

    await Promise.allSettled(closePromises);
    this.logger.info('Resource manager cleanup complete');
  }
}

module.exports = {
  BrowserInstance,
  ResourceManager,
  createResourceManager: (config, logger) => new ResourceManager(config, logger),
};