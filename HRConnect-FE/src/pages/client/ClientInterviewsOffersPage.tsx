/**
 * @file ClientInterviewsOffersPage.tsx
 * @description Client portal page for managing interview schedules and offer letters.
 * Replaces the previous duplicate of ClientCandidatePoolPage at /client/interviews-offers.
 *
 * Layout: Two tabs
 *   Tab 1: Lịch phỏng vấn — interview schedule table with time, meeting room/link, result
 *   Tab 2: Thư mời làm việc (Offer) — offer tracking per candidate
 */
import React, { useState } from 'react';
import {
  Card, Tabs, Table, Tag, Button, Modal, Space, Typography, Badge,
  Row, Col, Statistic, Input, Select, Avatar, message, Tooltip,
  Descriptions, Empty, Popconfirm,
} from 'antd';
import {
  CalendarOutlined, VideoCameraOutlined, BankOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  TeamOutlined, DollarOutlined, SolutionOutlined, SearchOutlined,
  EyeOutlined, ReloadOutlined, EditOutlined, FileDoneOutlined,
  UserOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useApplicationStore,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  type CandidateApplicationRecord,
} from '@/stores/applicationStore';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;
const { Search } = Input;

// ─── Static demo data for interviews (company-specific) ──────────────────────

interface InterviewEntry {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  scheduledTime: string;
  mode: 'ONLINE' | 'OFFLINE';
  meetingLink?: string;
  meetingRoom?: string;
  interviewerName: string;
  result: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'RESCHEDULED';
  notes?: string;
}

interface OfferEntry {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  offeredSalary: string;
  offerDate: string;
  expectedStartDate: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING' | 'ONBOARDED';
  notes?: string;
}

const DEMO_INTERVIEWS: InterviewEntry[] = [
  {
    id: 'cli-int-001',
    candidateName: 'Lê Hoàng Minh',
    candidateEmail: 'minh.le@example.com',
    jobTitle: 'Senior React Developer',
    scheduledTime: '2026-09-24 14:00',
    mode: 'ONLINE',
    meetingLink: 'https://meet.google.com/hrc-client-01',
    interviewerName: 'Sarah Chen (Hiring Manager)',
    result: 'SCHEDULED',
    notes: 'Ứng viên do CTV giới thiệu, điểm AI 92/100.',
  },
  {
    id: 'cli-int-002',
    candidateName: 'Trần Thị Thu',
    candidateEmail: 'thu.tran@gmail.com',
    jobTitle: 'Product Manager - Fintech',
    scheduledTime: '2026-09-25 10:30',
    mode: 'ONLINE',
    meetingLink: 'https://meet.google.com/hrc-client-02',
    interviewerName: 'Phan Quốc Bảo (VP Product)',
    result: 'SCHEDULED',
    notes: 'Kinh nghiệm 4 năm quản lý sản phẩm ví điện tử.',
  },
  {
    id: 'cli-int-003',
    candidateName: 'Hoàng Nam Anh',
    candidateEmail: 'namanh.dev@gmail.com',
    jobTitle: 'AI Research Scientist',
    scheduledTime: '2026-09-20 09:00',
    mode: 'OFFLINE',
    meetingRoom: 'Phòng họp Innovation Hub, Tầng 12',
    interviewerName: 'Dr. Lê Hoàng Nam (CTO)',
    result: 'PASSED',
    notes: 'Kết quả xuất sắc. Đã chuyển sang phát hành Offer.',
  },
  {
    id: 'cli-int-004',
    candidateName: 'Phạm Minh Tuấn',
    candidateEmail: 'tuan.pm@outlook.com',
    jobTitle: 'Fullstack Node.js Developer',
    scheduledTime: '2026-09-19 14:00',
    mode: 'ONLINE',
    meetingLink: 'https://meet.google.com/hrc-client-04',
    interviewerName: 'Nguyễn Thị HR & Tech Lead',
    result: 'FAILED',
    notes: 'Chưa đáp ứng yêu cầu kinh nghiệm Microservices.',
  },
];

