import { test, expect } from '@playwright/test';

test.describe('Bug Report E2E Flow', () => {
  test('Bug button appears on error and submits successfully', async ({ page }) => {
    // 1. Navigate to the app (Playwright starts dev server on 5173 automatically)
    // We add VITE_USE_EMULATOR=true in the playwright config or env, but we can also just rely on it.
    await page.goto('/');

    // Ensure button is hidden initially
    const bugButton = page.locator('button', { hasText: 'Report Bug' });
    await expect(bugButton).not.toBeVisible();

    // 2. Trigger a synthetic app-error
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app-error', { detail: 'E2E Fake Error' }));
    });

    // Button should now be visible
    await expect(bugButton).toBeVisible();

    // 3. Click button to open modal
    await bugButton.click();

    // Modal should appear
    const modalHeading = page.locator('h2', { hasText: 'Report an Issue' });
    await expect(modalHeading).toBeVisible();

    // 4. Fill description
    await page.getByPlaceholder('Describe what happened').fill('E2E Test Bug Description');

    // 5. Submit form
    await page.getByRole('button', { name: 'Send Bug Report' }).click();

    // Wait for success popup
    const successHeading = page.locator('h2', { hasText: 'Bug Report Submitted' });
    await expect(successHeading).toBeVisible();

    // 6. Click OK
    await page.getByRole('button', { name: 'OK' }).click();

    // Verify EVERYTHING is hidden
    await expect(successHeading).not.toBeVisible();
    await expect(modalHeading).not.toBeVisible();
    await expect(bugButton).not.toBeVisible();
  });
});
