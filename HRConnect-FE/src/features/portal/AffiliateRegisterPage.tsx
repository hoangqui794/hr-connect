/**
 * @file AffiliateRegisterPage.tsx
 * @description Public sign-up for Affiliates (POST /auth/register/affiliate, mockup 03/11). After it
 * the person verifies the email by OTP like every other role, then waits for Admin approval.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, ConfigProvider, Form, Input } from 'antd';
import { BrandMark } from '@/components/common/BrandMark';
import { isValidVietnamPhoneNumber, VIETNAM_PHONE_VALIDATION_MESSAGE } from '@/constants/phoneValidation';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { UserRole } from '@/types/roles';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const STEPS = [
  { title: 'Đăng ký và chờ duyệt', body: 'Admin xem hồ sơ của bạn trước khi mở quyền giới thiệu.' },
  { title: 'Giới thiệu ứng viên', body: 'Ứng viên nhận email và tự đồng ý cho từng job.' },
  { title: 'Nhận hoa hồng', body: 'Khi ứng viên đi làm đủ thời gian bảo hành và doanh nghiệp đã thanh toán.' },
];

type RegisterForm = { fullName: string; email: string; phone?: string; password: string; terms: boolean };

export const AffiliateRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: RegisterForm) => {
    const email = values.email.trim().toLowerCase();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authService.registerAffiliate({
        fullName: values.fullName.trim(),
        phone: values.phone?.trim() || undefined,
        email,
        password: values.password,
      });
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(UserRole.AFFILIATE)}`, {
        replace: true,
        state: { email, role: UserRole.AFFILIATE, message: res.message },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Đăng ký không thành công.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#0284C7', colorPrimaryHover: '#0369A1', colorLink: '#0369A1', borderRadius: 8, colorTextPlaceholder: '#6B7280', colorTextDescription: '#6B7280', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" } }}>
      <div className="flex min-h-screen flex-col bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-gray-800">
        <header className="flex h-16 items-center bg-[#0C4A6E] px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2 text-[17px] font-bold text-white no-underline hover:text-white">
            <BrandMark size={30} tone="light" /> HR Connect
          </Link>
          <span className="ml-auto text-[13px] text-sky-100">
            Đã có tài khoản? <Link to="/login" className="font-semibold text-white hover:text-white">Đăng nhập</Link>
          </span>
        </header>
        <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-wrap items-start gap-12 px-4 py-10 sm:px-6 sm:py-12">
          <section className="min-w-0 flex-[1_1_420px]">
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Dành cho người giới thiệu ứng viên</span>
            <h1 className="m-0 mb-2.5 mt-3.5 text-[28px] font-bold leading-tight text-[#0C4A6E]">
              Giới thiệu đúng người,
              <br />
              nhận hoa hồng khi họ được tuyển.
            </h1>
            <p className="m-0 mb-6 max-w-[460px] text-[15px] leading-relaxed text-gray-600">
              Affiliate xem các job "Tuyển qua Affiliate" và "Mua CV", gửi ứng viên phù hợp và theo dõi đến khi ứng viên đi làm.
            </p>
            <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C4A6E] text-[13px] font-bold text-white">{i + 1}</span>
                  <span>
                    <b className="text-gray-900">{s.title}</b>
                    <span className="block text-[13px] text-gray-600">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="aff-register" className="min-w-0 flex-[1_1_400px] rounded-lg border border-solid border-gray-200 bg-white p-7">
            <h2 id="aff-register" className="m-0 mb-4 text-xl font-bold text-gray-900">Đăng ký Affiliate</h2>
            {error && <Alert className="mb-4" type="error" showIcon message={error} />}
            <Form<RegisterForm> layout="vertical" requiredMark={false} onFinish={onFinish} disabled={submitting}>
              <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 255, message: 'Tối đa 255 ký tự.' }]}>
                <Input size="large" autoComplete="name" />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email.' }, { type: 'email', message: 'Email không hợp lệ.' }, { max: 255, message: 'Tối đa 255 ký tự.' }]}>
                <Input size="large" type="email" autoComplete="email" />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[{ validator: (_, v) => (!v || isValidVietnamPhoneNumber(v) ? Promise.resolve() : Promise.reject(new Error(VIETNAM_PHONE_VALIDATION_MESSAGE))) }]}
              >
                <Input size="large" type="tel" autoComplete="tel" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Mật khẩu"
                extra="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt."
                rules={[{ required: true, message: 'Nhập mật khẩu.' }, { pattern: PASSWORD_RULE, message: 'Mật khẩu chưa đủ yêu cầu.' }]}
              >
                <Input.Password size="large" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="terms"
                valuePropName="checked"
                rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Cần đồng ý để tiếp tục.'))) }]}
              >
                <Checkbox>Tôi đồng ý với điều khoản Affiliate và chỉ giới thiệu ứng viên đồng ý chia sẻ hồ sơ.</Checkbox>
              </Form.Item>
              <Button type="primary" size="large" block htmlType="submit" loading={submitting}>Gửi đăng ký</Button>
            </Form>
            <p className="m-0 mt-3 text-center text-xs text-gray-500">Admin duyệt hồ sơ trước khi bạn giới thiệu được ứng viên.</p>
          </section>
        </main>
      </div>
    </ConfigProvider>
  );
};

export default AffiliateRegisterPage;
