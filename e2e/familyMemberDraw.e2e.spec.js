import { test, expect } from '@playwright/test';

test.describe('Family Member Draw E2E Flow', () => {
  test.beforeEach(async ({ request }) => {
    try {
      await request.delete('http://localhost:8080/emulator/v1/projects/uhrick-christmas-list/databases/(default)/documents');
      await request.delete('http://localhost:9099/emulator/v1/projects/uhrick-christmas-list/accounts');
    } catch (e) {
      console.warn('Could not clear emulator data:', e);
    }
  });

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
      await nameInput.fill('Master Admin', { force: true });
    }
    
    try {
      const signInSubmit = popup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
      await signInSubmit.click({ force: true, timeout: 5000 });
    } catch (e) {
      await emailInput.press('Enter');
    }
    
    try {
      if (!popup.isClosed()) {
        const userBtn = popup.locator('text=/admin@example.com/i').first();
        await userBtn.waitFor({ state: 'visible', timeout: 5000 });
        await userBtn.click();
      }
    } catch (e) {
      console.log('Popup closed or user button not found');
    }

    // Wait for the popup to close completely
    while (!popup.isClosed()) {
       await adminPage.waitForTimeout(500);
    }

    // Complete setup wizard for Admin (Step 1)
    await expect(adminPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
    await adminPage.getByPlaceholder('e.g. Jane Uhrick').fill('Master Admin');
    await adminPage.getByPlaceholder('e.g. Uhrick').fill('FamilyOne');
    await adminPage.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // Step 2: Wishlist
    await expect(adminPage.locator('h3', { hasText: 'Step 2: Add Gift Ideas to Your Wishlist' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Continue to Invite Members' }).click();

    // Step 3: Invite Family
    await expect(adminPage.locator('h3', { hasText: 'Step 3: Invite Family Members' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Ready to Finish' }).click();

    // Step 4: Finish
    await expect(adminPage.locator('h3', { hasText: "You're All Set!" })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Enter Christmas Shopping List Dashboard' }).click();

    // Go to Admin Panel
    await adminPage.getByRole('link', { name: /Admin Panel/i }).click();

    // Invite User 2 (FamilyTwo)
    await adminPage.getByPlaceholder('Full Name').fill('User Two');
    await adminPage.getByPlaceholder('Google Email').fill('user2@example.com');
    await adminPage.getByPlaceholder('Family Name (e.g. Uhrick)').fill('FamilyTwo');
    await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();
    await expect(adminPage.getByText(/User created!/i)).toBeVisible();

    // Invite User 3 (FamilyThree - Different Family to allow a valid draw)
    await adminPage.getByPlaceholder('Full Name').fill('User Three');
    await adminPage.getByPlaceholder('Google Email').fill('user3@example.com');
    await adminPage.getByPlaceholder('Family Name (e.g. Uhrick)').fill('FamilyThree');
    await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();
    await expect(adminPage.getByText(/User created!/i)).toBeVisible();

    // --- Perform the Draw ---
    const drawBtn = adminPage.getByRole('button', { name: /Run Christmas Shopping List Draw/i });
    await expect(drawBtn).toBeEnabled({ timeout: 10000 });
    adminPage.on('dialog', async dialog => {
      await dialog.accept();
    });
    await drawBtn.click();

    // Verify Draw Success
    await expect(adminPage.getByText(/Draw completed successfully/i)).toBeVisible({ timeout: 10000 });

    // --- BROWSER CONTEXT 2: User Three logs in to see assignment ---
    const userContext = await adminPage.context().browser().newContext();
    const userPage = await userContext.newPage();
    await userPage.goto('/');

    const userPagePromise = userContext.waitForEvent('page');
    await userPage.getByRole('button', { name: /Sign In With Google/i }).click();
    const userPopup = await userPagePromise;
    
    await userPopup.waitForLoadState('networkidle');
    await userPopup.waitForTimeout(1000);
    try {
      await userPopup.getByRole('button', { name: /Add new account/i }).first().click({ force: true, timeout: 5000 });
    } catch (e) {
      console.log('Add new account button not found or timed out, assuming form is visible');
    }

    const emailInput2 = userPopup.locator('#email-input');
    await emailInput2.waitFor({ state: 'attached', timeout: 10000 });
    await userPopup.waitForTimeout(1000); // Wait for tab animation
    await emailInput2.click({ force: true });
    await userPopup.waitForTimeout(500);
    await emailInput2.fill('user3@example.com', { force: true });
    
    const nameInput2 = userPopup.locator('#display-name-input');
    if (await nameInput2.count() > 0) {
      await nameInput2.click({ force: true });
      await userPopup.waitForTimeout(500);
      await nameInput2.fill('User Three', { force: true });
    }
    
    try {
      const signInSubmit2 = userPopup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
      await signInSubmit2.click({ force: true, timeout: 5000 });
    } catch (e) {
      await emailInput2.press('Enter');
    }
    
    try {
      if (!userPopup.isClosed()) {
        const userBtn2 = userPopup.locator('text=/user3@example.com/i').first();
        await userBtn2.waitFor({ state: 'visible', timeout: 5000 });
        await userBtn2.click();
      }
    } catch (e) {
      console.log('Popup closed or user button not found');
    }

    // Wait for the popup to close completely
    while (!userPopup.isClosed()) {
       await userPage.waitForTimeout(500);
    }

    // Complete User Setup
    await expect(userPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
    await userPage.getByPlaceholder('e.g. Jane Uhrick').fill('User Three');
    await userPage.getByPlaceholder('e.g. Uhrick').fill('FamilyThree');
    await userPage.getByRole('button', { name: 'Continue to Wishlist' }).click();

    // Step 2: Wishlist (Non-admin completes setup here)
    await expect(userPage.locator('h3', { hasText: 'Step 2: Add Gift Ideas to Your Wishlist' })).toBeVisible();
    await userPage.getByRole('button', { name: 'Complete Setup' }).click();

    // Verify Assignment! Since User 3 is in FamilyThree, and Admin/User2 are in FamilyOne/FamilyTwo
    // User 3 must have drawn someone outside FamilyThree (Master Admin or User Two).
    await expect(userPage.getByText(/You are buying for:/i)).toBeVisible({ timeout: 10000 });
    
    // We expect either Master Admin or User Two to be displayed as recipient
    await expect(userPage.getByText(/Master Admin|User Two/)).toBeVisible({ timeout: 5000 });
  });
});
