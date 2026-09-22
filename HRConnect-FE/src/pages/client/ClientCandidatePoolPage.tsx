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
      return <Tag color="blue">Mới nộp hồ sơ</Tag>;
    case 'AI_SCREENED':
      return <Tag color="cyan">Đã lọc sơ bộ AI</Tag>;
    case 'INTERVIEW_SCHEDULED':
      return <Tag color="purple">Đã lên lịch PV</Tag>;
    case 'OFFER_SENT':
      return <Tag color="gold">Đã gửi Offer</Tag>;
    case 'HIRED':
      return <Tag color="green">Đã trúng tuyển</Tag>;
    case 'REJECTED':
      return <Tag color="default">Đã từ chối</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
};

// ─── 3-Color AI Score Tier Tag Renderer ────────────────────────────────────────
export const renderAiMatchTag = (score?: number, tier?: AiScoreTier) => {
  if (score === undefined || score === null) {
    return <Tag color="default">Chưa có điểm</Tag>;
  }

  let color = '#ea580c'; // Cam: < 70%
  let label = 'Cần cân nhắc';

  if (score >= 85 || tier === 'EXCELLENT') {
    color = '#16a34a'; // Xanh lá: >= 85%
    label = 'Phù hợp xuất sắc';
  } else if (score >= 70 || tier === 'HIGH' || tier === 'MODERATE') {
    color = '#0284c7'; // Xanh dương: 70% - 84%
    label = 'Phù hợp cao';
  }

  return (
    <Tag
      style={{
        color: '#ffffff',
        backgroundColor: color,
        borderColor: color,
        fontWeight: 600,
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 4,
      }}
    >
      <RobotOutlined style={{ marginRight: 4 }} />
      {score}% • {label}
    </Tag>
  );
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

  // Load candidate applications via ClientService
  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getCandidatesByCompany(companyId);
      setCandidates(data);
    } catch (error) {
      message.error('Không thể tải danh sách ứng viên');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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
      title: 'Họ tên & Hồ sơ hiện tại',
      key: 'candidateInfo',
      minWidth: 260,
      render: (_: any, record: CandidateApplicationDTO) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={42} style={{ border: '2px solid #e2e8f0' }}>
            {record.candidateName.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
              {record.candidateName}
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              {record.currentRole} • {record.currentCompany}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Kinh nghiệm: <strong>{record.yoe} năm</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vị trí ứng tuyển',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      minWidth: 240,
      render: (title: string) => (
        <span style={{ fontWeight: 500, color: '#2563eb' }}>{title}</span>
      ),
    },
    {
      title: 'Lương mong muốn',
      dataIndex: 'expectedSalary',
      key: 'expectedSalary',
      minWidth: 170,
      render: (salary: number) => (
        <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatVND(salary)}</span>
      ),
    },
    {
      title: 'Đánh giá & Điểm AI',
      key: 'aiScore',
      minWidth: 200,
      sorter: (a, b) => a.aiMatchScore - b.aiMatchScore,
      render: (_: any, record: CandidateApplicationDTO) =>
        renderAiMatchTag(record.aiMatchScore, record.aiScoreTier),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      minWidth: 160,
      render: (status: CandidatePipelineStatus) => renderStatusTag(status),
    },
    {
      title: 'Thao tác nhanh',
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
            >
              Chi tiết CV
            </Button>
          </Tooltip>

          <Tooltip title="Lên lịch phỏng vấn [📅]">
            <Button
              size="small"
              icon={<CalendarOutlined style={{ color: '#2563eb' }} />}
              onClick={() => handleOpenScheduleModal(record)}
            />
          </Tooltip>

          <Tooltip title="Phát hành Offer [✉️]">
            <Button
              size="small"
              icon={<MailOutlined style={{ color: '#16a34a' }} />}
              onClick={() => handleOpenOfferModal(record)}
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
              <Button size="small" danger icon={<CloseCircleOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Phễu Quản lý Ứng viên (Candidate Pipeline)
        </Title>
        <Text style={{ color: '#64748b' }}>
          Doanh nghiệp: <strong style={{ color: '#0f172a' }}>TechCorp Việt Nam</strong> • Đánh giá AI Matching, Lên lịch phỏng vấn & Phát hành Offer
        </Text>
      </div>

      {/* ─── OVERVIEW METRICS ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Tổng số ứng viên</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {candidates.length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Trong toàn bộ pipeline</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Phù hợp xuất sắc (≥85%)</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
              {candidates.filter((c) => c.aiMatchScore >= 85).length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Khuyến nghị phỏng vấn ngay</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đã lên lịch PV</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>
              {candidates.filter((c) => c.status === 'INTERVIEW_SCHEDULED').length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Đang chờ diễn ra</div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đã gửi Offer</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginTop: 4 }}>
              {candidates.filter((c) => c.status === 'OFFER_SENT').length}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Chờ ứng viên phản hồi</div>
          </Card>
        </Col>
      </Row>

      {/* ─── FILTER CONTROLS ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Tìm theo họ tên, chức danh hoặc vị trí..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              value={selectedJob}
              onChange={setSelectedJob}
              style={{ width: '100%' }}
              options={jobOptions}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
              options={[
                { value: 'ALL', label: 'Tất cả điểm AI' },
                { value: 'EXCELLENT', label: 'Xanh lá: Xuất sắc (≥85%)' },
                { value: 'HIGH', label: 'Xanh dương: Cao (70-84%)' },
                { value: 'LOW', label: 'Cam: Cân nhắc (<70%)' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* ─── CANDIDATE TABLE ──────────────────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
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
      </Card>

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
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Điểm số AI Matching:</span>
                {renderAiMatchTag(drawerCandidate.aiMatchScore, drawerCandidate.aiScoreTier)}
              </div>
              <Progress
                percent={drawerCandidate.aiMatchScore}
                strokeColor={drawerCandidate.aiMatchScore >= 85 ? '#16a34a' : drawerCandidate.aiMatchScore >= 70 ? '#0284c7' : '#ea580c'}
                style={{ marginTop: 8 }}
              />
            </div>

            {/* AI Highlights & Analysis */}
            <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ color: '#2563eb' }} />
              Đánh giá chuyên sâu từ AI
            </Title>
            <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 20 }}>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#166534', fontSize: 13, lineHeight: 1.6 }}>
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
              padding: '10px 14px',
              borderRadius: 6,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <SafetyCertificateOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
            <div style={{ fontSize: 12, color: '#475569' }}>
              <strong>Chính sách Bảo hành 60 ngày:</strong> Tự động kích hoạt khi ứng viên chấp nhận Offer và hoàn thành thủ tục Onboarding.
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
