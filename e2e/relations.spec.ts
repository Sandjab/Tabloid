import { test, expect } from '@playwright/test';

test.describe('Relations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  async function createTwoSeparatedTables(page: import('@playwright/test').Page) {
    const canvas = page.getByTestId('canvas-container');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No canvas bounding box');

    // Create table 1 on the left via double-click
    const leftX = box.x + box.width * 0.25;
    const centerY = box.y + box.height * 0.5;
    await page.mouse.click(leftX, centerY);
    await page.mouse.click(leftX, centerY);

    // Create table 2 on the right via double-click
    const rightX = box.x + box.width * 0.75;
    await page.mouse.click(rightX, centerY);
    await page.mouse.click(rightX, centerY);

    const tables = page.locator('[data-testid^="table-node-"]');
    await expect(tables).toHaveCount(2);
  }

  async function connectFirstColumns(page: import('@playwright/test').Page) {
    // Find the source handle (right side) of first table's first column
    const sourceHandles = page.locator('[data-testid^="handle-source-col_"]');
    const targetHandles = page.locator('[data-testid^="handle-target-col_"]');

    const srcHandle = sourceHandles.first();
    const tgtHandle = targetHandles.last();

    // Force visibility for Playwright interaction
    await srcHandle.evaluate((el) => (el.style.opacity = '1'));
    await tgtHandle.evaluate((el) => (el.style.opacity = '1'));

    const srcBox = await srcHandle.boundingBox();
    const tgtBox = await tgtHandle.boundingBox();
    if (!srcBox || !tgtBox) throw new Error('Handle bounding box not found');

    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, {
      steps: 15,
    });
    await page.mouse.up();
  }

  test('relation type dialog appears when connecting two columns', async ({ page }) => {
    await createTwoSeparatedTables(page);
    await connectFirstColumns(page);

    await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });
  });

  test('creates a relation after confirming dialog', async ({ page }) => {
    await createTwoSeparatedTables(page);
    await connectFirstColumns(page);

    await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('relation-option-one-to-many').click();
    await page.getByTestId('relation-confirm-btn').click();

    await expect(page.getByTestId('relation-type-dialog')).not.toBeVisible();

    const edgeLabels = page.locator('[data-testid^="edge-label-"]');
    await expect(edgeLabels).toHaveCount(2);
    await expect(page.locator('[data-testid^="edge-label-source-"]').first()).toHaveText('1');
    await expect(page.locator('[data-testid^="edge-label-target-"]').first()).toHaveText('N');
  });

  test('canceling dialog does not create a relation', async ({ page }) => {
    await createTwoSeparatedTables(page);
    await connectFirstColumns(page);

    await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('relation-cancel-btn').click();

    const edgeLabels = page.locator('[data-testid^="edge-label-"]');
    await expect(edgeLabels).toHaveCount(0);
  });
});
