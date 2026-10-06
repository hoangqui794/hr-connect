/**
 * @file apiClient.ts
 * @description Centralized Axios HTTP Client for HRConnect.
 * Configured with baseURL from import.meta.env.VITE_API_URL and JWT Bearer Interceptors.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL: Fallback hierarchy -> VITE_API_URL -> VITE_API_BASE_URL + /api/v1 -> default
const resolveBaseUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim();
  }
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl && typeof envBaseUrl === 'string' && envBaseUrl.trim()) {
    return `${envBaseUrl.replace(/\/+$/, '')}/api/v1`;
  }
  return 'http://localhost:5000/api/v1';
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
    const accessToken =
      localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Global error formatting
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // If 401 Unauthorized occurs on protected routes (not login/refresh itself)
    if (error.response?.status === 401 && error.config && !error.config.url?.includes('/auth/login') && !error.config.url?.includes('/auth/refresh-token')) {
      // Optional: Broadcast logout or unauthorized event
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
      return 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!';
    }
    if (err.response?.status === 403) {
      return 'Tài khoản chưa được xác thực hoặc chưa được Admin phê duyệt để đăng nhập.';
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
      return 'Không thể kết nối đến máy chủ Backend (http://localhost:5000). Vui lòng kiểm tra dịch vụ API!';
    }
  } else if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
};

export default apiClient;
