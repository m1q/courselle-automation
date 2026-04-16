#!/usr/bin/env bash
set -euo pipefail

PROJECTS_ROOT="$HOME/content_projects"

PROJECT_NAME="${1:-}"
if [[ -z "$PROJECT_NAME" ]]; then
  read -rp "Enter project name to export: " PROJECT_NAME
fi

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Project name is required."
  exit 1
fi

PROJECT_DIR="$PROJECTS_ROOT/$PROJECT_NAME"
HTML_DIR="$PROJECT_DIR/html"
PNG_DIR="$PROJECT_DIR/png"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Project folder not found:"
  echo "$PROJECT_DIR"
  exit 1
fi

if [[ ! -d "$HTML_DIR" ]]; then
  echo "HTML folder not found:"
  echo "$HTML_DIR"
  exit 1
fi

mkdir -p "$PNG_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found."
  echo "Install it with:"
  echo "sudo apt update && sudo apt install -y nodejs npm"
  exit 1
fi

cat > "$PROJECT_DIR/export-all.js" <<'EOF'
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function getSlideNumber(filename) {
  const match = filename.match(/^slide(\d+)\.html$/i);
  return match ? parseInt(match[1], 10) : 9999;
}

(async () => {
  const projectDir = __dirname;
  const htmlDir = path.join(projectDir, 'html');
  const pngDir = path.join(projectDir, 'png');

  const htmlFiles = fs
    .readdirSync(htmlDir)
    .filter(file => /^slide\d+\.html$/i.test(file))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  if (htmlFiles.length === 0) {
    console.log('No slide HTML files found in html folder.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  for (const file of htmlFiles) {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1350 }
    });

    try {
      const filePath = 'file://' + path.join(htmlDir, file);
      const outputName = file.replace(/\.html$/i, '.png');

      await page.goto(filePath, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'screen' });

      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      await page.waitForTimeout(700);

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

      console.log(`Exported: ${file} -> png/${outputName}`);
    } catch (error) {
      console.log(`Failed: ${file}`);
      console.log(error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
EOF

cd "$PROJECT_DIR"

if [[ ! -f package.json ]]; then
  /usr/bin/npm init -y >/dev/null 2>&1
fi

/usr/bin/npm install -D playwright
sudo ./node_modules/.bin/playwright install --with-deps chromium
node export-all.js

echo
echo "Export finished."
echo "PNG folder: $PNG_DIR"
