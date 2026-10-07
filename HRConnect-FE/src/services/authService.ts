/**
 * @file authService.ts
 * @description Authentication service layer for HRConnect conforming to swagger.json OpenAPI specs.
 * Handles candidate, client, affiliate registration, OTP email verification,
 * login, session management, token refresh, forgot/reset password, and logout.
 */

import { apiClient, getApiErrorMessage } from './apiClient';
import { AUTH_STORAGE_KEYS, authTokenStorage } from './authTokenStorage';

// ─── TYPES & INTERFACES (From swagger.json) ───────────────────────────────────

/**
 * Payload for POST /api/v1/auth/register/candidate
 */
export interface RegisterCandidateCommand {
  email?: string | null;
  password?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

export interface RegisterCandidateData {
  userId: string;
  email?: string | null;
  status?: string | null;
}

export interface RegisterCandidateResponse {
  success: boolean;
  message?: string | null;
  data?: RegisterCandidateData;
}

/**
 * Payload for POST /api/v1/auth/register/affiliate
 */
export interface RegisterAffiliateCommand {
  email?: string | null;
  password?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

export interface RegisterAffiliateData {
  userId: string;
  email?: string | null;
  status?: string | null;
}

export interface RegisterAffiliateResponse {
  success: boolean;
  message?: string | null;
  data?: RegisterAffiliateData;
}

/**
 * Payload for POST /api/v1/auth/register/client
 */
export interface RegisterClientCommand {
  email?: string | null;
  password?: string | null;
  fullName?: string | null;
  phone?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
}

export interface RegisterClientData {
  userId: string;
  email?: string | null;
  status?: string | null;
}

export interface RegisterClientResponse {
  success: boolean;
  message?: string | null;
  data?: RegisterClientData;
}

/**
 * Payload for POST /api/v1/auth/verify-email-otp
 */
export interface VerifyEmailOtpCommand {
  email?: string | null;
  otp?: string | null;
}

export interface VerifyEmailOtpData {
  userId: string;
  email?: string | null;
  status?: string | null;
}

export interface VerifyEmailOtpResponse {
  success: boolean;
  message?: string | null;
  data?: VerifyEmailOtpData;
}

/**
 * Payload for POST /api/v1/auth/login
 */
export interface LoginCommand {
  email?: string | null;
  password?: string | null;
}

/**
 * Embedded user model returned in LoginData & RefreshTokenData
 */
export interface UserInfoData {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  status?: string | null;
  roles?: string[] | null;
  permissions?: string[] | null;
}

/**
 * Authentication tokens and payload returned in LoginResponse
 */
export interface LoginData {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresAt?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  user?: UserInfoData;
}

export interface LoginResponse {
  success: boolean;
  message?: string | null;
  data?: LoginData;
}

/**
 * Full user profile data returned by GET /api/v1/auth/me
 */
export interface CurrentUserDto {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  emailVerified?: boolean;
  roles?: string[] | null;
  permissions?: string[] | null;
}

export interface CurrentUserResponse {
  success: boolean;
  message?: string | null;
  data?: CurrentUserDto;
}

/**
 * Payload for POST /api/v1/auth/refresh-token
 */
export interface RefreshTokenCommand {
  refreshToken?: string | null;
}

export interface RefreshTokenData {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresAt?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  user?: UserInfoData;
}

export interface RefreshTokenResponse {
  success: boolean;
  message?: string | null;
  data?: RefreshTokenData;
}

/**
 * Payload for POST /api/v1/auth/logout
 */
export interface LogoutCommand {
  refreshToken?: string | null;
}

export interface LogoutResponse {
  success: boolean;
  message?: string | null;
}

export interface LogoutAllResponse {
  success: boolean;
  message?: string | null;
}

/**
 * Payload for POST /api/v1/auth/forgot-password
 */
export interface ForgotPasswordCommand {
  email?: string | null;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message?: string | null;
}

/**
 * Payload for POST /api/v1/auth/forgot-password/resend
 */
export interface ResendPasswordResetOtpCommand {
  email?: string | null;
}

export interface ResendPasswordResetOtpResponse {
  success: boolean;
  message?: string | null;
}

/**
 * Payload for POST /api/v1/auth/reset-password
 */
export interface ResetPasswordCommand {
  email?: string | null;
  otp?: string | null;
  newPassword?: string | null;
  confirmPassword?: string | null;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string | null;
}

/**
 * Unified Register Command for UI Form components
 */
export interface UnifiedRegisterPayload {
  role?: string;
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
  companyName?: string;
  taxCode?: string;
}

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────

// Defined in authTokenStorage; re-exported so existing imports from authService keep working.
export { AUTH_STORAGE_KEYS };

// ─── SERVICE IMPLEMENTATION ───────────────────────────────────────────────────

export class AuthService {
  /**
   * Save authentication payload to localStorage
   */
  public saveAuthTokens(data: LoginData | RefreshTokenData): void {
    authTokenStorage.save(data);
  }

