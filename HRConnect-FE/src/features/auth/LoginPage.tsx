/**
 * @file LoginPage.tsx
 * @description Modern, secure Login Page for HR Connect.
 * Implements Swagger OpenAPI auth flow:
 *   1. POST /api/v1/auth/login -> retrieves a JWT access token; refresh is an HttpOnly cookie
 *   2. GET /api/v1/auth/me -> retrieves CurrentUserDto with verified roles & permissions
 *   3. Synchronizes session into authStore and redirects to RBAC portal dashboard.
 *   4. "Quên mật khẩu?" opens /forgot-password, keeping the typed email and where the user was going.
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Alert } from 'antd';
import {
  LockOutlined,
  MailOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  TeamOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore, type UserProfile, getInitials } from '@/stores/authStore';
import { UserRole, ROLE_LABELS, mapApiRoleToUserRole } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/routeHelpers';
import { authService, type LoginResponse, type CurrentUserResponse } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AuthPageShell, AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AUTH_LINK_CLASS, AUTH_PRIMARY_BUTTON_CLASS } from './AuthPageShell';
import { getSafeCandidateReturnPath } from './authReturnPath';

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
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedSuccessNotice, setVerifiedSuccessNotice] = useState<string | null>(null);


  // Auto pre-fill email if passed via query param (e.g. after OTP verification)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const isVerifiedParam = params.get('verified') === 'true';

    if (emailParam) {
      form.setFieldsValue({ email: emailParam.trim() });
    }

    if (isVerifiedParam) {
      setVerifiedSuccessNotice(
        'Tài khoản của bạn đã được kích hoạt thành công! Vui lòng nhập mật khẩu để đăng nhập.'
      );
    }
  }, [location.search, form]);

  const returnedFromReset = location.state as { email?: string; passwordReset?: boolean } | null;
  useEffect(() => {
    if (returnedFromReset?.email) form.setFieldsValue({ email: returnedFromReset.email, password: '' });
  }, [returnedFromReset, form]);

  // Real API Authentication via authService conforming to swagger.json
  const handleFormSubmit = async (values: { email: string; password?: string }) => {
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
        message.error({ content: msg, duration: 4 });
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
      message.error({ content: formattedError, duration: 5 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <AuthPageShell
        fitScreen
        eyebrow="Chào mừng bạn trở lại"
        title="Đăng nhập HR Connect"
        description="Tiếp tục quản lý cơ hội nghề nghiệp, ứng viên và quy trình tuyển dụng của bạn."
        sideTitle="Kết nối tuyển dụng thông minh"
        sideDescription="Hệ sinh thái kết nối Doanh nghiệp, Đối tác Affiliate và Ứng viên."
        testimonial={{
          quote: 'HR Connect giúp chúng tôi chuẩn hóa toàn bộ pipeline tuyển dụng và rút ngắn hơn 60% thời gian từ lúc lọc CV đến vòng phỏng vấn cuối cùng.',
          author: 'Trần Minh Hoàng',
          role: 'Head of Talent Acquisition',
          company: 'V-Tech Group',
          metrics: '60% Tốc độ tuyển',
        }}
        benefits={[
          {
            icon: <ApartmentOutlined />,
            title: 'Doanh nghiệp tuyển dụng',
            desc: 'Quản trị tin đăng & ứng viên tập trung',
          },
          {
            icon: <TeamOutlined />,
            title: 'Mạng lưới Affiliate',
            desc: 'Giới thiệu nhân tài, hoa hồng minh bạch',
          },
          {
            icon: <SafetyCertificateOutlined />,
            title: 'Bảo mật & Phân quyền',
            desc: 'Bảo vệ dữ liệu, kiểm soát theo vai trò',
          },
        ]}
      >
        {returnedFromReset?.passwordReset && (
          <Alert
            message="Đã đặt lại mật khẩu"
            description="Vui lòng đăng nhập bằng mật khẩu mới."
            type="success"
            showIcon
            className="mb-4 rounded-xl py-2"
          />
        )}

        {verifiedSuccessNotice && (
          <Alert
            message="Xác thực email thành công"
            description={verifiedSuccessNotice}
            type="success"
            showIcon
            closable
            onClose={() => setVerifiedSuccessNotice(null)}
            className="mb-4 rounded-xl py-2"
          />
        )}

        {errorMessage && (errorMessage.includes('pending Admin approval') || errorMessage.includes('chờ Admin duyệt') || errorMessage.includes('chờ Ban quản trị')) ? (
          <Alert
            message="Tài khoản đang chờ xét duyệt"
            description="Email đã được xác thực. Ban quản trị đang xem xét hồ sơ và sẽ gửi thông báo khi tài khoản được kích hoạt."
            type="warning"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            className="mb-3 rounded-xl border-amber-200 bg-amber-50 py-2"
          />
        ) : errorMessage ? (
          <Alert
            message="Chưa thể đăng nhập"
            description={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            className="mb-4 rounded-xl py-2"
          />
        ) : null}

        <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFormSubmit}>
          <Form.Item
            label={<span className={AUTH_LABEL_CLASS}>Email</span>}
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ email.' },
              { type: 'email', message: 'Email chưa đúng định dạng.' },
            ]}
            className="mb-3"
          >
            <Input
              size="large"
              type="email"
              autoComplete="email"
              prefix={<MailOutlined className="mr-1 text-slate-400" />}
              placeholder="ten@email.com"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </Form.Item>

          <div className="mb-1.5">
            <label htmlFor="password" className={AUTH_LABEL_CLASS}>Mật khẩu</label>
          </div>
          <Form.Item name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]} className="mb-2">
            <Input.Password
              id="password"
              size="large"
              autoComplete="current-password"
              prefix={<LockOutlined className="mr-1 text-slate-400" />}
              placeholder="Nhập mật khẩu"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </Form.Item>
          <div className="mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const { from, intent } = (location.state ?? {}) as { from?: string; intent?: string };
                navigate(
                  { pathname: '/forgot-password', search: location.search },
                  { state: { from, intent, email: form.getFieldValue('email') } }
                );
              }}
              className={`cursor-pointer border-0 bg-transparent px-0 py-2 text-sm ${AUTH_LINK_CLASS}`}
            >
              Quên mật khẩu?
            </button>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={submitting}
            disabled={submitting}
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </Form>

        <div className="mt-6 text-center text-sm text-slate-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className={AUTH_LINK_CLASS}>
            Tạo tài khoản miễn phí
          </Link>
        </div>

      </AuthPageShell>
  );
};

export default LoginPage;
