import { test, expect } from '@playwright/test';

test.describe('Diff & Migration', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to avoid state leaking across tests
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  test('tag current schema, modify, then diff shows ALTER and highlights', async ({ page }) => {
    // 1. Create a table with one column
    await page.getByTestId('add-table-btn').click();
    await expect(page.locator('[data-testid^="table-node-"]')).toHaveCount(1);

    // Rename the table to "users"
    const tableName = page.locator('[data-testid^="table-name-"]').first();
    await tableName.dblclick();
    const tableNameInput = page.locator('[data-testid^="table-name-input-"]').first();
    await tableNameInput.fill('users');
    await tableNameInput.press('Enter');
    await expect(page.locator('[data-testid^="table-name-"]').first()).toHaveText('users');

    // 2. Open Diff dialog and tag current schema as v1
    await page.getByTestId('diff-btn').click();
    await expect(page.getByTestId('diff-dialog')).toBeVisible();
    await page.getByTestId('diff-tag-name-input').fill('v1');
    await page.getByTestId('diff-create-tag-btn').click();

    // Wait for tag list to appear
    await expect(page.getByTestId('diff-tag-list')).toBeVisible();
    await expect(page.getByTestId('diff-compare-tag-v1')).toBeVisible();

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('diff-dialog')).not.toBeVisible();

    // 3. Modify the schema: add a new column via context menu
    const tableNode = page.locator('[data-testid^="table-node-"]').first();
    const addColBtn = tableNode.locator('[data-testid^="add-column-btn-"]');
    await addColBtn.click();
    await expect(page.locator('[data-testid^="column-row-"]')).toHaveCount(2);

    // 4. Reopen Diff dialog and compare with v1
    await page.getByTestId('diff-btn').click();
    await expect(page.getByTestId('diff-dialog')).toBeVisible();
    await page.getByTestId('diff-compare-tag-v1').click();

    // Verify summary shows column added
    await expect(page.getByTestId('diff-summary')).toBeVisible();
    await expect(page.getByTestId('diff-summary')).toContainText('users');
    await expect(page.getByTestId('diff-summary')).toContainText('column');

    // Switch to SQL tab
    await page.getByTestId('diff-tab-sql').click();
    const sqlPreview = page.getByTestId('diff-sql-preview');
    await expect(sqlPreview).toBeVisible();
    await expect(sqlPreview).toContainText('ALTER TABLE');
    await expect(sqlPreview).toContainText('ADD COLUMN');
    await expect(sqlPreview).toContainText('"users"');

    // Change dialect to mysql and verify output adapts
    await page.getByTestId('diff-dialect-select').click();
    await page.getByRole('option', { name: /mysql/i }).click();
    await expect(sqlPreview).toContainText('`users`');

    // Close dialog
    await page.keyboard.press('Escape');

    // 5. Verify canvas highlight: the table containing the added column is "modified" (amber border)
    await expect(tableNode).toHaveClass(/border-amber-500/);
  });

  test('diff shows empty state when current matches baseline', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    await page.getByTestId('diff-btn').click();

    await page.getByTestId('diff-tag-name-input').fill('baseline');
    await page.getByTestId('diff-create-tag-btn').click();
    await page.getByTestId('diff-compare-tag-baseline').click();

    await expect(page.getByTestId('diff-summary-empty')).toBeVisible();
  });

  test('clear baseline removes highlights and resets dialog', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    await page.getByTestId('diff-btn').click();
    await page.getByTestId('diff-tag-name-input').fill('v1');
    await page.getByTestId('diff-create-tag-btn').click();
    await page.getByTestId('diff-compare-tag-v1').click();

    // Clear baseline
    await page.getByTestId('diff-clear-baseline-btn').click();

    // Source picker should be visible again
    await expect(page.getByTestId('diff-tag-name-input')).toBeVisible();
  });
});
