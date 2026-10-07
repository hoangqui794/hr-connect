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
import { Form, Input, Button, Typography, message, Alert, Modal } from 'antd';
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

const { Text } = Typography;

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
      const redirectFrom = (location.state as { from?: string } | undefined)?.from;
      const destination =
        redirectFrom && redirectFrom !== '/login'
          ? redirectFrom
          : resolvedRole === UserRole.CANDIDATE
          ? '/'
          : getDashboardRouteForRole(resolvedRole);

      navigate(destination, { replace: true });
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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient mesh */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-indigo-50/40 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-blue-400/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-300/15 rounded-full blur-[90px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/')}
          className="text-center mb-6 cursor-pointer select-none group"
          title="Quay về trang chủ HR Connect"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl mx-auto mb-3 shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
            H
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
            HR Connect
          </h2>
          <p className="text-xs text-slate-500 tracking-wide font-medium">
            AI-Powered Recruitment & Affiliate Headhunting Platform
          </p>
        </div>

        {/* Login Panel */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)]">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
              Đăng nhập tài khoản
            </h3>
            <Text className="text-xs text-slate-500">
              Nhập email và mật khẩu của bạn để truy cập hệ thống
            </Text>
          </div>

          {/* Account Activated Success Banner */}
          {verifiedSuccessNotice && (
            <Alert
              message={verifiedSuccessNotice}
              type="success"
              showIcon
              closable
              onClose={() => setVerifiedSuccessNotice(null)}
              className="mb-4 text-xs rounded-xl"
            />
          )}

          {/* Pending Approval Notice */}
          {errorMessage && (errorMessage.includes('pending Admin approval') || errorMessage.includes('chờ Admin duyệt') || errorMessage.includes('chờ Ban quản trị')) ? (
            <Alert
              message="Tài khoản đang chờ Admin xét duyệt"
              description="Hồ sơ đăng ký của bạn đã được xác thực email thành công và đang chờ Ban quản trị (Admin) kiểm duyệt. Bạn sẽ nhận được email thông báo ngay sau khi tài khoản được kích hoạt."
              type="warning"
              showIcon
              closable
              onClose={() => setErrorMessage(null)}
              className="mb-4 text-xs rounded-xl border border-amber-300 bg-amber-50"
            />
          ) : errorMessage ? (
            /* Error Alert */
            <Alert
              message={errorMessage}
              type="error"
              showIcon
              closable
              onClose={() => setErrorMessage(null)}
              className="mb-4 text-xs rounded-xl"
            />
          ) : null}

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleFormSubmit}
          >
            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Địa chỉ Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập địa chỉ email!' },
                { type: 'email', message: 'Địa chỉ email không đúng định dạng!' },
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input
                size="large"
                prefix={<MailOutlined className="text-slate-400 mr-1" />}
                placeholder="ten@doanhnghiep.com"
                disabled={submitting}
                className="bg-slate-50/70 border-slate-200 text-slate-900 rounded-xl h-11 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500"
              />
            </Form.Item>

            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Mật khẩu
              </label>
              <button
                    type="button"
                    onClick={() => {
                      setIsForgotModalOpen(true);
                      setForgotStep('REQUEST_OTP');
                      const currentEmail = form.getFieldValue('email');
                      if (currentEmail) forgotForm.setFieldsValue({ email: currentEmail });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-transparent border-none p-0 cursor-pointer"
                  >
                Quên mật khẩu?
              </button>
            </div>
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="text-slate-400 mr-1" />}
                placeholder="••••••••"
                disabled={submitting}
                className="bg-slate-50/70 border-slate-200 text-slate-900 rounded-xl h-11 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500"
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
              className="h-11 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 border-none shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer"
            >
              {submitting ? 'Đang xác thực tài khoản...' : 'Đăng nhập tài khoản'}
            </Button>
          </Form>

          {/* Quick Fill Test Accounts (development only) */}
          {SHOW_DEMO_ACCOUNTS && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ThunderboltOutlined className="text-amber-500" />
                <span>Tài khoản thử nghiệm (Điền & Gọi API)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">MK: {DEMO_PASSWORD}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickFill(demo)}
                  title={demo.email}
                  className={`${demo.role === UserRole.ADMIN ? 'col-span-2 ' : ''}flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 transition-all duration-150 text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      background: demo.badgeBg,
                      color: demo.accentColor,
                      border: `1px solid ${demo.accentColor}30`,
                    }}
                  >
                    {demo.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                      {demo.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {demo.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-1.5">
            <div className="text-xs text-slate-500">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Đăng ký ngay
              </Link>
            </div>
            <div>
              <Link
                to="/"
                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                ← Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default LoginPage;
