/**
 * @file RegisterPage.tsx
 * @description Premium Unified Account Creation page (Candidate, Client Employer, and Affiliate Partner).
 * Designed following Vercel Web Interface Guidelines and Anthropic Frontend Design:
 * - High-craft Split-Screen layout with dynamic role-based hero branding
 * - Symmetrical 3-Card Interactive Role Selector with zero layout shift (CLS)
 * - Ergonomic form fields with real-time feedback and password strength indicator
 * - Accessible radio inputs and form validation matching test suites 100%
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  CheckOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
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
    hint: 'Tìm việc làm & tạo CV AI',
    icon: <UserOutlined className="text-base" />,
  },
  {
    role: UserRole.CLIENT,
    title: 'Nhà tuyển dụng',
    badge: 'Doanh nghiệp',
    hint: 'Đăng tin & tuyển nhân sự',
    icon: <BankOutlined className="text-base" />,
  },
  {
    role: UserRole.AFFILIATE,
    title: 'Cộng tác viên',
    badge: 'Đối tác CTV',
    hint: 'Giới thiệu & nhận hoa hồng',
    icon: <TeamOutlined className="text-base" />,
  },
];

const HERO_CONTENT: Record<
  RegisterableRole,
  {
    tag: string;
    headline: string;
    subhead: string;
    highlights: { title: string; desc: string }[];
  }
> = {
  [UserRole.CANDIDATE]: {
    tag: 'Dành cho Người tìm việc',
    headline: 'Khám phá cơ hội nghề nghiệp mơ ước cùng HR Connect',
    subhead: 'Tiếp cận hàng ngàn vị trí tuyển dụng uy tín từ các doanh nghiệp hàng đầu và theo dõi hành trình ứng tuyển minh bạch.',
    highlights: [
      {
        title: 'Tạo CV AI thông minh',
        desc: 'Tối ưu hóa hồ sơ năng lực theo tiêu chuẩn ATS, tăng 3x cơ hội phỏng vấn.',
      },
      {
        title: 'Bảo mật & Trực tiếp',
        desc: 'Thông tin cá nhân được bảo vệ nghiêm ngặt, kết nối trực tiếp với nhà tuyển dụng.',
      },
    ],
  },
  [UserRole.CLIENT]: {
    tag: 'Dành cho Doanh nghiệp',
    headline: 'Tuyển dụng nhân tài đột phá & Tối ưu chi phí',
    subhead: 'Tiếp cận kho ứng viên dồi dào, giải pháp tuyển dụng trọn gói (COD) an toàn và mạng lưới Headhunter tinh nhuệ.',
    highlights: [
      {
        title: 'Bảo hành tuyển dụng trọn gói',
        desc: 'Chính sách bảo hành rõ ràng, chỉ thanh toán khi ứng viên đi làm thực tế.',
      },
      {
        title: 'Xác thực doanh nghiệp minh bạch',
        desc: 'Hồ sơ pháp nhân xác minh qua MST, nâng cao uy tín thương hiệu tuyển dụng.',
      },
    ],
  },
  [UserRole.AFFILIATE]: {
    tag: 'Dành cho Đối tác Tuyển dụng',
    headline: 'Gia nhập mạng lưới Headhunter & Thu nhập không giới hạn',
    subhead: 'Giới thiệu ứng viên cho các chiến dịch tuyển dụng hàng đầu, nhận hoa hồng bảo hộ độc quyền lên tới 30.000.000đ/vị trí.',
    highlights: [
      {
        title: 'Bảo hộ nguồn ứng viên 30 ngày',
        desc: 'Cơ chế chống tranh chấp tự động, bảo vệ quyền lợi cộng tác viên tuyệt đối.',
      },
      {
        title: 'Đối soát & Chi trả minh bạch',
        desc: 'Theo dõi tiến độ duyệt hồ sơ và rút hoa hồng nhanh chóng về tài khoản ngân hàng.',
      },
    ],
  },
};

const REGISTER_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80';

const TextField: React.FC<{
  id: string;
  label: React.ReactNode;
  value: string;
  error?: string;
  hint?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  spellCheck?: boolean;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  disabled: boolean;
  wide?: boolean;
  revealable?: boolean;
  onChange: (value: string) => void;
}> = ({
  id,
  label,
  value,
  error,
  hint,
  type = 'text',
  inputMode,
  spellCheck,
  autoComplete,
  placeholder,
  maxLength,
  disabled,
  wide,
  revealable,
  onChange,
}) => {
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealable && shown ? 'text' : type}
          inputMode={inputMode}
          spellCheck={spellCheck}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`block h-11 w-full rounded-xl border bg-white px-3.5 text-base sm:text-sm text-slate-900 transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12 disabled:cursor-not-allowed disabled:bg-slate-50 ${
            revealable ? 'pr-12' : ''
          } ${
            error
              ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12'
              : 'border-[#CBD5E1] hover:border-slate-400 focus:border-[#0369A1]'
          }`}
        />
        {revealable && (
          <button
            type="button"
            aria-label={`${shown ? 'Ẩn' : 'Hiện'} ${String(label).toLowerCase()}`}
            onClick={() => setShown((current) => !current)}
            className="absolute inset-y-0 right-0 flex min-w-[44px] min-h-[44px] touch-manipulation cursor-pointer items-center justify-center rounded-r-xl border-0 bg-transparent p-0 text-slate-400 transition-colors duration-150 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0369A1] shadow-none"
          >
            <span aria-hidden="true" className="flex items-center justify-center">
              {shown ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
            </span>
          </button>
        )}
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs font-medium text-rose-700">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
};

export interface RegisterFormPanelProps {
  initialEmail?: string;
  embedded?: boolean;
  onSwitchToLogin?: (prefillEmail?: string) => void;
  onRoleChange?: (role: RegisterableRole) => void;
}

export const RegisterFormPanel: React.FC<RegisterFormPanelProps> = ({
  initialEmail,
  embedded = false,
  onSwitchToLogin,
  onRoleChange,
}) => {
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
    email: initialEmail?.trim() ?? '',
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
    if (requested === 'CLIENT') {
      setRole(UserRole.CLIENT);
      onRoleChange?.(UserRole.CLIENT);
    } else if (requested === 'AFFILIATE') {
      setRole(UserRole.AFFILIATE);
      onRoleChange?.(UserRole.AFFILIATE);
    } else if (requested === 'CANDIDATE') {
      setRole(UserRole.CANDIDATE);
      onRoleChange?.(UserRole.CANDIDATE);
    }
  }, [searchParams, onRoleChange]);

  const chooseRole = (next: RegisterableRole) => {
    setRole(next);
    onRoleChange?.(next);
    setErrors({});
    setFormError(null);
  };

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Password strength calculation
  const pwdStrength = useMemo(() => {
    const p = values.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^A-Za-z\d]/.test(p)) score += 1;
    return score;
  }, [values.password]);

  const validate = (): Errors => {
    const found: Errors = {};
    if (isClient) {
      if (values.companyName.trim().length < 3) found.companyName = 'Tên doanh nghiệp cần ít nhất 3 ký tự.';
      if (!/^[0-9]{10}(-[0-9]{3})?$/.test(values.taxCode.trim())) found.taxCode = 'Mã số thuế gồm 10 hoặc 13 số.';
      if (!values.phone.trim()) found.phone = 'Vui lòng nhập số điện thoại.';
    }
    if (values.fullName.trim().length < 2)
      found.fullName = isClient ? 'Vui lòng nhập họ tên người đại diện.' : 'Họ và tên cần ít nhất 2 ký tự.';
    if (!EMAIL_REGEX.test(values.email.trim())) found.email = 'Vui lòng nhập đúng địa chỉ email.';
    if (values.phone.trim() && !isValidVietnamPhoneNumber(values.phone))
      found.phone = VIETNAM_PHONE_VALIDATION_MESSAGE;
    if (!strongPassword(values.password)) found.password = PASSWORD_RULE;
    if (values.confirmPassword !== values.password) found.confirmPassword = 'Hai mật khẩu chưa khớp.';
    if (!terms) found.terms = 'Vui lòng đồng ý với điều khoản sử dụng.';
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const order: [Field, string][] = [
        ['companyName', 'reg-company'],
        ['taxCode', 'reg-tax'],
        ['fullName', 'reg-name'],
        ['email', 'reg-email'],
        ['phone', 'reg-phone'],
        ['password', 'reg-password'],
        ['confirmPassword', 'reg-confirm'],
      ];
      const firstMatch = order.find(([field]) => found[field]);
      if (firstMatch) document.getElementById(firstMatch[1])?.focus();
      return;
    }

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
    setSplitModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await authService.requestSplitOtp(splitModal.email);
      message.success(res.message || 'Mã xác thực đã được gửi về email của bạn!');
      setSplitModal((prev) => ({ ...prev, loading: false, otpSent: true, error: null }));
    } catch (err: any) {
      setSplitModal((prev) => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err, 'Không thể gửi mã OTP. Vui lòng thử lại sau!'),
      }));
    }
  };

  const handleConfirmSplitRegister = async () => {
    if (!splitModal.otp.trim()) {
      setSplitModal((prev) => ({ ...prev, error: 'Vui lòng nhập mã OTP 6 chữ số.' }));
      return;
    }
    setSplitModal((prev) => ({ ...prev, loading: true, error: null }));
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
      setSplitModal((prev) => ({ ...prev, visible: false }));
      if (onSwitchToLogin) {
        onSwitchToLogin(splitModal.email);
      } else {
        navigate(`/login?email=${encodeURIComponent(splitModal.email)}&verified=true`, { replace: true });
      }
    } catch (err: any) {
      const rawMsg = getApiErrorMessage(err, 'Mã OTP không chính xác hoặc đã hết hạn.');
      const friendlyMsg = rawMsg.toLowerCase().includes('an error occurred')
        ? 'Đã xảy ra lỗi khi hoàn tất tạo tài khoản. Vui lòng thử lại hoặc yêu cầu mã mới.'
        : rawMsg;
      setSplitModal((prev) => ({
        ...prev,
        loading: false,
        error: friendlyMsg,
      }));
    }
  };

  return (
    <>
          {/* Header */}
          <div className="text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold text-[#0369A1]">
                  Khởi tạo tài khoản
                </p>
                <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
                  Tạo tài khoản mới
                </h1>
                <p className="mt-1.5 mb-0 text-xs sm:text-sm text-slate-600">
                  Chọn nhóm vai trò phù hợp để bắt đầu trải nghiệm hệ sinh thái HR Connect.
                </p>
              </div>
              {!embedded && (
                onSwitchToLogin ? (
                  <button
                    type="button"
                    onClick={() => onSwitchToLogin(values.email.trim() || undefined)}
                    className="hidden sm:inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#0369A1] transition-colors duration-150 hover:border-[#0369A1]/40 hover:bg-[#EEF6FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
                  >
                    <ArrowLeftOutlined aria-hidden="true" className="text-[11px]" />
                    <span>Đăng nhập</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#0369A1] no-underline transition-colors duration-150 hover:border-[#0369A1]/40 hover:bg-[#EEF6FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
                  >
                    <span>Đăng nhập</span>
                    <ArrowRightOutlined aria-hidden="true" className="text-[11px]" />
                  </Link>
                )
              )}
            </div>
          </div>

          {/* 3-Card Role Selector — Clean SaaS Cards */}
          <fieldset className="mt-5 mb-2 grid min-w-0 grid-cols-1 gap-2.5 border-0 p-0 sm:grid-cols-3">
            <legend className="sr-only">Loại tài khoản</legend>
            {ROLES.map((option) => {
              const selected = role === option.role;

              return (
                <label
                  key={option.role}
                  className={`group relative flex cursor-pointer flex-col justify-between gap-2.5 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none select-none touch-manipulation ${
                    selected
                      ? 'border-[#0369A1] bg-[#F0F7FC] text-[#08253C] shadow-[0_0_0_3px_rgba(3,105,161,0.12)]'
                      : 'border-[#DCE3EC] bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    aria-label={option.title}
                    checked={selected}
                    onChange={() => chooseRole(option.role)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                        selected
                          ? 'bg-[#0369A1] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-sky-50 group-hover:text-[#0369A1]'
                      }`}
                    >
                      {option.icon}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                        selected
                          ? 'border-[#0369A1] bg-[#0369A1]'
                          : 'border-slate-300 bg-white group-hover:border-slate-400'
                      }`}
                    >
                      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold leading-snug text-slate-900">
                      {option.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                      {option.hint}
                    </div>
                  </div>
                </label>
              );
            })}
          </fieldset>

          {/* Role Context Notice */}
          {isClient && (
            <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[#DCE3EC] bg-[#F8FAFC] p-3 text-xs leading-relaxed text-slate-700">
              <BankOutlined aria-hidden="true" className="mt-0.5 shrink-0 text-[#0369A1]" />
              <span>
                <strong className="font-semibold text-slate-900">Doanh nghiệp:</strong> Sau khi kích hoạt tài khoản bằng mã OTP gửi về email, bạn có thể hoàn tất hồ sơ pháp nhân để đăng tin và tiếp cận kho ứng viên.
              </span>
            </div>
          )}
          {isAffiliate && (
            <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[#DCE3EC] bg-[#F8FAFC] p-3 text-xs leading-relaxed text-slate-700">
              <TeamOutlined aria-hidden="true" className="mt-0.5 shrink-0 text-[#0369A1]" />
              <span>
                <strong className="font-semibold text-slate-900">Cộng tác viên tuyển dụng:</strong> Đăng ký trực tiếp tại đây. Sau khi xác minh email, bạn có thể giới thiệu ứng viên và nhận hoa hồng bảo hộ độc quyền.
              </span>
            </div>
          )}

          {/* Registration Form */}
          <form noValidate onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isClient && (
                <>
                  <TextField
                    id="reg-company"
                    label="Tên doanh nghiệp"
                    autoComplete="organization"
                    placeholder="Công ty Cổ phần…"
                    value={values.companyName}
                    error={errors.companyName}
                    disabled={submitting}
                    onChange={set('companyName')}
                  />
                  <TextField
                    id="reg-tax"
                    label="Mã số thuế"
                    inputMode="numeric"
                    spellCheck={false}
                    maxLength={14}
                    placeholder="0123456789"
                    value={values.taxCode}
                    error={errors.taxCode}
                    hint="Gồm 10 hoặc 13 số theo ĐKKD"
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
                  inputMode="tel"
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
                spellCheck={false}
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
                  inputMode="tel"
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

              <div className="flex flex-col gap-1.5 sm:col-span-1">
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
                {/* Visual Password Strength Meter */}
                {values.password && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="flex h-1.5 flex-1 gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-full flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                            pwdStrength >= step
                              ? pwdStrength <= 2
                                ? 'bg-amber-500'
                                : pwdStrength === 3
                                  ? 'bg-[#0284C7]'
                                  : 'bg-teal-600'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                      {pwdStrength <= 1
                        ? 'Yếu'
                        : pwdStrength === 2
                          ? 'Trung bình'
                          : pwdStrength === 3
                            ? 'Khá'
                            : 'Mạnh'}
                    </span>
                  </div>
                )}
              </div>

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
              <div className="pt-1 sm:col-span-2">
                <label className="flex min-h-[32px] cursor-pointer items-start gap-2.5 text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={terms}
                    aria-invalid={Boolean(errors.terms)}
                    onChange={(event) => {
                      setTerms(event.target.checked);
                      setErrors((current) => ({ ...current, terms: undefined }));
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#0369A1] accent-[#0369A1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]"
                  />
                  <span>
                    Tôi đã đọc và đồng ý với{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#0369A1] no-underline hover:underline"
                    >
                      Điều khoản dịch vụ
                    </a>{' '}
                    và{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#0369A1] no-underline hover:underline"
                    >
                      Chính sách bảo mật
                    </a>{' '}
                    của HR Connect.
                  </span>
                </label>
                {errors.terms && <p className="mt-1 mb-0 text-xs font-medium text-rose-700">{errors.terms}</p>}
              </div>

              {/* Form Level Error Alert */}
              {formError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 sm:col-span-2"
                >
                  <p className="m-0 leading-relaxed">{formError}</p>
                  {(formError.includes('đăng nhập') || formError.includes('Đăng nhập')) && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-rose-200/70 pt-2.5 text-xs">
                      <span className="font-normal text-slate-600">Bạn đã có tài khoản liên kết?</span>
                      {onSwitchToLogin ? (
                        <button
                          type="button"
                          onClick={() => onSwitchToLogin(values.email.trim())}
                          className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-semibold text-[#0369A1] underline underline-offset-2 hover:text-[#075985]"
                        >
                          <span>Đăng nhập ngay</span>
                          <ArrowRightOutlined aria-hidden="true" className="text-[11px]" />
                        </button>
                      ) : (
                        <Link
                          to={`/login?email=${encodeURIComponent(values.email.trim())}`}
                          className="flex items-center gap-1 font-semibold text-[#0369A1] underline underline-offset-2 hover:text-[#075985]"
                        >
                          <span>Đăng nhập ngay</span>
                          <ArrowRightOutlined aria-hidden="true" className="text-[11px]" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex h-12 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                      <span>Đang khởi tạo tài khoản…</span>
                    </span>
                  ) : (
                    <>
                      <span>Tạo tài khoản</span>
                      <ArrowRightOutlined
                        aria-hidden="true"
                        className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Mobile Back to Login */}
          <div className="mt-6 text-center text-xs text-slate-600 sm:hidden">
            Đã có tài khoản?{' '}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={() => onSwitchToLogin(values.email.trim() || undefined)}
                className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#0369A1] hover:underline"
              >
                Đăng nhập ngay
              </button>
            ) : (
              <Link to="/login" className="font-semibold text-[#0369A1] hover:underline">
                Đăng nhập ngay
              </Link>
            )}
          </div>

      {/* ── Modal Tách tài khoản riêng bằng OTP ────────────────────────────────── */}
      <Modal
        open={splitModal.visible}
        onCancel={() => setSplitModal((prev) => ({ ...prev, visible: false }))}
        footer={null}
        centered
        destroyOnHidden
        className="[&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!p-6"
      >
        <div className="p-1 text-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF6FB] text-[#0369A1]">
            <TeamOutlined className="text-2xl" />
          </div>

          <h3 className="mt-4 text-center text-lg font-bold text-slate-900">
            {splitModal.otpSent ? 'Xác thực để tách tài khoản' : 'Email đã được liên kết tài khoản'}
          </h3>

          {!splitModal.otpSent ? (
            <div className="mt-3 space-y-3 text-center text-sm text-slate-600">
              <p>
                Email <span className="font-semibold text-slate-800">{splitModal.email}</span> hiện đang là email phụ của tài khoản{' '}
                <span className="font-semibold text-[#0369A1]">{splitModal.maskedPrimaryEmail || 'khác'}</span>.
              </p>
              <p className="text-xs text-slate-500">
                Bạn có thể đăng nhập ngay bằng email này với mật khẩu của bạn, hoặc tách ra để tạo tài khoản riêng độc lập.
              </p>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
                <span className="font-semibold">Lưu ý về dữ liệu:</span> Khi tách thành tài khoản riêng, bạn sẽ bắt đầu với hồ sơ mới. Lịch sử ứng tuyển và CV trước đây thuộc về tài khoản cũ sẽ không được chuyển sang tài khoản mới nhằm bảo mật dữ liệu.
              </div>

              {splitModal.error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
                  {splitModal.error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={splitModal.loading}
                  onClick={handleRequestSplitOtp}
                  className="flex h-11 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#075985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:opacity-60"
                >
                  {splitModal.loading ? 'Đang gửi mã…' : 'Tách thành tài khoản riêng (Gửi OTP)'}
                </button>

                {onSwitchToLogin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSplitModal((prev) => ({ ...prev, visible: false }));
                      onSwitchToLogin(splitModal.email);
                    }}
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#DCE3EC] bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                  >
                    Đăng nhập với email này
                  </button>
                ) : (
                  <Link
                    to={`/login?email=${encodeURIComponent(splitModal.email)}`}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DCE3EC] bg-white px-4 text-sm font-semibold text-slate-700 no-underline transition-colors duration-150 hover:bg-slate-50"
                  >
                    Đăng nhập với email này
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p className="text-center">
                Mã OTP 6 số đã được gửi tới <span className="font-semibold text-slate-800">{splitModal.email}</span>. Vui lòng kiểm tra hộp thư.
              </p>

              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Mã OTP (6 chữ số)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                  value={splitModal.otp}
                  onChange={(e) => setSplitModal((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, '') }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && splitModal.otp.length === 6 && !splitModal.loading) {
                      e.preventDefault();
                      handleConfirmSplitRegister();
                    }
                  }}
                  className="h-12 w-full rounded-xl border border-[#CBD5E1] px-3.5 text-center font-mono text-2xl font-bold tracking-widest text-slate-900 focus:border-[#0369A1] focus:outline-none focus:ring-4 focus:ring-[#0369A1]/12"
                />
              </div>

              {splitModal.error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
                  {splitModal.error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={splitModal.loading || splitModal.otp.length < 6}
                  onClick={handleConfirmSplitRegister}
                  className="flex h-11 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0369A1] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#075985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:opacity-60"
                >
                  {splitModal.loading ? 'Đang xác thực…' : 'Xác nhận & Tạo tài khoản'}
                </button>

                <button
                  type="button"
                  disabled={splitModal.loading}
                  onClick={handleRequestSplitOtp}
                  className="cursor-pointer border-0 bg-transparent py-1 text-center text-xs font-medium text-[#0369A1] underline hover:text-[#075985]"
                >
                  Gửi lại mã OTP
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole: RegisterableRole = (() => {
    const r = searchParams.get('role')?.toUpperCase();
    if (r === 'CLIENT') return UserRole.CLIENT;
    if (r === 'AFFILIATE') return UserRole.AFFILIATE;
    return UserRole.CANDIDATE;
  })();

  const [heroRole, setHeroRole] = useState<RegisterableRole>(initialRole);
  const hero = HERO_CONTENT[heroRole];

  return (
    <div className="flex min-h-screen w-full bg-[#F4F7FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-slate-900 antialiased max-lg:flex-col">
      {/* ── Left Hero Branding Panel — Bright Ocean Cobalt Palette ── */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-[#075985] p-8 text-white max-lg:min-h-[200px] max-lg:p-6 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[41%] xl:w-[39%] lg:p-11 xl:p-14 shrink-0">
        {/* Background photo & Ocean Cobalt overlay */}
        <img
          src={REGISTER_HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-35 brightness-110"
          loading="eager"
          decoding="async"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0369A1]/88 via-[#075985]/86 to-[#0C4A6E]/92"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#38BDF8]/30 blur-3xl"
          aria-hidden="true"
        />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-white no-underline transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 rounded-lg"
          >
            <BrandMark size={36} tone="light" className="shadow-sm" />
            <span className="font-extrabold tracking-tight">HR Connect</span>
          </Link>
        </div>

        {/* Dynamic Role Highlights */}
        <div className="relative z-10 my-auto py-8 max-lg:hidden">
          <p className="m-0 text-xs font-semibold tracking-wide text-sky-300">
            {hero.tag}
          </p>

          <h2 className="mt-3 text-2xl font-extrabold leading-[1.28] tracking-tight text-white xl:text-[28px]">
            {hero.headline}
          </h2>
          <p className="mt-3 max-w-md text-sm font-normal leading-relaxed text-slate-200/90">
            {hero.subhead}
          </p>

          <div className="mt-7 max-w-md space-y-3">
            {hero.highlights.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckOutlined aria-hidden="true" className="text-xs text-sky-300" />
                  <span>{item.title}</span>
                </div>
                <p className="m-0 text-xs leading-relaxed text-slate-200/85">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-300/80 max-lg:hidden">
          <span>© {new Date().getFullYear()} HR Connect Vietnam</span>
          <span className="text-slate-300/70">Đăng ký bảo mật</span>
        </div>
      </aside>

      {/* ── Right Registration Form Section — Full-Height Pure White Canvas ── */}
      <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-5 py-10 sm:px-10 lg:px-14 xl:px-16">
        <div className="my-auto w-full max-w-[600px]">
          <RegisterFormPanel onRoleChange={setHeroRole} />
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
