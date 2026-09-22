import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  Select, Row, Col, Badge, Avatar, message, Popconfirm, Form,
} from 'antd';
import {
  TeamOutlined, UserOutlined, LockOutlined, UnlockOutlined,
  EditOutlined, SearchOutlined, SafetyCertificateOutlined,
  FilterOutlined, ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { UserRole, DEMO_USERS } from '@/types/roles';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'LOCKED';
  createdAt: string;
  lastLogin: string;
}

const INITIAL_USERS: SystemUser[] = [
  ...Object.values(DEMO_USERS).map((u, i) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: 'ACTIVE' as const,
    createdAt: `2026-0${Math.min(9, i + 1)}-10`,
    lastLogin: '2026-09-22 14:30',
  })),
  {
    id: 'user-006',
    name: 'Phan Quoc Bao',
    email: 'bao.phan@vng.com.vn',
    role: UserRole.CLIENT,
    status: 'ACTIVE',
    createdAt: '2026-08-15',
    lastLogin: '2026-09-21 09:15',
  },
  {
    id: 'user-007',
    name: 'Do Thi Mai',
    email: 'mai.do@headhunt.vn',
    role: UserRole.AFFILIATE,
    status: 'ACTIVE',
    createdAt: '2026-08-20',
    lastLogin: '2026-09-22 18:40',
  },
  {
    id: 'user-008',
    name: 'Nguyen Van Spam',
    email: 'spam.bot@trashmail.com',
    role: UserRole.CANDIDATE,
    status: 'LOCKED',
    createdAt: '2026-09-01',
    lastLogin: '2026-09-02 11:20',
  },
];

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '#dc2626',
  [UserRole.INTERNAL_HR]: '#7c3aed',
  [UserRole.CLIENT]: '#2563eb',
  [UserRole.AFFILIATE]: '#059669',
  [UserRole.CANDIDATE]: '#0891b2',
  [UserRole.GUEST]: '#64748b',
};

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Platform Admin',
  [UserRole.INTERNAL_HR]: 'Internal HR',
  [UserRole.CLIENT]: 'Doanh nghiệp (Client)',
  [UserRole.AFFILIATE]: 'CTV / Headhunter',
  [UserRole.CANDIDATE]: 'Ứng viên (Candidate)',
  [UserRole.GUEST]: 'Khách',
};

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Assign Role Modal state
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newRole, setNewRole] = useState<UserRole>(UserRole.CANDIDATE);
  const [roleChangeReason, setRoleChangeReason] = useState('');

  // Lock / Unlock Handler
  const handleToggleLock = (user: SystemUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );
    if (nextStatus === 'LOCKED') {
      message.warning(`Đã khóa tài khoản của ${user.name} (${user.email})`);
    } else {
      message.success(`Đã mở khóa tài khoản của ${user.name} (${user.email})`);
    }
  };

  // Assign Role Handler
  const handleOpenRoleModal = (user: SystemUser) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setRoleChangeReason('');
    setRoleModalVisible(true);
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u))
    );
    message.success(
      `Đã cập nhật vai trò của ${selectedUser.name} sang [${ROLE_LABELS[newRole]}]`
    );
    setRoleModalVisible(false);
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const columns: ColumnsType<SystemUser> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            style={{
              backgroundColor: ROLE_COLORS[record.role],
              fontWeight: 700,
            }}
          >
            {record.name.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vai trò (Role)',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag
          color={ROLE_COLORS[role]}
          style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
        >
          {ROLE_LABELS[role]}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'ACTIVE' | 'LOCKED') => (
        <Badge
          status={status === 'ACTIVE' ? 'success' : 'error'}
          text={
            <span
              style={{
                fontWeight: 600,
                color: status === 'ACTIVE' ? '#16a34a' : '#dc2626',
              }}
            >
              {status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
            </span>
          }
        />
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => <span style={{ color: '#64748b', fontSize: 13 }}>{val}</span>,
    },
    {
      title: 'Đăng nhập gần nhất',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (val: string) => <span style={{ color: '#64748b', fontSize: 13 }}>{val}</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenRoleModal(record)}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Đổi vai trò
          </Button>
          {record.status === 'ACTIVE' ? (
            <Popconfirm
              title="Khóa tài khoản"
              description={`Bạn có chắc muốn tạm khóa tài khoản của ${record.name}?`}
              onConfirm={() => handleToggleLock(record)}
              okText="Khóa ngay"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<LockOutlined />}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                Khóa
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              icon={<UnlockOutlined />}
              onClick={() => handleToggleLock(record)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                color: '#16a34a',
                borderColor: '#16a34a',
              }}
            >
              Mở khóa
            </Button>
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
          <TeamOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Quản lý Người dùng & Phân quyền
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Quản trị toàn bộ danh sách tài khoản người dùng, phân quyền vai trò (RBAC) và kiểm soát trạng thái hoạt động.
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
          <Col xs={24} md={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo tên hoặc email người dùng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: '100%' }}
              options={[
                { label: 'Tất cả vai trò', value: 'ALL' },
                { label: 'Platform Admin', value: UserRole.ADMIN },
                { label: 'Internal HR', value: UserRole.INTERNAL_HR },
                { label: 'Doanh nghiệp (Client)', value: UserRole.CLIENT },
                { label: 'CTV / Headhunter', value: UserRole.AFFILIATE },
                { label: 'Ứng viên (Candidate)', value: UserRole.CANDIDATE },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              options={[
                { label: 'Tất cả trạng thái', value: 'ALL' },
                { label: 'Đang hoạt động', value: 'ACTIVE' },
                { label: 'Đã khóa', value: 'LOCKED' },
              ]}
            />
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearch('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              style={{ borderRadius: 8 }}
            >
              Đặt lại bộ lọc
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Users Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Assign Role Modal */}
      <Modal
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#0284c7' }} />
            <span>Phân quyền vai trò người dùng (Assign Role)</span>
          </Space>
        }
        onOk={handleSaveRole}
        okText="Xác nhận cấp vai trò"
        okButtonProps={{
          style: {
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            borderColor: '#0284c7',
          },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        {selectedUser && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                background: '#f8fafc',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #e2e8f0',
              }}
            >
              <div><strong>Họ tên:</strong> {selectedUser.name}</div>
              <div style={{ marginTop: 4 }}><strong>Email:</strong> {selectedUser.email}</div>
              <div style={{ marginTop: 4 }}>
                <strong>Vai trò hiện tại:</strong>{' '}
                <Tag color={ROLE_COLORS[selectedUser.role]}>
                  {ROLE_LABELS[selectedUser.role]}
                </Tag>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                Chọn vai trò mới:
              </label>
              <Select
                value={newRole}
                onChange={setNewRole}
                style={{ width: '100%' }}
                options={[
                  { label: 'Platform Admin (Toàn quyền hệ thống)', value: UserRole.ADMIN },
                  { label: 'Internal HR (Điều phối tuyển dụng & Sàng lọc AI)', value: UserRole.INTERNAL_HR },
                  { label: 'Doanh nghiệp (Client - Đăng tin & Tuyển dụng)', value: UserRole.CLIENT },
                  { label: 'CTV / Headhunter (Affiliate - Giới thiệu ứng viên)', value: UserRole.AFFILIATE },
                  { label: 'Ứng viên (Candidate - Tìm việc & Tạo CV)', value: UserRole.CANDIDATE },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                Ghi chú lý do thay đổi (Audit Log):
              </label>
              <Input.TextArea
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder="Nhập lý do điều chỉnh quyền hạn của tài khoản này..."
                rows={3}
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