const DEMO_OFFERS: OfferEntry[] = [
  {
    id: 'cli-off-001',
    candidateName: 'Hoàng Nam Anh',
    candidateEmail: 'namanh.dev@gmail.com',
    jobTitle: 'AI Research Scientist',
    offeredSalary: '45.000.000 đ/tháng (Gross) + ESOP',
    offerDate: '2026-09-21',
    expectedStartDate: '2026-10-01',
    status: 'ACCEPTED',
    notes: 'Ứng viên đã ký chấp thuận. Dự kiến onboard 01/10/2026.',
  },
  {
    id: 'cli-off-002',
    candidateName: 'Đỗ Thị Mai',
    candidateEmail: 'mai.do@example.com',
    jobTitle: 'Frontend Engineer (React)',
    offeredSalary: '28.000.000 đ/tháng',
    offerDate: '2026-09-18',
    expectedStartDate: '2026-10-05',
    status: 'NEGOTIATING',
    notes: 'Ứng viên đang đề xuất điều chỉnh mức lương và chế độ phúc lợi.',
  },
  {
    id: 'cli-off-003',
    candidateName: 'Lê Thanh Đạt',
    candidateEmail: 'dat.le@tech.io',
    jobTitle: 'Senior Fullstack Engineer',
    offeredSalary: '35.000.000 đ/tháng',
    offerDate: '2026-09-01',
    expectedStartDate: '2026-09-15',
    status: 'ONBOARDED',
    notes: 'Đã đi làm chính thức. Đang trong kỳ bảo hành thử việc 60 ngày.',
  },
];

// ─── Result tags ──────────────────────────────────────────────────────────────

const INTERVIEW_RESULT_CONFIG: Record<InterviewEntry['result'], { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Sắp diễn ra', color: '#0284c7', bg: '#f0f9ff' },
  PASSED: { label: 'PASS ✓', color: '#059669', bg: '#f0fdf4' },
  FAILED: { label: 'FAIL ✗', color: '#dc2626', bg: '#fef2f2' },
  RESCHEDULED: { label: 'Đổi lịch', color: '#f59e0b', bg: '#fffbeb' },
};

const OFFER_STATUS_CONFIG: Record<OfferEntry['status'], { label: string; color: string }> = {
  PENDING: { label: 'Chờ phản hồi', color: '#0284c7' },
  ACCEPTED: { label: 'Đã chấp thuận', color: '#059669' },
  NEGOTIATING: { label: 'Đang thương lượng', color: '#f59e0b' },
  REJECTED: { label: 'Từ chối', color: '#dc2626' },
  ONBOARDED: { label: 'Đã nhận việc ✓', color: '#065f46' },
};

// ─── Interview Schedule Tab ────────────────────────────────────────────────────

