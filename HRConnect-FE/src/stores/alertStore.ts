import { create } from 'zustand';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface RealtimeAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionRoute?: string;
}

interface AlertStore {
  alerts: RealtimeAlert[];
  unreadCount: number;
  addAlert: (alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissAlert: (id: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertStore>()((set, get) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alertData) => {
    const alert: RealtimeAlert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50), // keep last 50
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
    }));
  },

  dismissAlert: (id) => {
    const alert = get().alerts.find((a) => a.id === id);
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      unreadCount: alert && !alert.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
  },

  clearAll: () => {
    set({ alerts: [], unreadCount: 0 });
  },
}));
