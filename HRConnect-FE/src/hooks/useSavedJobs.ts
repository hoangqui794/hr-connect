import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
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
 * 2 công việc mẫu mặc định theo yêu cầu:
 * - ID 1: "Kỹ sư Backend Java Final"
 * - ID 2: "Kỹ sư Backend Java cấp cao lần 2"
 */
export const DEFAULT_MOCK_SAVED_JOBS: JobItem[] = [
  {
    id: '1',
    title: 'Kỹ sư Backend Java Final',
    company: 'TechCorp Enterprise Solutions',
    companyLogo: '',
    location: 'TP. Hồ Chí Minh',
    workMode: 'Hybrid',
    level: 'Senior',
    salaryMin: 45000000,
    salaryMax: 70000000,
    serviceType: 'HEADHUNT_COD',
    commissionRate: 18,
    estimatedCommission: '12.600.000₫',
    tags: ['Java Spring Boot', 'Kafka', 'PostgreSQL', 'Microservices', 'Docker'],
    isUrgent: true,
    deadline: 'Còn 5 ngày',
    aiMatchScore: 96,
  },
  {
    id: '2',
    title: 'Kỹ sư Backend Java cấp cao lần 2',
    company: 'DigitalWave FinTech Agency',
    companyLogo: '',
    location: 'Hà Nội',
    workMode: 'Remote',
    level: 'Senior',
    salaryMin: 40000000,
    salaryMax: 65000000,
    serviceType: 'HEADHUNT_COD',
    commissionRate: 16,
    estimatedCommission: '10.400.000₫',
    tags: ['Java', 'Spring Cloud', 'Redis', 'Kubernetes', 'CI/CD'],
    isUrgent: true,
    deadline: 'Còn 10 ngày',
    aiMatchScore: 92,
  },
];

const DEFAULT_SAVED_JOB_IDS: string[] = ['1', '2'];

/**
 * Helper cache các JobItem chi tiết vào localStorage để không bị mất dữ liệu
 */
export const saveJobToCache = (job: JobItem) => {
  try {
    const raw = localStorage.getItem(SAVED_JOBS_CACHE_KEY);
    const cache: Record<string, JobItem> = raw ? JSON.parse(raw) : {};
    cache[String(job.id)] = job;
    localStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

/**
 * Đọc danh sách Job IDs đã lưu từ localStorage key "hrconnect_saved_job_ids"
 */
export const getStoredSavedJobIds = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_JOBS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }

    // Fallback: kiểm tra key cũ nếu có
    const legacyRaw = localStorage.getItem(LEGACY_SAVED_JOBS_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const legacyIds = parsed.map(String);
        localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(legacyIds));
        return legacyIds;
      }
    }
  } catch (err) {
    console.error('Error reading saved job IDs from localStorage:', err);
  }

  // Khởi tạo mặc định 2 job mẫu nếu chưa có dữ liệu
  try {
    localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(DEFAULT_SAVED_JOB_IDS));
    localStorage.setItem(LEGACY_SAVED_JOBS_KEY, JSON.stringify(DEFAULT_SAVED_JOB_IDS));
  } catch {}
  return DEFAULT_SAVED_JOB_IDS;
};

/**
 * Tìm Job chi tiết từ ID qua các nguồn dữ liệu mẫu và cache
 */
