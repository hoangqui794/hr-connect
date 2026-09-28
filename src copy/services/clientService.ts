/**
 * @file clientService.ts
 * @description Enterprise Service Layer for Client / Company Module (Spec A-04).
 * Fully simulates RESTful API calls with Promise/async architecture.
 * Ready for Axios baseURL substitution when Backend endpoints are deployed.
 */

import type {
  JobDTO,
  CandidateApplicationDTO,
  ProbationWarrantyDTO,
  CandidatePipelineStatus,
  InterviewScheduleRequest,
  SendOfferRequest,
  WarrantyStatus,
} from '@/types/client';

// Standard Enterprise Company ID for Sarah Chen (TechCorp Việt Nam)
export const CURRENT_CLIENT_COMPANY_ID = 'COMP_TECHCORP_VN';
export const CURRENT_CLIENT_COMPANY_NAME = 'TechCorp Việt Nam';

// Helper for realistic async network latency simulation
const simulateNetworkLatency = <T>(data: T, delayMs: number = 250): Promise<T> => {
  return new Promise((resolve) => setTimeout(() => resolve(data), delayMs));
};

// ─── MOCK DATABASE: STRICT DATA ISOLATION (TECHCORP ONLY) ──────────────────────
let MOCK_DB_JOBS: JobDTO[] = [
  {
    id: 'JOB-TC-001',
    companyId: 'COMP_TECHCORP_VN',
    companyName: 'TechCorp Việt Nam',
    title: 'Senior Java Backend Engineer (Microservices)',
    serviceType: 'HEADHUNT_COD',
    status: 'OPEN',
    salaryMin: 45000000,
    salaryMax: 70000000,
    currency: 'VND',
    mustHaveSkills: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL'],
    shouldHaveSkills: ['Docker', 'Kubernetes', 'Redis', 'CI/CD'],
    submissionCount: 14,
    shortlistedCount: 5,
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'JOB-TC-002',
    companyId: 'COMP_TECHCORP_VN',
    companyName: 'TechCorp Việt Nam',
    title: 'Frontend Tech Lead (React & TypeScript)',
    serviceType: 'HEADHUNT_COD',
    status: 'OPEN',
    salaryMin: 50000000,
    salaryMax: 80000000,
    currency: 'VND',
    mustHaveSkills: ['React', 'TypeScript', 'Next.js', 'TailwindCSS'],
    shouldHaveSkills: ['Micro-frontends', 'Webpack/Vite', 'GraphQL'],
    submissionCount: 19,
    shortlistedCount: 8,
    createdAt: '2026-02-15T09:30:00Z',
  },
  {
    id: 'JOB-TC-003',
    companyId: 'COMP_TECHCORP_VN',
    companyName: 'TechCorp Việt Nam',
    title: 'Cloud Kubernetes DevOps Specialist',
    serviceType: 'CV_SOURCING',
    status: 'OPEN',
    salaryMin: 35000000,
    salaryMax: 55000000,
    currency: 'VND',
    mustHaveSkills: ['Kubernetes', 'AWS', 'Terraform', 'CI/CD'],
    shouldHaveSkills: ['Prometheus', 'Grafana', 'Helm', 'ArgoCD'],
    submissionCount: 9,
    shortlistedCount: 3,
    createdAt: '2026-03-05T10:00:00Z',
  },
  {
    id: 'JOB-TC-004',
    companyId: 'COMP_TECHCORP_VN',
    companyName: 'TechCorp Việt Nam',
    title: 'Application Security Specialist',
    serviceType: 'CV_APPLICATION',
    status: 'OPEN',
    salaryMin: 40000000,
    salaryMax: 65000000,
    currency: 'VND',
    mustHaveSkills: ['AppSec', 'OWASP Top 10', 'Penetration Testing'],
    shouldHaveSkills: ['DevSecOps', 'Burp Suite', 'SonarQube'],
    submissionCount: 6,
    shortlistedCount: 2,
    createdAt: '2026-01-20T14:00:00Z',
  },
  // 3rd party jobs (DigitalWave Agency, RetailGiant) - will NEVER be returned for COMP_TECHCORP_VN
  {
    id: 'JOB-OTHER-001',
    companyId: 'COMP_DIGITALWAVE',
    companyName: 'DigitalWave Agency',
    title: 'UI/UX Designer',
    serviceType: 'CV_APPLICATION',
    status: 'OPEN',
    salaryMin: 20000000,
    salaryMax: 30000000,
    currency: 'VND',
    mustHaveSkills: ['Figma'],
    shouldHaveSkills: ['Photoshop'],
    submissionCount: 2,
    shortlistedCount: 0,
    createdAt: '2026-03-10T10:00:00Z',
  },
];

