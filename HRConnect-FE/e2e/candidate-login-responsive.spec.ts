import { expect, test } from '@playwright/test';
import { mockCandidateApis } from './support/candidateApi';

test('Trang chủ công khai hiển thị lối vào cho Guest', async ({ page }, testInfo) => {
  const isCompact = testInfo.project.name === 'mobile-chromium';
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Việc làm tốt nhất' })).toBeVisible();
  if (isCompact) {
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.getByRole('button', { name: /Việc làm/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dịch vụ/ })).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: 'Việc làm', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dịch vụ', exact: true })).toBeVisible();
  }
  await expect(page.getByText('Vai trò', { exact: true })).toHaveCount(0);
  if (isCompact) {
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Đăng ký/ }).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Vào không gian Candidate' })).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath(`guest-landing-${testInfo.project.name}.png`),
    fullPage: true,
  });

});

test('Candidate đăng nhập và mở được workspace trên viewport hiện tại', async ({ page }, testInfo) => {
  const isCompact = testInfo.project.name === 'mobile-chromium';
  const apiState = await mockCandidateApis(page, { expireProfileRequestOnce: true });
  await page.goto('/login');

  await expect(page.getByRole('button', { name: /Về trang chủ/ }).last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đăng nhập HR Connect' })).toBeVisible();
  await page.getByPlaceholder('ten@email.com').fill('candidate@gmail.com');
  await page.getByPlaceholder('Nhập mật khẩu').fill('111111Aa@');
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/$/);
  const sharedHeader = page.locator('header').first();
  const brandLink = sharedHeader.locator('a[href="/"]').first();
  await expect(brandLink).toBeVisible();
  if (isCompact) {
    await sharedHeader.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.getByRole('button', { name: /Việc làm/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo CV/ })).toBeVisible();
  } else {
    await expect(sharedHeader.getByRole('link', { name: 'Việc làm', exact: true })).toBeVisible();
    await expect(sharedHeader.getByRole('link', { name: 'Tạo CV', exact: true })).toBeVisible();
  }
  const initialBrandX = (await brandLink.boundingBox())?.x;

  await page.goto('/candidate/dashboard');
  await expect(page.getByRole('heading', { name: 'Việc làm phù hợp với hồ sơ của bạn' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-dashboard-${testInfo.project.name}.png`),
    fullPage: true,
  });

  if (isCompact) {
    await sharedHeader.getByRole('button', { name: 'Mở menu' }).click();
    await page.getByRole('button', { name: /Việc làm/ }).click();
  } else {
    await sharedHeader.getByRole('link', { name: 'Việc làm', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/(candidate\/)?jobs(\?tab=all)?$/);
  const filterButton = page.getByRole('button', { name: /^Bộ lọc/ });
  if (await filterButton.isVisible()) {
    await filterButton.click();
  } else {
    await expect(page.getByRole('complementary', { name: 'Bộ lọc' })).toBeVisible();
  }
  await expect(page.getByText('Mức lương (triệu/tháng)')).toBeVisible();
  await expect(page.getByText('Kinh nghiệm', { exact: true })).toBeVisible();

  const jobsHaveHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(jobsHaveHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-jobs-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.goto('/candidate/applications');
  await expect(page.getByRole('heading', { name: 'Đơn ứng tuyển của tôi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đang chờ bạn xác nhận' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backend Developer', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem và xác nhận' })).toBeVisible();
  const applicationsBrandX = (await brandLink.boundingBox())?.x;
  expect(Math.abs((applicationsBrandX ?? 0) - (initialBrandX ?? 0))).toBeLessThan(1);
  await page.screenshot({
    path: testInfo.outputPath(`candidate-applications-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.goto('/candidate/profile');
  await expect(page.getByRole('heading', { name: 'Candidate E2E' })).toBeVisible();
  expect(apiState.refreshRequestCount).toBe(1);
  expect(apiState.refreshCookieReceived).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('refresh_token'))).toBeNull();
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
  await expect(page).toHaveURL(/\/$/);
  if (isCompact) {
    await sharedHeader.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.getByRole('button', { name: /Việc làm/ })).toBeVisible();
  } else {
    await expect(sharedHeader.getByRole('link', { name: 'Việc làm', exact: true })).toBeVisible();
  }
  await expect(page.getByText('Quản lý tìm việc')).toHaveCount(0);

  await sharedHeader.getByRole('button', { name: /Candidate E2E/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Việc làm tốt nhất' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
});
