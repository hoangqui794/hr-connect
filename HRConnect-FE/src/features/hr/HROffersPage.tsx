import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, message, Popconfirm, Statistic, Descriptions,
} from 'antd';
import {
  SolutionOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, DollarOutlined, BankOutlined,
  FileDoneOutlined, EyeOutlined, SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface OfferRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  offeredSalary: number;
  probationSalaryRate: number; // e.g. 85%
  offerSentDate: string;
  expectedStartDate: string;
  affiliateName: string;
  status: 'OFFER_ACCEPTED' | 'NEGOTIATING' | 'ONBOARDED' | 'OFFER_REJECTED';
  notes?: string;
}

const INITIAL_OFFERS: OfferRecord[] = [
  {
    id: 'off-001',
    candidateName: 'Do Thi Mai',
    candidateEmail: 'mai.do@headhunt.vn',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'Frontend Engineer (React)',
    offeredSalary: 28000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-18',
    expectedStartDate: '2026-10-01',
    affiliateName: 'David Tran',
    status: 'OFFER_ACCEPTED',
    notes: 'Ứng viên đã ký chấp thuận Offer Letter. Chuẩn bị Onboarding.',
  },
  {
    id: 'off-002',
    candidateName: 'Phan Thanh Tung',
    candidateEmail: 'tung.phan@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Backend Java Lead',
    offeredSalary: 45000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-20',
    expectedStartDate: '2026-10-05',
    affiliateName: 'Sarah Le',
    status: 'NEGOTIATING',
    notes: 'Ứng viên đang đề xuất điều chỉnh chế độ bảo hiểm và ngày phép năm.',
  },
  {
    id: 'off-003',
    candidateName: 'Le Thanh Dat',
    candidateEmail: 'dat.le@tech.io',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior Fullstack Engineer',
    offeredSalary: 35000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-01',
    expectedStartDate: '2026-09-15',
    affiliateName: 'David Tran',
    status: 'ONBOARDED',
    notes: 'Đã đi làm chính thức từ ngày 15/09/2026. Đang trong kỳ bảo hành 60 ngày.',
  },
  {
    id: 'off-004',
    candidateName: 'Nguyen Thi C',
    candidateEmail: 'thic.nguyen@outlook.com',
    companyName: 'NexGen AI Solutions Ltd',
    jobTitle: 'Product Designer (UI/UX)',
    offeredSalary: 22000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-10',
    expectedStartDate: '2026-09-25',
    affiliateName: 'Minh Vu Recruiter',
    status: 'OFFER_REJECTED',
    notes: 'Ứng viên nhận offer từ công ty khác với đãi ngộ cao hơn.',
  },
];

