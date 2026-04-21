#!/usr/bin/env node

const { program } = require('commander');
const { version } = require('../../package.json');

// Import commands
const prepareCommand = require('./commands/prepare');
const exportCommand = require('./commands/export');
const exportAllCommand = require('./commands/export-all');
const doctorCommand = require('./commands/doctor');
const migrateCommand = require('./commands/migrate');

program
  .name('courselle')
  .description('Courselle Automation CLI - Export HTML slides to PNG images')
  .version(version);

// Register commands
prepareCommand(program);
exportCommand(program);
exportAllCommand(program);
doctorCommand(program);
migrateCommand(program);

// Add help for backward compatibility
program.addHelpText('after', `
Legacy Commands Compatibility:
  For backward compatibility with projectctl.sh:
  $ courselle prepare <project> [--single] [--empty]    # Create new project
  $ courselle export <project> [--first]                # Export project
  $ courselle export-all                               # Export all projects
  $ courselle doctor                                   # System health check

Environment Variables:
  VIEWPORT_WIDTH    Viewport width (default: 1080)
  VIEWPORT_HEIGHT   Viewport height (default: 1350)
  WAIT_MS           Wait before screenshot (default: 700)
  EXPORT_FIRST_ONLY Export only first slide when set to "1"
  PROJECTS_ROOT     Projects directory path
  WIN_DOWNLOADS     Windows Downloads path in WSL

Examples:
  $ courselle prepare framex
  $ courselle prepare poster1 --single
  $ courselle prepare draft-post --empty
  $ courselle export framex
  $ courselle export poster1 --first
`);

program.parse(process.argv);