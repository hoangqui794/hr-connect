import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { MOCK_JOBS } from '@/services/mockData';

export const SAVED_JOBS_STORAGE_KEY = 'hrconnect_saved_job_ids';
export const SAVED_JOBS_EVENT = 'saved-jobs-updated';
const LEGACY_SAVED_JOBS_KEY = 'hrconnect_saved_jobs';
const SAVED_JOBS_CACHE_KEY = 'hrconnect_saved_jobs_cache';

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

/**
 * Resolve client-side storage key scoped per authenticated user ID / email
 */
export const getUserSavedJobsKey = (userKey?: string): string => {
  if (userKey && typeof userKey === 'string' && userKey.trim()) {
    const clean = userKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `hrconnect_saved_job_ids_${clean}`;
  }
  return 'hrconnect_saved_job_ids_guest';
};

/**
 * Clean up legacy hardcoded mock job IDs ('1' and '2', etc.) and invalid items
 */
const filterOutMockIds = (ids: any[]): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string' || typeof item === 'number') {
        const s = String(item).trim();
        return s === '[object Object]' ? '' : s;
      }
      if (typeof item === 'object') {
        const id = item?.jobId || item?.id;
        return id ? String(id).trim() : '';
      }
      return '';
    })
    .filter(
      (id) =>
        id &&
        id !== '1' &&
        id !== '2' &&
        id !== 'job-hot-003' &&
        id !== 'job-hot-005' &&
        id !== '[object Object]'
    );
};

// Immediate cleanup of any stale mock saved jobs from localStorage
if (typeof window !== 'undefined') {
  try {
    const keysToCheck = [
      SAVED_JOBS_STORAGE_KEY,
      LEGACY_SAVED_JOBS_KEY,
      'hrconnect_saved_job_ids_guest',
    ];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hrconnect_saved_job')) {
        keysToCheck.push(k);
      }
    }
    Array.from(new Set(keysToCheck)).forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = filterOutMockIds(parsed);
            if (cleaned.length !== parsed.length) {
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          }
        } catch {}
      }
    });

    const rawCache = localStorage.getItem(SAVED_JOBS_CACHE_KEY);
    if (rawCache) {
      try {
        const cache = JSON.parse(rawCache);
        if (cache && typeof cache === 'object') {
          if (cache['1'] || cache['2']) {
            delete cache['1'];
            delete cache['2'];
            localStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(cache));
          }
        }
      } catch {}
    }
  } catch {}
}

/**
 * Helper cache các JobItem chi tiết vào localStorage để không bị mất dữ liệu
 */
export const saveJobToCache = (job: JobItem) => {
  if (!job || !job.id) return;
  try {
    const raw = localStorage.getItem(SAVED_JOBS_CACHE_KEY);
    const cache: Record<string, JobItem> = raw ? JSON.parse(raw) : {};
    if (cache && typeof cache === 'object') {
      cache[String(job.id)] = job;
      localStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {}
};

/**
 * Đọc danh sách Job IDs đã lưu từ localStorage theo user ID.
 * Với tài khoản mới (hoặc chưa có bookmark), trả về mảng rỗng []!
 */
export const getStoredSavedJobIds = (userKey?: string): string[] => {
  const resolvedKey = getUserSavedJobsKey(userKey);

  try {
    // 1. Kiểm tra key riêng của user
    const raw = localStorage.getItem(resolvedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return filterOutMockIds(parsed);
      }
    }

    // 2. Dọn dẹp key cũ nếu vô tình chứa '1' và '2'
    const legacyRaw = localStorage.getItem(SAVED_JOBS_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        const cleanedLegacy = filterOutMockIds(parsedLegacy);
        if (cleanedLegacy.length !== parsedLegacy.length) {
          localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(cleanedLegacy));
        }
      }
    }
  } catch (err) {
    console.error('Error reading saved job IDs from localStorage:', err);
  }

  // Khởi tạo mặc định mảng rỗng [] cho tài khoản mới
  return [];
};

/**
 * Ghi danh sách Job IDs vào localStorage theo user ID
 */
export const setStoredSavedJobIds = (ids: string[], userKey?: string) => {
  const resolvedKey = getUserSavedJobsKey(userKey);
  const cleaned = filterOutMockIds(Array.isArray(ids) ? ids : []);
  try {
    localStorage.setItem(resolvedKey, JSON.stringify(cleaned));
    localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Failed to write saved jobs to localStorage:', err);
  }
};

/**
 * Tìm Job chi tiết từ ID qua các nguồn dữ liệu cache và mock chuẩn
 */
