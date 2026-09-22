import React, { useState } from 'react';
import {
  Card, Form, Input, Button, Typography, message, Tag,
} from 'antd';
import {
  LockOutlined, MailOutlined, ArrowRightOutlined,
  ThunderboltOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserProfile } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { UserRole, ROLE_LABELS } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/AppRoutes';
import { findRegisteredAccountByEmail } from '@/services/accountService';

const { Title, Text } = Typography;

interface DemoAccount {
  role: UserRole;
  title: string;
  email: string;
  workspaceName: string;
  targetRoute: string;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: UserRole.CLIENT,
    title: 'Doanh nghiệp (Client)',
    email: 'client@demo.com',
    workspaceName: 'Client Workspace',
    targetRoute: '/client/dashboard',
    color: '#0284c7',
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Cộng tác viên (Affiliate)',
    email: 'affiliate@demo.com',
    workspaceName: 'OPR Hub',
    targetRoute: '/affiliate/dashboard',
    color: '#f59e0b',
  },
  {
    role: UserRole.INTERNAL_HR,
    title: 'HR Nội bộ (Internal HR)',
    email: 'hr@demo.com',
    workspaceName: 'HR Workspace',
    targetRoute: '/hr/dashboard',
    color: '#10b981',
  },
  {
    role: UserRole.CANDIDATE,
    title: 'Ứng viên (Candidate)',
    email: 'candidate@demo.com',
    workspaceName: 'Candidate Portal',
    targetRoute: '/candidate/dashboard',
    color: '#8b5cf6',
  },
  {
    role: UserRole.ADMIN,
    title: 'Platform Admin',
    email: 'admin@demo.com',
    workspaceName: 'Admin Control',
    targetRoute: '/admin/dashboard',
    color: '#ef4444',
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
    await new Promise((r) => setTimeout(r, 250));
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
      // STRICT: Only assign company if role is CLIENT!
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
      password: 'demoPassword123',
    });
    // For demo account click, initialize demo candidate data if candidate role
    if (demo.role === UserRole.CANDIDATE) {
      useCandidateStore.getState().loadDemoData();
    }
    await performLogin(demo.role, undefined, demo.targetRoute);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Brand Logo & Back to Home */}
        <div
          onClick={() => navigate('/')}
          title="Quay về trang chủ"
          style={{ textAlign: 'center', marginBottom: 28, cursor: 'pointer' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 24,
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(2,132,199,0.35)',
            }}
          >
            H
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
            HR Connect
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 13 }}>
            Hệ thống Tuyển dụng & Quản trị Nhân sự Thông minh
          </Text>
        </div>

        {/* Login Form Card */}
        <Card
          style={{
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            background: '#ffffff',
          }}
          styles={{ body: { padding: '32px 28px' } }}
        >
          <div style={{ marginBottom: 20 }}>
            <Title level={4} style={{ margin: '0 0 4px', color: '#0f172a', fontWeight: 800 }}>
              Đăng nhập hệ thống
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Nhập thông tin tài khoản hoặc sử dụng nhanh các tài khoản demo bên dưới.
            </Text>
          </div>

          {/* Standard Login Form */}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleFormSubmit}
          >
            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 13 }}>Địa chỉ Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập địa chỉ email!' },
                { type: 'email', message: 'Địa chỉ email không đúng định dạng!' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                placeholder="ten@email.com"
                size="large"
                style={{ borderRadius: 10, height: 44 }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 13 }}>Mật khẩu</span>}
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Nhập mật khẩu..."
                size="large"
                style={{ borderRadius: 10, height: 44 }}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              style={{
                borderRadius: 10,
                fontWeight: 700,
                height: 46,
                fontSize: 15,
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
            >
              Đăng nhập
            </Button>
          </Form>

          {/* ─── Dotted Quick-fill Demo Box ─── */}
          <div
            style={{
              marginTop: 24,
              padding: '16px',
              borderRadius: 14,
              border: '1.5px dashed #0284c7',
              background: '#f0f9ff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ThunderboltOutlined style={{ color: '#0284c7', fontSize: 15 }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>
                Tài khoản chạy thử nghiệm (Demo)
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 12px', lineHeight: 1.4 }}>
              Nhấp vào vai trò bên dưới để tự động điền tài khoản và đăng nhập vào Dashboard tương ứng:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => void handleQuickFill(demo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = demo.color;
                    e.currentTarget.style.boxShadow = `0 2px 8px ${demo.color}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: demo.color,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                        {demo.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {demo.email} → <span style={{ color: demo.color, fontWeight: 600 }}>{demo.workspaceName}</span>
                      </div>
                    </div>
                  </div>

                  <Tag
                    color={demo.color}
                    style={{
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      margin: 0,
                      border: 'none',
                    }}
                  >
                    Đăng nhập
                  </Tag>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Note */}
          <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Chưa có tài khoản?{' '}
              <span
                onClick={() => navigate('/register')}
                style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
              >
                Đăng ký ngay
              </span>
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cần hỗ trợ truy cập hệ thống?{' '}
              <span
                onClick={() => navigate('/')}
                style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}
              >
                Về trang chủ
              </span>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};
