/**
 * @file RegisterPage.tsx
 * @description Account creation (mockup 03/11, Register). Candidate and Client register here, then verify the
 * emailed code on /verify-otp; choosing Affiliate opens its own page, /register/affiliate.
 * A Client also gives company name and tax code (required by the API; the mockup draws only the Candidate form).
 */

import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { CheckCircleFilled, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { isValidVietnamPhoneNumber, VIETNAM_PHONE_VALIDATION_MESSAGE } from '@/constants/phoneValidation';
import { getApiErrorMessage } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { UserRole } from '@/types/roles';
import { appendCandidateReturnPath, getSafeCandidateReturnPath } from './authReturnPath';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const INPUT = `${FONT} box-border h-[46px] w-full rounded-md border border-solid bg-white px-3 text-[14px] text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULE = 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
const strongPassword = (value: string) => value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);
const borderOf = (error?: string) => (error ? 'border-[#DC2626]' : 'border-[#D1D5DB]');

type RegisterableRole = UserRole.CANDIDATE | UserRole.CLIENT | UserRole.AFFILIATE;
type Field = 'companyName' | 'taxCode' | 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms';
type Errors = Partial<Record<Field, string>>;

const ROLES: Array<{ role: RegisterableRole; title: string; hint: string }> = [
  { role: UserRole.CANDIDATE, title: 'Người tìm việc', hint: 'Tìm việc, ứng tuyển, tạo CV' },
  { role: UserRole.CLIENT, title: 'Nhà tuyển dụng', hint: 'Đăng tin, tuyển qua Affiliate, mua CV. Cần xác minh công ty.' },
  { role: UserRole.AFFILIATE, title: 'Affiliate', hint: 'Giới thiệu ứng viên, nhận hoa hồng. Cần được duyệt.' },
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
      <label htmlFor={id} className="font-medium">{label}</label>
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
          className={`${INPUT} ${revealable ? 'pr-11' : ''} ${borderOf(error)}`}
        />
        {revealable && (
          <button
            type="button"
            aria-label={`${shown ? 'Ẩn' : 'Hiện'} ${String(label).toLowerCase()}`}
            onClick={() => setShown((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[#6B7280] hover:text-[#1F2937]"
          >
            {shown ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          </button>
        )}
      </div>
      {error
        ? <span id={`${id}-error`} className="text-[12px] text-[#B91C1C]">{error}</span>
        : hint && <span id={`${id}-hint`} className="text-[12px] text-[#6B7280]">{hint}</span>}
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const candidateReturnTo = getSafeCandidateReturnPath(searchParams.get('returnTo'));
  const [role, setRole] = useState<RegisterableRole>(searchParams.get('role')?.toUpperCase() === 'CLIENT' ? UserRole.CLIENT : UserRole.CANDIDATE);
  const [values, setValues] = useState({ companyName: '', taxCode: '', fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isClient = role === UserRole.CLIENT;

  useEffect(() => {
    const requested = searchParams.get('role')?.toUpperCase();
    if (requested === 'AFFILIATE') navigate('/register/affiliate', { replace: true });
    else if (requested === 'CLIENT') setRole(UserRole.CLIENT);
    else if (requested === 'CANDIDATE') setRole(UserRole.CANDIDATE);
  }, [searchParams, navigate]);

  const chooseRole = (next: RegisterableRole) => {
    if (next === UserRole.AFFILIATE) {
      navigate('/register/affiliate');
      return;
    }
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
    if (values.fullName.trim().length < 2) found.fullName = 'Họ tên cần ít nhất 2 ký tự.';
    if (!EMAIL.test(values.email.trim())) found.email = 'Vui lòng nhập đúng địa chỉ email.';
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
    const person = { fullName: values.fullName.trim(), phone: values.phone.trim() || undefined, email, password: values.password };
    try {
      const result = isClient
        ? await authService.registerClient({ ...person, companyName: values.companyName.trim(), taxCode: values.taxCode.trim() })
        : await authService.registerCandidate(person);
      if (!result.success && !result.data) throw new Error(result.message || 'Đăng ký không thành công.');

      message.success({
        content: 'Đăng ký thành công! Vui lòng kiểm tra email để nhập mã xác minh.',
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
        duration: 5,
      });
      const returnTo = isClient ? undefined : candidateReturnTo;
      navigate(appendCandidateReturnPath(`/verify-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`, returnTo), {
        replace: true,
        state: { email, role, returnTo, message: result.message },
      });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Không thể hoàn tất đăng ký. Vui lòng kiểm tra lại thông tin!'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${FONT} min-h-screen bg-[#F7F8FA] text-[14px] text-[#1F2937] [line-height:normal]`}>
      <header className="bg-[#0C4A6E] text-white">
        <div className="mx-auto flex h-16 max-w-[1248px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap text-[18px] font-bold text-white no-underline hover:text-white hover:no-underline">
            <BrandMark size={32} tone="light" className="block" /> HR Connect
          </Link>
          <span className="ml-auto text-right text-[#CFE3F0]">
            <span className="max-sm:hidden">Đã có tài khoản? </span>
            <Link to="/login" className="font-semibold text-white no-underline hover:text-white hover:underline">Đăng nhập</Link>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[808px] px-4 pb-14 pt-8 sm:px-6">
        <h1 className="m-0 text-[24px] font-bold">Tạo tài khoản HR Connect</h1>
        <p className="m-0 mb-5 mt-1.5 text-[#4B5563]">Chọn loại tài khoản phù hợp với bạn.</p>

        <fieldset className="m-0 mb-5 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-3">
          <legend className="absolute left-[-9999px]">Loại tài khoản</legend>
          {ROLES.map((option) => {
            const selected = role === option.role;
            return (
              <label key={option.role} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-solid p-[14px] ${selected ? 'border-2 border-[#0369A1] bg-[#F0F9FF]' : 'border border-[#E5E7EB] bg-white'}`}>
                <input type="radio" name="role" checked={selected} onChange={() => chooseRole(option.role)} className="ml-[5px] mr-[3px] mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0369A1]" />
                <span><b>{option.title}</b><span className="block text-[13px] text-[#4B5563]">{option.hint}</span></span>
              </label>
            );
          })}
        </fieldset>

        <form noValidate onSubmit={submit} className="grid grid-cols-1 gap-4 rounded-lg border border-solid border-[#E5E7EB] bg-white p-5 sm:grid-cols-2 sm:p-6">
          {isClient && (
            <>
              <TextField id="reg-company" label="Tên doanh nghiệp" autoComplete="organization" value={values.companyName} error={errors.companyName} disabled={submitting} onChange={set('companyName')} />
              <TextField id="reg-tax" label="Mã số thuế" maxLength={14} value={values.taxCode} error={errors.taxCode} disabled={submitting} onChange={set('taxCode')} />
            </>
          )}
          <TextField id="reg-name" wide label={isClient ? 'Người đại diện' : 'Họ và tên'} autoComplete="name" value={values.fullName} error={errors.fullName} disabled={submitting} onChange={set('fullName')} />
          <TextField id="reg-email" type="email" label={isClient ? 'Email doanh nghiệp' : 'Email'} autoComplete="email" hint="Mã xác minh sẽ gửi đến email này" value={values.email} error={errors.email} disabled={submitting} onChange={set('email')} />
          <TextField
            id="reg-phone"
            type="tel"
            label={isClient ? 'Số điện thoại' : <>Số điện thoại <span className="font-normal text-[#6B7280]">(không bắt buộc)</span></>}
            autoComplete="tel"
            placeholder="0912 345 678"
            maxLength={20}
            value={values.phone}
            error={errors.phone}
            disabled={submitting}
            onChange={set('phone')}
          />
          <TextField id="reg-password" type="password" revealable label="Mật khẩu" autoComplete="new-password" hint={PASSWORD_RULE} value={values.password} error={errors.password} disabled={submitting} onChange={set('password')} />
          <TextField id="reg-confirm" type="password" revealable label="Nhập lại mật khẩu" autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} disabled={submitting} onChange={set('confirmPassword')} />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-2 text-[#374151]">
              <input
                type="checkbox"
                checked={terms}
                aria-invalid={Boolean(errors.terms)}
                onChange={(event) => { setTerms(event.target.checked); setErrors((current) => ({ ...current, terms: undefined })); }}
                className="mx-[3px] ml-1 mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0369A1]"
              />
              <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật của HR Connect.</span>
            </label>
            {errors.terms && <span className="text-[12px] text-[#B91C1C]">{errors.terms}</span>}
          </div>

          {formError && <p role="alert" className="m-0 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C] sm:col-span-2">{formError}</p>}

          <button type="submit" disabled={submitting} className={`${FONT} h-[46px] cursor-pointer rounded-md border-0 bg-[#0C4A6E] text-[15px] font-semibold text-white hover:bg-[#075985] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2`}>
            {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default RegisterPage;
