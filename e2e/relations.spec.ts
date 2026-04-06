import { test, expect } from '@playwright/test';

test.describe('Relations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  async function createTwoSeparatedTables(page: import('@playwright/test').Page) {
    // Use the toolbar button for reliable table creation
    const addBtn = page.getByTestId('add-table-btn');

    await addBtn.click();
    const tables = page.locator('[data-testid^="table-node-"]');
    await expect(tables).toHaveCount(1);

    await addBtn.click();
    await expect(tables).toHaveCount(2);

    // Use auto-layout (via context menu) to separate tables properly
    const canvas = page.getByTestId('canvas-container');
    await canvas.click({ button: 'right', position: { x: 10, y: 10 } });
    await page.getByTestId('ctx-auto-layout').click();
    await page.waitForTimeout(500);

    // Fit view to ensure both tables are visible
    await canvas.click({ button: 'right', position: { x: 10, y: 10 } });
    await page.getByTestId('ctx-fit-view').click();
    await page.waitForTimeout(500);
  }

  async function connectFirstColumns(page: import('@playwright/test').Page) {
    // Make all handles visible and larger for reliable interaction
    await page.evaluate(() => {
      document.querySelectorAll('.react-flow__handle').forEach((el) => {
        (el as HTMLElement).style.setProperty('opacity', '1', 'important');
        (el as HTMLElement).style.setProperty('width', '20px', 'important');
        (el as HTMLElement).style.setProperty('height', '20px', 'important');
      });
    });

    const srcHandle = page.locator('[data-testid^="handle-right-"]').first();
    const tgtHandle = page.locator('[data-testid^="handle-left-"]').last();

    const srcBox = await srcHandle.boundingBox();
    const tgtBox = await tgtHandle.boundingBox();
    if (!srcBox || !tgtBox) throw new Error('Handle bounding box not found');

    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
  }

  test('creates a relation immediately when connecting two columns', async ({ page }) => {
    await createTwoSeparatedTables(page);
    await connectFirstColumns(page);

    // No dialog — relation created directly with default 1:N
    const edgeLabels = page.locator('[data-testid^="edge-label-"]');
    await expect(edgeLabels).toHaveCount(2, { timeout: 5000 });
    await expect(page.locator('[data-testid^="edge-label-source-"]').first()).toHaveText('1');
    await expect(page.locator('[data-testid^="edge-label-target-"]').first()).toHaveText('N');
  });

  test('clicking label toggles cardinality', async ({ page }) => {
    await createTwoSeparatedTables(page);
    await connectFirstColumns(page);

    // Wait for labels to appear
    const sourceLabel = page.locator('[data-testid^="edge-label-source-"]').first();
    await expect(sourceLabel).toHaveText('1', { timeout: 3000 });

    // Click the "1" source label — should toggle to "N"
    // dispatchEvent needed because React Flow's pane layer sits above EdgeLabelRenderer
    await sourceLabel.dispatchEvent('click', { bubbles: true });
    await expect(sourceLabel).toHaveText('N');

    // Click again — should toggle back to "1"
    await sourceLabel.dispatchEvent('click', { bubbles: true });
    await expect(sourceLabel).toHaveText('1');
  });

  test('does not create a relation when connecting a column to itself', async ({ page }) => {
    await createTwoSeparatedTables(page);

    // Make handles visible
    await page.evaluate(() => {
      document.querySelectorAll('.react-flow__handle').forEach((el) => {
        (el as HTMLElement).style.setProperty('opacity', '1', 'important');
      });
    });

    // Try to connect a handle to itself — should be blocked by isValidConnection
    const rightHandles = page.locator('[data-testid^="handle-right-col_"]');
    const srcHandle = rightHandles.first();

    const srcBox = await srcHandle.boundingBox();
    if (!srcBox) throw new Error('Handle bounding box not found');

    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    // Drag slightly and release on the same handle
    await page.mouse.move(srcBox.x + srcBox.width / 2 + 5, srcBox.y + srcBox.height / 2, { steps: 3 });
    await page.mouse.up();

    const edgeLabels = page.locator('[data-testid^="edge-label-"]');
    await expect(edgeLabels).toHaveCount(0);
  });
});
