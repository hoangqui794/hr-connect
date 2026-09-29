import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Typography,
  Button,
  Space,
  Segmented,
  Row,
  Col,
  Tag,
  Input,
  Select,
  TreeSelect,
  Modal,
  Radio,
  Avatar,
  message,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  DollarOutlined,
  HeartOutlined,
  HeartFilled,
  TeamOutlined,
  CompassOutlined,
  CheckCircleFilled,
  StarFilled,
  SendOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ThunderboltFilled,
  ArrowRightOutlined,
  GiftOutlined,
  FilterOutlined,
  ClearOutlined,
  FireOutlined,
  CodeOutlined,
  LineChartOutlined,
  ShopOutlined,
  RocketOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  BankOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CareerInsights } from './components/CareerInsights';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from './components/FeaturedHotJobs';
import { JobCard, JobCardData, deduplicateTags } from '@/components/common/JobCard';
import { JobCardHorizontal } from '@/components/common/JobCardHorizontal';
import { JobDetailModal } from '@/components/common/JobDetailModal';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { INDUSTRY_TAXONOMY } from '@/constants/industryTaxonomy';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { useSavedJobs, JobItem } from '@/hooks/useSavedJobs';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { useI18nStore } from '@/i18n';
import { ServiceType } from '@/types/job';

const { Title, Paragraph, Text } = Typography;

export interface OPRHeadhunter {
  id: string;
  name: string;
  avatar: string;
  title: string;
  company: string;
  trustRating: number;
  placementsCount: number;
  specialties: string[];
  bio: string;
}

export const MOCK_HEADHUNTERS: OPRHeadhunter[] = [
  {
    id: 'hh-01',
    name: 'David Trần',
    avatar: 'DT',
    title: 'Principal Tech Recruiter & Partner',
    company: 'RecruitPro Network',
    trustRating: 4.9,
    placementsCount: 68,
    specialties: ['Java', 'Golang', 'Fintech', 'Microservices'],
    bio: 'Chuyên gia săn nhân tài cấp cao với hơn 8 năm kinh nghiệm trong lĩnh vực Ngân hàng số và Hệ thống thanh toán.',
  },
  {
    id: 'hh-02',
    name: 'Sarah Nguyễn',
    avatar: 'SN',
    title: 'Lead Talent Consultant (AI & Big Data)',
    company: 'TalentHub Global',
    trustRating: 4.8,
    placementsCount: 54,
    specialties: ['Python', 'AI/ML', 'Data Engineer', 'Computer Vision'],
    bio: 'Đại sứ kết nối các kỹ sư AI và Data Scientist với các tập đoàn công nghệ đa quốc gia và AI Labs tại Việt Nam.',
  },
  {
    id: 'hh-03',
    name: 'Hoàng Nam',
    avatar: 'HN',
    title: 'Senior Executive Headhunter',
    company: 'NextGen Search',
    trustRating: 4.9,
    placementsCount: 72,
    specialties: ['Frontend React', 'Fullstack', 'Engineering Manager'],
    bio: 'Hỗ trợ định giá năng lực, thương lượng chế độ đãi ngộ và lộ trình thăng tiến cho các kỹ sư cấp Senior & Lead.',
  },
  {
    id: 'hh-04',
    name: 'Minh Thư',
    avatar: 'MT',
    title: 'Cloud & DevOps Talent Specialist',
    company: 'CloudHunter Partner',
    trustRating: 5.0,
    placementsCount: 45,
    specialties: ['DevOps', 'AWS/GCP', 'Kubernetes', 'Cybersecurity'],
    bio: 'Đồng hành cùng các chuyên gia hạ tầng Cloud & Bảo mật tiếp cận các dự án toàn cầu với mức thu nhập vượt trội.',
  },
  {
    id: 'hh-05',
    name: 'Quang Huy',
    avatar: 'QH',
    title: 'Mobile & Product Recruiter',
    company: 'AppVenture Talent',
    trustRating: 4.7,
    placementsCount: 39,
    specialties: ['React Native', 'iOS/Android', 'Product Management'],
    bio: 'Săn đầu người chuyên mảng Mobile Apps & Product Tech cho các Startup kỳ lân và các tổ chức công nghệ hàng đầu.',
  },
  {
    id: 'hh-06',
    name: 'Elena Lê',
    avatar: 'EL',
    title: 'Tech Lead & CTO Executive Search',
    company: 'Prime Talent Executive',
    trustRating: 4.9,
    placementsCount: 61,
    specialties: ['CTO', 'VPE', 'Solution Architect', 'Blockchain'],
    bio: 'Chuyên kết nối các vị trí lãnh đạo công nghệ (Tech Lead, Architect, CTO) với hội đồng quản trị các doanh nghiệp lớn.',
  },
];

