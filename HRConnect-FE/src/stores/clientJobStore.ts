/**
 * @file clientJobStore.ts
 * @description Lightweight localStorage helper for client-posted jobs.
 * Stores pending jobs submitted by Client users, awaiting HR approval.
 *
 * localStorage key: 'hrconnect_client_jobs'
 *
 * Flow:
 *   1. Client submits CreateJobWizard → saveClientJob() with status: 'PENDING'
 *   2. HR opens /hr/jobs → getClientJobs() merges PENDING jobs to top of list
 *   3. HR approves → updateClientJobStatus(id, 'ACTIVE') persists the change
 */

import { ServiceType } from '@/types/job';

export const CLIENT_JOBS_KEY = 'hrconnect_client_jobs';

export type ClientJobStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface ClientPostedJob {
  /** Prefixed 'client-job-<timestamp>' */
  id: string;
  title: string;
  company: string;
  companyId: string;
  industryCode: string;
  industryLabel: string;
  serviceType: ServiceType;
  /** PENDING = chờ HR phê duyệt, ACTIVE = đã phê duyệt, REJECTED = bị từ chối */
  status: ClientJobStatus;
  location: string;
  remote: boolean;
  salaryRange: {
    min: number;
    max: number;
    currency: 'VND' | 'USD' | 'SGD';
    negotiable: boolean;
  };
  mustHaveTags: string[];
  shouldHaveTags: string[];
  objectives: string;
  description: string;
  headcount: number;
  experienceYears: { min: number; max: number };
  engagementTerms: {
    timeline: number;
    commissionRate: number;
    retainerFee?: number;
    budget?: number;
  };
  requirements: string[];
  clientContactId: string;
  applicationCount: number;
  shortlistedCount: number;
  createdAt: string;
  updatedAt: string;
  /** Tên người đăng (từ user.name của Client đang đăng nhập) */
  postedByName?: string;
  /** Email người đăng */
  postedByEmail?: string;
  clientId?: string;
  clientEmail?: string;
  deadline?: string;
}

// ─── CRUD helpers ──────────────────────────────────────────────────────────────

export const getClientJobs = (): ClientPostedJob[] => {
  try {
    const raw = localStorage.getItem(CLIENT_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveClientJob = (job: ClientPostedJob): void => {
  try {
    const existing = getClientJobs();
    // Deduplicate by id
    const idx = existing.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      existing[idx] = job;
    } else {
      existing.unshift(job); // prepend so newest appears first
    }
    localStorage.setItem(CLIENT_JOBS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save client job:', err);
  }
};

export const updateClientJobStatus = (id: string, status: ClientJobStatus): void => {
  try {
    const jobs = getClientJobs();
    const updated = jobs.map((j) =>
      j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j
    );
    localStorage.setItem(CLIENT_JOBS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update client job status:', err);
  }
};

export const deleteClientJob = (id: string): void => {
  try {
    const jobs = getClientJobs().filter((j) => j.id !== id);
    localStorage.setItem(CLIENT_JOBS_KEY, JSON.stringify(jobs));
  } catch {/* noop */}
};