const InterviewsTab: React.FC = () => {
  const [interviews, setInterviews] = useState<InterviewEntry[]>(DEMO_INTERVIEWS);
  const [search, setSearch] = useState('');
  const [detailModal, setDetailModal] = useState<InterviewEntry | null>(null);

  // Merge applications from shared store that have interview scheduled status
  const sharedApps = useApplicationStore((s) => s.applications).filter(
    (a) => a.status === 'INTERVIEW_SCHEDULED' || a.status === 'INTERVIEW_PASSED' || a.status === 'INTERVIEW_FAILED'
  );

  const sharedAsInterviews: InterviewEntry[] = sharedApps.map((a) => ({
    id: a.id,
    candidateName: a.fullName,
    candidateEmail: a.email,
    jobTitle: a.jobTitle,
    scheduledTime: a.interviewTime || new Date(a.applyDate).toLocaleDateString('vi-VN'),
    mode: 'ONLINE' as const,
    meetingLink: a.interviewLink,
    interviewerName: a.interviewerName || 'Chưa phân công',
    result: a.status === 'INTERVIEW_PASSED' ? 'PASSED' : a.status === 'INTERVIEW_FAILED' ? 'FAILED' : 'SCHEDULED',
    notes: `Nguồn: ${a.source === 'AFFILIATE' ? `CTV ${a.affiliateName}` : 'Trực tiếp'} · Điểm AI: ${a.aiScore}/100`,
  }));

  const allInterviews = [...sharedAsInterviews, ...interviews];

  const filtered = allInterviews.filter(
    (i) =>
      !search ||
      i.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      i.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      i.candidateEmail.toLowerCase().includes(search.toLowerCase())
  );

  const handleMarkResult = (id: string, result: 'PASSED' | 'FAILED') => {
    setInterviews((prev) =>
      prev.map((i) => (i.id === id ? { ...i, result } : i))
    );
    message.success(`Đã cập nhật kết quả phỏng vấn: ${result === 'PASSED' ? 'PASS ✓' : 'FAIL ✗'}`);
  };

  const columns: ColumnsType<InterviewEntry> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      width: 200,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={34} style={{ background: '#0284c7', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {r.candidateName.slice(-2)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.candidateName}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{r.candidateEmail}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vị trí ứng tuyển',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      width: 200,
      render: (v) => <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Thời gian phỏng vấn',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      width: 170,
      render: (v) => (
        <div>
          <CalendarOutlined style={{ color: '#0284c7', marginRight: 5 }} />
          <span style={{ fontSize: 13 }}>{v}</span>
        </div>
      ),
    },
    {
      title: 'Hình thức / Link',
      key: 'meeting',
      width: 220,
      render: (_, r) =>
        r.mode === 'ONLINE' ? (
          <div>
            <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 4 }}>
              <VideoCameraOutlined style={{ marginRight: 4 }} />
              Google Meet
            </Tag>
            {r.meetingLink && (
              <div>
                <a href={r.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0284c7' }}>
                  {r.meetingLink.replace('https://', '')}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div>
            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 4 }}>
              <BankOutlined style={{ marginRight: 4 }} />
              Tại văn phòng
            </Tag>
            <div style={{ fontSize: 11, color: '#64748b' }}>{r.meetingRoom}</div>
          </div>
        ),
    },
    {
      title: 'Người phỏng vấn',
      dataIndex: 'interviewerName',
      key: 'interviewerName',
      width: 180,
      render: (v) => <span style={{ fontSize: 12, color: '#475569' }}>{v}</span>,
    },
    {
      title: 'Kết quả',
      key: 'result',
      width: 130,
      render: (_, r) => {
        const cfg = INTERVIEW_RESULT_CONFIG[r.result];
        return (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.color}40`,
            }}
          >
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(r)} style={{ borderRadius: 6 }}>
            Chi tiết
          </Button>
          {r.result === 'SCHEDULED' && (
            <>
              <Popconfirm
                title="Đánh dấu PASS?"
                onConfirm={() => handleMarkResult(r.id, 'PASSED')}
                okText="PASS"
                okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
              >
                <Button size="small" style={{ borderRadius: 6, color: '#059669', borderColor: '#059669' }}>
                  PASS
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Đánh dấu FAIL?"
                onConfirm={() => handleMarkResult(r.id, 'FAILED')}
                okText="FAIL"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger style={{ borderRadius: 6 }}>
                  FAIL
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Tìm ứng viên, vị trí..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ borderRadius: 8, maxWidth: 360 }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 8, showTotal: (t) => `Tổng ${t} lịch phỏng vấn` }}
        size="middle"
      />

      {/* Interview Detail Modal */}
      <Modal
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        title={
          <Space>
            <CalendarOutlined style={{ color: '#0284c7' }} />
            <span>Chi tiết lịch phỏng vấn</span>
          </Space>
        }
        width={520}
      >
        {detailModal && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="Ứng viên">{detailModal.candidateName}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailModal.candidateEmail}</Descriptions.Item>
            <Descriptions.Item label="Vị trí ứng tuyển">{detailModal.jobTitle}</Descriptions.Item>
            <Descriptions.Item label="Thời gian">{detailModal.scheduledTime}</Descriptions.Item>
            <Descriptions.Item label="Hình thức">
              {detailModal.mode === 'ONLINE' ? 'Google Meet (Online)' : 'Trực tiếp tại văn phòng'}
            </Descriptions.Item>
            {detailModal.meetingLink && (
              <Descriptions.Item label="Link Meet">
                <a href={detailModal.meetingLink} target="_blank" rel="noreferrer">{detailModal.meetingLink}</a>
              </Descriptions.Item>
            )}
            {detailModal.meetingRoom && (
              <Descriptions.Item label="Phòng họp">{detailModal.meetingRoom}</Descriptions.Item>
            )}
            <Descriptions.Item label="Người phỏng vấn">{detailModal.interviewerName}</Descriptions.Item>
            <Descriptions.Item label="Kết quả">
              <Tag
                style={{
                  borderRadius: 6,
                  fontWeight: 700,
                  color: INTERVIEW_RESULT_CONFIG[detailModal.result].color,
                  background: INTERVIEW_RESULT_CONFIG[detailModal.result].bg,
                }}
              >
                {INTERVIEW_RESULT_CONFIG[detailModal.result].label}
              </Tag>
            </Descriptions.Item>
            {detailModal.notes && (
              <Descriptions.Item label="Ghi chú">{detailModal.notes}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

// ─── Offers Tab ───────────────────────────────────────────────────────────────

const OffersTab: React.FC = () => {
  const [offers, setOffers] = useState<OfferEntry[]>(DEMO_OFFERS);
  const [search, setSearch] = useState('');
  const [detailModal, setDetailModal] = useState<OfferEntry | null>(null);

  // Merge shared store offers
  const sharedApps = useApplicationStore((s) => s.applications).filter(
    (a) => a.status === 'OFFERED' || a.status === 'ONBOARDED'
  );
  const sharedAsOffers: OfferEntry[] = sharedApps.map((a) => ({
    id: a.id,
    candidateName: a.fullName,
    candidateEmail: a.email,
    jobTitle: a.jobTitle,
    offeredSalary: a.offerSalary || 'Thỏa thuận',
    offerDate: a.offerDate || new Date(a.applyDate).toLocaleDateString('vi-VN'),
    expectedStartDate: a.onboardDate || '—',
    status: a.status === 'ONBOARDED' ? 'ONBOARDED' : 'ACCEPTED',
    notes: `Nguồn: ${a.source === 'AFFILIATE' ? `CTV ${a.affiliateName}` : 'Trực tiếp'}`,
  }));

  const allOffers = [...sharedAsOffers, ...offers];

  const filtered = allOffers.filter(
    (o) =>
      !search ||
      o.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      o.jobTitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateStatus = (id: string, status: OfferEntry['status']) => {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    message.success(`Đã cập nhật trạng thái Offer: ${OFFER_STATUS_CONFIG[status].label}`);
  };

  const columns: ColumnsType<OfferEntry> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      width: 200,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={34} style={{ background: '#059669', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {r.candidateName.slice(-2)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.candidateName}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{r.candidateEmail}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vị trí',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      width: 200,
      render: (v) => <span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>{v}</span>,
    },
    {
      title: 'Mức lương Offer',
      dataIndex: 'offeredSalary',
      key: 'offeredSalary',
      width: 180,
      render: (v) => (
        <span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
          <DollarOutlined style={{ marginRight: 4 }} />
          {v}
        </span>
      ),
    },
    {
      title: 'Ngày phát hành',
      dataIndex: 'offerDate',
      key: 'offerDate',
      width: 130,
      render: (v) => <span style={{ fontSize: 13, color: '#475569' }}>{v}</span>,
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'expectedStartDate',
      key: 'expectedStartDate',
      width: 130,
      render: (v) => <span style={{ fontSize: 13, color: '#475569' }}>{v}</span>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 160,
      render: (_, r) => {
        const cfg = OFFER_STATUS_CONFIG[r.status];
        return (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              color: cfg.color,
              background: `${cfg.color}12`,
              border: `1px solid ${cfg.color}40`,
            }}
          >
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(r)} style={{ borderRadius: 6 }}>
            Chi tiết
          </Button>
          {r.status === 'ACCEPTED' && (
            <Popconfirm
              title="Xác nhận Onboard?"
              description="Ứng viên đã bắt đầu làm việc?"
              onConfirm={() => handleUpdateStatus(r.id, 'ONBOARDED')}
              okText="Xác nhận Onboard"
              okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
            >
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ borderRadius: 6, color: '#059669', borderColor: '#059669' }}
              >
                Onboard
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Tìm ứng viên, vị trí..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ borderRadius: 8, maxWidth: 360 }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        scroll={{ x: 1180 }}
        pagination={{ pageSize: 8, showTotal: (t) => `Tổng ${t} thư mời làm việc` }}
        size="middle"
      />

      {/* Offer Detail Modal */}
      <Modal
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        title={
          <Space>
            <SolutionOutlined style={{ color: '#059669' }} />
            <span>Chi tiết thư mời làm việc (Offer Letter)</span>
          </Space>
        }
        width={520}
      >
        {detailModal && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="Ứng viên">{detailModal.candidateName}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailModal.candidateEmail}</Descriptions.Item>
            <Descriptions.Item label="Vị trí ứng tuyển">{detailModal.jobTitle}</Descriptions.Item>
            <Descriptions.Item label="Mức lương Offer">
              <span style={{ fontWeight: 700, color: '#059669' }}>{detailModal.offeredSalary}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày phát hành Offer">{detailModal.offerDate}</Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu dự kiến">{detailModal.expectedStartDate}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag
                style={{
                  borderRadius: 6,
                  fontWeight: 700,
                  color: OFFER_STATUS_CONFIG[detailModal.status].color,
                }}
              >
                {OFFER_STATUS_CONFIG[detailModal.status].label}
              </Tag>
            </Descriptions.Item>
            {detailModal.notes && (
              <Descriptions.Item label="Ghi chú">{detailModal.notes}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const ClientInterviewsOffersPage: React.FC = () => {
  const { user } = useAuthStore();
  const applications = useApplicationStore((s) => s.applications);

  const interviewCount = applications.filter(
    (a) => a.status === 'INTERVIEW_SCHEDULED'
  ).length + DEMO_INTERVIEWS.filter((i) => i.result === 'SCHEDULED').length;

  const offerCount = applications.filter(
    (a) => a.status === 'OFFERED' || a.status === 'ONBOARDED'
  ).length + DEMO_OFFERS.length;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <CalendarOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Quản lý Phỏng vấn &amp; Thư mời làm việc
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Theo dõi lịch phỏng vấn, kết quả và trạng thái Offer Letter của ứng viên ứng tuyển tại {user?.company || 'doanh nghiệp'}.
        </Text>
      </div>

      {/* Summary stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          {
            label: 'Lịch phỏng vấn sắp tới',
            value: interviewCount,
            color: '#0284c7',
            bg: '#f0f9ff',
            icon: <CalendarOutlined />,
          },
          {
            label: 'Đã phát hành Offer',
            value: offerCount,
            color: '#059669',
            bg: '#f0fdf4',
            icon: <FileDoneOutlined />,
          },
          {
            label: 'Ứng viên đã Onboard',
            value: DEMO_OFFERS.filter((o) => o.status === 'ONBOARDED').length,
            color: '#065f46',
            bg: '#ecfdf5',
            icon: <CheckCircleOutlined />,
          },
          {
            label: 'Chờ phản hồi Offer',
            value: DEMO_OFFERS.filter((o) => o.status === 'PENDING' || o.status === 'NEGOTIATING').length,
            color: '#f59e0b',
            bg: '#fffbeb',
            icon: <ClockCircleOutlined />,
          },
        ].map((s) => (
          <Col key={s.label} xs={12} sm={6}>
            <Card
              style={{
                borderRadius: 12,
                border: `1px solid ${s.color}25`,
                background: s.bg,
              }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <div style={{ fontSize: 22, color: s.color, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <Card
        style={{
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Tabs
          defaultActiveKey="interviews"
          items={[
            {
              key: 'interviews',
              label: (
                <Space>
                  <CalendarOutlined />
                  Lịch phỏng vấn
                  <Badge count={interviewCount} style={{ backgroundColor: '#0284c7' }} />
                </Space>
              ),
              children: <InterviewsTab />,
            },
            {
              key: 'offers',
              label: (
                <Space>
                  <SolutionOutlined />
                  Thư mời làm việc (Offer)
                  <Badge count={offerCount} style={{ backgroundColor: '#059669' }} />
                </Space>
              ),
              children: <OffersTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ClientInterviewsOffersPage;

