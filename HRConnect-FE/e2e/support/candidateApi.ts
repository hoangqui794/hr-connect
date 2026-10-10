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

  await page.route('**/api/v1/candidates/applications**', async (route) => {
    await route.fulfill(
      json({
        success: true,
        data: { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 },
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
}
