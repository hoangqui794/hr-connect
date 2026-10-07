/**
 * @file apiClient.ts
 * @description Centralized Axios HTTP Client for HRConnect.
 * Configured with baseURL from import.meta.env.VITE_API_URL and JWT Bearer Interceptors.
 * An expired access token is refreshed once via /auth/refresh-token and the request retried.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authTokenStorage } from './authTokenStorage';

// Base URL: Fallback hierarchy -> VITE_API_URL -> VITE_API_BASE_URL + /api/v1 -> '/api/v1'.
// The relative default goes through the Vite dev proxy (vite.config.ts) to the backend.
const resolveBaseUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim();
  }
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl && typeof envBaseUrl === 'string' && envBaseUrl.trim()) {
    return `${envBaseUrl.replace(/\/+$/, '')}/api/v1`;
  }
  return '/api/v1';
};

export const API_BASE_URL = resolveBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: Attach JWT Bearer Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = authTokenStorage.getAccessToken();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Endpoints whose 401 means "wrong credentials / dead session", never "refresh and retry".
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh-token', '/auth/logout'];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// One refresh shared by all requests that fail with 401 at the same time.
let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = authTokenStorage.getRefreshToken();
      if (!refreshToken) return null;
      try {
        // Plain axios, not apiClient, so this call never re-enters the interceptor.
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
        );
        const data = response.data?.data;
        if (!response.data?.success || !data?.accessToken) return null;
        authTokenStorage.save(data);
        return data.accessToken as string;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

// Response interceptor: refresh an expired session once, otherwise sign the user out.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = NO_REFRESH_PATHS.some((path) => config?.url?.includes(path));

    if (error.response?.status === 401 && config && !isAuthEndpoint) {
      if (!config._retried) {
        config._retried = true;
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          config.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(config);
        }
      }

      authTokenStorage.clear();
      // authStore listens and resets the session to GUEST.
      window.dispatchEvent(new CustomEvent('hrconnect:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/**
 * Extracts a user-friendly error message from any API error (AxiosError, ProblemDetails, ValidationError).
 */
export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage = 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại!'
): string => {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{
      success?: boolean;
      message?: string;
      errors?: Record<string, string[]>;
      title?: string;
      detail?: string;
    }>;

    const data = err.response?.data;

    // 1. Backend ApiResponse format: { success: false, message: "...", errors?: { Email: [...] } }
    if (data?.message) {
      if (data.errors && typeof data.errors === 'object') {
        const fieldErrors = Object.values(data.errors)
          .flat()
          .filter((msg): msg is string => typeof msg === 'string' && Boolean(msg));
        if (fieldErrors.length > 0) {
          return `${data.message} (${fieldErrors.join('; ')})`;
        }
      }
      return data.message;
    }

    // 2. RFC 9110 / 7807 ProblemDetails: { title, detail, errors }
    if (data?.detail) {
      return data.detail;
    }
    if (data?.title) {
      return data.title;
    }

    // 3. Status-code based human-friendly messages
    if (err.response?.status === 400) {
      return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.';
    }
    if (err.response?.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (err.response?.status === 403) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }
    if (err.response?.status === 409) {
      return 'Dữ liệu vừa được thay đổi bởi người khác. Vui lòng tải lại trang.';
    }
    if (err.response?.status === 404) {
      return 'Không tìm thấy tài nguyên hoặc endpoint yêu cầu.';
    }
    if (err.response?.status === 500) {
      return 'Máy chủ gặp sự cố nội bộ. Vui lòng thử lại sau giây lát.';
    }

    // 4. Network / Timeout errors
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'Kết nối tới máy chủ quá thời gian quy định (Timeout). Vui lòng kiểm tra mạng!';
    }
    if (!err.response) {
      return `Không thể kết nối đến máy chủ Backend (${API_BASE_URL}). Vui lòng kiểm tra dịch vụ API!`;
    }
  } else if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
};

export default apiClient;
