/**
 * @file VerifyOtpPage.tsx
 * @description 6-Digit OTP Email Verification Screen for HR Connect.
 * Implements Swagger OpenAPI endpoint:
 *   POST /api/v1/auth/verify-email-otp
 *
 * Supports auto-advance, backspace navigation, copy-paste 6-digit detection,
 * 60s resend cooldown timer, and automatic redirection to /login?email=...&verified=true.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Input,
  Button,
  message,
  Alert,
} from 'antd';
import {
  CheckCircleFilled,
  MailOutlined,
  SafetyCertificateOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  LockOutlined,
  EditOutlined,
  CheckOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AuthPageShell, AUTH_INPUT_CLASS } from './AuthPageShell';
import { appendCandidateReturnPath, getSafeCandidateReturnPath } from './authReturnPath';

export const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Extract email from query param (?email=...) or route state
  const emailParam =
    searchParams.get('email') || (location.state as { email?: string } | undefined)?.email || '';
  const roleParam =
    searchParams.get('role') || (location.state as { role?: string } | undefined)?.role || '';
  const candidateReturnTo = getSafeCandidateReturnPath(
    searchParams.get('returnTo') || (location.state as { returnTo?: string } | undefined)?.returnTo
  );

  const [email, setEmail] = useState<string>(emailParam);
  const [tempEmail, setTempEmail] = useState<string>(emailParam);
  const [isEditingEmail, setIsEditingEmail] = useState(!emailParam);
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Autofocus first OTP box on mount or when finishing email edit
  useEffect(() => {
    if (!isEditingEmail && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [isEditingEmail]);

  // Handle single digit input change and auto-advance
  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    setErrorMessage(null);

    if (!cleaned) {
      const nextOtp = [...otpValues];
      nextOtp[index] = '';
      setOtpValues(nextOtp);
      return;
    }

    // Capture the latest digit
    const digit = cleaned.slice(-1);
    const nextOtp = [...otpValues];
    nextOtp[index] = digit;
    setOtpValues(nextOtp);

    // Auto-advance to the next input box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation between OTP boxes
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle pasting full 6-digit code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const nextOtp = [...otpValues];
    for (let i = 0; i < 6; i++) {
      nextOtp[i] = pasteData[i] || '';
    }
    setOtpValues(nextOtp);

    const focusIdx = Math.min(pasteData.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const fullOtp = otpValues.join('');

  // Handle OTP verification submission: calls POST /api/v1/auth/verify-email-otp
  const handleVerify = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      message.error('Vui lòng nhập địa chỉ email cần xác thực!');
      setIsEditingEmail(true);
      return;
    }

    if (fullOtp.length !== 6) {
      message.warning('Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số!');
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);

    try {
      // POST /api/v1/auth/verify-email-otp
      const response = await authService.verifyEmailOtp({
        email: cleanEmail,
        otp: fullOtp,
      });

      if (response.status === 200 || response.status === 201 || response.data?.success) {
        const returnStatus = response.data?.data?.status;
        const isPendingAdmin =
          returnStatus === 'PENDING_ADMIN_APPROVAL' ||
          roleParam === 'CLIENT' ||
          roleParam === 'AFFILIATE';

        if (isPendingAdmin) {
          setApprovalPending(true);
          message.success({
            content:
              'Xác thực email thành công! Hồ sơ đăng ký đã được chuyển đến Ban quản trị xem xét phê duyệt.',
            icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
            duration: 6,
          });
        } else {
          message.success({
            content: 'Kích hoạt tài khoản thành công! Vui lòng đăng nhập để tiếp tục.',
            icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
            duration: 5,
          });

          // Redirect to /login with email and verified=true
          navigate(appendCandidateReturnPath(`/login?email=${encodeURIComponent(cleanEmail)}&verified=true`, candidateReturnTo), {
            replace: true,
            state: { email: cleanEmail, verified: true, returnTo: candidateReturnTo },
          });
        }
      } else {
        const errorDetail = response.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn!';
        setErrorMessage(errorDetail);
        message.error(errorDetail);
      }
    } catch (err: unknown) {
      const formattedError = getApiErrorMessage(
        err,
        'Mã xác thực OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại!'
      );
      setErrorMessage(formattedError);
      message.error(formattedError);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Resend OTP Code
  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      message.error('Vui lòng nhập địa chỉ email!');
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      await authService.resendVerificationOtp(cleanEmail);
      message.success({
        content: `Mã OTP mới đã được gửi tới ${cleanEmail}!`,
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      });
      setResendCooldown(60);
      setOtpValues(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const formattedError = getApiErrorMessage(
        err,
        'Không thể gửi lại mã OTP vào lúc này. Vui lòng đợi trong giây lát!'
      );
      setErrorMessage(formattedError);
      message.error(formattedError);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPageShell
      wide={approvalPending}
      eyebrow="Bảo vệ tài khoản"
      title={approvalPending ? 'Hồ sơ đã được gửi xét duyệt' : 'Xác thực email của bạn'}
      description={approvalPending ? 'Bạn đã hoàn tất bước xác thực email. Hệ thống sẽ thông báo khi hồ sơ được duyệt.' : 'Nhập mã gồm 6 chữ số trong email để hoàn tất bước đăng ký.'}
      sideTitle="Chỉ còn một bước để hoàn tất đăng ký."
      sideDescription="Xác thực email giúp bảo vệ danh tính và đảm bảo mọi thông báo tuyển dụng được gửi đúng người."
      benefits={[
        'Mã xác thực chỉ có hiệu lực trong thời gian giới hạn',
        'Có thể yêu cầu gửi lại nếu bạn chưa nhận được email',
        'Client và Affiliate sẽ được thông báo sau khi Admin xét duyệt',
      ]}
    >
      {approvalPending ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-amber-500 shadow-sm">
            <ClockCircleOutlined />
          </div>
          <h2 className="m-0 text-xl font-black text-slate-900">Email đã được xác thực</h2>
          <p className="mx-auto mb-5 mt-3 max-w-md text-sm leading-6 text-slate-600">
            {roleParam === 'CLIENT'
              ? 'Ban quản trị đang kiểm tra thông tin doanh nghiệp. Bạn sẽ nhận email ngay khi tài khoản được kích hoạt.'
              : 'Ban quản trị đang xem xét hồ sơ Affiliate. Bạn sẽ nhận email ngay khi tài khoản được kích hoạt.'}
          </p>
          <div className="mb-6 rounded-xl border border-amber-200 bg-white p-4 text-left text-sm">
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
              <span className="text-slate-500">Email</span>
              <strong className="break-all text-slate-800">{email}</strong>
            </div>
            <div className="flex flex-wrap justify-between gap-2 pt-3">
              <span className="text-slate-500">Trạng thái</span>
              <strong className="text-amber-700">Đang chờ Admin xét duyệt</strong>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => navigate('/')}
              className="!h-11 rounded-xl border-slate-300 !px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Về trang chủ
            </Button>
            <Button
              type="primary"
              onClick={() => navigate(`/login?email=${encodeURIComponent(email)}`)}
              className="!h-11 rounded-xl border-0 bg-blue-600 !px-3 text-xs sm:text-sm font-semibold !text-white hover:!bg-blue-700"
            >
              Đến trang đăng nhập
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold text-blue-900"><MailOutlined /> Email nhận mã</span>
              {!isEditingEmail && (
                <button type="button" onClick={() => { setTempEmail(email); setIsEditingEmail(true); }} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-blue-700 hover:text-blue-900">
                  <EditOutlined /> Thay đổi
                </button>
              )}
            </div>
            {isEditingEmail ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input size="large" type="email" value={tempEmail} onChange={(event) => setTempEmail(event.target.value)} placeholder="ten@email.com" className={AUTH_INPUT_CLASS} />
                <Button size="large" type="primary" icon={<CheckOutlined />} onClick={() => { if (tempEmail.trim()) { setEmail(tempEmail.trim()); setIsEditingEmail(false); } }} className="h-12 rounded-xl bg-blue-600 font-bold">Lưu email</Button>
              </div>
            ) : (
              <strong className="block break-all text-sm text-slate-800">{email || 'Chưa cung cấp email'}</strong>
            )}
          </div>

          {errorMessage && (
            <Alert message="Mã xác thực chưa hợp lệ" description={errorMessage} type="error" showIcon closable onClose={() => setErrorMessage(null)} className="mb-5 rounded-xl" />
          )}

          <div className="mb-6">
            <label className="mb-3 block text-center text-sm font-bold text-slate-700">Nhập mã xác thực gồm 6 chữ số</label>
            <div className="flex justify-center gap-2 sm:gap-3">
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  ref={(element) => { inputRefs.current[index] = element; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Số thứ ${index + 1} của mã OTP`}
                  maxLength={1}
                  value={value}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  disabled={isVerifying}
                  className={`h-14 w-11 rounded-xl border text-center text-2xl font-black outline-none transition sm:h-16 sm:w-14 ${
                    value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  }`}
                />
              ))}
            </div>
            <p className="mb-0 mt-3 text-center text-xs text-slate-500">Bạn có thể dán toàn bộ mã OTP vào bất kỳ ô nào.</p>
          </div>

          <Button type="primary" size="large" onClick={handleVerify} loading={isVerifying} disabled={isVerifying || fullOtp.length !== 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-0 bg-blue-600 font-bold shadow-lg shadow-blue-600/20 hover:!bg-blue-700">
            <SafetyCertificateOutlined />
            <span>Xác thực email</span>
          </Button>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
            <span>Chưa nhận được mã?</span>
            {resendCooldown > 0 ? (
              <span>Gửi lại sau <strong className="text-blue-700">{resendCooldown}s</strong></span>
            ) : (
              <button type="button" onClick={handleResend} disabled={isResending} className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50">
                <ReloadOutlined spin={isResending} /> Gửi lại mã
              </button>
            )}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5 text-sm">
            <Link to="/register" className="font-semibold text-slate-500 hover:text-slate-800"><ArrowLeftOutlined /> Đăng ký lại</Link>
            <Link to="/login" className="font-bold text-blue-700 hover:text-blue-900">Đăng nhập</Link>
          </div>
        </>
      )}
    </AuthPageShell>
  );
};

export default VerifyOtpPage;
