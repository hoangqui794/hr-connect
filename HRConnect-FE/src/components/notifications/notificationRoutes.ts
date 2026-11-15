import { UserRole } from '@/types/roles';
import type { NotificationDto } from '@/types/api/notification';

const PUBLIC_JOB_ROUTE = /^\/jobs\/([^/?#]+)\/?$/;

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

  const normRole = (typeof role === 'string' ? role : (role as any)?.code || '').toUpperCase();

  const titleLower = (item.title || '').toLowerCase();
  const messageLower = (item.message || '').toLowerCase();
  const entityType = (item.relatedEntityType || item.notificationType || '').toUpperCase();

  // 1. Phân quyền Platform Admin: Giữ trọn vẹn trong Admin Console (/admin/*)
  if (normRole === 'ADMIN') {
    // 1A. Nếu backend đã cung cấp routeHint chính xác tới Admin Console
    if (route && route.startsWith('/admin')) {
      return route;
    }

    // 1B. Giao dịch thanh toán / VNPay / Payouts / Tài chính / Hoa hồng / Hoàn tiền
    if (
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
      titleLower.includes('quá hạn')
    ) {
      return '/admin/payouts';
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
      return '/admin/approvals';
    }

    // 1D. Nghi trùng danh tính Candidate / Claim
    if (
      entityType === 'CANDIDATE_DUPLICATE_CASE' ||
      entityType === 'IDENTITY_CLAIM' ||
      titleLower.includes('danh tính') ||
      titleLower.includes('nghi trùng')
    ) {
      return '/admin/candidate-identity-claims';
    }

    // 1E. Tranh chấp khiếu nại
    if (entityType === 'DISPUTE' || titleLower.includes('khiếu nại') || titleLower.includes('tranh chấp')) {
      return '/admin/disputes';
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
      return warrantyId
        ? `/hr/warranty-tracking?highlight=${encodeURIComponent(warrantyId)}`
        : '/hr/warranty-tracking';
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
    if (route && (route.startsWith('/affiliate') || PUBLIC_JOB_ROUTE.test(route))) {
      return portalRoute(route, role as UserRole);
    }
    if (
      entityType === 'REPLACEMENT_SLOT' ||
      titleLower.includes('suất tuyển người thay thế') ||
      titleLower.includes('suất thay thế')
    ) {
      if (meta?.jobId && typeof meta.jobId === 'string') {
        return `/affiliate/submit-candidate?job=${encodeURIComponent(meta.jobId)}`;
      }
      return '/affiliate/commissions';
    }
    if (entityType === 'COMMISSION' || entityType === 'WARRANTY' || entityType === 'PAYOUT') {
      return '/affiliate/commissions';
    }
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
    if (entityType === 'JOB') {
      const sep = targetHighlight ? `?highlight=${encodeURIComponent(targetHighlight)}&openDetail=true` : '';
      return `/client/jobs${sep}`;
    }
  }

  return null;
}
