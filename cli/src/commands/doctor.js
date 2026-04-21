const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ProjectManager = require('../utils/project');

/**
 * Doctor command - System health check
 */
module.exports = function doctorCommand(program) {
  const projectManager = new ProjectManager();

  program
    .command('doctor')
    .description('Check system and project health')
    .option('-v, --verbose', 'Show detailed information')
    .action((options) => {
      try {
        console.log('🩺 Running system health check...\n');

        const checks = [
          checkNodeInstallation,
          checkNpmInstallation,
          checkPlaywrightInstallation,
          checkProjectsDirectory,
          checkDownloadsDirectory,
          checkEnvironmentVariables,
          checkExistingProjects
        ];

        const results = checks.map(check => check(projectManager, options.verbose));

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 HEALTH CHECK SUMMARY');
        console.log('='.repeat(50));

        const passed = results.filter(r => r.status === '✅').length;
        const warnings = results.filter(r => r.status === '⚠️').length;
        const failed = results.filter(r => r.status === '❌').length;

        console.log(`✅ Passed:  ${passed}`);
        console.log(`⚠️  Warnings: ${warnings}`);
        console.log(`❌ Failed:  ${failed}`);

        if (failed > 0) {
          console.log('\n❌ Critical issues found:');
          results
            .filter(r => r.status === '❌')
            .forEach(r => {
              console.log(`   ${r.message}`);
              if (r.details) console.log(`      ${r.details}`);
            });
        }

        if (warnings > 0) {
          console.log('\n⚠️  Warnings:');
          results
            .filter(r => r.status === '⚠️')
            .forEach(r => {
              console.log(`   ${r.message}`);
              if (r.details) console.log(`      ${r.details}`);
            });
        }

        if (failed === 0) {
          console.log('\n🎉 System is healthy! Ready to export slides.');
        } else {
          console.log('\n🔧 Please fix the issues above before exporting.');
          process.exit(1);
        }

      } catch (error) {
        console.error(`❌ Error during health check: ${error.message}`);
        process.exit(1);
      }
    });
};

/**
 * Check Node.js installation
 */
function checkNodeInstallation(projectManager, verbose) {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    return {
      status: '✅',
      message: `Node.js: ${version}`,
      details: verbose ? `Path: ${process.execPath}` : undefined
    };
  } catch {
    return {
      status: '❌',
      message: 'Node.js not installed',
      details: 'Install Node.js from https://nodejs.org/'
    };
  }
}

/**
 * Check npm installation
 */
function checkNpmInstallation(projectManager, verbose) {
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    return {
      status: '✅',
      message: `npm: ${version}`,
      details: verbose ? `Global npm prefix: ${execSync('npm prefix -g', { encoding: 'utf8' }).trim()}` : undefined
    };
  } catch {
    return {
      status: '⚠️',
      message: 'npm not found (but not required for all operations)',
      details: 'Install npm or use --legacy flag for exports'
    };
  }
}

/**
 * Check Playwright installation
 */
function checkPlaywrightInstallation(projectManager, verbose) {
  const repoRoot = path.join(__dirname, '../../..');
  const playwrightPath = path.join(repoRoot, 'node_modules', 'playwright');

  if (fs.existsSync(playwrightPath)) {
    try {
      const packageJson = require(path.join(playwrightPath, 'package.json'));
      return {
        status: '✅',
        message: `Playwright: ${packageJson.version}`,
        details: verbose ? `Path: ${playwrightPath}` : undefined
      };
    } catch {
      // Continue to browser check
    }
  }

  // Check if browser is installed
  const cachePath = path.join(process.env.HOME || process.env.USERPROFILE, '.cache', 'ms-playwright');
  if (fs.existsSync(cachePath)) {
    return {
      status: '⚠️',
      message: 'Playwright browsers installed, but package not in repo root',
      details: 'Run: npm install -D playwright'
    };
  }

  return {
    status: '❌',
    message: 'Playwright not installed',
    details: 'Run: npm install -D playwright && npx playwright install chromium'
  };
}

/**
 * Check projects directory
 */
function checkProjectsDirectory(projectManager, verbose) {
  if (fs.existsSync(projectManager.projectsRoot)) {
    const projects = projectManager.listProjects();
    return {
      status: '✅',
      message: `Projects directory: ${projectManager.projectsRoot}`,
      details: verbose ? `Contains ${projects.length} project(s)` : undefined
    };
  }

  return {
    status: '⚠️',
    message: `Projects directory not found: ${projectManager.projectsRoot}`,
    details: 'Will be created automatically when needed'
  };
}

