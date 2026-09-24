import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, Avatar, message, Popconfirm, Descriptions, Statistic,
} from 'antd';
import {
  ApartmentOutlined, CheckCircleOutlined,
  StopOutlined, CrownOutlined, IdcardOutlined,
  DollarOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface AffiliateRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  taxCode: string;
  rank: 'PLATINUM' | 'GOLD' | 'SILVER';
  totalSubmitted: number;
  successfulHires: number;
  warrantyPassRate: number; // percentage
  totalCommissionEarned: number; // in VND
  status: 'ACTIVE' | 'PENDING_KYC' | 'SUSPENDED';
  joinedDate: string;
}

const INITIAL_AFFILIATES: AffiliateRecord[] = [
  {
    id: 'aff-001',
    name: 'David Tran',
    email: 'david.tran@headhunter.vn',
    phone: '0909 112 233',
    taxCode: '8401234567',
    rank: 'PLATINUM',
    totalSubmitted: 48,
    successfulHires: 14,
    warrantyPassRate: 93,
    totalCommissionEarned: 245000000,
    status: 'ACTIVE',
    joinedDate: '2026-01-10',
  },
  {
    id: 'aff-002',
    name: 'Sarah Le',
    email: 'sarah.le@toprecruiter.com',
    phone: '0918 334 455',
    taxCode: '8402345678',
    rank: 'GOLD',
    totalSubmitted: 32,
    successfulHires: 8,
    warrantyPassRate: 88,
    totalCommissionEarned: 135000000,
    status: 'ACTIVE',
    joinedDate: '2026-03-05',
  },
  {
    id: 'aff-003',
    name: 'Minh Vu Recruiter',
    email: 'minh.vu@hrnetwork.io',
    phone: '0988 556 677',
    taxCode: '8403456789',
    rank: 'SILVER',
    totalSubmitted: 15,
    successfulHires: 3,
    warrantyPassRate: 85,
    totalCommissionEarned: 52000000,
    status: 'ACTIVE',
    joinedDate: '2026-05-18',
  },
  {
    id: 'aff-004',
    name: 'Nguyen Van Talent',
    email: 'talent.scout@gmail.com',
    phone: '0977 889 900',
    taxCode: '8404567890',
    rank: 'SILVER',
    totalSubmitted: 2,
    successfulHires: 0,
    warrantyPassRate: 100,
    totalCommissionEarned: 0,
    status: 'PENDING_KYC',
    joinedDate: '2026-09-19',
  },
  {
    id: 'aff-005',
    name: 'Spam Affiliate Account',
    email: 'suspicious@fakecv.xyz',
    phone: '0966 000 111',
    taxCode: '8409999999',
    rank: 'SILVER',
    totalSubmitted: 25,
    successfulHires: 0,
    warrantyPassRate: 0,
    totalCommissionEarned: 0,
    status: 'SUSPENDED',
    joinedDate: '2026-07-22',
  },
];

const RANK_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  PLATINUM: { label: 'Platinum Partner', color: '#7c3aed', bg: '#f5f3ff' },
  GOLD: { label: 'Gold Recruiter', color: '#d97706', bg: '#fffbeb' },
  SILVER: { label: 'Silver Recruiter', color: '#64748b', bg: '#f8fafc' },
};

/**
 * Load affiliates from hrconnect_users (role === 'AFFILIATE') and bind applications and commissions
 */
