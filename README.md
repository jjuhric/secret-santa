# Christmas Shopping List

<img src="./public/santa-icon.jpg" alt="Santa Reading Scroll" width="200" />

Welcome to the **Christmas Shopping List** application! This is a festive, family-oriented web app built to manage holiday gift assignments (previously known as Secret Santa). It features a beautiful snowfall aesthetic, a robust Master Admin panel for family management, and automated email notifications.

## Features
- **Family Management:** Group users into families.
- **Automated Draw Algorithm:** Intelligently assigns everyone a recipient from a *different* family (or handles single-family fallback logic).
- **Automated Emails:** Uses EmailJS to instantly notify users of their assignments.
- **Bug Reporting:** Built-in error catching and reporting modal that emails the Master Admin.
- **Full Test Suite:** 100% verified with Vitest (Unit/Integration/Regression) and Playwright E2E testing against the Firebase Local Emulator.

## Tech Stack
- **Frontend:** React + Vite
- **Database / Auth:** Firebase & Firestore
- **Testing:** Vitest & Playwright
- **CI/CD:** GitHub Actions (automated deployment on green tests)

## Getting Started

1. Clone the repository.
2. Run `npm install`.
3. Start the dev server with `npm run dev`.

### Running Tests
- Unit/Integration: `npm run test`
- End-to-End: `npm run test:e2e` (Requires Java 21+ for the Firebase Emulator)
