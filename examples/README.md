# Examples

This directory contains examples of how to use the Courselle CLI in various scenarios.

## Files

### `batch-export.js`
Programmatic batch export using the CLI's underlying modules directly from Node.js.

**Usage:**
```bash
node examples/batch-export.js
node examples/batch-export.js --first
node examples/batch-export.js --force  # Don't skip existing PNGs
```

### `cron-job.sh`
Shell script for scheduling automated exports with cron.

**Usage:**
1. Make executable: `chmod +x examples/cron-job.sh`
2. Edit to customize projects and settings
3. Schedule with cron: `0 2 * * * /path/to/courselle-automation/examples/cron-job.sh`

### Integration Ideas

1. **Git hooks**: Automatically export slides when HTML files change
2. **CI/CD pipelines**: Export and upload slides as artifacts
3. **Monitoring scripts**: Check export health and send notifications
4. **Custom workflows**: Combine with other tools (image optimization, upload to CMS, etc.)

## Programmatic Usage

You can import and use the CLI modules directly in your Node.js code:

```javascript
const { exportProject } = require('../cli/src/commands/export');
const ProjectManager = require('../cli/src/utils/project');

// Export a specific project
const projectDir = '/path/to/project';
const manifest = { config: { viewport: { width: 1200, height: 1500 } } };
await exportProject(projectDir, manifest, false);
```

See `batch-export.js` for a complete example.