export const resolveJobById = (jobId: string): JobItem => {
  const sId = String(jobId).trim();

  // 1. Kiểm tra 2 job mẫu mặc định
  const defaultFound = DEFAULT_MOCK_SAVED_JOBS.find((j) => String(j.id) === sId);
  if (defaultFound) return defaultFound;

  // 2. Kiểm tra cache localStorage
  try {
    const raw = localStorage.getItem(SAVED_JOBS_CACHE_KEY);
    if (raw) {
      const cache: Record<string, JobItem> = JSON.parse(raw);
      if (cache[sId]) return cache[sId];
    }
  } catch {}

  // 3. Kiểm tra FEATURED_HOT_JOBS
  const hotFound = FEATURED_HOT_JOBS.find((j) => String(j.id) === sId);
  if (hotFound) {
    return {
      id: hotFound.id,
      title: hotFound.title,
      company: hotFound.company,
      companyLogo: hotFound.companyLogo,
      location: hotFound.location,
      workMode: hotFound.workMode,
      level: hotFound.level,
      salaryMin: hotFound.salaryMin,
      salaryMax: hotFound.salaryMax,
      serviceType: hotFound.serviceType,
      commissionRate: hotFound.commissionRate,
      estimatedCommission: hotFound.estimatedCommission,
      tags: hotFound.tags,
      isUrgent: hotFound.isUrgent,
      deadline: hotFound.deadline,
      aiMatchScore: hotFound.aiMatchScore,
    };
  }

  // 4. Kiểm tra MOCK_JOBS
  const mockFound = MOCK_JOBS.find((j) => String(j.id) === sId);
  if (mockFound) {
    return {
      id: mockFound.id,
      title: mockFound.title,
      company: mockFound.company,
      location: mockFound.location,
      workMode: mockFound.remote ? 'Remote' : 'Hybrid',
      level: 'Senior',
      salaryMin: mockFound.salaryRange?.min || 25000000,
      salaryMax: mockFound.salaryRange?.max || 50000000,
      serviceType: mockFound.serviceType || 'HEADHUNT_COD',
      commissionRate: mockFound.engagementTerms?.commissionRate || 15,
      estimatedCommission: `${Math.round(((mockFound.salaryRange?.max || 50000000) * (mockFound.engagementTerms?.commissionRate || 15)) / 100).toLocaleString('vi-VN')}₫`,
      tags: [...(mockFound.mustHaveTags || []), ...(mockFound.shouldHaveTags || [])],
      isUrgent: true,
      description: mockFound.description,
      requirements: mockFound.requirements,
    };
  }

  // 5. Kiểm tra hrconnect_all_jobs trong localStorage nếu có
  try {
    const rawAll = localStorage.getItem('hrconnect_all_jobs');
    if (rawAll) {
      const parsedAll = JSON.parse(rawAll);
      if (Array.isArray(parsedAll)) {
        const found = parsedAll.find((j: any) => String(j.id) === sId);
        if (found) {
          const salaryMax = found.salaryRange?.max || found.salaryMax || 50000000;
          const commRate = found.engagementTerms?.commissionRate || found.commissionRate || 15;
          const estComm = found.estimatedCommission || `${Math.round((salaryMax * commRate) / 100).toLocaleString('vi-VN')}₫`;
          return {
            id: found.id,
            title: found.title,
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
            tags: found.tags || [...(found.mustHaveTags || []), ...(found.shouldHaveTags || [])],
            isUrgent: true,
            deadline: found.deadline || 'Còn 15 ngày',
            aiMatchScore: found.aiMatchScore || 90,
          };
        }
      }
    }
  } catch {}

  // 6. Fallback tạo thông tin chuẩn hiển thị thay vì lỗi
  return {
    id: sId,
    title: `Kỹ sư Phần mềm Chuyên nghiệp #${sId}`,
    company: 'Doanh nghiệp Công nghệ Đối tác',
    location: 'TP. Hồ Chí Minh',
    workMode: 'Hybrid',
    level: 'Senior',
    salaryMin: 35000000,
    salaryMax: 65000000,
    serviceType: 'HEADHUNT_COD',
    commissionRate: 15,
    estimatedCommission: '9.750.000₫',
    tags: ['Fullstack', 'TypeScript', 'Node.js', 'PostgreSQL'],
    isUrgent: true,
    deadline: 'Còn 10 ngày',
    aiMatchScore: 90,
  };
};

/**
 * Custom Hook useSavedJobs - Single Source of Truth
 */
export const useSavedJobs = () => {
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => getStoredSavedJobIds());

  // Đồng bộ thời gian thực qua CustomEvent & storage event giữa các tabs/components
  useEffect(() => {
    const handleUpdate = () => {
      setSavedJobIds(getStoredSavedJobIds());
    };

    window.addEventListener(SAVED_JOBS_EVENT, handleUpdate);
    window.addEventListener('hrconnect:saved-jobs-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(SAVED_JOBS_EVENT, handleUpdate);
      window.removeEventListener('hrconnect:saved-jobs-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isSaved = useCallback(
    (jobId: string): boolean => {
      return savedJobIds.includes(String(jobId).trim());
    },
    [savedJobIds]
  );

  const toggleSaveJob = useCallback((job: JobItem | string | FeaturedJobItem) => {
    const jobId = typeof job === 'string' ? String(job).trim() : String((job as any).id || (job as any).jobId).trim();
    if (!jobId) return;

    const currentList = getStoredSavedJobIds();
    const exists = currentList.includes(jobId);

    let nextList: string[];
    if (exists) {
      nextList = currentList.filter((id) => id !== jobId);
      message.info('Đã bỏ lưu việc làm');
    } else {
      nextList = [...currentList, jobId];
      message.success('Đã lưu việc làm vào danh sách!');
      if (typeof job === 'object') {
        saveJobToCache(job as JobItem);
      }
    }

    // 1. Lưu vào localStorage key chuẩn
    try {
      localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(nextList));
      localStorage.setItem(LEGACY_SAVED_JOBS_KEY, JSON.stringify(nextList));
    } catch (err) {
      console.error('Failed to write saved jobs to localStorage:', err);
    }

    // 2. Cập nhật state local
    setSavedJobIds(nextList);

    // 3. Tự động bắn event đồng bộ toàn app mà không cần F5
    window.dispatchEvent(new Event(SAVED_JOBS_EVENT));
    window.dispatchEvent(new CustomEvent('hrconnect:saved-jobs-updated', { detail: nextList }));
  }, []);

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
    return savedJobIds.map((id) => resolveJobById(id));
  }, [savedJobIds]);

  return {
    savedJobIds,
    savedJobs,
    savedJobsCount: savedJobIds.length,
    isSaved,
    toggleSaveJob,
    toggleSave,
  };
};

export default useSavedJobs;
