const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Project utilities for managing coursella projects
 */

class ProjectManager {
  constructor() {
    this.projectsRoot = process.env.PROJECTS_ROOT ||
                       path.join(__dirname, '../../../projects');

    // Try to get Windows username from environment or use default
    const winUser = process.env.USER || process.env.USERNAME || 'user';
    this.winDownloads = process.env.WIN_DOWNLOADS ||
                       `/mnt/c/Users/${winUser}/Downloads`;

    this.viewportWidth = parseInt(process.env.VIEWPORT_WIDTH || '1080', 10);
    this.viewportHeight = parseInt(process.env.VIEWPORT_HEIGHT || '1350', 10);
    this.waitMs = parseInt(process.env.WAIT_MS || '700', 10);
  }

  /**
   * Sanitize project name
   */
  sanitizeName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .trim();
  }

  /**
   * Get project directory path
   */
  getProjectDir(name) {
    const sanitizedName = this.sanitizeName(name);
    return path.join(this.projectsRoot, sanitizedName);
  }

  /**
   * Check if project exists
   */
  projectExists(name) {
    const projectDir = this.getProjectDir(name);
    return fs.existsSync(projectDir);
  }

  /**
   * Create unique project directory (avoid name collisions)
   */
  createUniqueProjectDir(name) {
    const baseName = this.sanitizeName(name) || 'project';
    let projectDir = path.join(this.projectsRoot, baseName);

    if (!fs.existsSync(projectDir)) {
      return projectDir;
    }

    // Find unique name with suffix
    let n = 2;
    while (fs.existsSync(`${projectDir}-${n}`)) {
      n++;
    }
    return `${projectDir}-${n}`;
  }

  /**
   * Get slide number from filename
   */
  getSlideNumber(filename) {
    const base = path.basename(filename);

    // preview.html -> slide1
    if (base === 'preview.html') {
      return 1;
    }

    // preview (N).html -> slide(N+1)
    const previewMatch = base.match(/^preview\s*\((\d+)\)\.html$/i);
    if (previewMatch) {
      return parseInt(previewMatch[1], 10) + 1;
    }

    // slideN.html -> slideN
    const slideMatch = base.match(/^slide(\d+)\.html$/i);
    if (slideMatch) {
      return parseInt(slideMatch[1], 10);
    }

    return 9999; // Invalid file
  }

  /**
   * Get HTML files from Windows Downloads
   */
  getHtmlFilesFromDownloads() {
    const files = [];

    try {
      // Check if downloads directory exists
      if (!fs.existsSync(this.winDownloads)) {
        return files;
      }

      // Read directory and filter HTML files
      const allFiles = fs.readdirSync(this.winDownloads);

      for (const file of allFiles) {
        const filePath = path.join(this.winDownloads, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && file.toLowerCase().endsWith('.html')) {
          // Check if it's a valid slide file
          if (this.getSlideNumber(file) !== 9999) {
            files.push(filePath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading downloads directory: ${error.message}`);
    }

    return files;
  }

  /**
   * Create project manifest (courselle.json)
   */
  createProjectManifest(projectDir, options = {}) {
    const manifest = {
      name: path.basename(projectDir),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: {
        viewport: {
          width: this.viewportWidth,
          height: this.viewportHeight
        },
        waitMs: this.waitMs,
        exportFirstOnly: false,
        ...options.config
      },
      slides: [],
      exports: []
    };

    const manifestPath = path.join(projectDir, 'courselle.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return manifest;
  }

  /**
   * Load project manifest
   */
  loadProjectManifest(projectDir) {
    const manifestPath = path.join(projectDir, 'courselle.json');

    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading manifest: ${error.message}`);
      return null;
    }
  }

  /**
   * Update project manifest
   */
  updateProjectManifest(projectDir, updates) {
    const manifest = this.loadProjectManifest(projectDir) ||
                    this.createProjectManifest(projectDir);

    // Deep merge updates
    const updated = this.deepMerge(manifest, updates);
    updated.updatedAt = new Date().toISOString();

    const manifestPath = path.join(projectDir, 'courselle.json');
    fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2));

    return updated;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Create project structure
   */
  createProjectStructure(projectDir) {
    const htmlDir = path.join(projectDir, 'html');
    const pngDir = path.join(projectDir, 'png');

    fs.mkdirSync(htmlDir, { recursive: true });
    fs.mkdirSync(pngDir, { recursive: true });

    return { htmlDir, pngDir };
  }

  /**
   * List all projects
   */
  listProjects() {
    if (!fs.existsSync(this.projectsRoot)) {
      return [];
    }

    return fs.readdirSync(this.projectsRoot)
      .filter(item => {
        const itemPath = path.join(this.projectsRoot, item);
        return fs.statSync(itemPath).isDirectory();
      });
  }
}

module.exports = ProjectManager;