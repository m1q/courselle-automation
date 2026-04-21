# Courselle Content Automation

Automation project for creating and exporting visual content for Courselle from HTML slides to PNG images.

## 📋 Features

- Export HTML slides to high-quality PNG images
- Multi-project support (7-hapit, Framex, ads, anythings)
- Playwright integration for browser automation
- Unified scripts for batch exporting
- Organized and maintainable structure

## 🏗️ Project Structure

```
courselle-automation/
├── cli/                  # New CLI tool source code
│   ├── src/
│   │   ├── index.js      # CLI entry point
│   │   ├── utils/        # Utility classes
│   │   └── commands/     # Command implementations
├── src/                  # Core source code (legacy)
│   ├── export.js         # Basic export script
│   └── slide1.html       # HTML slide template
├── projects/             # Sub-projects
│   ├── 7-hapit/         # 7 Habits project
│   ├── Framex/          # Framex project
│   ├── ads/             # Ads project
│   └── anythings/       # Miscellaneous project
├── scripts/             # Helper scripts (legacy)
│   ├── export-all-projects.js  # Export all projects
│   └── *.sh             # Shell scripts
├── docs/                # Documentation
├── output/              # Outputs (will be created)
├── package.json         # Project settings
└── README.md           # This file (Arabic)
```

## 🆕 New CLI Tool

A new command-line interface (CLI) is now available, providing a unified way to manage and export projects. The CLI includes these commands:

| Command | Description |
|---------|-------------|
| `courselle prepare <name>` | Create a new project from HTML files in Downloads folder |
| `courselle export <name>` | Export all slides of a specific project |
| `courselle export-all` | Export all existing projects sequentially |
| `courselle doctor` | Check system and project health |
| `courselle migrate [name]` | Migrate existing projects to new structure |

### Installation & Usage

After installing dependencies (`npm install`), you can use the CLI in several ways:

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

### Backward Compatibility

The old shell scripts (`projectctl.sh`, `export-all-projects.js`, etc.) continue to work, but the new CLI is the recommended way to interact with the system. Existing projects can be migrated using `courselle migrate --all`.

## 🚀 Quick Start

### Prerequisites
- Node.js 14 or higher
- npm or yarn

### Installation

```bash
# Clone the project
git clone <repository-url>
cd courselle-automation

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Usage

#### Using the new CLI (recommended)

1. **Create a new project** from HTML files in your Downloads folder:
   ```bash
   npx courselle prepare my-project
   ```

2. **Export all slides of a project**:
   ```bash
   npx courselle export my-project
   ```

3. **Export only the first slide** (for preview):
   ```bash
   npx courselle export my-project --first
   ```

4. **Export all existing projects**:
   ```bash
   npx courselle export-all
   ```

5. **Check system health**:
   ```bash
   npx courselle doctor --verbose
   ```

6. **Migrate existing projects** to the new structure:
   ```bash
   npx courselle migrate --all
   ```

#### Legacy methods (still supported)

- **Export single slide**: `npm run export`
- **Export all projects**: `node scripts/export-all-projects.js`
- **Export specific project**: `cd projects/7-hapit && node export-all.js`

The legacy shell scripts (`scripts/projectctl.sh`, `scripts/export_project.sh`, etc.) also remain functional for backward compatibility.

## 📁 Sub-projects

Each sub-project contains:

- `export-all.js`: Project export script
- `html/`: Folder containing HTML slides
- `png/`: Output folder (will be created)
- `package.json`: Project dependencies

## 🛠️ Development

### Adding a new project

**Using the CLI (recommended):**
```bash
npx courselle prepare project-name
```
This creates a new project with the proper structure, manifest, and export script.

**Manual method:**
1. Create new folder in `projects/`
2. Copy existing project structure
3. Add HTML slides in `html/` folder
4. Update `export-all.js` if needed

### Customizing export settings

Export settings can be configured in several ways:

1. **Project manifest** (`courselle.json`): Each project has a manifest file where you can set viewport dimensions, wait time, and other options.

2. **Environment variables** (override defaults):
   ```bash
   export VIEWPORT_WIDTH=1200
   export VIEWPORT_HEIGHT=1500
   export WAIT_MS=1000
   export EXPORT_FIRST_ONLY=1
   ```

3. **Legacy export script** (`export-all.js`): You can still modify the generated export script directly, though using the manifest is preferred.

Default dimensions: `width: 1080, height: 1350`, wait time: `700ms`.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📞 Contact

Mohammed Halim Rahim Karim - [@mohammedgist](https://github.com/mohammedgist)

Project Link: [https://github.com/mohammedgist/courselle-automation](https://github.com/mohammedgist/courselle-automation)