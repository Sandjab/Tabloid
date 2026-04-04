# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: relations.spec.ts >> Relations >> creates a relation after confirming dialog
- Location: e2e\relations.spec.ts:60:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-testid^="table-node-"]')
Expected: 2
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('[data-testid^="table-node-"]')
    9 × locator resolved to 1 element
      - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - button "Table" [ref=e5]:
      - img
      - text: Table
    - separator [ref=e6]
    - button "Undo (Ctrl+Z)" [ref=e7]:
      - img
    - button "Redo (Ctrl+Y)" [disabled]:
      - img
    - separator [ref=e8]
    - button "Layout" [ref=e9]:
      - img
      - text: Layout
    - separator [ref=e10]
    - button "Export" [ref=e11]:
      - img
      - text: Export
    - button "Import" [ref=e12]:
      - img
      - text: Import
    - separator [ref=e13]
    - button "Search (Ctrl+F)" [ref=e14]:
      - img
    - button "Switch to dark mode" [ref=e15]:
      - img
  - generic [ref=e16]:
    - img
    - application [ref=e17]:
      - group [active] [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23] [cursor=pointer]: table_1
            - generic [ref=e24]:
              - button "●" [ref=e25]
              - button "✎" [ref=e26]
              - button "+" [ref=e27]
          - generic [ref=e30]:
            - img [ref=e32]
            - button "Toggle Primary Key" [ref=e39]:
              - img [ref=e40]
            - generic "id" [ref=e43] [cursor=pointer]
            - combobox [ref=e44]:
              - option "TEXT"
              - option "INTEGER"
              - option "BIGINT"
              - option "SMALLINT"
              - option "DECIMAL"
              - option "FLOAT"
              - option "BOOLEAN"
              - option "DATE"
              - option "TIME"
              - option "TIMESTAMP"
              - option "UUID"
              - option "BLOB"
              - option "JSON"
              - option "SERIAL" [selected]
            - button "NN" [ref=e45]
            - button "UQ" [ref=e46]
            - button "×" [ref=e47]
      - img
      - generic "Control Panel" [ref=e50]:
        - button "Zoom In" [disabled]:
          - img
        - button "Zoom Out" [ref=e51] [cursor=pointer]:
          - img [ref=e52]
        - button "Fit View" [ref=e54] [cursor=pointer]:
          - img [ref=e55]
        - button "Toggle Interactivity" [ref=e57] [cursor=pointer]:
          - img [ref=e58]
      - img "Mini Map" [ref=e61]
      - generic [ref=e63]: Proudly clauded by JP GAVINI 04/2026
      - link "React Flow attribution" [ref=e65] [cursor=pointer]:
        - /url: https://reactflow.dev
        - text: React Flow
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Relations', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await page.waitForSelector('[data-testid="canvas-container"]');
  7  |   });
  8  | 
  9  |   async function createTwoSeparatedTables(page: import('@playwright/test').Page) {
  10 |     const canvas = page.getByTestId('canvas-container');
  11 |     const box = await canvas.boundingBox();
  12 |     if (!box) throw new Error('No canvas bounding box');
  13 | 
  14 |     // Create table 1 on the left via double-click
  15 |     const leftX = box.x + box.width * 0.25;
  16 |     const centerY = box.y + box.height * 0.5;
  17 |     await page.mouse.click(leftX, centerY);
  18 |     await page.mouse.click(leftX, centerY);
  19 | 
  20 |     // Create table 2 on the right via double-click
  21 |     const rightX = box.x + box.width * 0.75;
  22 |     await page.mouse.click(rightX, centerY);
  23 |     await page.mouse.click(rightX, centerY);
  24 | 
  25 |     const tables = page.locator('[data-testid^="table-node-"]');
> 26 |     await expect(tables).toHaveCount(2);
     |                          ^ Error: expect(locator).toHaveCount(expected) failed
  27 |   }
  28 | 
  29 |   async function connectFirstColumns(page: import('@playwright/test').Page) {
  30 |     // Find the source handle (right side) of first table's first column
  31 |     const sourceHandles = page.locator('[data-testid^="handle-source-col_"]');
  32 |     const targetHandles = page.locator('[data-testid^="handle-target-col_"]');
  33 | 
  34 |     const srcHandle = sourceHandles.first();
  35 |     const tgtHandle = targetHandles.last();
  36 | 
  37 |     // Force visibility for Playwright interaction
  38 |     await srcHandle.evaluate((el) => (el.style.opacity = '1'));
  39 |     await tgtHandle.evaluate((el) => (el.style.opacity = '1'));
  40 | 
  41 |     const srcBox = await srcHandle.boundingBox();
  42 |     const tgtBox = await tgtHandle.boundingBox();
  43 |     if (!srcBox || !tgtBox) throw new Error('Handle bounding box not found');
  44 | 
  45 |     await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  46 |     await page.mouse.down();
  47 |     await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, {
  48 |       steps: 15,
  49 |     });
  50 |     await page.mouse.up();
  51 |   }
  52 | 
  53 |   test('relation type dialog appears when connecting two columns', async ({ page }) => {
  54 |     await createTwoSeparatedTables(page);
  55 |     await connectFirstColumns(page);
  56 | 
  57 |     await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });
  58 |   });
  59 | 
  60 |   test('creates a relation after confirming dialog', async ({ page }) => {
  61 |     await createTwoSeparatedTables(page);
  62 |     await connectFirstColumns(page);
  63 | 
  64 |     await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });
  65 | 
  66 |     await page.getByTestId('relation-option-one-to-many').click();
  67 |     await page.getByTestId('relation-confirm-btn').click();
  68 | 
  69 |     await expect(page.getByTestId('relation-type-dialog')).not.toBeVisible();
  70 | 
  71 |     const edgeLabels = page.locator('[data-testid^="edge-label-"]');
  72 |     await expect(edgeLabels).toHaveCount(1);
  73 |     await expect(edgeLabels.first()).toHaveText('1:N');
  74 |   });
  75 | 
  76 |   test('canceling dialog does not create a relation', async ({ page }) => {
  77 |     await createTwoSeparatedTables(page);
  78 |     await connectFirstColumns(page);
  79 | 
  80 |     await expect(page.getByTestId('relation-type-dialog')).toBeVisible({ timeout: 3000 });
  81 |     await page.getByTestId('relation-cancel-btn').click();
  82 | 
  83 |     const edgeLabels = page.locator('[data-testid^="edge-label-"]');
  84 |     await expect(edgeLabels).toHaveCount(0);
  85 |   });
  86 | });
  87 | 
```