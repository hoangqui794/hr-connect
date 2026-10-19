import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App as AntApp } from 'antd';
import { AdminContactRequestsPage } from './AdminContactRequestsPage';
import { contactApi } from '@/services/api/contactApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/contactApi', () => ({
  contactApi: {
    list: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

const listMock = vi.mocked(contactApi.list);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter initialEntries={['/admin/contact-requests']}>
          <Routes>
            <Route path="/admin/contact-requests" element={<AdminContactRequestsPage />} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('AdminContactRequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@hrconnectvn.online',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['contact_request.manage'],
      },
    });

    listMock.mockResolvedValue({
      items: [
        {
          contactRequestId: 'req-1',
          fullName: 'Nguyễn Văn A',
          email: 'vana@example.com',
          phone: '0901234567',
          companyName: 'Công ty Alpha',
          serviceInterest: 'HEADHUNT_COD',
          message: 'Cần tư vấn tuyển 5 Kỹ sư',
          status: 'NEW',
          handledBy: null,
          note: null,
          createdAt: '2026-10-19T09:00:00Z',
          updatedAt: null,
        },
        {
          contactRequestId: 'req-2',
          fullName: 'Trần Thị B',
          email: 'thib@example.com',
          phone: '0987654321',
          companyName: 'Công ty Beta',
          serviceInterest: 'CV_SOURCING',
          message: 'Cần nguồn CV Product Manager',
          status: 'CONTACTED',
          handledBy: 'HR Specialist',
          note: 'Đã gọi tư vấn và gửi báo giá',
          createdAt: '2026-10-18T14:30:00Z',
          updatedAt: '2026-10-18T16:00:00Z',
        },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('renders page header and list items correctly', async () => {
    renderPage();

    expect(screen.getByText('Yêu cầu tư vấn dịch vụ')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
      expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
      expect(screen.getAllByText('Công ty Alpha').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Công ty Beta').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Tuyển trọn gói (COD)')).toBeInTheDocument();
    expect(screen.getByText('Cung cấp hồ sơ (Sourcing)')).toBeInTheDocument();
    expect(screen.getAllByText('Mới tiếp nhận').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đã liên hệ').length).toBeGreaterThanOrEqual(1);
  });
});
