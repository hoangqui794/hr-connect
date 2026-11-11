import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './Navbar';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderNavbar = (path = '/') =>
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[path]}>
          <Navbar />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );

describe('Navbar Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      role: null,
    } as never);
  });

  it('renders "Trang chủ", "Việc làm", and "Công ty" links', () => {
    renderNavbar('/');
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Việc làm' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Công ty' })).toBeInTheDocument();
  });

  it('marks "Trang chủ" as active on root path ("/") and "Việc làm" as inactive', () => {
    renderNavbar('/');
    const homeLink = screen.getByRole('link', { name: 'Trang chủ' });
    const jobsLink = screen.getByRole('link', { name: 'Việc làm' });

    expect(homeLink).toHaveAttribute('aria-current', 'page');
    expect(jobsLink).not.toHaveAttribute('aria-current');
  });

  it('marks "Việc làm" as active on "/jobs" path and "Trang chủ" as inactive', () => {
    renderNavbar('/jobs');
    const homeLink = screen.getByRole('link', { name: 'Trang chủ' });
    const jobsLink = screen.getByRole('link', { name: 'Việc làm' });

    expect(jobsLink).toHaveAttribute('aria-current', 'page');
    expect(homeLink).not.toHaveAttribute('aria-current');
  });

  it('renders "Tạo CV" when candidate is logged in', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.CANDIDATE,
      user: {
        userId: 'candidate-1',
        name: 'Nguyễn Văn Ứng Viên',
        email: 'candidate@example.com',
      },
    } as never);

    renderNavbar('/');
    expect(screen.getByRole('link', { name: 'Tạo CV' })).toBeInTheDocument();
  });
});

