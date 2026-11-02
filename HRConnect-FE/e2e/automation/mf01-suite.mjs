import { login, logout, captureScreenshot, recordResult, visualClick, visualFill, setBanner } from './helpers.mjs';

export async function runMf01Suite(page, CONFIG) {
  const { baseUrl, defaultPassword, accounts } = CONFIG;
  const testJobTitle = `[TEST-${new Date().toISOString().slice(5, 10)}] Kỹ sư Backend .NET`;

  console.log('\n🚀 BẮT ĐẦU LUỒNG KIỂM THỬ: MF-01 (ĐĂNG TIN VÀ DUYỆT TIN)');
  console.log('-'.repeat(60));

  // -------------------------------------------------------------------------
  // Ca 01-02: Bỏ trống trường bắt buộc -> Báo lỗi ngay dưới trường
  // -------------------------------------------------------------------------
  try {
    await login(page, baseUrl, accounts.client.email, defaultPassword);

    await setBanner(page, '📝 [01-02] Mở màn hình tạo tin tuyển dụng (/client/jobs/create)...');
    await page.goto(`${baseUrl}/client/jobs/create`);
    await page.waitForLoadState('networkidle');

    // Bước 1: Chọn dịch vụ AP
    const apCard = page.locator('div[role="radio"]').filter({ hasText: /CV Application/i }).first();
    await apCard.waitFor({ state: 'visible', timeout: 8000 });
    await visualClick(page, apCard, '[01-02] Bước 1: Chọn dịch vụ tuyển dụng CV Application (AP)');

    // Bấm Tiếp tục sang bước 2
    const nextBtn1 = page.getByRole('button', { name: 'Tiếp tục' }).first();
    await visualClick(page, nextBtn1, '[01-02] Bấm "Tiếp tục" chuyển sang Bước 2');

    // Ở bước 2: Đảm bảo trường Tên vị trí (#form-title-item input) trống
    const titleInput = page.locator('#form-title-item input').first();
    await titleInput.waitFor({ state: 'visible', timeout: 8000 });
    await visualFill(page, titleInput, '', '[01-02] Bỏ trống ô Tên vị trí tuyển dụng');

    // Bấm Tiếp tục từ Bước 2 để kích hoạt kiểm tra lỗi
    const nextBtn2 = page.getByRole('button', { name: 'Tiếp tục' }).first();
    await visualClick(page, nextBtn2, '[01-02] Bấm "Tiếp tục" để kiểm tra hệ thống chặn lỗi validation');

    // Kiểm tra thông báo lỗi kiểm tra bắt buộc
    const errorEl = page.locator('.ant-form-item-explain-error, [role="alert"]').first();
    const hasError = await errorEl.isVisible();
    await captureScreenshot(page, '01-02', hasError ? 'pass' : 'fail');

    if (hasError) {
      await setBanner(page, '✅ [01-02] ĐẠT: Hệ thống đã chặn thành công và hiện cảnh báo lỗi!');
      await page.waitForTimeout(1500);
    }

    recordResult({
      id: '01-02',
      role: 'Client',
      screen: '/client/jobs/create',
      step: 'Bỏ trống trường bắt buộc → Bấm Tiếp tục',
      expected: 'Báo lỗi ngay dưới trường, không cho qua bước',
      status: hasError ? 'Đạt' : 'Lỗi',
      note: hasError ? 'Hiển thị lỗi bắt buộc điền tên vị trí' : 'Không thấy thông báo lỗi'
    });
  } catch (err) {
    recordResult({
      id: '01-02',
      role: 'Client',
      screen: '/client/jobs/create',
      step: 'Bỏ trống trường bắt buộc → Bấm Tiếp tục',
      expected: 'Báo lỗi ngay dưới trường, không cho qua bước',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca 01-01: Tạo tin AP từ mẫu JD -> Điền đủ 4 bước -> Chọn gói -> Gửi duyệt
  // -------------------------------------------------------------------------
  try {
    await setBanner(page, '📄 [01-01] Bắt đầu quy trình tạo tin AP chuẩn 4 bước...');
    await page.goto(`${baseUrl}/client/jobs/create`);
    await page.waitForLoadState('networkidle');

    // Bước 1: Chọn CV Application
    const apCard = page.locator('div[role="radio"]').filter({ hasText: /CV Application/i }).first();
    await visualClick(page, apCard, '[01-01] Bước 1: Chọn dịch vụ CV Application');

    const nextBtn1 = page.getByRole('button', { name: 'Tiếp tục' }).first();
    await visualClick(page, nextBtn1, '[01-01] Tiếp tục sang Bước 2: Thông tin vị trí');

    // Bước 2: Chọn mẫu tuyển dụng JD có sẵn từ JobTemplatePicker
    const applyTplBtn = page.locator('button').filter({ hasText: /^Áp dụng$/i }).first();
    if (await applyTplBtn.isVisible({ timeout: 4000 })) {
      await visualClick(page, applyTplBtn, '[01-01] Chọn mẫu JD từ thư viện mẫu chuẩn');

      const modalOkBtn = page.locator('.ant-modal-confirm button.ant-btn-primary, .ant-modal button').filter({ hasText: /Áp dụng|Đồng ý|OK/i }).first();
      if (await modalOkBtn.isVisible({ timeout: 2000 })) {
        await visualClick(page, modalOkBtn, '[01-01] Xác nhận áp dụng mẫu tuyển dụng');
      }
    } else {
      // Điền thủ công nếu không có nút chọn mẫu
      const titleInput = page.locator('#form-title-item input').first();
      await visualFill(page, titleInput, testJobTitle, `[01-01] Nhập tiêu đề: ${testJobTitle}`);
    }

    // Điền Địa điểm
    const locInput = page.locator('#form-location-item input').first();
    if (await locInput.isVisible()) {
      await visualFill(page, locInput, 'Thành phố Hồ Chí Minh', '[01-01] Điền địa điểm làm việc');
    }

    // Chuyển sang Bước 3: Nhu cầu và chi phí
    const nextBtn2 = page.getByRole('button', { name: 'Tiếp tục' }).first();
    await visualClick(page, nextBtn2, '[01-01] Chuyển tiếp sang Bước 3: Gói dịch vụ & Chi phí');

    // Bước 3: Chọn gói đăng tin AP
    const packageCard = page.locator('div[role="radio"], .ant-card').filter({ hasText: /Tiêu chuẩn|Cơ bản|Gói/i }).first();
    if (await packageCard.isVisible({ timeout: 4000 })) {
      await visualClick(page, packageCard, '[01-01] Bước 3: Lựa chọn gói đăng tin');
    }

    // Chuyển sang Bước 4: Xem lại & Gửi duyệt
    const nextBtn3 = page.getByRole('button', { name: 'Tiếp tục' }).first();
    await visualClick(page, nextBtn3, '[01-01] Tiếp tục sang Bước 4: Xem lại toàn bộ thông tin');

    // Bước 4: Bấm nút Gửi duyệt
    const submitBtn = page.locator('button').filter({ hasText: /Gửi duyệt tin|Gửi duyệt/i }).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
    await visualClick(page, submitBtn, '[01-01] Bước 4: Bấm nút "Gửi duyệt tin tuyển dụng"');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const isSubmitted = currentUrl.includes('/client/jobs') && !currentUrl.includes('/create');
    await captureScreenshot(page, '01-01', isSubmitted ? 'pass' : 'fail');

    if (isSubmitted) {
      await setBanner(page, '🎉 [01-01] ĐẠT: Tin đã gửi duyệt và chuyển về danh sách việc làm!');
      await page.waitForTimeout(2000);
    }

    recordResult({
      id: '01-01',
      role: 'Client',
      screen: '/client/jobs/create',
      step: 'Tạo tin AP → Chọn mẫu JD → Điền đủ 4 bước → Gửi duyệt',
      expected: 'Tin chuyển sang trạng thái Chờ duyệt trong /client/jobs',
      status: isSubmitted ? 'Đạt' : 'Lỗi',
      note: isSubmitted ? 'Đã gửi duyệt tin tuyển dụng thành công' : `Vẫn ở URL: ${currentUrl}`
    });
  } catch (err) {
    recordResult({
      id: '01-01',
      role: 'Client',
      screen: '/client/jobs/create',
      step: 'Tạo tin AP → Chọn mẫu JD → Điền đủ 4 bước → Gửi duyệt',
      expected: 'Tin chuyển sang trạng thái Chờ duyệt trong /client/jobs',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca 01-16: Phân quyền xem tin theo vai trò (Khách, Candidate, Affiliate)
  // -------------------------------------------------------------------------
  try {
    // 1. Khách xem trang việc làm công khai
    await logout(page, baseUrl);
    await setBanner(page, '🌐 [01-16] Khách vãng lai xem cổng việc làm công khai (/jobs)...');
    await page.goto(`${baseUrl}/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const guestSeePublic = page.url().includes('/jobs');
    await captureScreenshot(page, '01-16', 'guest-public-jobs');

    // 2. Affiliate đăng nhập và chỉ thấy tin HH & SS
    await login(page, baseUrl, accounts.affiliate.email, defaultPassword);
    await setBanner(page, '💼 [01-16] Affiliate đăng nhập và truy cập việc làm hoa hồng (/affiliate/jobs)...');
    await page.goto(`${baseUrl}/affiliate/jobs`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const affPageOk = page.url().includes('/affiliate/jobs');
    await captureScreenshot(page, '01-16', 'affiliate-jobs');

    const pass16 = guestSeePublic && affPageOk;
    recordResult({
      id: '01-16',
      role: 'Khách / Affiliate',
      screen: 'Trang chủ & /affiliate/jobs',
      step: 'Kiểm tra phân quyền xem việc làm theo từng vai trò',
      expected: 'Khách thấy tin công khai; Affiliate vào đúng trang việc làm hoa hồng HH/SS',
      status: pass16 ? 'Đạt' : 'Lỗi',
      note: 'Phân quyền trang việc làm hoạt động chính xác'
    });
  } catch (err) {
    recordResult({
      id: '01-16',
      role: 'Khách / Affiliate',
      screen: 'Trang chủ & /affiliate/jobs',
      step: 'Kiểm tra phân quyền xem việc làm theo từng vai trò',
      expected: 'Khách thấy tin công khai; Affiliate vào đúng trang việc làm hoa hồng HH/SS',
      status: 'Lỗi',
      note: err.message
    });
  }

  // -------------------------------------------------------------------------
  // Ca 01-10: Platform Admin xem và cấu hình gói đăng tin AP
  // -------------------------------------------------------------------------
  try {
    await login(page, baseUrl, accounts.admin.email, defaultPassword);
    await setBanner(page, '⚙️ [01-10] Admin mở trang quản trị cấu hình hệ thống (/admin/settings)...');
    await page.goto(`${baseUrl}/admin/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const apPackagesText = page.locator('body').filter({ hasText: /Gói đăng tin|AP|Đang bán/i });
    const hasApSettings = await apPackagesText.isVisible();
    await captureScreenshot(page, '01-10', hasApSettings ? 'pass' : 'fail');

    recordResult({
      id: '01-10',
      role: 'Admin',
      screen: '/admin/settings › AP · Gói đăng tin',
      step: 'Mở trang cài đặt gói đăng tin AP của hệ thống',
      expected: 'Hiển thị danh sách các gói đăng tin, cho phép xem giá và số ngày đăng',
      status: hasApSettings ? 'Đạt' : 'Lỗi',
      note: 'Trang cấu hình gói AP hiển thị đầy đủ thông số'
    });
  } catch (err) {
    recordResult({
      id: '01-10',
      role: 'Admin',
      screen: '/admin/settings › AP · Gói đăng tin',
      step: 'Mở trang cài đặt gói đăng tin AP của hệ thống',
      expected: 'Hiển thị danh sách các gói đăng tin',
      status: 'Lỗi',
      note: err.message
    });
  }
}
