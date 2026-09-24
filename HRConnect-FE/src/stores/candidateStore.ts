import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  expectedSalary: string;
  currentLevel: string;
  experienceYears: string;
  foreignLanguages: string;
  availableDate: string;
  location: string;
  skills: string[];
  bio: string;
}

export interface CandidateCV {
  id: string;
  userEmail?: string;
  name: string;
  updatedAt: string;
  size: string;
  isDefault: boolean;
  atsScore: number;
  type: 'Platform Builder' | 'Template ATS' | 'File Upload';
  fileUrl?: string;
  previewUrl?: string;
}

export interface CandidateApplication {
  id: string;
  candidateEmail?: string;
  jobId: string;
  jobTitle: string;
  company: string;
  salary: string;
  appliedDate: string;
  status: 'SUBMITTED' | 'SCREENED' | 'INTERVIEW' | 'OFFER';
  statusLabel: string;
  statusColor: string;
  cvUsed: string;
  coverLetter?: string;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  offerDetails?: {
    salary: string;
    startDate: string;
    position: string;
    note: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  };
}

export interface InterviewSchedule {
  id: string;
  candidateEmail?: string;
  applicantEmail?: string;
  jobTitle: string;
  company: string;
  datetime: string;
  mode: 'ONLINE' | 'OFFLINE';
  link?: string;
  address?: string;
  interviewers: string;
  notes: string;
  status?: string;
}

export interface RecruiterConnectItem {
  id: string;
  candidateEmail?: string;
  userEmail?: string;
  recruiterId: string;
  recruiterName: string;
  recruiterTitle: string;
  recruiterAvatar: string;
  cvUsed: string;
  sentDate: string;
  note: string;
  status: 'SENT' | 'ACCEPTED' | 'MATCHED';
  statusLabel: string;
  statusColor: string;
  matchedJob?: string;
}

export interface SavedJobItem {
  jobId: string;
  userEmail: string;
}

interface CandidateState {
  profile: CandidateProfile;
  cvs: CandidateCV[];
  savedJobs: SavedJobItem[];
  savedJobIds: string[];
  applications: CandidateApplication[];
  interviews: InterviewSchedule[];
  recruiterConnects: RecruiterConnectItem[];

  updateProfile: (profile: Partial<CandidateProfile>) => void;
  toggleSaveJob: (jobId: string, email?: string) => boolean;
  isJobSaved: (jobId: string, email?: string) => boolean;
  applyJob: (application: {
    jobId: string;
    jobTitle: string;
    company: string;
    salary: string;
    cvUsed: string;
    coverLetter?: string;
    applicantName?: string;
    applicantEmail?: string;
    applicantPhone?: string;
  }) => void;
  setDefaultCV: (cvId: string) => void;
  addCV: (cv: CandidateCV) => void;
  deleteCV: (cvId: string) => void;
  respondToOffer: (appId: string, decision: 'ACCEPTED' | 'REJECTED') => void;
  addRecruiterConnect: (item: {
    recruiterId: string;
    recruiterName: string;
    recruiterTitle: string;
    recruiterAvatar: string;
    cvUsed: string;
    note: string;
    candidateEmail?: string;
  }) => void;
  resetCandidateStore: () => void;
  loadDemoData: () => void;
  initCandidateFromUser: (user: { name?: string; email?: string; phone?: string }) => void;
}

export const INITIAL_BLANK_PROFILE: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  targetRole: '',
  expectedSalary: '',
  currentLevel: '',
  experienceYears: '',
  foreignLanguages: '',
  availableDate: '',
  location: '',
  skills: [],
  bio: '',
};

const DEFAULT_PROFILE: CandidateProfile = {
  fullName: 'Nguyễn Văn Minh',
  email: 'minh.nguyen@gmail.com',
  phone: '0912 345 678',
  targetRole: 'Senior Fullstack Engineer / Frontend Specialist',
  expectedSalary: '45.000.000 - 65.000.000 đ/tháng',
  currentLevel: 'Senior Level / Team Lead',
  experienceYears: '5+ năm kinh nghiệm',
  foreignLanguages: 'Tiếng Anh (IELTS 7.0 / Giao tiếp công việc thành thạo)',
  availableDate: 'Sẵn sàng làm việc ngay lập tức',
  location: 'Hà Nội & TP. Hồ Chí Minh (Hybrid / Remote)',
  skills: ['ReactJS', 'TypeScript', 'Node.js', 'Next.js', 'TailwindCSS', 'GraphQL', 'Microservices', 'Docker', 'PostgreSQL'],
  bio: 'Kỹ sư phần mềm 5+ năm kinh nghiệm chuyên sâu về ReactJS, TypeScript và kiến trúc Microservices. Đam mê xây dựng trải nghiệm người dùng hiệu năng cao, tối ưu SEO và thiết kế hệ thống mở rộng.',
};

