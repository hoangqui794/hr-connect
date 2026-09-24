/**
 * @file localStorageService.ts
 * @description Centralized Single Source of Truth service for HRConnect.
 * Manages localStorage synchronization across all 5 roles:
 *   - 'hrconnect_users': Unified accounts storage
 *   - 'hrconnect_all_jobs': Global job postings
 *   - 'hrconnect_candidate_applications': Applications and referrals
 *   - 'hrconnect_warranties': 60-day probation warranty tracking
 *   - 'hrconnect_payouts': Commission payouts for Admin approval
 */

import { UserRole } from '@/types/roles';
import { Job, JobStatus, ServiceType } from '@/types/job';
import { MOCK_JOBS } from '@/services/mockData';
import { PayoutStatus } from '@/types/affiliate';

// ─── KEYS ──────────────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  USERS: 'hrconnect_users',
  ALL_JOBS: 'hrconnect_all_jobs',
  APPLICATIONS: 'hrconnect_candidate_applications',
  WARRANTIES: 'hrconnect_warranties',
  PAYOUTS: 'hrconnect_payouts',
  INTERVIEWS: 'hrconnect_interviews',
  LEGACY_REGISTERED: 'hr-connect-registered-accounts',
  LEGACY_USERS: 'registered_users',
  LEGACY_CLIENT_JOBS: 'hrconnect_client_jobs',
} as const;

// ─── USER STORAGE ──────────────────────────────────────────────────────────────

export interface HRConnectUser {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  companyName?: string;
  companySize?: string;
  createdAt: string;
}

export const PRESEEDED_TEST_ACCOUNTS: HRConnectUser[] = [
  // ─── 5 Standard Test Accounts ────────────────────────────────────────────────
  {
    id: 'usr-client-005',
    email: 'tuyendung5@gmail.com',
    password: '123456',
    role: UserRole.CLIENT,
    fullName: 'Doanh nghiệp Tuyển Dụng 5',
    phone: '0901234505',
    companyName: 'Công ty TNHH Tuyển Dụng 5',
    companySize: '51-200',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'usr-candidate-005',
    email: 'ungvien5@gmail.com',
    password: '123456',
    role: UserRole.CANDIDATE,
    fullName: 'Nguyễn Văn B (Ứng viên 5)',
    phone: '0905555666',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'usr-affiliate-005',
    email: 'cvt5@gmail.com',
    password: '123456',
    role: UserRole.AFFILIATE,
    fullName: 'Cộng Tác Viên 5 (Headhunter)',
    phone: '0912345005',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'usr-hr-test-01',
    email: 'myhr@hrconnect.io',
    password: '123456',
    role: UserRole.INTERNAL_HR,
    fullName: 'My Test HR',
    phone: '0909999001',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'usr-admin-test-01',
    email: 'myadmin@hrconnect.io',
    password: '123456',
    role: UserRole.ADMIN,
    fullName: 'Platform Admin',
    phone: '0909999002',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  // ─── Legacy / Demo Fallback Accounts ──────────────────────────────────────────
  {
    id: 'usr-client-001',
    email: 'client@demo.com',
    password: '123456',
    role: UserRole.CLIENT,
    fullName: 'Sarah Chen',
    phone: '0901234567',
    companyName: 'TechCorp Việt Nam',
    companySize: '51-200',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-affiliate-001',
    email: 'affiliate@demo.com',
    password: '123456',
    role: UserRole.AFFILIATE,
    fullName: 'David Tran',
    phone: '0912345678',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-candidate-001',
    email: 'candidate@demo.com',
    password: '123456',
    role: UserRole.CANDIDATE,
    fullName: 'Nguyễn Văn A',
    phone: '0923456789',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-hr-001',
    email: 'hr@demo.com',
    password: '123456',
    role: UserRole.INTERNAL_HR,
    fullName: 'Lisa Pham',
    phone: '0934567890',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-admin-001',
    email: 'admin@demo.com',
    password: '123456',
    role: UserRole.ADMIN,
    fullName: 'Platform Admin',
    phone: '0945678901',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const getHRConnectUsers = (): HRConnectUser[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    let users: HRConnectUser[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) users = parsed;
    }

    // Also migrate any users from legacy keys if not present
    const legacyRaw1 = localStorage.getItem(STORAGE_KEYS.LEGACY_REGISTERED);
    const legacyRaw2 = localStorage.getItem(STORAGE_KEYS.LEGACY_USERS);
    const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));

    [legacyRaw1, legacyRaw2].forEach((rawStr) => {
      if (!rawStr) return;
      try {
        const arr = JSON.parse(rawStr);
        if (Array.isArray(arr)) {
          arr.forEach((item: any) => {
            const email = (item.email || '').trim().toLowerCase();
            if (email && !existingEmails.has(email)) {
              existingEmails.add(email);
              users.push({
                id: item.id || `usr-${Date.now()}`,
                email,
                password: item.password || '123456',
                role: (item.role as UserRole) || UserRole.CANDIDATE,
                fullName: item.fullName || item.name || email.split('@')[0],
                phone: item.phone,
                companyName: item.companyName || item.company,
                companySize: item.companySize,
                createdAt: item.createdAt || new Date().toISOString(),
              });
            }
          });
        }
      } catch {/* noop */}
    });

    // Ensure all PRESEEDED_TEST_ACCOUNTS exist and have password 123456
    PRESEEDED_TEST_ACCOUNTS.forEach((seed) => {
      const existingIndex = users.findIndex((u) => u.email.toLowerCase() === seed.email.toLowerCase());
      if (existingIndex >= 0) {
        // Enforce password and role preservation
        users[existingIndex].password = '123456';
        users[existingIndex].role = seed.role;
        if (!users[existingIndex].fullName) {
          users[existingIndex].fullName = seed.fullName;
        }
      } else {
        existingEmails.add(seed.email.toLowerCase());
        users.push(seed);
      }
    });

    // Save back to ensure synced state
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.LEGACY_REGISTERED, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, JSON.stringify(users));

    return users;
  } catch (err) {
    console.error('Failed to read hrconnect_users:', err);
    return PRESEEDED_TEST_ACCOUNTS;
  }
};