export const resolveJobById = (jobId: string): JobItem => {
  const sId = String(jobId || '').trim();
  if (!sId) {
    return {
      id: 'default',
      title: 'Cơ hội nghề nghiệp',
      company: 'Doanh nghiệp Tuyển dụng',
      location: 'Toàn quốc',
      workMode: 'Hybrid',
      level: 'Chuyên viên',
      salaryMin: 20000000,
      salaryMax: 40000000,
      tags: ['Công nghệ thông tin'],
    };
  }

  // 1. Kiểm tra cache localStorage
  try {
    const raw = localStorage.getItem(SAVED_JOBS_CACHE_KEY);
    if (raw) {
      const cache: Record<string, JobItem> = JSON.parse(raw);
      if (cache && typeof cache === 'object' && cache[sId]) {
        return {
          ...cache[sId],
          tags: Array.isArray(cache[sId].tags) ? cache[sId].tags : [],
        };
      }
    }
  } catch {}

  // 2. Kiểm tra FEATURED_HOT_JOBS
  const hotFound = (FEATURED_HOT_JOBS || []).find((j) => String(j?.id) === sId);
  if (hotFound) {
    return {
      id: hotFound.id,
      title: hotFound.title || '',
      company: hotFound.company || '',
      companyLogo: hotFound.companyLogo,
      location: hotFound.location || '',
      workMode: hotFound.workMode || 'Hybrid',
      level: hotFound.level || 'Chuyên viên',
      salaryMin: hotFound.salaryMin || 20000000,
      salaryMax: hotFound.salaryMax || 40000000,
      serviceType: hotFound.serviceType,
      commissionRate: hotFound.commissionRate,
      estimatedCommission: hotFound.estimatedCommission,
      tags: Array.isArray(hotFound.tags) ? hotFound.tags : [],
      isUrgent: hotFound.isUrgent,
      deadline: hotFound.deadline,
      aiMatchScore: hotFound.aiMatchScore,
    };
  }

  // 3. Kiểm tra MOCK_JOBS
  const mockFound = (MOCK_JOBS || []).find((j) => String(j?.id) === sId);
  if (mockFound) {
    return {
      id: mockFound.id,
      title: mockFound.title || '',
      company: mockFound.company || '',
      companyLogo: (mockFound as any)?.companyLogo,
      location: mockFound.location || '',
      workMode: mockFound.remote ? 'Remote' : 'Hybrid',
      level: 'Senior',
      salaryMin: mockFound.salaryRange?.min || 25000000,
      salaryMax: mockFound.salaryRange?.max || 50000000,
      serviceType: mockFound.serviceType || 'HEADHUNT_COD',
      commissionRate: mockFound.engagementTerms?.commissionRate || 15,
      estimatedCommission: `${Math.round(((mockFound.salaryRange?.max || 50000000) * (mockFound.engagementTerms?.commissionRate || 15)) / 100).toLocaleString('vi-VN')}₫`,
      tags: [
        ...(Array.isArray(mockFound.mustHaveTags) ? mockFound.mustHaveTags : []),
        ...(Array.isArray(mockFound.shouldHaveTags) ? mockFound.shouldHaveTags : []),
      ],
      isUrgent: true,
      description: mockFound.description,
      requirements: Array.isArray(mockFound.requirements) ? mockFound.requirements : [],
    };
  }

  // 4. Kiểm tra hrconnect_all_jobs trong localStorage nếu có
  try {
    const rawAll = localStorage.getItem('hrconnect_all_jobs');
    if (rawAll) {
      const parsedAll = JSON.parse(rawAll);
      if (Array.isArray(parsedAll)) {
        const found = parsedAll.find((j: any) => String(j?.id) === sId);
        if (found) {
          const salaryMax = found?.salaryRange?.max || found?.salaryMax || 50000000;
          const commRate = found?.engagementTerms?.commissionRate || found?.commissionRate || 15;
          const estComm = found?.estimatedCommission || `${Math.round((salaryMax * commRate) / 100).toLocaleString('vi-VN')}₫`;
          const tags = Array.isArray(found?.tags)
            ? found.tags
            : [
                ...(Array.isArray(found?.mustHaveTags) ? found.mustHaveTags : []),
                ...(Array.isArray(found?.shouldHaveTags) ? found.shouldHaveTags : []),
              ];
          return {
            id: found.id,
            title: found.title || `Cơ hội nghề nghiệp #${sId}`,
            company: found.company || 'Doanh nghiệp Công nghệ Đối tác',
            companyLogo: found.companyLogo || '',
            location: found.location || 'TP. Hồ Chí Minh',
            workMode: found.remote ? 'Remote' : (found.workMode || 'Hybrid'),
            level: found.level || 'Senior',
            salaryMin: found.salaryRange?.min || found.salaryMin || 25000000,
            salaryMax: salaryMax,
            serviceType: found.serviceType || 'HEADHUNT_COD',
            commissionRate: commRate,
            estimatedCommission: estComm,
            tags: tags.length > 0 ? tags : ['Công nghệ thông tin'],
            isUrgent: true,
            deadline: found.deadline || 'Còn 15 ngày',
            aiMatchScore: found.aiMatchScore || 90,
          };
        }
      }
    }
  } catch {}

  // 5. Fallback tạo thông tin chuẩn hiển thị thay vì lỗi
  return {
    id: sId,
    title: `Cơ hội nghề nghiệp #${sId}`,
    company: 'Doanh nghiệp Tuyển dụng',
    location: 'Toàn quốc',
    workMode: 'Hybrid',
    level: 'Chuyên viên',
    salaryMin: 20000000,
    salaryMax: 40000000,
    serviceType: 'HEADHUNT_COD',
    commissionRate: 15,
    estimatedCommission: '4.500.000₫',
    tags: ['Công nghệ thông tin'],
    isUrgent: false,
    deadline: 'Đang mở tuyển',
    aiMatchScore: 85,
  };
};

