const fs = require('fs');
const path = require('path');
const ProjectManager = require('../utils/project');

/**
 * Export-all command - Export all existing projects
 */
module.exports = function exportAllCommand(program) {
  const projectManager = new ProjectManager();

  program
    .command('export-all')
    .description('Export all existing projects sequentially')
    .option('-f, --first', 'Export only first slide of each project')
    .option('-l, --legacy', 'Use legacy export scripts')
    .action(async (options) => {
      try {
        console.log('🚀 Starting batch export of all projects');

        // Get list of projects
        const projects = projectManager.listProjects();

        if (projects.length === 0) {
          console.error('❌ No projects found');
          console.error(`Projects directory: ${projectManager.projectsRoot}`);
          process.exit(1);
        }

        console.log(`📁 Found ${projects.length} project(s): ${projects.join(', ')}`);
        console.log('='.repeat(50));

        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFail = 0;
        const results = [];

        for (const [index, projectName] of projects.entries()) {
          const projectDir = path.join(projectManager.projectsRoot, projectName);
          const htmlDir = path.join(projectDir, 'html');

          // Skip projects without html directory
          if (!fs.existsSync(htmlDir)) {
            console.log(`\n⚠️  Skipping ${projectName} (no html folder)`);
            results.push({ project: projectName, status: 'skipped', reason: 'No html folder' });
            continue;
          }

          // Check if there are HTML files
          const htmlFiles = fs.readdirSync(htmlDir)
            .filter(file => /^slide\d+\.html$/i.test(file));

          if (htmlFiles.length === 0) {
            console.log(`\n⚠️  Skipping ${projectName} (no slide files)`);
            results.push({ project: projectName, status: 'skipped', reason: 'No slide files' });
            continue;
          }

          totalProcessed++;

          console.log(`\n${'='.repeat(50)}`);
          console.log(`🚀 [${index + 1}/${projects.length}] Exporting: ${projectName}`);
          console.log(`   📄 Slides: ${htmlFiles.length} file(s)`);
          console.log(`${'='.repeat(50)}`);

          try {
            // Import export function dynamically to avoid circular dependency
            const exportProject = require('./export').exportProject;

            // Get project manifest
            const manifest = projectManager.loadProjectManifest(projectDir);

            // Export project
            await exportProject(projectDir, manifest, options.first);

            // Update manifest with export record
            if (manifest) {
              const exportRecord = {
                timestamp: new Date().toISOString(),
                slidesExported: options.first ? 1 : 'all',
                firstOnly: options.first || false,
                batchExport: true
              };

              projectManager.updateProjectManifest(projectDir, {
                exports: [...(manifest.exports || []), exportRecord]
              });
            }

            console.log(`✅ Successfully exported: ${projectName}`);
            results.push({ project: projectName, status: 'success' });
            totalSuccess++;

          } catch (error) {
            console.error(`❌ Failed to export ${projectName}: ${error.message}`);
            results.push({ project: projectName, status: 'failed', error: error.message });
            totalFail++;
          }

          // Small delay between projects
          if (index < projects.length - 1) {
            console.log('\n⏳ Waiting 2 seconds before next project...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 BATCH EXPORT COMPLETE');
        console.log('='.repeat(50));
        console.log(`Projects processed: ${totalProcessed}`);
        console.log(`✅ Successful:      ${totalSuccess}`);
        console.log(`❌ Failed:          ${totalFail}`);
        console.log(`⏭️  Skipped:         ${projects.length - totalProcessed}`);

        if (totalFail > 0) {
          console.log('\n❌ Failed projects:');
          results
            .filter(r => r.status === 'failed')
            .forEach(r => {
              console.log(`   - ${r.project}: ${r.error}`);
            });
        }

        if (results.some(r => r.status === 'skipped')) {
          console.log('\n⚠️  Skipped projects:');
          results
            .filter(r => r.status === 'skipped')
            .forEach(r => {
              console.log(`   - ${r.project}: ${r.reason}`);
            });
        }

        console.log('\n🎉 Batch export finished!');

      } catch (error) {
        console.error(`❌ Error during batch export: ${error.message}`);
        process.exit(1);
      }
    });
};

