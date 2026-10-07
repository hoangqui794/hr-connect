/**
 * @file ClientJobsPage.tsx
 * @description Enterprise Job Management Console (/client/jobs) for TechCorp Việt Nam.
 * 
 * Spec A-04 Compliance:
 * - Data Scope Restriction: Strictly enforces company-level data isolation.
 *   ONLY displays jobs owned by 'TechCorp Việt Nam' (client-001).
 *   Third-party jobs (DigitalWave Agency, RetailGiant, FinSecure, CloudNative Labs) are completely filtered out.
 * - Service Packages: Displays COD, Sourcing, and Open application packages with 60-day warranty badge.
 * - Action controls: Quick status toggle (Active/Paused), Close Job, View Applicants.
 */

import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, Card, Row, Col, Typography, Space,
  Tooltip, Popconfirm, message, Badge, Modal, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, PauseCircleOutlined,
  PlayCircleOutlined, StopOutlined, FileTextOutlined,
  SafetyCertificateOutlined, TeamOutlined, EditOutlined,
  SendOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { MOCK_JOBS } from '@/services/mockData';
import { JobStatus, ServiceType } from '@/types/job';
import type { Job } from '@/types/job';
import { getJobsForClient, updateJobStatusInAllJobs } from '@/services/localStorageService';
import {
  useMyJobs,
  useSubmitJob,
  usePauseJob,
  useResumeJob,
  useCloseJob,
} from '@/services/queries/useJobs';
import type { JobDetailDto } from '@/types/mf01';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ─── Format Currency to VNĐ: 45000000 - 70000000 -> 45.000.000 - 70.000.000 đ/tháng ───
const formatSalaryVND = (min: number, max: number): string => {
  return `${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')} đ/tháng`;
};