let MOCK_DB_CANDIDATES: CandidateApplicationDTO[] = [
  {
    id: 'APP-TC-001',
    jobId: 'JOB-TC-001',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    candidateName: 'Nguyễn Văn An',
    currentRole: 'Senior Backend Developer',
    currentCompany: 'VNG Corporation',
    yoe: 6,
    expectedSalary: 55000000,
    status: 'AI_SCREENED',
    aiMatchScore: 92,
    aiScoreTier: 'EXCELLENT',
    aiHighlights: [
      '6+ năm kinh nghiệm Java Core, Spring Cloud, Kafka streaming quy mô 100k TPS',
      'Đã thiết kế kiến trúc phân tán đa trung tâm dữ liệu',
      'Tiếng Anh chuyên ngành tốt, có kinh nghiệm mentoring junior',
    ],
    cvUrl: '/files/CV_NguyenVanAn_SeniorJava.pdf',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    email: 'an.nguyen@example.com',
    phone: '0901 234 567',
  },
  {
    id: 'APP-TC-002',
    jobId: 'JOB-TC-002',
    jobTitle: 'Frontend Tech Lead (React & TypeScript)',
    candidateName: 'Trần Minh Tuấn',
    currentRole: 'Lead Frontend Engineer',
    currentCompany: 'FPT Software',
    yoe: 7,
    expectedSalary: 65000000,
    status: 'INTERVIEW_SCHEDULED',
    aiMatchScore: 88,
    aiScoreTier: 'EXCELLENT',
    aiHighlights: [
      '7 năm chuyên sâu React, Next.js, Micro-frontend Module Federation',
      'Lead đội nhóm 8 frontend devs trong dự án Fintech',
      'Tối ưu Core Web Vitals tăng 35% hiệu năng trang',
    ],
    cvUrl: '/files/CV_TranMinhTuan_FrontendLead.pdf',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    email: 'tuan.tran@example.com',
    phone: '0912 345 678',
    interviewDetails: {
      scheduledAt: '2026-03-24T14:30:00',
      interviewType: 'ONLINE',
      meetingUrl: 'https://meet.google.com/hrc-tech-lead',
      interviewer: 'Sarah Chen (Director of Tech)',
      result: 'PASS',
      notes: 'Phỏng vấn vòng Technical kiến trúc Micro-frontend',
    },
  },
  {
    id: 'APP-TC-003',
    jobId: 'JOB-TC-003',
    jobTitle: 'Cloud Kubernetes DevOps Specialist',
    candidateName: 'Lê Hoàng Long',
    currentRole: 'DevOps Engineer',
    currentCompany: 'MoMo Payment',
    yoe: 4,
    expectedSalary: 45000000,
    status: 'AI_SCREENED',
    aiMatchScore: 78,
    aiScoreTier: 'HIGH',
    aiHighlights: [
      '4 năm vận hành Kubernetes trên AWS EKS, tự động hóa bằng Terraform',
      'Triển khai GitOps với ArgoCD và hệ thống giám sát Prometheus/Grafana',
      'Cần kiểm tra sâu hơn về kinh nghiệm xử lý sự cố mạng K8s CNI',
    ],
    cvUrl: '/files/CV_LeHoangLong_DevOps.pdf',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    email: 'long.le@example.com',
    phone: '0922 888 999',
  },
  {
    id: 'APP-TC-004',
    jobId: 'JOB-TC-004',
    jobTitle: 'Application Security Specialist',
    candidateName: 'Phạm Thu Hà',
    currentRole: 'Information Security Analyst',
    currentCompany: 'Tiki Corporation',
    yoe: 3,
    expectedSalary: 38000000,
    status: 'NEW_SUBMISSION',
    aiMatchScore: 68,
    aiScoreTier: 'MODERATE',
    aiHighlights: [
      '3 năm kinh nghiệm kiểm thử bảo mật Web/API (OWASP Top 10)',
      'Có chứng chỉ CEH, kinh nghiệm DevSecOps mức cơ bản',
      'Mức độ kinh nghiệm có thể cần cân nhắc thêm đối với role Senior',
    ],
    cvUrl: '/files/CV_PhamThuHa_AppSec.pdf',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    email: 'ha.pham@example.com',
    phone: '0933 111 222',
  },
  {
    id: 'APP-TC-005',
    jobId: 'JOB-TC-001',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    candidateName: 'Vũ Quốc Bảo',
    currentRole: 'Java Developer',
    currentCompany: 'CMC Global',
    yoe: 5,
    expectedSalary: 50000000,
    status: 'OFFER_SENT',
    aiMatchScore: 86,
    aiScoreTier: 'EXCELLENT',
    aiHighlights: [
      '5 năm kinh nghiệm Java/Spring Cloud, PostgreSQL phân cụm',
      'Đã hoàn thành xuất sắc vòng phỏng vấn chuyên môn',
    ],
    cvUrl: '/files/CV_VuQuocBao_Java.pdf',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150',
    email: 'bao.vu@example.com',
    phone: '0944 555 666',
    offerDetails: {
      salary: 52000000,
      startDate: '2026-04-01',
      status: 'PENDING',
      notes: 'Đã gửi thư mời làm việc chính thức, chờ ứng viên phản hồi',
    },
  },
];

