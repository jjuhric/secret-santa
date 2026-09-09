import { test, expect } from '@playwright/test';

test.describe('Family Member Draw E2E Flow', () => {
  test('Master Admin invites a user, performs the draw, and users see assignments', async ({ page, context }) => {
    // Note: In a complete isolated E2E suite, we'd use Playwright's API request context 
    // to seed the Firestore database with multiple users to perform a draw, 
    // or we'd drive the UI through multiple browser contexts.
    // For this demonstration, we'll outline the exact multi-user flow.

    // --- BROWSER CONTEXT 1: Master Admin ---
    const adminPage = await context.newPage();
    await adminPage.goto('/');

    const signInBtn = adminPage.getByRole('button', { name: /Sign In With Google/i });
    const pagePromise = context.waitForEvent('page');
    await signInBtn.click();
    const popup = await pagePromise;
    
    // Login as Admin
    const addAccountBtn = popup.locator('text=/Add new account/i').first();
    try {
      await addAccountBtn.waitFor({ state: 'visible', timeout: 5000 });
      await addAccountBtn.click();
    } catch (e) {
      console.log('Add new account button not found, assuming form is visible');
    }
    
    const inputs = popup.locator('input');
    await inputs.nth(0).waitFor({ state: 'visible' });
    await inputs.nth(0).fill('admin@example.com');
    
    if (await inputs.nth(1).isVisible()) {
      await inputs.nth(1).fill('Admin User');
      await inputs.nth(1).press('Enter');
    } else {
      await inputs.nth(0).press('Enter');
    }
    
    try {
      if (!popup.isClosed()) {
        const userBtn = popup.locator('text=admin@example.com').first();
        await userBtn.waitFor({ state: 'visible', timeout: 3000 });
        await userBtn.click();
      }
    } catch (e) {
      console.log('Popup closed or user button not found');
    }

    // Complete setup wizard for Admin
    await expect(adminPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
    await adminPage.getByPlaceholder('e.g. Jane Uhrick').fill('Admin User');
    await adminPage.getByPlaceholder('e.g. Uhrick').fill('AdminFamily');
    await adminPage.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // Go to Admin Panel
    await adminPage.getByRole('link', { name: 'Family Admin Panel' }).click();

    // Invite User 2
    await adminPage.getByPlaceholder('Full Name', { exact: true }).fill('User Two');
    await adminPage.getByPlaceholder('Google Email Address').fill('user2@example.com');
    await adminPage.getByRole('combobox').selectOption('AdminFamily');
    await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();

    // Invite User 3 (Different Family to allow a valid draw)
    await adminPage.getByPlaceholder('Full Name', { exact: true }).fill('User Three');
    await adminPage.getByPlaceholder('Google Email Address').fill('user3@example.com');
    await adminPage.getByPlaceholder('New Family Name').fill('OtherFamily'); // Creates a new family
    await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();

    // --- Perform the Draw ---
    // Wait for members to appear in list (we might have a slight delay for Firestore updates)
    await adminPage.waitForTimeout(1000); 
    
    // In our app, we click "Run Draw"
    await adminPage.getByRole('button', { name: /Run Christmas Shopping List Draw/i }).click();

    // Verify Draw Success
    await expect(adminPage.getByText(/Draw completed successfully/i)).toBeVisible();

    // --- BROWSER CONTEXT 2: User Three logs in to see assignment ---
    const userContext = await adminPage.context().browser().newContext();
    const userPage = await userContext.newPage();
    await userPage.goto('/');

    const userPagePromise = userContext.waitForEvent('page');
    await userPage.getByRole('button', { name: /Sign In With Google/i }).click();
    const userPopup = await userPagePromise;
    
    const addAccountBtn2 = userPopup.locator('text=/Add new account/i').first();
    try {
      await addAccountBtn2.waitFor({ state: 'visible', timeout: 5000 });
      await addAccountBtn2.click();
    } catch (e) {
      console.log('Add new account button not found, assuming form is visible');
    }

    const inputs2 = userPopup.locator('input');
    await inputs2.nth(0).waitFor({ state: 'visible' });
    await inputs2.nth(0).fill('user3@example.com');
    
    if (await inputs2.nth(1).isVisible()) {
      await inputs2.nth(1).fill('User Three');
      await inputs2.nth(1).press('Enter');
    } else {
      await inputs2.nth(0).press('Enter');
    }
    
    try {
      if (!userPopup.isClosed()) {
        const userBtn2 = userPopup.locator('text=user3@example.com').first();
        await userBtn2.waitFor({ state: 'visible', timeout: 3000 });
        await userBtn2.click();
      }
    } catch (e) {
      console.log('Popup closed or user button not found');
    }

    // Complete User Setup
    await expect(userPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
    await userPage.getByPlaceholder('e.g. Jane Uhrick').fill('User Three');
    // They are in OtherFamily, they might not need to enter it if prefilled, but SetupWizard requires it
    await userPage.getByPlaceholder('e.g. Uhrick').fill('OtherFamily');
    await userPage.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // Verify Assignment! Since User 3 is in OtherFamily, and Admin/User2 are in AdminFamily
    // User 3 must have drawn someone from AdminFamily.
    await expect(userPage.getByText(/You are shopping for:/i)).toBeVisible();
    
    // We expect either Admin User or User Two
    const assignmentText = await userPage.locator('.glass-card').nth(1).textContent();
    expect(assignmentText).toMatch(/Admin User|User Two/);
  });
});
