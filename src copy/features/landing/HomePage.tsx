import React, { useState, useEffect } from 'react';
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
  ArrowRightOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ServiceBanner } from './components/ServiceBanner';
import { PlatformStats } from './components/PlatformStats';
import { CareerInsights } from './components/CareerInsights';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from './components/FeaturedHotJobs';
import { INDUSTRY_TAXONOMY } from '@/constants/industryTaxonomy';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { useI18nStore } from '@/i18n';
import { UserRole } from '@/types/roles';

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

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18nStore();
  const { isAuthenticated, role } = useAuthStore();
  const { cvs, toggleSaveJob, isJobSaved, applyJob, addRecruiterConnect } = useCandidateStore();

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

  // Job Search filters
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState<string | undefined>();
  const [location, setLocation] = useState<string | undefined>();

  // Recruiter Search filter
  const [recruiterSearch, setRecruiterSearch] = useState('');

  // Quick Apply Modal State
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<FeaturedJobItem | null>(null);
  const [selectedCvId, setSelectedCvId] = useState<string>(cvs[0]?.id || 'cv-01');
  const [coverNote, setCoverNote] = useState('');

  // Connect Headhunter Modal State
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedHeadhunter, setSelectedHeadhunter] = useState<OPRHeadhunter | null>(null);
  const [headhunterNote, setHeadhunterNote] = useState('');

  // Filter Jobs
  const filteredJobs = FEATURED_HOT_JOBS.filter((job) => {
    const q = keyword.toLowerCase().trim();
    const matchKeyword =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.tags.some((t) => t.toLowerCase().includes(q));

    const matchLocation =
      !location ||
      location === 'ALL' ||
      (location === 'HN' && job.location.includes('Hà Nội')) ||
      (location === 'HCM' && job.location.includes('Hồ Chí Minh')) ||
      (location === 'DN' && job.location.includes('Đà Nẵng')) ||
      (location === 'REMOTE' && job.workMode === 'Remote');

    return matchKeyword && matchLocation;
  });

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
  const handleApplyClick = (job: FeaturedJobItem) => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!');
      navigate('/login');
      return;
    }
    setSelectedJob(job);
    setApplyModalOpen(true);
  };

  // Confirm Apply
  const handleConfirmApply = () => {
    if (!selectedJob) return;
    const chosenCv = cvs.find((c) => c.id === selectedCvId) || cvs[0];
    applyJob({
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      company: selectedJob.company,
      salary: `${(selectedJob.salaryMin / 1000000).toFixed(0)} - ${(selectedJob.salaryMax / 1000000).toFixed(0)} Triệu VNĐ`,
      cvUsed: chosenCv?.name || 'CV chính',
    });
    setApplyModalOpen(false);
    message.success({
      content: `Ứng tuyển thành công vào vị trí "${selectedJob.title}" tại ${selectedJob.company}! Bạn có thể theo dõi tiến độ trong mục 'Lịch sử ứng tuyển'.`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      duration: 4,
    });
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
      note: headhunterNote || 'Nhờ chuyên gia tư vấn và kết nối cơ hội việc làm phù hợp.',
    });
    setConnectModalOpen(false);
    message.success({
      content: `Đã gửi hồ sơ kết nối thành công tới Chuyên gia ${selectedHeadhunter.name}! Dữ liệu đã lưu vào mục 'Hồ sơ gửi Recruiter'.`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      duration: 4,
    });
  };

  const locationOptions = [
    { value: 'ALL', label: 'Tất cả địa điểm' },
    { value: 'HN', label: '📍 Hà Nội' },
    { value: 'HCM', label: '📍 TP. Hồ Chí Minh' },
    { value: 'DN', label: '📍 Đà Nẵng' },
    { value: 'REMOTE', label: '🌐 Làm việc từ xa (Remote)' },
  ];

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      {/* 1. Header Navbar */}
      <Navbar />

      {/* 2. Hero Interactive Center */}
      <section
        style={{
          position: 'relative',
          padding: '64px 24px 48px',
          textAlign: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0f172a 0%, #111e38 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 420,
            background: 'radial-gradient(ellipse at center, rgba(2, 132, 199, 0.22) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto' }}>
          {/* Top Announcement Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              borderRadius: 100,
              padding: '6px 16px',
              marginBottom: 20,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 10px #38bdf8',
              }}
            />
            <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Sàn Giao Dịch Việc Làm & Mạng Lưới Headhunter OPR Hub
            </span>
          </div>

          {/* Title */}
          <Title
            level={1}
            style={{
              color: '#f8fafc',
              fontSize: 'clamp(28px, 4.5vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 16,
              letterSpacing: '-1px',
            }}
          >
            Tìm Việc Công Nghệ Chuẩn ATS &{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Kết Nối Headhunter Uy Tín
            </span>
          </Title>

          <Paragraph
            style={{
              color: '#94a3b8',
              fontSize: 'clamp(15px, 1.8vw, 17px)',
              maxWidth: 760,
              margin: '0 auto 36px',
              lineHeight: 1.65,
            }}
          >
            Ứng tuyển 1-chạm vào các công việc đãi ngộ cao hoặc gửi hồ sơ bảo mật tới 1.200+ Chuyên gia tuyển dụng công nghệ OPR Hub để được săn đón.
          </Paragraph>

          {/* ─── Mode Switcher Segmented ─── */}
          <div style={{ display: 'inline-block', marginBottom: 28 }}>
            <Segmented
              size="large"
              value={mode}
              onChange={(val) => handleModeChange(val as 'jobs' | 'recruiters')}
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                padding: 4,
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
              options={[
                {
                  label: (
                    <span style={{ fontWeight: 700, padding: '6px 18px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CompassOutlined />
                      Tìm kiếm Việc làm
                    </span>
                  ),
                  value: 'jobs',
                },
                {
                  label: (
                    <span style={{ fontWeight: 700, padding: '6px 18px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <TeamOutlined />
                      Mạng lưới Recruiter / Headhunter (OPR Hub)
                    </span>
                  ),
                  value: 'recruiters',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 64px' }}>
        {/* =========================================
            CHẾ ĐỘ 1: TÌM KIẾM VIỆC LÀM (Job Cards Grid)
            ========================================= */}
        {mode === 'jobs' && (
          <div>
            {/* Search Filter Bar */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 18,
                padding: '16px',
                marginBottom: 40,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) minmax(130px, auto)',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {/* Field 1: Keyword */}
                <Input
                  size="large"
                  allowClear
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  prefix={<SearchOutlined style={{ color: '#0284c7', marginRight: 4 }} />}
                  placeholder="Từ khóa chức danh, kỹ năng (Java, React, AI...)"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                  }}
                />

                {/* Field 2: Cây phân loại ngành nghề (TreeSelect) */}
                <TreeSelect
                  showSearch
                  size="large"
                  allowClear
                  value={industry}
                  onChange={setIndustry}
                  treeData={INDUSTRY_TAXONOMY}
                  placeholder={
                    <span>
                      <ApartmentOutlined style={{ color: '#0ea5e9', marginRight: 6 }} />
                      Ngành nghề tuyển dụng
                    </span>
                  }
                  filterTreeNode={(search, node) =>
                    String(node.title ?? '').toLowerCase().includes(search.toLowerCase())
                  }
                  popupMatchSelectWidth={false}
                  style={{ width: '100%', height: 48 }}
                  dropdownStyle={{ borderRadius: 12, maxHeight: 380 }}
                />

                {/* Field 3: Địa điểm */}
                <Select
                  size="large"
                  allowClear
                  value={location}
                  onChange={setLocation}
                  placeholder={
                    <span>
                      <EnvironmentOutlined style={{ color: '#10b981', marginRight: 6 }} />
                      Địa điểm làm việc
                    </span>
                  }
                  options={locationOptions}
                  style={{ width: '100%', height: 48 }}
                />

                {/* Search Button */}
                <Button
                  type="primary"
                  size="large"
                  icon={<SearchOutlined />}
                  style={{
                    height: 48,
                    padding: '0 24px',
                    fontWeight: 700,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  }}
                >
                  Tìm kiếm ({filteredJobs.length})
                </Button>
              </div>
            </div>

            {/* Job Count Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: 20 }}>
                  Danh Sách Việc Làm Đang Tuyển Dụng
                </span>
                <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 12 }}>
                  Tìm thấy <strong style={{ color: '#38bdf8' }}>{filteredJobs.length}</strong> cơ hội phù hợp
                </span>
              </div>
            </div>

            {/* ─── JOB CARDS GRID (3 Columns, NO Antd Table) ─── */}
            <Row gutter={[20, 20]}>
              {filteredJobs.map((job) => {
                const isSaved = isJobSaved(job.id);

                return (
                  <Col key={job.id} xs={24} md={12} lg={8} style={{ display: 'flex' }}>
                    <div
                      style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 18,
                        padding: '22px 20px',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'rgba(2, 132, 199, 0.45)';
                        e.currentTarget.style.boxShadow = '0 16px 36px rgba(2, 132, 199, 0.16)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
                      }}
                    >
                      <div>
                        {/* Company Logo, Name & Bookmark Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 16,
                                flexShrink: 0,
                              }}
                            >
                              {job.company.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
                                {job.company}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                <Tag color="blue" style={{ borderRadius: 4, fontSize: 10, margin: 0, fontWeight: 600 }}>
                                  {job.workMode}
                                </Tag>
                                <Tag color="default" style={{ borderRadius: 4, fontSize: 10, margin: 0, background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: 'none' }}>
                                  {job.level}
                                </Tag>
                              </div>
                            </div>
                          </div>

                          {/* Nút icon "Lưu tin" (Bookmark) */}
                          <button
                            type="button"
                            onClick={() => {
                              const savedNow = toggleSaveJob(job.id);
                              if (savedNow) {
                                message.success(`Đã lưu "${job.title}" vào mục Việc làm đã lưu!`);
                              } else {
                                message.info(`Đã bỏ lưu "${job.title}".`);
                              }
                            }}
                            title={isSaved ? 'Bỏ lưu tin này' : 'Lưu tin việc làm'}
                            style={{
                              background: isSaved ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              border: isSaved ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: 10,
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              color: isSaved ? '#ef4444' : '#94a3b8',
                            }}
                          >
                            {isSaved ? <HeartFilled style={{ fontSize: 16 }} /> : <HeartOutlined style={{ fontSize: 16 }} />}
                          </button>
                        </div>

                        {/* Job Title */}
                        <div
                          style={{
                            color: '#f8fafc',
                            fontWeight: 800,
                            fontSize: 16,
                            lineHeight: 1.35,
                            marginBottom: 10,
                            minHeight: 44,
                          }}
                        >
                          {job.title}
                        </div>

                        {/* Salary in VND prominent */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#34d399',
                            fontWeight: 800,
                            fontSize: 16,
                            marginBottom: 8,
                          }}
                        >
                          <DollarOutlined />
                          <span>
                            {(job.salaryMin / 1000000).toFixed(0)} - {(job.salaryMax / 1000000).toFixed(0)} Triệu VNĐ / tháng
                          </span>
                        </div>

                        {/* Location */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
                          <EnvironmentOutlined />
                          <span>{job.location}</span>
                        </div>

                        {/* Technical Skills Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                          {job.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: '#cbd5e1',
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                fontWeight: 500,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Bottom: Nút Ứng tuyển ngay */}
                      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                        <Button
                          type="primary"
                          block
                          onClick={() => handleApplyClick(job)}
                          style={{
                            borderRadius: 10,
                            fontWeight: 700,
                            height: 42,
                            fontSize: 14,
                            background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                            border: 'none',
                            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                          }}
                        >
                          Ứng tuyển ngay
                        </Button>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>
        )}

        {/* =========================================
            CHẾ ĐỘ 2: TÌM KIẾM RECRUITER / HEADHUNTER
            ========================================= */}
        {mode === 'recruiters' && (
          <div>
            {/* Recruiter Intro & Search */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 20,
                padding: '32px 28px',
                marginBottom: 36,
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                    <StarFilled /> Mạng Lưới Headhunter OPR Hub Thẩm Định
                  </div>
                  <Title level={3} style={{ color: '#fff', margin: '0 0 6px', fontWeight: 800 }}>
                    Nhờ Chuyên Gia Tuyển Dụng Săn Việc & Tư Vấn Lương
                  </Title>
                  <Paragraph style={{ color: '#94a3b8', margin: 0, maxWidth: 650, fontSize: 14 }}>
                    Gửi CV trực tiếp cho các Headhunter hàng đầu trong ngành để nhận cơ hội việc làm kín (Confidential Jobs) và hỗ trợ đàm phán mức đãi ngộ cao nhất.
                  </Paragraph>
                </div>

                {/* Recruiter Search input */}
                <div style={{ width: 320 }}>
                  <Input
                    size="large"
                    allowClear
                    placeholder="Tìm theo chuyên môn: Java, AI, Cloud..."
                    prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                    value={recruiterSearch}
                    onChange={(e) => setRecruiterSearch(e.target.value)}
                    style={{
                      borderRadius: 10,
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Recruiter Cards Grid */}
            <Row gutter={[20, 20]}>
              {filteredHeadhunters.map((hh) => (
                <Col key={hh.id} xs={24} md={12} lg={8} style={{ display: 'flex' }}>
                  <div
                    style={{
                      background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 18,
                      padding: '24px 20px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    <div>
                      {/* Avatar, Name & Trust Rating Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                        <Avatar
                          size={54}
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            fontWeight: 800,
                            fontSize: 18,
                            flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
                          }}
                        >
                          {hh.avatar}
                        </Avatar>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>
                            {hh.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            {hh.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 600 }}>
                            {hh.company}
                          </div>
                        </div>
                      </div>

                      {/* Huy hiệu Điểm Tín Kết (Trust Rating) */}
                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 14,
                        }}
                      >
                        <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <StarFilled /> Trust Rating: {hh.trustRating}/5.0
                        </span>
                        <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600 }}>
                          {hh.placementsCount} deal thành công
                        </span>
                      </div>

                      {/* Specialties */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>
                          Chuyên môn săn việc:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {hh.specialties.map((spec) => (
                            <Tag
                              key={spec}
                              style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: '#cbd5e1',
                                fontSize: 11,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 6,
                              }}
                            >
                              {spec}
                            </Tag>
                          ))}
                        </div>
                      </div>

                      {/* Bio */}
                      <Paragraph style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
                        {hh.bio}
                      </Paragraph>
                    </div>

                    {/* Button Gửi hồ sơ nhờ kết nối */}
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                      <Button
                        type="primary"
                        block
                        icon={<SendOutlined />}
                        onClick={() => handleConnectHeadhunterClick(hh)}
                        style={{
                          borderRadius: 10,
                          fontWeight: 700,
                          height: 42,
                          fontSize: 14,
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          border: 'none',
                          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                        }}
                      >
                        Gửi hồ sơ nhờ kết nối
                      </Button>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </main>

      {/* 3. Platform Stats */}
      <PlatformStats />

      {/* 4. Career Insights */}
      <CareerInsights />

      {/* 5. Footer */}
      <footer
        style={{
          padding: '32px 40px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          maxWidth: 1240,
          margin: '0 auto',
        }}
      >
        <Text style={{ color: '#64748b', fontSize: 13 }}>
          {t.footer.copyright}
        </Text>
        <div style={{ display: 'flex', gap: 16 }}>
          <Button type="text" size="small" style={{ color: '#94a3b8', fontSize: 13 }}>
            {t.footer.privacy}
          </Button>
          <Button type="text" size="small" style={{ color: '#94a3b8', fontSize: 13 }}>
            {t.footer.terms}
          </Button>
          <Button type="text" size="small" style={{ color: '#94a3b8', fontSize: 13 }}>
            {t.footer.contact}
          </Button>
        </div>
      </footer>

      {/* ─── POPUP ỨNG TUYỂN NHANH TRÊN TRANG CHỦ (Quick Apply Modal) ─── */}
      <ApplyJobModal
        open={applyModalOpen}
        job={selectedJob}
        onClose={() => setApplyModalOpen(false)}
      />

      {/* ─── CONNECT HEADHUNTER MODAL ─── */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
              Gửi hồ sơ kết nối với Chuyên gia Headhunter
            </div>
            <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
              {selectedHeadhunter?.name} · {selectedHeadhunter?.company} (Trust: {selectedHeadhunter?.trustRating}★)
            </div>
          </div>
        }
        open={connectModalOpen}
        onCancel={() => setConnectModalOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ marginTop: 14 }}>
          <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: 10, border: '1px solid #fde68a', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
              🛡️ Cam kết bảo mật thông tin 100%
            </div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
              Headhunter sẽ không gửi hồ sơ của bạn cho bất kỳ doanh nghiệp nào nếu chưa có sự đồng ý của bạn.
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
            Chọn CV trong hồ sơ để gửi cho Chuyên gia:
          </div>

          <Radio.Group
            value={selectedCvId}
            onChange={(e) => setSelectedCvId(e.target.value)}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}
          >
            {cvs.map((cv) => (
              <Radio
                key={cv.id}
                value={cv.id}
                style={{
                  border: '1.5px solid #e2e8f0',
                  padding: '12px 14px',
                  borderRadius: 10,
                  width: '100%',
                  background: selectedCvId === cv.id ? '#fffbeb' : '#fff',
                  borderColor: selectedCvId === cv.id ? '#f59e0b' : '#e2e8f0',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{cv.name}</span>
                  <Tag color="gold" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>ATS: {cv.atsScore}%</Tag>
                </div>
              </Radio>
            ))}
          </Radio.Group>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
              Kỳ vọng công việc và lời nhắn riêng cho Chuyên gia:
            </div>
            <Input.TextArea
              rows={3}
              value={headhunterNote}
              onChange={(e) => setHeadhunterNote(e.target.value)}
              placeholder="VD: Tôi đang tìm vị trí Senior Tech Lead mảng Fintech tại TP.HCM hoặc Remote, kỳ vọng lương net 55M..."
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setConnectModalOpen(false)} style={{ borderRadius: 8 }}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              onClick={handleConfirmConnectHeadhunter}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
              }}
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
