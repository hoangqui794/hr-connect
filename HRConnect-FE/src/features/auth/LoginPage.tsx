/**
 * @file LoginPage.tsx
 * @description Modern, secure Login Page for HR Connect.
 * Implements Swagger OpenAPI auth flow:
 *   1. POST /api/v1/auth/login -> retrieves JWT accessToken & refreshToken
 *   2. GET /api/v1/auth/me -> retrieves CurrentUserDto with verified roles & permissions
 *   3. Synchronizes session into authStore and redirects to RBAC portal dashboard.
 *   4. Includes Forgot / Reset Password flow via Modal (POST /auth/forgot-password, /auth/reset-password).
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Alert, Modal } from 'antd';
import {
  LockOutlined,
  MailOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  CheckCircleFilled,
  BankOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  UserOutlined,
  KeyOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore, type UserProfile, getInitials } from '@/stores/authStore';
import { UserRole, ROLE_LABELS, mapApiRoleToUserRole } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/AppRoutes';
import { authService, type LoginResponse, type CurrentUserResponse } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AuthPageShell, AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from './AuthPageShell';

interface DemoAccount {
  role: UserRole;
  title: string;
  roleTag: string;
  email: string;
  workspaceName: string;
  targetRoute: string;
  icon: React.ReactNode;
  accentColor: string;
  badgeBg: string;
}

/**
 * Demo accounts seeded by HRConnect.Infrastructure/Persistence/Seed/DemoAccountSeeder.cs.
 * They all share the seeder's InitialDemoPassword; keep both files in sync.
 * The quick-login panel only renders in development or when VITE_SHOW_DEMO_ACCOUNTS=true.
 */
