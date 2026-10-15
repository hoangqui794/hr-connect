import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertType = 'info' | 'success' | 'warning' | 'error';
export type AlertRole = 'CLIENT' | 'INTERNAL_HR' | 'AFFILIATE' | 'CANDIDATE' | 'ADMIN' | 'ALL';

export interface RealtimeAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetRole?: AlertRole;
  readByRoles?: string[];
  actionLabel?: string;
  actionRoute?: string;
  relatedEntityId?: string;
}

interface AlertStore {
  alerts: RealtimeAlert[];
  unreadCount: number;
  addAlert: (alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string, role?: string) => void;
  markAllRead: (role?: string) => void;
  dismissAlert: (id: string) => void;
  clearAll: (role?: string) => void;
  resetToDefaults: () => void;
}

const DEFAULT_ALERTS: RealtimeAlert[] = [
  // ── Thông báo cho Client (Doanh nghiệp) ──
  {
    id: 'notif-client-payment-req',
    type: 'warning',
    title: 'Yêu cầu thanh toán phí đăng tin',
    message: 'Tin tuyển dụng "Thiết kế trang web" đã được duyệt nội dung! Vui lòng hoàn tất thanh toán 1.500.000 đ để kích hoạt và công khai tin.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    read: false,
    targetRole: 'CLIENT',
    readByRoles: [],
    actionLabel: 'Thanh toán ngay',
    actionRoute: '/client/jobs?status=PENDING_PAYMENT&highlight=Thiết%20kế%20trang%20web&openPayment=true',
    relatedEntityId: 'job-pending-payment-01',
  },
  {
    id: 'notif-job-approved-0',
    type: 'success',
    title: 'Tin tuyển dụng đã được duyệt',
    message: 'Tin tuyển dụng "Senior Agentics AI Engineer" đã được Internal HR phê duyệt và công bố công khai.',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    read: false,
    targetRole: 'CLIENT',
    readByRoles: [],
    actionLabel: 'Xem tin tuyển dụng',
    actionRoute: '/client/jobs?highlight=Senior%20Agentics%20AI%20Engineer&openDetail=true',
  },
  {
    id: 'notif-hiring-completed-2',
    type: 'success',
    title: 'Hoàn thành tuyển dụng vị trí',
    message: 'Ứng viên đã nhận offer và hoàn tất quy trình tuyển dụng cho vị trí "Senior Backend Engineer".',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    read: false,
    targetRole: 'CLIENT',
    readByRoles: [],
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
    targetRole: 'CLIENT',
    readByRoles: ['CLIENT'],
    actionLabel: 'Xem hồ sơ',
    actionRoute: '/client/candidates',
  },

  // ── Thông báo cho Internal HR / Admin ──
  {
    id: 'notif-hr-review-0',
    type: 'info',
    title: 'Tin tuyển dụng mới chờ duyệt',
    message: 'Doanh nghiệp TechCorp Vietnam vừa gửi duyệt tin tuyển dụng "Senior DevOps Engineer".',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    targetRole: 'INTERNAL_HR',
    readByRoles: [],
    actionLabel: 'Xem và duyệt tin',
    actionRoute: '/internal/jobs/review?status=PENDING_REVIEW',
  },
  {
    id: 'notif-hr-payment-follow',
    type: 'warning',
    title: 'Đơn chờ thu phí đăng tin',
    message: 'Tin "Thiết kế trang web" của HR Connect Demo Company đang ở trạng thái Chờ thanh toán (1.500.000 đ).',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    read: false,
    targetRole: 'INTERNAL_HR',
    readByRoles: [],
    actionLabel: 'Xem danh sách',
    actionRoute: '/internal/jobs/review?status=PENDING_PAYMENT',
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
          targetRole: alertData.targetRole || 'ALL',
          readByRoles: [],
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

      markRead: (id, role) => {
        set((state) => {
          const nextAlerts = state.alerts.map((a) => {
            if (a.id !== id) return a;
            const updatedReadByRoles = Array.from(new Set([...(a.readByRoles || []), ...(role ? [role] : [])]));
            return {
              ...a,
              read: true,
              readByRoles: updatedReadByRoles,
            };
          });
          return {
            alerts: nextAlerts,
            unreadCount: nextAlerts.filter((a) => !a.read).length,
          };
        });
      },

      markAllRead: (role) => {
        set((state) => {
          const nextAlerts = state.alerts.map((a) => {
            if (role && a.targetRole && a.targetRole !== 'ALL' && a.targetRole !== role) {
              return a;
            }
            const updatedReadByRoles = Array.from(new Set([...(a.readByRoles || []), ...(role ? [role] : [])]));
            return {
              ...a,
              read: true,
              readByRoles: updatedReadByRoles,
            };
          });
          return {
            alerts: nextAlerts,
            unreadCount: nextAlerts.filter((a) => !a.read).length,
          };
        });
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

      clearAll: (role) => {
        if (!role) {
          set({ alerts: [], unreadCount: 0 });
        } else {
          set((state) => {
            const nextAlerts = state.alerts.filter((a) => a.targetRole && a.targetRole !== role && a.targetRole !== 'ALL');
            return {
              alerts: nextAlerts,
              unreadCount: nextAlerts.filter((a) => !a.read).length,
            };
          });
        }
      },

      resetToDefaults: () => {
        set({
          alerts: DEFAULT_ALERTS,
          unreadCount: DEFAULT_ALERTS.filter((a) => !a.read).length,
        });
      },
    }),
    {
      name: 'hrconnect_client_alerts_v2',
    }
  )
);
