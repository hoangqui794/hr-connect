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
      return '/admin/jobs';
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
  const isInternalHr = normRole === 'INTERNAL_HR' || normRole === 'ADMIN';

  const titleLower = (item.title || '').toLowerCase();
  const messageLower = (item.message || '').toLowerCase();
  const entityType = (item.relatedEntityType || item.notificationType || '').toUpperCase();

  // Extract highlight param (jobId, company name in quotes, or job title in quotes)
  const metaJobId = meta?.jobId || meta?.job_id;
  const quoteMatch = item.message?.match(/['"]([^'"]+)['"]/);
  const targetHighlight =
    metaJobId ||
    (entityType === 'JOB' && item.relatedEntityId ? item.relatedEntityId : undefined) ||
    (quoteMatch ? quoteMatch[1] : undefined);

  if (isInternalHr) {
    // A. Yêu cầu điều chỉnh thỏa thuận dịch vụ
    if (
      titleLower.includes('điều chỉnh') ||
      messageLower.includes('yêu cầu điều chỉnh') ||
      meta?.status === 'CHANGE_REQUESTED'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs?status=CHANGE_REQUESTED${sep}`;
    }

    // B. Thỏa thuận dịch vụ / hợp đồng (chấp thuận, đã ký)
    if (
      titleLower.includes('thỏa thuận') ||
      titleLower.includes('hợp đồng') ||
      entityType === 'SERVICE_AGREEMENT'
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs?status=PENDING_AGREEMENT${sep}`;
    }

    // C. Doanh nghiệp nộp cọc / chờ cọc
    if (
      titleLower.includes('nộp cọc') ||
      titleLower.includes('đặt cọc') ||
      messageLower.includes('nộp cọc')
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs?status=PENDING_PAYMENT${sep}`;
    }

    // D. Đã thanh toán phí đăng tin / Đang tuyển
    if (
      titleLower.includes('thanh toán phí') ||
      titleLower.includes('công bố') ||
      titleLower.includes('kích hoạt')
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs?status=ACTIVE${sep}`;
    }

    // E. Tin mới chờ duyệt
    if (
      titleLower.includes('chờ duyệt') ||
      titleLower.includes('cần duyệt') ||
      titleLower.includes('tạo tin')
    ) {
      const sep = targetHighlight ? `&highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs?status=PENDING_REVIEW${sep}`;
    }

    // F. Chung cho JOB
    if (entityType === 'JOB') {
      const sep = targetHighlight ? `?highlight=${encodeURIComponent(targetHighlight)}` : '';
      return `/hr/jobs${sep}`;
    }

    // G. Pipeline / Phỏng vấn / Offer
    if (entityType === 'INTERVIEW' || titleLower.includes('phỏng vấn')) {
      return '/hr/pipeline?tab=interviews';
    }
    if (entityType === 'OFFER' || titleLower.includes('offer')) {
      return '/hr/pipeline?tab=offers';
    }
    if (entityType === 'APPLICATION' || entityType === 'SUBMISSION') {
      return '/hr/screening';
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
