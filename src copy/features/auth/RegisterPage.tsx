import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  message,
  Checkbox,
  Row,
  Col,
  Tag,
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
  SolutionOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Supported registration roles - STRICTLY NO ADMIN OR INTERNAL HR
type RegisterableRole = UserRole.CANDIDATE | UserRole.CLIENT | UserRole.AFFILIATE;

interface RoleOption {
  role: RegisterableRole;
  badge: string;
  title: string;
  tagline: string;
  description: string;
  accentColor: string;
  secondaryBg: string;
  icon: React.ReactNode;
  highlights: string[];
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: UserRole.CANDIDATE,
    badge: 'Dành cho nhân tài',
    title: 'Ứng viên tìm việc',
    tagline: 'Tech Talent & Job Seeker',
    description: 'Tìm kiếm công việc công nghệ, tạo CV và ứng tuyển nhanh',
    accentColor: '#8b5cf6',
    secondaryBg: '#f5f3ff',
    icon: <UserOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />,
    highlights: ['CV chuẩn ATS chuẩn quốc tế', 'Ứng tuyển 1-click & AI Match', 'Theo dõi trạng thái phỏng vấn'],
  },
  {
    role: UserRole.CLIENT,
    badge: 'Dành cho doanh nghiệp',
    title: 'Nhà tuyển dụng / Doanh nghiệp',
    tagline: 'Employer & Hiring Team',
    description: 'Đăng tin tuyển dụng qua 3 gói dịch vụ, thẩm định AI và quản lý thử việc',
    accentColor: '#0284c7',
    secondaryBg: '#f0f9ff',
    icon: <BankOutlined style={{ fontSize: 24, color: '#0284c7' }} />,
    highlights: ['3 Gói dịch vụ linh hoạt (Basic, Speed, Guaranteed)', 'AI Screen CV & Score Tier 5', 'Quản lý bảo hành thử việc 60 ngày'],
  },
  {
    role: UserRole.AFFILIATE,
    badge: 'Dành cho chuyên gia tuyển dụng',
    title: 'Cộng tác viên Headhunter (OPR Hub)',
    tagline: 'Headhunter & Talent Partner',
    description: 'Tìm nguồn ứng viên, kiếm hoa hồng và theo dõi sổ cái minh bạch',
    accentColor: '#f59e0b',
    secondaryBg: '#fffbeb',
    icon: <TeamOutlined style={{ fontSize: 24, color: '#f59e0b' }} />,
    highlights: ['Hoa hồng minh bạch tới 45M/deal', 'OPR Ledger & Smart Wallet', 'Không lo đụng nguồn ứng viên'],
  },
];

