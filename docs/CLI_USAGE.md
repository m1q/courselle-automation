# Courselle CLI Usage Guide

This guide covers the new command-line interface (CLI) for Courselle Automation, which provides a unified way to manage and export HTML slide projects.

## Installation

The CLI is included in the project and requires Node.js and npm.

### Quick Installation
```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd courselle-automation

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Making the CLI Available

You can use the CLI in several ways:

1. **Using npx** (recommended for occasional use):
   ```bash
   npx courselle --help
   ```

2. **Global installation** (for frequent use):
   ```bash
   npm link
   courselle --help
   ```

3. **Direct execution**:
   ```bash
   node cli/src/index.js --help
   ```

## Available Commands

### `courselle prepare <name>`
Creates a new project from HTML files in your Windows Downloads folder.

**Options:**
- `--single`: Prepare a single-slide project (uses `preview.html` if available)
- `--empty`: Create an empty project structure without copying files

**Examples:**
```bash
# Create project from all HTML files in Downloads
npx courselle prepare my-project

# Create single-slide project
npx courselle prepare my-project --single

# Create empty project structure
npx courselle prepare my-project --empty
```

### `courselle export <name>`
Exports all slides of a specific project to PNG images.

**Options:**
- `--first`: Export only the first slide (useful for preview)
- `--legacy`: Use the legacy `export-all.js` script in the project folder

**Examples:**
```bash
# Export all slides of a project
npx courselle export my-project

# Export only the first slide
npx courselle export my-project --first

# Use legacy export script
npx courselle export my-project --legacy
```

### `courselle export-all`
Exports all existing projects sequentially.

**Options:**
- `--first`: Export only the first slide of each project
- `--legacy`: Use legacy export scripts for each project

**Example:**
```bash
# Export all projects (full export)
npx courselle export-all

# Export only first slide of each project
npx courselle export-all --first
```

### `courselle doctor`
Performs system health checks and validates project structure.

**Options:**
- `-v, --verbose`: Show detailed information

**Example:**
```bash
# Basic health check
npx courselle doctor

# Detailed check with verbose output
npx courselle doctor --verbose
```

### `courselle migrate [name]`
Migrates existing projects to the new structure (creates `courselle.json` manifest).

**Options:**
- `--all`: Migrate all projects
- `--force`: Overwrite existing `courselle.json` files
- `--dry-run`: Show what would be migrated without making changes

**Examples:**
```bash
# Migrate a specific project
npx courselle migrate my-project

# Migrate all projects
npx courselle migrate --all

# Dry run to see what would be migrated
npx courselle migrate --all --dry-run
```

## Project Structure

After migration or creation, each project has:

```
project-name/
├── courselle.json          # Project manifest (metadata & configuration)
├── export-all.js           # Legacy export script (for backward compatibility)
├── README.md               # Project information
├── html/                   # HTML slide files (slide1.html, slide2.html, ...)
└── png/                    # Output PNG images (generated)
```

### The Project Manifest (`courselle.json`)

The manifest file stores project metadata and configuration:

```json
{
  "name": "project-name",
  "version": "1.0.0",
  "createdAt": "2026-04-20T20:24:13.806Z",
  "updatedAt": "2026-04-20T20:24:13.807Z",
  "config": {
    "viewport": {
      "width": 1080,
      "height": 1350
    },
    "waitMs": 700,
    "exportFirstOnly": false
  },
  "slides": [
    {
      "filename": "slide1.html",
      "size": 5643
    }
  ],
  "exports": [
    {
      "timestamp": "2026-04-20T20:24:13.807Z",
      "slidesExported": "all",
      "firstOnly": false
    }
  ]
}
```

## Configuration

### Environment Variables

You can override default settings using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VIEWPORT_WIDTH` | Viewport width in pixels | `1080` |
| `VIEWPORT_HEIGHT` | Viewport height in pixels | `1350` |
| `WAIT_MS` | Milliseconds to wait before screenshot | `700` |
| `EXPORT_FIRST_ONLY` | Export only first slide (`1` or `0`) | `0` |
| `PROJECTS_ROOT` | Path to projects directory | `./projects` |
| `WIN_DOWNLOADS` | Windows Downloads path in WSL | `/mnt/c/Users/user/Downloads` |

**Example:**
```bash
# Set custom viewport dimensions
export VIEWPORT_WIDTH=1200
export VIEWPORT_HEIGHT=1500
export WAIT_MS=1000

# Then run export
npx courselle export my-project
```

### Project-Specific Configuration

Edit the `config` section in `courselle.json` to set project-specific options:

```json
{
  "config": {
    "viewport": {
      "width": 1200,
      "height": 1500
    },
    "waitMs": 1000,
    "exportFirstOnly": false
  }
}
```

## Common Workflows

### Creating and Exporting a New Project

1. **Prepare the project** from HTML files in Downloads:
   ```bash
   npx courselle prepare new-tutorial
   ```

2. **Export all slides**:
   ```bash
   npx courselle export new-tutorial
   ```

3. **Check the results** in `projects/new-tutorial/png/`

### Batch Exporting All Projects

```bash
# Export all projects (full)
npx courselle export-all

# Export only first slide of each project (preview mode)
npx courselle export-all --first
```

### Migrating Existing Projects

If you have projects created with the old system:

```bash
# See what would be migrated
npx courselle migrate --all --dry-run

# Actually migrate all projects
npx courselle migrate --all

# Verify migration with doctor
npx courselle doctor --verbose
```

## Troubleshooting

### Common Issues

1. **"Playwright browsers not installed"**
   ```bash
   npx playwright install chromium
   ```

2. **"Downloads directory not found"**
   Set the `WIN_DOWNLOADS` environment variable to your Windows Downloads path in WSL:
   ```bash
   export WIN_DOWNLOADS="/mnt/c/Users/YourUsername/Downloads"
   ```

3. **"No slide HTML files found"**
   Ensure your HTML files are named `slide1.html`, `slide2.html`, etc., or `preview.html` for single slides.

4. **"Project not found"**
   List available projects:
   ```bash
   npx courselle doctor --verbose
   ```

### Getting Help

- View all commands: `npx courselle --help`
- View command-specific help: `npx courselle <command> --help`
- Check system health: `npx courselle doctor --verbose`

## Backward Compatibility

The CLI maintains full backward compatibility:

- **Legacy scripts** (`scripts/projectctl.sh`, `scripts/export-all-projects.js`, etc.) continue to work
- **Project-level export scripts** (`export-all.js`) are preserved and updated during migration
- **Environment variables** used by legacy scripts are still supported

## Advanced Usage

### Scripting and Automation

The CLI can be used in scripts for automation:

```bash
#!/bin/bash
# Batch process multiple projects
for project in $(node -e "const pm=require('./cli/src/utils/project');console.log(new pm().listProjects().join('\n'))"); do
  echo "Processing $project..."
  npx courselle export "$project" --first
done
```

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Export Courselle Projects
on: [push]

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install chromium
      - run: npx courselle export-all
      - uses: actions/upload-artifact@v3
        with:
          name: exported-slides
          path: projects/*/png/
```

---

**Need more help?** Check the main [README](../README_EN.md) or open an issue on GitHub.