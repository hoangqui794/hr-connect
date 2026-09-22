import React, { useState, useMemo } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, Input, Modal, Radio, message,
  Row, Col, Select, Tooltip, Empty, Segmented, Badge, Avatar,
} from 'antd';
import {
  SearchOutlined,
  PlusCircleOutlined,
  EyeOutlined,
  UserAddOutlined,
  FileTextOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  HeartOutlined,
  HeartFilled,
  SendOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '@/services/queries/useJobs';
import { ServiceType, JobStatus, SERVICE_TYPE_LABELS } from '@/types/job';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/job';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  [ServiceType.HEADHUNT_COD]: '#0284c7',
  [ServiceType.CV_SOURCING]: '#10b981',
  [ServiceType.CV_APPLICATION]: '#8b5cf6',
};

/**
 * Định dạng khoảng lương chuẩn Việt Nam (VND):
 * Ví dụ: "45.000.000 - 70.000.000 đ/tháng" (không chứa ký hiệu $ phía trước).
 */
export const formatSalaryVND = (min: number, max: number, currency: string = 'VND'): string => {
  const minStr = min.toLocaleString('vi-VN');
  const maxStr = max.toLocaleString('vi-VN');

  if (currency === 'USD') {
    return `$${minStr} - $${maxStr}/tháng`;
  }
  return `${minStr} - ${maxStr} đ/tháng`;
};

