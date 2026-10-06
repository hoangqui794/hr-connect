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
  Typography,
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

const { Title, Text, Paragraph } = Typography;

export const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Extract email from query param (?email=...) or route state
  const emailParam =
    searchParams.get('email') || (location.state as { email?: string } | undefined)?.email || '';
  const roleParam =
    searchParams.get('role') || (location.state as { role?: string } | undefined)?.role || '';

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
          navigate(`/login?email=${encodeURIComponent(cleanEmail)}&verified=true`, {
            replace: true,
            state: { email: cleanEmail, verified: true },
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/')}
          className="text-center mb-6 cursor-pointer select-none group"
          title="Quay về trang chủ"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
            H
          </div>
          <Title
            level={3}
            style={{
              color: '#ffffff',
              margin: '0 0 4px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontSize: '24px',
            }}
          >
            Xác thực tài khoản
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: '14px' }}>
            Nhập mã OTP 6 chữ số được gửi tới email của bạn
          </Text>
        </div>

        {/* Verification Card / Approval Card */}
        {approvalPending ? (
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400 text-3xl">
              <ClockCircleOutlined />
            </div>
            <Title level={4} style={{ color: '#ffffff', margin: '0 0 8px', fontWeight: 700 }}>
              Xác thực email thành công!
            </Title>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
              Trạng thái: Chờ Ban quản trị phê duyệt
            </div>
            <Paragraph style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }} className="mb-4">
              {roleParam === 'CLIENT'
                ? 'Tài khoản Doanh nghiệp tuyển dụng của bạn đã hoàn tất xác thực email. Ban quản trị HRConnect đang tiến hành thẩm định hồ sơ công ty.'
                : 'Tài khoản Đối tác tuyển dụng (Affiliate Recruiter) của bạn đã hoàn tất xác thực email và đang được chuyển đến Ban quản trị xem xét.'}
            </Paragraph>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-left text-xs text-slate-400 space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-200 font-medium">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Loại tài khoản:</span>
                <span className="text-blue-400 font-medium">
                  {roleParam === 'CLIENT' ? 'Doanh nghiệp (Client)' : 'Cộng tác viên (Affiliate Recruiter)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian xử lý:</span>
                <span className="text-slate-200 font-medium">Trong vòng 24 giờ làm việc</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <Button
                type="primary"
                size="large"
                onClick={() => navigate('/')}
                className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 border-none"
              >
                Về trang chủ
              </Button>
              <Button
                size="large"
                onClick={() => navigate(`/login?email=${encodeURIComponent(email)}`)}
                className="w-full h-11 rounded-xl text-sm bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
              >
                Đến trang đăng nhập
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            {/* Email Info Display & Edit */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 mb-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <MailOutlined className="text-blue-400" />
                  Email nhận mã OTP:
                </span>
                {!isEditingEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempEmail(email);
                      setIsEditingEmail(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                  >
                    <EditOutlined /> Thay đổi
                  </button>
                )}
              </div>

              {isEditingEmail ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    size="middle"
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="rounded-lg !bg-slate-900 !border-slate-700 !text-slate-100"
                  />
                  <Button
                    size="middle"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      if (tempEmail.trim()) {
                        setEmail(tempEmail.trim());
                        setIsEditingEmail(false);
                      }
                    }}
                    className="rounded-lg bg-blue-600"
                  >
                    Lưu
                  </Button>
                </div>
              ) : (
                <div className="font-semibold text-slate-200 text-sm truncate select-all">
                  {email || 'Chưa cung cấp email'}
                </div>
              )}
            </div>

            {/* Backend Error Alert */}
            {errorMessage && (
              <Alert
                message={errorMessage}
                type="error"
                showIcon
                closable
                onClose={() => setErrorMessage(null)}
                className="mb-5 text-xs rounded-xl"
              />
            )}

            {/* ─── 6-Digit OTP Boxes ─── */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-3 text-center">
                Mã xác thực OTP (6 chữ số)
              </label>
              <div className="flex justify-between gap-2 sm:gap-2.5">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    disabled={isVerifying}
                    className={`w-12 h-14 sm:w-13 sm:h-15 text-center text-2xl font-bold rounded-xl transition-all duration-200 outline-none select-all ${
                      val
                        ? 'bg-blue-950/40 border-2 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 hover:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-slate-500 text-center mt-2.5">
                Hỗ trợ phím mũi tên, xóa lùi và dán (Paste) nhanh cả 6 số
              </div>
            </div>

            {/* Submit Verification Button */}
            <Button
              type="primary"
              size="large"
              onClick={handleVerify}
              loading={isVerifying}
              disabled={isVerifying || fullOtp.length !== 6}
              className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.99]"
            >
              <SafetyCertificateOutlined />
              <span>Xác nhận kích hoạt tài khoản</span>
            </Button>

            {/* Resend OTP Section */}
            <div className="flex items-center justify-center gap-2 mt-5 text-xs text-slate-400">
              <span>Chưa nhận được mã?</span>
              {resendCooldown > 0 ? (
                <span className="text-slate-500 font-medium">
                  Gửi lại sau <strong className="text-blue-400">{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                >
                  <ReloadOutlined spin={isResending} />
                  <span>Gửi lại mã ngay</span>
                </button>
              )}
            </div>

            {/* Back to Login / Register Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
              <Link
                to="/register"
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeftOutlined /> Đăng ký lại
              </Link>
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Đăng nhập ngay
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyOtpPage;
