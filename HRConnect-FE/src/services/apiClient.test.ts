import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient, getApiError, getApiErrorMessage } from './apiClient';
import { affiliateApi, candidateApplicationsApi, candidateCvApi } from './api/mf02Api';

describe('API client foundation', () => {
  afterEach(() => {
    apiClient.defaults.adapter = undefined;
  });

  it('normalizes business metadata without changing the legacy message contract', () => {
    const response = {
      status: 429,
      statusText: 'Too Many Requests',
      headers: new AxiosHeaders({ 'x-correlation-id': 'corr-123', 'retry-after': '45' }),
      config: {} as InternalAxiosRequestConfig,
      data: {
        message: 'Bạn thao tác quá nhanh.',
        errorCode: 'RATE_LIMITED',
        errors: { email: ['Email không hợp lệ.'] },
      },
    } satisfies AxiosResponse;
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', response.config, undefined, response);

    expect(getApiError(error)).toEqual({
      status: 429,
      message: 'Bạn thao tác quá nhanh. (Email không hợp lệ.)',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 45,
      fieldErrors: { email: ['Email không hợp lệ.'] },
      correlationId: 'corr-123',
    });
    expect(getApiErrorMessage(error)).toBe('Bạn thao tác quá nhanh. (Email không hợp lệ.)');
  });

  it('removes the JSON content type so Axios can generate a multipart boundary', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { success: true, data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await candidateCvApi.upload(new File(['pdf'], 'cv.pdf', { type: 'application/pdf' }), 'CV chính');

    expect(capturedConfig?.data).toBeInstanceOf(FormData);
    // The browser adapter replaces this generic fallback with multipart/form-data
    // and its generated boundary. The application must never hard-code a
    // boundary-less multipart content type.
    expect(capturedConfig?.headers.get('Content-Type')).not.toBe('multipart/form-data');
  });

  it('sends candidate application filters to the backend list endpoint', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { success: true, data: { items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await candidateApplicationsApi.list({
      status: 'SCREENING',
      jobId: 'job-1',
      fromDate: '2026-10-01T00:00:00.000Z',
      toDate: '2026-10-08T23:59:59.999Z',
      page: 2,
      pageSize: 10,
    });

    expect(capturedConfig?.url).toBe('/candidates/applications');
    expect(capturedConfig?.params).toEqual({
      status: 'SCREENING',
      jobId: 'job-1',
      fromDate: '2026-10-01T00:00:00.000Z',
      toDate: '2026-10-08T23:59:59.999Z',
      page: 2,
      pageSize: 10,
    });
  });

  it('keeps new-candidate and library submission fields mutually exclusive', async () => {
    const bodies: FormData[] = [];
    apiClient.defaults.adapter = async (config) => {
      bodies.push(config.data as FormData);
      return {
        data: { success: true, data: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await affiliateApi.submit('job-1', {
      fullName: 'Nguyễn Văn A',
      email: 'candidate@example.com',
      file: new File(['pdf'], 'cv.pdf', { type: 'application/pdf' }),
    });
    await affiliateApi.submit('job-2', { candidateId: 'candidate-1', cvId: 'cv-1' });

    expect([...bodies[0].keys()].sort()).toEqual(['email', 'file', 'fullName']);
    expect([...bodies[1].keys()].sort()).toEqual(['candidateId', 'cvId']);
  });

  it('sends every affiliate submission history filter to the backend', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { items: [], totalCount: 0, page: 3, pageSize: 10, totalPages: 0 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await affiliateApi.submissions({
      status: 'PENDING_CONSENT',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      fromDate: '2026-10-01T00:00:00.000Z',
      toDate: '2026-10-08T23:59:59.999Z',
      page: 3,
      pageSize: 10,
    });

    expect(capturedConfig?.params).toEqual({
      status: 'PENDING_CONSENT',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      fromDate: '2026-10-01T00:00:00.000Z',
      toDate: '2026-10-08T23:59:59.999Z',
      page: 3,
      pageSize: 10,
    });
  });

  it('loads affiliate submission detail by its owned submission id', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { submissionId: 'submission-1', status: 'PENDING_CONSENT' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await affiliateApi.submissionDetail('submission-1');

    expect(capturedConfig?.method).toBe('get');
    expect(capturedConfig?.url).toBe('/affiliates/submissions/submission-1');
  });
});
