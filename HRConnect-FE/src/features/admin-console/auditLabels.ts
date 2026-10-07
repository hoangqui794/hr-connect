/**
 * @file auditLabels.ts
 * @description Vietnamese phrases for audit action codes (HRConnect.Application AuditActions,
 * plus AI scoring and raw trigger events). Unknown codes fall back to the code itself.
 */
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

const PHRASES: Record<string, string> = {
  AFFILIATE_APPROVED: 'đã duyệt một Cộng tác viên',
  AFFILIATE_REJECTED: 'đã từ chối một Cộng tác viên',
  CLIENT_APPROVED: 'đã xác thực một doanh nghiệp',
  CLIENT_REJECTED: 'đã từ chối xác thực doanh nghiệp',
  EMAIL_VERIFIED: 'đã xác thực email',
  AFFILIATE_REGISTERED: 'đã đăng ký làm Cộng tác viên',
  CLIENT_REGISTERED: 'đã đăng ký doanh nghiệp',
  CANDIDATE_REGISTERED: 'đã đăng ký ứng viên',
  PASSWORD_CHANGED: 'đã đổi mật khẩu',
  PASSWORD_RESET: 'đã đặt lại mật khẩu',
  SESSION_REVOKED: 'đã đăng xuất một phiên',
  ALL_SESSIONS_REVOKED: 'đã đăng xuất mọi phiên',
  REFRESH_TOKEN_REUSE_DETECTED: 'phát hiện refresh token bị dùng lại',
  CV_UPLOADED: 'đã tải lên CV',
  CV_UPDATED: 'đã cập nhật CV',
  CV_PRIMARY_SET: 'đã đặt CV chính',
  CV_DELETED: 'đã xóa CV',
  APPLICATION_SUBMITTED: 'đã nộp hồ sơ ứng tuyển',
  AFFILIATE_SUBMISSION_CREATED: 'đã giới thiệu một ứng viên',
  SUBMISSION_DUPLICATE_BLOCKED: 'chặn một lượt giới thiệu trùng',
  SUBMISSION_CONSENT_CONFIRMED: 'đã đồng ý cho Cộng tác viên giới thiệu',
  SUBMISSION_CONSENT_DECLINED: 'đã từ chối lời giới thiệu',
  SUBMISSION_CONSENT_EXPIRED: 'lời mời xác nhận đã hết hạn',
  SUBMISSION_CONSENT_CLOSED: 'đã đóng lời mời xác nhận',
  USER_SUSPENDED: 'đã tạm khóa một tài khoản',
  USER_REACTIVATED: 'đã kích hoạt lại một tài khoản',
  USER_LOGIN_UNLOCKED: 'đã mở khóa đăng nhập',
  APPLICATION_STATUS_CHANGED: 'đã đổi trạng thái hồ sơ',
  APPLICATION_SCREENED: 'đã sàng lọc một hồ sơ',
  APPLICATION_BACKUP_DECIDED: 'đã quyết định hồ sơ dự bị',
  APPLICATION_WITHDRAWN: 'đã rút hồ sơ',
  INTERVIEW_SCHEDULED: 'đã lên lịch phỏng vấn',
  INTERVIEW_RESCHEDULED: 'đã dời lịch phỏng vấn',
  INTERVIEW_CANCELLED: 'đã hủy lịch phỏng vấn',
  INTERVIEW_RESULT_RECORDED: 'đã ghi kết quả phỏng vấn',
  OFFER_SENT: 'đã gửi offer',
  OFFER_ACCEPTED: 'đã nhận offer',
  OFFER_DECLINED: 'đã từ chối offer',
  OFFER_WITHDRAWN: 'đã rút offer',
  OFFER_EXPIRED: 'offer đã hết hạn',
  PLACEMENT_CONFIRMED: 'đã xác nhận ứng viên đi làm',
  AI_SCORING_REQUESTED: 'đã yêu cầu AI chấm điểm',
  AI_SCORING_RETRY_REQUESTED: 'đã yêu cầu AI chấm lại',
  AI_SCORING_COMPLETED: 'đã chấm điểm xong một hồ sơ',
  AI_SCORING_FAILED: 'chấm điểm AI thất bại',
  INSERT: 'đã tạo dữ liệu',
  UPDATE: 'đã cập nhật dữ liệu',
  DELETE: 'đã xóa dữ liệu',
};

export const describeAuditAction = (code: string): string => PHRASES[code] ?? code;
