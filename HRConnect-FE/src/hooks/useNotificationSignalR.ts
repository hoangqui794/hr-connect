/**
 * @file useNotificationSignalR.ts
 * @description Custom React hook managing the SignalR connection to /hubs/notifications.
 * Reactively updates unread badge count, prepends incoming notifications to TanStack query cache,
 * triggers Ant Design toast popups, and invalidates interview queries across candidate/client consoles.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notification as antNotification } from 'antd';
import { HubConnectionState } from '@microsoft/signalr';
import { useAuthStore } from '@/stores/authStore';
import {
  signalRNotificationService,
  type NotificationCreatedPayload,
  type InterviewUpdatedPayload,
} from '@/services/signalRNotificationService';
import type { NotificationPageDto, UnreadNotificationCountDto } from '@/types/api/notification';

export interface UseNotificationSignalROptions {
  autoConnect?: boolean;
  showToasts?: boolean;
}

export const useNotificationSignalR = (options: UseNotificationSignalROptions = {}) => {
  const { autoConnect = true, showToasts = true } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) || Boolean(user);

  const [connectionState, setConnectionState] = useState<HubConnectionState>(
    signalRNotificationService.getConnectionState()
  );

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // 1. Handle notification.created event
  const handleNotificationCreated = useCallback(
    (payload: NotificationCreatedPayload) => {
      const { notification, unreadCount } = payload;
      if (!notification) return;

      // Immediately update unread count cache
      queryClient.setQueryData<UnreadNotificationCountDto>(
        ['notifications', 'unread-count'],
        (old) => ({
          ...old,
          unreadCount: typeof unreadCount === 'number' ? unreadCount : (old?.unreadCount ?? 0) + 1,
        })
      );

      // Prepend notification to all active notification list queries
      queryClient.setQueriesData<NotificationPageDto>(
        { queryKey: ['notifications', 'list'] },
        (old) => {
          if (!old) return old;
          const currentItems = old.items || [];
          if (currentItems.some((item) => item.notificationId === notification.notificationId)) {
            return old;
          }
          return {
            ...old,
            totalCount: (old.totalCount || currentItems.length) + 1,
            items: [notification, ...currentItems],
          };
        }
      );

      // Show toast popup
      if (showToasts) {
        let route = notification.routeHint?.trim();
        if (!route && notification.metadata) {
          try {
            const meta =
              typeof notification.metadata === 'string'
                ? JSON.parse(notification.metadata)
                : notification.metadata;
            if (meta && typeof meta === 'object') {
              if (meta.routeHint && typeof meta.routeHint === 'string') {
                route = meta.routeHint.trim();
              } else if (meta.jobId && typeof meta.jobId === 'string') {
                route = `/jobs/${meta.jobId}`;
              }
            }
          } catch {
            if (typeof notification.metadata === 'string' && notification.metadata.startsWith('/')) {
              route = notification.metadata.trim();
            }
          }
        }

        if (!route && (notification.notificationType === 'JOB_FIT' || (notification as any).type === 'JOB_FIT')) {
          route = notification.relatedEntityId
            ? `/jobs/${notification.relatedEntityId}`
            : '/candidate/jobs?tab=matches';
        }

        antNotification.info({
          message: notification.title || 'Thông báo mới',
          description: notification.message,
          placement: 'topRight',
          duration: 5,
          onClick: () => {
            if (route) {
              navigateRef.current(route);
            }
          },
          style: { cursor: route ? 'pointer' : 'default' },
        });
      }
    },
    [queryClient, showToasts]
  );

  // 2. Handle interview.updated event
  const handleInterviewUpdated = useCallback(
    (_payload: InterviewUpdatedPayload) => {
      // Invalidate relevant query keys across HR console, Client console, and Candidate portal
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['hr-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['client-overview', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['client-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-applications'] });
    },
    [queryClient]
  );

  useEffect(() => {
    const unsubState = signalRNotificationService.onStateChange((state) => {
      setConnectionState(state);
    });

    const unsubNotif = signalRNotificationService.onNotificationCreated(handleNotificationCreated);
    const unsubInterview = signalRNotificationService.onInterviewUpdated(handleInterviewUpdated);

    return () => {
      unsubState();
      unsubNotif();
      unsubInterview();
    };
  }, [handleNotificationCreated, handleInterviewUpdated]);

  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      signalRNotificationService.start().catch(() => {
        // Logging is handled inside the service. Fallback to polling continues seamlessly.
      });
    } else if (!isAuthenticated) {
      void signalRNotificationService.stop();
    }
  }, [autoConnect, isAuthenticated]);

  const isConnected = connectionState === HubConnectionState.Connected;

  return {
    isConnected,
    connectionState,
    start: () => signalRNotificationService.start(),
    stop: () => signalRNotificationService.stop(),
  };
};

export default useNotificationSignalR;
