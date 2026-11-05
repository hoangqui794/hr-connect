import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { authService } from '@/services/authService';
import { LoginPage } from './LoginPage';

vi.mock('@/features/jobs-mf01/useJobQueries', () => ({ usePublicJobSearch: vi.fn() }));

const Probe = () => {
  const { pathname, search, state } = useLocation();
  return <div data-testid="probe">{JSON.stringify({ pathname, search, state })}</div>;
};

const renderPage = (entry: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/login']) =>
  render(
    <MemoryRouter initialEntries={entry}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

const failure = (status: number, text: string) =>
  new AxiosError('Failed', String(status), undefined, undefined, {
    status,
    statusText: 'Failed',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, message: text },
  });

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Email'), 'an@example.com');
  await user.type(screen.getByLabelText('Mật khẩu'), 'Matkhau@123');
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(usePublicJobSearch).mockReturnValue({ data: { totalCount: 15 } } as never);
  });

  it('shows the real number of open jobs, and no number when it is unknown', () => {
    const { unmount } = renderPage();
    expect(screen.getByText('15 việc làm đang mở từ các công ty đã xác minh')).toBeInTheDocument();
    unmount();

    vi.mocked(usePublicJobSearch).mockReturnValue({ data: undefined } as never);
    renderPage();
    expect(screen.getByText('Việc làm đang mở từ các công ty đã xác minh')).toBeInTheDocument();
  });

  it('asks for the email and password before calling the API', async () => {
    const login = vi.spyOn(authService, 'login');
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Vui lòng nhập địa chỉ email.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it.each([
    ['a Candidate to the home page', 'CANDIDATE', undefined, '/'],
    ['a Candidate back to the page that asked for login', 'CANDIDATE', '/candidate/cvs', '/candidate/cvs'],
    ['an Admin to the Admin console, not the previous user page', 'ADMIN', '/client/jobs', '/admin/dashboard'],
  ])('logs in and sends %s', async (_, role, from, destination) => {
    vi.spyOn(authService, 'login').mockResolvedValue({ success: true, data: { accessToken: 'test-token' } } as never);
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      success: true,
      data: { userId: 'u1', email: 'an@example.com', displayName: 'An', roles: [role], permissions: [], status: 'ACTIVE' },
    } as never);
    const user = userEvent.setup();
    renderPage([{ pathname: '/login', state: from ? { from } : undefined }]);
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const moved = JSON.parse((await screen.findByTestId('probe')).textContent!);
    expect(moved.pathname).toBe(destination);
    expect(authService.login).toHaveBeenCalledWith({ email: 'an@example.com', password: 'Matkhau@123' });
  });

  it('shows why the login failed and keeps the email', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(failure(401, 'Email hoặc mật khẩu chưa đúng.'));
    const user = userEvent.setup();
    renderPage();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu chưa đúng.');
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
  });

  it('explains an account waiting for approval instead of showing an error', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(failure(403, 'Tài khoản đang chờ Ban quản trị phê duyệt.'));
    const user = userEvent.setup();
    renderPage();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Tài khoản đang chờ xét duyệt.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can show the password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));

    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text');
  });

  it('carries the email and destination to the forgot password page', async () => {
    const user = userEvent.setup();
    renderPage([{ pathname: '/login', search: '?returnTo=%2Fcandidate', state: { from: '/candidate/cvs' } }]);

    await user.type(screen.getByLabelText('Email'), 'an@example.com');
    await user.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));

    await waitFor(() => {
      const moved = JSON.parse(screen.getByTestId('probe').textContent!);
      expect(moved.pathname).toBe('/forgot-password');
      expect(moved.search).toBe('?returnTo=%2Fcandidate');
      expect(moved.state).toEqual({ from: '/candidate/cvs', email: 'an@example.com' });
    });
  });

  it('confirms a password reset and fills the email', () => {
    renderPage([{ pathname: '/login', state: { email: 'an@example.com', passwordReset: true } }]);

    expect(screen.getByRole('status')).toHaveTextContent('Đã đặt lại mật khẩu');
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
  });

  it('confirms a verified email from the link', () => {
    renderPage(['/login?email=an%40example.com&verified=true']);

    expect(screen.getByRole('status')).toHaveTextContent('đã được kích hoạt');
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
  });
});
