import { test, expect } from '@playwright/test';

test.describe('Master Admin Setup E2E Flow', () => {
  test.beforeEach(async ({ request }) => {
    try {
      await request.delete('http://localhost:8080/emulator/v1/projects/uhrick-christmas-list/databases/(default)/documents');
      await request.delete('http://localhost:9099/emulator/v1/projects/uhrick-christmas-list/accounts');
    } catch (e) {
      console.warn('Could not clear emulator data:', e);
    }
  });

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
    await popup.waitForTimeout(1000);

    try {
      await popup.getByRole('button', { name: /Add new account/i }).first().click({ force: true, timeout: 5000 });
    } catch (e) {
      console.log('Add new account button not found or timed out, assuming form is visible');
    }
    
    const emailInput = popup.locator('#email-input');
    await emailInput.waitFor({ state: 'attached', timeout: 10000 });
    await popup.waitForTimeout(1000); // Wait for tab animation
    await emailInput.click({ force: true });
    await popup.waitForTimeout(500);
    await emailInput.fill('admin@example.com', { force: true });

    const nameInput = popup.locator('#display-name-input');
    if (await nameInput.count() > 0) {
      await nameInput.click({ force: true });
      await popup.waitForTimeout(500);
      await nameInput.fill('Master Chief', { force: true });
    }
    
    try {
      const signInSubmit = popup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
      await signInSubmit.click({ force: true, timeout: 5000 });
    } catch (e) {
      await emailInput.press('Enter');
    }
    
    // If it was "Save" and the popup didn't close, there might be a user list now. Click the user.
    try {
      if (!popup.isClosed()) {
        const userBtn = popup.locator('text=/admin@example\.com/i').first();
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

    // 4. Fill out the setup wizard (Step 1)
    await page.getByPlaceholder('e.g. Jane Uhrick').fill('Master Chief');
    await page.getByPlaceholder('e.g. Uhrick').fill('Halo');
    await page.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // Step 2: Wishlist
    await expect(page.locator('h3', { hasText: 'Step 2: Add Gift Ideas to Your Wishlist' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to Invite Members' }).click();

    // Step 3: Invite Family
    await expect(page.locator('h3', { hasText: 'Step 3: Invite Family Members' })).toBeVisible();
    await page.getByRole('button', { name: 'Ready to Finish' }).click();

    // Step 4: Finish
    await expect(page.locator('h3', { hasText: "You're All Set!" })).toBeVisible();
    await page.getByRole('button', { name: 'Enter Christmas Shopping List Dashboard' }).click();

    // 5. Verify Dashboard features
    await expect(page.locator('h2', { hasText: "Master Chief's Wishlist" })).toBeVisible({ timeout: 10000 });
    // 6. Verify Master Admin privileges (Admin Link should be present)
    const adminLink = page.getByRole('link', { name: /Admin Panel/i });
    await expect(adminLink).toBeVisible();
    
    // Navigate to Admin to ensure Master features are there
    await adminLink.click();
    await expect(page.getByText(/Bug Reports/i)).toBeVisible();
  });
});
