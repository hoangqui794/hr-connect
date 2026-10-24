import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { clientActionsApi, interviewHistoryApi, placementCorrectionApi, placementReconciliationApi } from './hrApi';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('MF-04 API contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends salary basis and period when the Client creates an offer', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { offerId: 'offer-1' } } });

    await clientActionsApi.createOffer('application-1', {
      salary: 360_000_000,
      currencyCode: 'VND',
      salaryBasis: 'GROSS',
      salaryPeriod: 'ANNUAL',
      startDate: '2026-11-01',
      expiryDate: '2026-10-25',
      concurrencyToken: 'application-token',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/recruitment/applications/application-1/offers', {
      salary: 360_000_000,
      currencyCode: 'VND',
      salaryBasis: 'GROSS',
      salaryPeriod: 'ANNUAL',
      startDate: '2026-11-01',
      expiryDate: '2026-10-25',
      concurrencyToken: 'application-token',
    });
  });

  it('keeps salary semantics when a draft offer is updated', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { success: true, data: { offerId: 'offer-1' } } });

    await clientActionsApi.updateOffer('offer-1', {
      salary: 30_000_000,
      currencyCode: 'VND',
      salaryBasis: 'GROSS',
      salaryPeriod: 'MONTHLY',
      concurrencyToken: 'offer-token',
    });

    expect(apiClient.put).toHaveBeenCalledWith('/offers/offer-1', {
      salary: 30_000_000,
      currencyCode: 'VND',
      salaryBasis: 'GROSS',
      salaryPeriod: 'MONTHLY',
      concurrencyToken: 'offer-token',
    });
  });

  it('sends acceptAsNewHire only when retrying an exhausted replacement slot', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, message: 'Đã xác nhận bắt đầu làm việc.' } });

    await clientActionsApi.confirmStartWork('application-1', {
      offerId: 'offer-1',
      actualStartDate: '2026-10-16',
      concurrencyToken: 'application-token',
      acceptAsNewHire: true,
    });

    expect(apiClient.post).toHaveBeenCalledWith('/recruitment/applications/application-1/start-work', {
      offerId: 'offer-1',
      actualStartDate: '2026-10-16',
      concurrencyToken: 'application-token',
      acceptAsNewHire: true,
    });
  });

  it('updates interview details with the latest concurrency token', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { success: true, data: { interviewId: 'interview-1' } } });

    await clientActionsApi.updateInterview('interview-1', {
      durationMinutes: 75,
      interviewType: 'ONLINE',
      location: 'Google Meet',
      meetingLink: 'https://meet.google.com/example',
      concurrencyToken: 'interview-token',
    });

    expect(apiClient.put).toHaveBeenCalledWith('/interviews/interview-1', {
      durationMinutes: 75,
      interviewType: 'ONLINE',
      location: 'Google Meet',
      meetingLink: 'https://meet.google.com/example',
      concurrencyToken: 'interview-token',
    });
  });

  it('loads the interview history through the real read-only endpoint', async () => {
    const history = [{ historyId: 'history-1', newStatus: 'RESCHEDULED' }];
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: history } });

    await expect(interviewHistoryApi.get('interview-1')).resolves.toEqual(history);
    expect(apiClient.get).toHaveBeenCalledWith('/interviews/interview-1/history');
  });

  it('uses the Internal-HR placement correction endpoint with only a date and reason', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, message: 'Đã cập nhật ngày đi làm.' } });

    await placementCorrectionApi.correctStartDate('placement-1', {
      actualStartDate: '2026-10-15',
      reason: 'Client nhập nhầm ngày bắt đầu làm việc.',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/placements/placement-1/start-date-correction', {
      actualStartDate: '2026-10-15',
      reason: 'Client nhập nhầm ngày bắt đầu làm việc.',
    });
  });

  it('loads the placement detail directly instead of calling MF-05 warranty endpoints', async () => {
    const detail = { placementId: 'placement-1', actualStartDate: '2026-10-15' };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: detail });

    await expect(placementCorrectionApi.get('placement-1')).resolves.toEqual(detail);
    expect(apiClient.get).toHaveBeenCalledWith('/placements/placement-1');
  });

  it('uses the Internal HR queue and forwards the optimistic concurrency token', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { status: 'CONFIRMED' } });

    await placementReconciliationApi.list({ status: 'PENDING', page: 1, pageSize: 20 });
    await placementReconciliationApi.reconcile('application-1', {
      decision: 'CONFIRM',
      contactChannel: 'CANDIDATE',
      note: null,
      concurrencyToken: 'reconciliation-token',
    });

    expect(apiClient.get).toHaveBeenCalledWith('/internal-hr/placement-reconciliations', {
      params: { status: 'PENDING', page: 1, pageSize: 20 },
    });
    expect(apiClient.post).toHaveBeenCalledWith('/internal-hr/placement-reconciliations/application-1', {
      decision: 'CONFIRM',
      contactChannel: 'CANDIDATE',
      note: null,
      concurrencyToken: 'reconciliation-token',
    });
  });

  it('uses the admin endpoint only for resolving a flagged reconciliation', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { status: 'CONFIRMED' } });

    await placementReconciliationApi.resolve('application-1', {
      note: 'Đã đối chiếu biên bản nhận việc.',
      concurrencyToken: 'reconciliation-token',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/admin/placement-reconciliations/application-1/resolve', {
      note: 'Đã đối chiếu biên bản nhận việc.',
      concurrencyToken: 'reconciliation-token',
    });
  });
});