const resolveUserEmail = (email?: string): string => {
  if (email) return email.toLowerCase().trim();
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.user?.email) {
        return parsed.state.user.email.toLowerCase().trim();
      }
    }
  } catch {}
  return '';
};

const DEFAULT_CVS: CandidateCV[] = [
  {
    id: 'cv-01',
    userEmail: 'minh.nguyen@gmail.com',
    name: 'CV Senior Fullstack Engineer (ATS Standard 2026)',
    updatedAt: '16/09/2026',
    size: '2.4 MB',
    isDefault: true,
    atsScore: 94,
    type: 'Platform Builder',
  },
  {
    id: 'cv-02',
    userEmail: 'minh.nguyen@gmail.com',
    name: 'CV Frontend Lead & React Architecture',
    updatedAt: '08/09/2026',
    size: '1.8 MB',
    isDefault: false,
    atsScore: 89,
    type: 'Template ATS',
  },
  {
    id: 'cv-03',
    userEmail: 'minh.nguyen@gmail.com',
    name: 'Nguyen_Van_Minh_Resume_English.pdf',
    updatedAt: '01/09/2026',
    size: '3.1 MB',
    isDefault: false,
    atsScore: 92,
    type: 'File Upload',
  },
];

const DEFAULT_SAVED_JOBS: SavedJobItem[] = [
  { jobId: 'job-hot-003', userEmail: 'minh.nguyen@gmail.com' },
  { jobId: 'job-hot-005', userEmail: 'minh.nguyen@gmail.com' },
];

const DEFAULT_APPLICATIONS: CandidateApplication[] = [
  {
    id: 'app-01',
    jobId: 'job-hot-001',
    jobTitle: 'Senior Java Backend Engineer',
    company: 'TechCorp Enterprise Solutions',
    salary: '45.000.000 - 70.000.000 đ/tháng',
    appliedDate: '12/09/2026',
    status: 'OFFER',
    statusLabel: 'Nhận Offer / Thử việc',
    statusColor: '#10b981',
    cvUsed: 'CV Senior Fullstack Engineer (ATS Standard 2026)',
    coverLetter: 'Tôi có hơn 5 năm kinh nghiệm về Java Spring Boot và hệ thống Microservices quy mô hàng triệu người dùng.',
    applicantName: 'Nguyễn Văn Minh',
    applicantEmail: 'minh.nguyen@gmail.com',
    candidateEmail: 'minh.nguyen@gmail.com',
    applicantPhone: '0912 345 678',
    offerDetails: {
      salary: '58.000.000 đ/tháng (Gross) + Thưởng hiệu suất OPR',
      startDate: '01/10/2026',
      position: 'Senior Backend Engineer / Spring Cloud Lead',
      note: 'Thời gian thử việc 02 tháng hưởng 100% lương chính thức, đóng bảo hiểm full lương và cấp MacBook Pro M3 Max.',
      status: 'PENDING',
    },
  },
  {
    id: 'app-02',
    jobId: 'job-hot-002',
    jobTitle: 'Senior Frontend Developer (React / Next.js)',
    company: 'DigitalWave FinTech Agency',
    salary: '40.000.000 - 65.000.000 đ/tháng',
    appliedDate: '15/09/2026',
    status: 'INTERVIEW',
    statusLabel: 'Phỏng vấn kỹ thuật (Vòng 2)',
    statusColor: '#8b5cf6',
    cvUsed: 'CV Senior Fullstack Engineer (ATS Standard 2026)',
    coverLetter: 'Mong muốn được đóng góp chuyên môn React, TypeScript và tối ưu Core Web Vitals cho ứng dụng FinTech.',
    applicantName: 'Nguyễn Văn Minh',
    applicantEmail: 'minh.nguyen@gmail.com',
    candidateEmail: 'minh.nguyen@gmail.com',
    applicantPhone: '0912 345 678',
  },
  {
    id: 'app-03',
    jobId: 'job-hot-004',
    jobTitle: 'Senior Data Engineer (Big Data & AI)',
    company: 'RetailGiant Global Labs',
    salary: '42.000.000 - 68.000.000 đ/tháng',
    appliedDate: '17/09/2026',
    status: 'SCREENED',
    statusLabel: 'Sơ tuyển AI (Điểm khớp 88%)',
    statusColor: '#0284c7',
    cvUsed: 'CV Frontend Lead & React Architecture',
    coverLetter: 'Hồ sơ đã qua vòng thẩm định tự động của HR Connect AI.',
    applicantName: 'Nguyễn Văn Minh',
    applicantEmail: 'minh.nguyen@gmail.com',
    candidateEmail: 'minh.nguyen@gmail.com',
    applicantPhone: '0912 345 678',
  },
];

