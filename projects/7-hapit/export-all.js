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