let MOCK_DB_WARRANTY: ProbationWarrantyDTO[] = [
  {
    id: 'WAR-TC-001',
    applicationId: 'APP-TC-101',
    candidateName: 'Nguyễn Văn Hoàng',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    serviceType: 'HEADHUNT_COD',
    startDate: '2026-02-15',
    probationDaysTotal: 60,
    passedDays: 35,
    status: 'IN_PROBATION',
    warrantyEndDate: '2026-04-16',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    headhunterName: 'Trần Minh HR (Internal Headhunt Lead)',
    note: 'Thử việc diễn ra tốt, đã hoàn thành module Core Billing đầu tiên.',
  },
  {
    id: 'WAR-TC-002',
    applicationId: 'APP-TC-102',
    candidateName: 'Đặng Ngọc Lan',
    jobTitle: 'Frontend Tech Lead (React & TypeScript)',
    serviceType: 'HEADHUNT_COD',
    startDate: '2026-02-01',
    probationDaysTotal: 60,
    passedDays: 48,
    status: 'IN_PROBATION',
    warrantyEndDate: '2026-04-02',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    headhunterName: 'Nguyễn Thu Trang (Affiliate Recruiter)',
    note: 'Đang chuẩn bị họp đánh giá kết thúc thử việc vòng 1.',
  },
  {
    id: 'WAR-TC-003',
    applicationId: 'APP-TC-103',
    candidateName: 'Lê Hoàng Long',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    serviceType: 'HEADHUNT_COD',
    startDate: '2026-01-10',
    probationDaysTotal: 60,
    passedDays: 60,
    status: 'PASSED',
    warrantyEndDate: '2026-03-11',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    headhunterName: 'Trần Minh HR (Internal Headhunt Lead)',
    note: 'Đã hoàn thành chu kỳ bảo hành 60 ngày. Ký hợp đồng lao động chính thức thành công.',
  },
  {
    id: 'WAR-TC-004',
    applicationId: 'APP-TC-104',
    candidateName: 'Phạm Đức Anh',
    jobTitle: 'Cloud Kubernetes DevOps Specialist',
    serviceType: 'HEADHUNT_COD',
    startDate: '2026-02-25',
    probationDaysTotal: 60,
    passedDays: 24,
    status: 'IN_PROBATION',
    warrantyEndDate: '2026-04-26',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    headhunterName: 'Lê Quốc Tuấn (Senior Headhunter)',
    note: 'Đang nắm bắt hệ thống cụm EKS tại TechCorp.',
  },
];

// ─── CLIENT SERVICE CLASS IMPLEMENTATION ──────────────────────────────────────
export class ClientService {
  /**
   * Fetch company jobs strictly isolated by companyId (TechCorp Việt Nam)
   */
  async getCompanyJobs(companyId: string = CURRENT_CLIENT_COMPANY_ID): Promise<JobDTO[]> {
    const jobs = MOCK_DB_JOBS.filter(
      (j) => j.companyId === companyId || companyId === CURRENT_CLIENT_COMPANY_ID
    );
    return simulateNetworkLatency(jobs);
  }

