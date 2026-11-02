import { chromium } from '../../node_modules/@playwright/test/index.mjs';
import { CONFIG } from './config.mjs';
import { printSummaryTable, installVisualHelpers } from './helpers.mjs';
import { runMf01Suite } from './mf01-suite.mjs';
import { runChSuite } from './ch-suite.mjs';
import { runBatch2Suite } from './batch2-suite.mjs';

const targetSuite = process.argv.find((a) => a.startsWith('--suite='))?.split('=')[1] || 'all';

console.log('='.repeat(70));
console.log('🌟 HR CONNECT - TRÌNH ĐIỀU KHIỂN KIỂM THỬ GIAO DIỆN TỰ ĐỘNG (LIVE)');
console.log(`🌐 Base URL: ${CONFIG.baseUrl}`);
console.log(`🖥️  Chế độ: ${CONFIG.headless ? 'HEADLESS (Ẩn)' : 'HEADED (Mở trực tiếp trên màn hình)'}`);
console.log(`⏱️  Tốc độ mô phỏng (slowMo): ${CONFIG.slowMo}ms`);
console.log(`📂 Luồng chỉ định: ${targetSuite.toUpperCase()}`);
console.log('='.repeat(70));

let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    args: ['--start-maximized', '--no-sandbox', '--disable-dev-shm-usage']
  });
} catch (err) {
  console.log('ℹ️ Không tìm thấy kênh Chrome mặc định, chuyển sang Chromium tích hợp...');
  browser = await chromium.launch({
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    args: ['--start-maximized', '--no-sandbox', '--disable-dev-shm-usage']
  });
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});

// Cài đặt con trỏ chuột ảo và banner hiển thị từng bước cho người xem
await installVisualHelpers(context);

const page = await context.newPage();

try {
  if (targetSuite === 'all' || targetSuite === 'mf01') {
    await runMf01Suite(page, CONFIG);
  }

  if (targetSuite === 'all' || targetSuite === 'ch') {
    await runChSuite(page, CONFIG);
  }

  if (targetSuite === 'all' || targetSuite === 'batch2') {
    await runBatch2Suite(page, CONFIG);
  }
} catch (error) {
  console.error('\n❌ Có lỗi không mong muốn trong quá trình thực thi:', error);
} finally {
  printSummaryTable();
  console.log('🎉 Hoàn tất ca kiểm thử. Trình duyệt sẽ đóng sau 5 giây...');
  await page.waitForTimeout(5000);
  await browser.close();
}
