import { test } from '@playwright/test';
import fs from 'fs';

test('dump dom', async ({ page, context }) => {
  await page.goto('http://localhost:5173/');
  const pagePromise = context.waitForEvent('page');
  await page.getByRole('button', { name: /Sign In With Google/i }).click();
  const popup = await pagePromise;
  await popup.waitForLoadState('networkidle');
  await popup.waitForTimeout(1000);
  
  await popup.screenshot({ path: 'popup_before.png' });
  
  const addBtn = popup.getByRole('button', { name: /Add new account/i }).first();
  await addBtn.click({ force: true });
  await popup.waitForTimeout(1000);
  
  await popup.screenshot({ path: 'popup_after.png' });
  
  const html = await popup.content();
  fs.writeFileSync('dom_dump.html', html);
});
