import React, { useState, useMemo } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal, Input,
  Select, Row, Col, Badge, Avatar, message, Popconfirm, Alert,
} from 'antd';
import {
  TeamOutlined, UserOutlined, LockOutlined, UnlockOutlined,
  EditOutlined, SearchOutlined, SafetyCertificateOutlined,
  ReloadOutlined, PlusOutlined,
} from '@ant-design/icons';
import { UserRole } from '@/types/roles';
import {
  getRegisteredAccounts,
  saveRegisteredAccount,
  type RegisteredAccount,
} from '@/services/accountService';
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

/** Convert RegisteredAccount → SystemUser display shape */
function toSystemUser(acc: RegisteredAccount): SystemUser {
  // Normalize createdAt to a display date string
  let createdAt = acc.createdAt;
  try {
    createdAt = new Date(acc.createdAt).toLocaleDateString('vi-VN');
  } catch {
    /* keep raw */
  }
  return {
    id: acc.id,
    name: acc.fullName,
    email: acc.email,
    role: (acc.role as UserRole) || UserRole.CANDIDATE,
    status: 'ACTIVE',
    createdAt,
    lastLogin: '—',
  };
}

/** Persist locked/role state alongside account data in a local overlay map */
const OVERLAY_KEY = 'hrconnect_admin_user_overlay';

function loadOverlay(): Record<string, Partial<SystemUser>> {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverlay(overlay: Record<string, Partial<SystemUser>>) {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {/* noop */}
}

export const AdminUsersPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Assign Role Modal state
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newRole, setNewRole] = useState<UserRole>(UserRole.CANDIDATE);
  const [roleChangeReason, setRoleChangeReason] = useState('');

  // Overlay: persisted status/role overrides per user id
  const [overlay, setOverlay] = useState<Record<string, Partial<SystemUser>>>(loadOverlay);

  /** Build the merged user list from localStorage on every refresh */
  const allUsers = useMemo<SystemUser[]>(() => {
    const accounts = getRegisteredAccounts();
    const base = accounts.map(toSystemUser);

    // Apply overlay overrides (role changes, lock status)
    return base
      .map((u) => ({ ...u, ...(overlay[u.id] ?? {}) }))
      .sort((a, b) => {
        // Sort newest first: compare raw ISO strings
        const aDate = accounts.find((acc) => acc.id === a.id)?.createdAt ?? '';
        const bDate = accounts.find((acc) => acc.id === b.id)?.createdAt ?? '';
        return bDate.localeCompare(aDate);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, overlay]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Lock / Unlock Handler
  const handleToggleLock = (user: SystemUser) => {
    const nextStatus: 'ACTIVE' | 'LOCKED' = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    const updated = { ...overlay, [user.id]: { ...(overlay[user.id] ?? {}), status: nextStatus } };
    setOverlay(updated);
    saveOverlay(updated);
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
    // Persist role change into overlay
    const updated = { ...overlay, [selectedUser.id]: { ...(overlay[selectedUser.id] ?? {}), role: newRole } };
    setOverlay(updated);
    saveOverlay(updated);
    // Also update accountService so login still works with new role
    saveRegisteredAccount({
      id: selectedUser.id,
      email: selectedUser.email,
      fullName: selectedUser.name,
      role: newRole,
    });
    message.success(
      `Đã cập nhật vai trò của ${selectedUser.name} sang [${ROLE_LABELS[newRole]}]`
    );
    setRoleModalVisible(false);
    handleRefresh();
  };

  // Filtered users
  const filteredUsers = useMemo(
    () =>
      allUsers.filter((u) => {
        const matchesSearch =
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
        const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
      }),
    [allUsers, search, roleFilter, statusFilter]
  );

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
          Quản lý Người dùng &amp; Phân quyền
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Quản trị toàn bộ danh sách tài khoản người dùng, phân quyền vai trò (RBAC) và kiểm soát trạng thái hoạt động.
        </Text>
      </div>

      {/* Live sync info */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 10 }}
        message={
          <span style={{ fontSize: 13 }}>
            Danh sách tự động đồng bộ từ <strong>localStorage</strong> — tài khoản mới đăng ký sẽ xuất hiện ngay sau khi bấm&nbsp;
            <strong>Làm mới</strong>.
          </span>
        }
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} style={{ borderRadius: 6 }}>
            Làm mới
          </Button>
        }
      />

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
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearch('');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                  handleRefresh();
                }}
                style={{ borderRadius: 8 }}
              >
                Đặt lại bộ lọc
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary badge */}
      <div style={{ marginBottom: 10, fontSize: 13, color: '#64748b' }}>
        Hiển thị <strong style={{ color: '#0f172a' }}>{filteredUsers.length}</strong> /&nbsp;
        <strong style={{ color: '#0f172a' }}>{allUsers.length}</strong> tài khoản
        {allUsers.length !== filteredUsers.length && ' (đang lọc)'}
      </div>

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
          pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} tài khoản` }}
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
