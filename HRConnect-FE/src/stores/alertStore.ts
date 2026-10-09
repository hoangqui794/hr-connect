import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  relatedEntityId?: string;
}

interface AlertStore {
  alerts: RealtimeAlert[];
  unreadCount: number;
  addAlert: (alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissAlert: (id: string) => void;
  clearAll: () => void;
  resetToDefaults: () => void;
}

const DEFAULT_ALERTS: RealtimeAlert[] = [
  {
    id: 'notif-job-approved-0',
    type: 'success',
    title: 'Tin tuyển dụng đã được duyệt',
    message: 'Tin tuyển dụng "Senior Agentics AI Engineer" đã được Internal HR phê duyệt và công bố công khai.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    actionLabel: 'Xem tin tuyển dụng',
    actionRoute: '/client/jobs?highlight=Senior%20Agentics%20AI%20Engineer&openDetail=true',
  },
  {
    id: 'notif-job-approved-1',
    type: 'success',
    title: 'Tin tuyển dụng đã được duyệt',
    message: 'Tin tuyển dụng "Content Marketer / Copywriter" đã được Internal HR phê duyệt và chuyển sang trạng thái Đang tuyển.',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    read: false,
    actionLabel: 'Xem tin tuyển dụng',
    actionRoute: '/client/jobs?highlight=Content%20Marketer%20/%20Copywriter&openDetail=true',
  },
  {
    id: 'notif-hiring-completed-2',
    type: 'success',
    title: 'Hoàn thành tuyển dụng vị trí',
    message: 'Ứng viên đã nhận offer và hoàn tất quy trình tuyển dụng cho vị trí "Senior Backend Engineer".',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    read: false,
    actionLabel: 'Xem Offer & Phỏng vấn',
    actionRoute: '/client/interviews-offers',
  },
  {
    id: 'notif-new-candidate-3',
    type: 'info',
    title: 'Hồ sơ ứng viên mới nộp',
    message: 'Có 1 hồ sơ ứng viên mới vừa được nộp vào danh sách chờ đánh giá của Doanh nghiệp.',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    read: true,
    actionLabel: 'Xem hồ sơ',
    actionRoute: '/client/candidates',
  },
  {
    id: 'notif-warranty-active-4',
    type: 'warning',
    title: 'Theo dõi bảo hành thử việc',
    message: 'Chính sách bảo hành thử việc 60 ngày (COD) đang được hệ thống kích hoạt và đếm ngược.',
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    read: true,
    actionLabel: 'Theo dõi bảo hành',
    actionRoute: '/client/warranty',
  },
];

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      alerts: DEFAULT_ALERTS,
      unreadCount: DEFAULT_ALERTS.filter((a) => !a.read).length,

      addAlert: (alertData) => {
        const alert: RealtimeAlert = {
          ...alertData,
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          read: false,
        };
        set((state) => {
          const nextAlerts = [alert, ...state.alerts].slice(0, 50);
          return {
            alerts: nextAlerts,
            unreadCount: nextAlerts.filter((a) => !a.read).length,
          };
        });
      },

      markRead: (id) => {
        set((state) => {
          const nextAlerts = state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
          return {
            alerts: nextAlerts,
            unreadCount: nextAlerts.filter((a) => !a.read).length,
          };
        });
      },

      markAllRead: () => {
        set((state) => ({
          alerts: state.alerts.map((a) => ({ ...a, read: true })),
          unreadCount: 0,
        }));
      },

      dismissAlert: (id) => {
        set((state) => {
          const nextAlerts = state.alerts.filter((a) => a.id !== id);
          return {
            alerts: nextAlerts,
            unreadCount: nextAlerts.filter((a) => !a.read).length,
          };
        });
      },

      clearAll: () => {
        set({ alerts: [], unreadCount: 0 });
      },

      resetToDefaults: () => {
        set({
          alerts: DEFAULT_ALERTS,
          unreadCount: DEFAULT_ALERTS.filter((a) => !a.read).length,
        });
      },
    }),
    {
      name: 'hrconnect_client_alerts',
    }
  )
);
