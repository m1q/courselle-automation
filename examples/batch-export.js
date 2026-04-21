#!/usr/bin/env node

/**
 * Example: Batch export using the Courselle CLI programmatically
 *
 * This script demonstrates how to use the CLI's underlying modules
 * directly in your own Node.js scripts.
 */

const { exportProject } = require('./cli/src/commands/export');
const ProjectManager = require('./cli/src/utils/project');
const fs = require('fs');
const path = require('path');

async function batchExport(options = {}) {
  const {
    firstOnly = false,
    skipExisting = true,
    parallel = false,
    delayBetweenProjects = 2000
  } = options;

  const projectManager = new ProjectManager();
  const projects = projectManager.listProjects();

  console.log(`🚀 Starting batch export of ${projects.length} project(s)`);
  console.log(`Options: firstOnly=${firstOnly}, skipExisting=${skipExisting}`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const [index, projectName] of projects.entries()) {
    const projectDir = path.join(projectManager.projectsRoot, projectName);
    const htmlDir = path.join(projectDir, 'html');
    const pngDir = path.join(projectDir, 'png');

    // Skip projects without HTML directory
    if (!fs.existsSync(htmlDir)) {
      console.log(`⚠️  Skipping ${projectName} (no html folder)`);
      skipCount++;
      continue;
    }

    // Check for HTML files
    const htmlFiles = fs.readdirSync(htmlDir)
      .filter(file => /^slide\d+\.html$/i.test(file));

    if (htmlFiles.length === 0) {
      console.log(`⚠️  Skipping ${projectName} (no slide files)`);
      skipCount++;
      continue;
    }

    // Skip if PNGs already exist (optional)
    if (skipExisting && fs.existsSync(pngDir)) {
      const pngFiles = fs.readdirSync(pngDir)
        .filter(file => file.toLowerCase().endsWith('.png'));

      const expectedCount = firstOnly ? 1 : htmlFiles.length;

      if (pngFiles.length >= expectedCount) {
        console.log(`⏭️  Skipping ${projectName} (${pngFiles.length} PNGs already exist)`);
        skipCount++;
        continue;
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 [${index + 1}/${projects.length}] Exporting: ${projectName}`);
    console.log(`   📄 Slides: ${htmlFiles.length} file(s)`);
    console.log(`${'='.repeat(50)}`);

    try {
      // Load project manifest
      const manifest = projectManager.loadProjectManifest(projectDir);

      // Export using the same function the CLI uses
      await exportProject(projectDir, manifest, firstOnly);

      console.log(`✅ Successfully exported: ${projectName}`);
      successCount++;

      // Update manifest with export record
      if (manifest) {
        const exportRecord = {
          timestamp: new Date().toISOString(),
          slidesExported: firstOnly ? 1 : 'all',
          firstOnly,
          batchExport: true
        };

        projectManager.updateProjectManifest(projectDir, {
          exports: [...(manifest.exports || []), exportRecord]
        });
      }

    } catch (error) {
      console.error(`❌ Failed to export ${projectName}: ${error.message}`);
      failCount++;
    }

    // Delay between projects (except the last one)
    if (index < projects.length - 1 && delayBetweenProjects > 0) {
      console.log(`\n⏳ Waiting ${delayBetweenProjects}ms before next project...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenProjects));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 BATCH EXPORT COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total projects: ${projects.length}`);
  console.log(`✅ Successful:  ${successCount}`);
  console.log(`⏭️  Skipped:     ${skipCount}`);
  console.log(`❌ Failed:      ${failCount}`);

  return { successCount, skipCount, failCount };
}

// Command-line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const firstOnly = args.includes('--first');
  const skipExisting = !args.includes('--force');

  batchExport({
    firstOnly,
    skipExisting,
    delayBetweenProjects: 2000
  }).then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Batch export failed:', error);
    process.exit(1);
  });
}

module.exports = { batchExport };