export const saveHRConnectUser = (
  user: Omit<HRConnectUser, 'id' | 'createdAt'> & { id?: string }
): HRConnectUser => {
  const users = getHRConnectUsers();
  const normalizedEmail = user.email.trim().toLowerCase();
  const normalizedRole = (user.role || UserRole.CANDIDATE).toUpperCase() as UserRole;

  const existingIdx = users.findIndex((u) => u.email.trim().toLowerCase() === normalizedEmail);
  const newUserRecord: HRConnectUser = {
    id: user.id || `usr-${normalizedRole.toLowerCase()}-${Date.now()}`,
    email: normalizedEmail,
    password: user.password || '123456',
    role: normalizedRole,
    fullName: user.fullName.trim(),
    phone: user.phone?.trim(),
    companyName: normalizedRole === UserRole.CLIENT ? user.companyName?.trim() : undefined,
    companySize: normalizedRole === UserRole.CLIENT ? user.companySize : undefined,
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...newUserRecord };
  } else {
    users.unshift(newUserRecord);
  }

  try {
    const serialized = JSON.stringify(users);
    localStorage.setItem(STORAGE_KEYS.USERS, serialized);
    localStorage.setItem(STORAGE_KEYS.LEGACY_REGISTERED, serialized);
    localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, serialized);
  } catch (err) {
    console.error('Failed to save user to hrconnect_users:', err);
  }

  return newUserRecord;
};

export const findHRConnectUserByEmail = (email: string): HRConnectUser | undefined => {
  if (!email) return undefined;
  const users = getHRConnectUsers();
  return users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
};

// ─── ALL JOBS STORAGE ──────────────────────────────────────────────────────────

