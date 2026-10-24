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
import { portalRoute } from '@/components/notifications/notificationRoutes';
import { refreshKeysFor } from './notificationRefreshKeys';
import {
  signalRNotificationService,
  type ApplicationScoredPayload,
  type NotificationCreatedPayload,
  type InterviewUpdatedPayload,
} from '@/services/signalRNotificationService';
import type { NotificationPageDto, UnreadNotificationCountDto } from '@/types/api/notification';

export interface UseNotificationSignalROptions {
  autoConnect?: boolean;
  showToasts?: boolean;
}

const parseMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (!metadata) return null;
  if (typeof metadata === 'object') return metadata as Record<string, unknown>;
  if (typeof metadata !== 'string') return null;

  try {
    const value = JSON.parse(metadata);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

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
      const metadata = parseMetadata(notification.metadata);

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

      // Refresh the pages that show the entity this notification is about, so lists update without a reload.
      for (const queryKey of refreshKeysFor(notification.relatedEntityType)) {
        void queryClient.invalidateQueries({ queryKey });
      }

      // MF-04 notifications carry the owning application so the Candidate portal can refresh
      // the exact application/timeline caches without relying on unrelated legacy query keys.
      const entityType = notification.relatedEntityType?.trim().toUpperCase();
      if (entityType === 'INTERVIEW' || entityType === 'OFFER') {
        const applicationId = typeof metadata?.applicationId === 'string' ? metadata.applicationId : '';
        const interviewId =
          typeof metadata?.interviewId === 'string'
            ? metadata.interviewId
            : entityType === 'INTERVIEW'
              ? notification.relatedEntityId || ''
              : '';

        void queryClient.invalidateQueries({ queryKey: ['candidate-applications'] });
        if (applicationId) {
          void queryClient.invalidateQueries({ queryKey: ['candidate-applications', applicationId] });
          void queryClient.invalidateQueries({ queryKey: ['candidate-application-timeline', applicationId] });
        }
        if (interviewId) {
          void queryClient.invalidateQueries({ queryKey: ['candidate', 'interviews', interviewId] });
        }
      }

      // Show toast popup
      if (showToasts) {
        let route = notification.routeHint?.trim();
        if (!route && notification.metadata) {
          try {
            const meta = metadata;
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
              navigateRef.current(portalRoute(route, useAuthStore.getState().role));
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
    (payload: InterviewUpdatedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-applications'] });
      if (payload.interviewId) {
        void queryClient.invalidateQueries({ queryKey: ['candidate', 'interviews', payload.interviewId] });
      }
    },
    [queryClient]
  );

  // 3. AI scoring finished: refresh every list and detail that shows the score, no page reload needed.
  const handleApplicationScored = useCallback(
    (payload: ApplicationScoredPayload) => {
      for (const key of ['hr-screening', 'hr-overview', 'client-candidates', 'client-overview', 'candidate-applications']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      if (payload.applicationId) {
        void queryClient.invalidateQueries({ queryKey: ['hr-application', payload.applicationId] });
        void queryClient.invalidateQueries({ queryKey: ['hr-application-timeline', payload.applicationId] });
      }
    },
    [queryClient]
  );

  useEffect(() => {
    const unsubState = signalRNotificationService.onStateChange((state) => {
      setConnectionState(state);
    });

    const unsubNotif = signalRNotificationService.onNotificationCreated(handleNotificationCreated);
    const unsubInterview = signalRNotificationService.onInterviewUpdated(handleInterviewUpdated);
    const unsubScored = signalRNotificationService.onApplicationScored(handleApplicationScored);

    return () => {
      unsubState();
      unsubNotif();
      unsubInterview();
      unsubScored();
    };
  }, [handleNotificationCreated, handleInterviewUpdated, handleApplicationScored]);

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