// Top Employers (Thương hiệu lớn tiêu biểu - TopCV Vibe)
interface TopEmployer {
  id: string;
  name: string;
  industry: string;
  openJobsCount: number;
  logoBg: string;
  monogram: string;
}

const TOP_EMPLOYERS: TopEmployer[] = [
  {
    id: 'emp-fpt',
    name: 'FPT Software',
    industry: 'CNTT & Phần mềm',
    openJobsCount: 18,
    logoBg: 'from-orange-500 to-amber-600',
    monogram: 'FPT',
  },
  {
    id: 'emp-tc',
    name: 'TechCorp Solutions',
    industry: 'Enterprise SaaS',
    openJobsCount: 12,
    logoBg: 'from-blue-600 to-indigo-600',
    monogram: 'TC',
  },
  {
    id: 'emp-vnpay',
    name: 'VNPAY FinTech',
    industry: 'Cổng thanh toán điện tử',
    openJobsCount: 9,
    logoBg: 'from-rose-500 to-red-600',
    monogram: 'VN',
  },
  {
    id: 'emp-viettel',
    name: 'Viettel Digital',
    industry: 'Viễn thông & Công nghệ số',
    openJobsCount: 15,
    logoBg: 'from-emerald-600 to-teal-700',
    monogram: 'VT',
  },
  {
    id: 'emp-momo',
    name: 'MoMo SuperApp',
    industry: 'Ví điện tử & AI FinTech',
    openJobsCount: 8,
    logoBg: 'from-pink-500 to-rose-600',
    monogram: 'MM',
  },
  {
    id: 'emp-shopee',
    name: 'Shopee Vietnam',
    industry: 'E-Commerce & High-Load',
    openJobsCount: 11,
    logoBg: 'from-orange-600 to-amber-500',
    monogram: 'SP',
  },
  {
    id: 'emp-mb',
    name: 'MB Bank Digital',
    industry: 'Ngân hàng số',
    openJobsCount: 14,
    logoBg: 'from-blue-700 to-sky-600',
    monogram: 'MB',
  },
  {
    id: 'emp-vinai',
    name: 'VinAI Research',
    industry: 'Trí tuệ nhân tạo (AI Labs)',
    openJobsCount: 6,
    logoBg: 'from-violet-600 to-indigo-700',
    monogram: 'AI',
  },
];

// Top Trending Industries (Top ngành nghề nổi bật)
interface TrendingIndustry {
  id: string;
  name: string;
  icon: React.ReactNode;
  jobCount: string;
  colorClass: string;
  searchKeyword: string;
}

