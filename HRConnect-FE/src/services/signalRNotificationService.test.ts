import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as signalR from '@microsoft/signalr';
import {
  SignalRNotificationService,
  resolveNotificationHubUrl,
} from './signalRNotificationService';
import { authTokenStorage } from './authTokenStorage';

describe('signalRNotificationService', () => {
  describe('resolveNotificationHubUrl', () => {
    it('returns /hubs/notifications for default relative api base url', () => {
      expect(resolveNotificationHubUrl('/api/v1')).toBe('/hubs/notifications');
      expect(resolveNotificationHubUrl('/api/v1/')).toBe('/hubs/notifications');
      expect(resolveNotificationHubUrl('/')).toBe('/hubs/notifications');
      expect(resolveNotificationHubUrl('')).toBe('/hubs/notifications');
    });

    it('returns full hub url when absolute api base url is provided', () => {
      expect(resolveNotificationHubUrl('http://localhost:5041/api/v1')).toBe(
        'http://localhost:5041/hubs/notifications'
      );
      expect(resolveNotificationHubUrl('http://localhost:5041/api/v1/')).toBe(
        'http://localhost:5041/hubs/notifications'
      );
      expect(resolveNotificationHubUrl('http://localhost:5041/api')).toBe(
        'http://localhost:5041/hubs/notifications'
      );
      expect(resolveNotificationHubUrl('http://localhost:5041')).toBe(
        'http://localhost:5041/hubs/notifications'
      );
      expect(resolveNotificationHubUrl('https://api.hrconnect.vn/api/v1')).toBe(
        'https://api.hrconnect.vn/hubs/notifications'
      );
    });
  });

  describe('SignalRNotificationService connection and events', () => {
    let service: SignalRNotificationService;
    let mockConnection: any;
    const registeredHandlers: Record<string, (...args: any[]) => void> = {};
    let reconnectingHandler: ((err?: Error) => void) | null = null;
    let reconnectedHandler: ((id?: string) => void) | null = null;
    let closeHandler: ((err?: Error) => void) | null = null;

    beforeEach(() => {
      vi.clearAllMocks();
      for (const k of Object.keys(registeredHandlers)) {
        delete registeredHandlers[k];
      }
      reconnectingHandler = null;
      reconnectedHandler = null;
      closeHandler = null;

      mockConnection = {
        state: signalR.HubConnectionState.Disconnected,
        start: vi.fn().mockImplementation(async () => {
          mockConnection.state = signalR.HubConnectionState.Connected;
        }),
        stop: vi.fn().mockImplementation(async () => {
          mockConnection.state = signalR.HubConnectionState.Disconnected;
        }),
        on: vi.fn().mockImplementation((event: string, handler: any) => {
          registeredHandlers[event] = handler;
        }),
        onreconnecting: vi.fn().mockImplementation((handler: any) => {
          reconnectingHandler = handler;
        }),
        onreconnected: vi.fn().mockImplementation((handler: any) => {
          reconnectedHandler = handler;
        }),
        onclose: vi.fn().mockImplementation((handler: any) => {
          closeHandler = handler;
        }),
      };

      vi.spyOn(signalR.HubConnectionBuilder.prototype, 'withUrl').mockReturnThis();
      vi.spyOn(signalR.HubConnectionBuilder.prototype, 'withAutomaticReconnect').mockReturnThis();
      vi.spyOn(signalR.HubConnectionBuilder.prototype, 'configureLogging').mockReturnThis();
      vi.spyOn(signalR.HubConnectionBuilder.prototype, 'build').mockReturnValue(mockConnection);

      service = new SignalRNotificationService(() => '/hubs/notifications');
    });

    afterEach(async () => {
      await service.stop();
      vi.useRealTimers();
    });

    it('does not start connection if access token is missing', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue(null);

      await service.start();

      expect(mockConnection.start).not.toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Disconnected);
    });

    it('starts connection when access token is present and updates state to Connected', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');

      await service.start();

      expect(mockConnection.start).toHaveBeenCalledTimes(1);
      expect(service.isConnected()).toBe(true);
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Connected);
    });

    it('connects without cookies so the cross-origin negotiate passes the API CORS policy', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');

      await service.start();

      expect(signalR.HubConnectionBuilder.prototype.withUrl).toHaveBeenCalledWith(
        '/hubs/notifications',
        expect.objectContaining({ withCredentials: false }),
      );
    });

    it('registers handlers for notification.created and interview.updated', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');

      await service.start();

      expect(mockConnection.on).toHaveBeenCalledWith('notification.created', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('NotificationCreated', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('interview.updated', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('InterviewUpdated', expect.any(Function));
    });

    it('emits payload to notificationCreated listeners when notification.created fires', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();

      const listener = vi.fn();
      const unsub = service.onNotificationCreated(listener);

      const fakeData = {
        notification: {
          notificationId: 'notif-123',
          title: 'Tin mới',
          message: 'Bạn có thông báo mới',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        unreadCount: 5,
      };

      // Trigger the registered handler
      registeredHandlers['notification.created'](fakeData);

      expect(listener).toHaveBeenCalledWith({
        notification: fakeData.notification,
        unreadCount: 5,
      });

      unsub();
      registeredHandlers['notification.created'](fakeData);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits payload to interviewUpdated listeners when interview.updated fires', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();

      const listener = vi.fn();
      const unsub = service.onInterviewUpdated(listener);

      registeredHandlers['interview.updated']({ interviewId: 'interview-999' });

      expect(listener).toHaveBeenCalledWith({ interviewId: 'interview-999' });

      unsub();
    });

    it('handles reconnecting and reconnected lifecycle events', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();

      const stateChanges: signalR.HubConnectionState[] = [];
      service.onStateChange((state) => stateChanges.push(state));

      expect(service.isConnected()).toBe(true);

      // Trigger reconnecting
      if (reconnectingHandler) reconnectingHandler(new Error('Network drop'));
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Reconnecting);

      // Trigger reconnected
      if (reconnectedHandler) reconnectedHandler('conn-2');
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Connected);
    });

    it('stops connection cleanly and transitions to Disconnected', async () => {
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();

      expect(service.isConnected()).toBe(true);

      await service.stop();

      expect(mockConnection.stop).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Disconnected);
    });

    it('retries an initial connection failure while an access token is still available', async () => {
      vi.useFakeTimers();
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      mockConnection.start
        .mockRejectedValueOnce(new Error('Hub unavailable'))
        .mockImplementationOnce(async () => {
          mockConnection.state = signalR.HubConnectionState.Connected;
        });

      await expect(service.start()).rejects.toThrow('Hub unavailable');
      expect(mockConnection.start).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockConnection.start).toHaveBeenCalledTimes(2);
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Connected);
    });

    it('restarts after automatic reconnect is exhausted and onclose fires', async () => {
      vi.useFakeTimers();
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();

      mockConnection.state = signalR.HubConnectionState.Disconnected;
      closeHandler?.(new Error('Reconnect exhausted'));
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockConnection.start).toHaveBeenCalledTimes(2);
      expect(service.getConnectionState()).toBe(signalR.HubConnectionState.Connected);
    });

    it('does not restart after an explicit stop', async () => {
      vi.useFakeTimers();
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      await service.start();
      await service.stop();

      closeHandler?.();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockConnection.start).toHaveBeenCalledTimes(1);
    });

    it('disables hub and prevents retry loops when negotiate returns 404 Not Found', async () => {
      vi.useFakeTimers();
      vi.spyOn(authTokenStorage, 'getAccessToken').mockReturnValue('mock-jwt-token');
      const err404 = new Error('Failed to complete negotiation with the server: Error: Not Found (404)');
      (err404 as any).statusCode = 404;
      mockConnection.start.mockRejectedValue(err404);

      // Should handle 404 cleanly without throwing an unhandled rejection
      await service.start();

      expect(mockConnection.start).toHaveBeenCalledTimes(1);
      expect(service.isAvailable()).toBe(false);
      expect(service.isConnected()).toBe(false);

      // Advancing timer should NOT trigger retry because hub is marked unavailable
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockConnection.start).toHaveBeenCalledTimes(1);

      // Subsequent start calls should skip immediately
      await service.start();
      expect(mockConnection.start).toHaveBeenCalledTimes(1);
    });
  });
});

