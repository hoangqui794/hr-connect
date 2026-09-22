import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  Row, Col, Alert, Badge, message, Empty, Descriptions,
} from 'antd';
import {
  ExclamationCircleOutlined, CheckCircleOutlined,
  ClockCircleOutlined, SafetyCertificateOutlined,
  UserOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { KNOWN_DUPLICATES } from '@/services/mockData';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DuplicateDispute {
  originalSubmissionId: string;
  candidateEmail: string;
  candidateName?: string;
  originalAffiliateName: string;
  originalTimestamp: string;
  competingAffiliateName?: string;
  competingTimestamp?: string;
  jobId: string;
  jobTitle?: string;
  status: 'DISPUTE_PENDING' | 'RESOLVED' | 'BLOCKED';
}

const INITIAL_DISPUTES: DuplicateDispute[] = [
  {
    originalSubmissionId: 'sub-099',
    candidateEmail: 'candidate.dup@example.com',
    candidateName: 'Nguyen Van Tranh Chap',
    originalAffiliateName: 'David Tran',
    originalTimestamp: '2026-09-18T10:15:32Z',
    competingAffiliateName: 'Sarah Le',
    competingTimestamp: '2026-09-18T10:45:10Z',
    jobId: 'job-001',
    jobTitle: 'Senior React Developer (COD)',
    status: 'DISPUTE_PENDING',
  },
  {
    originalSubmissionId: 'sub-102',
    candidateEmail: 'le.thanh@gmail.com',
    candidateName: 'Le Thanh Dat',
    originalAffiliateName: 'Minh Vu Recruiter',
    originalTimestamp: '2026-09-15T08:20:00Z',
    competingAffiliateName: 'Nguyen Van Talent',
    competingTimestamp: '2026-09-15T14:30:22Z',
    jobId: 'job-002',
    jobTitle: 'Full-stack Node.js Engineer',
    status: 'DISPUTE_PENDING',
  },
  {
    originalSubmissionId: 'sub-088',
    candidateEmail: 'hoang.nam@tech.io',
    candidateName: 'Hoang Nam Anh',
    originalAffiliateName: 'David Tran',
    originalTimestamp: '2026-09-10T09:00:15Z',
    competingAffiliateName: 'Spam Affiliate Account',
    competingTimestamp: '2026-09-10T16:12:00Z',
    jobId: 'job-003',
    jobTitle: 'DevOps & Cloud Lead',
    status: 'RESOLVED',
  },
];

export const AdminDisputesPage: React.FC = () => {
  const [disputes, setDisputes] = useState<DuplicateDispute[]>(INITIAL_DISPUTES);
  const [selectedDispute, setSelectedDispute] = useState<DuplicateDispute | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const pendingDisputes = disputes.filter((d) => d.status === 'DISPUTE_PENDING');
  const resolvedDisputes = disputes.filter((d) => d.status === 'RESOLVED');

  const handleOpenResolve = (dispute: DuplicateDispute) => {
    setSelectedDispute(dispute);
    setResolution(
      `Căn cứ kiểm toán hệ thống First-Submission Timestamp: CTV [${dispute.originalAffiliateName}] nộp hồ sơ vào lúc ${new Date(
        dispute.originalTimestamp
      ).toLocaleString('vi-VN')} (sớm hơn CTV đối chiếu). Quyết định: Công nhận quyền sở hữu hồ sơ và hưởng hoa hồng cho [${
        dispute.originalAffiliateName
      }].`
    );
    setResolveOpen(true);
  };

  const handleConfirmResolution = () => {
    if (!selectedDispute) return;
    setDisputes((prev) =>
      prev.map((d) =>
        d.originalSubmissionId === selectedDispute.originalSubmissionId
          ? { ...d, status: 'RESOLVED' }
          : d
      )
    );
    message.success(
      `Đã phân xử tranh chấp cho ứng viên ${selectedDispute.candidateEmail}. Quyền lợi hoa hồng thuộc về ${selectedDispute.originalAffiliateName}.`
    );
    setResolveOpen(false);
  };

  const columns: ColumnsType<DuplicateDispute> = [
    {
      title: 'Ứng viên & Tin tuyển dụng',
      key: 'candidate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            {record.candidateName || record.candidateEmail}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.candidateEmail}</div>
          <Tag color="blue" style={{ marginTop: 4, borderRadius: 4, fontSize: 11 }}>
            {record.jobTitle || `Job #${record.jobId}`}
          </Tag>
        </div>
      ),
    },
    {
      title: 'CTV nộp đầu tiên (Gốc)',
      key: 'original',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#16a34a' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {record.originalAffiliateName}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(record.originalTimestamp).toLocaleString('vi-VN')}
          </div>
          <Tag color="success" style={{ borderRadius: 4, fontSize: 10, marginTop: 2 }}>
            Hợp lệ (Timestamp sớm hơn)
          </Tag>
        </div>
      ),
    },
    {
      title: 'CTV nộp sau (Trùng lặp)',
      key: 'competing',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#d97706' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {record.competingAffiliateName || 'CTV khiếu nại'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {record.competingTimestamp
              ? new Date(record.competingTimestamp).toLocaleString('vi-VN')
              : 'Nộp sau'}
          </div>
          <Tag color="warning" style={{ borderRadius: 4, fontSize: 10, marginTop: 2 }}>
            Trùng lặp ghi nhận
          </Tag>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag
          color={s === 'RESOLVED' ? 'success' : s === 'DISPUTE_PENDING' ? 'warning' : 'error'}
          style={{ borderRadius: 6, fontWeight: 700 }}
        >
          {s === 'RESOLVED' ? 'Đã phán quyết' : s === 'DISPUTE_PENDING' ? 'Chờ xử lý' : s}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        record.status === 'DISPUTE_PENDING' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => handleOpenResolve(record)}
            style={{
              borderRadius: 6,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderColor: '#dc2626',
              fontWeight: 600,
            }}
          >
            Phán quyết
          </Button>
        ) : (
          <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
            <CheckCircleOutlined style={{ marginRight: 4 }} />
            Đã giải quyết
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
          <SafetyCertificateOutlined style={{ color: '#dc2626', marginRight: 10 }} />
          Trung tâm Xử lý Tranh chấp Hồ sơ (Dispute Resolution)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Giải quyết tranh chấp trùng lặp ứng viên và quyền ghi nhận hoa hồng giữa các CTV dựa trên bằng chứng bất biến First-Submission Timestamp.
        </Text>
      </div>

      {/* Info Banner */}
      <Alert
        type="warning"
        showIcon
        message={<strong>Nguyên tắc First-Submission Timestamp Audit</strong>}
        description="Mỗi CV khi được giới thiệu lên nền tảng đều được gắn nhãn thời gian nộp gốc (Timestamp) kèm mã băm chống chỉnh sửa. Khi có nhiều CTV cùng giới thiệu 1 ứng viên, quyền hưởng hoa hồng luôn thuộc về CTV nộp đầu tiên đáp ứng điều kiện."
        style={{ marginBottom: 20, borderRadius: 10 }}
      />

      {/* Disputes Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>
              {pendingDisputes.length}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tranh chấp đang chờ xử lý</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>
              {resolvedDisputes.length}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tranh chấp đã phán quyết xong</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0284c7' }}>
              100%
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tỷ lệ minh bạch First-Timestamp</div>
          </Card>
        </Col>
      </Row>

      {/* Disputes Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={disputes}
          columns={columns}
          rowKey="originalSubmissionId"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Resolve Dispute Modal */}
      <Modal
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#16a34a' }} />
            <span>Phán quyết & Phân bổ Hoa hồng Tranh chấp</span>
          </Space>
        }
        onOk={handleConfirmResolution}
        okText="Xác nhận Phán quyết"
        okButtonProps={{
          style: {
            borderRadius: 8,
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            borderColor: '#16a34a',
            fontWeight: 700,
          },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={650}
      >
        {selectedDispute && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="info"
              showIcon
              message="Cơ sở ra quyết định"
              description={`CTV [${selectedDispute.originalAffiliateName}] có mốc First-Submission Timestamp sớm hơn so với [${selectedDispute.competingAffiliateName}]. Phán quyết này sẽ cập nhật trạng thái hoa hồng và ghi nhận vào Nhật ký kiểm toán hệ thống.`}
              style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Ứng viên tranh chấp">
                <strong>{selectedDispute.candidateName || selectedDispute.candidateEmail}</strong> ({selectedDispute.candidateEmail})
              </Descriptions.Item>
              <Descriptions.Item label="CTV nộp đầu tiên">
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{selectedDispute.originalAffiliateName}</span> - Lúc {new Date(selectedDispute.originalTimestamp).toLocaleString('vi-VN')}
              </Descriptions.Item>
              <Descriptions.Item label="CTV khiếu nại (Nộp sau)">
                <span style={{ color: '#d97706', fontWeight: 600 }}>{selectedDispute.competingAffiliateName}</span> - Lúc {selectedDispute.competingTimestamp ? new Date(selectedDispute.competingTimestamp).toLocaleString('vi-VN') : 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 6, fontWeight: 600 }}>
              Nội dung phán quyết & Rationale (Ghi nhận Audit Trail):
            </div>
            <TextArea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              style={{ borderRadius: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
