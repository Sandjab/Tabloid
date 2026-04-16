import { test, expect } from '@playwright/test';

test.describe('URL sharing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
    });
  });

  test('copies a share link and loads it in a fresh session', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');

    // Create a table with a distinctive name
    await page.getByTestId('add-table-btn').click();
    const tableNameSpan = page.locator('[data-testid^="table-name-"]').first();
    await tableNameSpan.dblclick();
    const input = page.locator('[data-testid^="table-name-input-"]').first();
    await input.fill('shared_users');
    await input.press('Enter');

    // Copy share link
    await page.getByTestId('schema-name-btn').click();
    await page.getByTestId('copy-share-link-btn').click();
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareUrl).toMatch(/#s=/);

    // Open the share URL in a new tab with cleared storage
    const newPage = await context.newPage();
    await newPage.addInitScript(() => { localStorage.clear(); });
    await newPage.goto(shareUrl);
    await newPage.waitForSelector('[data-testid="canvas-container"]');

    // Schema should load with our table
    await expect(newPage.locator('[data-testid^="table-name-"]').first()).toHaveText('shared_users');
    // Hash should be cleared after load so refresh doesn't replay
    expect(newPage.url()).not.toContain('#s=');
  });

  test('shows empty-state toast when sharing an empty schema', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');

    await page.getByTestId('schema-name-btn').click();
    await page.getByTestId('copy-share-link-btn').click();

    await expect(page.locator('text=Nothing to share')).toBeVisible();
  });
});
