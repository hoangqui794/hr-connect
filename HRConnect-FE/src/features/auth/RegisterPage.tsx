/**
 * @file RegisterPage.tsx
 * @description Unified Account Creation page (Candidate, Client Employer, and Affiliate Partner).
 * - Symmetrical, intuitive 3-card role selector without jarring redirects.
 * - Dynamic form fields based on the selected role:
 *     - Candidate: Full Name, Email, Phone, Password, Terms.
 *     - Client: Company Name, Tax Code, Representative Name, Email, Phone, Password, Terms.
 *     - Affiliate: Full Name, Email, Phone, Password, Terms.
 * - Smooth transition, zero layout shift (CLS), mobile-friendly and accessible.
 */

import React, { useEffect, useState } from 'react';
import { App, Modal } from 'antd';
import {
  CheckCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { isValidVietnamPhoneNumber, VIETNAM_PHONE_VALIDATION_MESSAGE } from '@/constants/phoneValidation';
import { getApiErrorMessage } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { UserRole } from '@/types/roles';
import { appendCandidateReturnPath, getSafeCandidateReturnPath } from './authReturnPath';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULE = 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
const strongPassword = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);

type RegisterableRole = UserRole.CANDIDATE | UserRole.CLIENT | UserRole.AFFILIATE;
type Field = 'companyName' | 'taxCode' | 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms';
type Errors = Partial<Record<Field, string>>;

interface RoleOption {
  role: RegisterableRole;
  title: string;
  badge: string;
  hint: string;
  icon: React.ReactNode;
}

const ROLES: RoleOption[] = [
  {
    role: UserRole.CANDIDATE,
    title: 'Người tìm việc',
    badge: 'Ứng viên',
    hint: 'Tìm việc, ứng tuyển, tạo CV',
    icon: <UserOutlined className="text-xl" />,
  },
  {
    role: UserRole.CLIENT,
    title: 'Nhà tuyển dụng',
    badge: 'Doanh nghiệp',
    hint: 'Đăng tin, tuyển qua Affiliate, mua CV. Cần xác minh công ty.',
    icon: <BankOutlined className="text-xl" />,
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Affiliate',
    badge: 'Đối tác CTV',
    hint: 'Giới thiệu ứng viên, nhận hoa hồng. Cần được duyệt.',
    icon: <TeamOutlined className="text-xl" />,
  },
];

