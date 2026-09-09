# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: familyMemberDraw.e2e.spec.js >> Family Member Draw E2E Flow >> Master Admin invites a user, performs the draw, and users see assignments
- Location: e2e\familyMemberDraw.e2e.spec.js:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Continue to Family Setup' })

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Family Member Draw E2E Flow', () => {
  4   |   test('Master Admin invites a user, performs the draw, and users see assignments', async ({ page, context }) => {
  5   |     // Note: In a complete isolated E2E suite, we'd use Playwright's API request context 
  6   |     // to seed the Firestore database with multiple users to perform a draw, 
  7   |     // or we'd drive the UI through multiple browser contexts.
  8   |     // For this demonstration, we'll outline the exact multi-user flow.
  9   | 
  10  |     // --- BROWSER CONTEXT 1: Master Admin ---
  11  |     const adminPage = await context.newPage();
  12  |     await adminPage.goto('/');
  13  | 
  14  |     const signInBtn = adminPage.getByRole('button', { name: /Sign In With Google/i });
  15  |     const pagePromise = context.waitForEvent('page');
  16  |     await signInBtn.click();
  17  |     const popup = await pagePromise;
  18  |     
  19  |     // Login as Admin
  20  |     await popup.waitForLoadState('networkidle');
  21  |     await popup.waitForTimeout(1000);
  22  |     try {
  23  |       await popup.getByRole('button', { name: /Add new account/i }).first().click({ force: true, timeout: 5000 });
  24  |     } catch (e) {
  25  |       console.log('Add new account button not found or timed out, assuming form is visible');
  26  |     }
  27  |     
  28  |     const emailInput = popup.locator('#email-input');
  29  |     await emailInput.waitFor({ state: 'attached', timeout: 10000 });
  30  |     await popup.waitForTimeout(1000); // Wait for tab animation
  31  |     await emailInput.click({ force: true });
  32  |     await popup.waitForTimeout(500);
  33  |     await emailInput.fill('admin@example.com', { force: true });
  34  |     
  35  |     const nameInput = popup.locator('#display-name-input');
  36  |     if (await nameInput.count() > 0) {
  37  |       await nameInput.click({ force: true });
  38  |       await popup.waitForTimeout(500);
  39  |       await nameInput.fill('Master Admin', { force: true });
  40  |     }
  41  |     
  42  |     try {
  43  |       const signInSubmit = popup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
  44  |       await signInSubmit.click({ force: true, timeout: 5000 });
  45  |     } catch (e) {
  46  |       await emailInput.press('Enter');
  47  |     }
  48  |     
  49  |     try {
  50  |       if (!popup.isClosed()) {
  51  |         const userBtn = popup.locator('text=/admin@example.com/i').first();
  52  |         await userBtn.waitFor({ state: 'visible', timeout: 5000 });
  53  |         await userBtn.click();
  54  |       }
  55  |     } catch (e) {
  56  |       console.log('Popup closed or user button not found');
  57  |     }
  58  | 
  59  |     // Wait for the popup to close completely
  60  |     while (!popup.isClosed()) {
  61  |        await adminPage.waitForTimeout(500);
  62  |     }
  63  | 
  64  |     // Complete setup wizard for Admin (Step 1)
  65  |     await expect(adminPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
  66  |     await adminPage.getByPlaceholder('e.g. Jane Uhrick').fill('Master Admin');
  67  |     await adminPage.getByPlaceholder('e.g. Uhrick').fill('Test Family');
  68  |     await adminPage.getByRole('button', { name: 'Continue to Wishlist' }).click();
  69  | 
  70  |     // Step 2: Wishlist
  71  |     await expect(adminPage.locator('h3', { hasText: 'Step 2: Add Gift Ideas to Your Wishlist' })).toBeVisible();
> 72  |     await adminPage.getByRole('button', { name: 'Continue to Family Setup' }).click();
      |                                                                               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  73  | 
  74  |     // Step 3: Invite Family
  75  |     await expect(adminPage.locator('h3', { hasText: 'Step 3: Invite Family Members' })).toBeVisible();
  76  |     await adminPage.getByRole('button', { name: 'Skip / Continue' }).click();
  77  | 
  78  |     // Step 4: Finish
  79  |     await expect(adminPage.locator('h3', { hasText: "You're All Set!" })).toBeVisible();
  80  |     await adminPage.getByRole('button', { name: 'Enter Christmas Shopping List Dashboard' }).click();
  81  | 
  82  |     // Go to Admin Panel
  83  |     await adminPage.getByRole('link', { name: 'Family Admin Panel' }).click();
  84  | 
  85  |     // Invite User 2
  86  |     await adminPage.getByPlaceholder('Full Name', { exact: true }).fill('User Two');
  87  |     await adminPage.getByPlaceholder('Google Email Address').fill('user2@example.com');
  88  |     await adminPage.getByRole('combobox').selectOption('Test Family');
  89  |     await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();
  90  | 
  91  |     // Invite User 3 (Different Family to allow a valid draw)
  92  |     await adminPage.getByPlaceholder('Full Name', { exact: true }).fill('User Three');
  93  |     await adminPage.getByPlaceholder('Google Email Address').fill('user3@example.com');
  94  |     await adminPage.getByPlaceholder('New Family Name').fill('OtherFamily'); // Creates a new family
  95  |     await adminPage.getByRole('button', { name: 'Add & Send Invite' }).click();
  96  | 
  97  |     // --- Perform the Draw ---
  98  |     // Wait for members to appear in list (we might have a slight delay for Firestore updates)
  99  |     await adminPage.waitForTimeout(1000); 
  100 |     
  101 |     // In our app, we click "Run Draw"
  102 |     await adminPage.getByRole('button', { name: /Run Christmas Shopping List Draw/i }).click();
  103 | 
  104 |     // Verify Draw Success
  105 |     await expect(adminPage.getByText(/Draw completed successfully/i)).toBeVisible();
  106 | 
  107 |     // --- BROWSER CONTEXT 2: User Three logs in to see assignment ---
  108 |     const userContext = await adminPage.context().browser().newContext();
  109 |     const userPage = await userContext.newPage();
  110 |     await userPage.goto('/');
  111 | 
  112 |     const userPagePromise = userContext.waitForEvent('page');
  113 |     await userPage.getByRole('button', { name: /Sign In With Google/i }).click();
  114 |     const userPopup = await userPagePromise;
  115 |     
  116 |     await userPopup.waitForLoadState('networkidle');
  117 |     await userPopup.waitForTimeout(1000);
  118 |     try {
  119 |       await userPopup.getByRole('button', { name: /Add new account/i }).first().click({ force: true, timeout: 5000 });
  120 |     } catch (e) {
  121 |       console.log('Add new account button not found or timed out, assuming form is visible');
  122 |     }
  123 | 
  124 |     const emailInput2 = userPopup.locator('#email-input');
  125 |     await emailInput2.waitFor({ state: 'attached', timeout: 10000 });
  126 |     await userPopup.waitForTimeout(1000); // Wait for tab animation
  127 |     await emailInput2.click({ force: true });
  128 |     await userPopup.waitForTimeout(500);
  129 |     await emailInput2.fill('user3@example.com', { force: true });
  130 |     
  131 |     const nameInput2 = userPopup.locator('#display-name-input');
  132 |     if (await nameInput2.count() > 0) {
  133 |       await nameInput2.click({ force: true });
  134 |       await userPopup.waitForTimeout(500);
  135 |       await nameInput2.fill('User Three', { force: true });
  136 |     }
  137 |     
  138 |     try {
  139 |       const signInSubmit2 = userPopup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
  140 |       await signInSubmit2.click({ force: true, timeout: 5000 });
  141 |     } catch (e) {
  142 |       await emailInput2.press('Enter');
  143 |     }
  144 |     
  145 |     try {
  146 |       if (!userPopup.isClosed()) {
  147 |         const userBtn2 = userPopup.locator('text=/user3@example.com/i').first();
  148 |         await userBtn2.waitFor({ state: 'visible', timeout: 5000 });
  149 |         await userBtn2.click();
  150 |       }
  151 |     } catch (e) {
  152 |       console.log('Popup closed or user button not found');
  153 |     }
  154 | 
  155 |     // Wait for the popup to close completely
  156 |     while (!userPopup.isClosed()) {
  157 |        await userPage.waitForTimeout(500);
  158 |     }
  159 | 
  160 |     // Complete User Setup
  161 |     await expect(userPage.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' })).toBeVisible({ timeout: 10000 });
  162 |     await userPage.getByPlaceholder('e.g. Jane Uhrick').fill('User Three');
  163 |     // They are in OtherFamily, they might not need to enter it if prefilled, but SetupWizard requires it
  164 |     await userPage.getByPlaceholder('e.g. Uhrick').fill('OtherFamily');
  165 |     await userPage.getByRole('button', { name: 'Continue to Wishlist' }).click();
  166 | 
  167 |     // Verify Assignment! Since User 3 is in OtherFamily, and Admin/User2 are in AdminFamily
  168 |     // User 3 must have drawn someone from AdminFamily.
  169 |     await expect(userPage.getByText(/You are shopping for:/i)).toBeVisible();
  170 |     
  171 |     // We expect either Admin User or User Two
  172 |     const assignmentText = await userPage.locator('.glass-card').nth(1).textContent();
```