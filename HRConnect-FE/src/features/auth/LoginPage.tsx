/**
 * @file LoginPage.tsx
 * @description Premium, high-craft Login page conforming to Vercel Web Interface Guidelines
 * and Anthropic Frontend Design Standards.
 * - Symmetrical, clean split layout with deep navy branding & soft warm neutral canvas.
 * - Focus rings (:focus-visible), keyboard accessible, zero layout shift (CLS).
 * - "Chưa có tài khoản? Đăng ký ngay" placed elegantly at the bottom of the form for optimal visual hierarchy.
 * - Clear, purposeful typography and microcopy.
 */

import React, { useState, useEffect, useRef } from 'react';
import { App } from 'antd';
import {
  CheckCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { useAuthStore, type UserProfile, getInitials } from '@/stores/authStore';
import { UserRole, ROLE_LABELS, mapApiRoleToUserRole } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/routeHelpers';
import { authService, type LoginResponse, type CurrentUserResponse } from '@/services/authService';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { getSafeCandidateReturnPath } from './authReturnPath';
import { RegisterFormPanel } from './RegisterPage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_APPROVAL_REGEX = /pending Admin approval|chờ Admin duyệt|chờ Ban quản trị/;

const WORKSPACE_PREFIX: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.CLIENT]: '/client',
  [UserRole.INTERNAL_HR]: '/hr',
  [UserRole.AFFILIATE]: '/affiliate',
  [UserRole.CANDIDATE]: '/candidate',
};

const belongsToRoleWorkspace = (role: UserRole, path: string): boolean => {
  const own = WORKSPACE_PREFIX[role];
  const isUnder = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (own && isUnder(own)) return true;
  return !Object.values(WORKSPACE_PREFIX).some((prefix) => prefix && isUnder(prefix));
};

const LOGIN_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80';
const RESEND_SECONDS = 60;
const FORGOT_PASSWORD_RULE = 'Mật khẩu mới ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
const strongPassword = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);

type AuthPanelMode = 'login' | 'forgot' | 'register';
type TransitionStage = 'idle' | 'exiting' | 'entering';

const HERO_META: Record<
  AuthPanelMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    cards: { title: string; desc: string }[];
  }
> = {
  login: {
    eyebrow: 'Hệ sinh thái tuyển dụng tích hợp AI',
    title: 'Tìm việc, tuyển dụng & kết nối nhân sự thông minh',
    description:
      'Nền tảng một điểm chạm kết nối Doanh nghiệp, Ứng viên và Mạng lưới Cộng tác viên tuyển dụng trên toàn quốc.',
    cards: [
      {
        title: 'Doanh nghiệp & Việc làm xác minh',
        desc: 'Việc làm đang mở từ các công ty đã xác minh',
      },
      {
        title: 'Minh bạch tiến độ tuyển dụng',
        desc: 'Theo dõi hành trình hồ sơ thời gian thực: từ Sàng lọc AI, Phỏng vấn, Nhận offer đến Đi làm.',
      },
    ],
  },
  forgot: {
    eyebrow: 'Bảo mật tài khoản 2 lớp',
    title: 'Khôi phục quyền truy cập nhanh chóng & an toàn',
    description:
      'Xác thực danh tính qua mã OTP 6 chữ số gửi trực tiếp tới email đã đăng ký để thiết lập lại mật khẩu mới.',
    cards: [
      {
        title: 'Bước 1 — Xác minh địa chỉ email',
        desc: 'Nhập email chính hoặc email phụ đã liên kết để nhận mã OTP có hiệu lực trong vài phút.',
      },
      {
        title: 'Bước 2 — Thiết lập mật khẩu mới',
        desc: 'Mật khẩu mới được mã hóa an toàn và tự động đồng bộ ngay trên toàn hệ thống.',
      },
    ],
  },
  register: {
    eyebrow: 'Gia nhập mạng lưới HR Connect',
    title: 'Khởi tạo tài khoản phù hợp với vai trò của bạn',
    description:
      'Dù bạn là ứng viên tìm kiếm cơ hội, doanh nghiệp tuyển dụng hay cộng tác viên giới thiệu nhân sự, mọi công cụ đều sẵn sàng.',
    cards: [
      {
        title: 'Kích hoạt nhanh qua OTP',
        desc: 'Chỉ mất chưa đầy 1 phút để xác thực email và mở khóa không gian làm việc riêng.',
      },
      {
        title: 'Quyền lợi & bảo mật rõ ràng',
        desc: 'Hồ sơ ứng viên, tin tuyển dụng và hoa hồng cộng tác viên được bảo vệ minh bạch.',
      },
    ],
  },
};

