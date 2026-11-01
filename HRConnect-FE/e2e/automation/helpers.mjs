import fs from 'fs';
import path from 'path';

export const results = [];

const evidenceDir = path.resolve('test-evidence', `run-${new Date().toISOString().slice(0, 10)}`);
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

/**
 * Cài đặt con trỏ chuột ảo (Virtual Cursor) & thanh thông báo (Step Banner)
 * Giúp người dùng quan sát trực quan từng cử chỉ chuột và bước kiểm thử.
 */
export async function installVisualHelpers(context) {
  await context.addInitScript(() => {
    function injectUI() {
      if (document.getElementById('playwright-virtual-cursor')) return;

      // 1. Trỏ chuột ảo trực quan
      const cursor = document.createElement('div');
      cursor.id = 'playwright-virtual-cursor';
      Object.assign(cursor.style, {
        position: 'fixed',
        top: '-100px',
        left: '-100px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.9)', // Đỏ nổi bật
        border: '2.5px solid #ffffff',
        boxShadow: '0 0 12px rgba(239, 68, 68, 0.8), 0 2px 8px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 0.12s ease-out, background-color 0.15s ease'
      });

      // Vòng tròn tỏa sóng quanh con trỏ
      const pulseRing = document.createElement('div');
      pulseRing.id = 'playwright-cursor-pulse';
      Object.assign(pulseRing.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '2px solid rgba(239, 68, 68, 0.5)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      });
      cursor.appendChild(pulseRing);

      // 2. Thanh hiển thị bước test trực quan trên đầu màn hình
      const banner = document.createElement('div');
      banner.id = 'playwright-step-banner';
      Object.assign(banner.style, {
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        color: '#ffffff',
        padding: '10px 24px',
        borderRadius: '9999px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        letterSpacing: '0.2px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(8px)',
        zIndex: '2147483646',
        pointerEvents: 'none',
        display: 'none',
        alignItems: 'center',
        gap: '10px',
        whiteSpace: 'nowrap',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      });

      document.documentElement.appendChild(cursor);
      document.documentElement.appendChild(banner);

      // Cập nhật vị trí trỏ chuột theo sự kiện di chuột
      window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });

      // Hiệu ứng khi bấm chuột
      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
        cursor.style.backgroundColor = 'rgba(249, 115, 22, 0.95)'; // Cam khi click
        pulseRing.style.border = '3px solid rgba(249, 115, 22, 0.8)';
      });

      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
        pulseRing.style.border = '2px solid rgba(239, 68, 68, 0.5)';
      });

      window.__setTestBanner = (text) => {
        if (!text) {
          banner.style.display = 'none';
        } else {
          banner.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981"></span> <span>${text}</span>`;
          banner.style.display = 'flex';
        }
      };
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectUI);
    } else {
      injectUI();
    }
  });
}

/**
 * Cập nhật thông điệp hiển thị trên đầu màn hình trình duyệt
 */
export async function setBanner(page, text) {
  try {
    await page.evaluate((msg) => {
      if (window.__setTestBanner) {
        window.__setTestBanner(msg);
      }
    }, text);
  } catch (err) {
    // Không gián đoạn nếu trang đang reload
  }
}

/**
 * Di chuyển trỏ chuột mượt mà tới vị trí phần tử
 */
export async function visualMove(page, locator) {
  const element = typeof locator === 'string' ? page.locator(locator) : locator;
  await element.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const box = await element.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 15 });
  }
}

/**
 * Thao tác trỏ chuột: Di chuyển tới phần tử và Click kèm hiệu ứng trực quan
 */
export async function visualClick(page, locator, stepNote = '') {
  if (stepNote) {
    await setBanner(page, stepNote);
    console.log(`👉 [CLICK] ${stepNote}`);
  }
  const element = typeof locator === 'string' ? page.locator(locator) : locator;
  await element.waitFor({ state: 'visible', timeout: 10000 });
  await element.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);

  const box = await element.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 16 });
    await page.waitForTimeout(300);
  }

  await element.click();
  await page.waitForTimeout(600);
}

/**
 * Thao tác trỏ chuột: Di chuyển tới ô nhập liệu, click và gõ từng phím
 */
export async function visualFill(page, locator, text, stepNote = '') {
  if (stepNote) {
    await setBanner(page, stepNote);
    console.log(`✍️ [TYPE] ${stepNote}`);
  }
  const element = typeof locator === 'string' ? page.locator(locator) : locator;
  await element.waitFor({ state: 'visible', timeout: 10000 });
  await element.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);

  const box = await element.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 14 });
    await page.waitForTimeout(250);
  }

  await element.click();
  await page.waitForTimeout(200);
  await element.fill('');
  if (text) {
    await element.pressSequentially(text, { delay: 35 });
  }
  await page.waitForTimeout(400);
}

