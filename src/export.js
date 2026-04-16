const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 }
  });

  const filePath = 'file://' + path.join(__dirname, 'slide1.html');
  await page.goto(filePath);

  await page.locator('.slide').screenshot({
    path: 'slide1.png'
  });

  await browser.close();
})();