export const HROffersPage: React.FC = () => {
  const [offers, setOffers] = useState<OfferRecord[]>(INITIAL_OFFERS);
  const [selectedOffer, setSelectedOffer] = useState<OfferRecord | null>(null);
  const [letterModalOpen, setLetterModalOpen] = useState(false);

  const handleMarkOnboarded = (record: OfferRecord) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === record.id ? { ...o, status: 'ONBOARDED' } : o))
    );
    message.success(
      `Đã xác nhận ${record.candidateName} chính thức Onboarding thành công! Mốc bảo hành 60 ngày đã được kích hoạt.`
    );
  };

  const acceptedOffers = offers.filter((o) => o.status === 'OFFER_ACCEPTED' || o.status === 'NEGOTIATING');
  const onboardedCount = offers.filter((o) => o.status === 'ONBOARDED').length;

  const columns: ColumnsType<OfferRecord> = [
    {
      title: 'Ứng viên & Vị trí tuyển dụng',
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
      title: 'Doanh nghiệp tuyển dụng',
      key: 'company',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            <BankOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.companyName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            CTV: <strong>{record.affiliateName}</strong>
          </div>
        </div>
      ),
    },
    {
      title: 'Mức lương Offer',
      dataIndex: 'offeredSalary',
      key: 'salary',
      render: (v: number) => (
        <div>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>
            {v.toLocaleString('vi-VN')} đ
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Thử việc 85%: {(v * 0.85).toLocaleString('vi-VN')} đ
          </div>
        </div>
      ),
    },
    {
      title: 'Ngày dự kiến Onboard',
      key: 'onboard',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>
            <ClockCircleOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.expectedStartDate}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Gửi Offer: {record.offerSentDate}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái Offer',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        if (s === 'OFFER_ACCEPTED') {
          return <Badge status="success" text={<span style={{ fontWeight: 700, color: '#16a34a' }}>Đã chấp nhận Offer</span>} />;
        }
        if (s === 'NEGOTIATING') {
          return <Badge status="warning" text={<span style={{ fontWeight: 700, color: '#d97706' }}>Đang thương lượng</span>} />;
        }
        if (s === 'ONBOARDED') {
          return <Badge status="processing" text={<span style={{ fontWeight: 700, color: '#0284c7' }}>Đã đi làm (Onboarded)</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 600, color: '#dc2626' }}>Đã từ chối Offer</span>} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedOffer(record);
              setLetterModalOpen(true);
            }}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Thư Offer
          </Button>

          {record.status === 'OFFER_ACCEPTED' && (
            <Popconfirm
              title="Xác nhận ứng viên đã Onboard"
              description={`Xác nhận ${record.candidateName} đã đến nhận việc chính thức tại ${record.companyName}?`}
              onConfirm={() => handleMarkOnboarded(record)}
              okText="Đã Onboard"
              cancelText="Hủy"
              okButtonProps={{ style: { background: '#0284c7', borderColor: '#0284c7' } }}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ borderRadius: 6, fontSize: 12, background: '#0284c7', borderColor: '#0284c7' }}
              >
                Xác nhận Onboard
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <SolutionOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Quản lý Offer & Onboarding (Placement Pipeline)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Theo dõi tiến trình đàm phán Offer, ghi nhận phản hồi chấp nhận/từ chối của ứng viên và xác nhận ngày chính thức Onboarding để kích hoạt chu kỳ bảo hành.
        </Text>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fffbeb' }}>
            <Statistic
              title="Đề nghị Offer đang xử lý"
              value={acceptedOffers.length}
              valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: 28 }}
              prefix={<Badge count={acceptedOffers.length} style={{ backgroundColor: '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Ứng viên đã Onboarding thành công"
              value={onboardedCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 28 }}
              prefix={<FileDoneOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tỷ lệ chấp thuận Offer"
              value={75}
              suffix="%"
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 28 }}
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
          dataSource={offers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Offer Letter Details Modal */}
      <Modal
        open={letterModalOpen}
        onCancel={() => setLetterModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setLetterModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
          selectedOffer?.status === 'OFFER_ACCEPTED' && (
            <Button
              key="onboard"
              type="primary"
              onClick={() => {
                if (selectedOffer) handleMarkOnboarded(selectedOffer);
                setLetterModalOpen(false);
              }}
              style={{ borderRadius: 8, background: '#0284c7' }}
            >
              Xác nhận Onboarding
            </Button>
          ),
        ]}
        title={
          <Space>
            <SolutionOutlined style={{ color: '#0284c7' }} />
            <span>Thư Mời Nhận Việc (Official Offer Letter)</span>
          </Space>
        }
        width={650}
      >
        {selectedOffer && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Ứng viên" span={2}>
                <strong>{selectedOffer.candidateName}</strong> ({selectedOffer.candidateEmail})
              </Descriptions.Item>
              <Descriptions.Item label="Doanh nghiệp tuyển dụng" span={2}>
                <strong>{selectedOffer.companyName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí tuyển dụng" span={2}>
                {selectedOffer.jobTitle}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương chính thức">
                <span style={{ color: '#059669', fontWeight: 700 }}>
                  {selectedOffer.offeredSalary.toLocaleString('vi-VN')} đ/tháng
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Lương thử việc (85%)">
                {(selectedOffer.offeredSalary * 0.85).toLocaleString('vi-VN')} đ/tháng
              </Descriptions.Item>
              <Descriptions.Item label="Ngày gửi Offer">
                {selectedOffer.offerSentDate}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu làm việc">
                <strong>{selectedOffer.expectedStartDate}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="CTV giới thiệu" span={2}>
                {selectedOffer.affiliateName}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú điều phối" span={2}>
                {selectedOffer.notes || 'Không có ghi chú.'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};
