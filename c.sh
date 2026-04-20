#!/usr/bin/env bash
set -Eeuo pipefail

INPUT="${1:-}"
OUTPUT="${2:-output.png}"

[[ -z "$INPUT" ]] && {
  echo "Usage: ./export.sh input.html [output.png]"
  exit 1
}

command -v node >/dev/null 2>&1 || { echo "node not found"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm not found"; exit 1; }

if [[ ! -f package.json ]]; then
  npm init -y >/dev/null 2>&1
fi

if [[ ! -d node_modules/playwright ]]; then
  npm install -D playwright
fi

if [[ ! -d "$HOME/.cache/ms-playwright" ]]; then
  npx playwright install chromium
fi

cat > export.js <<'EOF'
const path = require('path');
const { chromium } = require('playwright');

const input = process.argv[2];
const output = process.argv[3] || 'output.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 }
  });

  const filePath = 'file://' + path.resolve(input);

  await page.goto(filePath, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'screen' });

  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  await page.waitForTimeout(700);

  const slide = page.locator('div.slide');

  if (await slide.count()) {
    await slide.first().screenshot({ path: output });
  } else {
    await page.screenshot({ path: output, fullPage: false });
  }

  await browser.close();
  console.log(`Done: ${output}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

node export.js "$INPUT" "$OUTPUT"
