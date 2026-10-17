import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { clientActionsApi, interviewHistoryApi } from './hrApi';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('clientActionsApi MF-04 fee and replacement contracts', () => {
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
});
