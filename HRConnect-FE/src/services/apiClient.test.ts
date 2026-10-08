import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient, getApiError, getApiErrorMessage } from './apiClient';
import { candidateCvApi } from './api/mf02Api';

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
});
