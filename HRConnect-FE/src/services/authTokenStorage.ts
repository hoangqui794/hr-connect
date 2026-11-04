/**
 * @file authTokenStorage.ts
 * @description Single place that reads and writes auth tokens in localStorage.
 * Shared by apiClient (token refresh) and authService, so neither imports the other.
 */

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER_INFO: 'user_info',
  /** Legacy alias of ACCESS_TOKEN still read by older pages. */
  AUTH_TOKEN: 'auth_token',
} as const;

export interface StoredAuthTokens {
  accessToken?: string | null;
  user?: unknown;
}

const LEGACY_REFRESH_TOKEN_KEY = 'refresh_token';

export const authTokenStorage = {
  getAccessToken(): string | null {
    return (
      localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN) ||
      localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN)
    );
  },

  save(tokens: StoredAuthTokens): void {
    // Refresh tokens are HttpOnly cookies. Remove data left by older releases.
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    if (tokens.accessToken) {
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken);
    }
    if (tokens.user) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_INFO, JSON.stringify(tokens.user));
    }
  },

  clear(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_INFO);
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem('token');
  },
};
