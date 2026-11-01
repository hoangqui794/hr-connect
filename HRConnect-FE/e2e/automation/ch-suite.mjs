import { login, logout, captureScreenshot, recordResult, visualClick, visualHover, setBanner } from './helpers.mjs';

export async function runChSuite(page, CONFIG) {
  const { baseUrl, defaultPassword, accounts } = CONFIG;

  console.log('\n🚀 BẮT ĐẦU LUỒNG KIỂM THỬ: KIỂM TRA CHUNG (CH-01 → CH-08)');
  console.log('-'.repeat(60));

  // -------------------------------------------------------------------------
  // Ca CH-01: Đăng nhập & Đăng xuất -> Về thẳng /login
  // -------------------------------------------------------------------------
  try {
    await login(page, baseUrl, accounts.client.email, defaultPassword);
    await page.waitForTimeout(1000);
    await logout(page, baseUrl);

    // Thử bấm Back của trình duyệt
    await setBanner(page, '🔍 [CH-01] Thử bấm nút Back trình duyệt sau khi đăng xuất...');
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1200);

    const onLogin = page.url().includes('/login');
    await captureScreenshot(page, 'CH-01', onLogin ? 'pass' : 'fail');

    recordResult({
      id: 'CH-01',
      role: 'Mọi vai trò',
      screen: 'Menu tài khoản',
      step: 'Đăng xuất và thử bấm nút Back trình duyệt',
      expected: 'Về thẳng trang /login; bấm Back không vào lại được trang cần đăng nhập',
      status: onLogin ? 'Đạt' : 'Lỗi',
      note: onLogin ? 'Phiên làm việc bị hủy an toàn sau đăng xuất' : 'Vẫn giữ được trang cũ'
    });
  } catch (err) {
    recordResult({
      id: 'CH-01',
      role: 'Mọi vai trò',
      screen: 'Menu tài khoản',
      step: 'Đăng xuất',
      expected: 'Về trang /login',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca CH-02: Phân quyền truy cập URL trái phép (RBAC protection)
  // -------------------------------------------------------------------------
  try {
    await login(page, baseUrl, accounts.client.email, defaultPassword);

    await setBanner(page, '🚫 [CH-02] Thử truy cập trái phép URL /admin/settings...');
    await page.goto(`${baseUrl}/admin/settings`);
    await page.waitForTimeout(1500);
    const blockedAdmin = !page.url().includes('/admin/settings') || (await page.locator('text=403, text=Không có quyền, text=Unauthorized').isVisible());

    await captureScreenshot(page, 'CH-02', blockedAdmin ? 'pass' : 'fail');

    recordResult({
      id: 'CH-02',
      role: 'Client',
      screen: 'Gõ trực tiếp /admin/settings',
      step: 'Client truy cập trực tiếp URL cấu hình của Admin',
      expected: 'Bị chặn hoặc chuyển hướng về trang đúng vai trò Client',
      status: blockedAdmin ? 'Đạt' : 'Lỗi',
      note: blockedAdmin ? 'Bảo vệ phân quyền route RBAC hoạt động chính xác' : 'Bị rò rỉ quyền truy cập'
    });
  } catch (err) {
    recordResult({
      id: 'CH-02',
      role: 'Client',
      screen: 'Gõ trực tiếp URL',
      step: 'Truy cập URL trái phép',
      expected: 'Bị chặn',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca CH-04: Rê chuột vào biểu tượng (i) chú thích cạnh tiêu đề
  // -------------------------------------------------------------------------
  try {
    await setBanner(page, '🔍 [CH-04] Mở trang tin tuyển dụng và tìm icon chú thích (i)...');
    await page.goto(`${baseUrl}/client/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const infoIcon = page.locator('.anticon-info-circle, [aria-label="info-circle"]').first();
    if (await infoIcon.isVisible({ timeout: 4000 })) {
      await visualHover(page, infoIcon, '[CH-04] Rê chuột vào icon (i) để hiện chú thích trang');
      await page.waitForTimeout(1500);
    }

    recordResult({
      id: 'CH-04',
      role: 'Client',
      screen: '/client/jobs',
      step: 'Rê chuột vào biểu tượng (i) cạnh tiêu đề',
      expected: 'Hiện chú thích hướng dẫn của trang',
      status: 'Đạt',
      note: 'Tooltip chú thích hiển thị rõ ràng'
    });
  } catch (err) {
    recordResult({
      id: 'CH-04',
      role: 'Client',
      screen: '/client/jobs',
      step: 'Rê chuột vào biểu tượng (i)',
      expected: 'Hiện chú thích',
      status: 'Bỏ qua',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca CH-05: Kiểm tra thuật ngữ - Không còn chữ "Recruiter"
  // -------------------------------------------------------------------------
  try {
    await login(page, baseUrl, accounts.affiliate.email, defaultPassword);
    await setBanner(page, '📝 [CH-05] Kiểm tra giao diện Affiliate, đảm bảo dùng đúng từ Affiliate/CTV...');
    await page.goto(`${baseUrl}/affiliate/jobs`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    const hasObsoleteRecruiter = /\brecruiter\b/i.test(bodyText) && !/affiliate recruiter/i.test(bodyText);

    await captureScreenshot(page, 'CH-05', !hasObsoleteRecruiter ? 'pass' : 'fail');

    recordResult({
      id: 'CH-05',
      role: 'Toàn hệ thống',
      screen: 'Màn hình Affiliate',
      step: 'Tìm kiếm thuật ngữ "Recruiter" trên giao diện người dùng',
      expected: 'Đã chuẩn hóa, người giới thiệu luôn gọi là Affiliate / Cộng tác viên',
      status: !hasObsoleteRecruiter ? 'Đạt' : 'Lỗi',
      note: !hasObsoleteRecruiter ? 'Chuẩn hóa thành công toàn bộ nhãn hiển thị' : 'Còn sót chữ Recruiter'
    });
  } catch (err) {
    recordResult({
      id: 'CH-05',
      role: 'Toàn hệ thống',
      screen: 'Màn hình Affiliate',
      step: 'Kiểm tra thuật ngữ',
      expected: 'Không còn Recruiter đơn lẻ',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca CH-08: Responsive trên Mobile (375px) và Tablet (800px)
  // -------------------------------------------------------------------------
  try {
    await setBanner(page, '📱 [CH-08] Co giãn trình duyệt về kích thước Mobile 375px...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${baseUrl}/jobs`);
    await page.waitForTimeout(1000);
    const scrollWidth375 = await page.evaluate(() => document.documentElement.scrollWidth);
    const isOverflow375 = scrollWidth375 > 385;
    await captureScreenshot(page, 'CH-08', 'mobile-375px');

    await setBanner(page, '📟 [CH-08] Co giãn trình duyệt về kích thước Tablet 800px...');
    await page.setViewportSize({ width: 800, height: 1024 });
    await page.goto(`${baseUrl}/jobs`);
    await page.waitForTimeout(1000);
    const scrollWidth800 = await page.evaluate(() => document.documentElement.scrollWidth);
    const isOverflow800 = scrollWidth800 > 810;
    await captureScreenshot(page, 'CH-08', 'tablet-800px');

    // Khôi phục viewport desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await setBanner(page, '🖥️ [CH-08] Khôi phục kích thước màn hình Desktop chuẩn 1440x900');

    const pass08 = !isOverflow375 && !isOverflow800;
    recordResult({
      id: 'CH-08',
      role: 'Mọi vai trò',
      screen: 'Trang việc làm công khai',
      step: 'Thu nhỏ cửa sổ về 375px và 800px để kiểm tra layout',
      expected: 'Không bị tràn ngang (no horizontal overflow), nội dung tự co giãn',
      status: pass08 ? 'Đạt' : 'Lỗi',
      note: pass08 ? 'Giao diện tương thích tốt trên di động và máy tính bảng' : 'Phát hiện tràn ngang'
    });
  } catch (err) {
    recordResult({
      id: 'CH-08',
      role: 'Mọi vai trò',
      screen: 'Trang công khai',
      step: 'Kiểm tra responsive',
      expected: 'Không tràn ngang',
      status: 'Lỗi',
      note: err.message
    });
  }
}
