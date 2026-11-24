import { describe, expect, it } from 'vitest';
import { UserRole } from '@/types/roles';
import type { NotificationDto } from '@/types/api/notification';
import { getNotificationRoute, isOtherPortalRoute, portalRoute } from './notificationRoutes';

const JOB = '1b2c3d4e-0000-4000-8000-000000000001';

describe('routes meant for another role (server default per notification type)', () => {
  const agreementNotice = {
    notificationId: 'n-agreement',
    notificationType: 'JOB',
    title: 'Đề xuất thỏa thuận dịch vụ mới',
    message: "HR Connect đã gửi dự thảo thỏa thuận dịch vụ (v1) cho tin tuyển dụng 'Senior DevOps Engineer v1'. Vui lòng xem xét và phản hồi.",
    relatedEntityType: 'SERVICE_AGREEMENT',
    relatedEntityId: 'agreement-1',
    routeHint: `/hr/jobs?status=PENDING_AGREEMENT&highlight=${JOB}`,
    metadata: JSON.stringify({ jobId: JOB, agreementId: 'agreement-1', version: 1 }),
    isRead: false,
    createdAt: '2026-11-23T08:00:00Z',
  } as NotificationDto;

  it('sends a Client to its own agreements page instead of the HR jobs page', () => {
    expect(getNotificationRoute(agreementNotice, UserRole.CLIENT)).toBe(`/client/agreements?jobId=${JOB}`);
  });

  it('keeps the HR route for Internal HR', () => {
    expect(getNotificationRoute(agreementNotice, UserRole.INTERNAL_HR)).toBe(`/hr/jobs?status=PENDING_AGREEMENT&highlight=${JOB}`);
  });

  it('sends a Client to the warranty page instead of the HR warranty tracking', () => {
    const warranty = { ...agreementNotice, title: 'Cập nhật bảo hành', relatedEntityType: 'WARRANTY', routeHint: '/hr/warranty-tracking?highlight=w-1', metadata: null } as NotificationDto;
    expect(getNotificationRoute(warranty, UserRole.CLIENT)).toBe('/client/warranty');
  });

  it('still maps an old /admin/jobs hint to the HR job review for Internal HR', () => {
    const legacy = { ...agreementNotice, title: 'Tin tuyển dụng', relatedEntityType: 'JOB', routeHint: `/admin/jobs?status=ACTIVE&highlight=${JOB}` } as NotificationDto;
    expect(getNotificationRoute(legacy, UserRole.INTERNAL_HR)).toBe(`/hr/jobs?status=ACTIVE&highlight=${JOB}`);
  });

  it('detects routes of other workspaces only', () => {
    expect(isOtherPortalRoute('/hr/jobs?status=ACTIVE', UserRole.CLIENT)).toBe(true);
    expect(isOtherPortalRoute('/candidate/applications', UserRole.CLIENT)).toBe(true);
    expect(isOtherPortalRoute('/client/agreements', UserRole.CLIENT)).toBe(false);
    expect(isOtherPortalRoute(`/jobs/${JOB}`, UserRole.CLIENT)).toBe(false);
    expect(isOtherPortalRoute('/hr/jobs', UserRole.INTERNAL_HR)).toBe(false);
    expect(isOtherPortalRoute('/hr/jobs', UserRole.GUEST)).toBe(false);
    expect(isOtherPortalRoute('/hrconnect-news', UserRole.CLIENT)).toBe(false);
  });
});

