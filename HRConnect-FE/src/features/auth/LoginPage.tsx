import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import {
  LockOutlined,
  MailOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  CheckCircleFilled,
  BankOutlined,
  ShareAltOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserProfile } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { UserRole, ROLE_LABELS } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/AppRoutes';
import { findRegisteredAccountByEmail } from '@/services/accountService';

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

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: UserRole.CLIENT,
    title: 'Doanh nghiệp',
    roleTag: 'Client',
    email: 'tuyendung5@gmail.com',
    workspaceName: 'TechCorp Portal',
    targetRoute: '/client/dashboard',
    icon: <BankOutlined />,
    accentColor: '#38bdf8', // sky-400
    badgeBg: 'rgba(56, 189, 248, 0.12)',
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Cộng tác viên',
    roleTag: 'Headhunter',
    email: 'cvt5@gmail.com',
    workspaceName: 'OPR Hub',
    targetRoute: '/affiliate/dashboard',
    icon: <ShareAltOutlined />,
    accentColor: '#f59e0b', // amber-500
    badgeBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    role: UserRole.INTERNAL_HR,
    title: 'HR Vận hành',
    roleTag: 'Internal HR',
    email: 'myhr@hrconnect.io',
    workspaceName: 'ATS Screening',
    targetRoute: '/hr/dashboard',
    icon: <SafetyCertificateOutlined />,
    accentColor: '#34d399', // emerald-400
    badgeBg: 'rgba(52, 211, 153, 0.12)',
  },
  {
    role: UserRole.ADMIN,
    title: 'Quản trị viên',
    roleTag: 'Platform Admin',
    email: 'myadmin@hrconnect.io',
    workspaceName: 'Admin Control',
    targetRoute: '/admin/dashboard',
    icon: <CrownOutlined />,
    accentColor: '#f43f5e', // rose-500
    badgeBg: 'rgba(244, 63, 94, 0.12)',
  },
  {
    role: UserRole.CANDIDATE,
    title: 'Ứng viên',
    roleTag: 'Candidate',
    email: 'ungvien5@gmail.com',
    workspaceName: 'Talent Profile',
    targetRoute: '/candidate/dashboard',
    icon: <UserOutlined />,
    accentColor: '#a78bfa', // purple-400
    badgeBg: 'rgba(167, 139, 250, 0.12)',
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Authenticate and redirect based on role
  const performLogin = async (role: UserRole, customUser?: Partial<UserProfile>, targetRoute?: string) => {
    setSubmitting(true);
    const normalizedRole = ((customUser?.role || role || UserRole.CANDIDATE) as string).toUpperCase() as UserRole;
    login(normalizedRole, customUser);
    await new Promise((r) => setTimeout(r, 200));
    setSubmitting(false);

    const destination = targetRoute || getDashboardRouteForRole(normalizedRole);
    void message.success({
      content: `Đăng nhập thành công với vai trò: ${ROLE_LABELS[normalizedRole] || normalizedRole}`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
    });
    navigate(destination);
  };

  // Standard form submission
  const handleFormSubmit = async (values: { email: string; password?: string }) => {
    const emailLower = values.email.toLowerCase().trim();

    // 1. Look up user account by email in persistent account repository
    const account = findRegisteredAccountByEmail(emailLower);

    if (!account) {
      message.error({
        content: 'Tài khoản chưa tồn tại trên hệ thống. Vui lòng kiểm tra lại email hoặc đăng ký tài khoản mới!',
        duration: 4,
      });
      return;
    }

    // 2. Validate password (if set)
    if (account.password && values.password && account.password !== values.password) {
      message.error({
        content: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!',
        duration: 3,
      });
      return;
    }

    // 3. Extract exact registered role and profile details
    const resolvedRole = account.role;
    const customUser: Partial<UserProfile> = {
      id: account.id,
      name: account.fullName,
      email: account.email,
      role: resolvedRole,
      phone: account.phone,
      company: resolvedRole === UserRole.CLIENT ? (account.companyName || `${account.fullName} Co.`) : undefined,
      companySize: resolvedRole === UserRole.CLIENT ? account.companySize : undefined,
    };

    // 4. Authenticate and redirect based on the account's permanent role
    await performLogin(resolvedRole, customUser);
  };

  // Quick-fill demo account click
  const handleQuickFill = async (demo: DemoAccount) => {
    form.setFieldsValue({
      email: demo.email,
      password: '123456',
    });
    const account = findRegisteredAccountByEmail(demo.email.toLowerCase());
    if (demo.role === UserRole.CANDIDATE) {
      if (demo.email === 'minh.nguyen@gmail.com') {
        useCandidateStore.getState().loadDemoData();
      } else {
        useCandidateStore.getState().initCandidateFromUser({
          name: account?.fullName || 'Ứng viên',
          email: demo.email,
        });
      }
    }
    const customUser: Partial<UserProfile> | undefined = account
      ? {
          id: account.id,
          name: account.fullName,
          email: account.email,
          role: account.role,
          company: account.role === UserRole.CLIENT ? (account.companyName || 'Công ty TNHH Tuyển Dụng 5') : undefined,
        }
      : undefined;
    await performLogin(demo.role, customUser, demo.targetRoute);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient mesh (Modern Light SaaS) */}
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
        <div className="bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)]">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
              Đăng nhập hệ thống
            </h3>
            <p className="text-xs text-slate-500">
              Nhập thông tin tài khoản hoặc kích hoạt 1-chạm vào các tài khoản thử nghiệm bên dưới.
            </p>
          </div>

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
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<MailOutlined className="text-slate-400 mr-1" />}
                placeholder="ten@doanhnghiep.com"
                className="bg-slate-50/70 border-slate-200 text-slate-900 rounded-xl h-11 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Mật khẩu</span>}
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-1" />}
                placeholder="••••••••"
                className="bg-slate-50/70 border-slate-200 text-slate-900 rounded-xl h-11 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              className="h-11 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 border-none shadow-sm transition-all duration-200"
            >
              Đăng nhập tài khoản
            </Button>
          </Form>

          {/* Role Switcher Demo Cards */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ThunderboltOutlined className="text-amber-500" />
                <span>Tài khoản Demo (1-Chạm vào Dashboard)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Password: 123456</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => void handleQuickFill(demo)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 transition-all duration-150 text-left group cursor-pointer"
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
                      {demo.roleTag}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-1.5">
            <div className="text-xs text-slate-500">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-blue-600 hover:text-blue-700 font-semibold underline bg-transparent border-none p-0 cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium bg-transparent border-none p-0 cursor-pointer"
              >
                ← Quay lại trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