export const LoginPage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setAuthSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedSuccessNotice, setVerifiedSuccessNotice] = useState<string | null>(null);
  const [inlinePasswordResetSuccess, setInlinePasswordResetSuccess] = useState(false);

  const [panelMode, setPanelMode] = useState<AuthPanelMode>('login');
  const [transitionStage, setTransitionStage] = useState<TransitionStage>('idle');
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const exitTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  // Inline Forgot Password state
  const [forgotStep, setForgotStep] = useState<'EMAIL' | 'RESET'>('EMAIL');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPwd, setShowForgotNewPwd] = useState(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState(false);
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});
  const [forgotFormError, setForgotFormError] = useState<string | null>(null);
  const [forgotNotice, setForgotNotice] = useState<string | null>(null);
  const [forgotPending, setForgotPending] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = window.setTimeout(() => setForgotCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [forgotCooldown]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
    };
  }, []);

  const switchPanel = (target: AuthPanelMode, direction: 'forward' | 'backward') => {
    if (target === panelMode && transitionStage === 'idle') return;
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);

    setSlideDirection(direction);
    setTransitionStage('exiting');

    exitTimerRef.current = window.setTimeout(() => {
      setPanelMode(target);
      setTransitionStage('entering');
      exitTimerRef.current = null;

      enterTimerRef.current = window.setTimeout(() => {
        setTransitionStage('idle');
        enterTimerRef.current = null;
      }, 440);
    }, 115);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const isVerifiedParam = params.get('verified') === 'true';

    if (emailParam) {
      setEmail(emailParam.trim());
    }

    if (isVerifiedParam) {
      setVerifiedSuccessNotice(
        'Tài khoản của bạn đã được kích hoạt thành công! Vui lòng nhập mật khẩu để đăng nhập.'
      );
    }
  }, [location.search]);

  const returnedFromReset = location.state as { email?: string; passwordReset?: boolean } | null;
  useEffect(() => {
    if (returnedFromReset?.email) {
      setEmail(returnedFromReset.email);
      setPassword('');
    }
  }, [returnedFromReset]);

  const openJobs = usePublicJobSearch({ page: 1, pageSize: 1 }).data?.totalCount ?? 0;

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: { email?: string; password?: string } = {};
    if (!email.trim()) found.email = 'Vui lòng nhập địa chỉ email.';
    else if (!EMAIL_REGEX.test(email.trim())) found.email = 'Email chưa đúng định dạng.';
    if (!password) found.password = 'Vui lòng nhập mật khẩu.';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) {
      const firstErrorId = found.email ? 'login-email' : 'login-password';
      document.getElementById(firstErrorId)?.focus();
      return;
    }

    const values = { email, password };
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const response: LoginResponse = await authService.login({
        email: values.email.trim(),
        password: values.password || '',
      });

      if (!response.success || !response.data) {
        const msg =
          response.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin tài khoản!';
        setErrorMessage(msg);
        return;
      }

      const loginData = response.data;
      const accessToken = loginData.accessToken || '';

      let resolvedRole: UserRole = UserRole.CANDIDATE;
      let userProfile: UserProfile;

      try {
        const meRes: CurrentUserResponse = await authService.getCurrentUser();
        if (meRes.success && meRes.data) {
          const userDto = meRes.data;
          resolvedRole = mapApiRoleToUserRole(userDto.roles);

          setAuthSession(userDto, accessToken);

          userProfile = {
            id: userDto.userId,
            name: userDto.displayName || values.email.split('@')[0],
            email: userDto.email || values.email,
            role: resolvedRole,
            avatar: userDto.avatarUrl || getInitials(userDto.displayName || values.email),
          };
        } else {
          throw new Error('Fallback to LoginData user');
        }
      } catch {
        const apiUser = loginData.user;
        resolvedRole = mapApiRoleToUserRole(apiUser?.roles);

        userProfile = {
          id: apiUser?.userId || `usr-${Date.now()}`,
          name: apiUser?.displayName || values.email.split('@')[0],
          email: apiUser?.email || values.email,
          role: resolvedRole,
          avatar: getInitials(apiUser?.displayName || values.email),
        };

        login(resolvedRole, userProfile);
      }

      message.success({
        content: `Đăng nhập thành công với vai trò: ${ROLE_LABELS[resolvedRole] || resolvedRole}`,
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      });

      const redirectState = location.state as { from?: string; intent?: string } | undefined;
      const redirectFrom = redirectState?.from;
      const emailReturnTo = getSafeCandidateReturnPath(new URLSearchParams(location.search).get('returnTo'));
      const destination =
        resolvedRole === UserRole.CANDIDATE
          ? emailReturnTo || (redirectFrom && redirectFrom !== '/login' && redirectFrom !== '/candidate/dashboard' && belongsToRoleWorkspace(resolvedRole, redirectFrom) ? redirectFrom : '/')
          : redirectFrom && redirectFrom !== '/login' && belongsToRoleWorkspace(resolvedRole, redirectFrom)
          ? redirectFrom
          : getDashboardRouteForRole(resolvedRole);

      navigate(destination, {
        replace: true,
        state: redirectState?.intent ? { intent: redirectState.intent } : undefined,
      });
    } catch (err: unknown) {
      const formattedError = getApiErrorMessage(err);
      setErrorMessage(formattedError);
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(email.trim());
    setForgotStep('EMAIL');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotErrors({});
    setForgotFormError(null);
    setForgotNotice(null);
    switchPanel('forgot', 'forward');
  };

  const openRegisterPanel = () => {
    switchPanel('register', 'forward');
  };

  const switchBackToLogin = (prefillEmail?: string) => {
    if (prefillEmail) {
      setEmail(prefillEmail.trim());
    }
    switchPanel('login', 'backward');
  };

  const requestForgotCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = forgotEmail.trim();
    if (!EMAIL_REGEX.test(address)) {
      setForgotErrors({ email: 'Vui lòng nhập đúng địa chỉ email.' });
      document.getElementById('forgot-email')?.focus();
      return;
    }

    setForgotErrors({});
    setForgotFormError(null);
    setForgotPending(true);
    try {
      await authService.forgotPassword(address);
      setForgotEmail(address);
      setForgotNotice(`Nếu email ${address} tồn tại trong hệ thống, mã OTP 6 chữ số đã được gửi.`);
      setForgotStep('RESET');
      setForgotCooldown(RESEND_SECONDS);
    } catch (error) {
      const failure = getApiError(error, 'Không thể gửi yêu cầu khôi phục mật khẩu.');
      if (failure.retryAfterSeconds) setForgotCooldown(failure.retryAfterSeconds);
      setForgotFormError(failure.message);
    } finally {
      setForgotPending(false);
    }
  };

  const resendForgotCode = async () => {
    if (forgotCooldown > 0 || forgotPending) return;
    setForgotFormError(null);
    setForgotPending(true);
    try {
      await authService.resendForgotPasswordOtp(forgotEmail);
      setForgotNotice(`Đã gửi lại mã OTP tới ${forgotEmail}.`);
      setForgotCooldown(RESEND_SECONDS);
    } catch (error) {
      const failure = getApiError(error, 'Chưa gửi lại được mã OTP.');
      if (failure.retryAfterSeconds) setForgotCooldown(failure.retryAfterSeconds);
      setForgotFormError(failure.message);
    } finally {
      setForgotPending(false);
    }
  };

  const submitResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!/^\d{6}$/.test(forgotOtp.trim())) found.otp = 'Vui lòng nhập đủ 6 chữ số OTP.';
    if (!strongPassword(forgotNewPassword)) found.newPassword = FORGOT_PASSWORD_RULE;
    if (forgotConfirmPassword !== forgotNewPassword) found.confirmPassword = 'Hai mật khẩu chưa khớp.';
    setForgotErrors(found);
    if (Object.keys(found).length > 0) return;

    setForgotFormError(null);
    setForgotPending(true);
    try {
      await authService.resetPassword({
        email: forgotEmail,
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
      });
      setEmail(forgotEmail.trim().toLowerCase());
      setPassword('');
      setInlinePasswordResetSuccess(true);
      switchPanel('login', 'backward');
    } catch (error) {
      setForgotFormError(getApiErrorMessage(error, 'Mã OTP không đúng hoặc đã hết hạn.'));
    } finally {
      setForgotPending(false);
    }
  };

  const pendingApproval = errorMessage && PENDING_APPROVAL_REGEX.test(errorMessage);

  const renderLoginPanel = () => (
    <>
      {/* Header */}
      <div className="text-left">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <Link to="/" className="inline-flex items-center gap-2 no-underline">
            <BrandMark size={32} tone="dark" />
            <span className="text-lg font-bold text-slate-900">HR Connect</span>
          </Link>
        </div>
        <p className="mb-1.5 text-xs font-semibold text-[#0369A1]">
          Cổng đăng nhập thống nhất
        </p>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
          Chào mừng trở lại
        </h1>
        <p className="mt-1.5 mb-0 text-sm leading-relaxed text-slate-600">
          Nhập thông tin xác thực để truy cập không gian làm việc của bạn.
        </p>
      </div>

      {/* Status alerts */}
      {(returnedFromReset?.passwordReset || inlinePasswordResetSuccess) && (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs font-medium text-teal-900">
          Đã đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới của bạn.
        </div>
      )}
      {verifiedSuccessNotice && (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs font-medium text-teal-900">
          {verifiedSuccessNotice}
        </div>
      )}

      {/* Form */}
      <form noValidate onSubmit={handleFormSubmit} className="mt-6 space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="login-email" className="block text-[13px] font-semibold text-slate-700">
            Email
          </label>
          <div className="mt-1.5">
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="Email chính hoặc email phụ đã liên kết…"
              value={email}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              className={`block h-11 w-full rounded-xl border bg-white px-3.5 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                fieldErrors.email
                  ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                  : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p id="login-email-error" className="mt-1.5 mb-0 text-xs font-medium text-rose-700">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="block text-[13px] font-semibold text-slate-700">
              Mật khẩu
            </label>
            <button
              type="button"
              onClick={openForgotPassword}
              className="min-h-[28px] touch-manipulation border-0 bg-transparent p-0 cursor-pointer text-xs font-semibold text-[#0369A1] transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] rounded shadow-none"
            >
              Quên mật khẩu?
            </button>
          </div>
          <div className="relative mt-1.5">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu…"
              value={password}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              className={`block h-11 w-full rounded-xl border bg-white px-3.5 pr-12 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                fieldErrors.password
                  ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                  : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
              }`}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute inset-y-0 right-0 flex min-w-[44px] min-h-[44px] touch-manipulation cursor-pointer items-center justify-center rounded-r-xl border-0 bg-transparent p-0 text-slate-400 transition-colors duration-150 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0369A1] shadow-none"
            >
              <span aria-hidden="true" className="flex items-center justify-center">
                {showPassword ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
              </span>
            </button>
          </div>
          {fieldErrors.password && (
            <p id="login-password-error" className="mt-1.5 mb-0 text-xs font-medium text-rose-700">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Error notifications */}
        {pendingApproval ? (
          <div role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 leading-relaxed">
            <b className="font-semibold">Tài khoản đang chờ xét duyệt.</b> Email đã được xác thực thành công. Ban quản trị đang thẩm định hồ sơ công ty/affiliate và sẽ kích hoạt trong thời gian sớm nhất.
          </div>
        ) : errorMessage ? (
          <div role="alert" aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 leading-relaxed">
            {errorMessage}
          </div>
        ) : null}

        {/* Submit Button */}
        <div className="pt-1.5">
          <button
            type="submit"
            disabled={submitting}
            className="group relative flex h-12 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                <span>Đang xác thực…</span>
              </span>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRightOutlined aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </>
            )}
          </button>
        </div>

        {/* Smart Portal Notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#DCE3EC] bg-[#F8FAFC] p-3 text-xs text-slate-600 leading-relaxed">
          <InfoCircleOutlined aria-hidden="true" className="mt-0.5 shrink-0 text-[#0369A1]" />
          <span>
            <strong className="font-semibold text-slate-800">Một cổng đăng nhập duy nhất:</strong> Hệ thống tự nhận diện vai trò (Ứng viên, Doanh nghiệp, Affiliate) và chuyển đến không gian làm việc tương ứng.
          </span>
        </div>

        {/* Register CTA at the Bottom */}
        <div className="border-t border-slate-200/80 pt-5 text-center">
          <p className="mb-0 text-sm text-slate-600">
            Chưa có tài khoản trên HR Connect?{' '}
            <button
              type="button"
              onClick={openRegisterPanel}
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] rounded shadow-none"
            >
              Đăng ký ngay
            </button>
          </p>
        </div>
      </form>
    </>
  );

  const renderForgotPanel = () => (
    <>
      <div className="text-left">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => switchBackToLogin()}
            className="inline-flex min-h-[28px] touch-manipulation cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent p-0 text-xs font-semibold text-[#0369A1] transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
          >
            <ArrowLeftOutlined aria-hidden="true" className="text-[11px]" />
            <span>Quay lại đăng nhập</span>
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE3EC] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0369A1]" aria-hidden="true" />
            <span>{forgotStep === 'EMAIL' ? 'Bước 1/2' : 'Bước 2/2'}</span>
          </div>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-[#0369A1]">
          Khôi phục quyền truy cập
        </p>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
          {forgotStep === 'EMAIL' ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}
        </h1>
        <p className="mt-1.5 mb-0 text-sm leading-relaxed text-slate-600">
          {forgotStep === 'EMAIL'
            ? 'Nhập email đã đăng ký để nhận mã OTP 6 chữ số khôi phục mật khẩu.'
            : 'Nhập mã OTP vừa nhận cùng mật khẩu mới cho tài khoản của bạn.'}
        </p>
      </div>

      {forgotNotice && (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs font-medium text-teal-900">
          {forgotNotice}
        </div>
      )}

      {forgotStep === 'EMAIL' ? (
        <form noValidate onSubmit={requestForgotCode} className="mt-6 space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-[13px] font-semibold text-slate-700">
              Email tài khoản
            </label>
            <div className="mt-1.5">
              <input
                id="forgot-email"
                name="forgotEmail"
                type="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="email@example.com"
                value={forgotEmail}
                disabled={forgotPending}
                aria-invalid={Boolean(forgotErrors.email)}
                aria-describedby={forgotErrors.email ? 'forgot-email-error' : undefined}
                onChange={(e) => {
                  setForgotEmail(e.target.value);
                  setForgotErrors({});
                }}
                className={`block h-11 w-full rounded-xl border bg-white px-3.5 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                  forgotErrors.email
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                    : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
                }`}
              />
            </div>
            {forgotErrors.email && (
              <p id="forgot-email-error" className="mt-1.5 mb-0 text-xs font-medium text-rose-700">
                {forgotErrors.email}
              </p>
            )}
          </div>

          {forgotFormError && (
            <div role="alert" aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 leading-relaxed">
              {forgotFormError}
            </div>
          )}

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={forgotPending}
              className="group relative flex h-12 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                  <span>Đang gửi mã…</span>
                </span>
              ) : (
                <>
                  <span>Gửi mã khôi phục</span>
                  <ArrowRightOutlined aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <form noValidate onSubmit={submitResetPassword} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="forgot-otp" className="block text-[13px] font-semibold text-slate-700">
                Mã OTP (6 chữ số)
              </label>
              <button
                type="button"
                disabled={forgotCooldown > 0 || forgotPending}
                onClick={resendForgotCode}
                className="min-h-[28px] touch-manipulation cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-[#0369A1] transition-colors duration-150 hover:text-[#075985] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {forgotCooldown > 0 ? `Gửi lại (${forgotCooldown}s)` : 'Gửi lại mã'}
              </button>
            </div>
            <div className="mt-1.5">
              <input
                id="forgot-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={forgotOtp}
                disabled={forgotPending}
                aria-invalid={Boolean(forgotErrors.otp)}
                onChange={(e) => {
                  setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setForgotErrors((c) => {
                    const next = { ...c };
                    delete next.otp;
                    return next;
                  });
                }}
                className={`block h-11 w-full rounded-xl border bg-white px-3.5 font-mono text-base sm:text-sm tracking-[0.25em] text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                  forgotErrors.otp
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                    : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
                }`}
              />
            </div>
            {forgotErrors.otp && (
              <p className="mt-1.5 mb-0 text-xs font-medium text-rose-700">{forgotErrors.otp}</p>
            )}
          </div>

          <div>
            <label htmlFor="forgot-new-password" className="block text-[13px] font-semibold text-slate-700">
              Mật khẩu mới
            </label>
            <div className="relative mt-1.5">
              <input
                id="forgot-new-password"
                type={showForgotNewPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={forgotNewPassword}
                disabled={forgotPending}
                aria-invalid={Boolean(forgotErrors.newPassword)}
                onChange={(e) => {
                  setForgotNewPassword(e.target.value);
                  setForgotErrors((c) => {
                    const next = { ...c };
                    delete next.newPassword;
                    return next;
                  });
                }}
                className={`block h-11 w-full rounded-xl border bg-white px-3.5 pr-12 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                  forgotErrors.newPassword
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                    : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
                }`}
              />
              <button
                type="button"
                aria-label={showForgotNewPwd ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                onClick={() => setShowForgotNewPwd((s) => !s)}
                className="absolute inset-y-0 right-0 flex min-w-[44px] min-h-[44px] touch-manipulation cursor-pointer items-center justify-center rounded-r-xl border-0 bg-transparent p-0 text-slate-400 transition-colors duration-150 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0369A1] shadow-none"
              >
                <span aria-hidden="true" className="flex items-center justify-center">
                  {showForgotNewPwd ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
                </span>
              </button>
            </div>
            {forgotErrors.newPassword && (
              <p className="mt-1.5 mb-0 text-xs font-medium text-rose-700">{forgotErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label htmlFor="forgot-confirm-password" className="block text-[13px] font-semibold text-slate-700">
              Nhập lại mật khẩu mới
            </label>
            <div className="relative mt-1.5">
              <input
                id="forgot-confirm-password"
                type={showForgotConfirmPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={forgotConfirmPassword}
                disabled={forgotPending}
                aria-invalid={Boolean(forgotErrors.confirmPassword)}
                onChange={(e) => {
                  setForgotConfirmPassword(e.target.value);
                  setForgotErrors((c) => {
                    const next = { ...c };
                    delete next.confirmPassword;
                    return next;
                  });
                }}
                className={`block h-11 w-full rounded-xl border bg-white px-3.5 pr-12 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                  forgotErrors.confirmPassword
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
                    : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
                }`}
              />
              <button
                type="button"
                aria-label={showForgotConfirmPwd ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                onClick={() => setShowForgotConfirmPwd((s) => !s)}
                className="absolute inset-y-0 right-0 flex min-w-[44px] min-h-[44px] touch-manipulation cursor-pointer items-center justify-center rounded-r-xl border-0 bg-transparent p-0 text-slate-400 transition-colors duration-150 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0369A1] shadow-none"
              >
                <span aria-hidden="true" className="flex items-center justify-center">
                  {showForgotConfirmPwd ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
                </span>
              </button>
            </div>
            {forgotErrors.confirmPassword && (
              <p className="mt-1.5 mb-0 text-xs font-medium text-rose-700">{forgotErrors.confirmPassword}</p>
            )}
          </div>

          {forgotFormError && (
            <div role="alert" aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 leading-relaxed">
              {forgotFormError}
            </div>
          )}

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={forgotPending}
              className="flex h-12 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotPending ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      )}
    </>
  );

  const renderPanelContent = (mode: AuthPanelMode) => {
    if (mode === 'login') return renderLoginPanel();
    if (mode === 'forgot') return renderForgotPanel();
    return (
      <RegisterFormPanel
        initialEmail={email.trim() || undefined}
        onSwitchToLogin={(prefillEmail) => switchBackToLogin(prefillEmail)}
      />
    );
  };

  const hero = HERO_META[panelMode];
  const stageAnimation =
    transitionStage === 'exiting'
      ? `${slideDirection === 'forward' ? 'authExitLeft' : 'authExitRight'} 115ms cubic-bezier(0.4, 0, 1, 1) forwards`
      : transitionStage === 'entering'
        ? `${slideDirection === 'forward' ? 'authEnterFromRight' : 'authEnterFromLeft'} 440ms cubic-bezier(0.16, 1, 0.3, 1) both`
        : undefined;

  return (
    <div className="flex min-h-screen w-full bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-slate-900 antialiased max-lg:flex-col">
      <style>{`
        @keyframes authExitLeft {
          0% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(-20px, 0, 0) scale(0.985); }
        }
        @keyframes authExitRight {
          0% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(20px, 0, 0) scale(0.985); }
        }
        @keyframes authEnterFromRight {
          0% { opacity: 0; filter: blur(2px); transform: translate3d(56px, 0, 0) scale(0.985); }
          100% { opacity: 1; filter: blur(0px); transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes authEnterFromLeft {
          0% { opacity: 0; filter: blur(2px); transform: translate3d(-56px, 0, 0) scale(0.985); }
          100% { opacity: 1; filter: blur(0px); transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes authHeroSwap {
          0% { opacity: 0; transform: translate3d(0, 14px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-motion-stage, .auth-hero-stage { animation: none !important; }
        }
      `}</style>
      {/* BRANDING HERO PANEL (Left) — Bright Ocean Cobalt Editorial Canvas */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-[#075985] p-8 text-white max-lg:hidden lg:sticky lg:top-0 lg:h-screen lg:w-[41%] xl:w-[39%] lg:p-11 xl:p-14 shrink-0">
        {/* Background photo */}
        <img
          src={LOGIN_HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-35 brightness-110"
          loading="eager"
          decoding="async"
        />
        {/* Layered Ocean Cobalt gradient + subtle grid & sky glow */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0369A1]/88 via-[#075985]/86 to-[#0C4A6E]/92"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#38BDF8]/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#0EA5E9]/20 blur-3xl"
          aria-hidden="true"
        />

        {/* Brand header */}
        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-white no-underline transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 rounded-lg"
          >
            <BrandMark size={38} tone="light" className="shadow-sm" />
            <span className="font-extrabold tracking-tight">HR Connect</span>
          </Link>
        </div>

        {/* Dynamic Hero Content */}
        <div
          key={`hero-${panelMode}`}
          className="auth-hero-stage relative z-10 my-auto py-8"
          style={{ animation: 'authHeroSwap 440ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-1 text-xs font-semibold tracking-wide text-sky-100 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-200" aria-hidden="true" />
            {hero.eyebrow}
          </span>

          <h2 className="mt-4 text-3xl font-extrabold leading-[1.22] tracking-tight text-white xl:text-[34px]">
            {hero.title}
          </h2>
          <p className="mt-3.5 max-w-md text-[15px] font-normal leading-relaxed text-sky-50/90">
            {hero.description}
          </p>

          <div className="mt-8 max-w-md space-y-3">
            {hero.cards.map((card, index) => (
              <div
                key={card.title}
                className="rounded-xl border border-white/22 bg-white/[0.12] p-4 shadow-[0_8px_24px_-10px_rgba(8,37,60,0.35)] backdrop-blur-md"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircleFilled aria-hidden="true" className="text-xs text-sky-200" />
                  <span>{card.title}</span>
                </div>
                <p className="mb-0 text-xs leading-relaxed text-sky-50/90">
                  {panelMode === 'login' && index === 0 && openJobs > 0
                    ? `${openJobs.toLocaleString('vi-VN')} việc làm đang mở từ các công ty đã xác minh`
                    : card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-xs text-sky-100/80">
          <span>© {new Date().getFullYear()} HR Connect Vietnam</span>
          <span>Kết nối đúng người, đúng cơ hội</span>
        </div>
      </aside>

      {/* FORM CANVAS SECTION (Right) — Full-Height Pure White Surface */}
      <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div
          className={`w-full overflow-x-clip transition-[max-width] duration-[440ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            panelMode === 'register' ? 'max-w-[600px]' : 'max-w-[420px]'
          }`}
        >
          <div
            key={`panel-${panelMode}`}
            className="auth-motion-stage w-full"
            style={stageAnimation ? { willChange: 'transform, opacity', animation: stageAnimation } : undefined}
          >
            {renderPanelContent(panelMode)}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
