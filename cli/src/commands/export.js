const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ProjectManager = require('../utils/project');

/**
 * Export command - Export a single project
 */
module.exports = function exportCommand(program) {
  const projectManager = new ProjectManager();

  program
    .command('export <name>')
    .description('Export all slides of a specific project')
    .option('-f, --first', 'Export only the first slide')
    .option('-l, --legacy', 'Use legacy export-all.js script')
    .action(async (name, options) => {
      try {
        console.log(`🚀 Exporting project: ${name}`);

        // Find project directory
        const projectDir = projectManager.getProjectDir(name);

        if (!fs.existsSync(projectDir)) {
          console.error(`❌ Project not found: ${projectDir}`);
          console.error(`Available projects: ${projectManager.listProjects().join(', ')}`);
          process.exit(1);
        }

        const htmlDir = path.join(projectDir, 'html');
        const pngDir = path.join(projectDir, 'png');

        if (!fs.existsSync(htmlDir)) {
          console.error(`❌ HTML folder not found: ${htmlDir}`);
          process.exit(1);
        }

        // Ensure PNG directory exists
        fs.mkdirSync(pngDir, { recursive: true });

        // Load project manifest
        const manifest = projectManager.loadProjectManifest(projectDir);
        if (!manifest) {
          console.warn('⚠️  Project manifest not found, using defaults');
        }

        if (options.legacy) {
          console.log('🔄 Using legacy export script...');
          await runLegacyExport(projectDir, options.first);
          return;
        }

        // Use new export engine
        await exportProject(projectDir, manifest, options.first);

        // Update manifest with export record
        if (manifest) {
          const exportRecord = {
            timestamp: new Date().toISOString(),
            slidesExported: options.first ? 1 : 'all',
            firstOnly: options.first || false
          };

          projectManager.updateProjectManifest(projectDir, {
            exports: [...(manifest.exports || []), exportRecord]
          });
        }

        console.log('\n✅ Export completed successfully');
        console.log(`PNG folder: ${pngDir}`);

      } catch (error) {
        console.error(`❌ Error exporting project: ${error.message}`);
        process.exit(1);
      }
    });
};

/**
 * Export project using new engine
 */
async function exportProject(projectDir, manifest, firstOnly = false) {
  const htmlDir = path.join(projectDir, 'html');
  const pngDir = path.join(projectDir, 'png');

  // Get configuration
  const config = manifest?.config || {};
  const viewportWidth = config.viewport?.width || parseInt(process.env.VIEWPORT_WIDTH || '1080', 10);
  const viewportHeight = config.viewport?.height || parseInt(process.env.VIEWPORT_HEIGHT || '1350', 10);
  const waitMs = config.waitMs || parseInt(process.env.WAIT_MS || '700', 10);

  // Get HTML files
  const htmlFiles = fs.readdirSync(htmlDir)
    .filter(file => /^slide\d+\.html$/i.test(file))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^slide(\d+)\.html$/i)[1], 10);
      const numB = parseInt(b.match(/^slide(\d+)\.html$/i)[1], 10);
      return numA - numB;
    });

  if (htmlFiles.length === 0) {
    throw new Error('No slide HTML files found in html folder.');
  }

  const filesToExport = firstOnly ? [htmlFiles[0]] : htmlFiles;

  console.log(`📄 Found ${htmlFiles.length} slide(s), exporting ${filesToExport.length}`);

  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ headless: true });

  let successCount = 0;
  let failCount = 0;

  for (const [index, file] of filesToExport.entries()) {
    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight }
    });

    try {
      const filePath = 'file://' + path.join(htmlDir, file);
      const outputName = file.replace(/\.html$/i, '.png');
      const outputPath = path.join(pngDir, outputName);

      console.log(`\n🖼️  [${index + 1}/${filesToExport.length}] Processing: ${file}`);

      // Load HTML file
      await page.goto(filePath, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'screen' });

      // Wait for fonts to load
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      // Additional wait for animations/loading
      await page.waitForTimeout(waitMs);

      // Try to find .slide element
      const slideElement = page.locator('.slide');
      const hasSlide = await slideElement.count() > 0;

      if (hasSlide) {
        await slideElement.first().screenshot({
          path: outputPath
        });
        console.log(`   📸 Captured .slide element`);
      } else {
        await page.screenshot({
          path: outputPath,
          fullPage: false
        });
        console.log(`   📸 Captured full page (no .slide element found)`);
      }

      console.log(`   ✅ Saved: png/${outputName}`);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      failCount++;

      // Continue with next slide instead of stopping
      console.log(`   ⏭️  Continuing with next slide...`);

    } finally {
      await page.close();
    }
  }

  // Close browser
  await browser.close();

  // Summary
  console.log(`\n📊 Export Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed:  ${failCount}`);

  if (failCount > 0) {
    console.warn(`\n⚠️  Some slides failed to export. Check above for error details.`);
  }
}

/**
 * Run legacy export-all.js script
 */
async function runLegacyExport(projectDir, firstOnly) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  const env = {
    ...process.env,
    EXPORT_FIRST_ONLY: firstOnly ? '1' : '0'
  };

  try {
    const { stdout, stderr } = await execAsync('node export-all.js', {
      cwd: projectDir,
      env
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

  } catch (error) {
    console.error(`Legacy export failed: ${error.message}`);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

// Export functions for use by other modules
module.exports.exportProject = exportProject;