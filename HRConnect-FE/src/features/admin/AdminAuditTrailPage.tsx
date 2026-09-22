import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Input,
  Select, Row, Col, Badge, Tooltip,
} from 'antd';
import {
  AuditOutlined, SearchOutlined, ReloadOutlined,
  SafetyCertificateOutlined, KeyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: 'ROLE_ASSIGNED' | 'USER_LOCKED' | 'USER_UNLOCKED' | 'DISPUTE_RESOLVED' | 'PAYOUT_EXECUTED' | 'CONFIG_UPDATED';
  target: string;
  details: string;
  ipAddress: string;
  integrityHash: string;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-2026-0922-01',
    timestamp: '2026-09-22 15:45:10',
    actorName: 'Platform Admin',
    actorRole: 'ADMIN',
    action: 'PAYOUT_EXECUTED',
    target: 'CTV David Tran (Techcombank 19034567890123)',
    details: 'Chi trả hoa hồng 25.000.000 đ cho ứng viên Le Hoang Minh (Senior React Developer - Hết 60 ngày bảo hành).',
    ipAddress: '118.69.182.45',
    integrityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  {
    id: 'AUD-2026-0922-02',
    timestamp: '2026-09-22 14:30:22',
    actorName: 'Platform Admin',
    actorRole: 'ADMIN',
    action: 'DISPUTE_RESOLVED',
    target: 'Hồ sơ Nguyen Van Tranh Chap (job-001)',
    details: 'Phán quyết công nhận quyền sở hữu ứng viên cho CTV David Tran căn cứ First-Submission Timestamp 2026-09-18T10:15:32Z.',
    ipAddress: '118.69.182.45',
    integrityHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
  },
  {
    id: 'AUD-2026-0922-03',
    timestamp: '2026-09-22 11:15:00',
    actorName: 'Platform Admin',
    actorRole: 'ADMIN',
    action: 'USER_LOCKED',
    target: 'Nguyen Van Spam (spam.bot@trashmail.com)',
    details: 'Tạm khóa tài khoản do phát hiện hành vi spam CV hàng loạt vi phạm chính sách nền tảng.',
    ipAddress: '118.69.182.45',
    integrityHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
  },
  {
    id: 'AUD-2026-0921-04',
    timestamp: '2026-09-21 16:20:45',
    actorName: 'Platform Admin',
    actorRole: 'ADMIN',
    action: 'ROLE_ASSIGNED',
    target: 'Do Thi Mai (mai.do@headhunt.vn)',
    details: 'Cấp quyền vai trò từ CANDIDATE sang AFFILIATE sau khi thẩm định hồ sơ định danh.',
    ipAddress: '14.161.12.89',
    integrityHash: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
  },
  {
    id: 'AUD-2026-0920-05',
    timestamp: '2026-09-20 09:10:12',
    actorName: 'Platform Admin',
    actorRole: 'ADMIN',
    action: 'CONFIG_UPDATED',
    target: 'Tham số hoa hồng toàn sàn',
    details: 'Cập nhật tỷ lệ hoa hồng COD: 80% CTV / 20% Nền tảng; Thời gian bảo hành: 60 ngày.',
    ipAddress: '14.161.12.89',
    integrityHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
  },
];

const ACTION_CONFIGS: Record<string, { label: string; color: string }> = {
  PAYOUT_EXECUTED: { label: 'Chi trả Payout', color: 'green' },
  DISPUTE_RESOLVED: { label: 'Xử lý tranh chấp', color: 'orange' },
  USER_LOCKED: { label: 'Khóa tài khoản', color: 'red' },
  USER_UNLOCKED: { label: 'Mở khóa tài khoản', color: 'blue' },
  ROLE_ASSIGNED: { label: 'Phân quyền Role', color: 'purple' },
  CONFIG_UPDATED: { label: 'Đổi cấu hình', color: 'cyan' },
};

export const AdminAuditTrailPage: React.FC = () => {
  const [logs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Mã Log & Thời gian',
      key: 'logInfo',
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.id}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.timestamp}</div>
        </div>
      ),
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 170,
      render: (act: string) => {
        const conf = ACTION_CONFIGS[act] || { label: act, color: 'default' };
        return (
          <Tag color={conf.color} style={{ borderRadius: 6, fontWeight: 700 }}>
            {conf.label}
          </Tag>
        );
      },
    },
    {
      title: 'Đối tượng & Chi tiết thay đổi',
      key: 'details',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            {record.target}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {record.details}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
            <KeyOutlined style={{ marginRight: 4 }} />
            SHA-256: {record.integrityHash.slice(0, 16)}...{record.integrityHash.slice(-8)}
          </div>
        </div>
      ),
    },
    {
      title: 'Người thực hiện (Actor)',
      key: 'actor',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.actorName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            IP: {record.ipAddress}
          </div>
          <Tag color="magenta" style={{ fontSize: 10, borderRadius: 4, marginTop: 2 }}>
            {record.actorRole}
          </Tag>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <AuditOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Nhật ký Kiểm toán Hệ thống (System Audit Trail)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Toàn bộ các tác vụ bảo mật, phân quyền, phán quyết tranh chấp và chi trả tài chính đều được ghi nhận bất biến cùng mã băm đối soát SHA-256.
        </Text>
      </div>

      {/* Filter Toolbar */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 16,
          border: '1px solid #e2e8f0',
        }}
        styles={{ body: { padding: '14px 18px' } }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo mã log, đối tượng hoặc nội dung chi tiết..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={16} md={6}>
            <Select
              value={actionFilter}
              onChange={setActionFilter}
              style={{ width: '100%' }}
              options={[
                { label: 'Tất cả hành động', value: 'ALL' },
                { label: 'Chi trả Payout', value: 'PAYOUT_EXECUTED' },
                { label: 'Xử lý tranh chấp', value: 'DISPUTE_RESOLVED' },
                { label: 'Phân quyền Role', value: 'ROLE_ASSIGNED' },
                { label: 'Khóa / Mở tài khoản', value: 'USER_LOCKED' },
                { label: 'Đổi cấu hình hệ thống', value: 'CONFIG_UPDATED' },
              ]}
            />
          </Col>
          <Col xs={8} md={8} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearch('');
                setActionFilter('ALL');
              }}
              style={{ borderRadius: 8 }}
            >
              Đặt lại
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Audit Log Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={filteredLogs}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>
    </div>
  );
};
