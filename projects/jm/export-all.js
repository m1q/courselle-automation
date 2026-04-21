const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH || '1080', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT || '1350', 10);
const WAIT_MS = parseInt(process.env.WAIT_MS || '700', 10);
const EXPORT_FIRST_ONLY = process.env.EXPORT_FIRST_ONLY === '1';

function getSlideNumber(filename) {
  const match = filename.match(/^slide(\d+)\.html$/i);
  return match ? parseInt(match[1], 10) : 9999;
}

(async () => {
  const projectDir = __dirname;
  const htmlDir = path.join(projectDir, 'html');
  const pngDir = path.join(projectDir, 'png');

  if (!fs.existsSync(htmlDir)) {
    console.error('HTML folder not found:', htmlDir);
    process.exit(1);
  }

  fs.mkdirSync(pngDir, { recursive: true });

  let htmlFiles = fs
    .readdirSync(htmlDir)
    .filter(file => /^slide\d+\.html$/i.test(file))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  if (htmlFiles.length === 0) {
    console.error('No slide HTML files found in html folder.');
    process.exit(1);
  }

  if (EXPORT_FIRST_ONLY) {
    htmlFiles = [htmlFiles[0]];
  }

  const browser = await chromium.launch({ headless: true });

  for (const file of htmlFiles) {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
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

      await page.waitForTimeout(WAIT_MS);

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

      console.log(`✅ Exported: ${file} -> png/${outputName}`);
    } catch (error) {
      console.error(`❌ Failed: ${file}`);
      console.error(error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('🎉 Done.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});