export const getAllJobs = (): Job[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALL_JOBS);
    let jobs: Job[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          jobs = parsed;
        }
      } catch {/* noop */}
    }

    // If empty or missing, seed from MOCK_JOBS
    if (jobs.length === 0) {
      jobs = [...MOCK_JOBS];
    }

    // Also migrate any jobs from legacy 'hrconnect_client_jobs'
    const legacyClientJobsRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_CLIENT_JOBS);
    if (legacyClientJobsRaw) {
      try {
        const clientJobs = JSON.parse(legacyClientJobsRaw);
        if (Array.isArray(clientJobs)) {
          clientJobs.forEach((cj: any) => {
            const exists = jobs.some((j) => j.id === cj.id);
            if (!exists) {
              jobs.unshift({
                id: cj.id,
                title: cj.title,
                company: cj.company,
                companyId: cj.companyId || 'client-unknown',
                industryCode: cj.industryCode || 'tech-software',
                industryLabel: cj.industryLabel || 'Công nghệ',
                serviceType: cj.serviceType || ServiceType.HEADHUNT_COD,
                status: cj.status === 'PENDING' ? JobStatus.PENDING : (cj.status as JobStatus) || JobStatus.PENDING,
                location: cj.location || 'Hồ Chí Minh, Việt Nam',
                remote: cj.remote ?? false,
                salaryRange: cj.salaryRange || { min: 20000000, max: 40000000, currency: 'VND', negotiable: true },
                mustHaveTags: cj.mustHaveTags || [],
                shouldHaveTags: cj.shouldHaveTags || [],
                objectives: cj.objectives || '',
                engagementTerms: cj.engagementTerms || { timeline: 30, commissionRate: 15, retainerFee: 0, budget: 0 },
                headcount: cj.headcount || 1,
                experienceYears: cj.experienceYears || { min: 1, max: 5 },
                description: cj.description || '',
                requirements: cj.requirements || [],
                createdAt: cj.createdAt || new Date().toISOString(),
                updatedAt: cj.updatedAt || new Date().toISOString(),
                deadline: cj.deadline,
                clientContactId: cj.clientContactId || 'client-contact',
                applicationCount: cj.applicationCount || 0,
                shortlistedCount: cj.shortlistedCount || 0,
                clientEmail: cj.postedByEmail,
              });
            }
          });
        }
      } catch {/* noop */}
    }

    // Persist unified list
    localStorage.setItem(STORAGE_KEYS.ALL_JOBS, JSON.stringify(jobs));
    return jobs;
  } catch (err) {
    console.error('Failed to read hrconnect_all_jobs:', err);
    return MOCK_JOBS;
  }
};

export const saveJobToAllJobs = (job: Job): void => {
  try {
    const jobs = getAllJobs();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...job, updatedAt: new Date().toISOString() };
    } else {
      jobs.unshift(job); // Prepend to top of list
    }
    localStorage.setItem(STORAGE_KEYS.ALL_JOBS, JSON.stringify(jobs));
  } catch (err) {
    console.error('Failed to save job to hrconnect_all_jobs:', err);
  }
};