/**
 * Thao tác trỏ chuột: Di chuyển tới phần tử để Hover (hiện Tooltip/Menu)
 */
export async function visualHover(page, locator, stepNote = '') {
  if (stepNote) {
    await setBanner(page, stepNote);
    console.log(`🔍 [HOVER] ${stepNote}`);
  }
  const element = typeof locator === 'string' ? page.locator(locator) : locator;
  await element.waitFor({ state: 'visible', timeout: 10000 });
  await element.scrollIntoViewIfNeeded().catch(() => {});

  const box = await element.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 16 });
  }

  await element.hover();
  await page.waitForTimeout(1000);
}

export async function login(page, baseUrl, email, password) {
  console.log(`\n🔑 [AUTH] Đăng nhập: ${email}...`);
  await setBanner(page, `🔑 [Đăng nhập] Đi tới trang đăng nhập...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Nếu đang lưu phiên đăng nhập cũ, đăng xuất trước
  if (page.url().includes('/dashboard') || page.url().includes('/admin') || page.url().includes('/client') || page.url().includes('/hr')) {
    await logout(page, baseUrl);
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  }

  const emailInput = page.getByPlaceholder('ten@email.com');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await visualFill(page, emailInput, email, `Nhập tài khoản: ${email}`);

  const pwdInput = page.getByPlaceholder('Nhập mật khẩu');
  await visualFill(page, pwdInput, password, `Nhập mật khẩu kiểm thử`);

  const submitBtn = page.locator('form button[type="submit"]');
  await visualClick(page, submitBtn, `Bấm nút "Đăng nhập"`);

  // Chờ chuyển hướng sau khi đăng nhập
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  await setBanner(page, `✅ Đăng nhập thành công! Đang chuyển vào: ${page.url()}`);
  console.log(`✅ [AUTH] Đã vào: ${page.url()}`);
}

export async function logout(page, baseUrl) {
  try {
    console.log(`🚪 [AUTH] Đang đăng xuất...`);
    await setBanner(page, `🚪 [Đăng xuất] Kết thúc phiên làm việc...`);
    const userDropdown = page.locator('header .ant-dropdown-trigger, header button, header [aria-haspopup="true"]').last();
    if (await userDropdown.isVisible({ timeout: 2000 })) {
      await visualClick(page, userDropdown, `Mở menu người dùng`);
      await page.waitForTimeout(500);
      const logoutItem = page.locator('.ant-dropdown-menu-item, [role="menuitem"]').filter({ hasText: /Đăng xuất|Logout/i }).first();
      if (await logoutItem.isVisible({ timeout: 2000 })) {
        await visualClick(page, logoutItem, `Chọn Đăng xuất`);
        await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});
        return;
      }
    }
  } catch (err) {
    // Bỏ qua lỗi menu, xóa session
  }

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${baseUrl}/login`);
  await page.waitForTimeout(1000);
}

export async function captureScreenshot(page, caseId, name = 'evidence') {
  try {
    const file = path.join(evidenceDir, `${caseId}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (err) {
    return null;
  }
}

export function recordResult({ id, role, screen, step, expected, status, note = '' }) {
  const icon = status === 'Đạt' ? '🟢' : status === 'Lỗi' ? '🔴' : '🟡';
  console.log(`${icon} [${id}] [${status.toUpperCase()}] - ${step} -> ${status}${note ? ' (' + note + ')' : ''}`);
  results.push({ id, role, screen, step, expected, status, note, timestamp: new Date().toLocaleTimeString() });
}

export function printSummaryTable() {
  console.log('\n' + '='.repeat(85));
  console.log('📊 BÁO CÁO TỔNG HỢP KIỂM THỬ GIAO DIỆN TỰ ĐỘNG (PLAYWRIGHT)');
  console.log('='.repeat(85));
  console.log('| Mã    | Vai trò       | Bước test                               | Kết quả |');
  console.log('|-------|---------------|-----------------------------------------|---------|');
  for (const r of results) {
    const padId = r.id.padEnd(5);
    const padRole = r.role.padEnd(13);
    const shortStep = (r.step.length > 39 ? r.step.slice(0, 36) + '...' : r.step).padEnd(39);
    const padStatus = r.status.padEnd(7);
    console.log(`| ${padId} | ${padRole} | ${shortStep} | ${padStatus} |`);
  }
  console.log('='.repeat(85));

  const total = results.length;
  const pass = results.filter((r) => r.status === 'Đạt').length;
  const fail = results.filter((r) => r.status === 'Lỗi').length;
  const skip = results.filter((r) => r.status === 'Bỏ qua').length;
  console.log(`Tổng số: ${total} ca | Đạt: ${pass} | Lỗi: ${fail} | Bỏ qua: ${skip}\n`);
}
