/**
 * @file useSavedJobs.ts
 * @description Hook managing candidate's saved jobs, backed by CandidateSavedJobEndpoints.
 * Supports optimistic updates, live synchronization across components/tabs, and candidate role verification.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { SavedJobDto } from '@/types/api/candidateSavedJobs';

export const SAVED_JOBS_STORAGE_KEY = 'hrconnect_saved_job_ids';
export const SAVED_JOBS_EVENT = 'saved-jobs-updated';
export const SAVED_JOBS_CUSTOM_EVENT = 'hrconnect:saved-jobs-updated';
export const SAVED_JOBS_QUERY_KEY = ['candidate-saved-jobs'] as const;

export interface JobItem {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workMode: 'Hybrid' | 'Remote' | 'On-site' | string;
  level: string;
  salaryMin: number;
  salaryMax: number;
  serviceType?: any;
  commissionRate?: number;
  estimatedCommission?: string;
  tags: string[];
  isUrgent?: boolean;
  deadline?: string;
  aiMatchScore?: number;
  description?: string;
  requirements?: string[];
  [key: string]: any;
}

// Backward compatibility helper stubs
export const getUserSavedJobsKey = (_userKey?: string): string => 'hrconnect_saved_job_ids';
export const getStoredSavedJobIds = (_userKey?: string): string[] => [];
export const setStoredSavedJobIds = (_ids: string[], _userKey?: string): void => {};
export const saveJobToCache = (_job: any): void => {};

export const resolveJobById = (jobId: string): JobItem => {
  const sId = String(jobId || '').trim();
  return {
    id: sId || 'default',
    title: `Cơ hội nghề nghiệp #${sId}`,
    company: 'Doanh nghiệp Tuyển dụng',
    location: 'Toàn quốc',
    workMode: 'Hybrid',
    level: 'Chuyên viên',
    salaryMin: 20000000,
    salaryMax: 40000000,
    tags: ['Công nghệ thông tin'],
  };
};

/**
 * Transforms a SavedJobDto into a compatible JobItem for legacy card consumers
 */
export const savedJobDtoToJobItem = (item: SavedJobDto): JobItem => {
  const job = item.job || {};
  const id = String(job.jobId || item.jobId || item.savedJobId || '');
  return {
    id,
    jobId: id,
    savedJobId: item.savedJobId,
    savedAt: item.savedAt,
    title: job.title || item.title || 'Cơ hội nghề nghiệp',
    company: job.companyName || job.company?.companyName || 'Doanh nghiệp Tuyển dụng',
    companyLogo: job.company?.logoUrl || undefined,
    location: job.location || 'Toàn quốc',
    workMode: job.employmentType || 'Hybrid',
    level: job.minExperienceYears ? `${job.minExperienceYears}+ năm kinh nghiệm` : 'Chuyên viên',
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    currencyCode: job.currencyCode || 'VND',
    tags: Array.isArray(job.skills) ? job.skills : [],
    status: job.status || 'ACTIVE',
    applicationDeadline: job.applicationDeadline,
    isAcceptingApplications: job.isAcceptingApplications ?? (job.status === 'ACTIVE'),
    deadline: job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('vi-VN') : undefined,
    job: job,
  };
};

/**
 * Custom Hook useSavedJobs - Single Source of Truth for Candidate Bookmarked Jobs.
 */
