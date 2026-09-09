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
    
    // Fill the email and display name using generic input locators
    const inputs = popup.locator('input');
    await inputs.nth(0).waitFor({ state: 'visible' });
    await inputs.nth(0).fill('master@example.com');

    if (await inputs.nth(1).isVisible()) {
      await inputs.nth(1).fill('Master Chief');
      await inputs.nth(1).press('Enter');
    } else {
      await inputs.nth(0).press('Enter');
    }
    
    // If it was "Save" and the popup didn't close, there might be a user list now. Click the user.
    try {
      if (!popup.isClosed()) {
        const userBtn = popup.locator('text=/master@example.com/i').first();
        await userBtn.waitFor({ state: 'visible', timeout: 5000 });
        await userBtn.click();
      }
    } catch (e) {
      console.log('Popup closed or user button not found');
    }

    // Wait for the popup to close completely
    while (!popup.isClosed()) {
       await page.waitForTimeout(500);
    }

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
