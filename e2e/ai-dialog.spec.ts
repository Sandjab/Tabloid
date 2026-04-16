import { test, expect } from '@playwright/test';

test.describe('AI dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/');
    await page.waitForSelector('[data-testid="canvas-container"]');
  });

  test('AI button opens the dialog with API-key banner', async ({ page }) => {
    await page.getByTestId('ai-btn').click();
    await expect(page.getByTestId('ai-dialog')).toBeVisible();
    await expect(page.getByTestId('api-key-banner-missing')).toBeVisible();
  });

  test('saving an API key flips the banner to configured', async ({ page }) => {
    await page.getByTestId('ai-btn').click();
    await page.getByTestId('api-key-input').fill('sk-ant-test-key-dummy');
    await page.getByTestId('api-key-save-btn').click();
    await expect(page.getByTestId('api-key-banner-configured')).toBeVisible();

    await page.getByTestId('api-key-forget-btn').click();
    await expect(page.getByTestId('api-key-banner-missing')).toBeVisible();
  });

  test('AI tab switches navigate between features', async ({ page }) => {
    await page.getByTestId('ai-btn').click();
    await expect(page.getByTestId('ai-dialog')).toBeVisible();

    await page.getByTestId('ai-tab-suggest-fks').click();
    // No tables yet — should show empty state.
    await expect(page.getByTestId('suggest-fks-empty')).toBeVisible();

    await page.getByTestId('ai-tab-explain').click();
    // Explain tab shows its own "add tables first" state when schema empty.
    await expect(page.getByText(/Add at least one table/)).toBeVisible();

    await page.getByTestId('ai-tab-infer-types').click();
    await expect(page.getByTestId('infer-types-empty')).toBeVisible();

    await page.getByTestId('ai-tab-generate').click();
    await expect(page.getByTestId('ai-generate-description')).toBeVisible();
  });

  test('Suggest FKs tab shows empty state when no suggestions', async ({ page }) => {
    await page.getByTestId('add-table-btn').click();
    await page.getByTestId('ai-btn').click();
    await page.getByTestId('ai-tab-suggest-fks').click();
    await expect(page.getByTestId('suggest-fks-empty')).toBeVisible();
  });
});