export const updateJobStatusInAllJobs = (id: string, status: JobStatus | string): void => {
  try {
    const jobs = getAllJobs();
    const updated = jobs.map((j) =>
      j.id === id ? { ...j, status: status as JobStatus, updatedAt: new Date().toISOString() } : j
    );
    localStorage.setItem(STORAGE_KEYS.ALL_JOBS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update job status in hrconnect_all_jobs:', err);
  }
};

export const getJobsForClient = (
  clientEmail?: string,
  companyName?: string,
  companyId?: string
): Job[] => {
  const allJobs = getAllJobs();
  const normalizedEmail = (clientEmail || '').trim().toLowerCase();
  const normalizedCompany = (companyName || '').trim().toLowerCase();

  return allJobs.filter((job) => {
    // 1. Matches clientEmail
    if (normalizedEmail && job.clientEmail && job.clientEmail.toLowerCase() === normalizedEmail) {
      return true;
    }
    // 2. Demo client TechCorp check
    const isTechCorpUser =
      normalizedEmail.includes('techcorp') ||
      normalizedEmail === 'client@demo.com' ||
      normalizedCompany.includes('techcorp') ||
      companyId === 'client-001';

    if (isTechCorpUser && (job.company.includes('TechCorp') || job.companyId === 'client-001')) {
      return true;
    }

    // 3. Fallback to company match if clientEmail was not provided on older jobs
    if (normalizedCompany && job.company.toLowerCase() === normalizedCompany) {
      return true;
    }
    if (companyId && job.companyId === companyId) {
      return true;
    }

    return false;
  });
};

export const getActiveJobs = (): Job[] => {
  const allJobs = getAllJobs();
  return allJobs.filter((j) => j.status === JobStatus.ACTIVE);
};

// ─── WARRANTY TRACKING STORAGE ────────────────────────────────────────────────

export interface WarrantyRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  affiliateName: string;
  onboardDate: string;
  warrantyEndDate: string;
  totalDays: number;
  daysPassed: number;
  commissionAmount: number;
  status: 'IN_PROBATION' | 'PASSED_PROBATION' | 'FAILED_PROBATION';
  notes?: string;
  clientDecision?: 'PASSED' | 'FAILED';
  clientFeedbackDate?: string;
}

const INITIAL_WARRANTIES: WarrantyRecord[] = [
  {
    id: 'war-001',
    candidateName: 'Lê Hoàng Minh',
    candidateEmail: 'minh.le@example.com',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior React Developer (COD)',
    affiliateName: 'David Tran',
    onboardDate: '2026-07-15',
    warrantyEndDate: '2026-09-15',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 25000000,
    status: 'PASSED_PROBATION',
    notes: 'Đã hoàn thành xuất sắc 60 ngày thử việc. Kích hoạt mốc hoa hồng 25.000.000 đ cho CTV David Tran.',
  },
  {
    id: 'war-002',
    candidateName: 'Trần Thị Thu',
    candidateEmail: 'thu.tran@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Product Manager - Fintech',
    affiliateName: 'Sarah Le',
    onboardDate: '2026-07-20',
    warrantyEndDate: '2026-09-20',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 32000000,
    status: 'PASSED_PROBATION',
    notes: 'Khách hàng VNG đánh giá rất cao năng lực ứng viên.',
  },
  {
    id: 'war-003',
    candidateName: 'Lê Thanh Đạt',
    candidateEmail: 'dat.le@tech.io',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior Fullstack Engineer',
    affiliateName: 'David Tran',
    onboardDate: '2026-08-10',
    warrantyEndDate: '2026-10-10',
    totalDays: 60,
    daysPassed: 43,
    commissionAmount: 28000000,
    status: 'IN_PROBATION',
    notes: 'Tiến độ thử việc thuận lợi, hòa nhập tốt với team dự án.',
  },
  {
    id: 'war-004',
    candidateName: 'Nguyễn Văn B',
    candidateEmail: 'vanb.devops@tech.io',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    affiliateName: 'Minh Vũ Recruiter',
    onboardDate: '2026-08-25',
    warrantyEndDate: '2026-10-25',
    totalDays: 60,
    daysPassed: 28,
    commissionAmount: 18000000,
    status: 'IN_PROBATION',
    notes: 'Đang trong tháng thử việc đầu tiên.',
  },
];

export const getWarranties = (): WarrantyRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WARRANTIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WARRANTIES, JSON.stringify(INITIAL_WARRANTIES));
      return INITIAL_WARRANTIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_WARRANTIES;
  } catch {
    return INITIAL_WARRANTIES;
  }
};

