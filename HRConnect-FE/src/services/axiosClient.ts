/**
 * @file axiosClient.ts
 * @description Centralized Axios instance for HRConnect API requests.
 * Handles base URL configuration, auth headers, and response/error interception.
 */

/// <reference types="vite/client" />
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/v1';

export const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach bearer token if available
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('auth_token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Format error messages consistently
axiosClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const errorData = error.response?.data as { message?: string } | undefined;
    const message =
      errorData?.message ||
      error.message ||
      'Đã xảy ra lỗi khi kết nối tới máy chủ.';

    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