describe('portalRoute', () => {
  it('keeps a signed-in client inside the client portal', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.CLIENT)).toBe(`/client/jobs?highlight=${JOB}&openDetail=true`);
  });

  it('sends candidates and affiliates to their own job detail pages', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.CANDIDATE)).toBe(`/candidate/jobs/${JOB}`);
    expect(portalRoute(`/jobs/${JOB}`, UserRole.AFFILIATE)).toBe(`/affiliate/jobs/${JOB}`);
  });

  it('sends Internal HR to HR jobs review and keeps Admin in Admin console', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.INTERNAL_HR)).toBe('/hr/jobs');
    expect(portalRoute(`/jobs/${JOB}`, UserRole.ADMIN)).toBe('/admin/dashboard');
    expect(portalRoute(`/hr/jobs?status=ACTIVE&highlight=${JOB}`, UserRole.INTERNAL_HR)).toBe(`/hr/jobs?status=ACTIVE&highlight=${JOB}`);
  });

  it('keeps the public page for guests and leaves other routes unchanged', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.GUEST)).toBe(`/jobs/${JOB}`);
    expect(portalRoute('/client/candidates', UserRole.CLIENT)).toBe('/client/candidates');
    expect(portalRoute('/candidate/jobs?tab=matches', UserRole.CANDIDATE)).toBe('/candidate/jobs?tab=matches');
  });
});

