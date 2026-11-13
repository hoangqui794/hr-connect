/**
 * @file LoginPage.tsx
 * @description Premium, high-craft Login page conforming to Vercel Web Interface Guidelines
 * and Anthropic Frontend Design Standards.
 * - Symmetrical, clean split layout with deep navy branding & soft warm neutral canvas.
 * - Focus rings (:focus-visible), keyboard accessible, zero layout shift (CLS).
 * - "Chưa có tài khoản? Đăng ký ngay" placed elegantly at the bottom of the form for optimal visual hierarchy.
 * - Clear, purposeful typography and microcopy.
 */

import React, { useState, useEffect } from 'react';
import { App } from 'antd';
import {
  CheckCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
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
import { getApiErrorMessage } from '@/services/apiClient';
import { getSafeCandidateReturnPath } from './authReturnPath';

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
    const { from, intent } = (location.state ?? {}) as { from?: string; intent?: string };
    navigate({ pathname: '/forgot-password', search: location.search }, { state: { from, intent, email } });
  };

  const pendingApproval = errorMessage && PENDING_APPROVAL_REGEX.test(errorMessage);

  return (
    <div className="flex min-h-screen w-full bg-[#F4F7FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-slate-900 antialiased max-lg:flex-col">
      {/* BRANDING HERO PANEL (Left) — Midnight Ocean Palette */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-[#08253C] p-8 text-white max-lg:min-h-[220px] max-lg:p-6 lg:sticky lg:top-0 lg:h-screen lg:w-[46%] xl:w-[45%] lg:p-12 xl:p-16 shrink-0">
        {/* Background photo */}
        <img
          src={LOGIN_HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-35"
          loading="eager"
          decoding="async"
        />
        {/* Layered Midnight Ocean gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#061A2B]/98 via-[#08253C]/85 to-[#0C4A6E]/70"
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

        {/* Hero value propositions */}
        <div className="relative z-10 my-auto py-8 max-lg:hidden">
          <p className="m-0 text-xs font-semibold tracking-wide text-sky-300">
            Hệ sinh thái tuyển dụng tích hợp AI
          </p>

          <h2 className="mt-3 text-3xl font-extrabold leading-[1.22] tracking-tight text-white xl:text-[36px]">
            Tìm việc, tuyển dụng &amp; kết nối nhân sự thông minh
          </h2>
          <p className="mt-4 max-w-md text-[15px] font-normal leading-relaxed text-slate-200/90">
            Nền tảng một điểm chạm kết nối Doanh nghiệp, Ứng viên và Mạng lưới Headhunter Affiliate trên toàn quốc.
          </p>

          <div className="mt-8 max-w-md space-y-3">
            <div className="rounded-xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm">
              <h4 className="mb-1 text-sm font-semibold text-white">Doanh nghiệp &amp; Việc làm xác minh</h4>
              <p className="mb-0 text-xs leading-relaxed text-slate-200/85">
                {openJobs > 0 ? `${openJobs.toLocaleString('vi-VN')} việc làm đang mở từ các công ty đã xác minh` : 'Việc làm đang mở từ các công ty đã xác minh'}
              </p>
            </div>

            <div className="rounded-xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm">
              <h4 className="mb-1 text-sm font-semibold text-white">Minh bạch tiến độ tuyển dụng</h4>
              <p className="mb-0 text-xs leading-relaxed text-slate-200/85">
                Theo dõi hành trình hồ sơ thời gian thực: từ Sàng lọc AI, Phỏng vấn, Nhận offer đến Đi làm.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-300/80 max-lg:hidden">
          <span>© {new Date().getFullYear()} HR Connect Vietnam</span>
          <span className="text-slate-300/70">Kết nối đúng người, đúng cơ hội</span>
        </div>
      </aside>

      {/* LOGIN FORM SECTION (Right) — Porcelain Mist Canvas & Pure White Surface */}
      <main className="flex flex-1 items-center justify-center bg-[#F4F7FA] px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[440px] rounded-2xl border border-[#DCE3EC] bg-white p-7 shadow-[0_1px_2px_rgba(8,37,60,0.05),0_16px_36px_-12px_rgba(8,37,60,0.09)] sm:p-9">
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
          {returnedFromReset?.passwordReset && (
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

            {/* Register Link Prominently at the Bottom */}
            <div className="border-t border-slate-200/80 pt-5 text-center">
              <p className="mb-0 text-sm text-slate-600">
                Chưa có tài khoản trên HR Connect?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-[#0369A1] no-underline underline-offset-2 transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] rounded"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
