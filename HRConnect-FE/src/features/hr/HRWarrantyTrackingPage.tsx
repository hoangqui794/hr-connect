import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, message, Popconfirm, Statistic, Progress,
  Alert, Input,
} from 'antd';
import {
  SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, BankOutlined, UserOutlined,
  DollarOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface WarrantyCandidate {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  affiliateName: string;
  onboardDate: string;
  warrantyEndDate: string;
  totalDays: number;
  daysPassed: number;
  commissionAmount: number;
  status: 'IN_PROBATION' | 'PASSED_PROBATION' | 'FAILED_PROBATION';
  notes?: string;
}

const INITIAL_WARRANTY_CANDIDATES: WarrantyCandidate[] = [
  {
    id: 'war-001',
    candidateName: 'Le Hoang Minh',
    candidateEmail: 'minh.le@example.com',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior React Developer (COD)',
    affiliateName: 'David Tran',
    onboardDate: '2026-07-15',
    warrantyEndDate: '2026-09-15',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 25000000,
    status: 'PASSED_PROBATION',
    notes: 'Đã hoàn thành xuất sắc 60 ngày thử việc. Kích hoạt mốc hoa hồng 25.000.000 đ cho CTV David Tran.',
  },
  {
    id: 'war-002',
    candidateName: 'Tran Thi Thu',
    candidateEmail: 'thu.tran@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Product Manager - Fintech',
    affiliateName: 'Sarah Le',
    onboardDate: '2026-07-20',
    warrantyEndDate: '2026-09-20',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 32000000,
    status: 'PASSED_PROBATION',
    notes: 'Khách hàng VNG đánh giá rất cao năng lực ứng viên.',
  },
  {
    id: 'war-003',
    candidateName: 'Le Thanh Dat',
    candidateEmail: 'dat.le@tech.io',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior Fullstack Engineer',
    affiliateName: 'David Tran',
    onboardDate: '2026-08-10',
    warrantyEndDate: '2026-10-10',
    totalDays: 60,
    daysPassed: 43,
    commissionAmount: 28000000,
    status: 'IN_PROBATION',
    notes: 'Tiến độ thử việc thuận lợi, hòa nhập tốt với team dự án.',
  },
  {
    id: 'war-004',
    candidateName: 'Nguyen Van B',
    candidateEmail: 'vanb.devops@tech.io',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    affiliateName: 'Minh Vu Recruiter',
    onboardDate: '2026-08-25',
    warrantyEndDate: '2026-10-25',
    totalDays: 60,
    daysPassed: 28,
    commissionAmount: 18000000,
    status: 'IN_PROBATION',
    notes: 'Đang trong tháng thử việc đầu tiên.',
  },
  {
    id: 'war-005',
    candidateName: 'Hoang Van Nam',
    candidateEmail: 'nam.hoang@trash.io',
    companyName: 'NexGen AI Solutions Ltd',
    jobTitle: 'AI Engineer',
    affiliateName: 'Spam Affiliate Account',
    onboardDate: '2026-07-01',
    warrantyEndDate: '2026-08-30',
    totalDays: 60,
    daysPassed: 25,
    commissionAmount: 30000000,
    status: 'FAILED_PROBATION',
    notes: 'Ứng viên chủ động xin nghỉ việc giữa chừng do không phù hợp văn hóa. Kích hoạt bảo hành tìm người thay thế.',
  },
];

export const HRWarrantyTrackingPage: React.FC = () => {
  const [candidates, setCandidates] = useState<WarrantyCandidate[]>(INITIAL_WARRANTY_CANDIDATES);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<WarrantyCandidate | null>(null);
  const [failReason, setFailReason] = useState('');

  // Handle Mark Passed Probation
  const handlePassProbation = (record: WarrantyCandidate) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === record.id
          ? {
              ...c,
              status: 'PASSED_PROBATION',
              daysPassed: c.totalDays,
              notes: `Đã được xác nhận đạt thử việc bởi Internal HR (Lisa Pham). Mốc hoa hồng ${record.commissionAmount.toLocaleString('vi-VN')} đ đã chuyển sang PAYABLE để Admin duyệt giải ngân.`,
            }
          : c
      )
    );
    message.success(
      `Đã xác nhận ${record.candidateName} ĐẠT THỬ VIỆC! Mốc hoa hồng đã được kích hoạt cho CTV ${record.affiliateName}.`
    );
  };

  // Open Fail Modal
  const handleOpenFailModal = (record: WarrantyCandidate) => {
    setSelectedCandidate(record);
    setFailReason('');
    setReasonModalOpen(true);
  };

  // Confirm Fail Probation
  const handleConfirmFail = () => {
    if (!selectedCandidate) return;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === selectedCandidate.id
          ? {
              ...c,
              status: 'FAILED_PROBATION',
              notes: failReason || 'Ứng viên không đạt yêu cầu thử việc theo đánh giá của Client.',
            }
          : c
      )
    );
    message.warning(
      `Đã ghi nhận ứng viên ${selectedCandidate.candidateName} không đạt thử việc. Đã kích hoạt bảo hành tìm kiếm ứng viên thay thế.`
    );
    setReasonModalOpen(false);
  };

  const inProbationCount = candidates.filter((c) => c.status === 'IN_PROBATION').length;
  const passedCount = candidates.filter((c) => c.status === 'PASSED_PROBATION').length;
  const totalCommissionUnlocked = candidates
    .filter((c) => c.status === 'PASSED_PROBATION')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const columns: ColumnsType<WarrantyCandidate> = [
    {
      title: 'Ứng viên & Vị trí',
      key: 'candidate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.candidateName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.candidateEmail}</div>
          <Tag color="blue" style={{ marginTop: 4, borderRadius: 4, fontSize: 11 }}>
            {record.jobTitle}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Doanh nghiệp & CTV giới thiệu',
      key: 'company',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            <BankOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.companyName}
          </div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 2, fontWeight: 500 }}>
            CTV: {record.affiliateName}
          </div>
        </div>
      ),
    },
    {
      title: 'Tiến độ Thử việc (60 ngày)',
      key: 'progress',
      width: 220,
      render: (_, record) => {
        const percent = Math.min(100, Math.round((record.daysPassed / record.totalDays) * 100));
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{record.daysPassed} / {record.totalDays} ngày</span>
              <span style={{ color: '#64748b' }}>{percent}%</span>
            </div>
            <Progress
              percent={percent}
              size="small"
              status={record.status === 'FAILED_PROBATION' ? 'exception' : percent === 100 ? 'success' : 'active'}
              strokeColor={record.status === 'FAILED_PROBATION' ? '#ef4444' : percent === 100 ? '#10b981' : '#0284c7'}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Onboard: {record.onboardDate} → Hết hạn: {record.warrantyEndDate}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Mốc hoa hồng CTV',
      dataIndex: 'commissionAmount',
      key: 'commission',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          {v.toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Trạng thái Bảo hành',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        if (s === 'PASSED_PROBATION') {
          return <Badge status="success" text={<span style={{ fontWeight: 700, color: '#16a34a' }}>Đạt thử việc (Mở khóa Payout)</span>} />;
        }
        if (s === 'IN_PROBATION') {
          return <Badge status="processing" text={<span style={{ fontWeight: 700, color: '#0284c7' }}>Đang thử việc</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 700, color: '#dc2626' }}>Thử việc không đạt</span>} />;
      },
    },
    {
      title: 'Thao tác HR',
      key: 'actions',
      render: (_, record) => (
        record.status === 'IN_PROBATION' ? (
          <Space size="small">
            <Popconfirm
              title="Xác nhận Đạt Thử Việc"
              description={`Xác nhận ứng viên ${record.candidateName} đã hoàn thành tốt giai đoạn thử việc để giải ngân hoa hồng?`}
              onConfirm={() => handlePassProbation(record)}
              okText="Đạt thử việc"
              cancelText="Hủy"
              okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{
                  borderRadius: 6,
                  fontSize: 12,
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  borderColor: '#16a34a',
                  fontWeight: 600,
                }}
              >
                Đạt thử việc
              </Button>
            </Popconfirm>

            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleOpenFailModal(record)}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Không đạt
            </Button>
          </Space>
        ) : (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {record.status === 'PASSED_PROBATION' ? '✓ Đã kích hoạt Milestone' : '✗ Đã kích hoạt BH thay thế'}
          </span>
        )
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <SafetyCertificateOutlined style={{ color: '#059669', marginRight: 10 }} />
          Theo dõi Bảo hành 60 ngày & Milestone Hoa hồng (Internal HR)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Cổng cập nhật trạng thái thử việc của ứng viên để kích hoạt mốc hoa hồng (Milestone Payout) cho Platform & CTV, hoặc kích hoạt cam kết bảo hành tìm ứng viên thay thế cho Doanh nghiệp.
        </Text>
      </div>

      {/* Role Boundary Explanation Alert */}
      <Alert
        type="info"
        showIcon
        message={<strong>Quy tắc nghiệp vụ Internal HR (Lisa Pham)</strong>}
        description="Internal HR chịu trách nhiệm thẩm định chất lượng nhân sự trong giai đoạn thử việc 60 ngày. HR không sở hữu ví hoa hồng cá nhân như Headhunter/CTV tự do. Khi HR xác nhận 'Đạt thử việc', khoản hoa hồng sẽ tự động chuyển sang trạng thái PAYABLE trên trang Quản trị Tài chính (/admin/payouts) để Platform Admin thực thi giải ngân."
        style={{ marginBottom: 20, borderRadius: 10 }}
      />

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#eff6ff' }}>
            <Statistic
              title="Ứng viên đang trong thử việc"
              value={inProbationCount}
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 28 }}
              prefix={<ClockCircleOutlined style={{ color: '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Đã đạt thử việc (Passed)"
              value={passedCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 28 }}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng hoa hồng đã kích hoạt giải ngân"
              value={totalCommissionUnlocked}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#059669', fontWeight: 800, fontSize: 18 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={candidates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Fail Probation Modal */}
      <Modal
        open={reasonModalOpen}
        onCancel={() => setReasonModalOpen(false)}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#dc2626' }} />
            <span>Ghi nhận thử việc không đạt (Kích hoạt bảo hành)</span>
          </Space>
        }
        onOk={handleConfirmFail}
        okText="Xác nhận Không đạt"
        cancelText="Hủy"
        okButtonProps={{ danger: true, style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        {selectedCandidate && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="warning"
              showIcon
              message="Chính sách bảo hành HRConnect 60 ngày"
              description="Khi ghi nhận ứng viên không đạt thử việc, hệ thống sẽ tự động thông báo tới Doanh nghiệp và kích hoạt yêu cầu cung cấp ứng viên thay thế miễn phí cho vị trí này."
              style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <div style={{ marginBottom: 6, fontWeight: 600 }}>Lý do không đạt / Biên bản đánh giá:</div>
            <Input.TextArea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Nhập lý do chi tiết từ phía Doanh nghiệp (Năng lực, chuyên cần, văn hóa...)"
              rows={4}
              style={{ borderRadius: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
