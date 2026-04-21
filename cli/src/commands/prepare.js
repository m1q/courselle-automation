const fs = require('fs');
const path = require('path');
const ProjectManager = require('../utils/project');

/**
 * Prepare command - Create new project from HTML files
 */
module.exports = function prepareCommand(program) {
  const projectManager = new ProjectManager();

  program
    .command('prepare <name>')
    .description('Create a new project from HTML files in Windows Downloads')
    .option('-s, --single', 'Prepare single-slide project (first valid file)')
    .option('-e, --empty', 'Create empty project structure only')
    .action(async (name, options) => {
      try {
        console.log(`🚀 Preparing project: ${name}`);

        // Validate options
        if (options.single && options.empty) {
          console.error('❌ Error: Cannot use both --single and --empty');
          process.exit(1);
        }

        // Create unique project directory
        const projectDir = projectManager.createUniqueProjectDir(name);
        console.log(`📁 Project directory: ${projectDir}`);

        // Create project structure
        const { htmlDir, pngDir } = projectManager.createProjectStructure(projectDir);
        console.log(`📂 Created: html/, png/`);

        // Create project manifest
        const manifest = projectManager.createProjectManifest(projectDir);
        console.log(`📝 Created project manifest: courselle.json`);

        if (options.empty) {
          console.log('\n✅ Empty project created successfully');
          console.log(`Project: ${projectDir}`);
          console.log(`HTML   : ${htmlDir}`);
          console.log(`PNG    : ${pngDir}`);
          return;
        }

        // Get HTML files from downloads
        const htmlFiles = projectManager.getHtmlFilesFromDownloads();

        if (htmlFiles.length === 0) {
          console.error(`❌ No HTML files found in ${projectManager.winDownloads}`);
          console.error('Expected files like: preview.html, preview (1).html, slide1.html');
          console.error('Use --empty to create project without files');
          process.exit(1);
        }

        console.log(`📄 Found ${htmlFiles.length} HTML file(s)`);

        if (options.single) {
          // Single mode: use first valid file
          const sortedFiles = htmlFiles.sort((a, b) => {
            const numA = projectManager.getSlideNumber(a);
            const numB = projectManager.getSlideNumber(b);
            return numA - numB;
          });

          const firstFile = sortedFiles[0];
          const slideNum = projectManager.getSlideNumber(firstFile);
          const destFile = path.join(htmlDir, `slide${slideNum}.html`);

          fs.renameSync(firstFile, destFile);
          console.log(`📦 Moved: ${path.basename(firstFile)} -> html/slide${slideNum}.html`);

          // Update manifest with single slide
          projectManager.updateProjectManifest(projectDir, {
            slides: [{
              filename: `slide${slideNum}.html`,
              source: path.basename(firstFile),
              importedAt: new Date().toISOString()
            }]
          });
        } else {
          // Normal mode: process all valid files
          const slides = [];
          let movedCount = 0;

          for (const file of htmlFiles) {
            const slideNum = projectManager.getSlideNumber(file);

            if (slideNum === 9999) {
              console.log(`⚠️  Skipping invalid file: ${path.basename(file)}`);
              continue;
            }

            const destFile = path.join(htmlDir, `slide${slideNum}.html`);
            fs.renameSync(file, destFile);
            console.log(`📦 Moved: ${path.basename(file)} -> html/slide${slideNum}.html`);

            slides.push({
              filename: `slide${slideNum}.html`,
              source: path.basename(file),
              importedAt: new Date().toISOString()
            });

            movedCount++;
          }

          if (movedCount === 0) {
            console.error('❌ No valid HTML files could be processed');
            console.error('Valid formats: preview.html, preview (N).html, slideN.html');
            process.exit(1);
          }

          // Update manifest with all slides
          projectManager.updateProjectManifest(projectDir, {
            slides
          });
        }

        // Create export script for backward compatibility
        createLegacyExportScript(projectDir, projectManager);

        console.log('\n✅ Project created successfully');
        console.log(`Project: ${projectDir}`);
        console.log(`HTML   : ${htmlDir}`);
        console.log(`PNG    : ${pngDir}`);
        console.log(`Slides : ${fs.readdirSync(htmlDir).length} file(s)`);
        console.log('\n📋 Next steps:');
        console.log(`  $ courselle export ${path.basename(projectDir)}`);

      } catch (error) {
        console.error(`❌ Error preparing project: ${error.message}`);
        if (error.code === 'ENOENT' && error.path.includes('Downloads')) {
          console.error(`Make sure WIN_DOWNLOADS is set correctly: ${projectManager.winDownloads}`);
        }
        process.exit(1);
      }
    });
};

/**
 * Create legacy export-all.js for backward compatibility
 */
function createLegacyExportScript(projectDir, projectManager) {
  const scriptPath = path.join(projectDir, 'export-all.js');
  const manifest = projectManager.loadProjectManifest(projectDir);

  const scriptContent = `const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH || '${manifest.config.viewport.width}', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT || '${manifest.config.viewport.height}', 10);
const WAIT_MS = parseInt(process.env.WAIT_MS || '${manifest.config.waitMs}', 10);
const EXPORT_FIRST_ONLY = process.env.EXPORT_FIRST_ONLY === '1';

function getSlideNumber(filename) {
  const match = filename.match(/^slide(\\d+)\\.html\$/i);
  return match ? parseInt(match[1], 10) : 9999;
}

(async () => {
  const projectDir = __dirname;
  const htmlDir = path.join(projectDir, 'html');
  const pngDir = path.join(projectDir, 'png');

  if (!fs.existsSync(htmlDir)) {
    console.error('HTML folder not found:', htmlDir);
    process.exit(1);
  }

  fs.mkdirSync(pngDir, { recursive: true });

  let htmlFiles = fs
    .readdirSync(htmlDir)
    .filter(file => /^slide\\d+\\.html\$/i.test(file))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  if (htmlFiles.length === 0) {
    console.error('No slide HTML files found in html folder.');
    process.exit(1);
  }

  if (EXPORT_FIRST_ONLY) {
    htmlFiles = [htmlFiles[0]];
  }

  const browser = await chromium.launch({ headless: true });

  for (const file of htmlFiles) {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
    });

    try {
      const filePath = 'file://' + path.join(htmlDir, file);
      const outputName = file.replace(/\\.html\$/i, '.png');

      await page.goto(filePath, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'screen' });

      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      await page.waitForTimeout(WAIT_MS);

      const slide = page.locator('.slide');

      if (await slide.count()) {
        await slide.first().screenshot({
          path: path.join(pngDir, outputName)
        });
      } else {
        await page.screenshot({
          path: path.join(pngDir, outputName),
          fullPage: false
        });
      }

      console.log(\`✅ Exported: \${file} -> png/\${outputName}\`);
    } catch (error) {
      console.error(\`❌ Failed: \${file}\`);
      console.error(error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('🎉 Done.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(`📜 Created legacy export script: export-all.js`);
}