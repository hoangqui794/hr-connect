import { useAlertStore } from '@/stores/alertStore';

type WSHandler = () => void;

const JOB_ALERTS = [
  { title: 'New Application Received', message: 'Nguyen Duc Thanh applied for Senior Java Backend Engineer at TechCorp', type: 'info' as const, actionLabel: 'Review', actionRoute: '/screening' },
  { title: 'Candidate Shortlisted', message: 'AI screening completed for Tran Thi Lan Anh — Score: 74% (Strong Match)', type: 'success' as const, actionLabel: 'View Scorecard', actionRoute: '/screening' },
  { title: 'Duplicate Detected', message: 'Submission blocked: Bui Van Huu already registered by David Tran for Job #001', type: 'warning' as const, actionLabel: 'View Dispute', actionRoute: '/admin' },
  { title: 'Commission Payable', message: 'Probation period for Duong Thi Mai completed. Commission $7,200 now payable.', type: 'success' as const, actionLabel: 'View Ledger', actionRoute: '/affiliate/ledger' },
  { title: 'Interview Scheduled', message: 'Multi-party interview for Pham Quynh Nhu confirmed for Sept 20, 2026 at 10:00 AM', type: 'info' as const, actionLabel: 'View Calendar', actionRoute: '/dashboard' },
  { title: 'New Job Posted', message: 'TechCorp Vietnam posted "Senior Java Backend" — Commission: 18% (HEADHUNT_COD)', type: 'info' as const, actionLabel: 'View Job', actionRoute: '/jobs' },
  { title: 'Warranty Expiry Alert', message: 'Le Minh Khoa probation ends in 3 days — confirm retention with client', type: 'warning' as const, actionLabel: 'View Dashboard', actionRoute: '/affiliate/ledger' },
];

let intervalId: ReturnType<typeof setInterval> | null = null;
let isConnected = false;
const handlers: Set<WSHandler> = new Set();

export const MockWebSocketService = {
  connect(): void {
    if (isConnected) return;
    isConnected = true;

    console.info('[WS] Connected to HR Connect SignalR mock service');

    // Send initial alert after 3 seconds
    setTimeout(() => {
      const alert = JOB_ALERTS[0];
      useAlertStore.getState().addAlert(alert);
    }, 3000);

    // Then send random alerts every 25-40 seconds
    intervalId = setInterval(() => {
      const randomAlert = JOB_ALERTS[Math.floor(Math.random() * JOB_ALERTS.length)];
      useAlertStore.getState().addAlert(randomAlert);
      handlers.forEach((h) => h());
    }, 25000 + Math.random() * 15000);
  },

  disconnect(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isConnected = false;
    console.info('[WS] Disconnected from HR Connect SignalR mock service');
  },

  onMessage(handler: WSHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },

  get connected(): boolean {
    return isConnected;
  },

  // Trigger a specific alert manually (for demo purposes)
  triggerAlert(index: number): void {
    const alert = JOB_ALERTS[index % JOB_ALERTS.length];
    useAlertStore.getState().addAlert(alert);
  },

  triggerDuplicateAlert(): void {
    useAlertStore.getState().addAlert({
      type: 'warning',
      title: 'DUPLICATE BLOCKED',
      message: 'Your submission for Bui Van Huu on Job #001 was blocked — already submitted by David Tran on Sept 5, 2026.',
      actionLabel: 'Raise Dispute',
      actionRoute: '/affiliate/referral',
    });
  },
};
