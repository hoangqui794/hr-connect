/**
 * @file ForgotPasswordPage.tsx
 * @description Password reset in two steps (mockup 03/11, Otp: card "Đặt lại mật khẩu"):
 * POST /auth/forgot-password sends a code, POST /auth/reset-password sets the new password.
 * The mockup draws only step 2; step 1 follows the same card.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { BrandMark } from '@/components/common/BrandMark';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { authService } from '@/services/authService';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'font-semibold text-[#0369A1] no-underline transition-colors duration-150 hover:text-[#075985] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] rounded';
const FIELD = 'flex flex-col gap-1.5';
const LABEL = 'text-[13px] font-semibold text-slate-700';
const INPUT = `${FONT} box-border h-11 w-full rounded-xl border border-solid bg-white px-3.5 text-base sm:text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none focus:border-[#0369A1] focus:ring-4 focus:ring-[#0369A1]/12`;
const BUTTON = `${FONT} h-11 w-full touch-manipulation cursor-pointer rounded-xl border-0 bg-[#0369A1] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(3,105,161,0.3)] transition-[background-color,transform] duration-150 motion-reduce:transition-none hover:bg-[#075985] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1] disabled:cursor-not-allowed disabled:opacity-60`;
const TEXT_BUTTON = `${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`;

/** The backend refuses a new code within this many seconds (ResendPasswordResetOtpCommandHandler). */
const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = (value: string) => value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);

