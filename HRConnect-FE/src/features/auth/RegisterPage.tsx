/**
 * @file RegisterPage.tsx
 * @description Modern, sleek Registration Page for HR Connect.
 * Implements 3 distinct registration flows conforming to Swagger OpenAPI:
 *   - Candidate: POST /api/v1/auth/register/candidate
 *   - Client Company: POST /api/v1/auth/register/client
 *   - Affiliate Recruiter: POST /api/v1/auth/register/affiliate
 *
 * Compact role selector, real-time password strength meter, password matching,
 * defensive error handling, and redirection to OTP verification.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  Button,
  Typography,
  message,
  Checkbox,
  Row,
  Col,
  Alert,
  Progress,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  BankOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  TeamOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { UserRole } from '@/types/roles';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';

const { Title, Text } = Typography;

type RegisterableRole = UserRole.CANDIDATE | UserRole.CLIENT | UserRole.AFFILIATE;

interface RoleOption {
  role: RegisterableRole;
  title: string;
  badge: string;
  subtitle: string;
  accentColor: string;
  activeBg: string;
  icon: React.ReactNode;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: UserRole.CANDIDATE,
    title: 'Ứng viên tìm việc',
    badge: 'Talent',
    subtitle: 'Tìm việc công nghệ, tạo CV ATS & AI Match',
    accentColor: '#8b5cf6', // purple-500
    activeBg: 'rgba(139, 92, 246, 0.1)',
    icon: <UserOutlined style={{ fontSize: 20, color: '#8b5cf6' }} />,
  },
  {
    role: UserRole.CLIENT,
    title: 'Doanh nghiệp',
    badge: 'Employer',
    subtitle: 'Đăng tin tuyển dụng, thẩm định AI & bảo hành',
    accentColor: '#0284c7', // sky-600
    activeBg: 'rgba(2, 132, 199, 0.1)',
    icon: <BankOutlined style={{ fontSize: 20, color: '#0284c7' }} />,
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Cộng tác viên (Headhunter)',
    badge: 'Partner',
    subtitle: 'Giới thiệu ứng viên & nhận hoa hồng minh bạch',
    accentColor: '#f59e0b', // amber-500
    activeBg: 'rgba(245, 158, 11, 0.1)',
    icon: <TeamOutlined style={{ fontSize: 20, color: '#f59e0b' }} />,
  },
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState<string>('');

  // Initial role from query param (?role=candidate|client|affiliate)
  const initialRole = ((): RegisterableRole => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') return UserRole.CLIENT;
    if (r === 'AFFILIATE') return UserRole.AFFILIATE;
    return UserRole.CANDIDATE;
  })();

  const [selectedRole, setSelectedRole] = useState<RegisterableRole>(initialRole);

  useEffect(() => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') setSelectedRole(UserRole.CLIENT);
    else if (r === 'AFFILIATE') setSelectedRole(UserRole.AFFILIATE);
    else if (r === 'CANDIDATE') setSelectedRole(UserRole.CANDIDATE);
  }, [searchParams]);

  const activeOption = useMemo(
    () => ROLE_OPTIONS.find((opt) => opt.role === selectedRole) || ROLE_OPTIONS[0],
    [selectedRole]
  );

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!passwordValue) return { score: 0, label: '', percent: 0, color: '#e2e8f0' };
    let score = 0;
    if (passwordValue.length >= 6) score += 1;
    if (passwordValue.length >= 8) score += 1;
    if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score += 1;
    if (/\d/.test(passwordValue)) score += 1;
    if (/[^A-Za-z0-9]/.test(passwordValue)) score += 1;

    if (score <= 1) return { score: 1, label: 'Rất yếu', percent: 20, color: '#ef4444' };
    if (score === 2) return { score: 2, label: 'Yếu', percent: 40, color: '#f97316' };
    if (score === 3) return { score: 3, label: 'Trung bình', percent: 65, color: '#f59e0b' };
    if (score === 4) return { score: 4, label: 'Khá mạnh', percent: 85, color: '#0ea5e9' };
    return { score: 5, label: 'Rất an toàn', percent: 100, color: '#10b981' };
  }, [passwordValue]);

  // Form submission handler routing to the exact Swagger API endpoint
  const onFinish = async (values: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword?: string;
    companyName?: string;
    taxCode?: string;
    terms?: boolean;
  }) => {
    setErrorMessage(null);
    setSubmitting(true);

    const emailTrimmed = values.email.trim().toLowerCase();
    const fullNameTrimmed = values.fullName.trim();
    const phoneTrimmed = values.phone ? values.phone.trim() : undefined;

    try {
      let isSuccess = false;
      let serverMessage = '';

      if (selectedRole === UserRole.CLIENT) {
        // POST /api/v1/auth/register/client
        const res = await authService.registerClient({
          companyName: values.companyName?.trim(),
          taxCode: values.taxCode?.trim(),
          fullName: fullNameTrimmed,
          phone: phoneTrimmed,
          email: emailTrimmed,
          password: values.password,
        });

        if (res.success || res.data) {
          isSuccess = true;
          serverMessage = res.message || 'Đăng ký tài khoản doanh nghiệp thành công!';
        } else {
          throw new Error(res.message || 'Đăng ký doanh nghiệp không thành công.');
        }
      } else if (selectedRole === UserRole.AFFILIATE) {
        // POST /api/v1/auth/register/affiliate
        const res = await authService.registerAffiliate({
          fullName: fullNameTrimmed,
          phone: phoneTrimmed,
          email: emailTrimmed,
          password: values.password,
        });

        if (res.success || res.data) {
          isSuccess = true;
          serverMessage = res.message || 'Đăng ký đối tác tuyển dụng thành công!';
        } else {
          throw new Error(res.message || 'Đăng ký đối tác không thành công.');
        }
      } else {
        // POST /api/v1/auth/register/candidate
        const res = await authService.registerCandidate({
          fullName: fullNameTrimmed,
          phone: phoneTrimmed,
          email: emailTrimmed,
          password: values.password,
        });

        if (res.success || res.data) {
          isSuccess = true;
          serverMessage = res.message || 'Đăng ký tài khoản ứng viên thành công!';
        } else {
          throw new Error(res.message || 'Đăng ký tài khoản không thành công.');
        }
      }

      if (isSuccess) {
        message.success({
          content: 'Đăng ký thành công! Vui lòng kiểm tra email để nhập mã OTP kích hoạt tài khoản.',
          icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
          duration: 5,
        });

        // Redirect immediately to OTP Verification page with encoded query params
        navigate(
          `/verify-otp?email=${encodeURIComponent(emailTrimmed)}&role=${encodeURIComponent(
            selectedRole
          )}`,
          {
            replace: true,
            state: {
              email: emailTrimmed,
              role: selectedRole,
              message: serverMessage,
            },
          }
        );
      }
    } catch (err: unknown) {
      const formattedError = getApiErrorMessage(
        err,
        'Không thể hoàn tất đăng ký. Vui lòng kiểm tra lại thông tin!'
      );
      setErrorMessage(formattedError);
      message.error({ content: formattedError, duration: 5 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Subtle modern background gradient orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[350px] bg-purple-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/')}
          className="text-center mb-5 cursor-pointer select-none group"
          title="Quay về trang chủ HR Connect"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xl mx-auto mb-2 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
            H
          </div>
          <Title
            level={3}
            style={{
              color: '#ffffff',
              margin: '0 0 2px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontSize: '22px',
            }}
          >
            Đăng ký tài khoản HR Connect
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: '13px' }}>
            Nền tảng tuyển dụng công nghệ & quản trị bảo hành nhân tài
          </Text>
        </div>

        {/* ─── 1. COMPACT ROLE SELECTOR (Gọn gàng, giảm chiều cao tối đa) ─── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 mb-5 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((opt) => {
              const isSelected = selectedRole === opt.role;
              return (
                <button
                  type="button"
                  key={opt.role}
                  onClick={() => {
                    setSelectedRole(opt.role);
                    setErrorMessage(null);
                  }}
                  className={`relative flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-2 shadow-sm'
                      : 'bg-slate-900/50 hover:bg-slate-800/60 border border-transparent'
                  }`}
                  style={{
                    borderColor: isSelected ? opt.accentColor : 'transparent',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected ? `${opt.accentColor}25` : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {opt.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {opt.badge}
                    </span>
                  </div>

                  {isSelected && (
                    <div
                      className="w-2 h-2 rounded-full absolute top-2 right-2"
                      style={{ backgroundColor: opt.accentColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── 2. DYNAMIC REGISTRATION FORM CONTAINER ─── */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          {/* Active Role Description Banner */}
          <div
            className="flex items-center justify-between px-3.5 py-2 rounded-lg mb-5 border text-xs font-medium"
            style={{
              backgroundColor: activeOption.activeBg,
              borderColor: `${activeOption.accentColor}30`,
              color: activeOption.accentColor,
            }}
          >
            <span>
              Vai trò:{' '}
              <strong className="font-bold underline decoration-dotted ml-1">
                {activeOption.title}
              </strong>
            </span>
            <span className="text-slate-400 hidden sm:inline text-[11px]">
              {activeOption.subtitle}
            </span>
          </div>

          {/* Backend Error Alert Box */}
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

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            scrollToFirstError
          >
            {/* ── CASE A: CLIENT / DOANH NGHIỆP FIELDS ── */}
            {selectedRole === UserRole.CLIENT && (
              <>
                <Row gutter={12}>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      name="companyName"
                      label={<span className="text-slate-300 text-xs font-semibold">Tên Doanh Nghiệp / Công ty *</span>}
                      rules={[
                        { required: true, message: 'Vui lòng nhập tên pháp nhân công ty!' },
                        { min: 3, message: 'Tên công ty tối thiểu 3 ký tự!' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<BankOutlined className="text-slate-500 mr-1" />}
                        placeholder="Công ty Cổ phần Công nghệ XYZ"
                        className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                        disabled={submitting}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={10}>
                    <Form.Item
                      name="taxCode"
                      label={<span className="text-slate-300 text-xs font-semibold">Mã số thuế (MST) *</span>}
                      rules={[
                        { required: true, message: 'Vui lòng nhập mã số thuế!' },
                        {
                          pattern: /^[0-9]{10}(-[0-9]{3})?$/,
                          message: 'MST hợp lệ gồm 10 hoặc 13 số (ví dụ: 0312345678)!',
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<IdcardOutlined className="text-slate-500 mr-1" />}
                        placeholder="0312345678"
                        maxLength={14}
                        className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                        disabled={submitting}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}

            {/* ── COMMON FIELDS: Full Name & Phone ── */}
            <Row gutter={12}>
              <Col xs={24} sm={13}>
                <Form.Item
                  name="fullName"
                  label={
                    <span className="text-slate-300 text-xs font-semibold">
                      {selectedRole === UserRole.CLIENT
                        ? 'Người đại diện tuyển dụng *'
                        : 'Họ và tên *'}
                    </span>
                  }
                  rules={[
                    { required: true, message: 'Vui lòng nhập đầy đủ họ và tên!' },
                    { min: 2, message: 'Họ tên quá ngắn!' },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<UserOutlined className="text-slate-500 mr-1" />}
                    placeholder={selectedRole === UserRole.CLIENT ? 'Nguyễn Văn A (HR Director)' : 'Nguyễn Văn An'}
                    className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                    disabled={submitting}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={11}>
                <Form.Item
                  name="phone"
                  label={<span className="text-slate-300 text-xs font-semibold">Số điện thoại *</span>}
                  rules={[
                    { required: true, message: 'Vui lòng nhập số điện thoại!' },
                    {
                      pattern: /(84|0[3|5|7|8|9])+([0-9]{8})\b/,
                      message: 'Số điện thoại Việt Nam không hợp lệ!',
                    },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<PhoneOutlined className="text-slate-500 mr-1" />}
                    placeholder="0912 345 678"
                    maxLength={11}
                    className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                    disabled={submitting}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* ── Email Field ── */}
            <Form.Item
              name="email"
              label={
                <span className="text-slate-300 text-xs font-semibold">
                  {selectedRole === UserRole.CLIENT ? 'Email doanh nghiệp *' : 'Địa chỉ Email *'}
                </span>
              }
              rules={[
                { required: true, message: 'Vui lòng nhập địa chỉ email!' },
                { type: 'email', message: 'Email không đúng định dạng!' },
              ]}
            >
              <Input
                size="large"
                type="email"
                prefix={<MailOutlined className="text-slate-500 mr-1" />}
                placeholder={selectedRole === UserRole.CLIENT ? 'tuyendung@company.com' : 'example@gmail.com'}
                className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                disabled={submitting}
              />
            </Form.Item>

            {/* ── Password & Confirm Password Row ── */}
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="password"
                  label={<span className="text-slate-300 text-xs font-semibold">Mật khẩu *</span>}
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu!' },
                    { min: 6, message: 'Mật khẩu phải từ 6 ký tự trở lên!' },
                  ]}
                >
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined className="text-slate-500 mr-1" />}
                    placeholder="Ít nhất 6 ký tự"
                    onChange={(e) => setPasswordValue(e.target.value)}
                    className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                    disabled={submitting}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="confirmPassword"
                  dependencies={['password']}
                  label={<span className="text-slate-300 text-xs font-semibold">Xác nhận mật khẩu *</span>}
                  rules={[
                    { required: true, message: 'Vui lòng nhập lại mật khẩu!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không trùng khớp!'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    size="large"
                    prefix={<SafetyCertificateOutlined className="text-slate-500 mr-1" />}
                    placeholder="Nhập lại mật khẩu"
                    className="rounded-xl !bg-slate-950 !border-slate-800 !text-slate-100 hover:!border-blue-500 focus:!border-blue-500 placeholder:!text-slate-600"
                    disabled={submitting}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* ── Password Strength Meter (Trực quan) ── */}
            {passwordValue && (
              <div className="mb-4 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 text-[11px]">Độ mạnh mật khẩu:</span>
                  <span
                    className="font-semibold text-[11px]"
                    style={{ color: passwordStrength.color }}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <Progress
                  percent={passwordStrength.percent}
                  strokeColor={passwordStrength.color}
                  showInfo={false}
                  size="small"
                  className="m-0"
                />
              </div>
            )}

            {/* ── Terms and Policy ── */}
            <Form.Item
              name="terms"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, value) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(new Error('Vui lòng đồng ý với điều khoản sử dụng!')),
                },
              ]}
              className="mb-4"
            >
              <Checkbox className="text-xs text-slate-400">
                Tôi đồng ý với{' '}
                <a
                  href="#terms"
                  onClick={(e) => e.preventDefault()}
                  className="text-blue-400 hover:underline"
                >
                  Điều khoản dịch vụ
                </a>{' '}
                và{' '}
                <a
                  href="#privacy"
                  onClick={(e) => e.preventDefault()}
                  className="text-blue-400 hover:underline"
                >
                  Chính sách bảo mật
                </a>{' '}
                của HR Connect.
              </Checkbox>
            </Form.Item>

            {/* ── Submit Button ── */}
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              disabled={submitting}
              className="w-full h-11 rounded-xl font-bold text-sm shadow-lg border-none flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.99]"
              style={{
                backgroundColor: activeOption.accentColor,
                boxShadow: `0 8px 20px -4px ${activeOption.accentColor}50`,
              }}
            >
              <span>Đăng ký tài khoản</span>
              <ArrowRightOutlined />
            </Button>
          </Form>

          {/* Footer Navigation */}
          <div className="text-center mt-5 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            <span>Đã có tài khoản trên HR Connect? </span>
            <Link
              to="/login"
              className="font-semibold text-blue-400 hover:text-blue-300 ml-1 transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>

        {/* Security Assurance Badge */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-slate-500">
          <CheckCircleOutlined className="text-emerald-500" />
          <span>Bảo mật chuẩn mã hóa dữ liệu SSL 256-bit & Tuân thủ Nghị định 13/2023/NĐ-CP</span>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
