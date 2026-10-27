import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { LandingPage } from './LandingPage';

vi.mock('./HomePage', () => ({
  HomePage: () => (
    <main>
      <h1>Tuyển Dụng Chuẩn ATS</h1>
      <button type="button">Đăng nhập</button>
      <button type="button">Đăng ký</button>
    </main>
  ),
}));

const ROLE_CASES = [
  [UserRole.AFFILIATE, '/affiliate/dashboard', 'Affiliate workspace'],
  [UserRole.CLIENT, '/client/dashboard', 'Client workspace'],
  [UserRole.INTERNAL_HR, '/hr/dashboard', 'HR workspace'],
  [UserRole.ADMIN, '/admin/dashboard', 'Admin workspace'],
] as const;

const renderEntry = (role: UserRole, isAuthenticated: boolean) => {
  useAuthStore.setState({ role, isAuthenticated });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/candidate/dashboard" element={<div>Candidate workspace</div>} />
        {ROLE_CASES.map(([, path, label]) => (
          <Route key={path} path={path} element={<div>{label}</div>} />
        ))}
      </Routes>
    </MemoryRouter>
  );
};

describe('LandingPage', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ role: UserRole.GUEST, isAuthenticated: false, user: null });
  });

  it('giữ Guest ở trang giới thiệu', () => {
    renderEntry(UserRole.GUEST, false);

    expect(screen.getByRole('heading', { name: /Tuyển Dụng Chuẩn ATS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng ký/i })).toBeInTheDocument();
  });

  it('giữ Candidate ở trang chủ khi đã đăng nhập (chuẩn TopCV/Job discovery)', () => {
    renderEntry(UserRole.CANDIDATE, true);

    expect(screen.getByRole('heading', { name: /Tuyển Dụng Chuẩn ATS/i })).toBeInTheDocument();
  });

  it.each(ROLE_CASES)('chuyển %s vào đúng workspace', (role, _path, label) => {
    renderEntry(role, true);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
