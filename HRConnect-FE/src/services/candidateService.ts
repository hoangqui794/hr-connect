/**
 * @file candidateService.ts
 * @description Candidate Profile Service conforming to swagger.json OpenAPI specs.
 * Endpoints:
 * - GET /api/v1/candidates/profile/me (Xem thông tin hồ sơ ứng viên hiện tại)
 * - PUT /api/v1/candidates/profile/me (Cập nhật thông tin hồ sơ ứng viên)
 * - PATCH /api/v1/candidates/profile/me/visibility (Cập nhật chế độ hiển thị hồ sơ ứng viên: PUBLIC/PRIVATE)
 */

import { apiClient } from './apiClient';

export interface CandidateSkillItemDto {
  skillId?: string;
  skillName?: string | null;
  category?: string | null;
  proficiencyLevel?: string | null;
  yearsOfExperience?: number | null;
}

export interface CandidateCvItemDto {
  cvId?: string;
  title?: string | null;
  creationMethod?: string | null;
  sourceFileUrl?: string | null;
  renderedFileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  isPrimary?: boolean;
  updatedAt?: string;
}

export interface CandidateProfileData {
  candidateId: string;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  highestEducation?: string | null;
  yearsOfExperience?: number | null;
  summary?: string | null;
  profileVisibility?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  skills?: CandidateSkillItemDto[] | null;
  primaryCv?: CandidateCvItemDto | null;
}

export interface CandidateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: CandidateProfileData;
}

export interface UpdateCandidateProfileCommand {
  fullName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  highestEducation?: string | null;
  yearsOfExperience?: number | null;
  summary?: string | null;
}

export interface UpdateCandidateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: CandidateProfileData;
}

export interface UpdateProfileVisibilityCommand {
  visibility?: 'PUBLIC' | 'PRIVATE' | string | null;
}

export interface UpdateProfileVisibilityResponse {
  success: boolean;
  message?: string | null;
  data?: any;
}

export class CandidateService {
  /**
   * GET /api/v1/candidates/profile/me
   * Lấy toàn bộ thông tin chi tiết hồ sơ của ứng viên đang đăng nhập dựa trên JWT Bearer Token.
   */
  public async getProfile(): Promise<CandidateProfileResponse> {
    const response = await apiClient.get<CandidateProfileResponse>('/candidates/profile/me');
    return response.data;
  }

  /**
   * PUT /api/v1/candidates/profile/me
   * Cập nhật thông tin hồ sơ ứng viên (họ tên, sđt, ngày sinh, giới tính, địa chỉ, học vấn, kinh nghiệm, tóm tắt).
   */
  public async updateProfile(command: UpdateCandidateProfileCommand): Promise<UpdateCandidateProfileResponse> {
    const response = await apiClient.put<UpdateCandidateProfileResponse>('/candidates/profile/me', command);
    return response.data;
  }

  /**
   * PATCH /api/v1/candidates/profile/me/visibility
   * Cập nhật chế độ hiển thị hồ sơ ứng viên (PUBLIC/PRIVATE).
   */
  public async updateVisibility(command: UpdateProfileVisibilityCommand): Promise<UpdateProfileVisibilityResponse> {
    const response = await apiClient.patch<UpdateProfileVisibilityResponse>('/candidates/profile/me/visibility', command);
    return response.data;
  }

  // ── Candidate Skills Management ──────────────────────────────────────────

  /**
   * GET /api/v1/skills
   * Danh mục kỹ năng hệ thống đang hoạt động để ứng viên tìm kiếm và chọn.
   */
  public async getCatalogSkills(params?: { search?: string; page?: number; pageSize?: number }): Promise<any> {
    const response = await apiClient.get('/skills', { params });
    return response.data;
  }

  /**
   * GET /api/v1/candidates/profile/me/skills
   * Lấy danh sách kỹ năng hiện tại trong hồ sơ ứng viên.
   */
  public async getMySkills(): Promise<CandidateSkillItemDto[]> {
    const response = await apiClient.get<any>('/candidates/profile/me/skills');
    return response.data?.data || response.data || [];
  }

  /**
   * PUT /api/v1/candidates/profile/me/skills
   * Cập nhật toàn bộ danh sách kỹ năng (atomic replace, mảng rỗng để xóa tất cả).
   */
  public async setMySkills(skills: { skillId: string; proficiencyLevel?: string; yearsOfExperience?: number }[]): Promise<any> {
    const response = await apiClient.put('/candidates/profile/me/skills', skills);
    return response.data;
  }

  /**
   * POST /api/v1/candidates/profile/me/skills
   * Thêm một kỹ năng mới vào hồ sơ ứng viên.
   */
  public async addSkill(skill: { skillId: string; proficiencyLevel?: string; yearsOfExperience?: number }): Promise<any> {
    const response = await apiClient.post('/candidates/profile/me/skills', skill);
    return response.data;
  }

  /**
   * PATCH /api/v1/candidates/profile/me/skills/{skillId}
   * Sửa mức thành thạo hoặc số năm kinh nghiệm của kỹ năng.
   */
  public async updateSkill(skillId: string, data: { proficiencyLevel?: string; yearsOfExperience?: number }): Promise<any> {
    const response = await apiClient.patch(`/candidates/profile/me/skills/${skillId}`, data);
    return response.data;
  }

  /**
   * DELETE /api/v1/candidates/profile/me/skills/{skillId}
   * Xóa một kỹ năng khỏi hồ sơ ứng viên.
   */
  public async removeSkill(skillId: string): Promise<any> {
    const response = await apiClient.delete(`/candidates/profile/me/skills/${skillId}`);
    return response.data;
  }
}

export const candidateService = new CandidateService();
export default candidateService;