const DEFAULT_INTERVIEWS: InterviewSchedule[] = [
  {
    id: 'int-01',
    candidateEmail: 'minh.nguyen@gmail.com',
    applicantEmail: 'minh.nguyen@gmail.com',
    jobTitle: 'Senior Frontend Developer (React / Next.js)',
    company: 'DigitalWave FinTech Agency',
    datetime: '14:30 - Thứ Năm, 24/09/2026',
    mode: 'ONLINE',
    status: 'SCHEDULED',
    link: 'https://meet.google.com/hrc-tech-interview-2026',
    interviewers: 'Trần Long Quân (Head of Engineering) & Đặng Thu Thảo (Talent Acquisition)',
    notes: 'Phỏng vấn Live Coding 45 phút trên CodeSandbox (TypeScript & React Component Architecture) + Q&A kỹ thuật chuyên sâu.',
  },
  {
    id: 'int-02',
    candidateEmail: 'minh.nguyen@gmail.com',
    applicantEmail: 'minh.nguyen@gmail.com',
    jobTitle: 'Tech Lead / Frontend Architect',
    company: 'NextGen Digital Labs',
    datetime: '09:30 - Thứ Hai, 28/09/2026',
    mode: 'OFFLINE',
    status: 'SCHEDULED',
    address: 'Tầng 18, Tòa nhà Bitexco Financial Tower, Số 2 Hải Triều, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    interviewers: 'Nguyễn Hoàng Nam (CTO) & Hội đồng Ban Giám đốc',
    notes: 'Trao đổi định hướng phát triển sản phẩm quy mô khu vực và chế độ đãi ngộ ESOP.',
  },
];

const DEFAULT_RECRUITER_CONNECTS: RecruiterConnectItem[] = [
  {
    id: 'rec-con-01',
    candidateEmail: 'minh.nguyen@gmail.com',
    userEmail: 'minh.nguyen@gmail.com',
    recruiterId: 'hh-01',
    recruiterName: 'Nguyễn Thu Trang',
    recruiterTitle: 'Senior IT Headhunter & Sourcing Lead (TalentX Vietnam)',
    recruiterAvatar: 'TT',
    cvUsed: 'CV Senior Fullstack Engineer (ATS Standard 2026)',
    sentDate: '15/09/2026',
    note: 'Nhờ Chị Trang kết nối vị trí Tech Lead hoặc Senior ReactJS tại các công ty Fintech chi trả mức đãi ngộ trên $2,500.',
    status: 'MATCHED',
    statusLabel: 'Đã ghép nối vào Job FinTech Unicorn',
    statusColor: '#10b981',
    matchedJob: 'Fintech Unicorn Vietnam - Senior Frontend Lead Architect',
  },
  {
    id: 'rec-con-02',
    candidateEmail: 'minh.nguyen@gmail.com',
    userEmail: 'minh.nguyen@gmail.com',
    recruiterId: 'hh-04',
    recruiterName: 'Lê Quốc Hưng',
    recruiterTitle: 'Tech Lead & CTO Executive Search (Prime Talent)',
    recruiterAvatar: 'QH',
    cvUsed: 'CV Senior Fullstack Engineer (ATS Standard 2026)',
    sentDate: '18/09/2026',
    note: 'Gửi hồ sơ tham khảo các cơ hội vị trí Quản lý kỹ thuật và Solution Architect.',
    status: 'ACCEPTED',
    statusLabel: 'Recruiter đã tiếp nhận hồ sơ',
    statusColor: '#8b5cf6',
  },
];

