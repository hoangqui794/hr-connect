import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { notificationApi } from './notificationApi';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('notificationApi service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('calls GET /notifications with query parameters and returns page data directly', async () => {
      const mockPage = {
        items: [
          {
            notificationId: 'notif-1',
            notificationType: 'JOB',
            title: 'Tin tuyển dụng mới',
            message: 'Đã có bài đăng mới',
            isRead: false,
            createdAt: '2026-10-16T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPage,
      });

      const result = await notificationApi.getNotifications({ page: 1, pageSize: 20, isRead: false });

      expect(apiClient.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 1, pageSize: 20, isRead: false },
      });
      expect(result).toEqual(mockPage);
    });

    it('unpacks enveloped response format if backend returns { success: true, data: { ... } }', async () => {
      const mockPage = {
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockPage },
      });

      const result = await notificationApi.getNotifications();
      expect(result).toEqual(mockPage);
    });
  });

  describe('getUnreadCount', () => {
    it('calls GET /notifications/unread-count and returns unread count dto', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { unreadCount: 5 },
      });

      const result = await notificationApi.getUnreadCount();
      expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count');
      expect(result).toEqual({ unreadCount: 5 });
    });

    it('unpacks enveloped unread count response', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: { unreadCount: 3 } },
      });

      const result = await notificationApi.getUnreadCount();
      expect(result).toEqual({ unreadCount: 3 });
    });
  });

  describe('markAsRead', () => {
    it('calls POST /notifications/{notificationId}/read', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã đánh dấu đã đọc', updatedCount: 1 },
      });

      const result = await notificationApi.markAsRead('notif-123');
      expect(apiClient.post).toHaveBeenCalledWith('/notifications/notif-123/read');
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('calls POST /notifications/read-all', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã đánh dấu tất cả đã đọc', updatedCount: 4 },
      });

      const result = await notificationApi.markAllAsRead();
      expect(apiClient.post).toHaveBeenCalledWith('/notifications/read-all');
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(4);
    });
  });
});
