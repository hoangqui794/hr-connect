/**
 * @file applicationStore.ts
 * @description Shared application store for HRConnect.
 * Provides a single source of truth for ALL candidate applications submitted via:
 *  - Candidate self-apply (DIRECT source)
 *  - Affiliate referral submission (AFFILIATE source)
 *
 * Stored in localStorage with key: `hrconnect_candidate_applications`
 *
 * Consumed by:
 *  - /hr/candidates  (CandidateList)
 *  - /hr/screening   (AIScreening)
 *  - /hr/jobs        (JobListTable candidate drawer)
 *  - /candidate/dashboard (CandidateDashboard)
 *  - /client/interviews-offers (ClientInterviewsOffersPage)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ApplicationSource = 'DIRECT' | 'AFFILIATE';

export type ApplicationStatus =
  | 'APPLIED'
  | 'PENDING_HR_REVIEW'
  | 'SCREENING'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_PASSED'
  | 'INTERVIEW_FAILED'
  | 'OFFERED'
  | 'ONBOARDED'
  | 'REJECTED';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Đã nộp hồ sơ',
  PENDING_HR_REVIEW: 'Chờ HR xem xét',
  SCREENING: 'Đang sàng lọc AI',
  INTERVIEW_SCHEDULED: 'Đã lên lịch phỏng vấn',
  INTERVIEW_PASSED: 'Đạt phỏng vấn',
  INTERVIEW_FAILED: 'Không đạt phỏng vấn',
  OFFERED: 'Đã nhận Offer',
  ONBOARDED: 'Đã nhận việc (Onboard)',
  REJECTED: 'Đã từ chối',
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  APPLIED: '#0284c7',
  PENDING_HR_REVIEW: '#d97706',
  SCREENING: '#8b5cf6',
  INTERVIEW_SCHEDULED: '#f59e0b',
  INTERVIEW_PASSED: '#10b981',
  INTERVIEW_FAILED: '#ef4444',
  OFFERED: '#059669',
  ONBOARDED: '#065f46',
  REJECTED: '#64748b',
};

export interface CandidateApplicationRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  jobId: string;
  jobTitle: string;
  company: string;
  /** 'DIRECT' = ứng viên tự nộp, 'AFFILIATE' = CTV giới thiệu */
  source: ApplicationSource;
  affiliateName?: string;
  affiliateEmail?: string;
  firstSubmissionTimestamp?: string;
  candidateId?: string;
  cvUrl?: string;
  cvFileName?: string;
  currentTitle?: string;
  salaryExpectation?: number;
  notes?: string;
  candidateSourceType?: 'TALENT_POOL' | 'EXTERNAL_UPLOAD';
  applyDate: string;
  /** AI match score 0–100 */
  aiScore: number;
  status: ApplicationStatus;
  /** Google Meet link or room address when interview is scheduled */
  interviewLink?: string;
  interviewTime?: string;
  interviewerName?: string;
  /** Offer details */
  offerSalary?: string;
  offerDate?: string;
  onboardDate?: string;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface ApplicationState {
  applications: CandidateApplicationRecord[];

  /** Add a new application record (prevents duplicate by email+jobId). Defaults to 'APPLIED' if status is omitted. */
  addApplication: (record: Omit<CandidateApplicationRecord, 'id' | 'applyDate' | 'aiScore' | 'status'> & {
    aiScore?: number;
    status?: ApplicationStatus;
  }) => CandidateApplicationRecord;

  /** Update status of a specific application */
  updateApplicationStatus: (
    id: string,
    status: ApplicationStatus,
    extra?: Partial<CandidateApplicationRecord>
  ) => void;

  /** Get all applications for a given candidate email */
  getByEmail: (email: string) => CandidateApplicationRecord[];

  /** Get all applications for a given job */
  getByJobId: (jobId: string) => CandidateApplicationRecord[];

  /** Get all applications */
  getAll: () => CandidateApplicationRecord[];

  /** Clear all (for dev/reset) */
  clearAll: () => void;
}

// Generate AI score between 85-90 by default for demo quality
function randomAiScore(): number {
  return Math.floor(Math.random() * 6) + 85; // 85..90
}

export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set, get) => ({
      applications: [],

      addApplication: (record) => {
        const existing = get().applications.find(
          (a) =>
            a.email.toLowerCase() === record.email.toLowerCase() &&
            a.jobId === record.jobId
        );
        if (existing) return existing;

        const nowIso = new Date().toISOString();
        const newRecord: CandidateApplicationRecord = {
          id: `app-shared-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fullName: record.fullName,
          email: record.email.toLowerCase().trim(),
          phone: record.phone,
          jobId: record.jobId,
          jobTitle: record.jobTitle,
          company: record.company,
          source: record.source,
          affiliateName: record.affiliateName,
          affiliateEmail: record.affiliateEmail,
          firstSubmissionTimestamp: record.firstSubmissionTimestamp ?? nowIso,
          candidateId: record.candidateId,
          cvUrl: record.cvUrl,
          cvFileName: record.cvFileName,
          currentTitle: record.currentTitle,
          salaryExpectation: record.salaryExpectation,
          notes: record.notes,
          candidateSourceType: record.candidateSourceType,
          applyDate: nowIso,
          aiScore: record.aiScore ?? randomAiScore(),
          status: record.status ?? 'APPLIED',
        };

        set((state) => ({
          applications: [newRecord, ...state.applications],
        }));

        return newRecord;
      },

      updateApplicationStatus: (id, status, extra) => {
        set((state) => ({
          applications: state.applications.map((a) =>
            a.id === id ? { ...a, status, ...extra } : a
          ),
        }));
      },

      getByEmail: (email) => {
        const normalized = email.toLowerCase().trim();
        return get().applications.filter(
          (a) => a.email.toLowerCase() === normalized
        );
      },

      getByJobId: (jobId) => {
        return get().applications.filter((a) => a.jobId === jobId);
      },

      getAll: () => get().applications,

      clearAll: () => set({ applications: [] }),
    }),
    {
      name: 'hrconnect_candidate_applications',
    }
  )
);

// Reset on logout
if (typeof window !== 'undefined') {
  window.addEventListener('hrconnect:logout', () => {
    // Keep applications across sessions — they are shared data, not user-specific session data
    // Only clear if the user explicitly requests it via admin
  });
}
