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
  ArrowRightOutlined
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
    if (Object.keys(found).length > 0) return;

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
    <div className="flex min-h-screen w-full bg-[#F8FAFC] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-slate-800 antialiased max-lg:flex-col">
      {/* BRANDING HERO PANEL (Left) with Real High-Craft Team Photo */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-[#072B42] p-8 text-white max-lg:min-h-[260px] max-lg:p-6 lg:w-[48%] lg:p-14 xl:p-16">
        {/* Background photo */}
        <img
          src={LOGIN_HERO_IMAGE}
          alt="Đội ngũ HR Connect"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-1000 ease-out hover:scale-105"
          loading="eager"
          decoding="async"
        />
        {/* Modern layered sapphire-to-midnight gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#021F35]/95 via-[#034A70]/80 to-[#0284C7]/45 backdrop-blur-[1.5px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl" />

        {/* Brand header */}
        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-white no-underline transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded-md"
          >
            <BrandMark size={38} tone="light" className="drop-shadow-md" />
            <span className="font-extrabold tracking-tight">HR Connect</span>
          </Link>
        </div>

        {/* Hero value propositions */}
        <div className="relative z-10 my-auto py-10 max-lg:hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/15 px-3.5 py-1 text-xs font-semibold text-sky-100 backdrop-blur-md shadow-xs">
            <span>Hệ sinh thái tuyển dụng tích hợp AI</span>
          </div>

          <h2 className="mt-5 text-3xl font-extrabold leading-[1.25] tracking-tight text-white xl:text-4xl drop-shadow-sm">
            Tìm việc, tuyển dụng &amp; kết nối nhân sự thông minh
          </h2>
          <p className="mt-4 text-base font-normal leading-relaxed text-sky-100/90 max-w-lg">
            Nền tảng một điểm chạm kết nối Doanh nghiệp, Ứng viên và Mạng lưới Headhunter Affiliate trên toàn quốc.
          </p>

          <div className="mt-8 space-y-3.5 max-w-lg">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4.5 backdrop-blur-md transition-all hover:bg-white/15 shadow-sm">
              <h4 className="text-sm font-bold text-white mb-1">Doanh nghiệp &amp; Việc làm xác minh</h4>
              <p className="text-xs text-sky-100/80 leading-relaxed mb-0">
                {openJobs > 0 ? `${openJobs.toLocaleString('vi-VN')} việc làm đang mở từ các công ty đã xác minh` : 'Việc làm đang mở từ các công ty đã xác minh'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4.5 backdrop-blur-md transition-all hover:bg-white/15 shadow-sm">
              <h4 className="text-sm font-bold text-white mb-1">Minh bạch tiến độ tuyển dụng</h4>
              <p className="text-xs text-sky-100/80 leading-relaxed mb-0">
                Theo dõi hành trình hồ sơ thời gian thực: từ Sàng lọc AI, Phỏng vấn, Nhận offer đến Đi làm.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-sky-200/80 max-lg:hidden">
          <span>© {new Date().getFullYear()} HR Connect Vietnam. All rights reserved.</span>
          <span className="font-mono text-[11px] text-sky-300/70">v1.0 • Production</span>
        </div>
      </aside>

      {/* LOGIN FORM SECTION (Right) */}
      <main className="flex flex-1 items-center justify-center bg-[#F8FAFC] px-6 py-12 sm:px-12 lg:px-16 xl:px-20">
        <div className="w-full max-w-[440px] rounded-2xl border border-slate-200/90 bg-white p-7 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.06)] sm:p-9">
          {/* Header */}
          <div className="text-left">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <BrandMark size={32} tone="dark" />
              <span className="text-lg font-bold text-slate-900">HR Connect</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 border border-sky-200/80 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse" />
              Đăng nhập tài khoản
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
              Chào mừng trở lại!
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Nhập thông tin xác thực để truy cập không gian làm việc của bạn.
            </p>
          </div>

          {/* Status alerts */}
          {returnedFromReset?.passwordReset && (
            <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-medium text-emerald-800">
              ✓ Đã đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới của bạn.
            </div>
          )}
          {verifiedSuccessNotice && (
            <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-medium text-emerald-800">
              ✓ {verifiedSuccessNotice}
            </div>
          )}

          {/* Form */}
          <form noValidate onSubmit={handleFormSubmit} className="mt-6 space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Email
              </label>
              <div className="mt-1.5">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email chính hoặc email phụ đã liên kết"
                  value={email}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((current) => ({ ...current, email: undefined }));
                  }}
                  className={`block h-11 w-full rounded-xl border bg-slate-50/40 px-3.5 text-sm text-slate-900 shadow-xs transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                    fieldErrors.email
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-300 hover:border-slate-400 focus:border-[#0284C7]'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="border-0 bg-transparent p-0 cursor-pointer text-xs font-semibold text-[#0284C7] transition-colors hover:text-[#0369A1] focus-visible:outline-none focus-visible:underline shadow-none"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  className={`block h-11 w-full rounded-xl border bg-slate-50/40 px-3.5 pr-11 text-sm text-slate-900 shadow-xs transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 ${
                    fieldErrors.password
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-300 hover:border-slate-400 focus:border-[#0284C7]'
                  }`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none shadow-none"
                >
                  <span aria-hidden="true" className="flex items-center justify-center">
                    {showPassword ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
                  </span>
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Error notifications */}
            {pendingApproval ? (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 leading-relaxed">
                <b className="font-semibold">Tài khoản đang chờ xét duyệt.</b> Email đã được xác thực thành công. Ban quản trị đang thẩm định hồ sơ công ty/affiliate và sẽ kích hoạt trong thời gian sớm nhất.
              </div>
            ) : errorMessage ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-medium text-rose-700 leading-relaxed">
                {errorMessage}
              </div>
            ) : null}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="group relative flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0284C7] via-[#0369A1] to-[#0284C7] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(2,132,199,0.35)] transition-all hover:from-[#0369A1] hover:to-[#0284C7] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Đang xác thực…</span>
                  </span>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRightOutlined aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Smart Portal Notice */}
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-center text-xs text-slate-600 leading-relaxed">
              💡 <b>Một cổng đăng nhập duy nhất:</b> Dù bạn là Ứng viên, Doanh nghiệp hay Đối tác Affiliate, hệ thống sẽ tự nhận diện vai trò và điều hướng đến không gian làm việc tương ứng.
            </div>

            {/* Register Link Prominently at the Bottom */}
            <div className="border-t border-slate-200/80 pt-5 text-center">
              <p className="text-sm text-slate-600 mb-0">
                Chưa có tài khoản trên HR Connect?{' '}
                <Link
                  to="/register"
                  className="font-bold text-[#0284C7] transition-colors hover:text-[#0369A1] focus-visible:outline-none focus-visible:underline"
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