const DEMO_PASSWORD = '111111Aa@';
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: UserRole.CLIENT,
    title: 'Doanh nghiệp tuyển dụng',
    roleTag: 'Client / Employer',
    email: 'client@gmail.com',
    workspaceName: 'HR Hiring Hub',
    targetRoute: '/client/dashboard',
    icon: <BankOutlined />,
    accentColor: '#0284c7', // sky-600
    badgeBg: 'rgba(2, 132, 199, 0.12)',
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Cộng tác viên tuyển dụng',
    roleTag: 'Affiliate Recruiter',
    email: 'affiliate@gmail.com',
    workspaceName: 'OPR Referral Portal',
    targetRoute: '/affiliate/dashboard',
    icon: <CrownOutlined />,
    accentColor: '#f59e0b', // amber-500
    badgeBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    role: UserRole.INTERNAL_HR,
    title: 'Chuyên viên Nhân sự (HR)',
    roleTag: 'HR Operations',
    email: 'internalhr@gmail.com',
    workspaceName: 'HR Backoffice',
    targetRoute: '/hr/dashboard',
    icon: <SafetyCertificateOutlined />,
    accentColor: '#10b981', // emerald-500
    badgeBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    role: UserRole.CANDIDATE,
    title: 'Ứng viên tìm việc',
    roleTag: 'Talent & Candidate',
    email: 'candidate@gmail.com',
    workspaceName: 'Talent Profile',
    targetRoute: '/',
    icon: <UserOutlined />,
    accentColor: '#a78bfa', // purple-400
    badgeBg: 'rgba(167, 139, 250, 0.12)',
  },
  {
    role: UserRole.ADMIN,
    title: 'Quản trị viên nền tảng',
    roleTag: 'Platform Admin',
    email: 'admin@gmail.com',
    workspaceName: 'Admin Console',
    targetRoute: '/admin/dashboard',
    icon: <SettingOutlined />,
    accentColor: '#047857', // emerald-700, the Admin console primary
    badgeBg: 'rgba(4, 120, 87, 0.12)',
  },
];

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

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'REQUEST_OTP' | 'RESET_PASSWORD'>('REQUEST_OTP');
  const [forgotForm] = Form.useForm();
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Cooldown countdown for resending forgot password OTP
  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotCooldown]);

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
      const refreshToken = loginData.refreshToken || undefined;

      let resolvedRole: UserRole = UserRole.CANDIDATE;
      let userProfile: UserProfile;

      // 2. GET /api/v1/auth/me to retrieve official roles and profile from server
      try {
        const meRes: CurrentUserResponse = await authService.getCurrentUser();
        if (meRes.success && meRes.data) {
          const userDto = meRes.data;
          resolvedRole = mapApiRoleToUserRole(userDto.roles);

          // Update store with official backend session
          setAuthSession(userDto, accessToken, refreshToken);

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
      const destination =
        redirectFrom && redirectFrom !== '/login' && belongsToRoleWorkspace(resolvedRole, redirectFrom)
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

  // Quick-fill credentials for testing directly with real API
  const handleQuickFill = (demo: DemoAccount) => {
    setErrorMessage(null);
    form.setFieldsValue({
      email: demo.email,
      password: DEMO_PASSWORD,
    });
    form.submit();
  };

  // ─── FORGOT & RESET PASSWORD HANDLERS (Swagger OpenAPI) ───
  const handleRequestForgotOtp = async (values: { email: string }) => {
    setForgotSubmitting(true);
    try {
      // POST /api/v1/auth/forgot-password
      const res = await authService.forgotPassword(values.email.trim());
      message.success(
        res.message || `Mã OTP đặt lại mật khẩu đã được gửi tới email ${values.email.trim()}`
      );
      setForgotEmail(values.email.trim());
      setForgotStep('RESET_PASSWORD');
      setForgotCooldown(60);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể gửi yêu cầu đặt lại mật khẩu lúc này!'));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (!forgotEmail || forgotCooldown > 0) return;
    try {
      // POST /api/v1/auth/forgot-password/resend
      const res = await authService.resendForgotPasswordOtp(forgotEmail);
      message.success(res.message || 'Đã gửi lại mã OTP mới!');
      setForgotCooldown(60);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể gửi lại mã OTP!'));
    }
  };

  const handleResetPassword = async (values: {
    otp: string;
    newPassword: string;
    confirmPassword?: string;
  }) => {
    setForgotSubmitting(true);
    try {
      // POST /api/v1/auth/reset-password
      const res = await authService.resetPassword({
        email: forgotEmail,
        otp: values.otp.trim(),
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });

      message.success(
        res.message || 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.'
      );
      setIsForgotModalOpen(false);
      setForgotStep('REQUEST_OTP');
      forgotForm.resetFields();
      form.setFieldsValue({ email: forgotEmail, password: '' });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại OTP!'));
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <>
      <AuthPageShell
        eyebrow="Chào mừng bạn trở lại"
        title="Đăng nhập HR Connect"
        description="Tiếp tục quản lý cơ hội nghề nghiệp, ứng viên và quy trình tuyển dụng của bạn."
        sideTitle="Mọi hành trình tuyển dụng bắt đầu từ một kết nối đáng tin cậy."
        sideDescription="Một không gian làm việc chung cho Candidate, Affiliate Recruiter, doanh nghiệp và đội ngũ HR."
        benefits={[
          'Theo dõi hồ sơ và trạng thái tuyển dụng rõ ràng',
          'Quản lý CV, ứng viên và nguồn giới thiệu tập trung',
          'Bảo vệ tài khoản bằng xác thực và phân quyền theo vai trò',
        ]}
      >
        {verifiedSuccessNotice && (
          <Alert
            message="Xác thực email thành công"
            description={verifiedSuccessNotice}
            type="success"
            showIcon
            closable
            onClose={() => setVerifiedSuccessNotice(null)}
            className="mb-5 rounded-xl"
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
            className="mb-5 rounded-xl border-amber-200 bg-amber-50"
          />
        ) : errorMessage ? (
          <Alert
            message="Chưa thể đăng nhập"
            description={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            className="mb-5 rounded-xl"
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

          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className={AUTH_LABEL_CLASS}>Mật khẩu</label>
            <button
              type="button"
              onClick={() => {
                setIsForgotModalOpen(true);
                setForgotStep('REQUEST_OTP');
                const currentEmail = form.getFieldValue('email');
                if (currentEmail) forgotForm.setFieldsValue({ email: currentEmail });
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Quên mật khẩu?
            </button>
          </div>
          <Form.Item name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]} className="mb-6">
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

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={submitting}
            disabled={submitting}
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            className="h-12 rounded-xl border-0 bg-blue-600 text-sm font-bold shadow-lg shadow-blue-600/20 hover:!bg-blue-700"
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </Form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-blue-700 hover:text-blue-900">
            Tạo tài khoản miễn phí
          </Link>
        </div>

        {SHOW_DEMO_ACCOUNTS && (
          <details className="group mt-5 rounded-2xl border border-dashed border-slate-300 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2"><ThunderboltOutlined className="text-amber-500" /> Tài khoản kiểm thử</span>
              <span className="text-xs font-medium text-slate-400 group-open:hidden">Mở danh sách</span>
            </summary>
            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickFill(demo)}
                  className={`${demo.role === UserRole.ADMIN ? 'sm:col-span-2 ' : ''}flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: demo.badgeBg, color: demo.accentColor }}>
                    {demo.icon}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-slate-800">{demo.title}</strong>
                    <span className="block truncate text-[11px] text-slate-500">{demo.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
      </AuthPageShell>

      {/* ─── FORGOT & RESET PASSWORD MODAL ─── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <KeyOutlined className="text-blue-600" />
            <span>
              {forgotStep === 'REQUEST_OTP'
                ? 'Quên mật khẩu tài khoản'
                : 'Đặt lại mật khẩu với OTP'}
            </span>
          </div>
        }
        open={isForgotModalOpen}
        onCancel={() => {
          setIsForgotModalOpen(false);
          setForgotStep('REQUEST_OTP');
          forgotForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        centered
        className="rounded-2xl"
      >
        <div className="py-2">
          {forgotStep === 'REQUEST_OTP' ? (
            <Form
              form={forgotForm}
              layout="vertical"
              onFinish={handleRequestForgotOtp}
              requiredMark={false}
            >
              <p className="text-xs text-slate-500 mb-4">
                Nhập địa chỉ email đăng ký tài khoản của bạn. Hệ thống sẽ gửi mã OTP xác nhận gồm 6 chữ số để đặt lại mật khẩu mới.
              </p>
              <Form.Item
                name="email"
                label={<span className="text-xs font-semibold text-slate-700">Email tài khoản</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập email!' },
                  { type: 'email', message: 'Email không đúng định dạng!' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined className="text-slate-400" />}
                  placeholder="name@example.com"
                  className="rounded-xl"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={forgotSubmitting}
                className="rounded-xl bg-blue-600 font-semibold mt-2"
              >
                Gửi mã xác thực OTP
              </Button>
            </Form>
          ) : (
            <Form
              form={forgotForm}
              layout="vertical"
              onFinish={handleResetPassword}
              requiredMark={false}
            >
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-4 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  Gửi tới: <strong>{forgotEmail}</strong>
                </span>
                {forgotCooldown > 0 ? (
                  <span className="text-slate-400">Gửi lại sau {forgotCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendForgotOtp}
                    className="text-blue-600 hover:underline bg-transparent border-none p-0 cursor-pointer font-medium flex items-center gap-1"
                  >
                    <ReloadOutlined /> Gửi lại mã
                  </button>
                )}
              </div>

              <Form.Item
                name="otp"
                label={<span className="text-xs font-semibold text-slate-700">Mã OTP (6 chữ số)</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập mã OTP!' },
                  { len: 6, message: 'Mã OTP gồm đúng 6 chữ số!' },
                ]}
              >
                <Input
                  size="large"
                  maxLength={6}
                  placeholder="123456"
                  className="rounded-xl text-center tracking-widest font-mono font-bold text-lg"
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label={<span className="text-xs font-semibold text-slate-700">Mật khẩu mới</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự!' },
                ]}
              >
                <Input.Password
                  size="large"
                  placeholder="Mật khẩu mới"
                  className="rounded-xl"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['newPassword']}
                label={<span className="text-xs font-semibold text-slate-700">Xác nhận mật khẩu mới</span>}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  placeholder="Nhập lại mật khẩu mới"
                  className="rounded-xl"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={forgotSubmitting}
                className="rounded-xl bg-blue-600 font-semibold mt-2"
              >
                Lưu mật khẩu mới & Đăng nhập
              </Button>
            </Form>
          )}
        </div>
      </Modal>
    </>
  );
};

export default LoginPage;
