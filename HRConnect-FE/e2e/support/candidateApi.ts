import type { Page } from '@playwright/test';

const candidate = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'candidate@gmail.com',
  displayName: 'Candidate E2E',
  phone: '0900000001',
  status: 'ACTIVE',
  emailVerified: true,
  roles: ['CANDIDATE'],
  permissions: [
    'application.create',
    'application.view_own',
    'candidate.cv.view_own',
    'candidate.cv.upload_own',
    'candidate.cv.update_own',
    'candidate.cv.delete_own',
    'candidate.identity.manage_own',
  ],
};

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

export async function mockCandidateApis(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill(
      json({
        success: true,
        message: 'Đăng nhập thành công.',
        data: {
          accessToken: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
          tokenType: 'Bearer',
          expiresAt: '2099-01-01T00:00:00Z',
          accessTokenExpiresAt: '2099-01-01T00:00:00Z',
          refreshTokenExpiresAt: '2099-01-08T00:00:00Z',
          user: candidate,
        },
      })
    );
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill(json({ success: true, data: candidate }));
  });

  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill(json({ success: true, message: 'Đăng xuất thành công.' }));
  });

  // Các request nền của Navbar/trang chủ cũng phải dùng cùng phiên giả lập.
  // Nếu rơi về BE thật, token E2E sẽ nhận 401 và interceptor chủ động đăng xuất.
  await page.route('**/api/v1/notifications/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/unread-count')) {
      await route.fulfill(json({ success: true, data: { unreadCount: 0 } }));
      return;
    }
    await route.fulfill(json({ success: true, data: { items: [], total: 0 } }));
  });

  await page.route('**/api/v1/candidates/me/saved-jobs**', async (route) => {
    await route.fulfill(
      json({ success: true, data: { items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 } })
    );
  });

  await page.route('**/api/v1/candidates/me/job-matches**', async (route) => {
    await route.fulfill(
      json({ success: true, data: { items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 } })
    );
  });

  await page.route('**/api/v1/candidates/applications**', async (route) => {
    await route.fulfill(
      json({
        success: true,
        data: {
          items: [{
            applicationId: '60000000-0000-0000-0000-000000000001',
            jobId: '20000000-0000-0000-0000-000000000001',
            jobTitle: '[E2E] Backend Developer',
            companyName: 'HR Connect Demo',
            cvId: '40000000-0000-0000-0000-000000000001',
            cvTitle: 'CV Backend',
            displayGroup: 'OFFER',
            displayLabel: 'Đang chuẩn bị offer',
            aiStatus: 'COMPLETED',
            submissionSource: 'CANDIDATE',
            appliedAt: '2026-10-17T13:20:00Z',
          }],
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
        },
      })
    );
  });

  await page.route('**/api/v1/candidates/me/submission-consents**', async (route) => {
    if (/\/submission-consents\/[0-9a-f-]+/i.test(new URL(route.request().url()).pathname)) {
      await route.fallback();
      return;
    }
    await route.fulfill(
      json({
        success: true,
        data: {
          items: [{
            submissionId: '10000000-0000-0000-0000-000000000001',
            consentStatus: 'PENDING',
            submissionStatus: 'PENDING_CONSENT',
            jobId: '20000000-0000-0000-0000-000000000001',
            jobTitle: 'Backend Developer',
            companyId: '30000000-0000-0000-0000-000000000001',
            companyName: 'HR Connect Demo',
            cvId: '40000000-0000-0000-0000-000000000001',
            cvTitle: 'CV Backend',
            cvFileName: 'cv-backend.pdf',
            affiliateUserId: '50000000-0000-0000-0000-000000000001',
            affiliateDisplayName: 'Affiliate Demo',
            requestedAt: '2026-10-12T01:00:00Z',
            expiresAt: '2099-01-01T00:00:00Z',
            respondedAt: null,
            isActionable: true,
            remainingSeconds: 999999,
          }],
          page: 1,
          pageSize: 5,
          total: 1,
          totalPages: 1,
        },
      })
    );
  });

  await page.route('**/api/v1/candidates/cv', async (route) => {
    await route.fulfill(json({ success: true, data: [] }));
  });

  await page.route('**/api/v1/candidates/profile/me', async (route) => {
    await route.fulfill(
      json({
        success: true,
        data: {
          candidateId: candidate.userId,
          userId: candidate.userId,
          fullName: candidate.displayName,
          email: candidate.email,
          phone: candidate.phone,
          status: 'ACTIVE',
        },
      })
    );
  });

  await page.route('**/api/v1/service-types**', async (route) => {
    await route.fulfill(json({ success: true, data: { items: [] } }));
  });

  await page.route('**/api/v1/jobs**', async (route) => {
    await route.fulfill(
      json({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 })
    );
  });
}
