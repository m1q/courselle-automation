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
