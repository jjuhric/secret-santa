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
    const addAccountBtn = popup.getByRole('button', { name: /Add new account/i });
    if (await addAccountBtn.isVisible()) await addAccountBtn.click();
    await popup.getByPlaceholder(/Enter email/i, { exact: false }).fill('admin@example.com');
    await popup.getByPlaceholder(/Enter display name/i, { exact: false }).fill('Admin User');
    await popup.getByRole('button', { name: /Sign in/i }).click();

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
    
    if (await userPopup.getByRole('button', { name: /Add new account/i }).isVisible()) {
      await userPopup.getByRole('button', { name: /Add new account/i }).click();
    }
    await userPopup.getByPlaceholder(/Enter email/i, { exact: false }).fill('user3@example.com');
    await userPopup.getByPlaceholder(/Enter display name/i, { exact: false }).fill('User Three');
    await userPopup.getByRole('button', { name: /Sign in/i }).click();

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
