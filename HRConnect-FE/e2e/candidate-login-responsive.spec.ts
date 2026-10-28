import { expect, test } from '@playwright/test';
import { mockCandidateApis } from './support/candidateApi';

test('Trang chủ công khai hiển thị lối vào cho Guest', async ({ page }, testInfo) => {
  const isCompact = testInfo.project.name !== 'desktop-chromium';
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Khám phá .* cơ hội nghề nghiệp/i })).toBeVisible();
  if (isCompact) {
    await page.getByRole('button', { name: 'Menu điều hướng' }).click();
    await expect(page.getByRole('button', { name: /Việc làm/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Giải pháp dịch vụ/ })).toBeVisible();
  } else {
    await expect(page.getByText('Việc làm', { exact: true })).toBeVisible();
    await expect(page.getByText('Giải pháp dịch vụ', { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Vai trò', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng ký/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vào không gian Candidate' })).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath(`guest-landing-${testInfo.project.name}.png`),
    fullPage: true,
  });

});

test('Candidate đăng nhập và mở được workspace trên viewport hiện tại', async ({ page }, testInfo) => {
  const isCompact = testInfo.project.name !== 'desktop-chromium';
  await mockCandidateApis(page);
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
    await sharedHeader.getByRole('button', { name: 'Menu điều hướng' }).click();
    await expect(page.getByRole('button', { name: /Phù hợp với bạn/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Việc làm/ })).toBeVisible();
  } else {
    await expect(sharedHeader.getByRole('button', { name: /Phù hợp với bạn/ })).toBeVisible();
    await expect(sharedHeader.getByRole('button', { name: /Việc làm/ })).toBeVisible();
  }
  const initialBrandX = (await brandLink.boundingBox())?.x;

  await page.goto('/candidate/dashboard');
  await expect(page.getByRole('heading', { name: /Chào E2E/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`candidate-dashboard-${testInfo.project.name}.png`),
    fullPage: true,
  });

  if (isCompact) {
    await sharedHeader.getByRole('button', { name: 'Menu điều hướng' }).click();
    await page.getByRole('button', { name: /Phù hợp với bạn/ }).click();
  } else {
    await sharedHeader.getByRole('button', { name: /Phù hợp với bạn/ }).click();
  }
  await expect(page).toHaveURL(/\/candidate\/jobs$/);
  await expect(page.getByText('Việc phù hợp với bạn', { exact: true })).toBeVisible();
  await page.getByText('Tất cả việc làm', { exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/jobs\?tab=all$/);
  await expect(page.getByRole('button', { name: /Bộ lọc nâng cao/ })).toBeVisible();
  await page.getByRole('button', { name: /Bộ lọc nâng cao/ }).click();
  const jobsBrandX = (await brandLink.boundingBox())?.x;
  expect(Math.abs((jobsBrandX ?? 0) - (initialBrandX ?? 0))).toBeLessThan(1);
  await expect(page.getByLabel('Số năm kinh nghiệm tối thiểu')).toBeVisible();
  await expect(page.getByLabel('Mức lương tối thiểu')).toBeVisible();
  await expect(page.getByLabel('Mức lương tối đa')).toBeVisible();

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
    await sharedHeader.getByRole('button', { name: 'Menu điều hướng' }).click();
    await expect(page.getByRole('button', { name: /Phù hợp với bạn/ })).toBeVisible();
  } else {
    await expect(sharedHeader.getByRole('button', { name: /Phù hợp với bạn/ })).toBeVisible();
  }
  await expect(page.getByText('Quản lý tìm việc')).toHaveCount(0);

  if (!isCompact) {
    await page.getByRole('button', { name: 'Tài khoản ứng viên' }).click();
  }
  await page.getByText('Đăng xuất', { exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Khám phá .* cơ hội nghề nghiệp/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
});
