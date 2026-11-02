import { chromium } from '../../node_modules/@playwright/test/index.mjs';
import { CONFIG } from './config.mjs';
import { exec } from 'child_process';
import path from 'path';

const baseUrl = CONFIG.baseUrl || 'https://hr-connect-iota.vercel.app';
const email = CONFIG.accounts.client.email || 'client@gmail.com';
const password = CONFIG.defaultPassword || '111111Aa@';
const forceFocusScript = path.resolve('e2e/automation/force-focus.ps1');

function forceBringToFront() {
  exec(`powershell -ExecutionPolicy Bypass -File "${forceFocusScript}"`);
}

console.log('='.repeat(70));
console.log('🌟 HR CONNECT - ĐIỀU KHIỂN TRÌNH DUYỆT TRỰC TIẾP TRÊN MÀN HÌNH');
console.log(`🌐 URL: ${baseUrl}`);
console.log(`👤 Tài khoản: ${email}`);
console.log('='.repeat(70));

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempProfileDir = path.resolve('.temp-chrome-profile');

let context;
try {
  context = await chromium.launchPersistentContext(tempProfileDir, {
    executablePath: chromePath,
    headless: false,
    slowMo: 600,
    viewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-position=0,0'
    ]
  });
} catch (e) {
  console.log('⚠️ Dùng Chromium mặc định của Playwright...');
  context = await chromium.launchPersistentContext(tempProfileDir, {
    headless: false,
    slowMo: 600,
    viewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-position=0,0'
    ]
  });
}

