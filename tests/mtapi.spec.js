
const { test, expect } = require('@playwright/test');

test.describe('MTAPI Debug Overlay Tests', () => {
  // Увеличиваем таймаут для всего файла
  test.setTimeout(30000);
  const URL = 'http://localhost:8080/static/demo/index.html';

  test('Debug overlay opens and tabs switch', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    
    // 1. Открываем дебаг-оверлей (FAB 🐞)
    const fab = page.locator('#mtapi-debug-fab');
    await expect(fab).toBeVisible();
    await fab.click();
    
    // 2. Проверяем, что оверлей появился
    const overlay = page.locator('#mtapi-debug-overlay');
    await expect(overlay).toBeVisible();
    
    // 3. Переключаемся на вкладку Network
    const networkTab = page.locator('button[data-tab="network"]');
    await expect(networkTab).toBeVisible();
    await networkTab.click();
    
    // 4. Проверяем, что вкладка стала активной
    const networkContent = page.locator('div[data-tab-content="network"]');
    await expect(networkContent).toHaveClass(/active/);
  });

  test('AI Snap button exists', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    
    // Проверяем, что кнопка Snap (✨) есть в DOM-инспекторе (или в шапке)
    // (Так как она может быть скрыта, просто проверяем наличие в коде)
    const snapBtnCount = await page.locator('#mtapi-debug-ai-snap-btn').count();
    expect(snapBtnCount).toBeGreaterThan(0);
  });
});
