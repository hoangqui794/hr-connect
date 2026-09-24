import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, Avatar, message, Popconfirm, Descriptions, Statistic,
} from 'antd';
import {
  BankOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, StopOutlined, FileProtectOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface CompanyRecord {
  id: string;
  name: string;
  taxCode: string;
  contactPerson: string;
  email: string;
  phone: string;
  activeJobs: number;
  packageType: 'COD' | 'CV_SOURCING' | 'CV_APPLICATION';
  status: 'VERIFIED' | 'PENDING' | 'SUSPENDED';
  registrationDate: string;
  address: string;
}

const INITIAL_COMPANIES: CompanyRecord[] = [
  {
    id: 'comp-001',
    name: 'Blata33 Technology JSC',
    taxCode: '0316789123',
    contactPerson: 'Nguyen Thi HR',
    email: 'client@hrconnect.vn',
    phone: '0901 234 567',
    activeJobs: 4,
    packageType: 'COD',
    status: 'VERIFIED',
    registrationDate: '2026-02-14',
    address: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
  },
  {
    id: 'comp-002',
    name: 'VNG Corporation',
    taxCode: '0304123456',
    contactPerson: 'Phan Quoc Bao',
    email: 'bao.phan@vng.com.vn',
    phone: '0988 776 655',
    activeJobs: 8,
    packageType: 'COD',
    status: 'VERIFIED',
    registrationDate: '2026-03-01',
    address: 'Z06 Đường số 13, KCX Tân Thuận, P. Tân Thuận Đông, Q.7, TP. HCM',
  },
  {
    id: 'comp-003',
    name: 'Techcombank Digital Lab',
    taxCode: '0100234567',
    contactPerson: 'Tran Minh Tuan',
    email: 'tuan.tm@techcombank.com.vn',
    phone: '0912 345 678',
    activeJobs: 5,
    packageType: 'CV_SOURCING',
    status: 'VERIFIED',
    registrationDate: '2026-04-10',
    address: '6 Quang Trung, Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
  },
  {
    id: 'comp-004',
    name: 'NexGen AI Solutions Ltd',
    taxCode: '0318999888',
    contactPerson: 'Le Hoang Nam',
    email: 'recruiting@nexgen-ai.io',
    phone: '0933 221 100',
    activeJobs: 2,
    packageType: 'CV_APPLICATION',
    status: 'PENDING',
    registrationDate: '2026-09-20',
    address: 'Lầu 5, Pearl Plaza, 561A Điện Biên Phủ, P.25, Bình Thạnh, TP. HCM',
  },
  {
    id: 'comp-005',
    name: 'Global Fintech Ventures',
    taxCode: '0317555444',
    contactPerson: 'Pham Dang Khoa',
    email: 'contact@globalfintech.vn',
    phone: '0944 556 677',
    activeJobs: 0,
    packageType: 'COD',
    status: 'SUSPENDED',
    registrationDate: '2026-06-15',
    address: 'Keangnam Hanoi Landmark Tower, Nam Từ Liêm, Hà Nội',
  },
];

/**
 * Load company list by reading hrconnect_users (role === 'CLIENT') and binding active jobs from hrconnect_all_jobs
 */
function loadCompaniesFromStorage(): CompanyRecord[] {
  let clientUsers: any[] = [];
  try {
    const rawUsers = localStorage.getItem('hrconnect_users');
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed)) {
        clientUsers = parsed.filter((u: any) => u.role === 'CLIENT');
      }
    }
  } catch (e) {
    console.error('Failed to read hrconnect_users in AdminCompaniesPage:', e);
  }

  let allJobs: any[] = [];
  try {
    const rawJobs = localStorage.getItem('hrconnect_all_jobs');
    if (rawJobs) {
      const parsed = JSON.parse(rawJobs);
      if (Array.isArray(parsed)) {
        allJobs = parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read hrconnect_all_jobs in AdminCompaniesPage:', e);
  }

  const dynamicCompanies: CompanyRecord[] = clientUsers.map((u: any, idx: number) => {
    const userCompany = u.companyName || u.name || 'Doanh nghiệp ' + (idx + 1);
    // Count jobs matching this client
    const matchingJobs = allJobs.filter((j: any) =>
      (j.clientEmail && u.email && j.clientEmail.toLowerCase() === u.email.toLowerCase()) ||
      (j.clientId && j.clientId === u.id) ||
      (j.company && j.company.trim().toLowerCase() === userCompany.trim().toLowerCase())
    );

    return {
      id: u.id || `comp-usr-${idx}`,
      name: userCompany,
      taxCode: u.taxCode || '031' + Math.floor(1000000 + Math.random() * 9000000),
      contactPerson: u.fullName || u.name || 'Người đại diện',
      email: u.email,
      phone: u.phone || '0901 234 567',
      activeJobs: matchingJobs.length > 0 ? matchingJobs.length : (u.email?.includes('client@demo.com') ? 4 : 1),
      packageType: 'COD',
      status: 'VERIFIED',
      registrationDate: u.createdAt ? u.createdAt.slice(0, 10) : '2026-03-01',
      address: u.address || 'Hà Nội / TP. Hồ Chí Minh',
    };
  });

  const existingEmails = new Set(dynamicCompanies.map((c) => c.email.toLowerCase()));
  const merged = [
    ...dynamicCompanies,
    ...INITIAL_COMPANIES.filter((c) => !existingEmails.has(c.email.toLowerCase())),
  ];

  return merged;
}

export const AdminCompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyRecord[]>(loadCompaniesFromStorage);
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleApprove = (company: CompanyRecord) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, status: 'VERIFIED' } : c))
    );
    message.success(`Đã phê duyệt hồ sơ doanh nghiệp "${company.name}" thành công!`);
  };

  const handleReject = (company: CompanyRecord) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, status: 'SUSPENDED' } : c))
    );
    message.warning(`Đã từ chối / đình chỉ doanh nghiệp "${company.name}".`);
  };

  const verifiedCount = companies.filter((c) => c.status === 'VERIFIED').length;
  const pendingCount = companies.filter((c) => c.status === 'PENDING').length;
  const totalJobs = companies.reduce((acc, c) => acc + c.activeJobs, 0);

  const columns: ColumnsType<CompanyRecord> = [
    {
      title: 'Doanh nghiệp',
      key: 'company',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            shape="square"
            size={40}
            style={{
              backgroundColor: '#0284c7',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>MST: {record.taxCode}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Đại diện liên hệ',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1e293b' }}>{record.contactPerson}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      dataIndex: 'packageType',
      key: 'packageType',
      render: (pkg: string) => {
        const map: Record<string, { label: string; color: string }> = {
          COD: { label: 'Tuyển COD (Phí sau)', color: 'blue' },
          CV_SOURCING: { label: 'CV Sourcing', color: 'purple' },
          CV_APPLICATION: { label: 'Đăng tin ứng tuyển', color: 'cyan' },
        };
        const conf = map[pkg] || { label: pkg, color: 'default' };
        return <Tag color={conf.color} style={{ borderRadius: 6 }}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Tin đang mở',
      dataIndex: 'activeJobs',
      key: 'activeJobs',
      render: (jobs: number) => (
        <span style={{ fontWeight: 700, color: jobs > 0 ? '#0284c7' : '#94a3b8' }}>
          {jobs} tin tuyển dụng
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'VERIFIED' | 'PENDING' | 'SUSPENDED') => {
        if (status === 'VERIFIED') {
          return <Badge status="success" text={<span style={{ fontWeight: 600, color: '#16a34a' }}>Đã xác minh</span>} />;
        }
        if (status === 'PENDING') {
          return <Badge status="warning" text={<span style={{ fontWeight: 600, color: '#d97706' }}>Chờ phê duyệt</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 600, color: '#dc2626' }}>Tạm đình chỉ</span>} />;
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
              setSelectedCompany(record);
              setDetailModalOpen(true);
            }}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Chi tiết
          </Button>

          {record.status === 'PENDING' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                background: '#16a34a',
                borderColor: '#16a34a',
              }}
            >
              Duyệt
            </Button>
          )}

          {record.status === 'VERIFIED' ? (
            <Popconfirm
              title="Đình chỉ doanh nghiệp"
              description={`Bạn có chắc muốn đình chỉ hoạt động của ${record.name}?`}
              onConfirm={() => handleReject(record)}
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
                Đình chỉ
              </Button>
            </Popconfirm>
          ) : record.status === 'SUSPENDED' ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              style={{
                borderRadius: 6,
                fontSize: 12,
                color: '#16a34a',
                borderColor: '#16a34a',
              }}
            >
              Kích hoạt lại
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
          <BankOutlined style={{ color: '#0284c7', marginRight: 10 }} />
          Quản lý Doanh nghiệp Tuyển dụng (Clients)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Xét duyệt hồ sơ pháp nhân, giấy phép kinh doanh, giám sát hạn mức đăng tin và thanh toán của các đối tác doanh nghiệp.
        </Text>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Doanh nghiệp đã xác minh"
              value={verifiedCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Hồ sơ chờ phê duyệt"
              value={pendingCount}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<Badge count={pendingCount} style={{ backgroundColor: '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng tin đang tuyển dụng"
              value={totalJobs}
              valueStyle={{ color: '#0284c7', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tỷ lệ kích hoạt COD"
              value={80}
              suffix="%"
              valueStyle={{ color: '#7c3aed', fontWeight: 800 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Companies Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={companies}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Detail & License Modal */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
          selectedCompany?.status === 'PENDING' && (
            <Button
              key="approve"
              type="primary"
              onClick={() => {
                if (selectedCompany) handleApprove(selectedCompany);
                setDetailModalOpen(false);
              }}
              style={{ borderRadius: 8, background: '#16a34a', borderColor: '#16a34a' }}
            >
              Phê duyệt hồ sơ
            </Button>
          ),
        ]}
        title={
          <Space>
            <FileProtectOutlined style={{ color: '#0284c7' }} />
            <span>Hồ sơ thẩm định pháp nhân doanh nghiệp</span>
          </Space>
        }
        width={680}
      >
        {selectedCompany && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Tên doanh nghiệp" span={2}>
                <strong>{selectedCompany.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">{selectedCompany.taxCode}</Descriptions.Item>
              <Descriptions.Item label="Ngày đăng ký">{selectedCompany.registrationDate}</Descriptions.Item>
              <Descriptions.Item label="Người đại diện">{selectedCompany.contactPerson}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedCompany.phone}</Descriptions.Item>
              <Descriptions.Item label="Email công ty" span={2}>{selectedCompany.email}</Descriptions.Item>
              <Descriptions.Item label="Trụ sở chính" span={2}>{selectedCompany.address}</Descriptions.Item>
              <Descriptions.Item label="Gói dịch vụ tuyển dụng" span={2}>
                <Tag color="blue">{selectedCompany.packageType}</Tag> (Hạn mức: Bảo hành 60 ngày)
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
              <FileProtectOutlined style={{ fontSize: 32, color: '#0284c7', marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>
                Giấy chứng nhận Đăng ký Kinh doanh (GPĐKKD_2026.pdf)
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Đã được đối chiếu với Cơ sở dữ liệu Quốc gia về Đăng ký Doanh nghiệp.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
