/**
 * @file auditLabels.ts
 * @description Vietnamese phrases for audit action codes (HRConnect.Application AuditActions,
 * plus AI scoring, security sessions, and raw trigger events).
 * Translates technical snake_case codes into clear, human-friendly Vietnamese sentences for Platform Admins.
 */
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

const PHRASES: Record<string, string> = {
  // ── 1. Authentication & Account ──────────────────────────────────────────
  AFFILIATE_APPROVED: 'đã duyệt tài khoản Cộng tác viên',
  AFFILIATE_REJECTED: 'đã từ chối tài khoản Cộng tác viên',
  CLIENT_APPROVED: 'đã xác thực doanh nghiệp',
  CLIENT_REJECTED: 'đã từ chối xác thực doanh nghiệp',
  EMAIL_VERIFIED: 'đã xác thực địa chỉ email',
  AFFILIATE_REGISTERED: 'đã đăng ký tài khoản Cộng tác viên',
  CLIENT_REGISTERED: 'đã đăng ký tài khoản doanh nghiệp',
  CANDIDATE_REGISTERED: 'đã đăng ký tài khoản ứng viên',
  PASSWORD_CHANGED: 'đã đổi mật khẩu tài khoản',
  PASSWORD_RESET: 'đã đặt lại mật khẩu',
  SESSION_REVOKED: 'Đã đăng xuất phiên làm việc',
  ALL_SESSIONS_REVOKED: 'Đã đăng xuất tất cả các phiên làm việc',
  REFRESH_TOKEN: 'Đã làm mới phiên đăng nhập',
  REFRESH_TOKEN_REUSE_DETECTED: 'Phát hiện đăng nhập bất thường (bị thu hồi phiên)',
  USER_SUSPENDED: 'đã tạm khóa tài khoản người dùng',
  USER_REACTIVATED: 'đã kích hoạt lại tài khoản người dùng',
  USER_LOGIN_UNLOCKED: 'đã mở khóa đăng nhập cho tài khoản',

  // ── 2. Candidate Identity & Profile ──────────────────────────────────────
  IDENTITY_CLAIM_REQUESTED: 'đã gửi yêu cầu khôi phục danh tính ứng viên',
  IDENTITY_CLAIM_OTP_RESENT: 'đã gửi lại mã OTP xác minh danh tính',
  IDENTITY_EMAIL_VERIFIED: 'đã xác minh email khôi phục hồ sơ',
  CANDIDATE_EMAIL_IDENTITY_REVOKED: 'đã gỡ email phụ khỏi tài khoản',
  CANDIDATE_PRIMARY_EMAIL_CHANGED: 'đã đổi email đăng nhập chính',
  CANDIDATE_DUPLICATE_CASE_DISMISSED_BY_CANDIDATE: 'ứng viên đã bỏ qua cảnh báo trùng lặp hồ sơ',
  SUBMISSION_CONSENT_UNAUTHORIZED_REPORTED: 'đã báo cáo mạo danh lượt giới thiệu',
  CANDIDATE_IDENTITY_CLAIMED: 'đã nhận diện và liên kết hồ sơ cũ',
  IDENTITY_CLAIM_REVIEWED: 'Admin đã đối chiếu yêu cầu khôi phục danh tính',
  CANDIDATE_DUPLICATE_CASE_RESOLVED: 'đã xử lý trường hợp trùng hồ sơ ứng viên',
  CANDIDATE_IDENTITY_MERGED: 'đã hợp nhất dữ liệu ứng viên trùng lặp',

  // ── 3. Candidate CV & Affiliate Reuse ────────────────────────────────────
  CV_UPLOADED: 'đã tải lên CV mới',
  CV_UPDATED: 'đã cập nhật nội dung CV',
  CV_PRIMARY_SET: 'đã đặt làm CV chính',
  CV_DELETED: 'đã xóa CV',
  AFFILIATE_CV_REUSE_GRANTED: 'đã đồng ý cho CTV tái sử dụng CV',
  AFFILIATE_CV_REUSE_REVOKED: 'đã thu hồi quyền tái sử dụng CV của CTV',
  AFFILIATE_CV_VIEWED: 'CTV đã xem CV ứng viên',
  CANDIDATE_CV_DOWNLOAD_URL_ISSUED: 'đã tạo liên kết tải/xem CV ứng viên',
  CANDIDATE_AFFILIATE_CV_DOWNLOAD_URL_ISSUED: 'đã tạo liên kết tải CV ứng viên (từ CTV)',
  CANDIDATE_AFFILIATE_CV_ADOPTED: 'ứng viên đã tiếp nhận bản CV do CTV tải lên',
  INTERNAL_CV_DOWNLOAD_URL_ISSUED: 'đã tải CV nội bộ',
  SUBMISSION_CONSENT_CV_DOWNLOAD_URL_ISSUED: 'đã mở xem CV trong yêu cầu xác nhận giới thiệu',
  APPLICATION_CV_DOWNLOAD_URL_ISSUED: 'đã mở xem CV ứng tuyển của ứng viên',

  // ── 4. Submissions & Consent ─────────────────────────────────────────────
  APPLICATION_SUBMITTED: 'đã nộp hồ sơ ứng tuyển việc làm',
  AFFILIATE_SUBMISSION_CREATED: 'đã giới thiệu một ứng viên',
  SUBMISSION_DUPLICATE_BLOCKED: 'hệ thống đã chặn một lượt giới thiệu trùng lặp',
  SUBMISSION_CONSENT_CONFIRMED: 'đã đồng ý cho Cộng tác viên giới thiệu',
  SUBMISSION_CONSENT_DECLINED: 'đã từ chối lời mời giới thiệu việc làm',
  SUBMISSION_CONSENT_EXPIRED: 'lời mời xác nhận giới thiệu đã hết hạn',
  SUBMISSION_CONSENT_CLOSED: 'đã đóng yêu cầu xác nhận giới thiệu',
  SUBMISSION_IDENTITY_REVIEW_HELD: 'tạm giữ lượt giới thiệu để đối chiếu danh tính',
  SUBMISSION_IDENTITY_REVIEW_FINALIZED: 'hoàn tất đối chiếu danh tính lượt giới thiệu',

  // ── 5. AI Scoring ────────────────────────────────────────────────────────
  AI_SCORING_REQUESTED: 'đã yêu cầu AI chấm điểm hồ sơ',
  AI_SCORING_RETRY_REQUESTED: 'đã yêu cầu AI chấm điểm lại',
  AI_SCORING_COMPLETED: 'AI đã hoàn thành chấm điểm hồ sơ',
  AI_SCORING_FAILED: 'chấm điểm AI thất bại',

  // ── 6. Application Workflow & Interviews ─────────────────────────────────
  APPLICATION_STATUS_CHANGED: 'đã thay đổi trạng thái hồ sơ ứng tuyển',
  APPLICATION_SCREENED: 'đã sàng lọc hồ sơ ứng viên',
  APPLICATION_BACKUP_DECIDED: 'đã xếp hồ sơ vào danh sách dự bị',
  APPLICATION_WITHDRAWN: 'ứng viên đã rút hồ sơ ứng tuyển',
  APPLICATION_PLANNED_START_DATE_UPDATED: 'đã cập nhật ngày dự kiến đi làm',
  APPLICATION_NOT_STARTED: 'ghi nhận ứng viên không đến nhận việc',
  INTERVIEW_SCHEDULED: 'đã lên lịch phỏng vấn ứng viên',
  INTERVIEW_UPDATED: 'đã cập nhật lịch phỏng vấn',
  INTERVIEW_RESCHEDULED: 'đã dời lịch phỏng vấn sang thời gian mới',
  INTERVIEW_CANCELLED: 'đã hủy lịch phỏng vấn',
  INTERVIEW_NO_SHOW_RECORDED: 'ghi nhận ứng viên vắng mặt buổi phỏng vấn',
  INTERVIEW_ATTENDANCE_CONFIRMED: 'xác nhận ứng viên đã tham gia phỏng vấn',
  INTERVIEW_RESULT_RECORDED: 'đã ghi nhận kết quả đánh giá phỏng vấn',

  // ── 7. Offers & Placement ────────────────────────────────────────────────
  OFFER_DRAFT_CREATED: 'đã tạo bản nháp thư mời nhận việc (Offer)',
  OFFER_UPDATED: 'đã cập nhật thư mời nhận việc',
  OFFER_SENT: 'đã gửi thư mời nhận việc cho ứng viên',
  OFFER_ACCEPTED: 'ứng viên đã đồng ý nhận offer',
  OFFER_DECLINED: 'ứng viên đã từ chối nhận offer',
  OFFER_WITHDRAWN: 'doanh nghiệp đã rút lại offer',
  OFFER_EXPIRED: 'thư mời nhận việc đã hết hạn',
  PLACEMENT_CONFIRMED: 'đã xác nhận ứng viên chính thức đi làm',
  PLACEMENT_START_DATE_CORRECTED: 'đã điều chỉnh ngày bắt đầu làm việc',
  PLACEMENT_RECONCILED: 'đã đối soát ứng viên nhận việc thành công',
  PLACEMENT_RECONCILIATION_FLAGGED: 'phát hiện nghi vấn đối soát nhận việc',
  PLACEMENT_RECONCILIATION_RESOLVED: 'đã giải quyết nghi vấn đối soát nhận việc',
  PLACEMENT_FINANCE_INITIALIZED: 'đã khởi tạo số liệu tài chính nhận việc',

  // ── 8. Warranty & Replacements ───────────────────────────────────────────
  WARRANTY_PASSED: 'ứng viên đã vượt qua thời gian bảo hành',
  WARRANTY_CLAIM_REPORTED: 'doanh nghiệp đã báo yêu cầu bảo hành nhân sự',
  WARRANTY_CLAIM_RESOLVED: 'đã giải quyết xong yêu cầu bảo hành',
  SERVICE_FEE_OVERDUE: 'phí dịch vụ tuyển dụng đã quá hạn thanh toán',
  SERVICE_FEE_DUE: 'đến hạn thanh toán phí dịch vụ tuyển dụng',
  REPLACEMENT_SLOT_OPENED: 'đã mở vị trí tuyển thay thế bảo hành',
  REPLACEMENT_SLOT_FILLED: 'đã tuyển thành công nhân sự thay thế',
  REPLACEMENT_REFUND_CREATED: 'đã tạo lệnh hoàn tiền bảo hành',
  REPLACEMENT_SLOT_CANCELLED: 'đã hủy vị trí tuyển thay thế',
  REPLACEMENT_SLOT_EXPIRED: 'thời hạn tuyển thay thế bảo hành đã hết hạn',
  REPLACEMENT_SLOT_EXTENDED: 'đã gia hạn thời gian tuyển thay thế',
  REPLACEMENT_NOT_ALLOWED: 'từ chối quyền tuyển thay thế',
  REPLACEMENT_ACCEPTED_AS_NEW_HIRE: 'chấp nhận nhân sự thay thế như một lượt tuyển mới',

  // ── 9. Finance, Fees & Commissions ───────────────────────────────────────
  SERVICE_FEE_PAYMENT_RECORDED: 'đã ghi nhận thanh toán phí dịch vụ',
  COMMISSION_EARNED: 'ghi nhận hoa hồng cho Cộng tác viên',
  SOURCING_DEPOSIT_CREATED: 'đã tạo khoản tạm ứng tìm kiếm hồ sơ',
  SOURCING_SETTLEMENT_CREATED: 'đã quyết toán chi phí tìm kiếm hồ sơ',
  COMMISSION_HELD_AFFILIATE_SUSPENDED: 'tạm giữ hoa hồng do CTV bị khóa tài khoản',
  COMMISSION_RELEASED_AFFILIATE_REACTIVATED: 'giải tỏa hoa hồng khi CTV được kích hoạt lại',
  COMMISSION_APPROVED: 'đã duyệt lệnh chi hoa hồng',
  COMMISSION_CANCELLED: 'đã hủy khoản hoa hồng',
  COMMISSION_ADJUSTED: 'đã điều chỉnh số tiền hoa hồng',
  PAYOUT_RECORDED: 'đã ghi nhận hoàn tất chi trả tiền hoa hồng',
  BUSINESS_SETTING_UPDATED: 'đã cập nhật cài đặt hệ thống',
  POSTING_PACKAGE_UPDATED: 'đã cập nhật gói tin đăng AP',

  // ── 10. IAM, Roles & Permissions ─────────────────────────────────────────
  ROLE_CREATED: 'đã tạo vai trò tùy chỉnh mới',
  ROLE_UPDATED: 'đã cập nhật vai trò tùy chỉnh',
  ROLE_DEACTIVATED: 'đã ngừng sử dụng vai trò tùy chỉnh',
  ROLE_PERMISSIONS_REPLACED: 'đã cập nhật ma trận quyền cho vai trò',
  PERMISSION_UPDATED: 'đã cập nhật thông tin quyền hệ thống',
  PERMISSION_ACTIVATED: 'đã kích hoạt quyền hệ thống',
  PERMISSION_DEACTIVATED: 'đã vô hiệu hóa quyền hệ thống',
  USER_ROLE_ASSIGNED: 'đã gán vai trò tùy chỉnh cho người dùng',
  USER_ROLE_REVOKED: 'đã thu hồi vai trò tùy chỉnh của người dùng',

  // ── 11. Disputes, Jobs & Others ──────────────────────────────────────────
  DISPUTE_CREATED: 'đã gửi khiếu nại tranh chấp',
  DISPUTE_RESOLVED: 'đã giải quyết xong khiếu nại tranh chấp',
  ATTRIBUTION_TRANSFERRED: 'đã chuyển giao quyền ghi nhận ứng viên',
  CONTACT_REQUEST_UPDATED: 'đã cập nhật xử lý yêu cầu tư vấn',
  INDUSTRY_CHANGED: 'đã thay đổi danh mục ngành nghề',
  COMPANY_FEATURED_CHANGED: 'đã thay đổi trạng thái doanh nghiệp nổi bật',
  JOB_APPROVED: 'đã phê duyệt tin tuyển dụng',
  INSERT: 'đã tạo mới dữ liệu',
  UPDATE: 'đã cập nhật dữ liệu',
  DELETE: 'đã xóa dữ liệu',
};

