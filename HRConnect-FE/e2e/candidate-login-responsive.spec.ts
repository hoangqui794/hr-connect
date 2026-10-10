import { expect, test } from '@playwright/test';
import { mockCandidateApis } from './support/candidateApi';

test('Trang chủ công khai hiển thị lối vào cho Guest', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Tuyển Dụng Chuẩn ATS/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng nhập/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng ký/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vào không gian Candidate' })).toHaveCount(0);
});

test('Candidate đăng nhập và mở được workspace trên viewport hiện tại', async ({ page }, testInfo) => {
  await mockCandidateApis(page);
  await page.goto('/login');

  await page.getByPlaceholder('ten@doanhnghiep.com').fill('candidate@gmail.com');
  await page.getByPlaceholder('••••••••').fill('111111Aa@');
  await page.getByRole('button', { name: 'Đăng nhập tài khoản' }).click();

  await expect(page).toHaveURL(/\/candidate\/dashboard$/);

  await expect(page.getByRole('heading', { name: /Chào E2E/i })).toBeVisible();
  const brandLink = page.getByRole('link', { name: /HR Connect, về tổng quan/i });
  await expect(brandLink).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm việc' })).toBeVisible();
  const initialBrandX = (await brandLink.boundingBox())?.x;

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
  const jobsBrandX = (await brandLink.boundingBox())?.x;
  expect(Math.abs((jobsBrandX ?? 0) - (initialBrandX ?? 0))).toBeLessThan(1);
  const filterHeights = await Promise.all([
    page.getByLabel('Từ khóa tìm việc').evaluate((element) => element.closest('.ant-input-group-wrapper')?.getBoundingClientRect().height ?? 0),
    page.getByLabel('Địa điểm').evaluate((element) => element.closest('.ant-input-affix-wrapper')?.getBoundingClientRect().height ?? 0),
    page.getByRole('combobox', { name: 'Hình thức làm việc' }).evaluate((element) => element.closest('.ant-select')?.getBoundingClientRect().height ?? 0),
    page.getByRole('combobox', { name: 'Loại dịch vụ' }).evaluate((element) => element.closest('.ant-select')?.getBoundingClientRect().height ?? 0),
  ]);
  expect(Math.max(...filterHeights) - Math.min(...filterHeights)).toBeLessThan(1);

  const jobsHaveHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(jobsHaveHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-jobs-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.goto('/candidate/profile');
  await expect(page.getByRole('heading', { name: 'Candidate E2E' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hồ sơ & CV', exact: true })).not.toHaveAttribute('aria-current', 'page');
  const profileBrandX = (await brandLink.boundingBox())?.x;
  expect(Math.abs((profileBrandX ?? 0) - (initialBrandX ?? 0))).toBeLessThan(1);
  const profileHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(profileHasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-profile-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/candidate\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Chào E2E/i })).toBeVisible();
  await expect(page.getByText('Quản lý tìm việc')).toHaveCount(0);
});