// ─── TechCorp Dedicated Job Catalog ───────────────────────────────────────────
// Guarantees all 3 Service Packages (COD / Sourcing / Open) exist for TechCorp Việt Nam
const TECHCORP_DEFAULT_JOBS: Job[] = [
  ...MOCK_JOBS.filter(
    (j) => j.company.includes('TechCorp') || j.companyId === 'client-001'
  ),
  {
    id: 'job-tc-002',
    title: 'Trưởng nhóm Kỹ thuật Frontend (Frontend Tech Lead)',
    company: 'TechCorp Việt Nam',
    companyId: 'client-001',
    industryCode: 'tech-software',
    industryLabel: 'Phát triển Phần mềm',
    serviceType: ServiceType.CV_SOURCING,
    status: JobStatus.ACTIVE,
    location: 'TP. Hồ Chí Minh (Hybrid)',
    remote: true,
    salaryRange: { min: 40000000, max: 65000000, currency: 'VND', negotiable: true },
    mustHaveTags: ['React', 'TypeScript', 'Design System', '5+ năm kinh nghiệm'],
    shouldHaveTags: ['Next.js', 'Storybook', 'Micro-frontends'],
    objectives: 'Chủ trì kiến trúc giao diện người dùng và quản lý đội ngũ 8 kỹ sư frontend',
    engagementTerms: { timeline: 30, commissionRate: 15, retainerFee: 0, budget: 0 },
    headcount: 1,
    experienceYears: { min: 5, max: 9 },
    description: 'TechCorp tìm kiếm Frontend Tech Lead dẫn dắt các dự án Enterprise SaaS...',
    requirements: ['5+ năm kinh nghiệm React', 'Kiến trúc Design System', 'Kỹ năng quản trị nhóm'],
    createdAt: '2026-09-03T09:00:00Z',
    updatedAt: '2026-09-15T11:00:00Z',
    deadline: '2026-10-25T00:00:00Z',
    clientContactId: 'client-001',
    internalHRId: 'hr-001',
    applicationCount: 18,
    shortlistedCount: 4,
  },
  {
    id: 'job-tc-003',
    title: 'Kỹ sư DevOps / Hạ tầng Cloud Kubernetes',
    company: 'TechCorp Việt Nam',
    companyId: 'client-001',
    industryCode: 'tech-cloud',
    industryLabel: 'Điện toán Đám mây',
    serviceType: ServiceType.CV_APPLICATION,
    status: JobStatus.ACTIVE,
    location: 'TP. Hồ Chí Minh & Từ xa',
    remote: true,
    salaryRange: { min: 35000000, max: 55000000, currency: 'VND', negotiable: true },
    mustHaveTags: ['Kubernetes', 'Terraform', 'CI/CD', 'AWS', '3+ năm kinh nghiệm'],
    shouldHaveTags: ['Helm', 'ArgoCD', 'Prometheus', 'Grafana'],
    objectives: 'Vận hành cụm hạ tầng đám mây phân tán phục vụ 2 triệu người dùng thường xuyên',
    engagementTerms: { timeline: 20, commissionRate: 0, retainerFee: 0, budget: 0 },
    headcount: 2,
    experienceYears: { min: 3, max: 7 },
    description: 'Chịu trách nhiệm bảo đảm tính sẵn sàng 99.99% của hạ tầng TechCorp...',
    requirements: ['3+ năm kinh nghiệm Kubernetes', 'Thành thạo Terraform IaC', 'Kinh nghiệm AWS'],
    createdAt: '2026-09-08T08:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
    deadline: '2026-10-18T00:00:00Z',
    clientContactId: 'client-001',
    internalHRId: 'hr-001',
    applicationCount: 32,
    shortlistedCount: 7,
  },
  {
    id: 'job-tc-004',
    title: 'Chuyên gia Bảo mật Ứng dụng (Application Security)',
    company: 'TechCorp Việt Nam',
    companyId: 'client-001',
    industryCode: 'tech-cybersecurity',
    industryLabel: 'An toàn Thông tin',
    serviceType: ServiceType.HEADHUNT_COD,
    status: JobStatus.PAUSED,
    location: 'TP. Hồ Chí Minh',
    remote: false,
    salaryRange: { min: 48000000, max: 75000000, currency: 'VND', negotiable: true },
    mustHaveTags: ['AppSec', 'SAST/DAST', 'OWASP Top 10', '5+ năm kinh nghiệm'],
    shouldHaveTags: ['OSCP', 'CISSP', 'DevSecOps'],
    objectives: 'Đảm bảo an ninh mã nguồn và quy trình kiểm thử xâm nhập tự động',
    engagementTerms: { timeline: 30, commissionRate: 18, retainerFee: 0, budget: 0 },
    headcount: 1,
    experienceYears: { min: 5, max: 10 },
    description: 'Chuyên gia bảo mật ứng dụng phụ trách kiểm định toàn bộ release sản phẩm...',
    requirements: ['5+ năm kinh nghiệm AppSec', 'Am hiểu DevSecOps pipeline', 'Chứng chỉ quốc tế'],
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-12T08:00:00Z',
    deadline: '2026-11-01T00:00:00Z',
    clientContactId: 'client-001',
    internalHRId: 'hr-001',
    applicationCount: 9,
    shortlistedCount: 2,
  },
];

