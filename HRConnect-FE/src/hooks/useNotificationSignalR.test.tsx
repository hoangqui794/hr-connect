import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { notification as antNotification } from 'antd';
import { HubConnectionState } from '@microsoft/signalr';
import { useAuthStore } from '@/stores/authStore';
import { signalRNotificationService } from '@/services/signalRNotificationService';
import { useNotificationSignalR } from './useNotificationSignalR';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    notification: {
      info: vi.fn(),
      open: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('useNotificationSignalR', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Tester', email: 'test@example.com' } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

  it('starts connection on mount when user is authenticated', () => {
    const startSpy = vi.spyOn(signalRNotificationService, 'start').mockResolvedValue();

    const { result } = renderHook(() => useNotificationSignalR(), { wrapper });

    expect(startSpy).toHaveBeenCalled();
    expect(result.current.connectionState).toBeDefined();
  });

  it('stops connection when user logs out', () => {
    vi.spyOn(signalRNotificationService, 'start').mockResolvedValue();
    const stopSpy = vi.spyOn(signalRNotificationService, 'stop').mockResolvedValue();

    renderHook(() => useNotificationSignalR(), { wrapper });

    act(() => {
      useAuthStore.setState({ isAuthenticated: false, user: null });
    });

    expect(stopSpy).toHaveBeenCalled();
  });

  it('updates unread count and notification list in TanStack cache and shows toast popup on notification.created', () => {
    vi.spyOn(signalRNotificationService, 'start').mockResolvedValue();

    // Set initial cache
    queryClient.setQueryData(['notifications', 'unread-count'], { unreadCount: 2 });
    queryClient.setQueryData(['notifications', 'list', 'all'], {
      items: [
        {
          notificationId: 'notif-1',
          title: 'Cũ 1',
          message: 'Thông báo cũ',
          isRead: true,
          createdAt: '2026-10-18T10:00:00Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });

    renderHook(() => useNotificationSignalR(), { wrapper });

    const newNotification = {
      notificationId: 'notif-2',
      title: 'Ứng viên mới',
      message: 'Nguyễn Văn A vừa nộp hồ sơ vào vị trí Python Dev',
      notificationType: 'APPLICATION',
      routeHint: '/client/candidates?status=SUBMITTED',
      isRead: false,
      createdAt: '2026-10-19T10:00:00Z',
    };

    // Emit event through service
    act(() => {
      // Find listener or trigger via service's listeners
      (signalRNotificationService as any).notificationCreatedListeners.forEach((fn: any) =>
        fn({ notification: newNotification, unreadCount: 3 })
      );
    });

    // Verify unread count was updated
    const unreadData = queryClient.getQueryData<{ unreadCount: number }>([
      'notifications',
      'unread-count',
    ]);
    expect(unreadData?.unreadCount).toBe(3);

    // Verify list query cache prepended new notification
    const listData = queryClient.getQueryData<any>(['notifications', 'list', 'all']);
    expect(listData?.totalCount).toBe(2);
    expect(listData?.items[0].notificationId).toBe('notif-2');
    expect(listData?.items[1].notificationId).toBe('notif-1');

    // Verify Ant Design toast popup was shown
    expect(antNotification.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ứng viên mới',
        description: 'Nguyễn Văn A vừa nộp hồ sơ vào vị trí Python Dev',
        placement: 'topRight',
      })
    );
  });

  it('invalidates interview queries when interview.updated fires', () => {
    vi.spyOn(signalRNotificationService, 'start').mockResolvedValue();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useNotificationSignalR(), { wrapper });

    act(() => {
      (signalRNotificationService as any).interviewUpdatedListeners.forEach((fn: any) =>
        fn({ interviewId: 'interview-123' })
      );
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['interviews'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['hr-pipeline'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['client-overview', 'interviews'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate', 'interviews'] });
  });

  it('reflects connection state and isConnected property', () => {
    vi.spyOn(signalRNotificationService, 'start').mockResolvedValue();
    vi.spyOn(signalRNotificationService, 'getConnectionState').mockReturnValue(
      HubConnectionState.Connected
    );

    const { result } = renderHook(() => useNotificationSignalR(), { wrapper });

    act(() => {
      (signalRNotificationService as any).statusListeners.forEach((fn: any) =>
        fn(HubConnectionState.Connected)
      );
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionState).toBe(HubConnectionState.Connected);
  });
});
