import { UserRole } from '@/types/roles';
import type { NotificationDto } from '@/types/api/notification';

const PUBLIC_JOB_ROUTE = /^\/jobs\/([^/?#]+)\/?$/;

/** Workspace root of each signed-in role. */
const OWN_PORTAL: Record<string, string> = {
  CLIENT: '/client',
  CANDIDATE: '/candidate',
  AFFILIATE: '/affiliate',
  INTERNAL_HR: '/hr',
  ADMIN: '/admin',
};
const PORTAL_PREFIXES = ['/client', '/candidate', '/affiliate', '/hr', '/admin', '/internal'];

/**
 * True when the route belongs to another role's workspace. The server falls back to one default route per
 * notification type (e.g. /hr/jobs for a service agreement) whoever receives it; following it would send the
 * user to a page their role cannot open, so the router bounces them back to their dashboard.
 */
const normalizeRole = (role: UserRole | string | null | undefined): string =>
  (typeof role === 'string' ? role : (role as any)?.code || '').toUpperCase();

const isRole = (role: UserRole | string | null | undefined, code: string) => normalizeRole(role) === code;

export function isOtherPortalRoute(route: string, role: UserRole | string | null | undefined): boolean {
  const own = OWN_PORTAL[normalizeRole(role)];
  if (!own) return false;
  return PORTAL_PREFIXES.some(
    (prefix) => prefix !== own && (route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`))
  );
}

/** Job page inside the signed-in user's own portal; guests keep the public job page. */
export function jobRouteForRole(jobId: string, role: UserRole | string | null | undefined): string {
  const normRole = (typeof role === 'string' ? role : (role as any)?.code || '').toUpperCase();
  switch (normRole) {
    case 'CLIENT':
      return `/client/jobs?highlight=${encodeURIComponent(jobId)}&openDetail=true`;
    case 'CANDIDATE':
      return `/candidate/jobs/${jobId}`;
    case 'AFFILIATE':
      return `/affiliate/jobs/${jobId}`;
    case 'INTERNAL_HR':
      return '/hr/jobs';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return `/jobs/${jobId}`;
  }
}

/**
 * Notifications often fall back to the public job page (/jobs/:id), which renders the
 * guest header. A signed-in user should stay in their portal, so remap that route.
 */
export function portalRoute(route: string, role: UserRole | string | null | undefined): string {
  let cleanRoute = route;
  if (cleanRoute.startsWith('/internal/jobs/review')) {
    cleanRoute = cleanRoute.replace('/internal/jobs/review', '/hr/jobs');
  }
  const match = PUBLIC_JOB_ROUTE.exec(cleanRoute);
  return match ? jobRouteForRole(decodeURIComponent(match[1]), role) : cleanRoute;
}

/**
 * Smart resolver to find the exact target route for any notification (including historical ones
 * without explicit routeHint or metadata in DB).
 */
export function getNotificationRoute(item: NotificationDto, role: UserRole | string | null | undefined): string | null {
  // 1. Try explicit routeHint on item
  let route = item.routeHint?.trim();

  // 2. Try parsing metadata
  let meta: any = null;
  if (item.metadata) {
    try {
      meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
    } catch {
      if (typeof item.metadata === 'string' && item.metadata.startsWith('/')) {
        route = item.metadata.trim();
      }
    }
  }

  if (!route && meta && typeof meta === 'object') {
    if (typeof meta.routeHint === 'string' && meta.routeHint.trim()) {
      route = meta.routeHint.trim();
    } else if (typeof meta.actionRoute === 'string' && meta.actionRoute.trim()) {
      route = meta.actionRoute.trim();
    }
  }

  if (route && route.startsWith('/internal/jobs/review')) {
    route = route.replace('/internal/jobs/review', '/hr/jobs');
  }

  // Older job notices sent Internal HR to the Admin job list; keep mapping them to the HR job review.
  if (route && route.startsWith('/admin/jobs') && isRole(role, 'INTERNAL_HR')) {
    route = route.replace('/admin/jobs', '/hr/jobs');
  }

  // A hint for another role's workspace is the server's per-type default, not meant for this user:
  // drop it and let the role rules below pick the page.
  if (route && isOtherPortalRoute(route, role)) {
    route = undefined;
  }

  const normRole = (typeof role === 'string' ? role : (role as any)?.code || '').toUpperCase();

  const titleLower = (item.title || '').toLowerCase();
  const messageLower = (item.message || '').toLowerCase();
  const entityType = (item.relatedEntityType || item.notificationType || '').toUpperCase();

  // 1. Phân quyền Platform Admin: Giữ trọn vẹn trong Admin Console (/admin/*)
  if (normRole === 'ADMIN') {
    const isAdminFinanceNotice =
      route === '/admin/payouts' ||
      route === '/admin/finance' ||
      entityType === 'ONLINE_PAYMENT' ||
      entityType === 'PAYMENT' ||
      entityType === 'FINANCE' ||
      entityType === 'PAYOUT' ||
      entityType === 'SERVICE_FEE' ||
      entityType === 'COMMISSION' ||
      titleLower.includes('vnpay') ||
      titleLower.includes('thanh toán') ||
      titleLower.includes('hoàn') ||
      titleLower.includes('hoa hồng') ||
      titleLower.includes('quá hạn');

    // 1A. Nếu backend đã cung cấp routeHint có query cụ thể tới Admin Console (không phải /admin/payouts trơn)
    if (route && route.startsWith('/admin') && !(isAdminFinanceNotice && !route.includes('?'))) {
      return route;
    }

    // 1B. Giao dịch thanh toán / VNPay / Payouts / Tài chính / Hoa hồng / Hoàn tiền
    if (isAdminFinanceNotice) {
      const params = new URLSearchParams();
      const refMatch = item.message?.match(/mã tham chiếu[:\s]+([A-Za-z0-9_-]+)/i) ?? item.message?.match(/mã giao dịch[:\s]+([A-Za-z0-9_-]+)/i);
      const quoteMatchAdmin = item.message?.match(/['"“”]([^'"“”]+)['"“”]/);

      if (titleLower.includes('phí đăng tin')) {
        params.set('tab', 'postingFees');
        if (quoteMatchAdmin?.[1]) params.set('q', quoteMatchAdmin[1]);
      } else if (entityType === 'PAYOUT' || titleLower.includes('chi trả') || titleLower.includes('chuyển khoản')) {
        params.set('tab', 'payouts');
        if (item.relatedEntityId && entityType === 'PAYOUT') params.set('highlight', String(item.relatedEntityId));
        if (refMatch?.[1]) params.set('q', refMatch[1]);
      } else if (entityType === 'COMMISSION' || titleLower.includes('hoa hồng')) {
        params.set('tab', 'commissions');
        if (titleLower.includes('chờ duyệt') || titleLower.includes('đủ điều kiện')) {
          params.set('status', 'EARNED');
        } else if (titleLower.includes('chờ chi')) {
          params.set('status', 'PAYABLE');
        } else if (titleLower.includes('tạm giữ')) {
          params.set('status', 'ON_HOLD');
        } else if (titleLower.includes('hủy')) {
          params.set('status', 'CANCELLED');
        }
        if (item.relatedEntityId && entityType === 'COMMISSION') params.set('highlight', String(item.relatedEntityId));
        if (quoteMatchAdmin?.[1]) params.set('q', quoteMatchAdmin[1]);
      } else {
        params.set('tab', 'fees');
        if (
          titleLower.includes('đã ghi nhận thanh toán') ||
          titleLower.includes('đã thanh toán') ||
          titleLower.includes('vnpay')
        ) {
          params.set('status', 'PAID');
        } else if (titleLower.includes('quá hạn')) {
          params.set('status', 'OVERDUE');
        }
        if (item.relatedEntityId && entityType === 'SERVICE_FEE') params.set('highlight', String(item.relatedEntityId));
        const fallbackQuery = refMatch?.[1] || quoteMatchAdmin?.[1];
        if (fallbackQuery) params.set('q', fallbackQuery);
      }

      const qs = params.toString();
      return qs ? `/admin/payouts?${qs}` : '/admin/payouts';
    }

    // 1C. Phê duyệt tài khoản Doanh nghiệp / Affiliate
    if (
      entityType === 'APPROVAL' ||
      entityType === 'ACCOUNT_APPROVAL' ||
      entityType === 'COMPANY_VERIFICATION' ||
      entityType === 'AFFILIATE_APPLICATION' ||
      titleLower.includes('phê duyệt') ||
      titleLower.includes('đăng ký') ||
      titleLower.includes('xác minh công ty') ||
      titleLower.includes('duyệt hồ sơ')
    ) {
      const approvalId = meta?.approvalId || meta?.entityId || item.relatedEntityId;
      return approvalId ? `/admin/approvals?highlight=${encodeURIComponent(String(approvalId))}` : '/admin/approvals';
    }

    // 1D. Nghi trùng danh tính Candidate / Claim
    if (
      entityType === 'CANDIDATE_DUPLICATE_CASE' ||
      entityType === 'CANDIDATE_IDENTITY_CLAIM' ||
      entityType === 'IDENTITY_CLAIM' ||
      titleLower.includes('danh tính') ||
      titleLower.includes('nghi trùng')
    ) {
      const claimId = meta?.claimId || meta?.duplicateCaseId || meta?.entityId || item.relatedEntityId;
      return claimId
        ? `/admin/candidate-identity-claims?highlight=${encodeURIComponent(String(claimId))}`
        : '/admin/candidate-identity-claims';
    }

    // 1E. Tranh chấp khiếu nại
    if (entityType === 'DISPUTE' || titleLower.includes('khiếu nại') || titleLower.includes('tranh chấp')) {
      const disputeId = meta?.disputeId || meta?.entityId || item.relatedEntityId;
      return disputeId ? `/admin/disputes?highlight=${encodeURIComponent(String(disputeId))}` : '/admin/disputes';
    }

    // 1F. Yêu cầu tư vấn
    if (
      entityType === 'CONTACT_REQUEST' ||
      titleLower.includes('yêu cầu tư vấn') ||
      titleLower.includes('yêu cầu liên hệ')
    ) {
      const contactId = meta?.contactRequestId || meta?.entityId || item.relatedEntityId;
      return contactId ? `/admin/contact-requests?highlight=${encodeURIComponent(contactId)}` : '/admin/contact-requests';
    }

    // 1G. Quản trị người dùng & phân quyền
    if (entityType === 'USER' || titleLower.includes('người dùng')) {
      return '/admin/users';
    }

    return '/admin/dashboard';
  }

  const isInternalHr = normRole === 'INTERNAL_HR';

  // Extract highlight param (jobId, company name in quotes, or job title in quotes)
  const metaJobId = meta?.jobId || meta?.job_id;
  const quoteMatch = item.message?.match(/['"“”]([^'"“”]+)['"“”]/);
  const targetHighlight =
    metaJobId ||
    (entityType === 'JOB' && item.relatedEntityId ? item.relatedEntityId : undefined) ||
    (quoteMatch ? quoteMatch[1] : undefined);

  if (isInternalHr) {
    const jobsBasePath = '/hr/jobs';

    // 1. Yêu cầu tư vấn / Liên hệ (SF-05)
    if (
      entityType === 'CONTACT_REQUEST' ||
      titleLower.includes('yêu cầu tư vấn') ||
      titleLower.includes('yêu cầu liên hệ')
    ) {
      const contactId = meta?.contactRequestId || meta?.entityId || item.relatedEntityId;
      return contactId ? `/hr/contact-requests?highlight=${encodeURIComponent(contactId)}` : '/hr/contact-requests';
    }

    // 2. Đối soát nhận việc (MF-04 UC-41) -> Chuyển về Internal HR phụ trách vận hành
    if (
      entityType === 'PLACEMENT_RECONCILIATION' ||
      titleLower.includes('đối soát') ||
      titleLower.includes('kết quả nhận việc')
    ) {
      const targetId =
        meta?.applicationId ||
        meta?.ApplicationId ||
        meta?.reconciliationId ||
        meta?.ReconciliationId ||
        meta?.entityId ||
        item.relatedEntityId;
      const basePath = '/hr/placement-reconciliations';
      return targetId ? `${basePath}?highlight=${encodeURIComponent(targetId)}` : basePath;
    }

    // 3. Theo dõi bảo hành & Báo nghỉ việc (MF-05)
    if (
      entityType === 'WARRANTY' ||
      titleLower.includes('bảo hành') ||
      titleLower.includes('nghỉ việc')
    ) {
      const warrantyId = meta?.warrantyId || meta?.entityId || item.relatedEntityId;
      const params = new URLSearchParams();
      if (titleLower.includes('nghỉ việc')) {
        params.set('status', 'CLAIMED');
      }
      if (warrantyId) {
        params.set('highlight', String(warrantyId));
      }
      const qs = params.toString();
      return qs ? `/hr/warranty-tracking?${qs}` : '/hr/warranty-tracking';
    }

    // 4. Sửa ngày đi làm / Placement (MF-04)
    if (entityType === 'PLACEMENT' || titleLower.includes('ngày đi làm')) {
      const placementId = meta?.placementId || meta?.entityId || item.relatedEntityId;
      return placementId
        ? `/hr/placement-review?highlight=${encodeURIComponent(placementId)}`
        : '/hr/placement-review';
    }

    // 5. CV Sourcing bị từ chối hoặc bàn giao (MF-03 / MF-05)
    if (
      entityType === 'SOURCING_DELIVERY' ||
      entityType === 'SOURCING' ||
      titleLower.includes('cv đã giao')
    ) {
      if (route && route.startsWith('/hr/screening') && route.includes('?')) {
        return route;
      }
      const appId = meta?.applicationId || meta?.ApplicationId;
      return appId
        ? `/hr/screening?status=SHORTLISTED&open=${encodeURIComponent(appId)}`
        : '/hr/screening?status=SHORTLISTED';
    }

    // 6. Sàng lọc hồ sơ ứng tuyển (MF-03)
    if (
      entityType === 'APPLICATION' ||
      entityType === 'APPLICATION_STATUS' ||
      entityType === 'CANDIDATE_APPLICATION' ||
      entityType === 'SUBMISSION' ||
      titleLower.includes('sàng lọc')
    ) {
      if (route && route.startsWith('/hr/screening') && route.includes('?')) {
        return route;
      }
      const appId =
        meta?.applicationId ||
        meta?.ApplicationId ||
        meta?.entityId ||
        (entityType !== 'SUBMISSION' ? item.relatedEntityId : undefined);
      const statusTab = meta?.status || 'SUBMITTED';
      return appId
        ? `/hr/screening?status=${encodeURIComponent(statusTab)}&open=${encodeURIComponent(appId)}`
        : '/hr/screening';
    }

    // 7. Pipeline / Phỏng vấn / Offer (MF-04)
    if (entityType === 'INTERVIEW' || titleLower.includes('phỏng vấn')) {
      return '/hr/pipeline?tab=interviews';
    }
    if (entityType === 'OFFER' || titleLower.includes('offer')) {
      return '/hr/pipeline?tab=offers';
    }

    // 8A. Yêu cầu điều chỉnh thỏa thuận dịch vụ
    if (
      titleLower.includes('điều chỉnh') ||
      messageLower.includes('yêu cầu điều chỉnh') ||
      meta?.status === 'CHANGE_REQUESTED'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=CHANGE_REQUESTED${sep}`;
    }

    // 8B. Thỏa thuận dịch vụ đã được ký điện tử (tin đã chuyển sang ACTIVE hoặc PENDING_PAYMENT)
    if (titleLower.includes('đã được ký')) {
      const signedJobStatus =
        meta?.jobStatus || (meta?.status && meta.status !== 'SIGNED' ? meta.status : 'ALL');
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=${encodeURIComponent(signedJobStatus)}${sep}`;
    }

    // 8C. Thỏa thuận dịch vụ / hợp đồng đang chờ (Client đồng ý dự thảo hoặc tải lên file ký)
    if (
      titleLower.includes('thỏa thuận') ||
      titleLower.includes('hợp đồng') ||
      entityType === 'SERVICE_AGREEMENT'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=PENDING_AGREEMENT${sep}`;
    }

    // 8D. Doanh nghiệp nộp cọc / chờ cọc
    if (
      titleLower.includes('nộp cọc') ||
      titleLower.includes('đặt cọc') ||
      titleLower.includes('nộp tiền cọc') ||
      messageLower.includes('nộp cọc') ||
      messageLower.includes('nộp tiền cọc') ||
      meta?.status === 'PENDING_PAYMENT'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=PENDING_PAYMENT${sep}`;
    }

    // 8E. Đã thanh toán phí đăng tin / Đang tuyển
    if (
      titleLower.includes('thanh toán phí') ||
      titleLower.includes('công bố') ||
      titleLower.includes('kích hoạt') ||
      meta?.status === 'ACTIVE'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=ACTIVE${sep}`;
    }

    // 8F. Tin mới chờ duyệt
    if (
      titleLower.includes('chờ duyệt') ||
      titleLower.includes('cần duyệt') ||
      titleLower.includes('tạo tin') ||
      meta?.status === 'PENDING_REVIEW'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `${jobsBasePath}?status=PENDING_REVIEW${sep}`;
    }

    // 8G. Chung cho JOB
    if (entityType === 'JOB') {
      if (route && (route.startsWith('/hr/jobs') || route.startsWith('/admin/jobs')) && route.includes('?')) {
        return route.replace('/admin/jobs', '/hr/jobs');
      }
      const statusParam = meta?.status ? `status=${encodeURIComponent(meta.status)}` : '';
      const highlightParam = targetHighlight ? `highlight=${encodeURIComponent(targetHighlight)}` : '';
      const query = [statusParam, highlightParam].filter(Boolean).join('&');
      return query ? `${jobsBasePath}?${query}` : jobsBasePath;
    }
  }

  // Affiliate: keep inside Affiliate portal and never route to /hr or /admin fallback hints.
  if (normRole === 'AFFILIATE') {
    const isCommissionOrPayout =
      entityType === 'COMMISSION' ||
      entityType === 'WARRANTY' ||
      entityType === 'PAYOUT' ||
      route === '/affiliate/commissions' ||
      titleLower.includes('hoa hồng') ||
      titleLower.includes('chuyển khoản');

    if (isCommissionOrPayout) {
      if (route && route.startsWith('/affiliate/commissions?')) {
        return route;
      }
      const params = new URLSearchParams();
      if (entityType === 'PAYOUT' || titleLower.includes('chuyển khoản')) {
        params.set('section', 'payouts');
        params.set('tab', 'PAID');
        if (item.relatedEntityId) params.set('payout', String(item.relatedEntityId));
        const refMatch = item.message?.match(/mã giao dịch[:\s]+([A-Za-z0-9_-]+)/i);
        if (refMatch?.[1]) params.set('ref', refMatch[1]);
      } else {
        if (titleLower.includes('duyệt chi')) {
          params.set('tab', 'PAYABLE');
        } else if (titleLower.includes('hủy') || titleLower.includes('tạm giữ')) {
          params.set('tab', 'CANCELLED');
        } else if (titleLower.includes('tiếp tục bảo hành') || titleLower.includes('đang bảo hành')) {
          params.set('tab', 'WARRANTY');
        } else if (
          titleLower.includes('đủ điều kiện') ||
          titleLower.includes('qua bảo hành') ||
          titleLower.includes('chờ trả phí')
        ) {
          params.set('tab', 'EARNED');
        }
        if (item.relatedEntityId && entityType === 'COMMISSION') {
          params.set('highlight', String(item.relatedEntityId));
        }
        const quoteMatchComm = item.message?.match(/['"“”]([^'"“”]+)['"“”]/);
        if (quoteMatchComm?.[1]) {
          params.set('q', quoteMatchComm[1]);
        }
      }
      const qs = params.toString();
      return qs ? `/affiliate/commissions?${qs}` : '/affiliate/commissions';
    }

    if (
      entityType === 'REPLACEMENT_SLOT' ||
      titleLower.includes('suất tuyển người thay thế') ||
      titleLower.includes('suất thay thế')
    ) {
      const params = new URLSearchParams({ tab: 'CANCELLED' });
      const slotId = meta?.replacementSlotId || (entityType === 'REPLACEMENT_SLOT' ? item.relatedEntityId : undefined);
      if (slotId) params.set('slot', String(slotId));
      const jobFromRoute = route?.match(/[?&]job=([^&]+)/i)?.[1];
      const targetJobId = meta?.jobId || (jobFromRoute ? decodeURIComponent(jobFromRoute) : undefined);
      if (targetJobId) params.set('job', String(targetJobId));
      const quoteMatchAff = item.message?.match(/['"“”]([^'"“”]+)['"“”]/);
      if (quoteMatchAff?.[1]) params.set('q', quoteMatchAff[1]);
      return `/affiliate/commissions?${params.toString()}`;
    }

    if (
      entityType === 'DISPUTE' ||
      route === '/affiliate/disputes' ||
      titleLower.includes('khiếu nại') ||
      titleLower.includes('tranh chấp')
    ) {
      const disputeId = meta?.disputeId || (entityType === 'DISPUTE' ? item.relatedEntityId : undefined);
      return disputeId ? `/affiliate/disputes?highlight=${encodeURIComponent(String(disputeId))}` : '/affiliate/disputes';
    }

    if (
      entityType === 'SUBMISSION' ||
      entityType === 'SUBMISSION_CONSENT_RESULT' ||
      route === '/affiliate/submissions'
    ) {
      if (route && route.startsWith('/affiliate/submissions/') && route.length > '/affiliate/submissions/'.length) {
        return route;
      }
      const submissionId = meta?.submissionId || item.relatedEntityId;
      const params = new URLSearchParams();
      if (submissionId) params.set('highlight', String(submissionId));
      const quoteMatchSub = item.message?.match(/['"“”]([^'"“”]+)['"“”]/);
      if (quoteMatchSub?.[1]) params.set('q', quoteMatchSub[1]);
      const qs = params.toString();
      return qs ? `/affiliate/submissions?${qs}` : '/affiliate/submissions';
    }

    if (route && (route.startsWith('/affiliate') || PUBLIC_JOB_ROUTE.test(route))) {
      return portalRoute(route, role as UserRole);
    }
  }

  // Client + MF-03 application notice: decided before the generic hint below, because older rows carry the
  // server's default /candidate/applications hint; only a /client/ hint is trusted (e.g. Internal HR
  // shortlisted a HEADHUNT_COD CV).
  if (normRole === 'CLIENT' && (entityType === 'APPLICATION' || entityType === 'APPLICATION_STATUS')) {
    if (route && route.startsWith('/client/')) {
      return route;
    }
    const appId = meta?.applicationId || meta?.ApplicationId || meta?.entityId || item.relatedEntityId;
    return appId ? `/client/candidates?open=${encodeURIComponent(appId)}` : '/client/candidates';
  }

  // Client + MF-05 service fee / payment / refund notices: older records carried routeHint="/client/dashboard",
  // so remap directly to /client/billing with the matching status tab and exact fee highlight.
  if (
    normRole === 'CLIENT' &&
    (entityType === 'SERVICE_FEE' ||
      titleLower.includes('đã ghi nhận thanh toán') ||
      titleLower.includes('thanh toán thành công') ||
      titleLower.includes('đã hoàn tiền') ||
      titleLower.includes('phí dịch vụ') ||
      titleLower.includes('công nợ') ||
      titleLower.includes('hoàn tiền'))
  ) {
    if (route && route.startsWith('/client/billing?')) {
      return route;
    }
    const feeId =
      meta?.serviceFeeId ||
      meta?.ServiceFeeId ||
      meta?.entityId ||
      (entityType === 'SERVICE_FEE' ? item.relatedEntityId : undefined);
    const params = new URLSearchParams();
    if (titleLower.includes('hoàn tiền') || titleLower.includes('đã hoàn')) {
      params.set('status', 'REFUND');
    } else if (
      titleLower.includes('đã ghi nhận thanh toán') ||
      titleLower.includes('thanh toán thành công')
    ) {
      params.set('status', 'PAID');
    }
    if (feeId) {
      params.set('highlight', String(feeId));
    }
    const clientRefMatch = item.message?.match(/mã tham chiếu[:\s]+([A-Za-z0-9_-]+)/i);
    if (!feeId && clientRefMatch?.[1]) {
      params.set('q', clientRefMatch[1]);
    }
    const qs = params.toString();
    return qs ? `/client/billing?${qs}` : '/client/billing';
  }

  // Client + MF-05 warranty / replacement slot notices (also enrich bare /client/warranty routeHint)
  if (
    normRole === 'CLIENT' &&
    (entityType === 'WARRANTY' ||
      entityType === 'REPLACEMENT_SLOT' ||
      route === '/client/warranty' ||
      titleLower.includes('bảo hành') ||
      titleLower.includes('nghỉ việc') ||
      titleLower.includes('suất tuyển người thay thế') ||
      titleLower.includes('suất thay thế'))
  ) {
    if (
      (entityType === 'REPLACEMENT_SLOT' ||
        titleLower.includes('suất tuyển người thay thế') ||
        titleLower.includes('suất thay thế')) &&
      (titleLower.includes('hết hạn') || messageLower.includes('hoàn'))
    ) {
      const feeId = meta?.serviceFeeId || meta?.entityId;
      return feeId
        ? `/client/billing?status=REFUND&highlight=${encodeURIComponent(String(feeId))}`
        : '/client/billing?status=REFUND';
    }
    const warrantyId =
      meta?.warrantyId ||
      meta?.placementId ||
      (entityType === 'WARRANTY' ? item.relatedEntityId : undefined);
    return warrantyId ? `/client/warranty?highlight=${encodeURIComponent(String(warrantyId))}` : '/client/warranty';
  }

  // Candidate: enrich bare /candidate/applications routeHint with highlight / q so the target card flashes & scrolls into view
  if (normRole === 'CANDIDATE' && route === '/candidate/applications') {
    const appId =
      meta?.applicationId ||
      meta?.ApplicationId ||
      (entityType === 'APPLICATION' || entityType === 'APPLICATION_STATUS' || entityType === 'CANDIDATE_APPLICATION'
        ? item.relatedEntityId
        : undefined);
    const params = new URLSearchParams();
    if (appId) params.set('highlight', String(appId));
    if (quoteMatch?.[1]) params.set('q', quoteMatch[1]);
    const qs = params.toString();
    return qs ? `/candidate/applications?${qs}` : '/candidate/applications';
  }

  // If explicit route was resolved
  if (route) {
    return portalRoute(route, role as UserRole);
  }

  // Candidate JOB_FIT
  if (entityType === 'JOB_FIT' || titleLower.includes('việc làm phù hợp')) {
    if (item.relatedEntityId) return `/jobs/${item.relatedEntityId}`;
    return '/candidate/jobs?tab=matches';
  }

  // Client
  if (normRole === 'CLIENT') {
    if (
      entityType === 'REPLACEMENT_SLOT' ||
      titleLower.includes('suất tuyển người thay thế') ||
      titleLower.includes('suất thay thế')
    ) {
      if (titleLower.includes('hết hạn') || messageLower.includes('hoàn')) {
        return '/client/billing';
      }
      return '/client/warranty';
    }
    if (
      entityType === 'WARRANTY' ||
      titleLower.includes('bảo hành') ||
      titleLower.includes('nghỉ việc')
    ) {
      return '/client/warranty';
    }
    if (
      entityType === 'SERVICE_FEE' ||
      titleLower.includes('phí dịch vụ') ||
      titleLower.includes('công nợ') ||
      titleLower.includes('hoàn tiền')
    ) {
      return '/client/billing';
    }
    if (entityType === 'SERVICE_AGREEMENT' || titleLower.includes('thỏa thuận') || titleLower.includes('hợp đồng')) {
      const sep = targetHighlight ? `?jobId=${encodeURIComponent(targetHighlight)}` : '';
      return `/client/agreements${sep}`;
    }
    if (
      entityType === 'SOURCING_DELIVERY' ||
      titleLower.includes('cv mới được giao') ||
      titleLower.includes('cv thay thế')
    ) {
      const jobId = meta?.jobId || item.relatedEntityId;
      return jobId ? `/client/jobs/${encodeURIComponent(jobId)}/sourcing` : '/client/jobs';
    }
    if (entityType === 'JOB') {
      const sep = targetHighlight ? `?highlight=${encodeURIComponent(targetHighlight)}&openDetail=true` : '';
      return `/client/jobs${sep}`;
    }
  }

  return null;
}
