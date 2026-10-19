/**
 * @file signalRNotificationService.ts
 * @description Centralized SignalR Hub service for realtime notifications and domain events.
 * Connects to /hubs/notifications with Bearer token authentication and automatic reconnects.
 */

import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from './apiClient';
import { authTokenStorage } from './authTokenStorage';
import type { NotificationDto } from '@/types/api/notification';

export interface NotificationCreatedPayload {
  notification: NotificationDto;
  unreadCount: number;
}

export interface InterviewUpdatedPayload {
  interviewId: string;
}

export type ConnectionStateListener = (state: signalR.HubConnectionState) => void;
export type NotificationCreatedListener = (payload: NotificationCreatedPayload) => void;
export type InterviewUpdatedListener = (payload: InterviewUpdatedPayload) => void;

/**
 * Resolves the SignalR notifications Hub URL from the configured API_BASE_URL.
 * Strips any trailing /api/v1 or /api prefix so dev/production paths map cleanly to /hubs/notifications.
 */
export const resolveNotificationHubUrl = (baseUrl: string = API_BASE_URL): string => {
  if (!baseUrl || baseUrl === '/' || baseUrl === '/api/v1') {
    return '/hubs/notifications';
  }
  const cleanBase = baseUrl.trim().replace(/\/api(?:\/v\d+)?\/?$/i, '').replace(/\/+$/, '');
  return cleanBase ? `${cleanBase}/hubs/notifications` : '/hubs/notifications';
};

export class SignalRNotificationService {
  private connection: signalR.HubConnection | null = null;
  private connectionState: signalR.HubConnectionState = signalR.HubConnectionState.Disconnected;
  private connectingPromise: Promise<void> | null = null;
  private statusListeners = new Set<ConnectionStateListener>();
  private notificationCreatedListeners = new Set<NotificationCreatedListener>();
  private interviewUpdatedListeners = new Set<InterviewUpdatedListener>();
  private hubUrlResolver: () => string;

  constructor(hubUrlResolver: () => string = resolveNotificationHubUrl) {
    this.hubUrlResolver = hubUrlResolver;

    if (typeof window !== 'undefined') {
      window.addEventListener('hrconnect:unauthorized', () => {
        void this.stop();
      });
    }
  }

  public getConnection(): signalR.HubConnection | null {
    return this.connection;
  }

  public getConnectionState(): signalR.HubConnectionState {
    return this.connectionState;
  }

  public isConnected(): boolean {
    return this.connectionState === signalR.HubConnectionState.Connected;
  }

  public async start(): Promise<void> {
    const token = authTokenStorage.getAccessToken();
    if (!token) {
      return;
    }

    if (this.connection) {
      const state = this.connection.state;
      if (
        state === signalR.HubConnectionState.Connected ||
        state === signalR.HubConnectionState.Connecting ||
        state === signalR.HubConnectionState.Reconnecting
      ) {
        return;
      }
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    const hubUrl = this.hubUrlResolver();
    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const isDevEnv = Boolean(import.meta.env?.DEV);

    const logLevel = isTestEnv
      ? signalR.LogLevel.None
      : isDevEnv
      ? signalR.LogLevel.Information
      : signalR.LogLevel.Warning;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => authTokenStorage.getAccessToken() || '',
      })
      .withAutomaticReconnect()
      .configureLogging(logLevel)
      .build();

    // Handler for notification.created (support both kebab/dot notation and PascalCase)
    const handleNotificationCreated = (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const raw = data as Record<string, unknown>;
      const rawNotif = (raw.notification ?? raw.Notification ?? raw) as NotificationDto;
      const unreadCount =
        typeof raw.unreadCount === 'number'
          ? raw.unreadCount
          : typeof raw.UnreadCount === 'number'
          ? raw.UnreadCount
          : 0;

      const payload: NotificationCreatedPayload = {
        notification: rawNotif,
        unreadCount,
      };

      this.notificationCreatedListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('[SignalRNotificationService] Error in notificationCreated listener:', err);
        }
      });
    };

    connection.on('notification.created', handleNotificationCreated);
    connection.on('NotificationCreated', handleNotificationCreated);

    // Handler for interview.updated (support both kebab/dot notation and PascalCase)
    const handleInterviewUpdated = (data: unknown) => {
      let interviewId = '';
      if (typeof data === 'string') {
        interviewId = data;
      } else if (data && typeof data === 'object') {
        const raw = data as Record<string, unknown>;
        interviewId = String(raw.interviewId ?? raw.InterviewId ?? '');
      }

      const payload: InterviewUpdatedPayload = { interviewId };

      this.interviewUpdatedListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('[SignalRNotificationService] Error in interviewUpdated listener:', err);
        }
      });
    };

    connection.on('interview.updated', handleInterviewUpdated);
    connection.on('InterviewUpdated', handleInterviewUpdated);

    // Lifecycle events
    connection.onreconnecting((error) => {
      console.warn('[SignalRNotificationService] Reconnecting to notifications hub...', error);
      this.notifyStateChange(signalR.HubConnectionState.Reconnecting);
    });

    connection.onreconnected((connectionId) => {
      console.info('[SignalRNotificationService] Reconnected to notifications hub. Connection ID:', connectionId);
      this.notifyStateChange(signalR.HubConnectionState.Connected);
    });

    connection.onclose((error) => {
      if (error) {
        console.warn('[SignalRNotificationService] Connection closed with error:', error);
      }
      this.notifyStateChange(signalR.HubConnectionState.Disconnected);
      this.connection = null;
    });

    this.connection = connection;

    this.connectingPromise = connection
      .start()
      .then(() => {
        this.notifyStateChange(signalR.HubConnectionState.Connected);
      })
      .catch((err) => {
        console.error('[SignalRNotificationService] Failed to connect to notifications hub:', err);
        this.notifyStateChange(signalR.HubConnectionState.Disconnected);
        this.connection = null;
        throw err;
      })
      .finally(() => {
        this.connectingPromise = null;
      });

    return this.connectingPromise;
  }

  public async stop(): Promise<void> {
    if (!this.connection) return;
    try {
      const state = this.connection.state;
      if (
        state === signalR.HubConnectionState.Connected ||
        state === signalR.HubConnectionState.Connecting ||
        state === signalR.HubConnectionState.Reconnecting
      ) {
        await this.connection.stop();
      }
    } catch (err) {
      console.warn('[SignalRNotificationService] Error while stopping hub connection:', err);
    } finally {
      this.connection = null;
      this.notifyStateChange(signalR.HubConnectionState.Disconnected);
    }
  }

  private notifyStateChange(state: signalR.HubConnectionState): void {
    this.connectionState = state;
    this.statusListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[SignalRNotificationService] Error in state change listener:', err);
      }
    });
  }

  public onStateChange(listener: ConnectionStateListener): () => void {
    this.statusListeners.add(listener);
    // Immediately emit current state
    listener(this.getConnectionState());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onNotificationCreated(listener: NotificationCreatedListener): () => void {
    this.notificationCreatedListeners.add(listener);
    return () => {
      this.notificationCreatedListeners.delete(listener);
    };
  }

  public onInterviewUpdated(listener: InterviewUpdatedListener): () => void {
    this.interviewUpdatedListeners.add(listener);
    return () => {
      this.interviewUpdatedListeners.delete(listener);
    };
  }
}

export const signalRNotificationService = new SignalRNotificationService();