const TRENDING_INDUSTRIES: TrendingIndustry[] = [
  {
    id: 'ind-it',
    name: 'IT - Phần mềm & Cloud',
    icon: <CodeOutlined className="text-xl" />,
    jobCount: '320+ việc làm',
    colorClass: 'bg-blue-50 text-blue-600 border-blue-200/80',
    searchKeyword: 'Engineer',
  },
  {
    id: 'ind-sales',
    name: 'Kinh doanh & B2B Sales',
    icon: <ShopOutlined className="text-xl" />,
    jobCount: '185+ việc làm',
    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    searchKeyword: 'Sales',
  },
  {
    id: 'ind-mkt',
    name: 'Marketing & Growth',
    icon: <RocketOutlined className="text-xl" />,
    jobCount: '142+ việc làm',
    colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
    searchKeyword: 'Marketing',
  },
  {
    id: 'ind-hr',
    name: 'Tuyển dụng & HR Tech',
    icon: <TeamOutlined className="text-xl" />,
    jobCount: '96+ việc làm',
    colorClass: 'bg-purple-50 text-purple-600 border-purple-200/80',
    searchKeyword: 'HR',
  },
  {
    id: 'ind-fin',
    name: 'Tài chính & Fintech',
    icon: <BankOutlined className="text-xl" />,
    jobCount: '118+ việc làm',
    colorClass: 'bg-amber-50 text-amber-600 border-amber-200/80',
    searchKeyword: 'Fintech',
  },
  {
    id: 'ind-product',
    name: 'Thiết kế UI/UX & Product',
    icon: <AppstoreOutlined className="text-xl" />,
    jobCount: '84+ việc làm',
    colorClass: 'bg-pink-50 text-pink-600 border-pink-200/80',
    searchKeyword: 'Product',
  },
  {
    id: 'ind-ai',
    name: 'Data Science & AI',
    icon: <DatabaseOutlined className="text-xl" />,
    jobCount: '112+ việc làm',
    colorClass: 'bg-cyan-50 text-cyan-600 border-cyan-200/80',
    searchKeyword: 'Data',
  },
  {
    id: 'ind-ops',
    name: 'Vận hành & DevOps',
    icon: <ThunderboltOutlined className="text-xl" />,
    jobCount: '75+ việc làm',
    colorClass: 'bg-sky-50 text-sky-600 border-sky-200/80',
    searchKeyword: 'DevOps',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18nStore();
  const { isAuthenticated } = useAuthStore();
  const { cvs, applyJob, addRecruiterConnect } = useCandidateStore();
  const { isSaved: isJobSaved, toggleSaveJob } = useSavedJobs();

  const jobsSectionRef = useRef<HTMLDivElement>(null);

  // Mode switcher: 'jobs' vs 'recruiters'
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState<'jobs' | 'recruiters'>(
    modeParam === 'recruiters' ? 'recruiters' : 'jobs'
  );

  useEffect(() => {
    if (modeParam === 'recruiters') {
      setMode('recruiters');
    } else {
      setMode('jobs');
    }
  }, [modeParam]);

  const handleModeChange = (val: 'jobs' | 'recruiters') => {
    setMode(val);
    if (val === 'recruiters') {
      setSearchParams({ mode: 'recruiters' });
    } else {
      setSearchParams({});
    }
  };

  // ─── Hero Multi-Input Search State ───
  const [heroKeyword, setHeroKeyword] = useState('');
  const [heroIndustry, setHeroIndustry] = useState<string | undefined>();
  const [heroLocation, setHeroLocation] = useState<string | undefined>();

  // Quick category tag selection for Featured Jobs section on HomePage
  const [featuredCategory, setFeaturedCategory] = useState<string>('ALL');

  // Recruiter Search filter
  const [recruiterSearch, setRecruiterSearch] = useState('');

  // Modals state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<FeaturedJobItem | null>(null);
  const [selectedCvId, setSelectedCvId] = useState<string>(cvs[0]?.id || 'cv-01');

  // Job Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalJob, setDetailModalJob] = useState<JobCardData | null>(null);

  // Connect Headhunter Modal State
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedHeadhunter, setSelectedHeadhunter] = useState<OPRHeadhunter | null>(null);
  const [headhunterNote, setHeadhunterNote] = useState('');

  // Public jobs loaded dynamically from localStorage or fallback
  const [allPublicJobs, setAllPublicJobs] = useState<FeaturedJobItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hrconnect_all_jobs');
      let storedJobs: any[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedJobs = parsed;
        }
      }

      const activeStoredJobs: FeaturedJobItem[] = storedJobs
        .filter((j) => j.status === 'ACTIVE')
        .map((j) => {
          const salaryMin = j.salaryRange?.min || 20000000;
          const salaryMax = j.salaryRange?.max || 45000000;
          const commRate = j.engagementTerms?.commissionRate || 15;
          const estComm =
            Math.round((salaryMax * commRate) / 100).toLocaleString('vi-VN') + '₫';
          const rawTags = [...(j.mustHaveTags || []), ...(j.shouldHaveTags || [])];
          const tags = rawTags.length > 0 ? deduplicateTags(rawTags) : ['Công nghệ', 'Fulltime'];

          return {
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location || 'Hồ Chí Minh',
            workMode: j.remote ? 'Remote' : 'Hybrid',
            level: (j.level || 'Senior') as any,
            salaryMin,
            salaryMax,
            serviceType: (j.serviceType || 'HEADHUNT_COD') as any,
            commissionRate: commRate,
            estimatedCommission: estComm,
            tags,
            isUrgent: true,
          };
        });

      const existingIds = new Set(activeStoredJobs.map((j) => j.id));
      const merged = [
        ...activeStoredJobs,
        ...FEATURED_HOT_JOBS.filter((j) => !existingIds.has(j.id)),
      ];
      setAllPublicJobs(merged);
    } catch {
      setAllPublicJobs(FEATURED_HOT_JOBS);
    }
  }, []);

  // Featured Jobs for Showcase on HomePage
  const featuredJobs = useMemo(() => {
    const list = allPublicJobs.length > 0 ? allPublicJobs : FEATURED_HOT_JOBS;
    if (featuredCategory === 'ALL') {
      return list.slice(0, 8);
    }
    const cat = featuredCategory.toLowerCase();
    const matched = list.filter((job) =>
      job.title.toLowerCase().includes(cat) ||
      job.tags.some((t) => t.toLowerCase().includes(cat)) ||
      (cat === 'remote' && job.workMode.toLowerCase().includes('remote'))
    );
    return matched.length > 0 ? matched.slice(0, 8) : list.slice(0, 8);
  }, [allPublicJobs, featuredCategory]);

  // Filter Headhunters
  const filteredHeadhunters = MOCK_HEADHUNTERS.filter((hh) => {
    const q = recruiterSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      hh.name.toLowerCase().includes(q) ||
      hh.specialties.some((s) => s.toLowerCase().includes(q)) ||
      hh.company.toLowerCase().includes(q)
    );
  });

  // Handle Quick Apply button click on Job Card
  const handleApplyClick = (job: FeaturedJobItem | JobCardData) => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!');
      navigate('/login');
      return;
    }
    setSelectedJob(job as FeaturedJobItem);
    setApplyModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (job: JobCardData) => {
    setDetailModalJob(job);
    setDetailModalOpen(true);
  };

  // Handle Connect Headhunter
  const handleConnectHeadhunterClick = (hh: OPRHeadhunter) => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập để gửi hồ sơ kết nối với Headhunter!');
      navigate('/login');
      return;
    }
    setSelectedHeadhunter(hh);
    setConnectModalOpen(true);
  };

  const handleConfirmConnectHeadhunter = () => {
    if (!selectedHeadhunter) return;
    const chosenCv = cvs.find((c) => c.id === selectedCvId) || cvs[0];
    addRecruiterConnect({
      recruiterId: selectedHeadhunter.id,
      recruiterName: selectedHeadhunter.name,
      recruiterTitle: selectedHeadhunter.title,
      recruiterAvatar: selectedHeadhunter.avatar,
      cvUsed: chosenCv?.name || 'CV chính',
      note:
        headhunterNote || 'Nhờ chuyên gia tư vấn và kết nối cơ hội việc làm phù hợp.',
    });
    setConnectModalOpen(false);
    message.success({
      content: `Đã gửi hồ sơ kết nối thành công tới Chuyên gia ${selectedHeadhunter.name}! Dữ liệu đã lưu vào mục 'Hồ sơ gửi Recruiter'.`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      duration: 4,
    });
  };

  // Handle Hero Search: navigate to /jobs with query params
  const handleHeroSearch = () => {
    const params = new URLSearchParams();
    if (heroKeyword.trim()) params.set('keyword', heroKeyword.trim());
    if (heroLocation && heroLocation !== 'ALL') params.set('location', heroLocation);
    if (heroIndustry) params.set('industry', heroIndustry);
    navigate(`/jobs?${params.toString()}`);
  };

  const scrollToJobs = () => {
    jobsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Select Employer banner -> navigate to /jobs with query param
  const handleSelectEmployer = (empName: string) => {
    navigate(`/jobs?keyword=${encodeURIComponent(empName)}`);
  };

  // Select Industry banner -> navigate to /jobs with query param
  const handleSelectIndustry = (indKeyword: string) => {
    navigate(`/jobs?keyword=${encodeURIComponent(indKeyword)}`);
  };

  const locationOptions = [
    { value: 'ALL', label: 'Tất cả địa điểm' },
    { value: 'HN', label: '📍 Hà Nội' },
    { value: 'HCM', label: '📍 TP. Hồ Chí Minh' },
    { value: 'DN', label: '📍 Đà Nẵng' },
    { value: 'REMOTE', label: '🌐 Làm việc từ xa (Remote)' },
  ];

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* Spacer below Header/Navbar for optimal top buffer */}
      <div className="pt-2 sm:pt-4" />

      {/* 2. Hero Interactive Center with Stripe-Like Ambient Glow */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-50 to-[#F8FAFC]">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-gradient-to-b from-blue-400/10 via-indigo-400/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Sàn Tuyển Dụng AI & Mạng Lưới Headhunter Affiliate OPR Hub</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600 font-bold">Ver 2.5 Active</span>
          </div>

          {/* Charcoal Black Title (NO rainbow gradient) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-5">
            Tuyển Dụng Chuẩn ATS &amp;{' '}
            <span className="text-blue-600 inline-block">Săn Việc Đãi Ngộ Cao</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
            Nền tảng kết nối nhân tài công nghệ với 1.200+ Doanh nghiệp &amp; Mạng lưới
            Headhunter độc quyền OPR Hub. Khớp lệnh CV tự động bằng Sentence-BERT.
          </p>

          {/* Mode Switcher Segmented */}
          <div className="inline-block mb-8">
            <Segmented
              size="large"
              value={mode}
              onChange={(val) => handleModeChange(val as 'jobs' | 'recruiters')}
              className="p-1 rounded-xl bg-white border border-slate-200 shadow-sm"
              options={[
                {
                  label: (
                    <span className="font-bold px-4 py-1.5 text-sm inline-flex items-center gap-2">
                      <CompassOutlined className="text-blue-600" />
                      Tìm Kiếm Cơ Hội Việc Làm
                    </span>
                  ),
                  value: 'jobs',
                },
                {
                  label: (
                    <span className="font-bold px-4 py-1.5 text-sm inline-flex items-center gap-2">
                      <TeamOutlined className="text-amber-600" />
                      Mạng Lưới Headhunter (OPR Hub)
                    </span>
                  ),
                  value: 'recruiters',
                },
              ]}
            />
          </div>

          {/* ── TopCV Large Multi-Input Search Bar in Hero ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-2 flex flex-col md:flex-row items-stretch md:items-center gap-2 max-w-4xl mx-auto mb-8 text-left">
            {/* Phân vùng 1: Dropdown "Danh mục Nghề" */}
            <div className="w-full md:w-56 flex items-center px-3 py-1">
              <ApartmentOutlined className="text-blue-600 text-base mr-2 shrink-0" />
              <TreeSelect
                showSearch
                allowClear
                bordered={false}
                value={heroIndustry}
                onChange={setHeroIndustry}
                treeData={INDUSTRY_TAXONOMY}
                placeholder={<span className="text-slate-500 font-medium text-xs sm:text-sm">Danh mục Nghề</span>}
                popupMatchSelectWidth={false}
                className="w-full font-medium text-sm"
                dropdownStyle={{ borderRadius: 12, maxHeight: 380 }}
              />
            </div>

            {/* Ngăn cách 1 */}
            <div className="hidden md:block h-7 w-[1px] bg-slate-200 shrink-0" />

            {/* Phân vùng 2: Ô gõ từ khóa */}
            <div className="flex-1 flex items-center px-3 py-1">
              <SearchOutlined className="text-slate-400 text-base mr-2 shrink-0" />
              <Input
                bordered={false}
                allowClear
                value={heroKeyword}
                onChange={(e) => setHeroKeyword(e.target.value)}
                onPressEnter={handleHeroSearch}
                placeholder="Tìm kiếm vị trí, kỹ năng, công ty..."
                className="w-full text-sm font-medium focus:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* Ngăn cách 2 */}
            <div className="hidden md:block h-7 w-[1px] bg-slate-200 shrink-0" />

            {/* Phân vùng 3: Dropdown "Địa điểm" */}
            <div className="w-full md:w-48 flex items-center px-3 py-1">
              <EnvironmentOutlined className="text-emerald-600 text-base mr-2 shrink-0" />
              <Select
                bordered={false}
                allowClear
                value={heroLocation}
                onChange={setHeroLocation}
                placeholder={<span className="text-slate-500 font-medium text-xs sm:text-sm">Địa điểm</span>}
                options={locationOptions}
                className="w-full font-medium text-sm"
              />
            </div>

            {/* Nút Action: [Tìm kiếm] */}
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleHeroSearch}
              className="h-11 px-7 font-bold bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white shadow-xs border-none flex items-center justify-center shrink-0 transition-colors"
            >
              Tìm kiếm
            </Button>
          </div>

          {/* Social Proof Statistics (4 Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-2">
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 text-center shadow-2xs hover:shadow-xs transition-shadow">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                50.000+
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">
                Ứng viên Profile ATS
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 text-center shadow-2xs hover:shadow-xs transition-shadow">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600">
                1.200+
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">
                Doanh nghiệp &amp; Startup
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 text-center shadow-2xs hover:shadow-xs transition-shadow">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600">
                98%
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">
                Khớp lệnh AI ATS
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 text-center shadow-2xs hover:shadow-xs transition-shadow">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600">
                Hàng Tỷ VNĐ
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">
                Hoa hồng COD giải ngân
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Banner "Thương hiệu lớn tiêu biểu" (TopCV Vibe Partner Grid) */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FireOutlined className="text-rose-500" />
              Thương Hiệu Doanh Nghiệp Tiêu Biểu
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Các đối tác tuyển dụng công nghệ chiến lược đang mở đợt tuyển lớn trên HR Connect
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 hidden sm:inline-block">
            Nhấp vào thương hiệu để xem việc làm
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {TOP_EMPLOYERS.map((emp) => (
            <div
              key={emp.id}
              onClick={() => handleSelectEmployer(emp.name)}
              className="group bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-400 rounded-xl p-3 text-center shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col items-center justify-between"
            >
              <CompanyLogo
                companyName={emp.name}
                size="sm"
                className="mb-2 rounded-xl"
              />
              <div className="text-xs font-bold text-slate-800 truncate w-full group-hover:text-blue-600 transition-colors">
                {emp.name}
              </div>
              <div className="mt-1.5">
                <span className="inline-block text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  {emp.openJobsCount} việc làm
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Banner "Top ngành nghề nổi bật" (Trending Career Grid) */}
      <section id="top-industries" className="pt-6 mt-4 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ApartmentOutlined className="text-blue-600" />
              Top Ngành Nghề Nổi Bật &amp; Tuyển Dụng Cao
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cơ hội việc làm đãi ngộ cạnh tranh phân chia theo nhóm chuyên môn cốt lõi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5">
          {TRENDING_INDUSTRIES.map((ind) => (
            <div
              key={ind.id}
              onClick={() => handleSelectIndustry(ind.searchKeyword)}
              className="group bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-3.5"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${ind.colorClass} group-hover:scale-105 transition-transform`}
              >
                {ind.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                  {ind.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  {ind.jobCount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. MAIN CONTENT AREA: JOBS VS RECRUITERS */}
      <main
        ref={jobsSectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
      >
        {/* =========================================================================
            CHẾ ĐỘ 1: TÌM KIẾM VIỆC LÀM (Job Cards Grid + Advanced Multi-Layer Filter)
            ========================================================================= */}
        {/* =========================================================================
            CHẾ ĐỘ 1: VIỆC LÀM TIÊU BIỂU & TUYỂN GẤP (Featured Jobs Showcase)
            ========================================================================= */}
        {mode === 'jobs' && (
          <div className="space-y-6">
            {/* Header: Tiêu đề + Nút xem tất cả việc làm */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full mb-1.5">
                  <FireOutlined className="text-rose-500" />
                  Hot Opportunities
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Việc Làm Tiêu Biểu &amp; Tuyển Gấp Đãi Ngộ Cao
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Top cơ hội việc làm tuyển chọn từ các đối tác lớn, xét duyệt nhanh và thưởng COD cao nhất
                </p>
              </div>

              <Button
                type="primary"
                id="btn-view-all-jobs"
                onClick={() => navigate('/jobs')}
                className="h-10 px-5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs border-none flex items-center gap-1.5 shrink-0 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Xem tất cả {allPublicJobs.length > 0 ? `${allPublicJobs.length}+` : '12+'} việc làm</span>
                <ArrowRightOutlined />
              </Button>
            </div>

            {/* Quick Category Tag Pills Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { label: '🔥 Tất cả việc làm', val: 'ALL' },
                { label: '☕ Java / Spring Boot', val: 'Java' },
                { label: '⚛️ React / Frontend', val: 'React' },
                { label: '🤖 AI / Python / Data', val: 'Python' },
                { label: '🐹 Golang / Backend', val: 'Golang' },
                { label: '☁️ DevOps / Cloud', val: 'DevOps' },
                { label: '📱 Mobile (Flutter/iOS)', val: 'Mobile' },
                { label: '🌐 Remote / Làm từ xa', val: 'Remote' },
              ].map((pill) => (
                <button
                  key={pill.val}
                  type="button"
                  onClick={() => setFeaturedCategory(pill.val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    featuredCategory === pill.val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-blue-600 border-slate-200/90 hover:border-blue-300'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Featured Jobs List (TopCV Horizontal Cards) */}
            <div className="space-y-3.5">
              {featuredJobs.map((job) => {
                const isSaved = isJobSaved(job.id);

                return (
                  <JobCardHorizontal
                    key={job.id}
                    job={{
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      companyLogo: job.companyLogo,
                      location: job.location,
                      workMode: job.workMode,
                      level: job.level,
                      salaryMin: job.salaryMin,
                      salaryMax: job.salaryMax,
                      serviceType: job.serviceType,
                      commissionRate: job.commissionRate,
                      estimatedCommission: job.estimatedCommission,
                      tags: job.tags,
                      isUrgent: job.isUrgent,
                      deadline: job.deadline,
                    }}
                    isSaved={isSaved}
                    onToggleSave={() => {
                      toggleSaveJob(job as unknown as JobItem);
                    }}
                    onViewDetail={(j) => navigate(`/jobs/${j.id}`)}
                    onQuickApply={(j) => handleApplyClick(j)}
                  />
                );
              })}
            </div>

            {/* Bottom Call to Action Banner to Explore /jobs */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md mt-8">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center justify-center md:justify-start gap-1.5">
                  <ThunderboltFilled className="text-amber-400" />
                  Sàn Tuyển Dụng Công Nghệ &amp; Headhunting Toàn Diện
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white">
                  Bạn muốn tìm việc làm chuẩn theo mức lương, cấp bậc và kỹ năng?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Khám phá trang tìm kiếm chuyên sâu với bộ lọc đa tiêu chí chuẩn TopCV, chấm điểm ATS Sentence-BERT tự động và thưởng hoa hồng COD khi giới thiệu ứng viên.
                </p>
              </div>

              <Button
                size="large"
                type="primary"
                onClick={() => navigate('/jobs')}
                className="h-12 px-8 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-none shadow-md shrink-0 flex items-center gap-2"
              >
                <span>Khám Phá Sàn Tuyển Dụng (/jobs)</span>
                <ArrowRightOutlined />
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            CHẾ ĐỘ 2: TÌM KIẾM RECRUITER / HEADHUNTER (Mạng lưới OPR Hub)
            ========================================================================= */}
        {mode === 'recruiters' && (
          <div>
            {/* Recruiter Intro & Search */}
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full mb-2">
                    <StarFilled className="text-amber-500" />
                    Mạng Lưới Headhunter OPR Hub Thẩm Định Độc Quyền
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Ủy Thác Chuyên Gia Săn Việc &amp; Tư Vấn Đãi Ngộ
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1">
                    Gửi CV an toàn cho các Headhunter hàng đầu để tiếp cận các vị trí kín (Confidential Jobs) và được hỗ trợ đàm phán mức lương cao nhất thị trường.
                  </p>
                </div>

                {/* Recruiter Search input */}
                <div className="w-full sm:w-80">
                  <Input
                    size="large"
                    allowClear
                    placeholder="Tìm theo chuyên môn: Java, AI, Cloud..."
                    prefix={<SearchOutlined className="text-slate-400 mr-1" />}
                    value={recruiterSearch}
                    onChange={(e) => setRecruiterSearch(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Recruiter Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHeadhunters.map((hh) => (
                <div
                  key={hh.id}
                  className="bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-amber-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Avatar, Name & Trust Rating Badge */}
                    <div className="flex items-center gap-3.5 mb-3.5">
                      <Avatar
                        size={52}
                        className="bg-gradient-to-br from-amber-500 to-orange-600 font-extrabold text-base flex-shrink-0 shadow-sm border border-white/20"
                      >
                        {hh.avatar}
                      </Avatar>

                      <div className="min-w-0">
                        <div className="font-bold text-base text-slate-900 truncate">
                          {hh.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {hh.title}
                        </div>
                        <div className="text-xs text-blue-600 font-semibold truncate">
                          {hh.company}
                        </div>
                      </div>
                    </div>

                    {/* Huy hiệu Điểm Tín Kết (Trust Rating) */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between mb-3.5">
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        <StarFilled className="text-amber-500" /> Trust: {hh.trustRating}/5.0
                      </span>
                      <span className="text-2xs font-semibold text-amber-900">
                        {hh.placementsCount} deal thành công
                      </span>
                    </div>

                    {/* Specialties */}
                    <div className="mb-3.5">
                      <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Chuyên môn săn việc:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {hh.specialties.map((spec) => (
                          <span
                            key={spec}
                            className="text-2xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                      {hh.bio}
                    </p>
                  </div>

                  {/* Action Button */}
                  <div className="pt-3 border-t border-slate-100">
                    <Button
                      type="primary"
                      block
                      icon={<SendOutlined />}
                      onClick={() => handleConnectHeadhunterClick(hh)}
                      className="h-10 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 border-none shadow-sm text-white"
                    >
                      Gửi hồ sơ nhờ kết nối
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 6. Career Insights Section */}
      <CareerInsights />

      {/* 7. Footer */}
      <footer className="border-t border-slate-200/90 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>{t.footer.copyright}</div>
        <div className="flex items-center gap-4">
          <button type="button" className="hover:text-slate-800 transition-colors">
            {t.footer.privacy}
          </button>
          <button type="button" className="hover:text-slate-800 transition-colors">
            {t.footer.terms}
          </button>
          <button type="button" className="hover:text-slate-800 transition-colors">
            {t.footer.contact}
          </button>
        </div>
      </footer>

      {/* ─── MODAL XEM CHI TIẾT CÔNG VIỆC (JOB DETAIL MODAL) ─── */}
      <JobDetailModal
        open={detailModalOpen}
        job={detailModalJob}
        onClose={() => setDetailModalOpen(false)}
        onApply={(job) => {
          setDetailModalOpen(false);
          handleApplyClick(job);
        }}
        isSaved={detailModalJob ? isJobSaved(detailModalJob.id) : false}
        onToggleSave={(jobId) => {
          toggleSaveJob((detailModalJob as unknown as JobItem) || jobId);
        }}
      />

      {/* ─── MODAL ỨNG TUYỂN NHANH (ApplyJobModal) ─── */}
      <ApplyJobModal
        open={applyModalOpen}
        job={selectedJob}
        onClose={() => setApplyModalOpen(false)}
      />

      {/* ─── CONNECT HEADHUNTER MODAL ─── */}
      <Modal
        title={
          <div>
            <div className="font-bold text-base text-slate-900">
              Gửi hồ sơ kết nối với Chuyên gia Headhunter
            </div>
            <div className="text-xs text-amber-600 font-semibold mt-0.5">
              {selectedHeadhunter?.name} · {selectedHeadhunter?.company} (Trust:{' '}
              {selectedHeadhunter?.trustRating}★)
            </div>
          </div>
        }
        open={connectModalOpen}
        onCancel={() => setConnectModalOpen(false)}
        footer={null}
        width={540}
        centered
        className="rounded-2xl overflow-hidden"
      >
        <div className="mt-3 space-y-4">
          <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200/80">
            <div className="text-xs font-bold text-amber-800 flex items-center gap-1">
              🛡️ Cam kết bảo mật thông tin hồ sơ
            </div>
            <div className="text-2xs text-amber-700 mt-0.5 leading-relaxed">
              Headhunter sẽ không gửi hồ sơ của bạn cho bất kỳ doanh nghiệp nào nếu chưa có sự đồng ý trực tiếp từ bạn.
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-800 mb-2">
              Chọn CV trong hồ sơ để gửi cho Chuyên gia:
            </div>

            <Radio.Group
              value={selectedCvId}
              onChange={(e) => setSelectedCvId(e.target.value)}
              className="w-full flex flex-col gap-2"
            >
              {cvs.map((cv) => (
                <Radio
                  key={cv.id}
                  value={cv.id}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedCvId === cv.id
                      ? 'bg-amber-50/60 border-amber-400'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="inline-flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{cv.name}</span>
                    <Tag color="gold" className="text-3xs font-bold m-0">
                      ATS: {cv.atsScore}%
                    </Tag>
                  </div>
                </Radio>
              ))}
            </Radio.Group>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-800 mb-1">
              Kỳ vọng công việc và lời nhắn riêng cho Chuyên gia:
            </div>
            <Input.TextArea
              rows={3}
              value={headhunterNote}
              onChange={(e) => setHeadhunterNote(e.target.value)}
              placeholder="VD: Tôi đang tìm vị trí Senior Tech Lead mảng Fintech tại TP.HCM hoặc Remote, kỳ vọng lương gross 55M..."
              className="rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              onClick={() => setConnectModalOpen(false)}
              className="rounded-xl font-medium"
            >
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              onClick={handleConfirmConnectHeadhunter}
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-500 border-none text-white"
            >
              Gửi hồ sơ cho Headhunter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
