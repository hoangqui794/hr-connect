import { expect, test } from '@playwright/test';
import { mockCandidateApis } from './support/candidateApi';

test('Candidate đăng nhập và mở được workspace trên viewport hiện tại', async ({ page }, testInfo) => {
  await mockCandidateApis(page);
  await page.goto('/login');

  await page.getByPlaceholder('ten@doanhnghiep.com').fill('candidate@gmail.com');
  await page.getByPlaceholder('••••••••').fill('111111Aa@');
  await page.getByRole('button', { name: 'Đăng nhập tài khoản' }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  // The current product redirects Candidate to the public home. Open the owned
  // workspace explicitly so this smoke test remains useful while step 1 changes
  // the post-login destination to /candidate/dashboard.
  await page.goto('/candidate/dashboard');

  await expect(page.getByRole('heading', { name: /Chào E2E/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /HR Connect, về tổng quan/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm việc làm' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-dashboard-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