function loadAffiliatesFromStorage(): AffiliateRecord[] {
  let affiliateUsers: any[] = [];
  try {
    const rawUsers = localStorage.getItem('hrconnect_users');
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed)) {
        affiliateUsers = parsed.filter((u: any) => u.role === 'AFFILIATE');
      }
    }
  } catch (e) {
    console.error('Failed to read hrconnect_users in AdminAffiliatesPage:', e);
  }

  let allApps: any[] = [];
  try {
    const rawApps = localStorage.getItem('hrconnect_candidate_applications');
    if (rawApps) {
      const parsed = JSON.parse(rawApps);
      allApps = Array.isArray(parsed) ? parsed : (parsed?.state?.applications || []);
    }
  } catch (e) {
    console.error('Failed to read applications in AdminAffiliatesPage:', e);
  }

  let allCommissions: any[] = [];
  try {
    const rawCom = localStorage.getItem('hrconnect_commissions');
    if (rawCom) {
      const parsed = JSON.parse(rawCom);
      if (Array.isArray(parsed)) allCommissions = parsed;
    }
  } catch (e) {
    console.error('Failed to read hrconnect_commissions in AdminAffiliatesPage:', e);
  }

  const dynamicAffiliates: AffiliateRecord[] = affiliateUsers.map((u: any, idx: number) => {
    const affName = u.fullName || u.name || 'CTV ' + (idx + 1);
    const matchingApps = allApps.filter((a: any) =>
      (a.affiliateEmail && u.email && a.affiliateEmail.toLowerCase() === u.email.toLowerCase()) ||
      (a.affiliateName && a.affiliateName.toLowerCase() === affName.toLowerCase())
    );
    const matchingComms = allCommissions.filter((c: any) =>
      (c.affiliateEmail && u.email && c.affiliateEmail.toLowerCase() === u.email.toLowerCase()) ||
      (c.affiliateName && c.affiliateName.toLowerCase() === affName.toLowerCase())
    );
    const totalCommission = matchingComms.reduce((acc: number, c: any) => acc + (c.amount || 0), 0);

    return {
      id: u.id || `aff-usr-${idx}`,
      name: affName,
      email: u.email,
      phone: u.phone || '0909 112 233',
      taxCode: u.taxCode || '840' + Math.floor(1000000 + Math.random() * 9000000),
      rank: totalCommission > 200000000 ? 'PLATINUM' : totalCommission > 100000000 ? 'GOLD' : 'SILVER',
      totalSubmitted: matchingApps.length > 0 ? matchingApps.length : (u.email?.includes('affiliate@demo.com') ? 48 : 5),
      successfulHires: matchingApps.filter((a: any) => a.status === 'ONBOARDED').length || (u.email?.includes('affiliate@demo.com') ? 14 : 1),
      warrantyPassRate: 90,
      totalCommissionEarned: totalCommission > 0 ? totalCommission : (u.email?.includes('affiliate@demo.com') ? 245000000 : 25000000),
      status: 'ACTIVE',
      joinedDate: u.createdAt ? u.createdAt.slice(0, 10) : '2026-01-10',
    };
  });

  const existingEmails = new Set(dynamicAffiliates.map((a) => a.email.toLowerCase()));
  const merged = [
    ...dynamicAffiliates,
    ...INITIAL_AFFILIATES.filter((a) => !existingEmails.has(a.email.toLowerCase())),
  ];

  return merged;
}

