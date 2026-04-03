import { test, expect } from '@playwright/test';

test.describe('Canvas + Table CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  test('canvas renders with toolbar and controls', async ({ page }) => {
    await expect(page.getByTestId('canvas-container')).toBeVisible();
    await expect(page.getByTestId('toolbar')).toBeVisible();
    await expect(page.locator('.react-flow__controls')).toBeVisible();
  });

  test('creates a table via toolbar button', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const tableNodes = page.locator('[data-testid^="table-node-"]');
    await expect(tableNodes).toHaveCount(1);
  });

  test('creates a table via double-click on canvas pane', async ({ page }) => {
    const canvas = page.getByTestId('canvas-container');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.click(cx, cy);
    await page.mouse.click(cx, cy);

    const tableNodes = page.locator('[data-testid^="table-node-"]');
    await expect(tableNodes).toHaveCount(1);
  });

  test('new table has default name and a PK column', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const tableName = page.locator('[data-testid^="table-name-"]').first();
    await expect(tableName).toHaveText('table_1');

    const columns = page.locator('[data-testid^="column-row-"]');
    await expect(columns).toHaveCount(1);

    const pkBtn = page.locator('[data-testid^="column-pk-"]').first();
    await expect(pkBtn).toHaveText('🔑');
  });

  test('renames table on double-click', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const tableName = page.locator('[data-testid^="table-name-"]').first();
    await tableName.dblclick();

    const input = page.locator('[data-testid^="table-name-input-"]').first();
    await expect(input).toBeVisible();
    await input.fill('users');
    await input.press('Enter');

    await expect(
      page.locator('[data-testid^="table-name-"]').first(),
    ).toHaveText('users');
  });

  test('adds a column to a table', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const addColBtn = page.locator('[data-testid^="add-column-btn-"]').first();
    await addColBtn.click();

    const columns = page.locator('[data-testid^="column-row-"]');
    await expect(columns).toHaveCount(2);
  });

  test('removes a column from a table', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const removeBtn = page.locator('[data-testid^="column-remove-"]').first();
    await removeBtn.click();

    const columns = page.locator('[data-testid^="column-row-"]');
    await expect(columns).toHaveCount(0);
  });

  test('changes column type via dropdown', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const typeSelect = page.locator('[data-testid^="column-type-"]').first();
    await typeSelect.selectOption('UUID');
    await expect(typeSelect).toHaveValue('UUID');
  });

  test('toggles primary key constraint', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const pkBtn = page.locator('[data-testid^="column-pk-"]').first();

    await expect(pkBtn).toHaveText('🔑');
    await pkBtn.click();
    await expect(pkBtn).toHaveText('·');
    await pkBtn.click();
    await expect(pkBtn).toHaveText('🔑');
  });

  test('toggles NOT NULL constraint', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const nnBtn = page.locator('[data-testid^="column-nn-"]').first();

    // Default PK column is NOT NULL (NN active = bold red)
    await expect(nnBtn).toHaveClass(/font-bold/);
    await nnBtn.click();
    await expect(nnBtn).not.toHaveClass(/font-bold/);
  });

  test('drags a table to a new position', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    const node = page.locator('[data-testid^="table-node-"]').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('No bounding box');

    const startX = box.x + box.width / 2;
    const startY = box.y + 10;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
    await page.mouse.up();

    const newBox = await node.boundingBox();
    if (!newBox) throw new Error('No new bounding box');
    expect(newBox.x).not.toBe(box.x);
  });
});
