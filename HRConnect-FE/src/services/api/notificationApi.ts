/**
 * @file notificationApi.ts
 * @description API client service for Notifications (GET notifications, unread count, mark read, mark all read).
 */

import { apiClient } from '../apiClient';
import type {
  NotificationDto,
  NotificationPageDto,
  UnreadNotificationCountDto,
  MarkNotificationReadResponse,
  NotificationQueryParams,
} from '@/types/api/notification';

const cleanParams = (params?: NotificationQueryParams): Record<string, unknown> => {
  if (!params) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const notificationApi = {
  /**
   * GET /api/v1/notifications
   * Lấy danh sách thông báo của người dùng hiện tại (phân trang, lọc theo type và isRead).
   */
  async getNotifications(params?: NotificationQueryParams): Promise<NotificationPageDto> {
    const res = await apiClient.get<NotificationPageDto | { success: boolean; data: NotificationPageDto }>(
      '/notifications',
      {
        params: cleanParams(params),
      }
    );

    const raw = res.data;
    if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
      return raw.data as NotificationPageDto;
    }
    return raw as NotificationPageDto;
  },

  /**
   * GET /api/v1/notifications/unread-count
   * Lấy số lượng thông báo chưa đọc của người dùng hiện tại.
   */
  async getUnreadCount(): Promise<UnreadNotificationCountDto> {
    const res = await apiClient.get<
      UnreadNotificationCountDto | { success: boolean; data: UnreadNotificationCountDto }
    >('/notifications/unread-count');

    const raw = res.data;
    if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
      return raw.data as UnreadNotificationCountDto;
    }
    return raw as UnreadNotificationCountDto;
  },

  /**
   * POST /api/v1/notifications/{notificationId}/read
   * Đánh dấu 1 thông báo là đã đọc (idempotent).
   */
  async markAsRead(notificationId: string): Promise<MarkNotificationReadResponse> {
    const res = await apiClient.post<
      MarkNotificationReadResponse | { success: boolean; data: MarkNotificationReadResponse }
    >(`/notifications/${encodeURIComponent(notificationId)}/read`);

    const raw = res.data;
    if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
      return raw.data as MarkNotificationReadResponse;
    }
    return (raw as MarkNotificationReadResponse) || { success: true, message: 'Đã đánh dấu đã đọc', updatedCount: 1 };
  },

  /**
   * POST /api/v1/notifications/read-all
   * Đánh dấu toàn bộ thông báo chưa đọc của người dùng là đã đọc.
   */
  async markAllAsRead(): Promise<MarkNotificationReadResponse> {
    const res = await apiClient.post<
      MarkNotificationReadResponse | { success: boolean; data: MarkNotificationReadResponse }
    >('/notifications/read-all');

    const raw = res.data;
    if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
      return raw.data as MarkNotificationReadResponse;
    }
    return (
      (raw as MarkNotificationReadResponse) || {
        success: true,
        message: 'Đã đánh dấu tất cả đã đọc',
        updatedCount: 0,
      }
    );
  },
};