export const useSavedJobs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasAnyRole } = useAuthStore();
  const isCandidate = Boolean(user && hasAnyRole([UserRole.CANDIDATE]));

  // React Query fetch for authenticated Candidate
  const {
    data: savedJobPage,
    isLoading: isQueryLoading,
    refetch,
  } = useQuery({
    queryKey: SAVED_JOBS_QUERY_KEY,
    queryFn: () => candidateSavedJobApi.getSavedJobs({ page: 1, pageSize: 100 }),
    enabled: isCandidate,
    staleTime: 30000,
  });

  // Local optimistic ID list
  const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);

  // Sync server data into local saved IDs
  useEffect(() => {
    if (!isCandidate) {
      setLocalSavedIds([]);
      return;
    }
    if (savedJobPage?.items) {
      const ids = savedJobPage.items
        .map((item) => String(item.job?.jobId || item.jobId || item.savedJobId || '').trim())
        .filter(Boolean);
      setLocalSavedIds(ids);
    }
  }, [isCandidate, savedJobPage]);

  // Synchronize with external CustomEvents
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setLocalSavedIds(customEvent.detail);
      } else if (isCandidate) {
        refetchRef.current();
      }
    };

    window.addEventListener(SAVED_JOBS_EVENT, handleUpdate);
    window.addEventListener(SAVED_JOBS_CUSTOM_EVENT, handleUpdate);

    return () => {
      window.removeEventListener(SAVED_JOBS_EVENT, handleUpdate);
      window.removeEventListener(SAVED_JOBS_CUSTOM_EVENT, handleUpdate);
    };
  }, [isCandidate]);

  const isSaved = useCallback(
    (jobId: string): boolean => {
      if (!jobId || !Array.isArray(localSavedIds)) return false;
      return localSavedIds.includes(String(jobId).trim());
    },
    [localSavedIds]
  );

  const toggleSaveJob = useCallback(
    async (job: any): Promise<boolean> => {
      if (!job) return false;
      const jobId =
        typeof job === 'string'
          ? String(job).trim()
          : String(job?.jobId || job?.id || '').trim();

      if (!jobId) return false;

      // Guest / Non-candidate check: redirect to login
      if (!user || !isCandidate) {
        message.info('Vui lòng đăng nhập tài khoản Ứng viên để lưu việc làm.');
        const returnUrl = encodeURIComponent(
          typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
        );
        if (navigate) {
          navigate(`/login?redirect=${returnUrl}`);
        } else if (typeof window !== 'undefined') {
          window.location.href = `/login?redirect=${returnUrl}`;
        }
        return false;
      }

      const alreadySaved = localSavedIds.includes(jobId);
      const nextIds = alreadySaved
        ? localSavedIds.filter((id) => id !== jobId)
        : [...localSavedIds, jobId];

      // Optimistic update
      setLocalSavedIds(nextIds);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SAVED_JOBS_CUSTOM_EVENT, { detail: nextIds }));
        window.dispatchEvent(new Event(SAVED_JOBS_EVENT));
      }

      try {
        if (alreadySaved) {
          await candidateSavedJobApi.unsaveJob(jobId);
          message.info('Đã bỏ lưu việc làm');
        } else {
          await candidateSavedJobApi.saveJob(jobId);
          message.success('Đã lưu việc làm vào danh sách!');
        }

        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: SAVED_JOBS_QUERY_KEY });
        }
        return !alreadySaved;
      } catch (err) {
        // Rollback optimistic update on error
        setLocalSavedIds(localSavedIds);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(SAVED_JOBS_CUSTOM_EVENT, { detail: localSavedIds }));
        }
        message.error(getApiErrorMessage(err, 'Không thể cập nhật trạng thái lưu việc làm.'));
        return alreadySaved;
      }
    },
    [user, isCandidate, localSavedIds, navigate, queryClient]
  );

  const toggleSave = useCallback(
    (jobId: string, _jobTitle?: string): boolean => {
      const alreadySaved = isSaved(jobId);
      void toggleSaveJob(jobId);
      return !alreadySaved;
    },
    [isSaved, toggleSaveJob]
  );

  const savedJobs: JobItem[] = useMemo(() => {
    if (!savedJobPage?.items) return [];
    return savedJobPage.items.map(savedJobDtoToJobItem);
  }, [savedJobPage]);

  return {
    savedJobIds: localSavedIds,
    savedJobs,
    rawSavedJobs: savedJobPage?.items || [],
    savedJobsCount: localSavedIds.length,
    isLoading: isCandidate && isQueryLoading,
    isSaved,
    toggleSaveJob,
    toggleSave,
    refetch,
  };
};

export default useSavedJobs;
