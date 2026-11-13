/**
 * @file VerifyOtpPage.tsx
 * @description 6-Digit OTP Email Verification Screen for HR Connect (mockup 03/11, Page 17 left card: "Xác minh email").
 * Implements Swagger OpenAPI endpoint:
 *   POST /api/v1/auth/verify-email-otp
 *
 * Supports auto-advance, backspace navigation, copy-paste 6-digit detection,
 * 60s resend cooldown timer, and automatic redirection to /login?email=...&verified=true.
 */

import React, { useState, useEffect, useRef } from 'react';
import { App } from 'antd';
import { CheckCircleFilled, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { appendCandidateReturnPath, getSafeCandidateReturnPath } from './authReturnPath';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'font-semibold text-[#0369A1] no-underline transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] rounded';
const BUTTON = `${FONT} h-11 w-full touch-manipulation cursor-pointer rounded-xl border-0 bg-[#0369A1] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60`;
const SECONDARY_BTN = `${FONT} inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center rounded-xl border border-solid border-[#DCE3EC] bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.99]`;
const INPUT = `${FONT} box-border h-11 w-full rounded-xl border border-solid border-[#CBD5E1] bg-white px-3.5 text-base sm:text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none hover:border-slate-400 focus:border-[#0369A1] focus:ring-4 focus:ring-[#0369A1]/12`;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const VerifyOtpPage: React.FC = () => {
  const { message } = App.useApp();
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
  const handleVerify = async (event?: React.FormEvent) => {
    event?.preventDefault();
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
    <div className={`${FONT} min-h-screen bg-[#F4F7FA] text-sm text-slate-900 antialiased [line-height:normal]`}>
      <header className="bg-[#08253C] text-white">
        <div className="mx-auto flex h-16 max-w-[1248px] items-center px-6">
          <Link to="/" className="flex items-center gap-2.5 text-[18px] font-bold text-white no-underline transition-opacity hover:opacity-90">
            <BrandMark size={32} tone="light" className="block" /> HR Connect
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1048px] justify-center px-4 py-12 sm:px-6">
        <section
          aria-labelledby="verify-email-title"
          className="w-full max-w-[488px] rounded-2xl border border-solid border-[#DCE3EC] bg-white p-6 shadow-[0_1px_2px_rgba(8,37,60,0.05),0_16px_36px_-12px_rgba(8,37,60,0.09)] sm:p-8 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          {approvalPending ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3C7] text-2xl text-[#D97706]">
                <ClockCircleOutlined />
              </div>
              <h1 id="verify-email-title" className="m-0 text-[20px] font-bold text-[#1F2937]">
                Email đã được xác minh
              </h1>
              <p className="mx-auto mb-5 mt-2 text-[13.5px] leading-6 text-[#4B5563]">
                {roleParam === 'CLIENT'
                  ? 'Ban quản trị đang kiểm tra thông tin doanh nghiệp. Bạn sẽ nhận email ngay khi tài khoản được kích hoạt.'
                  : 'Ban quản trị đang xem xét hồ sơ Affiliate. Bạn sẽ nhận email ngay khi tài khoản được kích hoạt.'}
              </p>
              <div className="mb-5 rounded-md border border-solid border-[#E5E7EB] bg-[#F9FAFB] p-4 text-left text-[13px]">
                <div className="flex flex-wrap justify-between gap-2 border-0 border-b border-solid border-[#E5E7EB] pb-2.5">
                  <span className="text-[#6B7280]">Email</span>
                  <strong className="break-all font-semibold text-[#1F2937]">{email}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-2 pt-2.5">
                  <span className="text-[#6B7280]">Trạng thái</span>
                  <strong className="font-semibold text-[#B45309]">Đang chờ Admin xét duyệt</strong>
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button type="button" onClick={() => navigate('/')} className={SECONDARY_BTN}>
                  Về trang chủ
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/login?email=${encodeURIComponent(email)}`)}
                  className={BUTTON}
                >
                  Đến trang đăng nhập
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} noValidate>
              <h1 id="verify-email-title" className="m-0 text-[20px] font-bold text-[#1F2937]">
                Xác minh email
              </h1>

              {isEditingEmail ? (
                <div className="mt-3">
                  <label htmlFor="verify-email-input" className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                    Địa chỉ email nhận mã xác minh
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="verify-email-input"
                      type="email"
                      value={tempEmail}
                      onChange={(event) => setTempEmail(event.target.value)}
                      placeholder="ten@email.com"
                      className={INPUT}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempEmail.trim()) {
                          setEmail(tempEmail.trim());
                          setIsEditingEmail(false);
                        }
                      }}
                      className={`${SECONDARY_BTN} shrink-0`}
                    >
                      Lưu email
                    </button>
                  </div>
                </div>
              ) : (
                <p className="m-0 mt-1.5 break-words text-[14px] text-[#4B5563]">
                  Nhập mã 6 số đã gửi đến <strong className="font-semibold text-[#111827]">{email}</strong>.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTempEmail(email);
                      setIsEditingEmail(true);
                    }}
                    className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}
                  >
                    Đổi email
                  </button>
                </p>
              )}

              <div className="mt-5 grid grid-cols-6 gap-2 sm:gap-2.5">
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
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
                    className={`${FONT} h-[56px] w-full rounded-xl border border-solid bg-white text-center text-[20px] font-bold text-slate-900 outline-none transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none ${
                      value
                        ? 'border-[#0369A1] bg-[#EEF6FB]/40 ring-2 ring-[#0369A1]/15'
                        : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1] focus:ring-4 focus:ring-[#0369A1]/12'
                    }`}
                  />
                ))}
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  className="m-0 mt-3 rounded-xl border border-solid border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isVerifying || fullOtp.length !== 6}
                className={`${BUTTON} mt-5`}
              >
                {isVerifying ? 'Đang xác minh…' : 'Xác minh'}
              </button>

              <p className="m-0 mt-4 text-[13px] text-[#4B5563]">
                Chưa nhận được mã? Kiểm tra thư rác hoặc{' '}
                {resendCooldown > 0 ? (
                  <span className="text-[#4B5563]">gửi lại sau {clock(resendCooldown)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium ${LINK} disabled:opacity-50`}
                  >
                    {isResending ? 'đang gửi…' : 'gửi lại mã'}
                  </button>
                )}
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default VerifyOtpPage;
