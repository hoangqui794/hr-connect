/**
 * @file jobService.ts
 * @description API service for Job management endpoints (MF-01) in HRConnect.
 * Conforms strictly to swagger.json specification and standardized DTOs.
 */

import { axiosClient } from './axiosClient';
import type {
  CreateJobCommand,
  CreateJobResponse,
  UpdateJobCommand,
  JobDetailDto,
  CommonActionResponse,
  JobStatusEnum,
} from '@/types/mf01';
import {
  getAllJobs,
  saveJobToAllJobs,
  updateJobStatusInAllJobs,
} from './localStorageService';
import { Job, JobStatus, ServiceType } from '@/types/job';

/**
 * Normalizes a local Job or API response into a standardized JobDetailDto.
 */
export function mapJobToJobDetailDto(job: Job): JobDetailDto {
  const requirements = [
    ...(job.mustHaveTags || []).map((tag) => ({
      requirementType: 'MUST_HAVE',
      content: tag,
      weight: 1.0,
    })),
    ...(job.shouldHaveTags || []).map((tag) => ({
      requirementType: 'SHOULD_HAVE',
      content: tag,
      weight: 0.5,
    })),
    ...(job.requirements || []).map((req) => ({
      requirementType: 'MUST_HAVE',
      content: req,
      weight: 1.0,
    })),
  ];

  return {
    id: job.id,
    jobId: job.id,
    companyId: job.companyId || 'company-001',
    companyName: job.company || 'Doanh nghiệp',
    serviceTypeId: job.serviceType || 'st-001',
    serviceTypeName: job.servicePackage,
    title: job.title,
    description: job.description || '',
    location: job.location,
    employmentType: job.remote ? 'REMOTE' : 'FULL_TIME',
    salaryMin: job.salaryRange?.min,
    salaryMax: job.salaryRange?.max,
    currencyCode: job.salaryRange?.currency || 'VND',
    quantity: job.headcount || 1,
    visibility: 'PUBLIC',
    status: (job.status as unknown as JobStatusEnum) || 'DRAFT',
    requirements,
    requirementCount: requirements.length,
    rejectionReason: (job as { rejectionReason?: string }).rejectionReason || null,
    pauseReason: (job as { pauseReason?: string }).pauseReason || null,
    closeReason: (job as { closeReason?: string }).closeReason || null,
    applicationCount: job.applicationCount || 0,
    shortlistedCount: job.shortlistedCount || 0,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export const jobService = {
  /**
   * GET /api/v1/jobs/mine?status={status}
   * Lấy danh sách Job của doanh nghiệp hiện tại
   */
  async getMyJobs(status?: string): Promise<JobDetailDto[]> {
    try {
      const response = await axiosClient.get<{ data?: JobDetailDto[] } | JobDetailDto[]>(
        '/jobs/mine',
        {
          params: status && status !== 'ALL' ? { status } : undefined,
        }
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
    } catch {
      // Backend offline: fallback to local storage
    }

    const localJobs = getAllJobs();
    let mapped = localJobs.map(mapJobToJobDetailDto);
    if (status && status !== 'ALL') {
      const normalizedStatus = status.toUpperCase();
      mapped = mapped.filter((j) => {
        const jStatus = String(j.status).toUpperCase();
        if (normalizedStatus === 'PENDING_REVIEW') {
          return jStatus === 'PENDING' || jStatus === 'PENDING_REVIEW';
        }
        return jStatus === normalizedStatus;
      });
    }
    return mapped;
  },

  /**
   * GET /api/v1/jobs/{jobId}
   * Lấy chi tiết Job
   */
  async getJobDetail(jobId: string): Promise<JobDetailDto> {
    try {
      const response = await axiosClient.get<{ data?: JobDetailDto } | JobDetailDto>(
        `/jobs/${jobId}`
      );
      const data = response.data;
      if (data && 'id' in data) return data as JobDetailDto;
      if (data && 'data' in data && data.data) return data.data;
    } catch {
      // Fallback
    }

    const localJobs = getAllJobs();
    const found = localJobs.find((j) => j.id === jobId);
    if (found) {
      return mapJobToJobDetailDto(found);
    }
    throw new Error(`Job với ID ${jobId} không tồn tại.`);
  },

  /**
   * POST /api/v1/jobs
   * Tạo bản nháp công việc (CreateJobCommand)
   */
  async createJobDraft(command: CreateJobCommand): Promise<CreateJobResponse> {
    try {
      const response = await axiosClient.post<CreateJobResponse>('/jobs', command);
      if (response.data?.success) {
        return response.data;
      }
    } catch {
      // Backend offline: save locally
    }

    const newId = `job-${Date.now().toString(36)}`;
    const mustHaveTags = (command.requirements || [])
      .filter((r) => r.requirementType === 'MUST_HAVE')
      .map((r) => r.content);
    const shouldHaveTags = (command.requirements || [])
      .filter((r) => r.requirementType === 'SHOULD_HAVE')
      .map((r) => r.content);

    const localJob: Job = {
      id: newId,
      title: command.title,
      company: 'Doanh nghiệp của bạn',
      companyId: 'client-current',
      industryCode: 'tech-software',
      industryLabel: 'Công nghệ',
      serviceType: (command.serviceTypeId as unknown as ServiceType) || ServiceType.HEADHUNT_COD,
      status: JobStatus.DRAFT,
      location: command.location || 'Hồ Chí Minh, Việt Nam',
      remote: command.employmentType === 'REMOTE',
      salaryRange: {
        min: command.salaryMin || 0,
        max: command.salaryMax || 0,
        currency: (command.currencyCode as 'VND' | 'USD' | 'SGD') || 'VND',
        negotiable: true,
      },
      mustHaveTags,
      shouldHaveTags,
      objectives: '',
      engagementTerms: { timeline: 30, commissionRate: 15, retainerFee: 0, budget: 0 },
      description: command.description,
      headcount: command.quantity || 1,
      experienceYears: { min: 1, max: 5 },
      requirements: mustHaveTags,
      clientContactId: 'client-current',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicationCount: 0,
      shortlistedCount: 0,
    };

    saveJobToAllJobs(localJob);

    return {
      success: true,
      message: 'Tạo bản nháp thành công',
      data: {
        jobId: newId,
        companyId: 'client-current',
        serviceTypeId: command.serviceTypeId,
        title: command.title,
        status: 'DRAFT',
        visibility: command.visibility || 'PUBLIC',
        requirementCount: (command.requirements || []).length,
        createdAt: localJob.createdAt,
      },
    };
  },

  /**
   * PUT /api/v1/jobs/{jobId}
   * Cập nhật Job Draft hoặc Job bị từ chối (UpdateJobCommand)
   */
  async updateJob(jobId: string, command: UpdateJobCommand): Promise<JobDetailDto> {
    try {
      const response = await axiosClient.put<{ data?: JobDetailDto } | JobDetailDto>(
        `/jobs/${jobId}`,
        command
      );
      const data = response.data;
      if (data && 'id' in data) return data as JobDetailDto;
      if (data && 'data' in data && data.data) return data.data;
    } catch {
      // Backend offline: update locally
    }

    const localJobs = getAllJobs();
    const existing = localJobs.find((j) => j.id === jobId);
    const mustHaveTags = (command.requirements || [])
      .filter((r) => r.requirementType === 'MUST_HAVE')
      .map((r) => r.content);
    const shouldHaveTags = (command.requirements || [])
      .filter((r) => r.requirementType === 'SHOULD_HAVE')
      .map((r) => r.content);

    const defaultJob: Job = {
      id: jobId,
      title: command.title,
      company: 'Doanh nghiệp',
      companyId: 'client-current',
      industryCode: 'tech-software',
      industryLabel: 'Công nghệ',
      serviceType: (command.serviceTypeId as unknown as ServiceType) || ServiceType.HEADHUNT_COD,
      status: JobStatus.DRAFT,
      location: command.location || 'Hồ Chí Minh',
      remote: command.employmentType === 'REMOTE',
      salaryRange: {
        min: command.salaryMin || 0,
        max: command.salaryMax || 0,
        currency: (command.currencyCode as 'VND' | 'USD' | 'SGD') || 'VND',
        negotiable: true,
      },
      mustHaveTags,
      shouldHaveTags,
      objectives: '',
      engagementTerms: { timeline: 30, commissionRate: 15, retainerFee: 0, budget: 0 },
      description: command.description,
      headcount: command.quantity || 1,
      experienceYears: { min: 1, max: 5 },
      requirements: mustHaveTags,
      clientContactId: 'client-current',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicationCount: 0,
      shortlistedCount: 0,
    };

    const updated: Job = {
      ...(existing || defaultJob),
      title: command.title,
      description: command.description,
      location: command.location || existing?.location || defaultJob.location,
      serviceType: (command.serviceTypeId as unknown as ServiceType) || existing?.serviceType || ServiceType.HEADHUNT_COD,
      salaryRange: {
        min: command.salaryMin || 0,
        max: command.salaryMax || 0,
        currency: (command.currencyCode as 'VND' | 'USD' | 'SGD') || 'VND',
        negotiable: true,
      },
      mustHaveTags,
      shouldHaveTags,
      headcount: command.quantity || 1,
      updatedAt: new Date().toISOString(),
    };

    saveJobToAllJobs(updated);
    return mapJobToJobDetailDto(updated);
  },

  /**
   * POST /api/v1/jobs/{jobId}/submit
   * Gửi Job để Internal HR xét duyệt (No body)
   */
  async submitJob(jobId: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(`/jobs/${jobId}/submit`);
      updateJobStatusInAllJobs(jobId, 'PENDING_REVIEW');
      return response.data || { success: true, message: 'Đã gửi duyệt thành công.' };
    } catch {
      updateJobStatusInAllJobs(jobId, 'PENDING_REVIEW');
      return { success: true, message: 'Đã gửi duyệt thành công.' };
    }
  },

  /**
   * POST /api/v1/jobs/{jobId}/pause
   * Tạm dừng Job đang hoạt động (Body: { reason })
   */
  async pauseJob(jobId: string, reason?: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(`/jobs/${jobId}/pause`, {
        reason: reason || 'Tạm dừng nhận hồ sơ',
      });
      updateJobStatusInAllJobs(jobId, 'PAUSED');
      return response.data || { success: true, message: 'Đã tạm dừng tin tuyển dụng.' };
    } catch {
      updateJobStatusInAllJobs(jobId, 'PAUSED');
      return { success: true, message: 'Đã tạm dừng tin tuyển dụng.' };
    }
  },

  /**
   * POST /api/v1/jobs/{jobId}/resume
   * Tiếp tục Job đang tạm dừng (No body)
   */
  async resumeJob(jobId: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(`/jobs/${jobId}/resume`);
      updateJobStatusInAllJobs(jobId, 'ACTIVE');
      return response.data || { success: true, message: 'Đã mở lại tin tuyển dụng.' };
    } catch {
      updateJobStatusInAllJobs(jobId, 'ACTIVE');
      return { success: true, message: 'Đã mở lại tin tuyển dụng.' };
    }
  },

  /**
   * POST /api/v1/jobs/{jobId}/close
   * Đóng Job (Body: { reason })
   */
  async closeJob(jobId: string, reason?: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(`/jobs/${jobId}/close`, {
        reason: reason || 'Đã tuyển đủ nhân sự',
      });
      updateJobStatusInAllJobs(jobId, 'CLOSED');
      return response.data || { success: true, message: 'Đã đóng tin tuyển dụng.' };
    } catch {
      updateJobStatusInAllJobs(jobId, 'CLOSED');
      return { success: true, message: 'Đã đóng tin tuyển dụng.' };
    }
  },

  /**
   * GET /api/v1/internal/jobs/review
   * Lấy hàng đợi Job chờ xét duyệt
   */
  async getJobsForReview(): Promise<JobDetailDto[]> {
    try {
      const response = await axiosClient.get<{ data?: JobDetailDto[] } | JobDetailDto[]>(
        '/internal/jobs/review'
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
    } catch {
      // Backend offline
    }

    const localJobs = getAllJobs();
    const pendingJobs = localJobs.filter((j) => {
      const s = String(j.status).toUpperCase();
      return s === 'PENDING' || s === 'PENDING_REVIEW';
    });
    return pendingJobs.map(mapJobToJobDetailDto);
  },

  /**
   * POST /api/v1/internal/jobs/{jobId}/approve
   * Duyệt và công bố Job (No body)
   */
  async approveJob(jobId: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(
        `/internal/jobs/${jobId}/approve`
      );
      updateJobStatusInAllJobs(jobId, 'ACTIVE');
      return response.data || { success: true, message: 'Đã duyệt và công bố tin tuyển dụng.' };
    } catch {
      updateJobStatusInAllJobs(jobId, 'ACTIVE');
      return { success: true, message: 'Đã duyệt và công bố tin tuyển dụng.' };
    }
  },

  /**
   * POST /api/v1/internal/jobs/{jobId}/reject
   * Từ chối Job và trả lý do (Body: { reason })
   */
  async rejectJob(jobId: string, reason?: string): Promise<CommonActionResponse> {
    try {
      const response = await axiosClient.post<CommonActionResponse>(
        `/internal/jobs/${jobId}/reject`,
        {
          reason: reason || 'Thông tin tin tuyển dụng chưa đáp ứng tiêu chuẩn kiểm duyệt.',
        }
      );
      updateJobStatusInAllJobs(jobId, 'REJECTED');
      return response.data || { success: true, message: 'Đã từ chối tin tuyển dụng.' };
    } catch {
      // Update with reason locally
      const all = getAllJobs();
      const updated = all.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: JobStatus.REJECTED,
              rejectionReason: reason || 'Thông tin tin tuyển dụng chưa đáp ứng tiêu chuẩn kiểm duyệt.',
              updatedAt: new Date().toISOString(),
            }
          : j
      );
      localStorage.setItem('hrconnect_all_jobs', JSON.stringify(updated));
      return { success: true, message: 'Đã từ chối tin tuyển dụng.' };
    }
  },
};

export default jobService;
