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
} from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { UserRole } from '@/types/roles';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AuthPageShell, AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from './AuthPageShell';

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

  const COMPACT_INPUT_CLASS =
    'h-10 text-xs sm:text-sm rounded-xl border border-white/70 bg-white/80 backdrop-blur-md text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-[#53B7E8] focus:border-[#1E9EDB] focus:bg-white transition-all';
  const COMPACT_LABEL_CLASS = 'text-xs font-bold text-slate-700';

  return (
    <AuthPageShell
      fitScreen
      wide
      eyebrow="Bắt đầu cùng HR Connect"
      title="Tạo tài khoản HR Connect"
      description="Chọn vai trò và hoàn tất thông tin để bắt đầu không gian làm việc của bạn."
      sideTitle="Một tài khoản, đúng trải nghiệm cho từng vai trò."
      sideDescription="Dù bạn đang tìm việc, tuyển người hay giới thiệu ứng viên, HR Connect giúp mọi bước rõ ràng và dễ theo dõi."
      benefits={[
        'Candidate quản lý CV và tiến trình ứng tuyển tập trung',
        'Doanh nghiệp theo dõi ứng viên theo từng Job',
        'Affiliate Recruiter ghi nhận nguồn giới thiệu minh bạch',
      ]}
    >
      {/* Role Selection Segmented Control */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-bold text-slate-700">Bạn đăng ký với vai trò nào?</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 backdrop-blur-sm p-1 border border-white/60">
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.role;
            return (
              <button
                type="button"
                key={option.role}
                onClick={() => {
                  setSelectedRole(option.role);
                  setErrorMessage(null);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-bold transition-all cursor-pointer border-0 ${
                  isSelected
                    ? 'bg-white text-[#1E9EDB] shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-sm">{option.icon}</span>
                <span className="truncate">{option.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <Alert
          message="Chưa thể hoàn tất đăng ký"
          description={errorMessage}
          type="error"
          showIcon
          closable
          onClose={() => setErrorMessage(null)}
          className="mb-2.5 rounded-xl py-1.5 px-3 text-xs"
        />
      )}

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} scrollToFirstError className="[&_.ant-form-item]:mb-2 sm:[&_.ant-form-item]:mb-2">
        {selectedRole === UserRole.CLIENT && (
          <Row gutter={10}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="companyName"
                label={<span className={COMPACT_LABEL_CLASS}>Tên doanh nghiệp</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập tên doanh nghiệp.' },
                  { min: 3, message: 'Tên doanh nghiệp cần ít nhất 3 ký tự.' },
                ]}
              >
                <Input prefix={<BankOutlined className="mr-1 text-slate-400" />} placeholder="Công ty Cổ phần Công nghệ XYZ" className={COMPACT_INPUT_CLASS} disabled={submitting} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="taxCode"
                label={<span className={COMPACT_LABEL_CLASS}>Mã số thuế</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập mã số thuế.' },
                  { pattern: /^[0-9]{10}(-[0-9]{3})?$/, message: 'Mã số thuế gồm 10 hoặc 13 số.' },
                ]}
              >
                <Input prefix={<IdcardOutlined className="mr-1 text-slate-400" />} placeholder="0312345678" maxLength={14} className={COMPACT_INPUT_CLASS} disabled={submitting} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={10}>
          <Col xs={24} sm={13}>
            <Form.Item
              name="fullName"
              label={<span className={COMPACT_LABEL_CLASS}>{selectedRole === UserRole.CLIENT ? 'Người đại diện' : 'Họ và tên'}</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập họ và tên.' },
                { min: 2, message: 'Họ tên cần ít nhất 2 ký tự.' },
              ]}
            >
              <Input autoComplete="name" prefix={<UserOutlined className="mr-1 text-slate-400" />} placeholder="Nguyễn Văn An" className={COMPACT_INPUT_CLASS} disabled={submitting} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={11}>
            <Form.Item
              name="phone"
              label={<span className={COMPACT_LABEL_CLASS}>Số điện thoại</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại.' },
                { pattern: /(84|0[3|5|7|8|9])+([0-9]{8})\b/, message: 'Số điện thoại Việt Nam chưa hợp lệ.' },
              ]}
            >
              <Input autoComplete="tel" prefix={<PhoneOutlined className="mr-1 text-slate-400" />} placeholder="0912 345 678" maxLength={11} className={COMPACT_INPUT_CLASS} disabled={submitting} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label={<span className={COMPACT_LABEL_CLASS}>{selectedRole === UserRole.CLIENT ? 'Email doanh nghiệp' : 'Email'}</span>}
          rules={[
            { required: true, message: 'Vui lòng nhập địa chỉ email.' },
            { type: 'email', message: 'Email chưa đúng định dạng.' },
          ]}
        >
          <Input type="email" autoComplete="email" prefix={<MailOutlined className="mr-1 text-slate-400" />} placeholder={selectedRole === UserRole.CLIENT ? 'tuyendung@congty.com' : 'ten@email.com'} className={COMPACT_INPUT_CLASS} disabled={submitting} />
        </Form.Item>

        <Row gutter={10}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="password"
              label={<span className={COMPACT_LABEL_CLASS}>Mật khẩu</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu.' },
                { min: 6, message: 'Mật khẩu cần ít nhất 6 ký tự.' },
              ]}
            >
              <Input.Password autoComplete="new-password" prefix={<LockOutlined className="mr-1 text-slate-400" />} placeholder="Tạo mật khẩu" onChange={(event) => setPasswordValue(event.target.value)} className={COMPACT_INPUT_CLASS} disabled={submitting} />
            </Form.Item>
            {passwordValue && (
              <div className="-mt-1 mb-1.5 flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-400">Độ mạnh:</span>
                <span className="font-bold" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${passwordStrength.percent}%`, backgroundColor: passwordStrength.color }}
                  />
                </div>
              </div>
            )}
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              label={<span className={COMPACT_LABEL_CLASS}>Nhập lại mật khẩu</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập lại mật khẩu.' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Hai mật khẩu chưa khớp.'));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" prefix={<SafetyCertificateOutlined className="mr-1 text-slate-400" />} placeholder="Nhập lại mật khẩu" className={COMPACT_INPUT_CLASS} disabled={submitting} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="terms"
          valuePropName="checked"
          rules={[{
            validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với điều khoản sử dụng.')),
          }]}
          className="!mb-2.5"
        >
          <Checkbox className="text-xs leading-5 text-slate-600">
            Tôi đồng ý với <a href="#terms" onClick={(event) => event.preventDefault()} className="font-semibold text-[#1E9EDB]">Điều khoản dịch vụ</a> và <a href="#privacy" onClick={(event) => event.preventDefault()} className="font-semibold text-[#1E9EDB]">Chính sách bảo mật</a>.
          </Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" size="large" loading={submitting} disabled={submitting} className="flex h-10 sm:h-11 w-full items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(135deg,#1E9EDB_0%,#53B7E8_100%)] text-sm font-bold text-white shadow-md shadow-[#1E9EDB]/30 hover:opacity-95 transition-all">
          <span>{submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</span>
          {!submitting && <ArrowRightOutlined />}
        </Button>
      </Form>

      <div className="mt-2 rounded-xl border border-white/70 bg-white/60 backdrop-blur-md py-1.5 px-3 text-center text-xs text-slate-600">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-bold text-[#1E9EDB] hover:text-[#168ec6]">Đăng nhập</Link>
      </div>
    </AuthPageShell>
  );
};

export default RegisterPage;
