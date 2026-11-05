/**
 * @file LoginPage.tsx
 * @description Login for every role (mockup 03/11, Login).
 *   1. POST /api/v1/auth/login -> retrieves a JWT access token; refresh is an HttpOnly cookie
 *   2. GET /api/v1/auth/me -> retrieves CurrentUserDto with verified roles & permissions
 *   3. Synchronizes session into authStore and redirects to RBAC portal dashboard.
 *   4. "Quên mật khẩu?" opens /forgot-password, keeping the typed email and where the user was going.
 * The mockup's "Ghi nhớ đăng nhập" is left out: the backend has one fixed session length.
 */

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { CheckCircleFilled, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { useAuthStore, type UserProfile, getInitials } from '@/stores/authStore';
import { UserRole, ROLE_LABELS, mapApiRoleToUserRole } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/routeHelpers';
import { authService, type LoginResponse, type CurrentUserResponse } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { getSafeCandidateReturnPath } from './authReturnPath';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const INPUT = `${FONT} box-border h-[46px] w-full rounded-md border border-solid bg-white px-3 text-[14px] text-[#1F2937] outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_APPROVAL = /pending Admin approval|chờ Admin duyệt|chờ Ban quản trị/;

const borderOf = (error?: string) => (error ? 'border-[#B91C1C]' : 'border-[#D1D5DB]');

const WORKSPACE_PREFIX: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.CLIENT]: '/client',
  [UserRole.INTERNAL_HR]: '/hr',
  [UserRole.AFFILIATE]: '/affiliate',
  [UserRole.CANDIDATE]: '/candidate',
};

/** True when `path` is inside the role's own workspace, or is a shared page (job search, profile…). */
const belongsToRoleWorkspace = (role: UserRole, path: string): boolean => {
  const own = WORKSPACE_PREFIX[role];
  const isUnder = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (own && isUnder(own)) return true;
  return !Object.values(WORKSPACE_PREFIX).some((prefix) => prefix && isUnder(prefix));
};

export const LoginPage: React.FC = () => {
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


  // Auto pre-fill email if passed via query param (e.g. after OTP verification)
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

  // Real API Authentication via authService conforming to swagger.json
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: { email?: string; password?: string } = {};
    if (!email.trim()) found.email = 'Vui lòng nhập địa chỉ email.';
    else if (!EMAIL.test(email.trim())) found.email = 'Email chưa đúng định dạng.';
    if (!password) found.password = 'Vui lòng nhập mật khẩu.';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = { email, password };
    setErrorMessage(null);
    setSubmitting(true);

    try {
      // 1. POST /api/v1/auth/login
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

      // 2. GET /api/v1/auth/me to retrieve official roles and profile from server
      try {
        const meRes: CurrentUserResponse = await authService.getCurrentUser();
        if (meRes.success && meRes.data) {
          const userDto = meRes.data;
          resolvedRole = mapApiRoleToUserRole(userDto.roles);

          // Update store with official backend session
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
        // Fallback to loginData.user if /auth/me is temporarily unreachable
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

      // Redirect user based on authenticated role or previous route
      // Resume the page that asked for login only when it belongs to this role's own workspace.
      // After a logout the remembered page is the previous user's (e.g. /client/...), and an Admin
      // may technically open it, but should land in the Admin console instead.
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

  const pendingApproval = errorMessage && PENDING_APPROVAL.test(errorMessage);

  return (
    <div className={`${FONT} flex min-h-screen flex-wrap bg-[#F7F8FA] text-[14px] text-[#1F2937] [line-height:normal] max-md:flex-col`}>
      <div className="flex min-w-0 flex-[1_1_532px] flex-col justify-between gap-8 bg-[#0C4A6E] px-6 py-6 text-white max-md:flex-none md:px-14 md:py-10">
        <Link to="/" className="flex items-center gap-2.5 text-[20px] font-bold text-white no-underline hover:text-white hover:no-underline">
          <BrandMark size={36} tone="light" className="block" /> HR Connect
        </Link>
        <div className="hidden max-w-[440px] md:block">
          <p className="m-0 text-[26px] font-bold leading-[1.35]">Tìm việc, theo dõi hồ sơ và nhận lịch phỏng vấn ở một nơi.</p>
          <ul className="m-0 mt-5 pl-[18px] leading-[1.9] text-[#CFE3F0]">
            <li>{openJobs > 0 ? `${openJobs.toLocaleString('vi-VN')} việc làm đang mở` : 'Việc làm đang mở'} từ các công ty đã xác minh</li>
            <li>Biết hồ sơ đang ở bước nào: sàng lọc, phỏng vấn hay offer</li>
            <li>Tạo CV bằng CV Builder và dùng ngay để ứng tuyển</li>
          </ul>
        </div>
        <span className="hidden text-[13px] text-[#9EC3DA] md:inline">© {new Date().getFullYear()} HR Connect</span>
      </div>

      <main className="flex min-w-0 flex-[1_1_568px] items-center justify-center px-6 py-10 max-md:flex-1 max-md:items-start max-md:py-8">
        <form noValidate onSubmit={handleFormSubmit} className="flex w-full max-w-[400px] flex-col gap-4">
          <div>
            <h1 className="m-0 text-[24px] font-bold">Đăng nhập</h1>
            <p className="m-0 mt-1.5 text-[#4B5563]">Chưa có tài khoản? <Link to="/register" className={`font-semibold ${LINK}`}>Đăng ký</Link></p>
          </div>

          {returnedFromReset?.passwordReset && (
            <p role="status" className="m-0 rounded-md border border-solid border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[13px] text-[#166534]">Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.</p>
          )}
          {verifiedSuccessNotice && (
            <p role="status" className="m-0 rounded-md border border-solid border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[13px] text-[#166534]">{verifiedSuccessNotice}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="font-medium">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
              className={`${INPUT} ${borderOf(fieldErrors.email)}`}
            />
            {fieldErrors.email && <span id="login-email-error" className="text-[12px] text-[#B91C1C]">{fieldErrors.email}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <label htmlFor="login-password" className="font-medium">Mật khẩu</label>
              <button type="button" onClick={openForgotPassword} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}>Quên mật khẩu?</button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
                className={`${INPUT} pr-11 ${borderOf(fieldErrors.password)}`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[#6B7280] hover:text-[#1F2937]"
              >
                {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              </button>
            </div>
            {fieldErrors.password && <span id="login-password-error" className="text-[12px] text-[#B91C1C]">{fieldErrors.password}</span>}
          </div>

          {pendingApproval ? (
            <p role="status" className="m-0 rounded-md border border-solid border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-[13px] text-[#9A3412]">
              <b>Tài khoản đang chờ xét duyệt.</b> Email đã được xác thực. Ban quản trị đang xem xét hồ sơ và sẽ gửi thông báo khi tài khoản được kích hoạt.
            </p>
          ) : errorMessage ? (
            <p role="alert" className="m-0 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">{errorMessage}</p>
          ) : null}

          <button type="submit" disabled={submitting} className={`${FONT} h-[46px] cursor-pointer rounded-md border-0 bg-[#0C4A6E] text-[15px] font-semibold text-white hover:bg-[#075985] disabled:cursor-not-allowed disabled:opacity-60`}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <p className="m-0 mt-2 border-0 border-t border-solid border-[#E5E7EB] pt-4 text-[13px] text-[#4B5563]">Bạn là nhà tuyển dụng hoặc Affiliate? Dùng cùng trang này để đăng nhập, hệ thống tự chuyển đến khu vực của bạn.</p>
        </form>
      </main>
    </div>
  );
};

export default LoginPage;