describe('getNotificationRoute for ADMIN', () => {
  it('routes VNPay payments and finance notifications to /admin/payouts', () => {
    const route = getNotificationRoute(
      {
        notificationId: 'n-vnpay',
        notificationType: 'FINANCE',
        title: 'Client đã thanh toán qua VNPay',
        message: 'Doanh nghiệp đã thanh toán 1,500,000 VND cho tin tuyển dụng.',
        relatedEntityType: 'ONLINE_PAYMENT',
        relatedEntityId: 'pay-1',
        routeHint: '/admin/payouts',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.ADMIN
    );
    expect(route).toBe('/admin/payouts');
  });

  it('routes account approvals, identity claims, disputes, and contact requests within Admin console', () => {
    expect(
      getNotificationRoute(
        {
          notificationId: 'n-appr',
          notificationType: 'APPROVAL',
          title: 'Doanh nghiệp đăng ký tài khoản mới cần phê duyệt',
          message: 'Vui lòng kiểm tra hồ sơ doanh nghiệp',
          relatedEntityType: 'ACCOUNT_APPROVAL',
          relatedEntityId: 'acc-1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        UserRole.ADMIN
      )
    ).toBe('/admin/approvals');

    expect(
      getNotificationRoute(
        {
          notificationId: 'n-claim',
          notificationType: 'SYSTEM',
          title: 'Phát hiện hồ sơ Candidate nghi trùng',
          message: 'Hồ sơ ứng viên nghi trùng',
          relatedEntityType: 'CANDIDATE_DUPLICATE_CASE',
          relatedEntityId: 'dup-1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        UserRole.ADMIN
      )
    ).toBe('/admin/candidate-identity-claims');

    expect(
      getNotificationRoute(
        {
          notificationId: 'n-disp',
          notificationType: 'DISPUTE',
          title: 'Có khiếu nại Affiliate mới',
          message: 'Affiliate khiếu nại hoa hồng',
          relatedEntityType: 'DISPUTE',
          relatedEntityId: 'disp-1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        UserRole.ADMIN
      )
    ).toBe('/admin/disputes');

    expect(
      getNotificationRoute(
        {
          notificationId: 'n-contact',
          notificationType: 'SYSTEM',
          title: 'Có yêu cầu tư vấn mới',
          message: 'Khách hàng gửi yêu cầu tư vấn',
          relatedEntityType: 'CONTACT_REQUEST',
          relatedEntityId: 'req-1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        UserRole.ADMIN
      )
    ).toBe('/admin/contact-requests?highlight=req-1');
  });

  it('never routes an Admin into the /hr workspace', () => {
    const jobReviewRoute = getNotificationRoute(
      {
        notificationId: 'n-job',
        notificationType: 'JOB',
        title: 'Tin tuyển dụng mới chờ duyệt: Frontend Lead',
        message: 'Doanh nghiệp vừa tạo tin mới cần duyệt',
        relatedEntityType: 'JOB',
        relatedEntityId: 'job-1',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.ADMIN
    );
    expect(jobReviewRoute).toBe('/admin/dashboard');
    expect(jobReviewRoute).not.toContain('/hr/');

    const jobPaidRoute = getNotificationRoute(
      {
        notificationId: 'n-job-paid',
        notificationType: 'JOB',
        title: 'Tin tuyển dụng đã thanh toán phí đăng tin',
        message: 'Doanh nghiệp đã thanh toán phí gói đăng tin',
        relatedEntityType: 'JOB',
        relatedEntityId: 'job-1',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.ADMIN
    );
    expect(jobPaidRoute).toBe('/admin/payouts');
    expect(jobPaidRoute).not.toContain('/hr/');
  });
});

describe('getNotificationRoute for AFFILIATE', () => {
  it('routes replacement slot notifications to submit-candidate inside affiliate portal', () => {
    const withRouteHint = getNotificationRoute(
      {
        notificationId: 'n-aff-1',
        notificationType: 'WARRANTY',
        title: 'Đã mở suất tuyển người thay thế',
        message: 'Vị trí Backend đã mở lại suất tuyển người thay thế.',
        relatedEntityType: 'REPLACEMENT_SLOT',
        relatedEntityId: 'slot-1',
        routeHint: `/affiliate/submit-candidate?job=${JOB}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.AFFILIATE
    );
    expect(withRouteHint).toBe(`/affiliate/submit-candidate?job=${JOB}`);

    const fromMeta = getNotificationRoute(
      {
        notificationId: 'n-aff-2',
        notificationType: 'WARRANTY',
        title: 'Suất tuyển người thay thế được gia hạn',
        message: 'Vị trí Backend được gia hạn.',
        relatedEntityType: 'REPLACEMENT_SLOT',
        relatedEntityId: 'slot-2',
        metadata: JSON.stringify({ jobId: JOB }),
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.AFFILIATE
    );
    expect(fromMeta).toBe(`/affiliate/submit-candidate?job=${JOB}`);

    const fallback = getNotificationRoute(
      {
        notificationId: 'n-aff-3',
        notificationType: 'COMMISSION',
        title: 'Hoa hồng đã bị hủy',
        message: 'Ứng viên đã nghỉ việc.',
        relatedEntityType: 'WARRANTY',
        relatedEntityId: 'w-1',
        routeHint: '/hr/warranty-tracking?highlight=w-1',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      UserRole.AFFILIATE
    );
    expect(fallback).toBe('/affiliate/commissions');
  });
});

describe('getNotificationRoute for CLIENT application notices (MF-03 BE-M02)', () => {
  const APP = '2c3d4e5f-0000-4000-8000-000000000002';
  const notice = (overrides: Record<string, unknown> = {}) => ({
    notificationId: 'n-app',
    notificationType: 'APPLICATION_STATUS',
    title: 'Có hồ sơ ứng viên mới',
    message: 'HR Connect đã chọn hồ sơ của ứng viên Nguyễn Văn A cho vị trí "Backend Developer".',
    relatedEntityType: 'APPLICATION',
    relatedEntityId: APP,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('opens the candidate from the client route hint sent by the server', () => {
    const route = getNotificationRoute(
      notice({ routeHint: `/client/candidates?open=${APP}`, metadata: JSON.stringify({ routeHint: `/client/candidates?open=${APP}`, entityId: APP }) }),
      UserRole.CLIENT
    );
    expect(route).toBe(`/client/candidates?open=${APP}`);
  });

  it('falls back to the application id and ignores a non-client hint', () => {
    expect(getNotificationRoute(notice({ routeHint: '/candidate/applications' }), UserRole.CLIENT)).toBe(
      `/client/candidates?open=${APP}`
    );
    expect(
      getNotificationRoute(notice({ relatedEntityId: undefined, metadata: JSON.stringify({ applicationId: APP, status: 'SHORTLISTED' }) }), UserRole.CLIENT)
    ).toBe(`/client/candidates?open=${APP}`);
  });

  it('opens the candidate list when the notice carries no application id', () => {
    expect(getNotificationRoute(notice({ relatedEntityId: undefined }), UserRole.CLIENT)).toBe('/client/candidates');
  });

  it('leaves Internal HR on the screening page for the same notice', () => {
    expect(getNotificationRoute(notice({ metadata: JSON.stringify({ applicationId: APP, status: 'SHORTLISTED' }) }), UserRole.INTERNAL_HR)).toBe(
      `/hr/screening?status=SHORTLISTED&open=${APP}`
    );
  });
});