const TextField: React.FC<{
  id: string;
  label: React.ReactNode;
  value: string;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  disabled: boolean;
  wide?: boolean;
  revealable?: boolean;
  onChange: (value: string) => void;
}> = ({ id, label, value, error, hint, type = 'text', autoComplete, placeholder, maxLength, disabled, wide, revealable, onChange }) => {
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealable && shown ? 'text' : type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`block h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 ${
            revealable ? 'pr-11' : ''
          } ${
            error
              ? 'border-rose-400 focus:border-rose-500'
              : 'border-slate-300 hover:border-slate-400 focus:border-sky-600'
          }`}
        />
        {revealable && (
          <button
            type="button"
            aria-label={`${shown ? 'Ẩn' : 'Hiện'} ${String(label).toLowerCase()}`}
            onClick={() => setShown((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none shadow-none"
          >
            <span aria-hidden="true" className="flex items-center justify-center">
              {shown ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
            </span>
          </button>
        )}
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs font-medium text-rose-600">{error}</span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-xs text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const candidateReturnTo = getSafeCandidateReturnPath(searchParams.get('returnTo'));

  const initialRole = (() => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') return UserRole.CLIENT;
    if (r === 'AFFILIATE') return UserRole.AFFILIATE;
    return UserRole.CANDIDATE;
  })();

  const [role, setRole] = useState<RegisterableRole>(initialRole);
  const [values, setValues] = useState({
    companyName: '',
    taxCode: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [splitModal, setSplitModal] = useState<{
    visible: boolean;
    email: string;
    maskedPrimaryEmail: string;
    otpSent: boolean;
    otp: string;
    loading: boolean;
    error: string | null;
  }>({
    visible: false,
    email: '',
    maskedPrimaryEmail: '',
    otpSent: false,
    otp: '',
    loading: false,
    error: null,
  });

  const isClient = role === UserRole.CLIENT;
  const isAffiliate = role === UserRole.AFFILIATE;

  useEffect(() => {
    const requested = searchParams.get('role')?.toUpperCase();
    if (requested === 'CLIENT') setRole(UserRole.CLIENT);
    else if (requested === 'AFFILIATE') setRole(UserRole.AFFILIATE);
    else if (requested === 'CANDIDATE') setRole(UserRole.CANDIDATE);
  }, [searchParams]);

  const chooseRole = (next: RegisterableRole) => {
    setRole(next);
    setErrors({});
    setFormError(null);
  };

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (isClient) {
      if (values.companyName.trim().length < 3) found.companyName = 'Tên doanh nghiệp cần ít nhất 3 ký tự.';
      if (!/^[0-9]{10}(-[0-9]{3})?$/.test(values.taxCode.trim())) found.taxCode = 'Mã số thuế gồm 10 hoặc 13 số.';
      if (!values.phone.trim()) found.phone = 'Vui lòng nhập số điện thoại.';
    }
    if (values.fullName.trim().length < 2) found.fullName = isClient ? 'Vui lòng nhập họ tên người đại diện.' : 'Họ và tên cần ít nhất 2 ký tự.';
    if (!EMAIL_REGEX.test(values.email.trim())) found.email = 'Vui lòng nhập đúng địa chỉ email.';
    if (values.phone.trim() && !isValidVietnamPhoneNumber(values.phone)) found.phone = VIETNAM_PHONE_VALIDATION_MESSAGE;
    if (!strongPassword(values.password)) found.password = PASSWORD_RULE;
    if (values.confirmPassword !== values.password) found.confirmPassword = 'Hai mật khẩu chưa khớp.';
    if (!terms) found.terms = 'Vui lòng đồng ý với điều khoản sử dụng.';
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setFormError(null);
    setSubmitting(true);
    const email = values.email.trim().toLowerCase();
    const person = {
      fullName: values.fullName.trim(),
      phone: values.phone.trim() || undefined,
      email,
      password: values.password,
    };

    try {
      let result;
      if (isClient) {
        result = await authService.registerClient({
          ...person,
          companyName: values.companyName.trim(),
          taxCode: values.taxCode.trim(),
        });
      } else if (isAffiliate) {
        result = await authService.registerAffiliate(person);
      } else {
        result = await authService.registerCandidate(person);
      }

      if (!result.success && !result.data) {
        throw new Error(result.message || 'Đăng ký không thành công.');
      }

      message.success({
        content: 'Đăng ký thành công! Vui lòng kiểm tra email để nhập mã xác minh OTP.',
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
        duration: 5,
      });

      const returnTo = isClient || isAffiliate ? undefined : candidateReturnTo;
      navigate(
        appendCandidateReturnPath(
          `/verify-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`,
          returnTo
        ),
        {
          replace: true,
          state: { email, role, returnTo, message: result.message },
        }
      );
    } catch (error) {
      const errorData = (error as any)?.response?.data;
      if (errorData?.code === 'EMAIL_ALREADY_LINKED_AS_ALIAS' || errorData?.details?.CanSplit) {
        setSplitModal({
          visible: true,
          email: values.email.trim(),
          maskedPrimaryEmail: errorData?.details?.MaskedPrimaryEmail || '',
          otpSent: false,
          otp: '',
          loading: false,
          error: null,
        });
      }
      setFormError(getApiErrorMessage(error, 'Không thể hoàn tất đăng ký. Vui lòng kiểm tra lại thông tin!'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestSplitOtp = async () => {
    setSplitModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await authService.requestSplitOtp(splitModal.email);
      message.success(res.message || 'Mã xác thực đã được gửi về email của bạn!');
      setSplitModal(prev => ({ ...prev, loading: false, otpSent: true, error: null }));
    } catch (err: any) {
      setSplitModal(prev => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err, 'Không thể gửi mã OTP. Vui lòng thử lại sau!'),
      }));
    }
  };

  const handleConfirmSplitRegister = async () => {
    if (!splitModal.otp.trim()) {
      setSplitModal(prev => ({ ...prev, error: 'Vui lòng nhập mã OTP 6 chữ số.' }));
      return;
    }
    setSplitModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await authService.confirmSplitRegister({
        email: splitModal.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone,
        otp: splitModal.otp.trim(),
      });
      message.success({
        content: res.message || 'Tách tài khoản thành công! Bạn có thể đăng nhập ngay.',
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
        duration: 5,
      });
      setSplitModal(prev => ({ ...prev, visible: false }));
      navigate(`/login?email=${encodeURIComponent(splitModal.email)}&verified=true`, { replace: true });
    } catch (err: any) {
      setSplitModal(prev => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err, 'Mã OTP không chính xác hoặc đã hết hạn.'),
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-slate-800 antialiased">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold text-[#0C4A6E] no-underline transition-opacity hover:opacity-90"
          >
            <BrandMark size={32} tone="dark" className="drop-shadow-xs" />
            <span>HR Connect</span>
          </Link>
          <div className="text-sm text-slate-600">
            <span className="max-sm:hidden">Đã có tài khoản? </span>
            <Link
              to="/login"
              className="font-semibold text-sky-700 transition-colors hover:text-sky-900 focus-visible:outline-none focus-visible:underline"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tạo tài khoản HR Connect
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Chọn nhóm đối tượng phù hợp nhất với bạn để trải nghiệm hệ sinh thái tuyển dụng thông minh.
          </p>
        </div>

        {/* 3-Card Role Selector */}
        <fieldset className="mt-8 mb-2 grid min-w-0 grid-cols-1 gap-3.5 border-0 p-0 sm:grid-cols-3">
          <legend className="sr-only">Loại tài khoản</legend>
          {ROLES.map((option) => {
            const selected = role === option.role;
            return (
              <label
                key={option.role}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all select-none ${
                  selected
                    ? 'border-2 border-sky-600 bg-sky-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  checked={selected}
                  onChange={() => chooseRole(option.role)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-sky-700"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{option.title}</span>
                  <span className="mt-0.5 text-xs text-slate-500 leading-relaxed">{option.hint}</span>
                </div>
              </label>
            );
          })}
        </fieldset>

        {/* Role Notice Banner */}
        {isClient && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-900">
            🏢 <b>Tài khoản Doanh nghiệp:</b> Sau khi kích hoạt tài khoản bằng email OTP, hồ sơ công ty sẽ được xác thực qua Mã số thuế trước khi đăng tuyển chính thức.
          </div>
        )}
        {isAffiliate && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
            🤝 <b>Đối tác Affiliate (Cộng tác viên tuyển dụng):</b> Đăng ký trực tiếp tại form bên dưới. Sau khi xác minh email, hồ sơ của bạn sẽ được kích hoạt để tham gia giới thiệu ứng viên và nhận hoa hồng.
          </div>
        )}

        {/* Registration Form */}
        <form noValidate onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {isClient && (
              <>
                <TextField
                  id="reg-company"
                  label="Tên doanh nghiệp"
                  autoComplete="organization"
                  placeholder="Công ty Cổ phần Công nghệ..."
                  value={values.companyName}
                  error={errors.companyName}
                  disabled={submitting}
                  onChange={set('companyName')}
                />
                <TextField
                  id="reg-tax"
                  label="Mã số thuế"
                  maxLength={14}
                  placeholder="0123456789"
                  value={values.taxCode}
                  error={errors.taxCode}
                  hint="Gồm 10 hoặc 13 số theo Giấy phép ĐKKD"
                  disabled={submitting}
                  onChange={set('taxCode')}
                />
              </>
            )}

            <TextField
              id="reg-name"
              wide={!isClient}
              label={isClient ? 'Người đại diện' : 'Họ và tên'}
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={values.fullName}
              error={errors.fullName}
              disabled={submitting}
              onChange={set('fullName')}
            />

            {isClient ? (
              <TextField
                id="reg-phone"
                type="tel"
                label="Số điện thoại"
                autoComplete="tel"
                placeholder="0912 345 678"
                maxLength={20}
                value={values.phone}
                error={errors.phone}
                disabled={submitting}
                onChange={set('phone')}
              />
            ) : null}

            <TextField
              id="reg-email"
              type="email"
              wide={isClient}
              label={isClient ? 'Email doanh nghiệp' : 'Email'}
              autoComplete="email"
              placeholder="email@example.com"
              hint="Mã xác thực OTP sẽ được gửi về email này"
              value={values.email}
              error={errors.email}
              disabled={submitting}
              onChange={set('email')}
            />

            {!isClient ? (
              <TextField
                id="reg-phone"
                type="tel"
                label={isAffiliate ? 'Số điện thoại' : 'Số điện thoại (tùy chọn)'}
                autoComplete="tel"
                placeholder="0912 345 678"
                maxLength={20}
                value={values.phone}
                error={errors.phone}
                disabled={submitting}
                onChange={set('phone')}
              />
            ) : null}

            <TextField
              id="reg-password"
              type="password"
              revealable
              label="Mật khẩu"
              autoComplete="new-password"
              placeholder="••••••••"
              hint={PASSWORD_RULE}
              value={values.password}
              error={errors.password}
              disabled={submitting}
              onChange={set('password')}
            />

            <TextField
              id="reg-confirm"
              type="password"
              revealable
              label="Nhập lại mật khẩu"
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.confirmPassword}
              error={errors.confirmPassword}
              disabled={submitting}
              onChange={set('confirmPassword')}
            />

            {/* Terms and Policies */}
            <div className="sm:col-span-2 pt-2">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={terms}
                  aria-invalid={Boolean(errors.terms)}
                  onChange={(event) => {
                    setTerms(event.target.checked);
                    setErrors((current) => ({ ...current, terms: undefined }));
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-600 accent-sky-700 cursor-pointer"
                />
                <span>
                  Tôi đã đọc và đồng ý với{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">
                    Điều khoản dịch vụ
                  </a>{' '}
                  và{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">
                    Chính sách bảo mật
                  </a>{' '}
                  của HR Connect.
                </span>
              </label>
              {errors.terms && <p className="mt-1 text-xs font-medium text-rose-600">{errors.terms}</p>}
            </div>

            {/* Form Level Error Alert */}
            {formError && (
              <div role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-medium text-rose-700">
                <p className="leading-relaxed">{formError}</p>
                {(formError.includes('đăng nhập') || formError.includes('Đăng nhập')) && (
                  <div className="mt-2.5 pt-2.5 border-t border-rose-200/70 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-normal">Bạn đã có tài khoản liên kết?</span>
                    <Link
                      to={`/login?email=${encodeURIComponent(values.email.trim())}`}
                      className="font-semibold text-sky-700 hover:text-sky-800 underline underline-offset-2 flex items-center gap-1"
                    >
                      <span>Đăng nhập ngay</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="group relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#0C4A6E] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#075985] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Đang khởi tạo tài khoản…</span>
                  </span>
                ) : (
                  <>
                    <span>Tạo tài khoản</span>
                    <ArrowRightOutlined aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Back to Login Footer */}
        <div className="mt-8 text-center text-sm text-slate-600">
          Đã có tài khoản trên HR Connect?{' '}
          <Link
            to="/login"
            className="font-semibold text-sky-700 transition-colors hover:text-sky-900 focus-visible:outline-none focus-visible:underline"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </main>

      {/* Modal Tách tài khoản riêng bằng OTP */}
      <Modal
        open={splitModal.visible}
        onCancel={() => setSplitModal(prev => ({ ...prev, visible: false }))}
        footer={null}
        centered
        destroyOnClose
      >
        <div className="p-2 text-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <TeamOutlined className="text-2xl" />
          </div>

          <h3 className="mt-4 text-center text-lg font-bold text-slate-900">
            {splitModal.otpSent ? 'Xác thực để tách tài khoản' : 'Email đã được liên kết tài khoản'}
          </h3>

          {!splitModal.otpSent ? (
            <div className="mt-3 text-center text-sm text-slate-600 space-y-3">
              <p>
                Email <span className="font-semibold text-slate-800">{splitModal.email}</span> hiện đang là email phụ của tài khoản{' '}
                <span className="font-semibold text-sky-800">{splitModal.maskedPrimaryEmail || 'khác'}</span>.
              </p>
              <p className="text-xs text-slate-500">
                Bạn có thể đăng nhập ngay bằng email này với mật khẩu của bạn, hoặc tách ra để tạo tài khoản riêng độc lập.
              </p>

              <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 text-left border border-amber-200">
                <span className="font-semibold">Lưu ý về dữ liệu:</span> Khi tách thành tài khoản riêng, bạn sẽ bắt đầu với hồ sơ mới. Lịch sử ứng tuyển và CV trước đây thuộc về tài khoản cũ sẽ không được chuyển sang tài khoản mới nhằm đảm bảo tính bảo mật và toàn vẹn dữ liệu.
              </div>

              {splitModal.error && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                  {splitModal.error}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={splitModal.loading}
                  onClick={handleRequestSplitOtp}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0C4A6E] px-4 text-sm font-semibold text-white hover:bg-[#075985] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {splitModal.loading ? 'Đang gửi mã...' : 'Tách thành tài khoản riêng (Gửi OTP)'}
                </button>

                <Link
                  to={`/login?email=${encodeURIComponent(splitModal.email)}`}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Đăng nhập với email này
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600 space-y-3">
              <p className="text-center">
                Mã OTP 6 số đã được gửi tới <span className="font-semibold text-slate-800">{splitModal.email}</span>. Vui lòng kiểm tra hộp thư.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Mã OTP (6 chữ số)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Ví dụ: 123456"
                  value={splitModal.otp}
                  onChange={e => setSplitModal(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '') }))}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-center text-lg font-mono tracking-widest text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              {splitModal.error && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                  {splitModal.error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={splitModal.loading || splitModal.otp.length < 6}
                  onClick={handleConfirmSplitRegister}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0C4A6E] px-4 text-sm font-semibold text-white hover:bg-[#075985] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {splitModal.loading ? 'Đang xác thực...' : 'Xác nhận & Tạo tài khoản'}
                </button>

                <button
                  type="button"
                  disabled={splitModal.loading}
                  onClick={handleRequestSplitOtp}
                  className="text-xs text-sky-700 hover:text-sky-800 underline text-center cursor-pointer py-1"
                >
                  Gửi lại mã OTP
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
