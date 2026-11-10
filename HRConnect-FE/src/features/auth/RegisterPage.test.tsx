import { App as AntApp } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@/services/authService';
import { RegisterPage } from './RegisterPage';

const Probe = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="probe">{pathname + search}</div>;
};

const renderPage = (entry = '/register') =>
  render(
    <AntApp>
      <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
    </AntApp>
  );

const fillPerson = async (user: ReturnType<typeof userEvent.setup>, name = 'Họ và tên', email = 'Email') => {
  await user.type(screen.getByLabelText(name), 'Nguyễn An');
  await user.type(screen.getByLabelText(email), 'An@Example.com');
  await user.type(screen.getByLabelText('Mật khẩu'), 'Matkhau@123');
  await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Matkhau@123');
  await user.click(screen.getByRole('checkbox'));
};

describe('RegisterPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('refuses a weak password, a mismatch and missing terms before calling the API', async () => {
    const register = vi.spyOn(authService, 'registerCandidate');
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Họ và tên'), 'An');
    await user.type(screen.getByLabelText('Email'), 'an@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'abcdefg');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'khac');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Hai mật khẩu chưa khớp.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng đồng ý với điều khoản sử dụng.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers a candidate without a phone and goes to the code page, keeping the return path', async () => {
    const register = vi.spyOn(authService, 'registerCandidate').mockResolvedValue({ success: true, message: 'ok' } as never);
    const user = userEvent.setup();
    renderPage('/register?returnTo=%2Fcandidate%2Fapplications');
    await fillPerson(user);

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith({ fullName: 'Nguyễn An', phone: undefined, email: 'an@example.com', password: 'Matkhau@123' }));
    const target = (await screen.findByTestId('probe')).textContent!;
    expect(target).toContain('/verify-otp?email=an%40example.com');
    expect(target).toContain('returnTo=');
  });

  it('asks a client for company, tax code and phone', async () => {
    const register = vi.spyOn(authService, 'registerClient').mockResolvedValue({ success: true, message: 'ok' } as never);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('radio', { name: /Nhà tuyển dụng/ }));
    await fillPerson(user, 'Người đại diện', 'Email doanh nghiệp');

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(screen.getByText('Vui lòng nhập số điện thoại.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Tên doanh nghiệp'), 'Công ty A');
    await user.type(screen.getByLabelText('Mã số thuế'), '0312345678');
    await user.type(screen.getByLabelText('Số điện thoại'), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Công ty A', taxCode: '0312345678', phone: '0912345678' })));
  });

  it('registers an affiliate directly on the page and goes to verify OTP', async () => {
    const register = vi.spyOn(authService, 'registerAffiliate').mockResolvedValue({ success: true, message: 'ok' } as never);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: /^Affiliate/ }));
    await fillPerson(user);

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Nguyễn An', email: 'an@example.com' })));
    const target = (await screen.findByTestId('probe')).textContent!;
    expect(target).toContain('/verify-otp?email=an%40example.com');
  });

  it('shows the server error and keeps the form', async () => {
    vi.spyOn(authService, 'registerCandidate').mockRejectedValue(new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: { success: false, message: 'Email này đã được sử dụng.' },
    }));
    const user = userEvent.setup();
    renderPage();
    await fillPerson(user);

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được sử dụng.');
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn An');
  });
});