// Helper lấy 2 ký tự đầu tên công ty để tạo logo avatar
const getCompanyInitials = (company: string): string => {
  if (!company) return 'CO';
  const words = company.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export const JobListTable: React.FC = () => {
  const navigate = useNavigate();
  const { role, user } = useAuthStore();
  const { isJobSaved, toggleSaveJob, applyJob, cvs } = useCandidateStore();
  const { data: jobs, isLoading } = useJobs();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [salaryFilter, setSalaryFilter] = useState('ALL');
  const [workTypeFilter, setWorkTypeFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');

  // View mode: Candidates default to visual Job Cards; recruiters can toggle
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(
    role === UserRole.CANDIDATE || role === UserRole.GUEST ? 'cards' : 'table'
  );

  // Quick Apply Modal state for Candidate
  const [selectedJobForApply, setSelectedJobForApply] = useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedCv, setSelectedCv] = useState('cv-1');
  const [coverNote, setCoverNote] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);

  // Job Detail Modal state
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleOpenApplyModal = (job: Job) => {
    setSelectedJobForApply(job);
    setIsApplyModalOpen(true);
  };

  const handleOpenDetailModal = (job: Job) => {
    setSelectedJobForDetail(job);
    setIsDetailModalOpen(true);
  };

  const handleToggleBookmark = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const saved = toggleSaveJob(jobId);
    if (saved) {
      message.success('Đã lưu tin tuyển dụng vào danh sách Việc làm đã lưu!');
    } else {
      message.info('Đã bỏ lưu tin tuyển dụng.');
    }
  };

  const handleConfirmApply = async () => {
    if (!selectedJobForApply) return;
    setSubmittingApply(true);
    await new Promise((r) => setTimeout(r, 400));

    const selectedCvObj = cvs.find((c) => c.id === selectedCv);
    const cvName = selectedCvObj ? selectedCvObj.name : 'CV Mặc định (ATS Standard)';

    applyJob({
      jobId: selectedJobForApply.id,
      jobTitle: selectedJobForApply.title,
      company: selectedJobForApply.company,
      salary: formatSalaryVND(
        selectedJobForApply.salaryRange.min,
        selectedJobForApply.salaryRange.max,
        selectedJobForApply.salaryRange.currency
      ),
      cvUsed: cvName,
      coverLetter: coverNote,
      applicantName: user?.name,
      applicantEmail: user?.email,
      applicantPhone: user?.phone,
    });

    setSubmittingApply(false);
    setIsApplyModalOpen(false);
    setCoverNote('');
    message.success({
      content: `Nộp hồ sơ ứng tuyển thành công vị trí "${selectedJobForApply.title}" tại ${selectedJobForApply.company}!`,
      icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      duration: 3.5,
    });
  };

  const handleResetFilters = () => {
    setSearch('');
    setLocationFilter('ALL');
    setSalaryFilter('ALL');
    setWorkTypeFilter('ALL');
    setLevelFilter('ALL');
  };

  const isFilterActive =
    search.trim() !== '' ||
    locationFilter !== 'ALL' ||
    salaryFilter !== 'ALL' ||
    workTypeFilter !== 'ALL' ||
    levelFilter !== 'ALL';

  // Lọc đa tiêu chí theo từ khóa, địa điểm, mức lương, hình thức làm việc và cấp bậc
  const filteredJobs = useMemo(() => {
    return (jobs ?? []).filter((j) => {
      // 1. Keyword search (title, company, mustHaveTags, shouldHaveTags, objectives)
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchTitle = j.title.toLowerCase().includes(query);
        const matchCompany = j.company.toLowerCase().includes(query);
        const matchLocation = j.location.toLowerCase().includes(query);
        const matchSkills = [
          ...(j.mustHaveTags ?? []),
          ...(j.shouldHaveTags ?? []),
        ].some((t) => t.toLowerCase().includes(query));
        const matchObj = j.objectives?.toLowerCase().includes(query);

        if (!matchTitle && !matchCompany && !matchLocation && !matchSkills && !matchObj) {
          return false;
        }
      }

      // 2. Location filter
      if (locationFilter !== 'ALL') {
        if (locationFilter === 'HN' && !j.location.includes('Hà Nội')) return false;
        if (locationFilter === 'HCM' && !j.location.includes('Hồ Chí Minh')) return false;
        if (locationFilter === 'DN' && !j.location.includes('Đà Nẵng')) return false;
        if (locationFilter === 'REMOTE' && !j.remote) return false;
      }

      // 3. Salary filter
      if (salaryFilter !== 'ALL') {
        const max = j.salaryRange.max;
        if (salaryFilter === 'UNDER_20' && max > 20000000) return false;
        if (salaryFilter === '20_40' && (max < 20000000 || j.salaryRange.min > 40000000)) return false;
        if (salaryFilter === '40_60' && (max < 40000000 || j.salaryRange.min > 60000000)) return false;
        if (salaryFilter === 'OVER_60' && max < 60000000) return false;
        if (salaryFilter === 'NEGOTIABLE' && !j.salaryRange.negotiable) return false;
      }

      // 4. Work type filter (Remote vs Onsite)
      if (workTypeFilter !== 'ALL') {
        if (workTypeFilter === 'REMOTE' && !j.remote) return false;
        if (workTypeFilter === 'ONSITE' && j.remote) return false;
      }

      // 5. Level filter
      if (levelFilter !== 'ALL') {
        const combined = `${j.title} ${(j.mustHaveTags ?? []).join(' ')}`.toLowerCase();
        if (levelFilter === 'JUNIOR' && !combined.includes('junior') && !combined.includes('fresher')) return false;
        if (levelFilter === 'MIDDLE' && !combined.includes('middle') && !combined.includes('chuyên viên')) return false;
        if (levelFilter === 'SENIOR' && !combined.includes('senior') && !combined.includes('cấp cao')) return false;
        if (levelFilter === 'LEAD' && !combined.includes('lead') && !combined.includes('trưởng nhóm') && !combined.includes('manager')) return false;
      }

      return true;
    });
  }, [jobs, search, locationFilter, salaryFilter, workTypeFilter, levelFilter]);

  // Cấu hình cột bảng: Đã ẨN hoàn toàn các cột nghiệp vụ nội bộ ('Gói dịch vụ', 'Số ứng viên') đối với Ứng viên
  const columns: ColumnsType<Job> = [
    {
      title: 'Vị trí công việc',
      key: 'title',
      width: 320,
      render: (_, record) => (
        <div>
          <div
            onClick={() => handleOpenDetailModal(record)}
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: '#0f172a',
              lineHeight: 1.4,
              cursor: 'pointer',
            }}
          >
            {record.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>{record.company}</span> ·{' '}
            <EnvironmentOutlined style={{ marginRight: 2 }} />
            {record.location}
            {record.remote && (
              <Tag color="cyan" style={{ marginLeft: 6, fontSize: 10, borderRadius: 4 }}>
                Remote
              </Tag>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {record.mustHaveTags?.slice(0, 3).map((tag) => (
              <Tag
                key={tag}
                style={{
                  borderRadius: 6,
                  fontSize: 11,
                  margin: 0,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      ),
    },
    // Chỉ hiển thị cột "Gói dịch vụ" cho Quản trị viên và HR nội bộ
    ...((role === UserRole.INTERNAL_HR || role === UserRole.ADMIN)
      ? [
          {
            title: 'Gói dịch vụ',
            dataIndex: 'serviceType',
            key: 'serviceType',
            width: 180,
            render: (type: ServiceType) => {
              const label = SERVICE_TYPE_LABELS[type] || type.replace('_', ' ');
              const color = SERVICE_TYPE_COLOR[type] || '#0284c7';
              return (
                <Tag
                  style={{
                    color,
                    background: `${color}14`,
                    border: `1px solid ${color}30`,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                    padding: '2px 8px',
                  }}
                >
                  {label}
                </Tag>
              );
            },
          },
        ]
      : []),
    {
      title: 'Mức lương',
      key: 'salary',
      width: 240,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#059669', letterSpacing: '-0.01em' }}>
            {formatSalaryVND(record.salaryRange.min, record.salaryRange.max, record.salaryRange.currency)}
          </div>
          {record.salaryRange.negotiable && (
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
              (Thỏa thuận theo năng lực)
            </div>
          )}
        </div>
      ),
    },
    ...(role === UserRole.AFFILIATE
      ? [
          {
            title: 'Hoa hồng',
            key: 'commission',
            width: 140,
            render: (_: unknown, record: Job) => (
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0284c7' }}>
                  {record.engagementTerms?.commissionRate || 15}%
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>tháng lương đầu</div>
              </div>
            ),
          },
        ]
      : []),
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: JobStatus) => {
        const isActive = status === JobStatus.ACTIVE;
        return (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 11,
              padding: '2px 8px',
              border: isActive ? '1px solid #86efac' : '1px solid #e2e8f0',
              background: isActive ? '#f0fdf4' : '#f8fafc',
              color: isActive ? '#16a34a' : '#64748b',
            }}
          >
            {isActive
              ? 'Đang tuyển'
              : status === JobStatus.PAUSED
              ? 'Tạm dừng'
              : status === JobStatus.CLOSED
              ? 'Đã đóng'
              : 'Bản nháp'}
          </Tag>
        );
      },
    },
    // Chỉ hiển thị "Số ứng viên" cho Doanh nghiệp, HR nội bộ và Admin
    ...((role === UserRole.CLIENT || role === UserRole.INTERNAL_HR || role === UserRole.ADMIN)
      ? [
          {
            title: 'Số ứng viên',
            key: 'applicants',
            width: 130,
            render: (_: unknown, record: Job) => (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                  {record.applicationCount}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {record.shortlistedCount} đã sơ loại
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      title: 'Thao tác',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {role === UserRole.AFFILIATE && (
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => navigate('/affiliate/referral')}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
              }}
            >
              Giới thiệu
            </Button>
          )}

          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetailModal(record)}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Chi tiết
          </Button>

          {(role === UserRole.CANDIDATE || role === UserRole.GUEST) && (
            <>
              <Tooltip title={isJobSaved(record.id) ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}>
                <Button
                  size="small"
                  icon={
                    isJobSaved(record.id) ? (
                      <HeartFilled style={{ color: '#ef4444' }} />
                    ) : (
                      <HeartOutlined style={{ color: '#94a3b8' }} />
                    )
                  }
                  onClick={(e) => handleToggleBookmark(e, record.id)}
                  style={{ borderRadius: 6 }}
                />
              </Tooltip>
              <Button
                type="primary"
                size="small"
                style={{
                  borderRadius: 6,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                }}
                onClick={() => handleOpenApplyModal(record)}
              >
                Ứng tuyển
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header Bar */}
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: '0 0 4px', fontWeight: 800, color: '#0f172a' }}>
            {role === UserRole.AFFILIATE
              ? '💼 Bảng tin việc làm — Cơ hội hoa hồng Headhunter'
              : role === UserRole.CANDIDATE
              ? '🎯 Khám phá cơ hội việc làm công nghệ'
              : '📋 Danh sách vị trí tuyển dụng'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {role === UserRole.AFFILIATE
              ? 'Giới thiệu ứng viên tiềm năng và nhận hoa hồng hấp dẫn khi ứng viên thử việc thành công.'
              : role === UserRole.CANDIDATE
              ? 'Tìm kiếm công việc lý tưởng với mức đãi ngộ minh bạch, nộp hồ sơ chuẩn ATS 1-click.'
              : 'Quản lý, theo dõi tiến độ tuyển dụng và hồ sơ ứng viên trên hệ thống.'}
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Switch View Mode (Cards vs Table) */}
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'cards' | 'table')}
            options={[
              { label: 'Dạng thẻ', value: 'cards', icon: <AppstoreOutlined /> },
              { label: 'Dạng bảng', value: 'table', icon: <UnorderedListOutlined /> },
            ]}
            style={{
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 8,
              fontWeight: 600,
            }}
          />

          {role === UserRole.CLIENT && (
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              onClick={() => navigate('/jobs/create')}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                height: 38,
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              }}
            >
              Tạo tin tuyển dụng mới
            </Button>
          )}
        </div>
      </div>

      {/* ─── Search & Advanced Filter Section ─── */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          background: '#ffffff',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[12, 12]} align="middle">
          {/* Search Input */}
          <Col xs={24} lg={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 15 }} />}
              placeholder="Tìm theo vị trí, kỹ năng (Java, React...), công ty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              size="middle"
              style={{ borderRadius: 8, height: 40 }}
            />
          </Col>

          {/* Location Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              value={locationFilter}
              onChange={setLocationFilter}
              style={{ width: '100%', height: 40 }}
              options={[
                { value: 'ALL', label: 'Tất cả địa điểm' },
                { value: 'HCM', label: 'TP. Hồ Chí Minh' },
                { value: 'HN', label: 'Hà Nội' },
                { value: 'DN', label: 'Đà Nẵng' },
                { value: 'REMOTE', label: 'Làm từ xa (Remote)' },
              ]}
            />
          </Col>

          {/* Salary Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              value={salaryFilter}
              onChange={setSalaryFilter}
              style={{ width: '100%', height: 40 }}
              options={[
                { value: 'ALL', label: 'Tất cả mức lương' },
                { value: 'UNDER_20', label: 'Dưới 20 triệu' },
                { value: '20_40', label: '20 - 40 triệu' },
                { value: '40_60', label: '40 - 60 triệu' },
                { value: 'OVER_60', label: 'Trên 60 triệu' },
                { value: 'NEGOTIABLE', label: 'Lương thỏa thuận' },
              ]}
            />
          </Col>

          {/* Work Type Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              value={workTypeFilter}
              onChange={setWorkTypeFilter}
              style={{ width: '100%', height: 40 }}
              options={[
                { value: 'ALL', label: 'Tất cả hình thức' },
                { value: 'REMOTE', label: 'Làm việc từ xa' },
                { value: 'ONSITE', label: 'Làm tại văn phòng' },
              ]}
            />
          </Col>

          {/* Level Filter */}
          <Col xs={12} sm={6} lg={4}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select
                value={levelFilter}
                onChange={setLevelFilter}
                style={{ flex: 1, height: 40 }}
                options={[
                  { value: 'ALL', label: 'Tất cả cấp bậc' },
                  { value: 'JUNIOR', label: 'Junior' },
                  { value: 'MIDDLE', label: 'Middle' },
                  { value: 'SENIOR', label: 'Senior' },
                  { value: 'LEAD', label: 'Lead / Manager' },
                ]}
              />

              {isFilterActive && (
                <Tooltip title="Đặt lại toàn bộ bộ lọc">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleResetFilters}
                    style={{ height: 40, borderRadius: 8, borderColor: '#cbd5e1' }}
                  />
                </Tooltip>
              )}
            </div>
          </Col>
        </Row>

        {/* Filter Summary & Counter */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: '#64748b',
            borderTop: '1px solid #f1f5f9',
            paddingTop: 10,
          }}
        >
          <span>
            Tìm thấy <strong style={{ color: '#0f172a' }}>{filteredJobs.length}</strong> vị trí việc làm phù hợp
          </span>

          {isFilterActive && (
            <Button
              type="link"
              size="small"
              onClick={handleResetFilters}
              style={{ padding: 0, fontSize: 12, color: '#ef4444' }}
            >
              Xóa tất cả bộ lọc
            </Button>
          )}
        </div>
      </Card>

      {/* ─── DẠNG HIỂN THỊ 1: DẠNG THẺ JOB CARDS (Dành cho Ứng viên & Trực quan) ─── */}
      {viewMode === 'cards' && (
        <div>
          {filteredJobs.length === 0 ? (
            <Card style={{ borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
              <Empty
                description="Không tìm thấy việc làm nào phù hợp với điều kiện tìm kiếm của bạn."
                style={{ padding: '20px 0' }}
              >
                <Button type="primary" onClick={handleResetFilters} style={{ borderRadius: 8 }}>
                  Xóa bộ lọc để xem tất cả việc làm
                </Button>
              </Empty>
            </Card>
          ) : (
            <Row gutter={[20, 20]}>
              {filteredJobs.map((job) => {
                const isSaved = isJobSaved(job.id);
                return (
                  <Col key={job.id} xs={24} md={12} lg={8}>
                    <Card
                      hoverable
                      style={{
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.25s ease',
                      }}
                      styles={{
                        body: {
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        },
                      }}
                    >
                      {/* Card Top: Company info & Bookmark Button */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <Avatar
                            shape="square"
                            size={44}
                            style={{
                              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: 16,
                              borderRadius: 10,
                              boxShadow: '0 2px 8px rgba(2,132,199,0.25)',
                              flexShrink: 0,
                            }}
                          >
                            {getCompanyInitials(job.company)}
                          </Avatar>
                          <div style={{ overflow: 'hidden' }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {job.company}
                              </span>
                              <CheckCircleFilled
                                style={{ color: '#0284c7', fontSize: 13, flexShrink: 0 }}
                                title="Doanh nghiệp xác thực"
                              />
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                              <EnvironmentOutlined style={{ marginRight: 4 }} />
                              {job.location}
                            </div>
                          </div>
                        </div>

                        {/* Bookmark Heart Button */}
                        <Tooltip title={isSaved ? 'Bỏ lưu việc làm' : 'Lưu tin này'}>
                          <Button
                            type="text"
                            shape="circle"
                            icon={
                              isSaved ? (
                                <HeartFilled style={{ color: '#ef4444', fontSize: 18 }} />
                              ) : (
                                <HeartOutlined style={{ color: '#94a3b8', fontSize: 18 }} />
                              )
                            }
                            onClick={(e) => handleToggleBookmark(e, job.id)}
                            style={{
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isSaved ? '#fef2f2' : '#f8fafc',
                            }}
                          />
                        </Tooltip>
                      </div>

                      {/* Card Middle: Title & Salary */}
                      <div style={{ marginBottom: 12 }}>
                        <Title
                          level={5}
                          onClick={() => handleOpenDetailModal(job)}
                          style={{
                            margin: '0 0 8px',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1.4,
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: 44,
                          }}
                        >
                          {job.title}
                        </Title>

                        <div
                          style={{
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: 8,
                            padding: '6px 12px',
                            display: 'inline-block',
                            color: '#059669',
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {formatSalaryVND(
                            job.salaryRange.min,
                            job.salaryRange.max,
                            job.salaryRange.currency
                          )}
                          {job.salaryRange.negotiable && (
                            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 4 }}>
                              (Thỏa thuận)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Tags: Skills & Remote badge */}
                      <div style={{ marginBottom: 14, flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {job.remote && (
                            <Tag
                              color="blue"
                              style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, margin: 0 }}
                            >
                              Làm từ xa (Remote)
                            </Tag>
                          )}
                          <Tag
                            style={{
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              margin: 0,
                              background: '#f8fafc',
                              borderColor: '#e2e8f0',
                              color: '#64748b',
                            }}
                          >
                            {job.industryLabel || 'Công nghệ thông tin'}
                          </Tag>
                        </div>

                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[...(job.mustHaveTags ?? []), ...(job.shouldHaveTags ?? [])]
                            .slice(0, 4)
                            .map((tag) => (
                              <Tag
                                key={tag}
                                style={{
                                  borderRadius: 6,
                                  fontSize: 11,
                                  margin: 0,
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  color: '#334155',
                                  padding: '1px 6px',
                                }}
                              >
                                {tag}
                              </Tag>
                            ))}
                        </div>
                      </div>

                      {/* Card Footer: Deadline & Action Buttons */}
                      <div
                        style={{
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: 14,
                          marginTop: 'auto',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {job.deadline ? `Hạn nộp: ${job.deadline.slice(0, 10)}` : 'Đang mở tuyển'}
                        </div>

                        <Space size="small">
                          <Button
                            size="small"
                            onClick={() => handleOpenDetailModal(job)}
                            style={{
                              borderRadius: 6,
                              fontWeight: 600,
                              fontSize: 12,
                              borderColor: '#cbd5e1',
                            }}
                          >
                            Chi tiết
                          </Button>

                          {role === UserRole.AFFILIATE ? (
                            <Button
                              type="primary"
                              size="small"
                              icon={<UserAddOutlined />}
                              onClick={() => navigate('/affiliate/referral')}
                              style={{
                                borderRadius: 6,
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none',
                              }}
                            >
                              Giới thiệu
                            </Button>
                          ) : (
                            <Button
                              type="primary"
                              size="small"
                              icon={<SendOutlined />}
                              onClick={() => handleOpenApplyModal(job)}
                              style={{
                                borderRadius: 6,
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                border: 'none',
                                boxShadow: '0 2px 6px rgba(139,92,246,0.3)',
                              }}
                            >
                              Ứng tuyển
                            </Button>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      )}

      {/* ─── DẠNG HIỂN THỊ 2: DẠNG BẢNG (TABLE VIEW) ─── */}
      {viewMode === 'table' && (
        <Card
          style={{
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            columns={columns}
            dataSource={filteredJobs}
            loading={isLoading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Tổng cộng ${total} vị trí`,
              style: { paddingRight: 16, marginBottom: 16 },
            }}
            scroll={{ x: 950 }}
          />
        </Card>
      )}

      {/* ─── MODAL 1: XEM CHI TIẾT JOB DESCRIPTION (JD) ─── */}
      <Modal
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={680}
        title={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar
              shape="square"
              size={40}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                color: '#fff',
                fontWeight: 800,
                borderRadius: 8,
              }}
            >
              {selectedJobForDetail ? getCompanyInitials(selectedJobForDetail.company) : 'CO'}
            </Avatar>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                {selectedJobForDetail?.title}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                {selectedJobForDetail?.company} · {selectedJobForDetail?.location}
              </div>
            </div>
          </div>
        }
      >
        {selectedJobForDetail && (
          <div style={{ marginTop: 16 }}>
            {/* Quick highlight box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Mức thu nhập dự kiến:</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#059669' }}>
                  {formatSalaryVND(
                    selectedJobForDetail.salaryRange.min,
                    selectedJobForDetail.salaryRange.max,
                    selectedJobForDetail.salaryRange.currency
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {selectedJobForDetail.remote && (
                  <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>
                    Làm việc từ xa (Remote)
                  </Tag>
                )}
                <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                  {selectedJobForDetail.industryLabel}
                </Tag>
              </div>
            </div>

            {/* Objectives */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 6 }}>
                🎯 Mục tiêu & Trách nhiệm công việc:
              </div>
              <Paragraph style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                {selectedJobForDetail.objectives ||
                  'Chịu trách nhiệm trực tiếp trong quy trình phát triển, phối hợp chặt chẽ với đội ngũ kỹ thuật để đảm bảo chất lượng hệ thống.'}
              </Paragraph>
            </div>

            {/* Requirements & Tags */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 8 }}>
                🛠️ Kỹ năng & Yêu cầu trọng tâm:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {selectedJobForDetail.mustHaveTags?.map((tag) => (
                  <Tag
                    key={tag}
                    color="purple"
                    style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, padding: '2px 8px' }}
                  >
                    Bắt buộc: {tag}
                  </Tag>
                ))}
                {selectedJobForDetail.shouldHaveTags?.map((tag) => (
                  <Tag
                    key={tag}
                    style={{ borderRadius: 6, fontSize: 12, background: '#f1f5f9', padding: '2px 8px' }}
                  >
                    Ưu tiên: {tag}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div
              style={{
                borderTop: '1px solid #f1f5f9',
                paddingTop: 16,
                marginTop: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Button
                icon={
                  isJobSaved(selectedJobForDetail.id) ? (
                    <HeartFilled style={{ color: '#ef4444' }} />
                  ) : (
                    <HeartOutlined />
                  )
                }
                onClick={(e) => handleToggleBookmark(e, selectedJobForDetail.id)}
                style={{ borderRadius: 8 }}
              >
                {isJobSaved(selectedJobForDetail.id) ? 'Đã lưu việc làm' : 'Lưu tin tuyển dụng'}
              </Button>

              <Space>
                <Button onClick={() => setIsDetailModalOpen(false)} style={{ borderRadius: 8 }}>
                  Đóng
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenApplyModal(selectedJobForDetail);
                  }}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    border: 'none',
                  }}
                >
                  Ứng tuyển ngay
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL 2: QUICK APPLY MODAL FOR CANDIDATE ─── */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
              Ứng tuyển nhanh vào vị trí
            </div>
            <div style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 600, marginTop: 2 }}>
              {selectedJobForApply?.title} · {selectedJobForApply?.company}
            </div>
          </div>
        }
        open={isApplyModalOpen}
        onCancel={() => setIsApplyModalOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              marginBottom: 16,
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Mức thu nhập vị trí:</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>
                {selectedJobForApply &&
                  formatSalaryVND(
                    selectedJobForApply.salaryRange.min,
                    selectedJobForApply.salaryRange.max,
                    selectedJobForApply.salaryRange.currency
                  )}
              </div>
            </div>
            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
              Chuẩn ATS AI Screen
            </Tag>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
            Chọn CV để nộp tức thì:
          </div>

          <Radio.Group
            value={selectedCv}
            onChange={(e) => setSelectedCv(e.target.value)}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}
          >
            {cvs.length > 0 ? (
              cvs.map((cv) => (
                <Radio
                  key={cv.id}
                  value={cv.id}
                  style={{
                    border: '1.5px solid #e2e8f0',
                    padding: '12px 14px',
                    borderRadius: 10,
                    width: '100%',
                    background: selectedCv === cv.id ? '#faf5ff' : '#fff',
                    borderColor: selectedCv === cv.id ? '#8b5cf6' : '#e2e8f0',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {cv.name}
                    </span>
                    <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>
                      Điểm ATS: {cv.atsScore}/100
                    </Tag>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Loại: {cv.type} · Cập nhật {cv.updatedAt}
                    </div>
                  </div>
                </Radio>
              ))
            ) : (
              <>
                <Radio
                  value="cv-1"
                  style={{
                    border: '1.5px solid #e2e8f0',
                    padding: '12px 14px',
                    borderRadius: 10,
                    width: '100%',
                    background: selectedCv === 'cv-1' ? '#faf5ff' : '#fff',
                    borderColor: selectedCv === 'cv-1' ? '#8b5cf6' : '#e2e8f0',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      CV Chuyên viên Phát triển Phần mềm (ATS Standard)
                    </span>
                    <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>
                      Khuyên dùng (94% Match)
                    </Tag>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      CV mặc định hệ thống · Sẵn sàng nộp
                    </div>
                  </div>
                </Radio>
                <Radio
                  value="cv-2"
                  style={{
                    border: '1.5px solid #e2e8f0',
                    padding: '12px 14px',
                    borderRadius: 10,
                    width: '100%',
                    background: selectedCv === 'cv-2' ? '#faf5ff' : '#fff',
                    borderColor: selectedCv === 'cv-2' ? '#8b5cf6' : '#e2e8f0',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      CV Kỹ sư Công nghệ & Kiến trúc Hệ thống
                    </span>
                    <Tag color="blue" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700 }}>
                      89% Match
                    </Tag>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Định dạng chuẩn quốc tế
                    </div>
                  </div>
                </Radio>
              </>
            )}
          </Radio.Group>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
              Thư giới thiệu ngắn (Cover letter / Lời nhắn gửi tới Nhà tuyển dụng):
            </div>
            <Input.TextArea
              rows={3}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Tôi rất quan tâm đến vị trí này và tin rằng kinh nghiệm của mình phù hợp với định hướng phát triển của công ty..."
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setIsApplyModalOpen(false)} style={{ borderRadius: 8 }}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              loading={submittingApply}
              onClick={handleConfirmApply}
              icon={<CheckCircleOutlined />}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
              }}
            >
              Xác nhận nộp hồ sơ tức thì
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
