import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  Row, Col, Alert, Badge, Tabs, message, Empty, Statistic,
} from 'antd';
import {
  SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  DollarOutlined, UserOutlined, ClockCircleOutlined, TeamOutlined,
  BankOutlined, ApartmentOutlined, AuditOutlined, ArrowRightOutlined,
  SafetyCertificateOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { KNOWN_DUPLICATES } from '@/services/mockData';
import { useCommissions } from '@/services/queries/useFinancials';
import { PayoutStatusBadge } from '@/components/common/StatusBadge';
import { PayoutStatus } from '@/types/affiliate';
import type { Commission } from '@/types/affiliate';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDemoAdmin = user?.id === 'admin-001' || user?.email?.includes('admin@hrconnect');
  const disputes = isDemoAdmin ? KNOWN_DUPLICATES : [];

  const { data: commissions } = useCommissions();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const payableCommissions = commissions?.filter((c) => c.status === PayoutStatus.PAYABLE) ?? [];

  const disputeColumns = [
    { title: 'Email Ứng viên', dataIndex: 'candidateEmail', key: 'email' },
    {
      title: 'CTV nộp đầu tiên (Gốc)',
      key: 'original',
      render: (_: unknown, record: typeof KNOWN_DUPLICATES[0]) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.originalAffiliateName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(record.originalTimestamp).toLocaleString('vi-VN')}
          </div>
        </div>
      ),
    },
    { title: 'Job ID', dataIndex: 'jobId', key: 'jobId' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag
          color={s === 'BLOCKED' ? 'error' : s === 'DISPUTE_PENDING' ? 'warning' : 'success'}
          style={{ borderRadius: 6, fontWeight: 700 }}
        >
          {s === 'DISPUTE_PENDING' ? 'Chờ phán quyết' : s}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: () => (
        <Button
          size="small"
          type="primary"
          onClick={() => setResolveOpen(true)}
          style={{ borderRadius: 6, fontWeight: 600, background: '#ef4444', borderColor: '#ef4444' }}
        >
          Phán quyết
        </Button>
      ),
    },
  ];

  const payoutColumns: ColumnsType<Commission> = [
    { title: 'Ứng viên', dataIndex: 'candidateName', key: 'name' },
    { title: 'CTV thụ hưởng', dataIndex: 'affiliateName', key: 'affiliate' },
    {
      title: 'Số tiền chi trả',
      dataIndex: 'commissionAmount',
      key: 'amount',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          ${v.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: PayoutStatus) => <PayoutStatusBadge status={s} />,
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) =>
        record.status === PayoutStatus.PAYABLE ? (
          <Button
            size="small"
            style={{
              borderRadius: 6,
              background: '#059669',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
            }}
            onClick={() =>
              void message.success(
                `Lệnh chi trả $${record.commissionAmount.toLocaleString()} cho ${record.affiliateName} đã được thực thi!`
              )
            }
          >
            Thực thi Payout
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <SettingOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Bảng Điều khiển Quản trị Nền tảng (Platform Administration)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Giám sát tập trung các chỉ số KPI vận hành sàn HRConnect, xử lý tranh chấp hồ sơ, phê duyệt chi trả hoa hồng và kiểm tra nhật ký kiểm toán.
        </Text>
      </div>

      {/* Admin KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: 'Tranh chấp chờ xử lý',
            value: disputes.length,
            color: '#ef4444',
            icon: <ExclamationCircleOutlined />,
            link: '/admin/disputes',
          },
          {
            label: 'Hoa hồng chờ chi trả',
            value: payableCommissions.length,
            color: '#059669',
            icon: <DollarOutlined />,
            link: '/admin/payouts',
          },
          {
            label: 'Doanh nghiệp tuyển dụng',
            value: isDemoAdmin ? 12 : 2,
            color: '#0284c7',
            icon: <BankOutlined />,
            link: '/admin/companies',
          },
          {
            label: 'Mạng lưới CTV / Headhunter',
            value: isDemoAdmin ? 48 : 5,
            color: '#7c3aed',
            icon: <ApartmentOutlined />,
            link: '/admin/affiliates',
          },
        ].map((s) => (
          <Col key={s.label} xs={12} sm={6}>
            <Card
              hoverable
              onClick={() => navigate(s.link)}
              style={{ borderRadius: 14, border: '1px solid #e2e8f0', cursor: 'pointer' }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${s.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: s.color,
                    fontSize: 20,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 4 Core Administrative Domains Quick Access */}
      <Card
        title={
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
            Phân hệ Quản trị Vận hành Toàn diện (SDD/SRS Modules)
          </span>
        }
        style={{
          borderRadius: 14,
          marginBottom: 24,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/users')}
              style={{
                padding: '16px',
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <TeamOutlined style={{ fontSize: 20, color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Người dùng & Phân quyền</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Quản lý danh sách tài khoản, khóa/mở khóa tài khoản và phân quyền vai trò (Assign Role).
              </div>
              <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                Truy cập ngay <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/disputes')}
              style={{
                padding: '16px',
                borderRadius: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#fecaca')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <SafetyCertificateOutlined style={{ fontSize: 20, color: '#dc2626' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>Xử lý Tranh chấp Hồ sơ</span>
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 12 }}>
                Giải quyết tranh chấp trùng lặp ứng viên dựa trên First-Submission Timestamp.
              </div>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                Xem {disputes.length} vụ việc <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/payouts')}
              style={{
                padding: '16px',
                borderRadius: 12,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#16a34a')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#bbf7d0')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <DollarOutlined style={{ fontSize: 20, color: '#059669' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>Duyệt Chi trả Payout</span>
              </div>
              <div style={{ fontSize: 12, color: '#14532d', marginBottom: 12 }}>
                Giám sát doanh thu sàn và duyệt lệnh chi trả hoa hồng hết 60 ngày bảo hành.
              </div>
              <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                Duyệt Payout <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/audit-trail')}
              style={{
                padding: '16px',
                borderRadius: 12,
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7c3aed')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e9d5ff')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <AuditOutlined style={{ fontSize: 20, color: '#7c3aed' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#581c87' }}>Nhật ký Kiểm toán</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b21a8', marginBottom: 12 }}>
                Lưu vết kiểm tra bất biến đối soát toàn bộ hành động bảo mật và tài chính.
              </div>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                Xem Audit Trail <ArrowRightOutlined />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Tabs Section */}
      <Tabs
        defaultActiveKey="disputes"
        items={[
          {
            key: 'disputes',
            label: (
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
                <span>Tranh chấp trùng lặp ứng viên</span>
                <Badge count={disputes.length} style={{ background: '#ef4444' }} />
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Kiểm toán Mốc thời gian Nộp đầu tiên (First-Submission Audit Trail)"
                  description="Mọi tranh chấp giữa các CTV đều được phân xử tự động và minh bạch bằng chứng First-Submission Timestamps bất biến."
                  style={{ marginBottom: 16, borderRadius: 10 }}
                />
                {disputes.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Hiện không có tranh chấp trùng lặp ứng viên nào cần xử lý."
                  />
                ) : (
                  <Table
                    dataSource={disputes}
                    columns={disputeColumns}
                    rowKey="originalSubmissionId"
                    pagination={false}
                    size="middle"
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'payouts',
            label: (
              <Space>
                <DollarOutlined style={{ color: '#059669' }} />
                <span>Thực thi Chi trả Hoa hồng (Payout Execution)</span>
                <Badge count={payableCommissions.length} style={{ background: '#059669' }} />
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <Table
                  dataSource={commissions ?? []}
                  columns={payoutColumns}
                  rowKey="id"
                  size="middle"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Resolve Dispute Modal */}
      <Modal
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#16a34a' }} />
            <span>Phán quyết Tranh chấp Trùng lặp Hồ sơ</span>
          </Space>
        }
        onOk={() => {
          setResolveOpen(false);
          void message.success('Đã phân xử tranh chấp thành công. Quyền lợi hoa hồng đã được cập nhật.');
        }}
        okText="Xác nhận phán quyết"
        okButtonProps={{ style: { borderRadius: 8, background: '#16a34a', borderColor: '#16a34a' } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Alert
          type="info"
          showIcon
          message="Nguyên tắc phân xử"
          description="Công nhận quyền nhận hoa hồng cho đối tác CTV nộp hồ sơ sớm nhất theo mốc thời gian First-Submission được ghi nhận trong cơ sở dữ liệu."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Ghi chú phán quyết (Bắt buộc cho Audit Trail)</span>
        </div>
        <TextArea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Nhập lý do và cơ sở đối soát..."
          rows={4}
          style={{ borderRadius: 8 }}
        />
      </Modal>
    </div>
  );
};

export default AdminDashboard;

