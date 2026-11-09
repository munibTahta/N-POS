import { test, expect } from '@playwright/test';

import { setupPos } from './helpers.js';

test.beforeEach(async ({ page }) => { await setupPos(page); });

for (const [name, w, h] of [['desktop', 1366, 768], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
  test(`pos layout tidak overflow - ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/pos');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: false });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
}
