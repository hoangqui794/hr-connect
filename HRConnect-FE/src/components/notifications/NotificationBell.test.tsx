import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationApi } from '@/services/api/notificationApi';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from './NotificationBell';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NotificationBell component', () => {
  let queryClient: QueryClient;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      user: mockUser as any,
      isAuthenticated: true,
    });
  });

  const renderBell = () =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <NotificationBell />
        </QueryClientProvider>
      </MemoryRouter>
    );

  it('renders bell button and displays unread badge count from API', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValueOnce({ unreadCount: 7 });

    renderBell();

    expect(screen.getByRole('button', { name: /Thông báo hệ thống/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  it('opens popover on click and renders notifications list', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValueOnce({ unreadCount: 2 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValueOnce({
      items: [
        {
          notificationId: 'notif-1',
          notificationType: 'JOB',
          title: 'Tuyển dụng Senior Node.js',
          message: 'Đơn tuyển dụng đã được duyệt',
          routeHint: '/jobs/job-123',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /Thông báo hệ thống/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Tuyển dụng Senior Node.js')).toBeInTheDocument();
      expect(screen.getByText('Đơn tuyển dụng đã được duyệt')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no notifications', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValueOnce({ unreadCount: 0 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /Thông báo hệ thống/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Chưa có thông báo nào')).toBeInTheDocument();
    });
  });

  it('renders error state with retry button when list query fails', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValueOnce({ unreadCount: 0 });
    vi.spyOn(notificationApi, 'getNotifications').mockRejectedValueOnce(new Error('Lỗi máy chủ kết nối'));

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /Thông báo hệ thống/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải thông báo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tải lại/i })).toBeInTheDocument();
    });
  });

  it('marks notification as read and navigates to routeHint when clicked', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 1 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: [
        {
          notificationId: 'notif-unread-1',
          notificationType: 'APPLICATION',
          title: 'Hồ sơ ứng viên mới',
          message: 'Nguyễn Văn B đã nộp đơn ứng tuyển',
          routeHint: '/candidate/applications',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    const markReadSpy = vi.spyOn(notificationApi, 'markAsRead').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      updatedCount: 1,
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /Thông báo hệ thống/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ ứng viên mới')).toBeInTheDocument();
    });

    const notifTitle = screen.getByText('Hồ sơ ứng viên mới');
    fireEvent.click(notifTitle);

    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith('notif-unread-1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/candidate/applications');
  });

  it('calls markAllAsRead when clicking "Đã đọc tất cả"', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 3 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: [
        {
          notificationId: 'notif-1',
          notificationType: 'JOB',
          title: 'Thông báo 1',
          message: 'Nội dung 1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    const markAllSpy = vi.spyOn(notificationApi, 'markAllAsRead').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      updatedCount: 3,
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /Thông báo hệ thống/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đã đọc tất cả/i })).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /Đã đọc tất cả/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllSpy).toHaveBeenCalledTimes(1);
    });
  });
});