/**
 * Custom Hook useSavedJobs - Single Source of Truth cho Bookmarked Jobs
 */
export const useSavedJobs = () => {
  const { user } = useAuthStore();
  const userKey = user?.id || user?.email || '';

  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => {
    try {
      return getStoredSavedJobIds(userKey) || [];
    } catch {
      return [];
    }
  });

  // Khi user đổi (đăng nhập hoặc chuyển tài khoản), load lại danh sách bookmark của user đó
  useEffect(() => {
    try {
      setSavedJobIds(getStoredSavedJobIds(userKey) || []);
    } catch {
      setSavedJobIds([]);
    }
  }, [userKey]);

  // Đồng bộ thời gian thực qua CustomEvent & storage event giữa các tabs/components
  useEffect(() => {
    const handleUpdate = () => {
      try {
        setSavedJobIds(getStoredSavedJobIds(userKey) || []);
      } catch {
        setSavedJobIds([]);
      }
    };

    window.addEventListener(SAVED_JOBS_EVENT, handleUpdate);
    window.addEventListener('hrconnect:saved-jobs-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(SAVED_JOBS_EVENT, handleUpdate);
      window.removeEventListener('hrconnect:saved-jobs-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [userKey]);

  const isSaved = useCallback(
    (jobId: string): boolean => {
      if (!jobId || !Array.isArray(savedJobIds)) return false;
      return savedJobIds.includes(String(jobId).trim());
    },
    [savedJobIds]
  );

  const toggleSaveJob = useCallback(
    (job: JobItem | string | FeaturedJobItem) => {
      if (!job) return;
      const jobId =
        typeof job === 'string'
          ? String(job).trim()
          : String((job as any)?.id || (job as any)?.jobId || '').trim();
      if (!jobId) return;

      const currentList = Array.isArray(getStoredSavedJobIds(userKey))
        ? getStoredSavedJobIds(userKey)
        : [];
      const exists = currentList.includes(jobId);

      let nextList: string[];
      if (exists) {
        nextList = currentList.filter((id) => id !== jobId);
        message.info('Đã bỏ lưu việc làm');
      } else {
        nextList = [...currentList, jobId];
        message.success('Đã lưu việc làm vào danh sách!');
        if (typeof job === 'object' && job !== null) {
          saveJobToCache(job as JobItem);
        }
      }

      // Lưu vào storage theo user ID
      setStoredSavedJobIds(nextList, userKey);

      // Cập nhật state local
      setSavedJobIds(nextList);

      // Tự động bắn event đồng bộ toàn app mà không cần F5
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SAVED_JOBS_EVENT));
        window.dispatchEvent(new CustomEvent('hrconnect:saved-jobs-updated', { detail: nextList }));
      }
    },
    [userKey]
  );

  // Alias toggleSave giữ tương thích với các component cũ
  const toggleSave = useCallback(
    (jobId: string, _jobTitle?: string): boolean => {
      const alreadySaved = isSaved(jobId);
      toggleSaveJob(jobId);
      return !alreadySaved;
    },
    [isSaved, toggleSaveJob]
  );

  // Danh sách JobItem hoàn chỉnh của các job đã lưu
  const savedJobs = useMemo(() => {
    if (!Array.isArray(savedJobIds)) return [];
    return savedJobIds
      .filter(Boolean)
      .map((id) => resolveJobById(id))
      .filter(Boolean);
  }, [savedJobIds]);

  return {
    savedJobIds: savedJobIds || [],
    savedJobs: savedJobs || [],
    savedJobsCount: (savedJobIds || []).length,
    isSaved,
    toggleSaveJob,
    toggleSave,
  };
};

export default useSavedJobs;
