/**
 * @file services/api/userApi.ts
 * @description User profile endpoints: avatar upload, removal, and presigned redirect URL.
 */
import { apiClient } from '../apiClient';

export interface UploadAvatarData {
  userId: string;
  avatarUrl: string;
  objectKey: string;
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
}

export const userApi = {
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
    return res.data;
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
    return `/api/v1/users/${userId}/avatar`;
  },
};
