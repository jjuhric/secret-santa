# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: masterAdminSetup.e2e.spec.js >> Master Admin Setup E2E Flow >> First user signs in, becomes Master Admin, and completes setup
- Location: e2e\masterAdminSetup.e2e.spec.js:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Continue to Family Setup' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img "Santa reading wishlist scroll" [ref=e7]
      - heading "Welcome to Christmas Shopping List!" [level=2] [ref=e8]
      - paragraph [ref=e9]: Master Admin First-Time Setup
    - generic [ref=e15]:
      - 'heading "Step 2: Add Gift Ideas to Your Wishlist" [level=3] [ref=e16]'
      - paragraph [ref=e17]: Help whoever draws your name! Add 1 or 2 items you'd love to receive (you can add more anytime on your dashboard).
      - generic [ref=e18]:
        - textbox "Item name (e.g. Cozy Wool Sweater)" [ref=e19]
        - textbox "Link to item (optional Amazon, Target, etc.)" [ref=e20]
        - button "Add to List" [ref=e21] [cursor=pointer]
      - generic [ref=e26]:
        - button "Back" [ref=e27] [cursor=pointer]
        - button "Continue to Invite Members" [ref=e28] [cursor=pointer]
  - iframe [aria-hidden] [ref=e31]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Master Admin Setup E2E Flow', () => {
  4  |   test('First user signs in, becomes Master Admin, and completes setup', async ({ page, context }) => {
  5  |     // 1. Navigate to the app
  6  |     await page.goto('/');
  7  | 
  8  |     const signInBtn = page.getByRole('button', { name: /Sign In With Google/i });
  9  |     await expect(signInBtn).toBeVisible();
  10 | 
  11 |     // 2. Handle Firebase Auth Emulator popup
  12 |     const pagePromise = context.waitForEvent('page');
  13 |     await signInBtn.click();
  14 |     const popup = await pagePromise;
  15 |     
  16 |     // Wait for the emulator UI to load
  17 |     await popup.waitForLoadState('networkidle');
  18 |     await popup.waitForTimeout(1000);
  19 | 
  20 |     try {
  21 |       await popup.getByRole('button', { name: /Add new account/i }).first().click({ force: true, timeout: 5000 });
  22 |     } catch (e) {
  23 |       console.log('Add new account button not found or timed out, assuming form is visible');
  24 |     }
  25 |     
  26 |     const emailInput = popup.locator('#email-input');
  27 |     await emailInput.waitFor({ state: 'attached', timeout: 10000 });
  28 |     await popup.waitForTimeout(1000); // Wait for tab animation
  29 |     await emailInput.click({ force: true });
  30 |     await popup.waitForTimeout(500);
  31 |     await emailInput.fill('admin@example.com', { force: true });
  32 | 
  33 |     const nameInput = popup.locator('#display-name-input');
  34 |     if (await nameInput.count() > 0) {
  35 |       await nameInput.click({ force: true });
  36 |       await popup.waitForTimeout(500);
  37 |       await nameInput.fill('Master Chief', { force: true });
  38 |     }
  39 |     
  40 |     try {
  41 |       const signInSubmit = popup.getByRole('button', { name: /Sign in with Google\.com/i }).first();
  42 |       await signInSubmit.click({ force: true, timeout: 5000 });
  43 |     } catch (e) {
  44 |       await emailInput.press('Enter');
  45 |     }
  46 |     
  47 |     // If it was "Save" and the popup didn't close, there might be a user list now. Click the user.
  48 |     try {
  49 |       if (!popup.isClosed()) {
  50 |         const userBtn = popup.locator('text=/master@example.com/i').first();
  51 |         await userBtn.waitFor({ state: 'visible', timeout: 5000 });
  52 |         await userBtn.click();
  53 |       }
  54 |     } catch (e) {
  55 |       console.log('Popup closed or user button not found');
  56 |     }
  57 | 
  58 |     // Wait for the popup to close completely
  59 |     while (!popup.isClosed()) {
  60 |        await page.waitForTimeout(500);
  61 |     }
  62 | 
  63 |     // 3. User should now see the Setup Wizard
  64 |     const wizardHeading = page.locator('h2', { hasText: 'Welcome to Christmas Shopping List!' });
  65 |     await expect(wizardHeading).toBeVisible({ timeout: 10000 });
  66 | 
  67 |     // 4. Fill out the setup wizard (Step 1)
  68 |     await page.getByPlaceholder('e.g. Jane Uhrick').fill('Master Chief');
  69 |     await page.getByPlaceholder('e.g. Uhrick').fill('Halo');
  70 |     await page.getByRole('button', { name: 'Continue to Wishlist' }).click();
  71 | 
  72 |     // Step 2: Wishlist
  73 |     await expect(page.locator('h3', { hasText: 'Step 2: Add Gift Ideas to Your Wishlist' })).toBeVisible();
> 74 |     await page.getByRole('button', { name: 'Continue to Family Setup' }).click();
     |                                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  75 | 
  76 |     // Step 3: Invite Family
  77 |     await expect(page.locator('h3', { hasText: 'Step 3: Invite Family Members' })).toBeVisible();
  78 |     await page.getByRole('button', { name: 'Skip / Continue' }).click();
  79 | 
  80 |     // Step 4: Finish
  81 |     await expect(page.locator('h3', { hasText: "You're All Set!" })).toBeVisible();
  82 |     await page.getByRole('button', { name: 'Enter Christmas Shopping List Dashboard' }).click();
  83 | 
  84 |     // 5. Verify Dashboard features
  85 |     await expect(page.locator('h2', { hasText: "Master Chief's Wishlist" })).toBeVisible({ timeout: 10000 });
  86 |     // 6. Verify Master Admin privileges (Admin Link should be present)
  87 |     const adminLink = page.getByRole('link', { name: 'Family Admin Panel' });
  88 |     await expect(adminLink).toBeVisible();
  89 |     
  90 |     // Navigate to Admin to ensure Master features are there
  91 |     await adminLink.click();
  92 |     await expect(page.getByText(/Bug Reports/i)).toBeVisible();
  93 |   });
  94 | });
  95 | 
```