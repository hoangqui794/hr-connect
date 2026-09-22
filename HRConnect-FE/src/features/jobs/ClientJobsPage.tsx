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
  Tooltip, Popconfirm, message, Badge,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, PauseCircleOutlined,
  PlayCircleOutlined, StopOutlined, FileTextOutlined,
  SafetyCertificateOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { MOCK_JOBS } from '@/services/mockData';
import { JobStatus, ServiceType } from '@/types/job';
import type { Job } from '@/types/job';
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

  // Local state initialized with strictly TechCorp Việt Nam jobs
  const [jobs, setJobs] = useState<Job[]>(TECHCORP_DEFAULT_JOBS);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // ─── Filter Logic: Strictly TechCorp Jobs Only ─────────────────────────────
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // Strict Data Scope: Must belong to TechCorp Việt Nam
      const isTechCorp = j.company.includes('TechCorp') || j.companyId === 'client-001';
      if (!isTechCorp) return false;

      const matchSearch =
        !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.mustHaveTags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchService = !serviceTypeFilter || j.serviceType === serviceTypeFilter;
      const matchStatus = !statusFilter || j.status === statusFilter;

      return matchSearch && matchService && matchStatus;
    });
  }, [jobs, search, serviceTypeFilter, statusFilter]);

  // Quick metrics for TechCorp
  const metrics = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter((j) => j.status === JobStatus.ACTIVE).length;
    const paused = jobs.filter((j) => j.status === JobStatus.PAUSED).length;
    const totalApplications = jobs.reduce((acc, j) => acc + (j.applicationCount || 0), 0);
    return { total, active, paused, totalApplications };
  }, [jobs]);

  // Handlers
  const handleToggleStatus = (jobId: string, currentStatus: JobStatus) => {
    const nextStatus = currentStatus === JobStatus.ACTIVE ? JobStatus.PAUSED : JobStatus.ACTIVE;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: nextStatus } : j))
    );
    const msg =
      nextStatus === JobStatus.ACTIVE
        ? 'Đã mở lại tin tuyển dụng thành công!'
        : 'Đã tạm dừng nhận hồ sơ cho tin này!';
    void message.success(msg);
  };

  const handleCloseJob = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: JobStatus.CLOSED } : j))
    );
    void message.info('Đã đóng tin tuyển dụng và lưu vào kho lưu trữ!');
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
      width: 140,
      render: (_, record) => {
        if (record.status === JobStatus.ACTIVE) {
          return <Tag color="success" style={{ borderRadius: 6, fontWeight: 600 }}>Đang tuyển</Tag>;
        }
        if (record.status === JobStatus.PAUSED) {
          return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}>Tạm dừng</Tag>;
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
      width: 230,
      fixed: 'right',
      render: (_, record) => (
        <Space size={6}>
          {/* Xem ứng viên */}
          <Tooltip title="Xem phễu ứng viên của tin này">
            <Button
              size="small"
              icon={<TeamOutlined />}
              onClick={() => navigate('/client/candidates')}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Ứng viên
            </Button>
          </Tooltip>

          {/* Tạm dừng hoặc Mở lại */}
          <Tooltip title={record.status === JobStatus.ACTIVE ? 'Tạm dừng nhận hồ sơ' : 'Kích hoạt mở lại tin'}>
            <Button
              size="small"
              icon={record.status === JobStatus.ACTIVE ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record.id, record.status)}
              style={{
                borderRadius: 6,
                borderColor: record.status === JobStatus.ACTIVE ? '#f59e0b' : '#10b981',
                color: record.status === JobStatus.ACTIVE ? '#f59e0b' : '#10b981',
              }}
            />
          </Tooltip>

          {/* Đóng tin */}
          {record.status !== JobStatus.CLOSED && (
            <Popconfirm
              title="Đóng tin tuyển dụng này?"
              description="Tin tuyển dụng sẽ ngừng hiển thị trên toàn hệ thống."
              onConfirm={() => handleCloseJob(record.id)}
              okText="Đồng ý đóng"
              cancelText="Hủy"
            >
              <Tooltip title="Đóng tin tuyển dụng">
                <Button size="small" danger icon={<StopOutlined />} style={{ borderRadius: 6 }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
            Tin tuyển dụng của tôi
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Doanh nghiệp: <b style={{ color: '#0284c7' }}>TechCorp Việt Nam</b> · Quản lý bài đăng, gói dịch vụ áp dụng và phễu tuyển dụng
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/client/jobs/create')}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            borderRadius: 8,
            fontWeight: 600,
            height: 38,
          }}
        >
          Đăng tin tuyển dụng mới
        </Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Tổng số tin của TechCorp', value: metrics.total, color: '#0284c7', icon: <FileTextOutlined /> },
          { label: 'Tin đang tuyển (ACTIVE)', value: metrics.active, color: '#10b981', icon: <PlayCircleOutlined /> },
          { label: 'Tin tạm dừng (PAUSED)', value: metrics.paused, color: '#f59e0b', icon: <PauseCircleOutlined /> },
          { label: 'Tổng ứng viên nộp hồ sơ', value: metrics.totalApplications, color: '#8b5cf6', icon: <TeamOutlined /> },
        ].map((item) => (
          <Col key={item.label} xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${item.color}15`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                    {item.label}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm kiếm theo tiêu đề vị trí, kỹ năng cốt lõi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} md={7}>
            <Select
              placeholder="Gói dịch vụ áp dụng"
              value={serviceTypeFilter || undefined}
              onChange={(val) => setServiceTypeFilter(val || '')}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: '', label: 'Tất cả các gói dịch vụ' },
                { value: ServiceType.HEADHUNT_COD, label: 'Tuyển dụng trọn gói (COD - Bảo hành 60 ngày)' },
                { value: ServiceType.CV_SOURCING, label: 'Cung cấp hồ sơ (CV Sourcing)' },
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
              style={{ width: '100%' }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: JobStatus.ACTIVE, label: 'Đang tuyển (ACTIVE)' },
                { value: JobStatus.PAUSED, label: 'Tạm dừng (PAUSED)' },
                { value: JobStatus.CLOSED, label: 'Đã đóng (CLOSED)' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filteredJobs}
          rowKey="id"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng số ${total} bài đăng của TechCorp Việt Nam` }}
          size="middle"
        />
      </Card>
    </div>
  );
};