  /**
   * Clear all auth session data from localStorage
   */
  public clearAuthTokens(): void {
    authTokenStorage.clear();
  }

  /**
   * Get current stored access token
   */
  public getAccessToken(): string | null {
    return authTokenStorage.getAccessToken();
  }

  /**
   * Get current stored refresh token
   */
  public getRefreshToken(): string | null {
    return authTokenStorage.getRefreshToken();
  }

  /**
   * Get cached user info from localStorage
   */
  public getUserInfo(): UserInfoData | null {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USER_INFO);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserInfoData;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is currently logged in with a valid token
   */
  public isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }

  // ─── 1. REGISTRATION ENDPOINTS (Swagger OpenAPI) ───────────────────────────

  /**
   * POST /api/v1/auth/register/candidate
   * Registers a Candidate account. Status is PENDING email OTP verification.
   */
  public async registerCandidate(
    payload: RegisterCandidateCommand
  ): Promise<RegisterCandidateResponse> {
    const response = await apiClient.post<RegisterCandidateResponse>(
      '/auth/register/candidate',
      {
        fullName: payload.fullName?.trim(),
        email: payload.email?.trim().toLowerCase(),
        password: payload.password,
        phone: payload.phone?.trim(),
      }
    );
    return response.data;
  }

  /**
   * POST /api/v1/auth/register/affiliate
   * Registers an Affiliate Recruiter (Headhunter) account.
   */
  public async registerAffiliate(
    payload: RegisterAffiliateCommand
  ): Promise<RegisterAffiliateResponse> {
    const response = await apiClient.post<RegisterAffiliateResponse>(
      '/auth/register/affiliate',
      {
        fullName: payload.fullName?.trim(),
        email: payload.email?.trim().toLowerCase(),
        password: payload.password,
        phone: payload.phone?.trim(),
      }
    );
    return response.data;
  }

  /**
   * POST /api/v1/auth/register/client
   * Registers a Client Company account.
   */
  public async registerClient(
    payload: RegisterClientCommand
  ): Promise<RegisterClientResponse> {
    const response = await apiClient.post<RegisterClientResponse>(
      '/auth/register/client',
      {
        fullName: payload.fullName?.trim(),
        email: payload.email?.trim().toLowerCase(),
        password: payload.password,
        phone: payload.phone?.trim(),
        companyName: payload.companyName?.trim(),
        taxCode: payload.taxCode?.trim(),
      }
    );
    return response.data;
  }

  /**
   * Unified register router that dispatches to the correct Swagger endpoint based on role.
   */
  public async register(payload: UnifiedRegisterPayload): Promise<{
    status: number;
    data: RegisterCandidateResponse | RegisterAffiliateResponse | RegisterClientResponse;
  }> {
    const normalizedRole = (payload.role || 'CANDIDATE').toUpperCase();

    try {
      let result;
      if (normalizedRole.includes('CLIENT')) {
        result = await this.registerClient({
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
          phone: payload.phone,
          companyName: payload.companyName,
          taxCode: payload.taxCode,
        });
      } else if (normalizedRole.includes('AFFILIATE')) {
        result = await this.registerAffiliate({
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
          phone: payload.phone,
        });
      } else {
        result = await this.registerCandidate({
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
          phone: payload.phone,
        });
      }

      return { status: 201, data: result };
    } catch (error: any) {
      if (error?.response) {
        return { status: error.response.status, data: error.response.data };
      }
      throw error;
    }
  }

  // ─── 2. OTP VERIFICATION ENDPOINTS ─────────────────────────────────────────