// Cài đặt con trỏ chuột ảo SVG mũi tên đỏ và Banner hướng dẫn trực quan
await context.addInitScript(() => {
  function injectCursorAndBanner() {
    if (document.getElementById('live-agent-cursor')) return;

    // 1. Con trỏ chuột mũi tên SVG đỏ rực rỡ, kèm nhãn "Bot đang thao tác"
    const cursor = document.createElement('div');
    cursor.id = 'live-agent-cursor';
    cursor.innerHTML = `
      <div style="position:relative; pointer-events:none;">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 3px 8px rgba(0,0,0,0.8));">
          <path d="M3 2L10 21L13.5 13.5L21 10L3 2Z" fill="#DC2626" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>
        <div style="
          position: absolute;
          left: 28px;
          top: 18px;
          background: #0F172A;
          color: #F8FAFC;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 8px;
          border: 2px solid #38BDF8;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        ">🖱️ Antigravity Bot</div>
      </div>
    `;
    Object.assign(cursor.style, {
      position: 'fixed',
      top: '-100px',
      left: '-100px',
      pointerEvents: 'none',
      zIndex: '2147483647',
      transition: 'transform 0.08s ease-out'
    });

    // 2. Banner trạng thái hiển thị từng bước kiểm thử trên đầu trang
    const banner = document.createElement('div');
    banner.id = 'live-step-banner';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#0F172A',
      color: '#FFFFFF',
      padding: '12px 32px',
      borderRadius: '9999px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '15px',
      fontWeight: '700',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.6)',
      border: '2px solid #38BDF8',
      zIndex: '2147483646',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      whiteSpace: 'nowrap'
    });
    banner.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22C55E;box-shadow:0 0 10px #22C55E"></span>
      <span id="live-banner-text">Đang kết nối vào hệ thống HR Connect...</span>
    `;

    document.documentElement.appendChild(cursor);
    document.documentElement.appendChild(banner);

    // Bắt tọa độ chuột để di chuyển con trỏ ảo mượt mà
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });

    // Hiệu ứng sóng lan tỏa đỏ khi click chuột
    window.addEventListener('mousedown', (e) => {
      cursor.style.transform = 'scale(0.85)';
      const ripple = document.createElement('div');
      Object.assign(ripple.style, {
        position: 'fixed',
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        border: '3px solid #DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.4)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: '2147483645',
        transition: 'all 0.4s ease-out'
      });
      document.body.appendChild(ripple);
      requestAnimationFrame(() => {
        ripple.style.width = '70px';
        ripple.style.height = '70px';
        ripple.style.opacity = '0';
      });
      setTimeout(() => ripple.remove(), 450);
    });

    window.addEventListener('mouseup', () => {
      cursor.style.transform = 'scale(1)';
    });

    window.__setLiveBanner = (text) => {
      const textEl = document.getElementById('live-banner-text');
      if (textEl) textEl.textContent = text;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCursorAndBanner);
  } else {
    injectCursorAndBanner();
  }
});

const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

async function showBanner(text) {
  console.log(`\n📢 ${text}`);
  await page.evaluate((msg) => window.__setLiveBanner && window.__setLiveBanner(msg), text);
  await page.waitForTimeout(600);
}

async function moveToElement(locator) {
  const el = typeof locator === 'string' ? page.locator(locator) : locator;
  await el.waitFor({ state: 'visible', timeout: 12000 });
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(250);

  await el.evaluate((node) => {
    node.style.outline = '3px solid #F59E0B';
    node.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.9)';
    node.style.transition = 'all 0.25s ease';
  }).catch(() => {});

  const box = await el.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 30 });
    await page.waitForTimeout(400);
  }
}

async function liveClick(locator, stepText = '') {
  if (stepText) await showBanner(stepText);
  const el = typeof locator === 'string' ? page.locator(locator) : locator;
  await moveToElement(el);
  await page.waitForTimeout(400);
  await el.click();

  await el.evaluate((node) => {
    node.style.outline = '';
    node.style.boxShadow = '';
  }).catch(() => {});
  await page.waitForTimeout(900);
}

async function liveType(locator, text, stepText = '') {
  if (stepText) await showBanner(stepText);
  const el = typeof locator === 'string' ? page.locator(locator) : locator;
  await moveToElement(el);
  await page.waitForTimeout(300);
  await el.click();
  await el.fill('');
  if (text) {
    await el.pressSequentially(text, { delay: 60 });
  }

  await el.evaluate((node) => {
    node.style.outline = '';
    node.style.boxShadow = '';
  }).catch(() => {});
  await page.waitForTimeout(700);
}

try {
  // =========================================================================
  // BƯỚC 1: MỞ TRÌNH DUYỆT VÀ ÉP NỔI LÊN MÀN HÌNH NGAY LẬP TỨC
  // =========================================================================
  console.log('🚀 Mở Google Chrome trên màn hình...');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.bringToFront();
  forceBringToFront();

  await showBanner('🔔 [BẮT ĐẦU TEST TRỰC TIẾP] Trình duyệt đang mở trực tiếp trên màn hình của bạn!');
  await page.waitForTimeout(2500);

  // Xóa session cũ
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  forceBringToFront();
  await page.waitForTimeout(1200);

  const emailInput = page.getByPlaceholder('ten@email.com');
  await liveType(emailInput, email, `✍️ [BƯỚC 1] Con trỏ di chuyển vào ô Email và nhập: ${email}`);

  const pwdInput = page.getByPlaceholder('Nhập mật khẩu');
  await liveType(pwdInput, password, '✍️ [BƯỚC 1] Con trỏ di chuyển vào ô Mật khẩu và gõ mật khẩu kiểm thử');

  const submitBtn = page.locator('form button[type="submit"]');
  await liveClick(submitBtn, '👉 [BƯỚC 1] Con trỏ di chuyển tới nút "Đăng nhập" và click...');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  forceBringToFront();
  await showBanner(`✅ [BƯỚC 1] Đăng nhập thành công! Đang vào Dashboard Client...`);
  await page.waitForTimeout(1500);

  // =========================================================================
  // BƯỚC 2: KIỂM THỬ LUỒNG MF-01 (ĐĂNG TIN & KIỂM TRA BẮT LỖI FORM)
  // =========================================================================
  await showBanner('🚀 [BƯỚC 2] Mở màn hình Tạo tin tuyển dụng mới (/client/jobs/create)...');
  await page.goto(`${baseUrl}/client/jobs/create`);
  await page.waitForLoadState('networkidle');
  forceBringToFront();
  await page.waitForTimeout(1200);

  // Chọn dịch vụ AP
  const apCard = page.locator('div[role="radio"]').filter({ hasText: /CV Application/i }).first();
  await liveClick(apCard, '👉 [MF-01 · Bước 1] Con trỏ lướt tới chọn Dịch vụ: "CV Application (AP)"');

  const nextBtn1 = page.getByRole('button', { name: 'Tiếp tục' }).first();
  await liveClick(nextBtn1, '👉 [MF-01 · Bước 1] Con trỏ bấm "Tiếp tục" chuyển sang Bước 2 (Thông tin vị trí)');

  // Ca 01-02: Bỏ trống trường bắt buộc -> Bấm Tiếp tục -> Báo lỗi ngay dưới trường
  const nextBtn2 = page.getByRole('button', { name: 'Tiếp tục' }).first();
  await liveClick(nextBtn2, '⚠️ [Ca 01-02] Thử bấm "Tiếp tục" khi ĐỂ TRỐNG Tiêu đề để kiểm tra Bắt lỗi (Validation)...');

  // Rê chuột chỉ vào thông báo lỗi màu đỏ vừa xuất hiện
  const errorEl = page.locator('.ant-form-item-explain-error, [role="alert"]').first();
  if (await errorEl.isVisible({ timeout: 5000 })) {
    await moveToElement(errorEl);
    await showBanner('🎯 [Ca 01-02] ĐẠT: Hệ thống chặn thành công và con trỏ đang chỉ vào dòng cảnh báo lỗi đỏ!');
    await page.waitForTimeout(2500);
  }

  // Điền Tiêu đề tin
  const titleInput = page.locator('#form-title-item input').first();
  await liveType(titleInput, '[DEMO LIVE] Kỹ sư Backend .NET Core (Senior)', '✍️ [MF-01 · Bước 2] Con trỏ bấm vào ô Tiêu đề và gõ tên vị trí tuyển dụng');

  // Điền Địa điểm
  const locInput = page.locator('#form-location-item input').first();
  if (await locInput.isVisible({ timeout: 3000 })) {
    await liveType(locInput, 'Thành phố Hồ Chí Minh', '✍️ [MF-01 · Bước 2] Con trỏ nhập địa điểm làm việc');
  }

  // Chuyển sang Bước 3: Gói dịch vụ
  await liveClick(nextBtn2, '👉 [MF-01 · Bước 2] Bấm "Tiếp tục" chuyển sang Bước 3 (Gói dịch vụ & Chi phí)');

  // Xem các gói tin
  const packageCard = page.locator('div[role="radio"], .ant-card').filter({ hasText: /Tiêu chuẩn|Cơ bản|Gói/i }).first();
  if (await packageCard.isVisible({ timeout: 4000 })) {
    await liveClick(packageCard, '👉 [MF-01 · Bước 3] Con trỏ lướt tới chọn gói đăng tin phù hợp');
  }

  // =========================================================================
  // BƯỚC 3: KIỂM THỬ GIAO DIỆN THANH TOÁN & VNPAY (LUỒNG MF-05)
  // =========================================================================
  await showBanner('💳 [BƯỚC 3] Chuyển tới trang Công nợ & Thanh toán (/client/billing)...');
  await page.goto(`${baseUrl}/client/billing`);
  await page.waitForLoadState('networkidle');
  forceBringToFront();
  await page.waitForTimeout(1500);

  // Tìm nút Thanh toán nếu có
  const payBtn = page.locator('button').filter({ hasText: /Thanh toán/i }).first();
  if (await payBtn.isVisible({ timeout: 5000 })) {
    await liveClick(payBtn, '👉 [MF-05] Con trỏ bấm nút "Thanh toán" để mở chi tiết cổng thanh toán VNPay');
    await page.waitForTimeout(2000);

    // Xem mục chuyển khoản hoặc nút VNPay
    const vnpayBtn = page.locator('button, div').filter({ hasText: /VNPay|Chuyển khoản/i }).first();
    if (await vnpayBtn.isVisible({ timeout: 3000 })) {
      await moveToElement(vnpayBtn);
      await showBanner('🎯 [MF-05] Con trỏ đang trỏ tới phương thức thanh toán VNPay / Chuyển khoản ngân hàng');
      await page.waitForTimeout(3000);
    }
  }

  // =========================================================================
  // BƯỚC 4: HOÀN TẤT VÀ GIỮ NGUYÊN MÀN HÌNH TRONG 30 GIÂY
  // =========================================================================
  await showBanner('🎉 [HOÀN TẤT] Đã trình diễn toàn bộ thao tác trỏ chuột trực tiếp trước mắt bạn!');
  console.log('\n🎉 ĐÃ HOÀN TẤT DEMO. Giữ nguyên màn hình trong 30 giây để bạn quan sát...');
  await page.waitForTimeout(30000);

} catch (err) {
  console.error('\n❌ Có lỗi xảy ra trong quá trình demo:', err);
  await showBanner(`❌ Gặp lỗi: ${err.message}`);
  await page.waitForTimeout(10000);
} finally {
  await context.close();
  console.log('🏁 Trình duyệt đã đóng.');
}