export const ClientJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [search, setSearch] = useState<string>('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Reason Modal for Pause & Close
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    type: 'PAUSE' | 'CLOSE';
    jobId: string;
    jobTitle: string;
  }>({
    isOpen: false,
    type: 'PAUSE',
    jobId: '',
    jobTitle: '',
  });
  const [actionReason, setActionReason] = useState<string>('');

  // ─── API Queries & Mutations ───────────────────────────────────────────────
  const { data: apiJobs, isLoading: isLoadingJobs } = useMyJobs(statusFilter);
  const submitJobMutation = useSubmitJob();
  const pauseJobMutation = usePauseJob();
  const resumeJobMutation = useResumeJob();
  const closeJobMutation = useCloseJob();

  const isMutating =
    submitJobMutation.isPending ||
    pauseJobMutation.isPending ||
    resumeJobMutation.isPending ||
    closeJobMutation.isPending;

  // Unified jobs list: prefers API data or falls back to storage
  const jobs: Job[] = useMemo(() => {
    if (apiJobs && apiJobs.length > 0) {
      return apiJobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.companyName || user?.company || 'TechCorp Việt Nam',
        companyId: j.companyId,
        industryCode: 'tech-software',
        industryLabel: 'Công nghệ',
        serviceType: (j.serviceTypeId as ServiceType) || ServiceType.HEADHUNT_COD,
        status: (j.status as JobStatus) || JobStatus.ACTIVE,
        location: j.location || 'Hồ Chí Minh',
        remote: j.employmentType === 'REMOTE',
        salaryRange: {
          min: j.salaryMin || 0,
          max: j.salaryMax || 0,
          currency: (j.currencyCode as 'VND' | 'USD' | 'SGD') || 'VND',
          negotiable: true,
        },
        mustHaveTags: (j.requirements || [])
          .filter((r) => r.requirementType === 'MUST_HAVE')
          .map((r) => r.content),
        shouldHaveTags: (j.requirements || [])
          .filter((r) => r.requirementType === 'SHOULD_HAVE')
          .map((r) => r.content),
        objectives: '',
        engagementTerms: { timeline: 30, commissionRate: 15, retainerFee: 0, budget: 0 },
        headcount: j.quantity || 1,
        experienceYears: { min: 1, max: 5 },
        description: j.description || '',
        requirements: [],
        createdAt: j.createdAt || new Date().toISOString(),
        updatedAt: j.updatedAt || j.createdAt || new Date().toISOString(),
        clientContactId: j.companyId || user?.id || 'client-001',
        applicationCount: j.applicationCount || 0,
        shortlistedCount: j.shortlistedCount || 0,
        rejectionReason: j.rejectionReason,
      }));
    }
    return getJobsForClient(user?.email, user?.company, user?.id);
  }, [apiJobs, user?.email, user?.company, user?.id]);

  // ─── Filter Logic: Strictly Scoped by Company ─────────────────────────────
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchSearch =
        !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.mustHaveTags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchService = !serviceTypeFilter || j.serviceType === serviceTypeFilter;
      const matchStatus = !statusFilter || j.status === statusFilter;

      return matchSearch && matchService && matchStatus;
    });
  }, [jobs, search, serviceTypeFilter, statusFilter]);

  // Quick metrics for Client
  const metrics = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter((j) => j.status === JobStatus.ACTIVE).length;
    const pending = jobs.filter((j) => j.status === JobStatus.PENDING || (j.status as string) === 'PENDING_REVIEW').length;
    const paused = jobs.filter((j) => j.status === JobStatus.PAUSED).length;
    const totalApplications = jobs.reduce((acc, j) => acc + (j.applicationCount || 0), 0);
    return { total, active, pending, paused, totalApplications };
  }, [jobs]);

  // Rejection check for warning banner
  const rejectedJobs = useMemo(() => {
    return jobs.filter((j) => (j.status as string) === 'REJECTED');
  }, [jobs]);

  // Handlers with API Mutations
  const handleSubmitJob = async (jobId: string) => {
    try {
      await submitJobMutation.mutateAsync(jobId);
      void message.success('Gửi xét duyệt thành công! Tin đã chuyển sang trạng thái chờ HR duyệt.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi duyệt thất bại.';
      void message.error(msg);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      await resumeJobMutation.mutateAsync(jobId);
      void message.success('Đã mở lại tin tuyển dụng thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mở lại thất bại.';
      void message.error(msg);
    }
  };

  const handleOpenPauseModal = (job: Job) => {
    setActionReason('');
    setReasonModal({
      isOpen: true,
      type: 'PAUSE',
      jobId: job.id,
      jobTitle: job.title,
    });
  };

  const handleOpenCloseModal = (job: Job) => {
    setActionReason('');
    setReasonModal({
      isOpen: true,
      type: 'CLOSE',
      jobId: job.id,
      jobTitle: job.title,
    });
  };

  const handleConfirmReasonModal = async () => {
    if (!actionReason.trim()) {
      void message.warning('Vui lòng nhập lý do để tiếp tục.');
      return;
    }
    try {
      if (reasonModal.type === 'PAUSE') {
        await pauseJobMutation.mutateAsync({ jobId: reasonModal.jobId, reason: actionReason });
        void message.success('Đã tạm dừng tin tuyển dụng thành công!');
      } else {
        await closeJobMutation.mutateAsync({ jobId: reasonModal.jobId, reason: actionReason });
        void message.info('Đã đóng tin tuyển dụng!');
      }
      setReasonModal({ isOpen: false, type: 'PAUSE', jobId: '', jobTitle: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại.';
      void message.error(msg);
    }
  };

  // Columns definition
  const columns: ColumnsType<Job> = [
    {
      title: 'Vị trí tuyển dụng',
      key: 'title',
      width: 280,
      fixed: 'left',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>
            {record.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{record.location}</span>
            {record.remote && <Tag color="blue" style={{ margin: 0, fontSize: 10.5 }}>Remote / Hybrid</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ áp dụng',
      key: 'serviceType',
      width: 220,
      render: (_, record) => {
        if (record.serviceType === ServiceType.HEADHUNT_COD) {
          return (
            <div>
              <Tag color="gold" style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '2px 8px' }}>
                Tuyển dụng trọn gói (COD)
              </Tag>
              <div style={{ fontSize: 11, color: '#0284c7', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <SafetyCertificateOutlined /> Bảo hành 60 ngày
              </div>
            </div>
          );
        }
        if (record.serviceType === ServiceType.CV_SOURCING) {
          return (
            <Tag color="cyan" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5, padding: '2px 8px' }}>
              Cung cấp hồ sơ (CV Sourcing)
            </Tag>
          );
        }
        return (
          <Tag color="green" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5, padding: '2px 8px' }}>
            Ứng tuyển mở (CV Application)
          </Tag>
        );
      },
    },
    {
      title: 'Mức lương dự kiến',
      key: 'salary',
      width: 200,
      render: (_, record) => (
        <div style={{ fontWeight: 600, fontSize: 13, color: '#059669' }}>
          {formatSalaryVND(record.salaryRange.min, record.salaryRange.max)}
        </div>
      ),
    },
    {
      title: 'Ứng viên nộp vào',
      key: 'applications',
      width: 170,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate('/client/candidates')}
          style={{ padding: 0 }}
        >
          <Badge
            count={record.applicationCount}
            overflowCount={999}
            style={{ backgroundColor: '#0284c7' }}
          />
          <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 600 }}>
            ({record.shortlistedCount} đã duyệt)
          </span>
        </Button>
      ),
    },
    {
      title: 'Trạng thái tin',
      key: 'status',
      width: 150,
      render: (_, record) => {
        const statusStr = String(record.status).toUpperCase();
        if (statusStr === 'DRAFT') {
          return <Tag color="default" style={{ borderRadius: 6, fontWeight: 600 }}>Bản nháp</Tag>;
        }
        if (statusStr === 'PENDING' || statusStr === 'PENDING_REVIEW') {
          return (
            <Tag
              style={{
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 11,
                border: '1px solid #fde68a',
                background: '#fffbeb',
                color: '#92400e',
              }}
            >
              ⏳ Chờ duyệt
            </Tag>
          );
        }
        if (statusStr === 'ACTIVE') {
          return <Tag color="success" style={{ borderRadius: 6, fontWeight: 600 }}>Đang tuyển</Tag>;
        }
        if (statusStr === 'PAUSED') {
          return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}>Tạm dừng</Tag>;
        }
        if (statusStr === 'REJECTED') {
          const reason = (record as any).rejectionReason || 'Chưa đáp ứng tiêu chuẩn kiểm duyệt';
          return (
            <Tooltip title={`Lý do từ chối: ${reason}`}>
              <Tag color="error" style={{ borderRadius: 6, fontWeight: 700, cursor: 'help' }}>
                ❌ Bị từ chối
              </Tag>
            </Tooltip>
          );
        }
        return <Tag style={{ borderRadius: 6, color: '#94a3b8' }}>Đã đóng</Tag>;
      },
    },
    {
      title: 'Ngày đăng & Hạn',
      key: 'dates',
      width: 160,
      render: (_, record) => (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <div>Đăng: {dayjs(record.createdAt).format('DD/MM/YYYY')}</div>
          {record.deadline && <div>Hạn: {dayjs(record.deadline).format('DD/MM/YYYY')}</div>}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => {
        const statusStr = String(record.status).toUpperCase();
        const isClosed = statusStr === 'CLOSED';
        const isDraftOrRejected = statusStr === 'DRAFT' || statusStr === 'REJECTED';

        return (
          <Space size={6}>
            {/* Xem ứng viên */}
            <Tooltip title="Xem phễu ứng viên của tin này">
              <Button
                size="small"
                icon={<TeamOutlined />}
                onClick={() => navigate('/client/candidates')}
                style={{ borderRadius: 6, fontSize: 12 }}
                disabled={isMutating}
              >
                Ứng viên
              </Button>
            </Tooltip>

            {/* Sửa tin (cho DRAFT hoặc REJECTED) */}
            {isDraftOrRejected && (
              <Tooltip title="Chỉnh sửa tin tuyển dụng">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/client/jobs/create?edit=${record.id}`)}
                  style={{ borderRadius: 6, color: '#2563eb', borderColor: '#93c5fd' }}
                  disabled={isMutating}
                />
              </Tooltip>
            )}

            {/* Gửi duyệt (cho DRAFT hoặc REJECTED) */}
            {isDraftOrRejected && (
              <Popconfirm
                title="Gửi duyệt tin tuyển dụng?"
                description="Tin sẽ được chuyển tới Internal HR xét duyệt theo SLA."
                onConfirm={() => handleSubmitJob(record.id)}
                okText="Gửi duyệt"
                cancelText="Hủy"
                disabled={isMutating}
              >
                <Tooltip title="Gửi xét duyệt">
                  <Button
                    size="small"
                    type="primary"
                    icon={<SendOutlined />}
                    loading={submitJobMutation.isPending}
                    disabled={isMutating}
                    style={{ borderRadius: 6, background: '#0284c7', borderColor: '#0284c7' }}
                  />
                </Tooltip>
              </Popconfirm>
            )}

            {/* Tạm dừng (khi ACTIVE) */}
            {statusStr === 'ACTIVE' && (
              <Tooltip title="Tạm dừng nhận hồ sơ">
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleOpenPauseModal(record)}
                  disabled={isMutating}
                  style={{
                    borderRadius: 6,
                    borderColor: '#f59e0b',
                    color: '#f59e0b',
                  }}
                />
              </Tooltip>
            )}

            {/* Mở lại (khi PAUSED) */}
            {statusStr === 'PAUSED' && (
              <Popconfirm
                title="Mở lại tin tuyển dụng này?"
                description="Hệ thống sẽ tiếp tục nhận hồ sơ từ ứng viên và headhunter."
                onConfirm={() => handleResumeJob(record.id)}
                okText="Mở lại"
                cancelText="Hủy"
                disabled={isMutating}
              >
                <Tooltip title="Kích hoạt mở lại tin">
                  <Button
                    size="small"
                    icon={<PlayCircleOutlined />}
                    disabled={isMutating}
                    style={{
                      borderRadius: 6,
                      borderColor: '#10b981',
                      color: '#10b981',
                    }}
                  />
                </Tooltip>
              </Popconfirm>
            )}

            {/* Đóng tin (khi chưa đóng) */}
            {!isClosed && (
              <Tooltip title="Đóng tin tuyển dụng">
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleOpenCloseModal(record)}
                  disabled={isMutating}
                  style={{ borderRadius: 6 }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Tin tuyển dụng của tôi
          </Title>
          <Text style={{ fontSize: 13.5, color: '#94a3b8' }}>
            Doanh nghiệp: <b style={{ color: '#38bdf8' }}>{user?.company || 'Doanh nghiệp'}</b> · Quản lý bài đăng, gói dịch vụ áp dụng và phễu tuyển dụng
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/client/jobs/create')}
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: 12,
            fontWeight: 600,
            height: 40,
            border: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          Đăng tin tuyển dụng mới
        </Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: `Tổng số tin đăng`, value: metrics.total, color: '#38bdf8', icon: <FileTextOutlined /> },
          { label: 'Tin đang tuyển (ACTIVE)', value: metrics.active, color: '#34d399', icon: <PlayCircleOutlined /> },
          { label: 'Tin tạm dừng (PAUSED)', value: metrics.paused, color: '#fbbf24', icon: <PauseCircleOutlined /> },
          { label: 'Tổng ứng viên nộp hồ sơ', value: metrics.totalApplications, color: '#c084fc', icon: <TeamOutlined /> },
        ].map((item) => (
          <Col key={item.label} xs={12} sm={6}>
            <div
              style={{
                borderRadius: 16,
                border: '1px solid rgba(51, 65, 85, 0.65)',
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(12px)',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `${item.color}15`,
                    color: item.color,
                    border: `1px solid ${item.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, fontFamily: 'monospace' }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Warning banner for Rejected jobs */}
      {rejectedJobs.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{
            marginBottom: 16,
            borderRadius: 14,
            border: '1px solid #ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
          }}
          message={
            <span style={{ fontWeight: 700, color: '#fca5a5' }}>
              Tin tuyển dụng bị từ chối phê duyệt ({rejectedJobs.length} tin)
            </span>
          }
          description={
            <div style={{ color: '#fecaca', fontSize: 13, marginTop: 4 }}>
              Một hoặc nhiều tin tuyển dụng của bạn bị Internal HR từ chối duyệt. Nhấp nút biểu tượng bút chì{' '}
              <strong>"Sửa"</strong> để xem lý do, điều chỉnh nội dung và bấm <strong>"Gửi duyệt lại"</strong>.
            </div>
          }
        />
      )}

      {jobs.length === 0 ? (
        <div style={{ borderRadius: 16, textAlign: 'center', padding: '60px 20px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(51, 65, 85, 0.65)' }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#475569', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#f8fafc', marginBottom: 8 }}>
            Doanh nghiệp của bạn chưa đăng tin tuyển dụng nào
          </Title>
          <Text style={{ display: 'block', maxWidth: 480, margin: '0 auto 24px', fontSize: 13.5, color: '#94a3b8' }}>
            Bắt đầu tạo tin tuyển dụng mới với các gói dịch vụ linh hoạt (COD, CV Sourcing, CV Application) để kết nối ngay với các ứng viên tài năng.
          </Text>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/client/jobs/create')}
            style={{ borderRadius: 12, fontWeight: 700, background: '#2563eb', height: 42 }}
          >
            Đăng tin tuyển dụng đầu tiên
          </Button>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div style={{ borderRadius: 16, marginBottom: 16, padding: '14px 18px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(51, 65, 85, 0.65)' }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={10}>
                <Input
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Tìm theo tiêu đề, kỹ năng bắt buộc (Java, React...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  style={{ borderRadius: 10, height: 38 }}
                />
              </Col>
              <Col xs={12} md={7}>
                <Select
                  placeholder="Gói dịch vụ tuyển dụng"
                  value={serviceTypeFilter || undefined}
                  onChange={(val) => setServiceTypeFilter(val || '')}
                  allowClear
                  style={{ width: '100%', height: 38 }}
                  options={[
                    { value: '', label: 'Tất cả gói dịch vụ' },
                    { value: ServiceType.HEADHUNT_COD, label: 'Trọn gói COD (Bảo hành 60 ngày)' },
                    { value: ServiceType.CV_SOURCING, label: 'Tìm nguồn CV (Sourcing)' },
                    { value: ServiceType.CV_APPLICATION, label: 'Ứng tuyển mở (CV Application)' },
                  ]}
                />
              </Col>
              <Col xs={12} md={7}>
                <Select
                  placeholder="Trạng thái bài đăng"
                  value={statusFilter || undefined}
                  onChange={(val) => setStatusFilter(val || '')}
                  allowClear
                  style={{ width: '100%', height: 38 }}
                  options={[
                    { value: '', label: 'Tất cả trạng thái (ALL)' },
                    { value: 'DRAFT', label: 'Bản nháp (DRAFT)' },
                    { value: 'PENDING_REVIEW', label: 'Chờ duyệt (PENDING_REVIEW)' },
                    { value: 'ACTIVE', label: 'Đang tuyển (ACTIVE)' },
                    { value: 'PAUSED', label: 'Tạm dừng (PAUSED)' },
                    { value: 'CLOSED', label: 'Đã đóng (CLOSED)' },
                    { value: 'REJECTED', label: 'Bị từ chối (REJECTED)' },
                  ]}
                />
              </Col>
            </Row>
          </div>

          {/* Table */}
          <div style={{ borderRadius: 16, border: '1px solid rgba(51, 65, 85, 0.65)', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)' }}>
            <Table
              columns={columns}
              dataSource={filteredJobs}
              rowKey="id"
              loading={isLoadingJobs}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 10, showTotal: (total) => `Tổng số ${total} bài đăng` }}
              size="middle"
            />
          </div>
        </>
      )}

      {/* Reason Modal for Pause & Close */}
      <Modal
        title={
          reasonModal.type === 'PAUSE' ? (
            <span style={{ color: '#d97706', fontWeight: 700 }}>
              <PauseCircleOutlined style={{ marginRight: 8 }} />
              Tạm dừng tin tuyển dụng
            </span>
          ) : (
            <span style={{ color: '#dc2626', fontWeight: 700 }}>
              <StopOutlined style={{ marginRight: 8 }} />
              Đóng tin tuyển dụng
            </span>
          )
        }
        open={reasonModal.isOpen}
        onOk={handleConfirmReasonModal}
        onCancel={() => setReasonModal({ isOpen: false, type: 'PAUSE', jobId: '', jobTitle: '' })}
        confirmLoading={pauseJobMutation.isPending || closeJobMutation.isPending}
        okText={reasonModal.type === 'PAUSE' ? 'Xác nhận tạm dừng' : 'Xác nhận đóng tin'}
        cancelText="Hủy"
        okButtonProps={{ danger: reasonModal.type === 'CLOSE' }}
      >
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Vui lòng nhập lý do{' '}
            {reasonModal.type === 'PAUSE' ? 'tạm dừng nhận hồ sơ' : 'đóng vĩnh viễn tin tuyển dụng'} cho vị trí:{' '}
            <strong style={{ color: '#0f172a' }}>{reasonModal.jobTitle}</strong>
          </p>
          <Input.TextArea
            rows={3}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder={
              reasonModal.type === 'PAUSE'
                ? 'Ví dụ: Tạm dừng để sàng lọc hồ sơ vòng 1...'
                : 'Ví dụ: Đã tuyển đủ nhân sự theo kế hoạch...'
            }
            maxLength={300}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
};

export default ClientJobsPage;

