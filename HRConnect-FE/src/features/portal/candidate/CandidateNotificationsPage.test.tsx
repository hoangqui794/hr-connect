import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateNotificationsPage } from './CandidateNotificationsPage';
import { notificationApi } from '@/services/api/notificationApi';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'cand-1', name: 'Trương Hoàng Quí', role: 'CANDIDATE' },
      role: 'CANDIDATE',
      isAuthenticated: true,
    }),
}));

const mockNotifications = [
  {
    notificationId: 'cand-n1',
    notificationType: 'INTERVIEW',
    title: 'Lịch phỏng vấn đã được dời',
    message: 'Backend Developer – VNG: 14:00 thứ Năm 06/11/2026, trực tuyến.',
    routeHint: '/candidate/interviews/iv-1',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    notificationId: 'cand-n2',
    notificationType: 'SUBMISSION_CONSENT',
    title: 'Bạn được giới thiệu vào một vị trí mới',
    message: 'Senior .NET Engineer – NAB. Xác nhận trước 21:00 ngày 05/11.',
    routeHint: '/candidate/submission-consents/sub-1',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    notificationId: 'cand-n3',
    notificationType: 'OFFER',
    title: 'MoMo gửi thư mời nhận việc (phiên bản 2)',
    message: 'Software Engineer (C#), trả lời trước 07/11/2026.',
    routeHint: '/candidate/applications/app-1/offers/off-1',
    isRead: true,
    createdAt: new Date().toISOString(),
  },
  {
    notificationId: 'cand-n4',
    notificationType: 'JOB_FIT',
    title: 'Việc làm phù hợp với hồ sơ của bạn',
    message: 'Backend Developer (.NET Core) – FPT Software, phù hợp 92%.',
    routeHint: '/jobs/job-fpt',
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CandidateNotificationsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('CandidateNotificationsPage (Figma Page 23 & 34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, tabs, and notification list correctly matching Page 23', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 2 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: mockNotifications,
      page: 1,
      pageSize: 100,
      totalCount: 4,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thông báo' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chưa đọc (2)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đơn ứng tuyển' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Việc làm gợi ý' })).toBeInTheDocument();
      expect(screen.getByText('Lịch phỏng vấn đã được dời')).toBeInTheDocument();
      expect(screen.getByText('MoMo gửi thư mời nhận việc (phiên bản 2)')).toBeInTheDocument();
    });
  });

  it('filters notifications by tabs: Chưa đọc, Đơn ứng tuyển, Việc làm gợi ý', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 2 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: mockNotifications,
      page: 1,
      pageSize: 100,
      totalCount: 4,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lịch phỏng vấn đã được dời')).toBeInTheDocument();
    });

    // 1. Chuyển sang tab "Chưa đọc"
    fireEvent.click(screen.getByRole('button', { name: 'Chưa đọc (2)' }));
    expect(screen.getByText('Lịch phỏng vấn đã được dời')).toBeInTheDocument();
    expect(screen.queryByText('MoMo gửi thư mời nhận việc (phiên bản 2)')).not.toBeInTheDocument();

    // 2. Chuyển sang tab "Việc làm gợi ý"
    fireEvent.click(screen.getByRole('button', { name: 'Việc làm gợi ý' }));
    expect(screen.getByText('Việc làm phù hợp với hồ sơ của bạn')).toBeInTheDocument();
    expect(screen.queryByText('Lịch phỏng vấn đã được dời')).not.toBeInTheDocument();
  });

  it('renders empty state matching Page 34 when there are no notifications', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 0 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      totalPages: 0,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Chưa có thông báo')).toBeInTheDocument();
      expect(screen.getByText(/Lịch phỏng vấn, offer và việc làm gợi ý sẽ xuất hiện ở đây/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Hoàn thiện hồ sơ' })).toHaveAttribute('href', '/candidate/profile');
    });
  });
});
