/**
 * @file types/api/notification.ts
 * @description API contract models for Notification Bell and notifications system.
 * Mirrored from backend HRConnect.Application/Features/Notifications/DTOs/NotificationDto.cs.
 */

export interface NotificationDto {
  notificationId: string;
  notificationType: string;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  routeHint?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  metadata?: string | null;
}

export interface NotificationPageDto {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface UnreadNotificationCountDto {
  unreadCount: number;
}

export interface MarkNotificationReadResponse {
  success: boolean;
  message: string;
  updatedCount: number;
}

export interface NotificationQueryParams {
  page?: number;
  pageSize?: number;
  type?: string;
  isRead?: boolean;
}