  /**
   * POST /api/v1/auth/verify-email-otp
   * Verifies 6-digit OTP sent via email to activate the account.
   */
  public async verifyEmailOtp(
    payload: VerifyEmailOtpCommand
  ): Promise<{ status: number; data: VerifyEmailOtpResponse }> {
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const cleanOtp = (payload.otp || '').trim();

    try {
      const response = await apiClient.post<VerifyEmailOtpResponse>(
        '/auth/verify-email-otp',
        {
          email: cleanEmail,
          otp: cleanOtp,
        }
      );
      return { status: response.status, data: response.data };
    } catch (err: any) {
      if (err?.response) {
        return { status: err.response.status, data: err.response.data };
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/auth/verify-email-otp/resend
   * Resends the registration (email activation) OTP — not the password-reset OTP.
   */
  public async resendVerificationOtp(email: string): Promise<{ success: boolean; message?: string | null }> {
    const res = await apiClient.post<{ success: boolean; message?: string | null }>(
      '/auth/verify-email-otp/resend',
      { email: email.trim().toLowerCase() }
    );
    return res.data;
  }

  // Backwards compatibility alias
  public async verifyOtp(payload: { email: string; otp: string }) {
    return this.verifyEmailOtp(payload);
  }

  public async resendOtp(email: string) {
    return this.resendVerificationOtp(email);
  }

  // ─── 3. LOGIN & SESSION MANAGEMENT ─────────────────────────────────────────

  /**
   * POST /api/v1/auth/login
   * Authenticate user with Email and Password, receiving JWT Access Token and Refresh Token.
   */
  public async login(credentials: LoginCommand): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', {
      email: credentials.email?.trim(),
      password: credentials.password,
    });

    const result = response.data;
    if (result.success && result.data) {
      this.saveAuthTokens(result.data);
    }

    return result;
  }

  /**
   * GET /api/v1/auth/me
   * Retrieve full current user profile from server using Bearer Token.
   */
  public async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me');
    return response.data;
  }

  /**
   * POST /api/v1/auth/refresh-token
   * Refresh JWT Access Token using active Refresh Token (Rotation).
   */
  public async refreshToken(customRefreshToken?: string): Promise<RefreshTokenResponse> {
    const token = customRefreshToken || this.getRefreshToken();
    if (!token) {
      throw new Error('Không tìm thấy Refresh Token trong phiên đăng nhập!');
    }

    const payload: RefreshTokenCommand = { refreshToken: token };
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh-token', payload);

    const result = response.data;
    if (result.success && result.data) {
      this.saveAuthTokens(result.data);
    }

    return result;
  }

  /**
   * POST /api/v1/auth/logout
   * Invalidate current session and revoke Refresh Token on the server.
   */
  public async logout(): Promise<LogoutResponse> {
    const refreshToken = this.getRefreshToken();

    try {
      if (refreshToken) {
        const payload: LogoutCommand = { refreshToken };
        const response = await apiClient.post<LogoutResponse>('/auth/logout', payload);
        return response.data;
      }
      return { success: true, message: 'Đăng xuất thành công.' };
    } catch (error) {
      console.warn('Backend logout warning:', getApiErrorMessage(error));
      return { success: true, message: 'Đã xóa phiên đăng nhập cục bộ.' };
    } finally {
      this.clearAuthTokens();
      window.dispatchEvent(new CustomEvent('hrconnect:logout'));
    }
  }

  /**
   * POST /api/v1/auth/logout-all
   * Revoke all active Refresh Tokens across all devices.
   */
  public async logoutAll(): Promise<LogoutAllResponse> {
    try {
      const response = await apiClient.post<LogoutAllResponse>('/auth/logout-all');
      return response.data;
    } finally {
      this.clearAuthTokens();
      window.dispatchEvent(new CustomEvent('hrconnect:logout'));
    }
  }

  // ─── 4. PASSWORD RECOVERY & RESET ─────────────────────────────────────────

  /**
   * POST /api/v1/auth/forgot-password
   * Request password reset OTP code sent to user email.
   */
  public async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const payload: ForgotPasswordCommand = { email: email.trim().toLowerCase() };
    const response = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', payload);
    return response.data;
  }

  /**
   * POST /api/v1/auth/forgot-password/resend
   * Resend password reset OTP code.
   */
  public async resendForgotPasswordOtp(email: string): Promise<ResendPasswordResetOtpResponse> {
    const payload: ResendPasswordResetOtpCommand = { email: email.trim().toLowerCase() };
    const response = await apiClient.post<ResendPasswordResetOtpResponse>(
      '/auth/forgot-password/resend',
      payload
    );
    return response.data;
  }

  /**
   * POST /api/v1/auth/reset-password
   * Reset user password using 6-digit OTP code.
   */
  public async resetPassword(payload: ResetPasswordCommand): Promise<ResetPasswordResponse> {
    const response = await apiClient.post<ResetPasswordResponse>('/auth/reset-password', {
      email: payload.email?.trim().toLowerCase(),
      otp: payload.otp?.trim(),
      newPassword: payload.newPassword,
      confirmPassword: payload.confirmPassword,
    });
    return response.data;
  }
}

export const authService = new AuthService();
export default authService;
