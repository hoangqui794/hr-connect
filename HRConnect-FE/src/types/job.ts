export enum ServiceType {
  HEADHUNT_COD = 'HEADHUNT_COD',
  CV_SOURCING = 'CV_SOURCING',
  CV_APPLICATION = 'CV_APPLICATION',
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]: 'Tuyển dụng trọn gói (COD)',
  [ServiceType.CV_SOURCING]: 'Cung cấp hồ sơ (CV Sourcing)',
  [ServiceType.CV_APPLICATION]: 'Ứng tuyển mở (CV Application)',
};

export const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]:
    'Quy trình tuyển dụng toàn diện qua mạng lưới Headhunter. Bảo hành 60 ngày thử việc, chỉ trả phí khi tuyển dụng thành công.',
  [ServiceType.CV_SOURCING]:
    'Nhận danh sách hồ sơ ứng viên đã qua sàng lọc AI. Doanh nghiệp tự chủ động liên hệ phỏng vấn và tiếp nhận.',
  [ServiceType.CV_APPLICATION]:
    'Bảng tin tuyển dụng mở. Ứng viên nộp hồ sơ trực tiếp — không phát sinh hoa hồng cộng tác viên.',
};

export enum JobStatus {
  PENDING = 'PENDING',
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  FILLED = 'FILLED',
}

export interface HardTag {
  id: string;
  label: string;
  category: 'skill' | 'experience' | 'language' | 'certification' | 'industry';
  mandatory: boolean; // true = must-have, false = should-have
}

export interface SalaryRange {
  min: number;
  max: number;
  currency: 'VND' | 'USD' | 'SGD';
  negotiable: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyId: string;
  industryCode: string;
  industryLabel: string;
  serviceType: ServiceType;
  status: JobStatus;
  location: string;
  remote: boolean;
  salaryRange: SalaryRange;
  mustHaveTags: string[];
  shouldHaveTags: string[];
  objectives: string;
  engagementTerms: {
    budget?: number;
    timeline: number; // days
    commissionRate: number; // percentage
    retainerFee?: number;
  };
  headcount: number;
  experienceYears: { min: number; max: number };
  description: string;
  requirements: string[];
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  clientContactId: string;
  internalHRId?: string;
  applicationCount: number;
  shortlistedCount: number;
  clientEmail?: string;
  clientId?: string;
  servicePackage?: string;
}

export interface JobWizardDraft {
  step: number;
  step1: {
    title: string;
    company: string;
    industryCode: string;
    serviceType: ServiceType | null;
    location: string;
    remote: boolean;
    headcount: number;
    experienceMin: number;
    experienceMax: number;
    salaryMin: number;
    salaryMax: number;
    currency: 'VND' | 'USD' | 'SGD';
    negotiable: boolean;
    deadline: string;
  };
  step2: {
    mustHaveTags: string[];
    shouldHaveTags: string[];
    description: string;
    requirements: string[];
  };
  step3: {
    objectives: string;
    kpis: string[];
    successCriteria: string;
  };
  step4: {
    commissionRate: number;
    retainerFee: number;
    timeline: number;
    budget: number;
    notes: string;
  };
}

export const DEFAULT_WIZARD_DRAFT: JobWizardDraft = {
  step: 0,
  step1: {
    title: '',
    company: '',
    industryCode: '',
    serviceType: null,
    location: 'Ho Chi Minh City, Vietnam',
    remote: false,
    headcount: 1,
    experienceMin: 3,
    experienceMax: 7,
    salaryMin: 2000,
    salaryMax: 5000,
    currency: 'USD',
    negotiable: true,
    deadline: '',
  },
  step2: {
    mustHaveTags: [],
    shouldHaveTags: [],
    description: '',
    requirements: [],
  },
  step3: {
    objectives: '',
    kpis: [],
    successCriteria: '',
  },
  step4: {
    commissionRate: 15,
    retainerFee: 0,
    timeline: 30,
    budget: 0,
    notes: '',
  },
};
