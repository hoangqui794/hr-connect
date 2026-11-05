import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@/services/authService';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const LoginProbe = () => {
  const { search, state } = useLocation();
  return <div data-testid="login">{JSON.stringify({ search, state })}</div>;
};

const renderPage = (entry: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/forgot-password']) =>
  render(
    <MemoryRouter initialEntries={entry}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );

const apiError = (status: number, data: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new AxiosError('Failed', String(status), undefined, undefined, {
    status,
    statusText: 'Failed',
    headers,
    config: { headers: new AxiosHeaders() },
    data: { success: false, ...data },
  });

const toResetStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'an@example.com');
  await user.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }));
  await screen.findByText(/Bước 2\/2/);
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue({ success: true, message: 'ok' });
  });

  it('asks for a valid email before sending a code', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'sai-email');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }));

    expect(screen.getByText('Vui lòng nhập đúng địa chỉ email.')).toBeInTheDocument();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('starts from the email typed on the login page', () => {
    renderPage([{ pathname: '/forgot-password', state: { email: 'an@example.com' } }]);

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('an@example.com');
  });

  it('shows why the code could not be sent and stays on step 1', async () => {
    vi.mocked(authService.forgotPassword).mockRejectedValue(apiError(429, { message: 'Bạn gửi quá nhiều lần.' }));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'an@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn gửi quá nhiều lần.');
    expect(screen.getByText(/Bước 1\/2/)).toBeInTheDocument();
  });

  it('refuses a weak password, a short code and a mismatch before calling the API', async () => {
    const reset = vi.spyOn(authService, 'resetPassword');
    const user = userEvent.setup();
    renderPage();
    await toResetStep(user);

    await user.type(screen.getByRole('textbox', { name: 'Mã xác minh' }), '12a3');
    expect(screen.getByRole('textbox', { name: 'Mã xác minh' })).toHaveValue('123');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'abcdef');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'khac');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(screen.getByText('Mã xác minh gồm đúng 6 chữ số.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu chưa đủ mạnh theo yêu cầu bên dưới.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu nhập lại chưa khớp.')).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it('resets the password and returns to login with the email and where the user was going', async () => {
    const reset = vi.spyOn(authService, 'resetPassword').mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    renderPage([{ pathname: '/forgot-password', search: '?returnTo=%2Fcandidate', state: { from: '/candidate/cvs' } }]);
    await toResetStep(user);

    await user.type(screen.getByRole('textbox', { name: 'Mã xác minh' }), '913582');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Matkhau@123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'Matkhau@123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    await waitFor(() => expect(reset).toHaveBeenCalledWith({ email: 'an@example.com', otp: '913582', newPassword: 'Matkhau@123', confirmPassword: 'Matkhau@123' }));
    const login = JSON.parse((await screen.findByTestId('login')).textContent!);
    expect(login.search).toBe('?returnTo=%2Fcandidate');
    expect(login.state).toEqual({ from: '/candidate/cvs', email: 'an@example.com', passwordReset: true });
  });

  it('keeps the form and shows the error when the code is wrong', async () => {
    vi.spyOn(authService, 'resetPassword').mockRejectedValue(apiError(400, { message: 'Mã xác thực không đúng.' }));
    const user = userEvent.setup();
    renderPage();
    await toResetStep(user);

    await user.type(screen.getByRole('textbox', { name: 'Mã xác minh' }), '913582');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Matkhau@123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'Matkhau@123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mã xác thực không đúng.');
    expect(screen.getByRole('button', { name: 'Đặt lại mật khẩu' })).toBeEnabled();
  });

  it('waits out the cooldown before offering to resend', async () => {
    const resend = vi.spyOn(authService, 'resendForgotPasswordOtp').mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    renderPage();
    await toResetStep(user);

    expect(screen.getByText(/gửi lại sau 1:00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'gửi lại mã' })).not.toBeInTheDocument();
    expect(resend).not.toHaveBeenCalled();
  });

  it('can go back to fix the email', async () => {
    const user = userEvent.setup();
    renderPage();
    await toResetStep(user);

    await user.click(screen.getByRole('button', { name: 'dùng email khác' }));

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('an@example.com');
  });
});
