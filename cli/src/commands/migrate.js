const fs = require('fs');
const path = require('path');
const ProjectManager = require('../utils/project');

/**
 * Migrate command - Convert existing projects to new structure
 */
module.exports = function migrateCommand(program) {
  const projectManager = new ProjectManager();

  program
    .command('migrate [name]')
    .description('Migrate existing projects to new structure')
    .option('-a, --all', 'Migrate all projects')
    .option('-f, --force', 'Overwrite existing courselle.json files')
    .option('-d, --dry-run', 'Show what would be migrated without making changes')
    .action(async (name, options) => {
      try {
        console.log('🔄 Starting migration to new coursella structure\n');

        const projectsToMigrate = [];

        if (options.all) {
          // Migrate all projects
          const allProjects = projectManager.listProjects();
          if (allProjects.length === 0) {
            console.error('❌ No projects found to migrate');
            process.exit(1);
          }
          projectsToMigrate.push(...allProjects.map(p => ({ name: p })));
        } else if (name) {
          // Migrate specific project
          const projectDir = projectManager.getProjectDir(name);
          if (!fs.existsSync(projectDir)) {
            console.error(`❌ Project not found: ${name}`);
            process.exit(1);
          }
          projectsToMigrate.push({ name, dir: projectDir });
        } else {
          // Interactive mode
          console.log('Please specify a project name or use --all');
          console.log('Examples:');
          console.log('  $ courselle migrate framex');
          console.log('  $ courselle migrate --all');
          process.exit(1);
        }

        // Process each project
        let migratedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const project of projectsToMigrate) {
          const projectDir = project.dir || projectManager.getProjectDir(project.name);
          const htmlDir = path.join(projectDir, 'html');

          console.log(`\n${'='.repeat(50)}`);
          console.log(`Processing: ${project.name}`);
          console.log(`Directory: ${projectDir}`);
          console.log(`${'='.repeat(50)}`);

          // Check if project has HTML directory
          if (!fs.existsSync(htmlDir)) {
            console.log('⚠️  Skipping: No html directory');
            skippedCount++;
            continue;
          }

          // Check for existing manifest
          const manifestPath = path.join(projectDir, 'courselle.json');
          const hasManifest = fs.existsSync(manifestPath);

          if (hasManifest && !options.force && !options.dryRun) {
            console.log('⚠️  Skipping: Already migrated (use --force to overwrite)');
            skippedCount++;
            continue;
          }

          // Gather project information
          const htmlFiles = fs.readdirSync(htmlDir)
            .filter(file => /^slide\d+\.html$/i.test(file))
            .sort((a, b) => {
              const numA = parseInt(a.match(/^slide(\d+)\.html$/i)[1], 10);
              const numB = parseInt(b.match(/^slide(\d+)\.html$/i)[1], 10);
              return numA - numB;
            });

          const pngDir = path.join(projectDir, 'png');
          const hasPngDir = fs.existsSync(pngDir);
          const pngFiles = hasPngDir ?
            fs.readdirSync(pngDir).filter(f => f.toLowerCase().endsWith('.png')).length : 0;

          // Check for legacy export script
          const legacyScript = path.join(projectDir, 'export-all.js');
          const hasLegacyScript = fs.existsSync(legacyScript);

          // Create manifest data
          const manifest = {
            name: project.name,
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            migratedAt: new Date().toISOString(),
            migratedFrom: 'legacy',
            config: {
              viewport: {
                width: projectManager.viewportWidth,
                height: projectManager.viewportHeight
              },
              waitMs: projectManager.waitMs,
              exportFirstOnly: false
            },
            slides: htmlFiles.map(file => ({
              filename: file,
              size: fs.statSync(path.join(htmlDir, file)).size,
              migratedAt: new Date().toISOString()
            })),
            stats: {
              htmlFiles: htmlFiles.length,
              pngFiles: pngFiles,
              lastExported: null
            },
            legacy: {
              hasExportScript: hasLegacyScript,
              exportScriptModified: hasLegacyScript ?
                fs.statSync(legacyScript).mtime.toISOString() : null
            }
          };

          // Try to find existing package.json
          const packageJsonPath = path.join(projectDir, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              manifest.package = {
                name: pkg.name,
                version: pkg.version,
                hasPlaywright: !!(pkg.dependencies?.playwright || pkg.devDependencies?.playwright)
              };
            } catch (error) {
              console.log(`⚠️  Could not read package.json: ${error.message}`);
            }
          }

          if (options.dryRun) {
            console.log('📋 Dry run - would create:');
            console.log(`   📄 courselle.json with ${htmlFiles.length} slide(s)`);
            console.log(`   📊 Stats: ${htmlFiles.length} HTML, ${pngFiles} PNG`);
            console.log(`   🔧 Legacy: ${hasLegacyScript ? 'export-all.js present' : 'no export script'}`);
            migratedCount++;
            continue;
          }

          try {
            // Create manifest file
            fs.writeFileSync(
              manifestPath,
              JSON.stringify(manifest, null, 2)
            );
            console.log(`📝 Created: courselle.json`);

            // Update or create legacy export script for backward compatibility
            if (!hasLegacyScript || options.force) {
              createLegacyExportScript(projectDir, projectManager);
            }

            // Create README.md with migration info
            const readmePath = path.join(projectDir, 'README.md');
            if (!fs.existsSync(readmePath)) {
              const readmeContent = `# ${project.name}

This project has been migrated to the new coursella CLI.

## Project Information
- **Slides**: ${htmlFiles.length} HTML file(s)
- **Exports**: ${pngFiles} PNG file(s)
- **Migrated**: ${new Date().toLocaleDateString()}

## Using the New CLI

\`\`\`bash
# Export all slides
coursella export ${project.name}

# Export only first slide
coursella export ${project.name} --first

# View project info
coursella doctor
\`\`\`

## Legacy Support
The old \`export-all.js\` script is still available for backward compatibility.

For more information, see the main documentation.
`;
              fs.writeFileSync(readmePath, readmeContent);
              console.log(`📘 Created: README.md`);
            }

            console.log(`✅ Successfully migrated: ${project.name}`);
            migratedCount++;

          } catch (error) {
            console.error(`❌ Failed to migrate ${project.name}: ${error.message}`);
            failedCount++;
          }
        }

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Migrated:  ${migratedCount}`);
        console.log(`⏭️  Skipped:   ${skippedCount}`);
        console.log(`❌ Failed:    ${failedCount}`);

        if (options.dryRun) {
          console.log('\n💡 This was a dry run. Use without --dry-run to actually migrate.');
        } else if (migratedCount > 0) {
          console.log('\n🎉 Migration complete!');
          console.log('\n📋 Next steps:');
          console.log('  1. Test the new CLI: courselle doctor');
          console.log('  2. Export a project: courselle export <name>');
          console.log('  3. View help: courselle --help');
        }

        if (failedCount > 0) {
          process.exit(1);
        }

      } catch (error) {
        console.error(`❌ Migration error: ${error.message}`);
        process.exit(1);
      }
    });
};

/**
 * Create legacy export script for backward compatibility
 */
function createLegacyExportScript(projectDir, projectManager) {
  const scriptPath = path.join(projectDir, 'export-all.js');

  const scriptContent = `const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH || '${projectManager.viewportWidth}', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT || '${projectManager.viewportHeight}', 10);
const WAIT_MS = parseInt(process.env.WAIT_MS || '${projectManager.waitMs}', 10);
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
  console.log(`📜 Created/updated: export-all.js (legacy compatibility)`);
}