/**
 * @file services/api/sourcingApi.test.ts
 * @description Unit tests for MF-03 CV Sourcing delivery API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sourcingApi } from './sourcingApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('sourcingApi', () => {
  const jobId = '11111111-1111-1111-1111-111111111111';
  const deliveryId = '22222222-2222-2222-2222-222222222222';
  const applicationId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDeliveries calls GET /jobs/{jobId}/sourcing/deliveries without status param when not supplied', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            sourcingTarget: 10,
            delivered: 3,
            accepted: 1,
            autoAccepted: 0,
            rejected: 0,
            pendingReview: 2,
            counted: 1,
          },
          items: [],
        },
      },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.getDeliveries(jobId);

    expect(apiClient.get).toHaveBeenCalledWith(`/jobs/${jobId}/sourcing/deliveries`, {
      params: undefined,
    });
    expect(result).toEqual(mockResponse.data.data);
  });

  it('getDeliveries passes status param when supplied', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            sourcingTarget: 10,
            delivered: 3,
            accepted: 1,
            autoAccepted: 0,
            rejected: 0,
            pendingReview: 2,
            counted: 1,
          },
          items: [],
        },
      },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

    await sourcingApi.getDeliveries(jobId, 'DELIVERED');

    expect(apiClient.get).toHaveBeenCalledWith(`/jobs/${jobId}/sourcing/deliveries`, {
      params: { status: 'DELIVERED' },
    });
  });

  it('deliverCvs calls POST /jobs/{jobId}/sourcing/deliveries with applicationIds', async () => {
    const applicationIds = [applicationId, '44444444-4444-4444-4444-444444444444'];
    const mockResponse = {
      data: {
        success: true,
        data: {
          delivered: [{ deliveryId, applicationId, status: 'DELIVERED' }],
          summary: { sourcingTarget: 10, delivered: 2, counted: 0 },
        },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.deliverCvs(jobId, applicationIds);

    expect(apiClient.post).toHaveBeenCalledWith(`/jobs/${jobId}/sourcing/deliveries`, {
      applicationIds,
    });
    expect(result).toEqual(mockResponse.data.data);
  });

  it('decideDelivery calls POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/decision with ACCEPTED', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          deliveryId,
          applicationId,
          status: 'ACCEPTED',
          decidedAt: '2026-10-16T12:00:00Z',
        },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.decideDelivery(jobId, deliveryId, { decision: 'ACCEPTED' });

    expect(apiClient.post).toHaveBeenCalledWith(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/decision`,
      { decision: 'ACCEPTED' }
    );
    expect(result).toEqual(mockResponse.data.data);
  });

  it('decideDelivery calls POST with REJECTED and reasonCode and note', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          deliveryId,
          applicationId,
          status: 'REJECTED',
          rejectReasonCode: 'DUPLICATE_ALREADY_OWNED',
          rejectNote: 'Ứng viên đã nộp tháng trước',
        },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.decideDelivery(jobId, deliveryId, {
      decision: 'REJECTED',
      reasonCode: 'DUPLICATE_ALREADY_OWNED',
      note: 'Ứng viên đã nộp tháng trước',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/decision`,
      {
        decision: 'REJECTED',
        reasonCode: 'DUPLICATE_ALREADY_OWNED',
        note: 'Ứng viên đã nộp tháng trước',
      }
    );
    expect(result).toEqual(mockResponse.data.data);
  });

  it('reviewRejection calls POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/review-rejection', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          deliveryId,
          status: 'ACCEPTED',
        },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.reviewRejection(jobId, deliveryId, {
      upheld: false,
      note: 'Lý do từ chối không có căn cứ',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/review-rejection`,
      {
        upheld: false,
        note: 'Lý do từ chối không có căn cứ',
      }
    );
    expect(result).toEqual(mockResponse.data.data);
  });

  it('replaceDelivery calls POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/replace', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          deliveryId: '55555555-5555-5555-5555-555555555555',
          status: 'DELIVERED',
        },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await sourcingApi.replaceDelivery(jobId, deliveryId, applicationId);

    expect(apiClient.post).toHaveBeenCalledWith(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/replace`,
      { applicationId }
    );
    expect(result).toEqual(mockResponse.data.data);
  });
});
