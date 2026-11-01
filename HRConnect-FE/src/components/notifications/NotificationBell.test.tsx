import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationApi } from '@/services/api/notificationApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { NotificationBell } from './NotificationBell';
import { getNotificationRoute } from './notificationRoutes';

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

  it('navigates to metadata.routeHint when clicking a JOB_FIT notification', async () => {
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({ unreadCount: 1 });
    vi.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
      items: [
        {
          notificationId: 'notif-fit-1',
          notificationType: 'JOB_FIT',
          title: 'Việc làm phù hợp mới: Python Engineer',
          message: 'Hệ thống gợi ý việc làm phù hợp 85% với bạn',
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ routeHint: '/jobs/job-python-123', jobId: 'job-python-123' }),
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
      expect(screen.getByText('Việc làm phù hợp mới: Python Engineer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Việc làm phù hợp mới: Python Engineer'));

    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith('notif-fit-1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/job-python-123');
  });

  describe('getNotificationRoute for INTERNAL_HR', () => {
    it('routes signed service agreement to the actual job status tab instead of PENDING_AGREEMENT', () => {
      const route = getNotificationRoute(
        {
          notificationId: 'n-signed',
          notificationType: 'JOB',
          title: 'Thỏa thuận dịch vụ đã được ký',
          message: "Đại diện doanh nghiệp 'Tech Corp' đã ký điện tử thành công thỏa thuận dịch vụ cho tin tuyển dụng 'Senior React'.",
          relatedEntityType: 'SERVICE_AGREEMENT',
          relatedEntityId: 'agr-1',
          metadata: JSON.stringify({ agreementId: 'agr-1', jobId: 'job-99', jobStatus: 'ACTIVE' }),
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        UserRole.INTERNAL_HR
      );

      expect(route).toBe('/hr/jobs?status=ACTIVE&highlight=job-99');
    });

    it('routes warranty, placement reconciliation, contact request, and sourcing rejection notifications accurately', () => {
      expect(
        getNotificationRoute(
          {
            notificationId: 'n-warranty',
            notificationType: 'WARRANTY',
            title: 'Doanh nghiệp báo ứng viên nghỉ việc',
            message: 'Ứng viên nghỉ việc trong thời gian bảo hành',
            relatedEntityType: 'WARRANTY',
            relatedEntityId: 'war-123',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          UserRole.INTERNAL_HR
        )
      ).toBe('/hr/warranty-tracking?highlight=war-123');

      expect(
        getNotificationRoute(
          {
            notificationId: 'n-rec',
            notificationType: 'SYSTEM',
            title: 'Cần đối soát xác nhận nhận việc',
            message: 'Doanh nghiệp đã xác nhận ứng viên nhận việc',
            relatedEntityType: 'PLACEMENT_RECONCILIATION',
            relatedEntityId: 'app-456',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          UserRole.INTERNAL_HR
        )
      ).toBe('/hr/placement-reconciliations?highlight=app-456');

      expect(
        getNotificationRoute(
          {
            notificationId: 'n-contact',
            notificationType: 'SYSTEM',
            title: 'Có yêu cầu tư vấn mới',
            message: 'Khách hàng vừa gửi yêu cầu tư vấn',
            relatedEntityType: 'CONTACT_REQUEST',
            relatedEntityId: 'req-789',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          UserRole.INTERNAL_HR
        )
      ).toBe('/hr/contact-requests?highlight=req-789');

      expect(
        getNotificationRoute(
          {
            notificationId: 'n-sourcing',
            notificationType: 'SOURCING',
            title: 'Client từ chối một CV đã giao',
            message: 'CV bị từ chối',
            relatedEntityType: 'SOURCING_DELIVERY',
            relatedEntityId: 'del-1',
            routeHint: '/hr/screening?status=SHORTLISTED&open=app-777',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          UserRole.INTERNAL_HR
        )
      ).toBe('/hr/screening?status=SHORTLISTED&open=app-777');
    });
  });
});