export const AdminAffiliatesPage: React.FC = () => {
  const [affiliates, setAffiliates] = useState<AffiliateRecord[]>(loadAffiliatesFromStorage);
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateRecord | null>(null);
  const [kycModalOpen, setKycModalOpen] = useState(false);

  const handleApproveKyc = (record: AffiliateRecord) => {
    setAffiliates((prev) =>
      prev.map((a) => (a.id === record.id ? { ...a, status: 'ACTIVE' } : a))
    );
    message.success(`Đã phê duyệt định danh đối tác CTV "${record.name}" thành công!`);
  };

  const handleSuspend = (record: AffiliateRecord) => {
    setAffiliates((prev) =>
      prev.map((a) => (a.id === record.id ? { ...a, status: 'SUSPENDED' } : a))
    );
    message.warning(`Đã tạm ngưng quyền truy cập của CTV "${record.name}".`);
  };

  const activeCount = affiliates.filter((a) => a.status === 'ACTIVE').length;
  const pendingKycCount = affiliates.filter((a) => a.status === 'PENDING_KYC').length;
  const totalHires = affiliates.reduce((acc, a) => acc + a.successfulHires, 0);
  const totalCommissionsPaid = affiliates.reduce((acc, a) => acc + a.totalCommissionEarned, 0);

  const columns: ColumnsType<AffiliateRecord> = [
    {
      title: 'CTV / Headhunter',
      key: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            style={{
              backgroundColor: '#059669',
              fontWeight: 700,
            }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'rank',
      key: 'rank',
      render: (rank: 'PLATINUM' | 'GOLD' | 'SILVER') => {
        const conf = RANK_BADGES[rank];
        return (
          <Tag
            color={conf.color}
            style={{
              borderRadius: 6,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CrownOutlined /> {conf.label}
          </Tag>
        );
      },
    },
    {
      title: 'Ứng viên đã tuyển',
      key: 'hires',
      render: (_, record) => (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>
            {record.successfulHires} thành công
          </span>
          <span style={{ color: '#64748b', fontSize: 12, marginLeft: 6 }}>
            / {record.totalSubmitted} hồ sơ
          </span>
        </div>
      ),
    },
    {
      title: 'Vượt qua bảo hành',
      dataIndex: 'warrantyPassRate',
      key: 'warrantyPassRate',
      render: (rate: number) => (
        <span
          style={{
            fontWeight: 700,
            color: rate >= 90 ? '#16a34a' : rate >= 80 ? '#0284c7' : '#dc2626',
          }}
        >
          {rate}%
        </span>
      ),
    },
    {
      title: 'Hoa hồng tích lũy',
      dataIndex: 'totalCommissionEarned',
      key: 'totalCommissionEarned',
      render: (val: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          {val.toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'ACTIVE' | 'PENDING_KYC' | 'SUSPENDED') => {
        if (status === 'ACTIVE') {
          return <Badge status="success" text={<span style={{ fontWeight: 600, color: '#16a34a' }}>Hoạt động</span>} />;
        }
        if (status === 'PENDING_KYC') {
          return <Badge status="warning" text={<span style={{ fontWeight: 600, color: '#d97706' }}>Chờ duyệt KYC</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 600, color: '#dc2626' }}>Đình chỉ</span>} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<IdcardOutlined />}
            onClick={() => {
              setSelectedAffiliate(record);
              setKycModalOpen(true);
            }}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Hồ sơ & KYC
          </Button>

          {record.status === 'PENDING_KYC' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApproveKyc(record)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                background: '#059669',
                borderColor: '#059669',
              }}
            >
              Duyệt KYC
            </Button>
          )}

          {record.status === 'ACTIVE' ? (
            <Popconfirm
              title="Đình chỉ CTV"
              description={`Bạn có chắc muốn tạm ngưng tài khoản CTV của ${record.name}?`}
              onConfirm={() => handleSuspend(record)}
              okText="Đình chỉ"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                Khóa
              </Button>
            </Popconfirm>
          ) : record.status === 'SUSPENDED' ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApproveKyc(record)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                color: '#059669',
                borderColor: '#059669',
              }}
            >
              Mở lại
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <ApartmentOutlined style={{ color: '#059669', marginRight: 10 }} />
          Quản lý Mạng lưới CTV & Headhunter
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Giám sát hiệu suất tuyển dụng, xét duyệt hồ sơ định danh đối tác (KYC) và kiểm tra chất lượng bảo hành ứng viên.
        </Text>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="CTV đang hoạt động"
              value={activeCount}
              valueStyle={{ color: '#059669', fontWeight: 800 }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Hồ sơ chờ duyệt KYC"
              value={pendingKycCount}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<Badge count={pendingKycCount} style={{ backgroundColor: '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng lượt tuyển thành công"
              value={totalHires}
              valueStyle={{ color: '#0284c7', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng hoa hồng đã chi trả"
              value={totalCommissionsPaid}
              formatter={(val) => `${Number(val).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#7c3aed', fontWeight: 800, fontSize: 18 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Affiliates Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={affiliates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* KYC / Details Modal */}
      <Modal
        open={kycModalOpen}
        onCancel={() => setKycModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setKycModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
          selectedAffiliate?.status === 'PENDING_KYC' && (
            <Button
              key="approve"
              type="primary"
              onClick={() => {
                if (selectedAffiliate) handleApproveKyc(selectedAffiliate);
                setKycModalOpen(false);
              }}
              style={{ borderRadius: 8, background: '#059669', borderColor: '#059669' }}
            >
              Phê duyệt định danh (KYC)
            </Button>
          ),
        ]}
        title={
          <Space>
            <IdcardOutlined style={{ color: '#059669' }} />
            <span>Hồ sơ định danh & Hợp đồng CTV Tuyển dụng</span>
          </Space>
        }
        width={680}
      >
        {selectedAffiliate && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Họ và tên CTV" span={2}>
                <strong>{selectedAffiliate.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế cá nhân">{selectedAffiliate.taxCode}</Descriptions.Item>
              <Descriptions.Item label="Ngày gia nhập">{selectedAffiliate.joinedDate}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedAffiliate.phone}</Descriptions.Item>
              <Descriptions.Item label="Email liên hệ">{selectedAffiliate.email}</Descriptions.Item>
              <Descriptions.Item label="Cấp bậc hoa hồng" span={2}>
                <Tag color={RANK_BADGES[selectedAffiliate.rank].color}>
                  {RANK_BADGES[selectedAffiliate.rank].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Hiệu suất bảo hành">
                {selectedAffiliate.warrantyPassRate}% vượt qua mốc 60 ngày
              </Descriptions.Item>
              <Descriptions.Item label="Tổng hoa hồng đã nhận">
                {selectedAffiliate.totalCommissionEarned.toLocaleString('vi-VN')} đ
              </Descriptions.Item>
            </Descriptions>

            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                textAlign: 'center',
              }}
            >
              <IdcardOutlined style={{ fontSize: 32, color: '#059669', marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>
                CCCD_MatTruoc_MatSau_XacThuc.pdf
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Thông tin tài khoản ngân hàng nhận Payout đã được xác thực trùng khớp với chủ tài khoản.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