export const useCandidateStore = create<CandidateState>()(
  persist(
    (set, get) => ({
      profile: INITIAL_BLANK_PROFILE,
      cvs: [],
      savedJobs: [],
      savedJobIds: [],
      applications: [],
      interviews: [],
      recruiterConnects: [],

      resetCandidateStore: () => {
        set({
          profile: INITIAL_BLANK_PROFILE,
          cvs: [],
          savedJobs: [],
          savedJobIds: [],
          applications: [],
          interviews: [],
          recruiterConnects: [],
        });
      },

      loadDemoData: () => {
        set({
          profile: DEFAULT_PROFILE,
          cvs: DEFAULT_CVS,
          savedJobs: DEFAULT_SAVED_JOBS,
          savedJobIds: ['job-hot-003', 'job-hot-005'],
          applications: DEFAULT_APPLICATIONS,
          interviews: DEFAULT_INTERVIEWS,
          recruiterConnects: DEFAULT_RECRUITER_CONNECTS,
        });
      },

      initCandidateFromUser: (user) => {
        set((state) => ({
          profile: {
            ...state.profile,
            // Always overwrite identity fields from the logged-in account
            fullName: user.name || state.profile.fullName || '',
            email:    user.email || state.profile.email || '',
            phone:    user.phone || state.profile.phone || '',
          },
        }));
      },

      updateProfile: (profileUpdate) => {
        set((state) => ({
          profile: { ...state.profile, ...profileUpdate },
        }));
      },

      toggleSaveJob: (jobId, email) => {
        const userEmail = resolveUserEmail(email);
        if (!userEmail) return false;
        const currentSaved = get().savedJobs || [];
        const exists = currentSaved.some(
          (j) => j.jobId === jobId && (j.userEmail || '').toLowerCase().trim() === userEmail
        );
        const newSaved = exists
          ? currentSaved.filter(
              (j) => !(j.jobId === jobId && (j.userEmail || '').toLowerCase().trim() === userEmail)
            )
          : [...currentSaved, { jobId, userEmail }];

        try {
          const userKey = `hrconnect_saved_jobs_${userEmail}`;
          const userJobIds = newSaved
            .filter((j) => (j.userEmail || '').toLowerCase().trim() === userEmail)
            .map((j) => j.jobId);
          localStorage.setItem(userKey, JSON.stringify(userJobIds));
        } catch {}

        set({
          savedJobs: newSaved,
          savedJobIds: newSaved
            .filter((j) => (j.userEmail || '').toLowerCase().trim() === userEmail)
            .map((j) => j.jobId),
        });
        return !exists;
      },

      isJobSaved: (jobId, email) => {
        const userEmail = resolveUserEmail(email);
        if (!userEmail) return false;
        const currentSaved = get().savedJobs || [];
        return currentSaved.some(
          (j) => j.jobId === jobId && (j.userEmail || '').toLowerCase().trim() === userEmail
        );
      },

      applyJob: (applicationData) => {
        const userEmail = applicationData.applicantEmail || resolveUserEmail();
        const newApp: CandidateApplication = {
          id: `app-${Date.now()}`,
          jobId: applicationData.jobId,
          jobTitle: applicationData.jobTitle,
          company: applicationData.company,
          salary: applicationData.salary,
          cvUsed: applicationData.cvUsed,
          coverLetter: applicationData.coverLetter,
          applicantName: applicationData.applicantName,
          applicantEmail: userEmail,
          candidateEmail: userEmail,
          applicantPhone: applicationData.applicantPhone,
          appliedDate: 'Hôm nay (Vừa xong)',
          status: 'SUBMITTED',
          statusLabel: 'Đã nộp hồ sơ (Chờ AI sơ duyệt)',
          statusColor: '#0284c7',
        };
        set((state) => ({
          applications: [newApp, ...state.applications],
        }));
      },

      setDefaultCV: (cvId) => {
        set((state) => ({
          cvs: state.cvs.map((c) => ({
            ...c,
            isDefault: c.id === cvId,
          })),
        }));
      },

      addCV: (newCv) => {
        set((state) => ({
          cvs: [newCv, ...state.cvs],
        }));
      },

      deleteCV: (cvId) => {
        set((state) => ({
          cvs: state.cvs.filter((c) => c.id !== cvId),
        }));
      },

      respondToOffer: (appId, decision) => {
        set((state) => ({
          applications: state.applications.map((app) => {
            if (app.id === appId && app.offerDetails) {
              return {
                ...app,
                offerDetails: {
                  ...app.offerDetails,
                  status: decision,
                },
                statusLabel: decision === 'ACCEPTED' ? 'Đã chấp thuận Offer (Chuẩn bị nhận việc)' : 'Đã từ chối Offer',
                statusColor: decision === 'ACCEPTED' ? '#10b981' : '#64748b',
              };
            }
            return app;
          }),
        }));
      },

      addRecruiterConnect: (item) => {
        const userEmail = item.candidateEmail || resolveUserEmail();
        const newConnect: RecruiterConnectItem = {
          id: `rec-con-${Date.now()}`,
          recruiterId: item.recruiterId,
          recruiterName: item.recruiterName,
          recruiterTitle: item.recruiterTitle,
          recruiterAvatar: item.recruiterAvatar,
          cvUsed: item.cvUsed,
          note: item.note,
          candidateEmail: userEmail,
          userEmail: userEmail,
          sentDate: 'Hôm nay',
          status: 'SENT',
          statusLabel: 'Đã gửi hồ sơ thành công',
          statusColor: '#0284c7',
        };
        set((state) => ({
          recruiterConnects: [newConnect, ...state.recruiterConnects],
        }));
      },
    }),
    {
      name: 'hr-connect-candidate-data',
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('hrconnect:logout', () => {
    // Preserve candidate store data across role switches and reloads
  });
}