export const saveWarranty = (warranty: WarrantyRecord): void => {
  try {
    const list = getWarranties();
    const idx = list.findIndex((w) => w.id === warranty.id);
    if (idx >= 0) {
      list[idx] = warranty;
    } else {
      list.unshift(warranty);
    }
    localStorage.setItem(STORAGE_KEYS.WARRANTIES, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save warranty:', err);
  }
};

export const updateWarrantyStatus = (
  id: string,
  status: 'IN_PROBATION' | 'PASSED_PROBATION' | 'FAILED_PROBATION',
  notes?: string
): void => {
  try {
    const list = getWarranties();
    const updated = list.map((w) =>
      w.id === id
        ? {
            ...w,
            status,
            daysPassed: status === 'PASSED_PROBATION' ? w.totalDays : w.daysPassed,
            notes: notes || w.notes,
          }
        : w
    );
    localStorage.setItem(STORAGE_KEYS.WARRANTIES, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update warranty status:', err);
  }
};

// ─── PAYOUTS STORAGE ──────────────────────────────────────────────────────────

export interface PayoutRecord {
  id: string;
  candidateName: string;
  affiliateName: string;
  affiliateBank: string;
  affiliateBankAccount: string;
  jobTitle: string;
  hiredDate: string;
  warrantyEndDate: string;
  commissionAmount: number;
  status: PayoutStatus;
}

const INITIAL_PAYOUTS: PayoutRecord[] = [
  {
    id: 'pay-001',
    candidateName: 'Lê Hoàng Minh',
    affiliateName: 'David Tran',
    affiliateBank: 'Techcombank',
    affiliateBankAccount: '19034567890123',
    jobTitle: 'Senior React Developer (COD)',
    hiredDate: '2026-07-15',
    warrantyEndDate: '2026-09-15',
    commissionAmount: 25000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-002',
    candidateName: 'Trần Thị Thu',
    affiliateName: 'Sarah Le',
    affiliateBank: 'Vietcombank',
    affiliateBankAccount: '0071001234567',
    jobTitle: 'Product Manager - Fintech',
    hiredDate: '2026-07-20',
    warrantyEndDate: '2026-09-20',
    commissionAmount: 32000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-003',
    candidateName: 'Nguyễn Văn B',
    affiliateName: 'Minh Vũ Recruiter',
    affiliateBank: 'MB Bank',
    affiliateBankAccount: '888899991234',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    hiredDate: '2026-07-22',
    warrantyEndDate: '2026-09-22',
    commissionAmount: 18000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-004',
    candidateName: 'Phan Thanh Tùng',
    affiliateName: 'David Tran',
    affiliateBank: 'Techcombank',
    affiliateBankAccount: '19034567890123',
    jobTitle: 'Backend Java Lead',
    hiredDate: '2026-06-01',
    warrantyEndDate: '2026-08-01',
    commissionAmount: 40000000,
    status: PayoutStatus.PAID,
  },
];

export const getPayouts = (): PayoutRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(INITIAL_PAYOUTS));
      return INITIAL_PAYOUTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PAYOUTS;
  } catch {
    return INITIAL_PAYOUTS;
  }
};

export const savePayout = (payout: PayoutRecord): void => {
  try {
    const list = getPayouts();
    const idx = list.findIndex((p) => p.id === payout.id);
    if (idx >= 0) {
      list[idx] = payout;
    } else {
      list.unshift(payout);
    }
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save payout:', err);
  }
};

export const updatePayoutStatus = (id: string, status: PayoutStatus): void => {
  try {
    const list = getPayouts();
    const updated = list.map((p) => (p.id === id ? { ...p, status } : p));
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update payout status:', err);
  }
};

// ─── INTERVIEW SCHEDULE STORAGE ───────────────────────────────────────────────

export interface InterviewRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  roundName: string;
  scheduledTime: string;
  meetingLink: string;
  interviewerName: string;
  status: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'RESCHEDULED';
  notes?: string;
  /** Source application ID for back-linking */
  applicationId?: string;
}

export const getInterviews = (): InterviewRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INTERVIEWS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveInterview = (record: InterviewRecord): void => {
  try {
    const list = getInterviews();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_KEYS.INTERVIEWS, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save interview record:', err);
  }
};
