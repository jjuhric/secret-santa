# Proposal: Non-Google Authentication & Role-Based Member Management

## 1. Executive Summary

This proposal outlines the recommended architecture to:
1. Enable **non-Google users** (Yahoo, Outlook, Apple, custom domains, etc.) to have the exact same capabilities and experience as Google users.
2. Provide a **testing strategy** covering unit, integration, and end-to-end (E2E) flows.
3. Allow **Family Admins** to remove non-admin members from their own family.
4. Allow the **Master Admin** to remove anyone (regular members, child profiles, and family admins).

---

## 2. Non-Google User Authentication (Recommended Approach)

### The Recommended Pattern: Firebase Email & Password Authentication (with Invite-Gated Activation)

Currently, the application relies on `signInWithPopup(auth, googleProvider)`.
The best, most reliable, and standard way to support any email provider (Yahoo, Outlook, iCloud, work emails) across all devices (desktop, iPhone Safari, Android Chrome) without external servers is **Firebase Auth Email/Password** paired with **Invite-Gated Activation**.

### Why Not Magic Links (Email Link / Passwordless)?
Magic links require opening the link on the exact same browser/device where the request started, which frequently fails on mobile (e.g., when clicking an email opens an in-app browser like Yahoo Mail or Gmail instead of Safari/Chrome). Standard password authentication is 100% reliable across all devices and apps.

### How It Works

#### A. When an Admin Invites a User
1. Admin enters member details: Name, Email (e.g. `sarah@yahoo.com`), and Family.
2. App writes the profile to Firestore `users/sarah@yahoo.com` with `status: 'invited'` (or uncompleted setup).
3. An invite email is sent via EmailJS with a link to the app (`https://<your-app-url>`).

#### B. First-Time Non-Google User Experience (Account Activation)
1. Sarah visits the app on any device.
2. The Login screen provides two clean options:
   - **🎅 Sign in with Google** (one-click for Google users)
   - **✉️ Sign in with Email & Password**
3. Below the email fields, there is a clear button/link: **"First time here? Activate Account"**.
4. Sarah enters her email (`sarah@yahoo.com`) and chooses a password.
5. The system verifies in Firestore that `sarah@yahoo.com` was invited by an admin:
   - **If invited**: It calls Firebase's `createUserWithEmailAndPassword(auth, email, password)`. The user is now authenticated!
   - **If NOT invited**: It blocks registration with a message: *"This email has not been invited. Please contact your family admin."*
6. Alternatively, for password recovery or initial setup, Firebase's native `sendPasswordResetEmail(auth, email)` can be used to send a secure password creation link.

#### C. Returning Login Experience
1. User enters their email and password, clicks **"Sign In"**.
2. Firebase logs them in (`signInWithEmailAndPassword`).
3. `onAuthStateChanged` captures `user.email`.
4. Firestore loads `users/[email]` profile.
5. The user is directed to the Dashboard with **100% feature parity** with Google users:
   - Viewing assigned Secret Santa recipient.
   - Viewing all family members.
   - Checking off people they've bought gifts for.
   - Clicking member names to view Wishlists.
   - Managing their own wishlist and extra gift recipients.

---

## 3. Comprehensive Testing Strategy

To ensure high quality, stability, and zero regressions, tests will be implemented across three tiers:

### Tier 1: Unit Tests (Vitest)
- **`authContext.unit.test.jsx`**:
  - Test `loginWithEmailAndPassword`: successful sign-in updates state.
  - Test `registerOrActivateEmail`: validates against invited Firestore document before account creation.
  - Test error states: invalid password, uninvited email, disabled user.
  - Test `logout`: clears both auth and user profile state.
- **`Login.unit.test.jsx`**:
  - Test UI toggle between "Google Sign-In" and "Email/Password".
  - Test form input validation (empty email, short password).
  - Test activation/first-time mode rendering and triggers.
- **`AdminPermissions.unit.test.jsx`**:
  - Test deletion rules:
    - Family Admin CAN delete non-admin members in their family.
    - Family Admin CANNOT delete other Admins.
    - Family Admin CANNOT delete members from other families.
    - Master Admin CAN delete any user (except self).

