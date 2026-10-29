
const { test, expect } = require('@playwright/test');

test.describe('MTAPI Debug Overlay Tests', () => {
  test.setTimeout(30000);
  const URL = 'http://localhost:8080/static/demo/index.html';

  test('Debug overlay opens and tabs switch', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    
    const fab = page.locator('#mtapi-debug-fab');
    await expect(fab).toBeVisible();
    await fab.click();
    
    const overlay = page.locator('#mtapi-debug-overlay');
    await expect(overlay).toBeVisible();
    
    const networkTab = page.locator('button[data-tab="network"]');
    await expect(networkTab).toBeVisible();
    await networkTab.click();
    
    const networkContent = page.locator('div[data-tab-content="network"]');
    await expect(networkContent).toHaveClass(/active/);
  });

  test('AI Snap function is available globally', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    
    // Проверяем, что функция Snap загружена в глобальный объект window
    const hasSnap = await page.evaluate(() => {
        return typeof window._aiSnapCurrent === 'function' || typeof window._aiSnap === 'function';
    });
    
    expect(hasSnap).toBe(true);
  });
});
