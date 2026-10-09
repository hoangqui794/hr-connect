export interface ApiErrorPayload {
  success?: boolean;
  message?: string;
  code?: string;
  errorCode?: string;
  retryAfterSeconds?: number;
  errors?: Record<string, string[]>;
  title?: string;
  detail?: string;
}

export interface NormalizedApiError {
  status?: number;
  message: string;
  code?: string;
  retryAfterSeconds?: number;
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
}
