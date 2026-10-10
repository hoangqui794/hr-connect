import { expect, test } from '@playwright/test';
import { mockCandidateApis } from './support/candidateApi';

test('Candidate đăng nhập và mở được workspace trên viewport hiện tại', async ({ page }, testInfo) => {
  await mockCandidateApis(page);
  await page.goto('/login');

  await page.getByPlaceholder('ten@doanhnghiep.com').fill('candidate@gmail.com');
  await page.getByPlaceholder('••••••••').fill('111111Aa@');
  await page.getByRole('button', { name: 'Đăng nhập tài khoản' }).click();

  await expect(page).toHaveURL(/\/candidate\/dashboard$/);

  await expect(page.getByRole('heading', { name: /Chào E2E/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /HR Connect, về tổng quan/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm việc' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-dashboard-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.getByRole('link', { name: 'Tìm việc', exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/jobs$/);
  await expect(page.getByRole('heading', { name: 'Tìm việc làm phù hợp' })).toBeVisible();

  const jobsHaveHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(jobsHaveHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-jobs-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
