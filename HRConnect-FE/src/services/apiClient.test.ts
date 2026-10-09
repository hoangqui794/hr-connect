import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient, getApiError, getApiErrorMessage } from './apiClient';
import { affiliateApi, candidateApplicationsApi, candidateConsentApi, candidateCvApi } from './api/mf02Api';

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

  it('updates candidate CV title with JSON metadata only', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return { data: { success: true, message: 'OK' }, status: 200, statusText: 'OK', headers: {}, config };
    };

    await candidateCvApi.updateTitle('cv-1', 'CV Backend 2026');

    expect(capturedConfig?.method).toBe('patch');
    expect(capturedConfig?.url).toBe('/candidates/cv/cv-1');
    expect(JSON.parse(capturedConfig?.data as string)).toEqual({ title: 'CV Backend 2026' });
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

  it('posts resend consent to the selected owned submission', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { success: true, submissionId: 'submission-1', status: 'PENDING_CONSENT' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await affiliateApi.resendConsent('submission-1');

    expect(capturedConfig?.method).toBe('post');
    expect(capturedConfig?.url).toBe('/affiliates/submissions/submission-1/consent/resend');
  });

  it('reviews and responds to an authenticated candidate consent by submission id', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config);
      return {
        data: config.method === 'get'
          ? { success: true, data: { submissionId: 'submission-1', status: 'PENDING' } }
          : { success: true, submissionId: 'submission-1', submissionStatus: 'ACCEPTED' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await candidateConsentApi.review('submission-1');
    await candidateConsentApi.respond('submission-1', 'CONFIRM', true);

    expect(requests[0].method).toBe('get');
    expect(requests[0].url).toBe('/candidates/me/submission-consents/submission-1');
    expect(requests[1].method).toBe('post');
    expect(requests[1].url).toBe('/candidates/me/submission-consents/submission-1/respond');
    expect(JSON.parse(requests[1].data as string)).toEqual({ decision: 'CONFIRM', allowFutureReuse: true });
  });

  it('keeps the public consent token in request bodies', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config);
      return {
        data: config.url?.endsWith('/review')
          ? { success: true, data: { submissionId: 'submission-1', status: 'PENDING' } }
          : { success: true, submissionId: 'submission-1', submissionStatus: 'ACCEPTED' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await candidateConsentApi.reviewPublic('one-time-token');
    await candidateConsentApi.respondPublic('one-time-token', 'DECLINE', false);

    expect(requests[0].url).toBe('/submission-consents/review');
    expect(JSON.parse(requests[0].data as string)).toEqual({ token: 'one-time-token' });
    expect(requests[1].url).toBe('/submission-consents/respond');
    expect(JSON.parse(requests[1].data as string)).toEqual({
      token: 'one-time-token',
      decision: 'DECLINE',
      allowFutureReuse: false,
    });
  });
});
