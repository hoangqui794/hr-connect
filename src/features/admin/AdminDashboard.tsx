import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  Row, Col, Alert, Badge, Tabs, message,
} from 'antd';
import {
  SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  DollarOutlined, UserOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { KNOWN_DUPLICATES } from '@/services/mockData';
import { useCommissions } from '@/services/queries/useFinancials';
import { PayoutStatusBadge } from '@/components/common/StatusBadge';
import { PayoutStatus } from '@/types/affiliate';
import type { Commission } from '@/types/affiliate';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const AdminDashboard: React.FC = () => {
  const { data: commissions } = useCommissions();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const payableCommissions = commissions?.filter(c => c.status === PayoutStatus.PAYABLE) ?? [];

  const disputeColumns = [
    { title: 'Candidate Email', dataIndex: 'candidateEmail', key: 'email' },
    {
      title: 'Original Submitter',
      key: 'original',
      render: (_: unknown, record: typeof KNOWN_DUPLICATES[0]) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.originalAffiliateName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(record.originalTimestamp).toLocaleString()}
          </div>
        </div>
      ),
    },
    { title: 'Job ID', dataIndex: 'jobId', key: 'jobId' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'BLOCKED' ? 'error' : s === 'DISPUTE_PENDING' ? 'warning' : 'success'} style={{ borderRadius: 6 }}>
          {s}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <Button
          size="small"
          type="primary"
          onClick={() => setResolveOpen(true)}
          style={{ borderRadius: 6 }}
        >
          Resolve
        </Button>
      ),
    },
  ];

  const payoutColumns: ColumnsType<Commission> = [
    { title: 'Candidate', dataIndex: 'candidateName', key: 'name' },
    { title: 'Affiliate', dataIndex: 'affiliateName', key: 'affiliate' },
    {
      title: 'Amount',
      dataIndex: 'commissionAmount',
      key: 'amount',
      render: (v: number) => <span style={{ fontWeight: 700, color: '#10b981' }}>${v.toLocaleString()}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: PayoutStatus) => <PayoutStatusBadge status={s} />,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        record.status === PayoutStatus.PAYABLE ? (
          <Button
            size="small"
            style={{ borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600 }}
            onClick={() => void message.success(`Payout of $${record.commissionAmount.toLocaleString()} to ${record.affiliateName} initiated!`)}
          >
            Execute Payout
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <SettingOutlined style={{ color: '#ef4444', marginRight: 8 }} />
          Platform Admin Control
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Dispute resolution, payout execution, and system configuration.
        </Text>
      </div>

      {/* Admin Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Pending Disputes', value: KNOWN_DUPLICATES.length, color: '#ef4444', icon: <ExclamationCircleOutlined /> },
          { label: 'Payable Commissions', value: payableCommissions.length, color: '#10b981', icon: <DollarOutlined /> },
          { label: 'Active Jobs', value: 5, color: '#0284c7', icon: <CheckCircleOutlined /> },
          { label: 'Total Affiliates', value: 24, color: '#8b5cf6', icon: <UserOutlined /> },
        ].map((s) => (
          <Col key={s.label} xs={12} sm={6}>
            <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>
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

      <Tabs
        defaultActiveKey="disputes"
        items={[
          {
            key: 'disputes',
            label: (
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
                Duplicate Disputes
                <Badge count={KNOWN_DUPLICATES.length} style={{ background: '#ef4444' }} />
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="First-Submission Audit Trail"
                  description="All disputes are resolved using First-Submission Timestamps. Original submission timestamps are immutable and cryptographically logged."
                  style={{ marginBottom: 16, borderRadius: 10 }}
                />
                <Table
                  dataSource={KNOWN_DUPLICATES}
                  columns={disputeColumns}
                  rowKey="originalSubmissionId"
                  pagination={false}
                  size="middle"
                />
              </Card>
            ),
          },
          {
            key: 'payouts',
            label: (
              <Space>
                <DollarOutlined style={{ color: '#10b981' }} />
                Payout Execution
                <Badge count={payableCommissions.length} style={{ background: '#10b981' }} />
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
        title={<Space><CheckCircleOutlined style={{ color: '#10b981' }} /><span>Resolve Duplicate Dispute</span></Space>}
        onOk={() => { setResolveOpen(false); void message.success('Dispute resolved. Both affiliates have been notified.'); }}
        okText="Confirm Resolution"
        okButtonProps={{ style: { borderRadius: 8, background: '#10b981', borderColor: '#10b981' } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Alert
          type="info"
          showIcon
          message="Resolution Decision"
          description="Award commission rights to the affiliate with the earliest verified First-Submission Timestamp. This decision is final and logged to the audit trail."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Resolution Notes (required)</span>
        </div>
        <TextArea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Document your resolution decision and rationale..."
          rows={4}
          style={{ borderRadius: 8 }}
        />
      </Modal>
    </div>
  );
};