const COMPANY_SIZES = [
  { label: '1 - 10 nhân sự (Startup / Khởi nghiệp)', value: '1-10' },
  { label: '11 - 50 nhân sự (Doanh nghiệp vừa & nhỏ - SMB)', value: '11-50' },
  { label: '51 - 200 nhân sự (Quy mô tăng trưởng - Growth)', value: '51-200' },
  { label: '201 - 500 nhân sự (Doanh nghiệp lớn)', value: '201-500' },
  { label: '500+ nhân sự (Tập đoàn đa quốc gia - Enterprise)', value: '500+' },
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuthStore();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Parse role from query param or default to CANDIDATE
  const initialRole = ((): RegisterableRole => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') return UserRole.CLIENT;
    if (r === 'AFFILIATE') return UserRole.AFFILIATE;
    return UserRole.CANDIDATE;
  })();

  const [selectedRole, setSelectedRole] = useState<RegisterableRole>(initialRole);

  // Sync if query param changes
  useEffect(() => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') setSelectedRole(UserRole.CLIENT);
    else if (r === 'AFFILIATE') setSelectedRole(UserRole.AFFILIATE);
    else if (r === 'CANDIDATE') setSelectedRole(UserRole.CANDIDATE);
  }, [searchParams]);

  const activeOption = ROLE_OPTIONS.find((opt) => opt.role === selectedRole) || ROLE_OPTIONS[0];

  const handleRoleSelect = (role: RegisterableRole) => {
    setSelectedRole(role);
  };

  const onFinish = async (values: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    companyName?: string;
    companySize?: string;
    terms?: boolean;
  }) => {
    setSubmitting(true);

    try {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Register new user into store with exact input details
      const newUser = register({
        role: selectedRole,
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim(),
        companyName: values.companyName?.trim(),
        companySize: values.companySize,
      });

      // Target dashboard redirect map
      const redirectTargets: Record<RegisterableRole, string> = {
        [UserRole.CANDIDATE]: '/',
        [UserRole.CLIENT]: '/client/dashboard',
        [UserRole.AFFILIATE]: '/affiliate/dashboard',
      };

      const destination = redirectTargets[selectedRole] || '/dashboard';

      message.success({
        content: `Đăng ký thành công tài khoản ${activeOption.title}! Chào mừng ${newUser.name} gia nhập HR Connect.`,
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
        duration: 3,
      });

      navigate(destination, { replace: true });
    } catch {
      message.error('Có lỗi xảy ra khi tạo tài khoản. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860 }}>
        {/* Brand Header */}
        <div
          onClick={() => navigate('/')}
          title="Quay về trang chủ"
          style={{ textAlign: 'center', marginBottom: 28, cursor: 'pointer' }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 26,
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(2,132,199,0.35)',
              transition: 'transform 0.2s ease',
            }}
          >
            H
          </div>
          <Title
            level={2}
            style={{
              color: '#ffffff',
              margin: '0 0 6px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontSize: '28px',
            }}
          >
            Đăng ký tài khoản HR Connect
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: '15px' }}>
            Chọn mục tiêu tham gia của bạn để thiết lập trải nghiệm phù hợp
          </Text>
        </div>

        {/* ─── 1. Role Selection Cards ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bước 1: Chọn vai trò tài khoản của bạn
            </span>
            <span style={{ color: '#64748b', fontSize: 12 }}>
              Vai trò đã chọn: <strong style={{ color: activeOption.accentColor }}>{activeOption.title}</strong>
            </span>
          </div>

          <Row gutter={[16, 16]}>
            {ROLE_OPTIONS.map((opt) => {
              const isSelected = selectedRole === opt.role;

              return (
                <Col xs={24} sm={8} key={opt.role}>
                  <div
                    onClick={() => handleRoleSelect(opt.role)}
                    style={{
                      height: '100%',
                      background: isSelected ? '#ffffff' : 'rgba(30, 41, 59, 0.7)',
                      border: isSelected
                        ? `2.5px solid ${opt.accentColor}`
                        : '1.5px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 16,
                      padding: '20px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected
                        ? `0 12px 28px -6px ${opt.accentColor}40, 0 0 0 1px ${opt.accentColor}20`
                        : '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transform: isSelected ? 'translateY(-3px)' : 'none',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    {/* Active Checkmark Pill */}
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          background: opt.accentColor,
                          color: '#fff',
                          borderRadius: '50%',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          boxShadow: `0 2px 8px ${opt.accentColor}60`,
                        }}
                      >
                        <CheckCircleFilled />
                      </div>
                    )}

                    <div>
                      {/* Badge / Tag */}
                      <Tag
                        style={{
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          marginBottom: 12,
                          border: 'none',
                          background: isSelected ? opt.secondaryBg : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? opt.accentColor : '#94a3b8',
                        }}
                      >
                        {opt.badge}
                      </Tag>

                      {/* Icon & Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: isSelected ? opt.secondaryBg : 'rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {opt.icon}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: isSelected ? '#0f172a' : '#f8fafc',
                              lineHeight: 1.3,
                            }}
                          >
                            {opt.title}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: isSelected ? '#64748b' : '#64748b',
                              fontWeight: 500,
                            }}
                          >
                            {opt.tagline}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <Paragraph
                        style={{
                          fontSize: 13,
                          color: isSelected ? '#334155' : '#94a3b8',
                          margin: '8px 0 14px',
                          lineHeight: 1.5,
                        }}
                      >
                        {opt.description}
                      </Paragraph>
                    </div>

                    {/* Highlights list */}
                    <div
                      style={{
                        paddingTop: 10,
                        borderTop: isSelected ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {opt.highlights.map((h, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11,
                            color: isSelected ? '#475569' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              color: opt.accentColor,
                              fontWeight: 'bold',
                              fontSize: 13,
                              lineHeight: 1,
                            }}
                          >
                            ✓
                          </span>
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>

        {/* ─── 2. Dynamic Registration Form Card ─── */}
        <Card
          style={{
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            background: '#ffffff',
            overflow: 'hidden',
          }}
          styles={{ body: { padding: '36px 32px' } }}
        >
          {/* Form Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '1px solid #f1f5f9',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <Title level={4} style={{ margin: '0 0 4px', color: '#0f172a', fontWeight: 800 }}>
                Thông tin tài khoản
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Đang thiết lập biểu mẫu cho vai trò:{' '}
                <strong style={{ color: activeOption.accentColor }}>{activeOption.title}</strong>
              </Text>
            </div>

            <Tag
              color={activeOption.accentColor}
              style={{
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {activeOption.badge}
            </Tag>
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark="optional"
            onFinish={onFinish}
            initialValues={{
              terms: true,
            }}
          >
            {/* Common Row 1: Full name & Phone */}
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Họ và tên *</span>}
                  name="fullName"
                  rules={[
                    { required: true, message: 'Vui lòng nhập họ và tên của bạn!' },
                    { min: 2, message: 'Họ và tên tối thiểu 2 ký tự!' },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                    placeholder={
                      selectedRole === UserRole.CLIENT
                        ? 'VD: Nguyễn Thị Lan (HR Manager)'
                        : selectedRole === UserRole.AFFILIATE
                        ? 'VD: Trần Minh Đức (Headhunter)'
                        : 'VD: Nguyễn Văn An'
                    }
                    size="large"
                    style={{ borderRadius: 10, height: 44 }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Số điện thoại *</span>}
                  name="phone"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số điện thoại!' },
                    {
                      pattern: /^(0[3|5|7|8|9])[0-9]{8}$/,
                      message: 'Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09)!',
                    },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="VD: 0912 345 678"
                    size="large"
                    style={{ borderRadius: 10, height: 44 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Common Row 2: Email */}
            <Form.Item
              label={
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {selectedRole === UserRole.CLIENT ? 'Email doanh nghiệp *' : 'Địa chỉ Email *'}
                </span>
              }
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập địa chỉ email!' },
                { type: 'email', message: 'Địa chỉ email không đúng định dạng!' },
              ]}
              extra={
                selectedRole === UserRole.CLIENT ? (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Khuyên dùng email tên miền công ty (VD: hr@congty.com) để kích hoạt nhanh tính năng thẩm định hồ sơ.
                  </span>
                ) : undefined
              }
            >
              <Input
                prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                placeholder={
                  selectedRole === UserRole.CLIENT
                    ? 'tuyendung@doanhnghiep.vn'
                    : selectedRole === UserRole.AFFILIATE
                    ? 'recruiter@partner.vn'
                    : 'ungvien@gmail.com'
                }
                size="large"
                style={{ borderRadius: 10, height: 44 }}
              />
            </Form.Item>

            {/* ─── CLIENT SPECIFIC FIELDS: Tên công ty & Quy mô doanh nghiệp ─── */}
            {selectedRole === UserRole.CLIENT && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #bae6fd',
                  borderRadius: 14,
                  padding: '20px 20px 8px',
                  marginBottom: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <BankOutlined style={{ color: '#0284c7', fontSize: 16 }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>
                    Thông tin Pháp nhân Tuyển dụng (Bắt buộc cho Doanh nghiệp)
                  </span>
                </div>

                <Row gutter={16}>
                  <Col xs={24} md={14}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Tên công ty *</span>}
                      name="companyName"
                      rules={[
                        { required: true, message: 'Vui lòng nhập tên công ty hoặc tổ chức tuyển dụng!' },
                        { min: 3, message: 'Tên công ty cần tối thiểu 3 ký tự!' },
                      ]}
                    >
                      <Input
                        prefix={<BankOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="VD: Công ty Cổ phần Công nghệ TechVina"
                        size="large"
                        style={{ borderRadius: 10, height: 44, background: '#ffffff' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={10}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Quy mô doanh nghiệp *</span>}
                      name="companySize"
                      rules={[
                        { required: true, message: 'Vui lòng chọn quy mô nhân sự của công ty!' },
                      ]}
                    >
                      <Select
                        placeholder="Chọn quy mô nhân sự"
                        size="large"
                        style={{ width: '100%', height: 44 }}
                        dropdownStyle={{ borderRadius: 10 }}
                      >
                        {COMPANY_SIZES.map((size) => (
                          <Option key={size.value} value={size.value}>
                            {size.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )}

            {/* Common Row 3: Mật khẩu & Xác nhận mật khẩu */}
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Mật khẩu *</span>}
                  name="password"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu!' },
                    { min: 6, message: 'Mật khẩu phải chứa ít nhất 6 ký tự!' },
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="Ít nhất 6 ký tự..."
                    size="large"
                    style={{ borderRadius: 10, height: 44 }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Xác nhận mật khẩu *</span>}
                  name="confirmPassword"
                  dependencies={['password']}
                  hasFeedback
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="Nhập lại mật khẩu..."
                    size="large"
                    style={{ borderRadius: 10, height: 44 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Terms checkbox */}
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
              style={{ marginBottom: 24 }}
            >
              <Checkbox style={{ fontSize: 12, color: '#64748b' }}>
                Tôi đồng ý với{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: activeOption.accentColor }}>
                  Điều khoản dịch vụ
                </a>{' '}
                và{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: activeOption.accentColor }}>
                  Chính sách bảo mật
                </a>{' '}
                của HR Connect.
              </Checkbox>
            </Form.Item>

            {/* Submit Button */}
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              style={{
                borderRadius: 12,
                fontWeight: 700,
                height: 50,
                fontSize: 16,
                background:
                  selectedRole === UserRole.CANDIDATE
                    ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                    : selectedRole === UserRole.CLIENT
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                boxShadow: `0 4px 16px ${activeOption.accentColor}40`,
                transition: 'all 0.3s ease',
              }}
            >
              Tạo tài khoản ngay
            </Button>
          </Form>

          {/* Guarantee / Security badge */}
          <div
            style={{
              marginTop: 24,
              padding: '12px 16px',
              borderRadius: 10,
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 12,
              color: '#64748b',
            }}
          >
            <SafetyCertificateOutlined style={{ color: '#10b981', fontSize: 16 }} />
            <span>Cam kết bảo mật dữ liệu theo tiêu chuẩn ISO 27001 & Mã hóa TLS 1.3</span>
          </div>

          {/* Footer Note: Login link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Đã có tài khoản?{' '}
              <span
                onClick={() => navigate('/login')}
                style={{
                  color: '#0284c7',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                Đăng nhập tại đây
              </span>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};
