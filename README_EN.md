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
├── src/                    # Core source code
│   ├── export.js          # Basic export script
│   └── slide1.html        # HTML slide template
├── projects/              # Sub-projects
│   ├── 7-hapit/          # 7 Habits project
│   ├── Framex/           # Framex project
│   ├── ads/              # Ads project
│   └── anythings/        # Miscellaneous project
├── scripts/              # Helper scripts
│   ├── export-all-projects.js  # Export all projects
│   └── *.sh              # Shell scripts
├── docs/                 # Documentation
├── output/               # Outputs (will be created)
├── package.json          # Project settings
└── README.md            # This file (Arabic)
```

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

#### 1. Export single slide
```bash
npm run export
```

#### 2. Export all projects
```bash
node scripts/export-all-projects.js
```

#### 3. Export specific project
```bash
cd projects/7-hapit
npm install
node export-all.js
```

## 📁 Sub-projects

Each sub-project contains:

- `export-all.js`: Project export script
- `html/`: Folder containing HTML slides
- `png/`: Output folder (will be created)
- `package.json`: Project dependencies

## 🛠️ Development

### Adding a new project

1. Create new folder in `projects/`
2. Copy existing project structure
3. Add HTML slides in `html/` folder
4. Update `export-all.js` if needed

### Customizing export settings

You can modify image settings in `export-all.js`:
- Dimensions: `width: 1080, height: 1350`
- Wait timing
- Font handling

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