/**
 * @file ClientCandidatePoolPage.tsx
 * @path src/pages/client/ClientCandidatePoolPage.tsx
 * @description Enterprise Candidate Pipeline & Pool Management for Client / Company (Role: CLIENT / COMPANY).
 * 
 * Spec A-04 Compliance:
 * 1. RESTful Service Integration: clientService.getCandidatesByCompany(), scheduleInterview(), sendOffer(), updateCandidateStatus().
 * 2. Cột [Đánh giá & Điểm AI] với 3 phân cấp màu chuẩn xác:
 *    - Xanh lá (#16a34a): Phù hợp xuất sắc (EXCELLENT, >= 85%)
 *    - Xanh dương (#0284c7): Phù hợp cao (HIGH / MODERATE, 70% - 84%)
 *    - Cam (#ea580c): Cần cân nhắc (LOW, < 70%)
 * 3. Nút [Chi tiết CV]: Drawer trượt từ phải sang hiển thị tóm tắt AI, thế mạnh, điểm cần lưu ý & nút tải file CV gốc.
 * 4. Modal thao tác nhanh:
 *    - Icon Lịch [📅]: Modal "Lên lịch phỏng vấn" (Ngày giờ, Meet/Văn phòng, Đánh giá sau PV: PASS/FAIL/BACKUP).
 *    - Icon Thư mời [✉️]: Modal "Phát hành Offer" (Mức lương VNĐ, ngày Onboarding, ghi chú bảo hành 60 ngày).
 *    - Icon Từ chối [🚫]: Popconfirm "Từ chối hồ sơ" (Cập nhật trạng thái REJECTED).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Input, Select, Table, Tag, Typography, Space, Card, Row, Col,
  Avatar, Button, Tooltip, Drawer, Modal, Form, DatePicker, TimePicker,
  Radio, message, Progress, Divider, Popconfirm, Spin,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined, EyeOutlined, CalendarOutlined,
  MailOutlined, RobotOutlined,
  VideoCameraOutlined, EnvironmentOutlined,
  DollarOutlined, SafetyCertificateOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/authStore';
import clientService, { CURRENT_CLIENT_COMPANY_ID } from '@/services/clientService';
import type {
  CandidateApplicationDTO,
  CandidatePipelineStatus,
  InterviewResult,
  AiScoreTier,
} from '@/types/client';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { CandidateHighlightPills } from '@/components/common/CandidateHighlightPills';
import { AntiDuplicationBadge } from '@/components/common/AntiDuplicationBadge';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserRole } from '@/types/roles';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Currency Formatter: 55000000 -> 55.000.000 đ/tháng ───────────────────────
export const formatVND = (amount?: number): string => {
  if (amount === undefined || amount === null) return 'Thỏa thuận';
  return `${amount.toLocaleString('vi-VN')} đ/tháng`;
};

// ─── Status Tag Mapper ─────────────────────────────────────────────────────────
const renderStatusTag = (status: CandidatePipelineStatus) => {
  switch (status) {
    case 'NEW_SUBMISSION':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">Mới nộp hồ sơ</span>;
    case 'AI_SCREENED':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">Đã lọc sơ bộ AI</span>;
    case 'INTERVIEW_SCHEDULED':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25">Đã lên lịch PV</span>;
    case 'OFFER_SENT':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">Đã gửi Offer</span>;
    case 'HIRED':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Đã trúng tuyển</span>;
    case 'REJECTED':
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Đã từ chối</span>;
    default:
      return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
  }
};

// ─── 4-Tier Match Score Badge ──────────────────────────────────────────────────
export const renderAiMatchTag = (score?: number, _tier?: AiScoreTier) => {
  if (score === undefined || score === null) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Chưa có điểm</span>;
  }
  return <ScoreTierTag score={score} showScore />;
};

export const ClientCandidatePoolPage: React.FC = () => {
  const [candidates, setCandidates] = useState<CandidateApplicationDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Modals & Drawers
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateApplicationDTO | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [offerModalOpen, setOfferModalOpen] = useState<boolean>(false);
  const [activeCandidate, setActiveCandidate] = useState<CandidateApplicationDTO | null>(null);

  const [scheduleForm] = Form.useForm();
  const [offerForm] = Form.useForm();

  const { user } = useAuthStore();
  const isDemoClient = user?.id === 'client-001' || user?.company?.includes('TechCorp');
  const companyId = isDemoClient ? CURRENT_CLIENT_COMPANY_ID : user?.id;

  // Load candidate applications via ClientService & hrconnect_candidate_applications
  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getCandidatesByCompany(companyId);

      // Read shared applications from localStorage 'hrconnect_candidate_applications'
      let sharedApps: any[] = [];
      try {
        const raw = localStorage.getItem('hrconnect_candidate_applications');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            sharedApps = parsed;
          } else if (parsed && Array.isArray(parsed.state?.applications)) {
            sharedApps = parsed.state.applications;
          }
        }
      } catch {
        // noop
      }

      // Convert shared apps to CandidateApplicationDTO
      const convertedApps: CandidateApplicationDTO[] = sharedApps.map((a: any) => ({
        id: a.id,
        jobId: a.jobId,
        jobTitle: a.jobTitle,
        candidateName: a.fullName || a.candidateName,
        currentRole: a.currentTitle || a.jobTitle,
        currentCompany: a.company || 'Đang cập nhật',
        companyName: a.company,
        clientEmail: a.clientEmail,
        clientId: a.clientId,
        yoe: 3,
        expectedSalary: a.salaryExpectation || 30000000,
        status: (a.status === 'APPLIED' ? 'NEW_SUBMISSION' : a.status === 'ONBOARDED' ? 'HIRED' : a.status === 'OFFERED' ? 'OFFER_SENT' : 'AI_SCREENED') as any,
        aiMatchScore: a.aiScore || 85,
        aiScoreTier: (a.aiScore >= 85 ? 'EXCELLENT' : a.aiScore >= 70 ? 'HIGH' : 'MODERATE') as any,
        aiHighlights: [
          'Hồ sơ ứng viên được đồng bộ từ hệ thống HRConnect',
          `Điểm đánh giá AI ATS: ${a.aiScore || 85}/100`,
        ],
        cvUrl: a.cvUrl || '/files/CV_Default.pdf',
        email: a.email,
        phone: a.phone,
      }));

      // Combine and filter by client criteria:
      // item.clientEmail === currentUser.email || item.clientId === currentUser.id || item.companyName === currentUser.companyName
      const currentUser = user;
      const combined = [...data];
      convertedApps.forEach((ca) => {
        if (!combined.some((item) => item.id === ca.id || (item.candidateName === ca.candidateName && item.jobTitle === ca.jobTitle))) {
          combined.push(ca);
        }
      });

      const filteredByClient = combined.filter((item: any) => {
        if (!currentUser) return true;
        const currentCompanyName = currentUser.companyName || (currentUser as any).company || (isDemoClient ? 'TechCorp Việt Nam' : '');
        const matchCondition =
          (item.clientEmail && currentUser.email && item.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
          (item.clientId && currentUser.id && item.clientId === currentUser.id) ||
          ((item.companyName || item.currentCompany) && (item.companyName || item.currentCompany) === currentCompanyName);

        if (isDemoClient && (!item.clientEmail && !item.clientId)) return true;
        return matchCondition;
      });

      setCandidates(filteredByClient);
    } catch (error) {
      message.error('Không thể tải danh sách ứng viên');
    } finally {
      setLoading(false);
    }
  }, [companyId, user, isDemoClient]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Unique job titles for filter dropdown
  const jobOptions = useMemo(() => {
    const titles = Array.from(new Set(candidates.map((c) => c.jobTitle)));
    return [{ value: 'ALL', label: 'Tất cả vị trí' }, ...titles.map((t) => ({ value: t, label: t }))];
  }, [candidates]);

  // Filtered dataset
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // 1. Text Search
      const matchSearch =
        !searchTerm ||
        c.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.currentRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Job Filter
      const matchJob = selectedJob === 'ALL' || c.jobTitle === selectedJob;

      // 3. Status Filter
      const matchStatus = selectedStatus === 'ALL' || c.status === selectedStatus;

      // 4. Tier Filter
      const matchTier =
        selectedTier === 'ALL' ||
        (selectedTier === 'EXCELLENT' && c.aiMatchScore >= 85) ||
        (selectedTier === 'HIGH' && c.aiMatchScore >= 70 && c.aiMatchScore < 85) ||
        (selectedTier === 'LOW' && c.aiMatchScore < 70);

      return matchSearch && matchJob && matchStatus && matchTier;
    });
  }, [candidates, searchTerm, selectedJob, selectedStatus, selectedTier]);

  // Handle Schedule Modal Open
  const handleOpenScheduleModal = (candidate: CandidateApplicationDTO) => {
    setActiveCandidate(candidate);
    scheduleForm.setFieldsValue({
      candidateName: candidate.candidateName,
      jobTitle: candidate.jobTitle,
      interviewDate: dayjs().add(2, 'day'),
      interviewTime: dayjs('14:30', 'HH:mm'),
      interviewType: 'ONLINE',
      meetingUrl: 'https://meet.google.com/hrc-tech-eval',
      location: 'Tầng 12, Tòa nhà TechCorp Tower, Hà Nội',
      interviewer: 'Sarah Chen (Director of Tech)',
      goalResult: 'PASS',
      notes: 'Phỏng vấn chuyên môn kiến trúc hệ thống và văn hóa làm việc',
    });
    setScheduleModalOpen(true);
  };

  // Submit Schedule Interview
  const handleScheduleSubmit = async () => {
    try {
      const values = await scheduleForm.validateFields();
      if (!activeCandidate) return;

      setActionLoading(true);
      const scheduledDateTime = values.interviewDate
        .hour(values.interviewTime.hour())
        .minute(values.interviewTime.minute())
        .toISOString();

      await clientService.scheduleInterview(activeCandidate.id, {
        scheduledAt: scheduledDateTime,
        interviewType: values.interviewType,
        meetingUrl: values.interviewType === 'ONLINE' ? values.meetingUrl : undefined,
        location: values.interviewType === 'OFFLINE' ? values.location : undefined,
        interviewer: values.interviewer,
        goalResult: values.goalResult as InterviewResult,
        notes: values.notes,
      });

      message.success(`Đã lên lịch phỏng vấn thành công cho ứng viên ${activeCandidate.candidateName}!`);
      setScheduleModalOpen(false);
      await loadCandidates();
    } catch {
      // Validation error
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Offer Modal Open
  const handleOpenOfferModal = (candidate: CandidateApplicationDTO) => {
    setActiveCandidate(candidate);
    offerForm.setFieldsValue({
      candidateName: candidate.candidateName,
      jobTitle: candidate.jobTitle,
      officialSalary: candidate.expectedSalary || 50000000,
      onboardingDate: dayjs().add(14, 'day'),
      probationWarranty: true,
      notes: 'Áp dụng bảo hành 60 ngày thử việc (Gói Headhunt COD). HĐLĐ 1 năm kèm gói chăm sóc sức khỏe Premium.',
    });
    setOfferModalOpen(true);
  };

  // Submit Offer
  const handleOfferSubmit = async () => {
    try {
      const values = await offerForm.validateFields();
      if (!activeCandidate) return;

      setActionLoading(true);
      await clientService.sendOffer(activeCandidate.id, {
        salary: values.officialSalary,
        startDate: values.onboardingDate.format('YYYY-MM-DD'),
        probationWarranty: values.probationWarranty,
        notes: values.notes,
      });

      message.success(`Đã phát hành Offer chính thức cho ứng viên ${activeCandidate.candidateName}!`);
      setOfferModalOpen(false);
      await loadCandidates();
    } catch {
      // Validation error
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Candidate
  const handleRejectCandidate = async (candidateId: string) => {
    try {
      setActionLoading(true);
      await clientService.updateCandidateStatus(candidateId, 'REJECTED', 'Hồ sơ chưa phù hợp tiêu chí đợt này.');
      message.info('Đã cập nhật trạng thái ứng viên: Từ chối hồ sơ');
      await loadCandidates();
    } catch {
      message.error('Thao tác thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  // Open CV Drawer
  const handleOpenCvDrawer = (candidate: CandidateApplicationDTO) => {
    setDrawerCandidate(candidate);
  };

  // Columns definition
  const columns: ColumnsType<CandidateApplicationDTO> = [
    {
      title: 'ỨNG VIÊN & THÔNG SỐ HIGHLIGHT',
      key: 'candidateInfo',
      minWidth: 320,
      render: (_: any, record: CandidateApplicationDTO) => (
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-3">
            <Avatar src={record.avatar} size={40} className="border border-slate-700 bg-blue-600 font-bold shrink-0">
              {record.candidateName.charAt(0)}
            </Avatar>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-100 hover:text-blue-400 cursor-pointer" onClick={() => handleOpenCvDrawer(record)}>
                {record.candidateName}
              </div>
              <div className="text-xs text-slate-400">
                {record.currentRole} • {record.currentCompany}
              </div>
            </div>
          </div>

          {/* Quick Highlight Data-Pills */}
          <CandidateHighlightPills
            yearsOfExperience={record.yoe}
            expectedSalary={record.expectedSalary}
            language="Tiếng Anh"
            availabilityDate={record.submittedAt}
          />

          {/* Anti-Duplication First-Submission Badge */}
          <div>
            <AntiDuplicationBadge
              timestamp={record.submittedAt || '2025-02-14T08:30:00Z'}
              affiliateName={record.currentCompany ? `Nộp qua hệ thống` : undefined}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'VỊ TRÍ ỨNG TUYỂN',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      minWidth: 200,
      render: (title: string) => (
        <span className="font-medium text-sm text-blue-400">{title}</span>
      ),
    },
    {
      title: 'MỨC LƯƠNG KỲ VỌNG',
      dataIndex: 'expectedSalary',
      key: 'expectedSalary',
      minWidth: 160,
      render: (salary: number) => (
        <span className="font-mono font-bold text-emerald-400 text-sm">{formatVND(salary)}</span>
      ),
    },
    {
      title: 'ĐÁNH GIÁ & ĐIỂM AI MATCH',
      key: 'aiScore',
      minWidth: 180,
      sorter: (a, b) => a.aiMatchScore - b.aiMatchScore,
      render: (_: any, record: CandidateApplicationDTO) =>
        renderAiMatchTag(record.aiMatchScore, record.aiScoreTier),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      minWidth: 150,
      render: (status: CandidatePipelineStatus) => renderStatusTag(status),
    },
    {
      title: 'THAO TÁC',
      key: 'actions',
      minWidth: 190,
      render: (_: any, record: CandidateApplicationDTO) => (
        <Space size={6}>
          <Tooltip title="Xem tóm tắt AI & CV gốc">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenCvDrawer(record)}
              className="rounded-lg text-xs"
            >
              Chi tiết CV
            </Button>
          </Tooltip>

          <Tooltip title="Lên lịch phỏng vấn [📅]">
            <Button
              size="small"
              icon={<CalendarOutlined className="text-blue-400" />}
              onClick={() => handleOpenScheduleModal(record)}
              className="rounded-lg bg-slate-900 border-slate-700"
            />
          </Tooltip>

          <Tooltip title="Phát hành Offer [✉️]">
            <Button
              size="small"
              icon={<MailOutlined className="text-emerald-400" />}
              onClick={() => handleOpenOfferModal(record)}
              className="rounded-lg bg-slate-900 border-slate-700"
            />
          </Tooltip>

          {record.status !== 'REJECTED' && (
            <Popconfirm
              title="Từ chối hồ sơ này?"
              description={`Xác nhận dừng tuyển dụng ứng viên ${record.candidateName}?`}
              onConfirm={() => handleRejectCandidate(record.id)}
              okText="Từ chối"
              cancelText="Hủy"
            >
              <Button size="small" danger icon={<CloseCircleOutlined />} className="rounded-lg" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Phễu Quản Lý Ứng Viên (Candidate Pipeline)"
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25">
            🏢 {user?.companyName || (user as any)?.company || user?.name || 'TechCorp Việt Nam'}
          </span>
        }
        subtitle="Theo dõi phân loại ứng viên, điểm số AI Sentence-BERT, lịch phỏng vấn Google Meet và tiến độ phát hành Offer."
      />

      {/* ─── OVERVIEW METRICS ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <div className="b2b-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Tổng số ứng viên</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {candidates.length}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Trong toàn bộ pipeline</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="b2b-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Top Match (≥80%)</div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">
              {candidates.filter((c) => c.aiMatchScore >= 80).length}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Khuyến nghị phỏng vấn ngay</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="b2b-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Đã lên lịch PV</div>
            <div className="text-2xl font-extrabold text-purple-600 mt-1 font-mono">
              {candidates.filter((c) => c.status === 'INTERVIEW_SCHEDULED').length}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Đang chờ diễn ra</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="b2b-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Đã gửi Offer</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1 font-mono">
              {candidates.filter((c) => c.status === 'OFFER_SENT').length}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Chờ ứng viên phản hồi</div>
          </div>
        </Col>
      </Row>

      {/* ─── FILTER CONTROLS ─────────────────────────────────────────────────── */}
      <div className="b2b-card mb-5 p-4">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Tìm theo họ tên, chức danh hoặc vị trí..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ borderRadius: 10, height: 38 }}
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              value={selectedJob}
              onChange={setSelectedJob}
              style={{ width: '100%', height: 38 }}
              options={jobOptions}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: '100%', height: 38 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'NEW_SUBMISSION', label: 'Mới nộp' },
                { value: 'AI_SCREENED', label: 'Đã lọc AI' },
                { value: 'INTERVIEW_SCHEDULED', label: 'Đã lên lịch PV' },
                { value: 'OFFER_SENT', label: 'Đã gửi Offer' },
                { value: 'REJECTED', label: 'Đã từ chối' },
              ]}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              value={selectedTier}
              onChange={setSelectedTier}
              style={{ width: '100%', height: 38 }}
              options={[
                { value: 'ALL', label: 'Tất cả điểm AI' },
                { value: 'EXCELLENT', label: 'Xanh lá: Xuất sắc (≥85%)' },
                { value: 'HIGH', label: 'Xanh dương: Cao (70-84%)' },
                { value: 'LOW', label: 'Cam: Cân nhắc (<70%)' },
              ]}
            />
          </Col>
        </Row>
      </div>

      {/* ─── CANDIDATE TABLE ──────────────────────────────────────────────────── */}
      <div className="b2b-card p-0 overflow-hidden">
        <Spin spinning={loading}>
          <Table<CandidateApplicationDTO>
            columns={columns}
            dataSource={filteredCandidates}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} ứng viên` }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: 'Không tìm thấy hồ sơ ứng viên phù hợp.' }}
          />
        </Spin>
      </div>

      {/* ─── DRAWER: CHI TIẾT CV & PHÂN TÍCH AI ────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={drawerCandidate?.avatar} size={36}>
              {drawerCandidate?.candidateName.charAt(0)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{drawerCandidate?.candidateName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{drawerCandidate?.jobTitle}</div>
            </div>
          </div>
        }
        width={560}
        open={Boolean(drawerCandidate)}
        onClose={() => setDrawerCandidate(null)}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => message.success(`Đang tải file hồ sơ: ${drawerCandidate?.cvUrl}`)}
          >
            Tải CV gốc
          </Button>
        }
      >
        {drawerCandidate && (
          <div>
            {/* AI Score Overview Box */}
            <div
              style={{
                padding: '16px',
                borderRadius: 12,
                background: 'rgba(11, 15, 23, 0.8)',
                border: '1px solid rgba(51, 65, 85, 0.65)',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>Điểm số AI Matching:</span>
                {renderAiMatchTag(drawerCandidate.aiMatchScore, drawerCandidate.aiScoreTier)}
              </div>
              <Progress
                percent={drawerCandidate.aiMatchScore}
                strokeColor={drawerCandidate.aiMatchScore >= 85 ? '#16a34a' : drawerCandidate.aiMatchScore >= 70 ? '#0284c7' : '#ea580c'}
                style={{ marginTop: 8 }}
              />
            </div>

            {/* AI Highlights & Analysis */}
            <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
              <RobotOutlined style={{ color: '#3b82f6' }} />
              Đánh giá chuyên sâu từ AI
            </Title>
            <div style={{ background: 'rgba(6, 78, 59, 0.2)', padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: 20 }}>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#6ee7b7', fontSize: 13, lineHeight: 1.6 }}>
                {drawerCandidate.aiHighlights.map((hl, index) => (
                  <li key={index} style={{ marginBottom: 4 }}>{hl}</li>
                ))}
              </ul>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Profile Overview */}
            <Title level={5}>Thông tin tóm tắt ứng viên</Title>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Vị trí hiện tại:</Text>
                <div style={{ fontWeight: 600 }}>{drawerCandidate.currentRole}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Công ty hiện tại:</Text>
                <div style={{ fontWeight: 600 }}>{drawerCandidate.currentCompany}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Kinh nghiệm làm việc:</Text>
                <div style={{ fontWeight: 600 }}>{drawerCandidate.yoe} năm</div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Mức lương kỳ vọng:</Text>
                <div style={{ fontWeight: 600, color: '#0284c7' }}>{formatVND(drawerCandidate.expectedSalary)}</div>
              </Col>
            </Row>

            {/* Interview Info if available */}
            {drawerCandidate.interviewDetails && (
              <div style={{ marginTop: 20, padding: 12, background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                <div style={{ fontWeight: 600, color: '#7e22ce', marginBottom: 6 }}>
                  Lịch phỏng vấn đã xếp:
                </div>
                <div style={{ fontSize: 13, color: '#4b5563' }}>
                  Thời gian: <strong>{dayjs(drawerCandidate.interviewDetails.scheduledAt).format('DD/MM/YYYY HH:mm')}</strong>
                </div>
                <div style={{ fontSize: 13, color: '#4b5563' }}>
                  Hình thức: <strong>{drawerCandidate.interviewDetails.interviewType}</strong>
                </div>
                {drawerCandidate.interviewDetails.meetingUrl && (
                  <div style={{ fontSize: 13, color: '#2563eb', marginTop: 4 }}>
                    Link: <a href={drawerCandidate.interviewDetails.meetingUrl} target="_blank" rel="noreferrer">{drawerCandidate.interviewDetails.meetingUrl}</a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ─── MODAL: LÊN LỊCH PHỎNG VẤN [📅] ──────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb' }}>
            <CalendarOutlined />
            <span>Lên lịch Phỏng vấn Ứng viên</span>
          </div>
        }
        open={scheduleModalOpen}
        onCancel={() => setScheduleModalOpen(false)}
        onOk={handleScheduleSubmit}
        confirmLoading={actionLoading}
        okText="Xác nhận Lên lịch"
        cancelText="Hủy"
        destroyOnClose
        width={560}
      >
        <div style={{ margin: '12px 0' }}>
          <Text type="secondary">
            Thiết lập thời gian, hình thức họp và tiêu chí đánh giá sau phỏng vấn. Hệ thống sẽ tự động gửi email thông báo và tạo link Google Meet.
          </Text>
        </div>

        <Form form={scheduleForm} layout="vertical">
          <Form.Item label="Ứng viên" name="candidateName">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
            <Input disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Ngày phỏng vấn"
                name="interviewDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày PV' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Giờ phỏng vấn"
                name="interviewTime"
                rules={[{ required: true, message: 'Vui lòng chọn giờ' }]}
              >
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Hình thức phỏng vấn" name="interviewType">
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="ONLINE">
                <VideoCameraOutlined style={{ marginRight: 6 }} />
                Trực tuyến (Google Meet)
              </Radio.Button>
              <Radio.Button value="OFFLINE">
                <EnvironmentOutlined style={{ marginRight: 6 }} />
                Tại Văn phòng Doanh nghiệp
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.interviewType !== cur.interviewType}
          >
            {({ getFieldValue }) =>
              getFieldValue('interviewType') === 'ONLINE' ? (
                <Form.Item label="Đường link họp trực tuyến" name="meetingUrl">
                  <Input prefix={<VideoCameraOutlined />} />
                </Form.Item>
              ) : (
                <Form.Item label="Địa điểm phỏng vấn" name="location">
                  <Input prefix={<EnvironmentOutlined />} />
                </Form.Item>
              )
            }
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Người phỏng vấn chính"
                name="interviewer"
                rules={[{ required: true, message: 'Nhập tên người PV' }]}
              >
                <Input placeholder="VD: Sarah Chen" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Mục tiêu đánh giá sau PV" name="goalResult">
                <Select
                  options={[
                    { value: 'PASS', label: 'PASS - Đạt yêu cầu để Offer' },
                    { value: 'BACKUP', label: 'BACKUP - Dự phòng đợt 2' },
                    { value: 'FAIL', label: 'FAIL - Không đạt yêu cầu' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ghi chú nội dung phỏng vấn" name="notes">
            <TextArea rows={2} placeholder="Nội dung cần tập trung khai thác..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── MODAL: PHÁT HÀNH OFFER [✉️] ────────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
            <MailOutlined />
            <span>Phát hành Thư mời Nhận việc (Job Offer)</span>
          </div>
        }
        open={offerModalOpen}
        onCancel={() => setOfferModalOpen(false)}
        onOk={handleOfferSubmit}
        confirmLoading={actionLoading}
        okText="Gửi Thư mời (Offer) ngay"
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
        cancelText="Hủy"
        destroyOnClose
        width={560}
      >
        <div style={{ margin: '12px 0' }}>
          <Text type="secondary">
            Nhập mức lương chính thức (VNĐ) và ngày nhận việc. Hệ thống sẽ tự động tạo thư mời gửi đến email của ứng viên và cập nhật trạng thái pipeline sang OFFER_SENT.
          </Text>
        </div>

        <Form form={offerForm} layout="vertical">
          <Form.Item label="Ứng viên nhận Offer" name="candidateName">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
            <Input disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Mức lương chính thức (VNĐ/tháng)"
                name="officialSalary"
                rules={[{ required: true, message: 'Vui lòng nhập mức lương' }]}
              >
                <Input
                  type="number"
                  step={1000000}
                  prefix={<DollarOutlined />}
                  suffix="VNĐ"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ngày bắt đầu đi làm (Onboarding)"
                name="onboardingDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày Onboarding' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(11, 15, 23, 0.8)',
              border: '1px solid rgba(51, 65, 85, 0.65)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <SafetyCertificateOutlined style={{ color: '#c084fc', fontSize: 18 }} />
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>
              <strong style={{ color: '#f8fafc' }}>Chính sách Bảo hành 60 ngày:</strong> Tự động kích hoạt khi ứng viên chấp nhận Offer và hoàn thành thủ tục Onboarding.
            </div>
          </div>

          <Form.Item label="Ghi chú phúc lợi & điều kiện nhận việc" name="notes">
            <TextArea
              rows={3}
              placeholder="VD: Thử việc hưởng 85% lương hoặc 100% lương, bảo hiểm PVI, máy tính MacBook Pro..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientCandidatePoolPage;