### Tier 2: Integration Tests (React Testing Library + Vitest)
- **`EmailAuthFlow.integration.test.jsx`**:
  - Mock Firestore and Firebase Auth.
  - User signs in with email/password -> verify `AuthContext` hydrates profile -> verify redirect to Dashboard or Setup Wizard.
  - User attempts sign-up with an uninvited email -> verify error message displayed.
- **`AdminUserRemoval.integration.test.jsx`**:
  - Render `Admin.jsx` as Family Admin -> click delete on member -> verify confirmation prompt and `deleteDoc` invocation.
  - Render `Admin.jsx` as Master Admin -> verify delete buttons appear for admins of other families -> verify successful deletion.

### Tier 3: End-to-End (E2E) Tests (Playwright + Firebase Emulators)
- **`tests/e2e/non-google-auth.spec.js`**:
  - Use Firebase Auth emulator.
  - Seed an invited user record in Firestore emulator.
  - Visit login page -> fill in email/password -> sign in.
  - Verify landing on Dashboard.
  - Check off a gift recipient checkbox.
  - Open a family member's wishlist modal and verify content displays.

---

## 4. Role-Based User Removal Architecture

### A. Family Admin Capabilities
| Action | Allowed? | Notes |
| :--- | :--- | :--- |
| Remove regular member (same family) | ✅ Yes | Deletes member doc from Firestore |
| Remove child profile (same family) | ✅ Yes | Deletes child doc from Firestore |
| Remove another Family Admin | ❌ No | Button hidden / disabled |
| Remove member of another family | ❌ No | Not visible in Family Admin view |
| Remove self | ❌ No | Prevented to avoid orphaned family |

#### User Experience & Safeguards:
- In `Admin.jsx`, the Users table displays a **Trash** icon next to eligible members.
- Clicking the Trash icon triggers a confirmation dialog:
  > *"Are you sure you want to remove [Member Name] from the [Family Name] family? This will permanently delete their account and wishlist."*
- If the Secret Santa draw has already occurred:
  - An additional warning is displayed:
    > *"Warning: A Secret Santa draw has already been completed. Removing this member will affect gift assignments. We recommend resetting the draw."*

---

### B. Master Admin Capabilities
| Action | Allowed? | Notes |
| :--- | :--- | :--- |
| Remove any regular member (any family) | ✅ Yes | Deletes doc from Firestore |
| Remove any Family Admin (any family) | ✅ Yes | Deletes admin doc |
| Remove child profile (any family) | ✅ Yes | Deletes child doc |
| Remove Master Admin account (self) | ❌ No | Safety lock: Master Admin cannot delete their own account |

#### User Experience & Safeguards:
- In `Admin.jsx`, Master Admin has the **Family Filter** dropdown (`ALL` or specific family).
- Trash icon is visible for **all** users except the logged-in Master Admin.
- If a Family Admin is deleted:
  - If other family members exist, the family remains active.
  - The Master Admin can assign a new Family Admin or manage that family directly.

---

## 5. Summary of Files to Modify / Create

| Component / Layer | File | Planned Changes |
| :--- | :--- | :--- |
| **Authentication Context** | `src/contexts/AuthContext.jsx` | Add `loginWithEmail`, `registerWithEmail`, and `sendPasswordReset` functions. |
| **Login View** | `src/components/Login.jsx` | Add clean tab/toggle for Google Sign-In vs Email/Password, with an "Activate Account / Set Password" option. |
| **Admin Management** | `src/components/Admin.jsx` | Refine delete permission checks: Family Admin can delete `!u.isAdmin && u.familyId === userProfile.familyId`; Master Admin can delete `u.id !== userProfile.id`. Add draw conflict warnings. |
| **Unit & Integration Tests**| `src/tests/unit/authContext.unit.test.jsx`<br/>`src/tests/integration/Admin.integration.test.jsx` | Add unit tests for email/password auth and role-based deletion tests. |
| **E2E Tests** | `tests/e2e/auth-flow.spec.js` | Add Playwright scenario for non-Google user login and dashboard interaction. |
