import { test, expect } from '@playwright/test';

test.describe('Validation dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  test('shows empty state when schema has no issues', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    await page.getByTestId('lint-btn').click();
    await expect(page.getByTestId('validation-dialog')).toBeVisible();
    await expect(page.getByTestId('validation-empty')).toBeVisible();
  });

  test('badge reflects the issue count', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    // Default table has a PK so no base issues.
    const badgeBefore = await page.getByTestId('lint-badge').count();
    expect(badgeBefore).toBe(0);

    // Add a table and a bare column with no PK on the second
    await page.getByTestId('add-table-btn').click();
    // Remove the PK of the second table to introduce a missing-primary-key warning
    const pkBtn = page.locator('[data-testid^="column-pk-"]').nth(1);
    await pkBtn.click();

    // Badge should now show a count
    await expect(page.getByTestId('lint-badge')).toBeVisible();
  });

  test('lint dialog lists issues grouped by severity', async ({ page }) => {
    // Create two tables; clear the second's PK to get a warning
    await page.getByTestId('add-table-btn').click();
    await page.getByTestId('add-table-btn').click();
    const pkBtn = page.locator('[data-testid^="column-pk-"]').nth(1);
    await pkBtn.click();

    await page.getByTestId('lint-btn').click();
    await expect(page.getByTestId('validation-dialog')).toBeVisible();
    await expect(page.getByTestId('validation-section-warning')).toBeVisible();
  });
});