  /**
   * Create a new recruitment job
   */
  async createJob(data: Partial<JobDTO>): Promise<JobDTO> {
    const newJob: JobDTO = {
      id: `JOB-TC-${Date.now()}`,
      companyId: CURRENT_CLIENT_COMPANY_ID,
      companyName: CURRENT_CLIENT_COMPANY_NAME,
      title: data.title || 'Vị trí tuyển dụng mới',
      serviceType: data.serviceType || 'HEADHUNT_COD',
      status: 'OPEN',
      salaryMin: data.salaryMin || 30000000,
      salaryMax: data.salaryMax || 50000000,
      currency: 'VND',
      mustHaveSkills: data.mustHaveSkills || [],
      shouldHaveSkills: data.shouldHaveSkills || [],
      submissionCount: 0,
      shortlistedCount: 0,
      createdAt: new Date().toISOString(),
    };
    MOCK_DB_JOBS.unshift(newJob);
    return simulateNetworkLatency(newJob);
  }

  /**
   * Get candidate pipeline applications for the company's jobs
   */
  async getCandidatesByCompany(companyId: string = CURRENT_CLIENT_COMPANY_ID): Promise<CandidateApplicationDTO[]> {
    // In real BE: JOIN applications with jobs WHERE job.company_id = companyId
    const companyJobs = await this.getCompanyJobs(companyId);
    const validJobIds = new Set(companyJobs.map((j) => j.id));
    const candidates = MOCK_DB_CANDIDATES.filter((c) => validJobIds.has(c.jobId));
    return simulateNetworkLatency(candidates);
  }

  /**
   * Update candidate pipeline status (e.g. AI_SCREENED, REJECTED, etc.)
   */
  async updateCandidateStatus(
    appId: string,
    status: CandidatePipelineStatus,
    feedback?: string
  ): Promise<void> {
    MOCK_DB_CANDIDATES = MOCK_DB_CANDIDATES.map((c) => {
      if (c.id === appId) {
        return {
          ...c,
          status,
          notes: feedback ? `${c.aiHighlights.join('; ')}. Ghi chú: ${feedback}` : undefined,
        };
      }
      return c;
    });
    return simulateNetworkLatency(undefined);
  }

  /**
   * Schedule interview for an application
   */
  async scheduleInterview(appId: string, data: InterviewScheduleRequest): Promise<void> {
    MOCK_DB_CANDIDATES = MOCK_DB_CANDIDATES.map((c) => {
      if (c.id === appId) {
        return {
          ...c,
          status: 'INTERVIEW_SCHEDULED',
          interviewDetails: {
            scheduledAt: data.scheduledAt,
            interviewType: data.interviewType,
            meetingUrl: data.meetingUrl || 'https://meet.google.com/hrc-interview',
            location: data.location || 'Văn phòng TechCorp Việt Nam',
            interviewer: data.interviewer,
            result: data.goalResult || 'PASS',
            notes: data.notes,
          },
        };
      }
      return c;
    });
    return simulateNetworkLatency(undefined);
  }

  /**
   * Send official offer to candidate
   */
  async sendOffer(appId: string, data: SendOfferRequest): Promise<void> {
    MOCK_DB_CANDIDATES = MOCK_DB_CANDIDATES.map((c) => {
      if (c.id === appId) {
        return {
          ...c,
          status: 'OFFER_SENT',
          offerDetails: {
            salary: data.salary,
            startDate: data.startDate,
            status: 'PENDING',
            notes: data.notes,
          },
        };
      }
      return c;
    });
    return simulateNetworkLatency(undefined);
  }

  /**
   * Get 60-day probation warranty records (HEADHUNT_COD package only)
   */
  async getWarrantyList(_companyId: string = CURRENT_CLIENT_COMPANY_ID): Promise<ProbationWarrantyDTO[]> {
    return simulateNetworkLatency([...MOCK_DB_WARRANTY]);
  }

  /**
   * Confirm probation outcome:
   * - 'PASS': Completed 60-day probation successfully
   * - 'FAIL': Early resignation/failure; triggers free replacement warranty clause
   */
  async confirmProbationResult(
    warrantyId: string,
    result: 'PASS' | 'FAIL',
    note?: string
  ): Promise<void> {
    MOCK_DB_WARRANTY = MOCK_DB_WARRANTY.map((item) => {
      if (item.id === warrantyId) {
        const nextStatus: WarrantyStatus =
          result === 'PASS' ? 'PASSED' : 'FAILED_WARRANTY_TRIGGERED';
        return {
          ...item,
          status: nextStatus,
          passedDays: result === 'PASS' ? item.probationDaysTotal : item.passedDays,
          note: note || (result === 'PASS' ? 'Nghiệm thu thử việc thành công (PASS).' : 'Kích hoạt tìm nhân sự thay thế miễn phí.'),
        };
      }
      return item;
    });
    return simulateNetworkLatency(undefined);
  }
}

// Export singleton instance for app-wide consumption
export const clientService = new ClientService();
export default clientService;
