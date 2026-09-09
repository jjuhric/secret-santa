import { test, expect } from '@playwright/test';

test.describe('Master Admin Setup E2E Flow', () => {
  test('First user signs in, becomes Master Admin, and completes setup', async ({ page, context }) => {
    // 1. Navigate to the app
    await page.goto('/');

    const signInBtn = page.getByRole('button', { name: /Sign In With Google/i });
    await expect(signInBtn).toBeVisible();

    // 2. Handle Firebase Auth Emulator popup
    const pagePromise = context.waitForEvent('page');
    await signInBtn.click();
    const popup = await pagePromise;
    
    // Wait for the emulator UI to load
    await popup.waitForLoadState('networkidle');

    // Wait for either "Add new account" or just proceed to the form
    const addAccountBtn = popup.locator('text=/Add new account/i').first();
    try {
      await addAccountBtn.waitFor({ state: 'visible', timeout: 5000 });
      await addAccountBtn.click();
    } catch (e) {
      console.log('Add new account button not found or timed out, assuming form is visible');
    }
    
    // Fill the email and display name using generic CSS selectors instead of placeholders
    const emailInput = popup.locator('input[type="email"], input[name="email"], input[id*="email"]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill('master@example.com');

    const nameInput = popup.locator('input[type="text"], input[name="displayName"], input[id*="name"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Master Chief');
    }
    
    // Click "Sign in"
    await popup.getByRole('button', { name: /Sign in/i }).first().click();

    // Wait for the popup to close and auth state to resolve in the main window
    await page.waitForURL('**/');

    // 3. User should now see the Setup Wizard
    const wizardHeading = page.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' });
    await expect(wizardHeading).toBeVisible({ timeout: 10000 });

    // 4. Fill out the setup wizard
    await page.getByPlaceholder('e.g. Jane Uhrick').fill('Master Chief');
    await page.getByPlaceholder('e.g. Uhrick').fill('Halo');
    await page.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // 5. Verify Dashboard features
    await expect(page.locator('h2', { hasText: "Master Chief's Wishlist" })).toBeVisible();

    // 6. Verify Master Admin privileges (Admin Link should be present)
    const adminLink = page.getByRole('link', { name: 'Family Admin Panel' });
    await expect(adminLink).toBeVisible();
    
    // Navigate to Admin to ensure Master features are there
    await adminLink.click();
    await expect(page.getByText(/Bug Reports/i)).toBeVisible();
  });
});