/**
 * Check downloads directory
 */
function checkDownloadsDirectory(projectManager, verbose) {
  if (fs.existsSync(projectManager.winDownloads)) {
    const files = fs.readdirSync(projectManager.winDownloads);
    const htmlFiles = files.filter(f => f.toLowerCase().endsWith('.html')).length;

    return {
      status: '✅',
      message: `Downloads directory: ${projectManager.winDownloads}`,
      details: verbose ? `Contains ${htmlFiles} HTML file(s) out of ${files.length} total` : undefined
    };
  }

  return {
    status: '⚠️',
    message: `Downloads directory not found: ${projectManager.winDownloads}`,
    details: 'Set WIN_DOWNLOADS environment variable to your Windows Downloads path in WSL'
  };
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(projectManager, verbose) {
  const envVars = [
    { name: 'VIEWPORT_WIDTH', default: '1080', value: process.env.VIEWPORT_WIDTH },
    { name: 'VIEWPORT_HEIGHT', default: '1350', value: process.env.VIEWPORT_HEIGHT },
    { name: 'WAIT_MS', default: '700', value: process.env.WAIT_MS },
    { name: 'EXPORT_FIRST_ONLY', default: '0', value: process.env.EXPORT_FIRST_ONLY },
    { name: 'PROJECTS_ROOT', default: projectManager.projectsRoot, value: process.env.PROJECTS_ROOT },
    { name: 'WIN_DOWNLOADS', default: projectManager.winDownloads, value: process.env.WIN_DOWNLOADS }
  ];

  const usingDefaults = envVars.filter(v => !v.value || v.value === v.default);
  const customValues = envVars.filter(v => v.value && v.value !== v.default);

  if (customValues.length === 0) {
    return {
      status: '✅',
      message: 'Environment variables: Using defaults',
      details: verbose ? envVars.map(v => `${v.name}=${v.value || v.default}`).join('\n      ') : undefined
    };
  }

  return {
    status: '⚠️',
    message: `Environment variables: ${customValues.length} custom value(s)`,
    details: verbose ? [
      ...customValues.map(v => `${v.name}=${v.value} (default: ${v.default})`),
      ...usingDefaults.map(v => `${v.name}=${v.default} (default)`)
    ].join('\n      ') : `Custom: ${customValues.map(v => v.name).join(', ')}`
  };
}

/**
 * Check existing projects
 */
function checkExistingProjects(projectManager, verbose) {
  const projects = projectManager.listProjects();

  if (projects.length === 0) {
    return {
      status: '⚠️',
      message: 'No projects found',
      details: 'Use: courselle prepare <name> to create your first project'
    };
  }

  const projectDetails = [];

  for (const projectName of projects.slice(0, verbose ? 10 : 3)) {
    const projectDir = path.join(projectManager.projectsRoot, projectName);
    const htmlDir = path.join(projectDir, 'html');
    const pngDir = path.join(projectDir, 'png');

    let htmlCount = 0;
    let pngCount = 0;

    if (fs.existsSync(htmlDir)) {
      htmlCount = fs.readdirSync(htmlDir)
        .filter(f => /^slide\d+\.html$/i.test(f))
        .length;
    }

    if (fs.existsSync(pngDir)) {
      pngCount = fs.readdirSync(pngDir)
        .filter(f => f.toLowerCase().endsWith('.png'))
        .length;
    }

    const manifest = projectManager.loadProjectManifest(projectDir);
    const hasManifest = !!manifest;

    projectDetails.push({
      name: projectName,
      html: htmlCount,
      png: pngCount,
      manifest: hasManifest
    });
  }

  const withHtml = projectDetails.filter(p => p.html > 0).length;
  const withPng = projectDetails.filter(p => p.png > 0).length;
  const withManifest = projectDetails.filter(p => p.manifest).length;

  let message = `Found ${projects.length} project(s)`;
  if (withHtml > 0) message += `, ${withHtml} with slides`;
  if (withPng > 0) message += `, ${withPng} with exports`;

  return {
    status: '✅',
    message,
    details: verbose ? projectDetails.map(p =>
      `${p.name}: ${p.html} slides, ${p.png} PNGs, manifest: ${p.manifest ? '✅' : '❌'}`
    ).join('\n      ') : undefined
  };
}