const borderOf = (error?: string) => (error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/12' : 'border-[#CBD5E1] hover:border-slate-400');
const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? <span id={id} className="text-xs font-medium text-rose-700">{message}</span> : null;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type LoginState = { email?: string; from?: string; intent?: string } | null;
type Errors = { email?: string; otp?: string; newPassword?: string; confirmPassword?: string };

export const ForgotPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const loginState = location.state as LoginState;
  const [step, setStep] = useState<'EMAIL' | 'RESET'>('EMAIL');
  const [email, setEmail] = useState(loginState?.email ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const backToLogin = { pathname: '/login', search: location.search };
  const { email: _ignored, ...returnState } = loginState ?? {};

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setErrors({ email: 'Vui lòng nhập đúng địa chỉ email.' });
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      await authService.forgotPassword(address);
      setEmail(address);
      setCooldown(RESEND_SECONDS);
      setStep('RESET');
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Không gửi được mã xác minh lúc này. Vui lòng thử lại.'));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setFormError(null);
    setNotice(null);
    try {
      await authService.resendForgotPasswordOtp(email);
      setCooldown(RESEND_SECONDS);
      setNotice('Đã gửi lại mã mới. Mã cũ không còn dùng được.');
    } catch (error) {
      const failure = getApiError(error, 'Không gửi lại được mã xác minh.');
      if (failure.retryAfterSeconds) setCooldown(failure.retryAfterSeconds);
      setFormError(failure.message);
    }
  };

  const useOtherEmail = () => {
    setStep('EMAIL');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
    setFormError(null);
    setNotice(null);
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (!/^\d{6}$/.test(otp)) found.otp = 'Mã xác minh gồm đúng 6 chữ số.';
    if (!STRONG_PASSWORD(newPassword)) found.newPassword = 'Mật khẩu chưa đủ mạnh theo yêu cầu bên dưới.';
    if (confirmPassword !== newPassword) found.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setFormError(null);
    setNotice(null);
    setPending(true);
    try {
      await authService.resetPassword({ email, otp, newPassword, confirmPassword });
      navigate(backToLogin, { replace: true, state: { ...returnState, email, passwordReset: true } });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Không đặt lại được mật khẩu. Vui lòng kiểm tra lại mã xác minh.'));
    } finally {
      setPending(false);
    }
  };

  const clearError = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: undefined }));
  const alert = formError && <p role="alert" className="m-0 rounded-xl border border-solid border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">{formError}</p>;
  const backLink = <Link to={backToLogin} state={loginState} className={`text-center text-[13px] ${LINK}`}>Quay lại đăng nhập</Link>;

  return (
    <div className={`${FONT} min-h-screen bg-[#F4F7FA] text-sm text-slate-900 antialiased [line-height:normal]`}>
      <header className="bg-[#08253C] text-white">
        <div className="mx-auto flex h-16 max-w-[1248px] items-center px-6">
          <Link to="/" className="flex items-center gap-2.5 text-[18px] font-bold text-white no-underline transition-opacity hover:opacity-90">
            <BrandMark size={32} tone="light" className="block" /> HR Connect
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1048px] justify-center px-4 py-12 sm:px-6">
        <section aria-labelledby="forgot" className="w-full max-w-[488px] rounded-2xl border border-solid border-[#DCE3EC] bg-white p-6 shadow-[0_1px_2px_rgba(8,37,60,0.05),0_16px_36px_-12px_rgba(8,37,60,0.09)] sm:p-8">
          <p className="mb-1 text-xs font-semibold text-[#0369A1]">Khôi phục truy cập</p>
          <h1 id="forgot" className="m-0 text-[22px] font-extrabold tracking-tight text-slate-900">Đặt lại mật khẩu</h1>

          {step === 'EMAIL' ? (
            <>
              <p className="m-0 mb-[18px] mt-1.5 text-[#4B5563]">Bước 1/2: nhập email tài khoản để nhận mã xác minh.</p>
              <form noValidate onSubmit={requestCode} className="flex flex-col gap-[14px]">
                <div className={FIELD}>
                  <label htmlFor="forgot-email" className={LABEL}>Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                    onChange={(event) => { setEmail(event.target.value); clearError('email'); }}
                    className={`${INPUT} ${borderOf(errors.email)}`}
                  />
                  <FieldError id="forgot-email-error" message={errors.email} />
                </div>
                {alert}
                <button type="submit" disabled={pending} className={BUTTON}>{pending ? 'Đang gửi…' : 'Gửi mã xác minh'}</button>
                {backLink}
              </form>
            </>
          ) : (
            <>
              <p className="m-0 mb-[18px] mt-1.5 break-words text-[#4B5563]">Bước 2/2: nhập mã nhận qua email <b>{email}</b> và mật khẩu mới.</p>
              <form noValidate onSubmit={resetPassword} className="flex flex-col gap-[14px]">
                <div className={FIELD}>
                  <label htmlFor="forgot-otp" className={LABEL}>Mã xác minh</label>
                  <input
                    id="forgot-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    aria-invalid={Boolean(errors.otp)}
                    aria-describedby={errors.otp ? 'forgot-otp-error' : undefined}
                    onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '')); clearError('otp'); }}
                    className={`${INPUT} tracking-[4px] ${borderOf(errors.otp)}`}
                  />
                  <FieldError id="forgot-otp-error" message={errors.otp} />
                </div>
                <div className={FIELD}>
                  <label htmlFor="forgot-password" className={LABEL}>Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      id="forgot-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      aria-invalid={Boolean(errors.newPassword)}
                      aria-describedby={errors.newPassword ? 'forgot-password-error forgot-password-rule' : 'forgot-password-rule'}
                      onChange={(event) => { setNewPassword(event.target.value); clearError('newPassword'); }}
                      className={`${INPUT} pr-11 ${borderOf(errors.newPassword)}`}
                    />
                    <button
                      type="button"
                      aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onClick={() => setShowNewPassword((shown) => !shown)}
                      className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[#9CA3AF] transition-colors hover:text-[#4B5563] focus:outline-none shadow-none"
                    >
                      <span aria-hidden="true" className="flex items-center justify-center">
                        {showNewPassword ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
                      </span>
                    </button>
                  </div>
                  <FieldError id="forgot-password-error" message={errors.newPassword} />
                  <span id="forgot-password-rule" className="text-[12px] text-[#6B7280]">Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.</span>
                </div>
                <div className={FIELD}>
                  <label htmlFor="forgot-confirm" className={LABEL}>Nhập lại mật khẩu mới</label>
                  <div className="relative">
                    <input
                      id="forgot-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={errors.confirmPassword ? 'forgot-confirm-error' : undefined}
                      onChange={(event) => { setConfirmPassword(event.target.value); clearError('confirmPassword'); }}
                      className={`${INPUT} pr-11 ${borderOf(errors.confirmPassword)}`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'}
                      onClick={() => setShowConfirmPassword((shown) => !shown)}
                      className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[#9CA3AF] transition-colors hover:text-[#4B5563] focus:outline-none shadow-none"
                    >
                      <span aria-hidden="true" className="flex items-center justify-center">
                        {showConfirmPassword ? <EyeOutlined className="text-base" /> : <EyeInvisibleOutlined className="text-base" />}
                      </span>
                    </button>
                  </div>
                  <FieldError id="forgot-confirm-error" message={errors.confirmPassword} />
                </div>
                {alert}
                {notice && <p role="status" className="m-0 text-[13px] text-[#166534]">{notice}</p>}
                <button type="submit" disabled={pending} className={BUTTON}>{pending ? 'Đang lưu…' : 'Đặt lại mật khẩu'}</button>
                <p className="m-0 text-[13px] text-[#4B5563]">
                  Chưa nhận được mã? Kiểm tra thư rác hoặc{' '}
                  {cooldown > 0
                    ? <span className="text-[#6B7280]">gửi lại sau {clock(cooldown)}</span>
                    : <button type="button" onClick={resend} className={TEXT_BUTTON}>gửi lại mã</button>}
                  {' '}· <button type="button" onClick={useOtherEmail} className={TEXT_BUTTON}>dùng email khác</button>
                </p>
                {backLink}
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
