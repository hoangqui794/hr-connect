/**
 * @file services/api/userApi.ts
 * @description User profile endpoints: avatar upload, removal, and presigned redirect URL.
 */
import { apiClient, resolveApiAssetUrl } from '../apiClient';

export interface UploadAvatarData {
  userId: string;
  avatarUrl: string;
  updatedAt: string;
}

export interface UploadAvatarResponse {
  success: boolean;
  message: string;
  data: UploadAvatarData;
}

export interface DeleteAvatarResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    avatarUrl: null;
    updatedAt: string;
  };
}

export interface UpdateUserProfileInput {
  displayName: string;
  phone?: string | null;
  roleInCompany?: string | null;
}

export interface UpdateUserProfileResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    email: string;
    displayName: string;
    phone: string | null;
    avatarUrl: string | null;
    roleInCompany?: string | null;
  };
}

export const userApi = {
  /**
   * PUT /api/v1/users/me
   * Update current user's profile information.
   */
  async updateProfile(input: UpdateUserProfileInput): Promise<UpdateUserProfileResponse> {
    const res = await apiClient.put<UpdateUserProfileResponse>('/users/me', input);
    return res.data;
  },
  /**
   * POST /api/v1/users/me/avatar
   * Upload user avatar as multipart/form-data.
   */
  async uploadAvatar(file: File): Promise<UploadAvatarResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<UploadAvatarResponse>('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return {
      ...res.data,
      data: {
        ...res.data.data,
        avatarUrl: resolveApiAssetUrl(res.data.data.avatarUrl) ?? res.data.data.avatarUrl,
      },
    };
  },

  /**
   * DELETE /api/v1/users/me/avatar
   * Remove current user's avatar.
   */
  async deleteAvatar(): Promise<DeleteAvatarResponse> {
    const res = await apiClient.delete<DeleteAvatarResponse>('/users/me/avatar');
    return res.data;
  },

  /**
   * Get direct URL to user avatar
   */
  getAvatarUrl(userId: string): string {
    return resolveApiAssetUrl(`/api/v1/users/${encodeURIComponent(userId)}/avatar`)!;
  },
};