export const ENTITY_TYPE_LABELS: Record<string, { label: string; color?: string }> = {
  APP_USER: { label: 'Tài khoản', color: 'blue' },
  USER: { label: 'Tài khoản', color: 'blue' },
  REFRESH_TOKEN: { label: 'Phiên đăng nhập', color: 'default' },
  CANDIDATE_CV: { label: 'CV Ứng viên', color: 'cyan' },
  CANDIDATE_PROFILE: { label: 'Hồ sơ Ứng viên', color: 'geekblue' },
  CANDIDATE_IDENTITY: { label: 'Danh tính Ứng viên', color: 'purple' },
  CANDIDATE_DUPLICATE: { label: 'Trùng lặp Ứng viên', color: 'volcano' },
  SUBMISSION: { label: 'Lượt giới thiệu CTV', color: 'green' },
  APPLICATION: { label: 'Đơn ứng tuyển', color: 'magenta' },
  INTERVIEW: { label: 'Lịch phỏng vấn', color: 'orange' },
  OFFER: { label: 'Thư mời nhận việc', color: 'gold' },
  PLACEMENT: { label: 'Tuyển dụng thành công', color: 'lime' },
  JOB: { label: 'Tin tuyển dụng', color: 'blue' },
  JOB_TEMPLATE: { label: 'Mẫu tuyển dụng', color: 'cyan' },
  SERVICE_AGREEMENT: { label: 'Hợp đồng dịch vụ', color: 'purple' },
  SERVICE_FEE: { label: 'Phí dịch vụ', color: 'emerald' },
  COMMISSION: { label: 'Hoa hồng CTV', color: 'green' },
  PAYOUT: { label: 'Chi trả hoa hồng', color: 'gold' },
  WARRANTY: { label: 'Bảo hành nhân sự', color: 'red' },
  DISPUTE: { label: 'Khiếu nại tranh chấp', color: 'volcano' },
  CONTACT_REQUEST: { label: 'Yêu cầu tư vấn', color: 'cyan' },
  BUSINESS_SETTING: { label: 'Cài đặt hệ thống', color: 'default' },
  POSTING_PACKAGE: { label: 'Gói đăng tin', color: 'purple' },
  ROLE: { label: 'Vai trò', color: 'purple' },
  PERMISSION: { label: 'Quyền hệ thống', color: 'indigo' },
};

export const describeEntityType = (code?: string | null): { label: string; color?: string } => {
  if (!code) return { label: 'Hệ thống', color: 'default' };
  return ENTITY_TYPE_LABELS[code] ?? { label: code, color: 'default' };
};

/**
 * Humanizes raw technical audit action codes into clear Vietnamese phrases.
 * If code is not found in predefined dictionary, formats SNAKE_CASE gracefully.
 */
export const describeAuditAction = (code: string): string => {
  if (!code) return 'Thao tác hệ thống';
  if (PHRASES[code]) return PHRASES[code];

  // Graceful fallback for dynamic or newly introduced backend events
  return code
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
};
