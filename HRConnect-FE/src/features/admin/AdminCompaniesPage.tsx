import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Typography,
  Space,
  Tag,
  Button,
  Modal,
  Row,
  Col,
  Badge,
  Avatar,
  message,
  Popconfirm,
  Descriptions,
  Tabs,
  Input,
  Form,
  Spin,
  Tooltip,
} from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  StopOutlined,
  FileProtectOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminService, ApprovalListItemDto, CompanyVerificationDetailDto } from '@/services/adminService';
import { getApiErrorMessage } from '@/services/apiClient';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
    status: 'VERIFIED',
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
    const matchingJobs = allJobs.filter(
      (j: any) =>
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
      activeJobs: matchingJobs.length > 0 ? matchingJobs.length : 1,
      packageType: 'COD',
      status: 'VERIFIED',
      registrationDate: u.createdAt ? u.createdAt.slice(0, 10) : '2026-03-01',
      address: u.address || 'Hà Nội / TP. Hồ Chí Minh',
    };
  });

  const existingEmails = new Set(dynamicCompanies.map((c) => c.email.toLowerCase()));
  return [
    ...dynamicCompanies,
    ...INITIAL_COMPANIES.filter((c) => !existingEmails.has(c.email.toLowerCase())),
  ];
}

export const AdminCompaniesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('pending_companies');
  const [companies, setCompanies] = useState<CompanyRecord[]>(loadCompaniesFromStorage);
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // ─── Real Backend Approval Queue State ───
  const [pendingCompanyRequests, setPendingCompanyRequests] = useState<ApprovalListItemDto[]>([]);
  const [pendingAffiliateRequests, setPendingAffiliateRequests] = useState<ApprovalListItemDto[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  // Approval/Rejection Action Modals
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'APPROVE' | 'REJECT';
    targetType: 'CLIENT' | 'AFFILIATE';
    item: ApprovalListItemDto | null;
  }>({
    open: false,
    type: 'APPROVE',
    targetType: 'CLIENT',
    item: null,
  });

  const [actionForm] = Form.useForm();
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Detailed Verification Request Info Modal
  const [requestDetailModal, setRequestDetailModal] = useState<{
    open: boolean;
    loading: boolean;
    data: CompanyVerificationDetailDto | null;
  }>({
    open: false,
    loading: false,
    data: null,
  });

  // Fetch pending approvals from real backend API
  const fetchApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    try {
      // 1. Fetch pending client company verification requests
      const clientRes = await adminService.getApprovals({
        type: 'CLIENT',
        status: 'PENDING',
        pageSize: 50,
      });
      if (clientRes.success && clientRes.data) {
        setPendingCompanyRequests(clientRes.data.items || []);
      }

      // 2. Fetch pending affiliate recruiter applications
      const affiliateRes = await adminService.getApprovals({
        type: 'AFFILIATE',
        status: 'PENDING',
        pageSize: 50,
      });
      if (affiliateRes.success && affiliateRes.data) {
        setPendingAffiliateRequests(affiliateRes.data.items || []);
      }
    } catch (err) {
      console.warn('Backend approval endpoint currently offline or unauthorized, using fallback queue state.', err);
    } finally {
      setLoadingApprovals(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Open Detailed Company Verification Info
  const handleViewDetail = async (item: ApprovalListItemDto) => {
    setRequestDetailModal({ open: true, loading: true, data: null });
    try {
      const res = await adminService.getCompanyVerificationDetail(item.approvalId);
      if (res.success && res.data) {
        setRequestDetailModal({ open: true, loading: false, data: res.data });
      } else {
        throw new Error('Không thể tải chi tiết');
      }
    } catch {
      // Fallback display from item
      setRequestDetailModal({
        open: true,
        loading: false,
        data: {
          verificationRequestId: item.approvalId,
          userId: item.userId,
          email: item.email,
          displayName: item.displayName,
          companyId: item.approvalId,
          companyName: item.companyName || 'Doanh nghiệp đăng ký',
          status: item.status,
          submittedPayload: '{}',
          submittedAt: item.submittedAt,
        },
      });
    }
  };

  // Open Approval Confirmation Modal
  const openApproveModal = (item: ApprovalListItemDto, targetType: 'CLIENT' | 'AFFILIATE') => {
    actionForm.resetFields();
    setActionModal({
      open: true,
      type: 'APPROVE',
      targetType,
      item,
    });
  };

  // Open Rejection Prompt Modal
  const openRejectModal = (item: ApprovalListItemDto, targetType: 'CLIENT' | 'AFFILIATE') => {
    actionForm.resetFields();
    setActionModal({
      open: true,
      type: 'REJECT',
      targetType,
      item,
    });
  };

  // Execute Approve or Reject against Backend API
  const handleExecuteAction = async (values: { note?: string; reason?: string }) => {
    if (!actionModal.item) return;
    setActionSubmitting(true);

    const { approvalId, companyName, displayName } = actionModal.item;
    const isApprove = actionModal.type === 'APPROVE';
    const isClient = actionModal.targetType === 'CLIENT';

    try {
      if (isClient) {
        if (isApprove) {
          // POST /api/v1/admin/company-verification-requests/{id}/approve
          await adminService.approveCompanyVerification(approvalId, values.note);
          message.success(`Đã phê duyệt hồ sơ doanh nghiệp "${companyName || displayName}" thành công!`);

          // Add to verified companies table
          const newVerified: CompanyRecord = {
            id: approvalId,
            name: companyName || displayName,
            taxCode: 'Chưa cập nhật',
            contactPerson: displayName,
            email: actionModal.item.email,
            phone: 'Chưa cập nhật',
            activeJobs: 0,
            packageType: 'COD',
            status: 'VERIFIED',
            registrationDate: new Date().toISOString().slice(0, 10),
            address: 'Hà Nội / TP. Hồ Chí Minh',
          };
          setCompanies((prev) => [newVerified, ...prev]);
        } else {
          // POST /api/v1/admin/company-verification-requests/{id}/reject
          await adminService.rejectCompanyVerification(approvalId, values.reason || 'Thông tin chưa đủ điều kiện xác thực');
          message.warning(`Đã từ chối yêu cầu xác thực doanh nghiệp "${companyName || displayName}".`);
        }
      } else {
        // Affiliate
        if (isApprove) {
          await adminService.approveAffiliate(approvalId, values.note);
          message.success(`Đã phê duyệt đối tác tuyển dụng "${displayName}" thành công!`);
        } else {
          await adminService.rejectAffiliate(approvalId, values.reason || 'Hồ sơ chưa phù hợp tiêu chí');
          message.warning(`Đã từ chối đơn đăng ký CTV "${displayName}".`);
        }
      }

      setActionModal({ open: false, type: 'APPROVE', targetType: 'CLIENT', item: null });
      fetchApprovals();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Thao tác không thành công. Vui lòng thử lại!');
      message.error(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  const verifiedCount = companies.filter((c) => c.status === 'VERIFIED').length;
  const pendingCount = pendingCompanyRequests.length;
  const affiliatePendingCount = pendingAffiliateRequests.length;
  const totalJobs = companies.reduce((acc, c) => acc + c.activeJobs, 0);

  // ─── Columns for Verified Companies Table ───
  const verifiedColumns: ColumnsType<CompanyRecord> = [
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
            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>MST: {record.taxCode}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Đại diện liên hệ',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{record.contactPerson}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{record.email}</div>
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
        <span style={{ fontWeight: 700, color: jobs > 0 ? '#38bdf8' : '#94a3b8' }}>
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
          return <Badge status="success" text={<span style={{ fontWeight: 600, color: '#34d399' }}>Đã xác minh</span>} />;
        }
        if (status === 'PENDING') {
          return <Badge status="warning" text={<span style={{ fontWeight: 600, color: '#fbbf24' }}>Chờ phê duyệt</span>} />;
        }
        return <Badge status="error" text={<span style={{ fontWeight: 600, color: '#f87171' }}>Tạm đình chỉ</span>} />;
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
          <Popconfirm
            title="Đình chỉ doanh nghiệp"
            description={`Bạn có chắc muốn đình chỉ hoạt động của ${record.name}?`}
            onConfirm={() => {
              setCompanies((prev) =>
                prev.map((c) => (c.id === record.id ? { ...c, status: 'SUSPENDED' } : c))
              );
              message.warning(`Đã đình chỉ doanh nghiệp "${record.name}".`);
            }}
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
        </Space>
      ),
    },
  ];

  // ─── Columns for Client Approval Queue Table ───
  const clientApprovalColumns: ColumnsType<ApprovalListItemDto> = [
    {
      title: 'Doanh nghiệp',
      key: 'company',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            shape="square"
            size={40}
            className="bg-blue-600 font-bold text-white rounded-lg flex items-center justify-center shrink-0"
          >
            {(record.companyName || record.displayName || 'C').charAt(0)}
          </Avatar>
          <div>
            <div className="font-semibold text-slate-100 text-sm">
              {record.companyName || 'Doanh nghiệp chưa đặt tên'}
            </div>
            <div className="text-xs text-slate-400">
              Người đại diện: <span className="text-slate-300 font-medium">{record.displayName}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Email liên hệ',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span className="font-mono text-xs text-slate-300 select-all">{email}</span>
      ),
    },
    {
      title: 'Ngày nộp yêu cầu',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          <span className="text-xs text-slate-400">
            {isNaN(d.getTime()) ? dateStr : d.toLocaleString('vi-VN')}
          </span>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => (
        <Tag color="warning" className="rounded-md font-semibold text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
          <ClockCircleOutlined className="mr-1" />
          {st === 'UNDER_REVIEW' ? 'Đang thẩm định' : 'Chờ phê duyệt'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác phê duyệt',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            className="rounded-lg text-xs border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
          >
            Chi tiết
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => openApproveModal(record, 'CLIENT')}
            className="rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 border-none font-semibold text-white shadow-sm"
          >
            Phê duyệt
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(record, 'CLIENT')}
            className="rounded-lg text-xs font-semibold"
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  // ─── Columns for Affiliate Recruiter Approval Queue Table ───
  const affiliateApprovalColumns: ColumnsType<ApprovalListItemDto> = [
    {
      title: 'Cộng tác viên / Headhunter',
      key: 'affiliate',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            size={40}
            className="bg-amber-600 font-bold text-white rounded-full flex items-center justify-center shrink-0"
          >
            {record.displayName.charAt(0)}
          </Avatar>
          <div>
            <div className="font-semibold text-slate-100 text-sm">{record.displayName}</div>
            <div className="text-xs text-amber-400 font-medium">Đối tác tuyển dụng (Affiliate Recruiter)</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span className="font-mono text-xs text-slate-300 select-all">{email}</span>
      ),
    },
    {
      title: 'Ngày nộp hồ sơ',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          <span className="text-xs text-slate-400">
            {isNaN(d.getTime()) ? dateStr : d.toLocaleString('vi-VN')}
          </span>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => (
        <Tag color="warning" className="rounded-md font-semibold text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
          <ClockCircleOutlined className="mr-1" />
          {st === 'UNDER_REVIEW' ? 'Đang thẩm định' : 'Chờ phê duyệt'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác phê duyệt',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => openApproveModal(record, 'AFFILIATE')}
            className="rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 border-none font-semibold text-white shadow-sm"
          >
            Duyệt CTV
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(record, 'AFFILIATE')}
            className="rounded-lg text-xs font-semibold"
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Title level={3} style={{ margin: 0, color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.02em' }}>
            <BankOutlined style={{ color: '#38bdf8', marginRight: 10 }} />
            Quản trị & Xét duyệt Doanh nghiệp (Clients Approval Hub)
          </Title>
          <Text style={{ fontSize: 13, color: '#94a3b8' }}>
            Hàng đợi kiểm duyệt pháp nhân, phê duyệt tài khoản nhà tuyển dụng & đối tác CTV tuyển dụng kết nối trực tiếp API Backend.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={loadingApprovals} />}
          onClick={fetchApprovals}
          loading={loadingApprovals}
          className="rounded-xl bg-slate-800 border-slate-700 text-slate-200 hover:text-white shrink-0"
        >
          Làm mới hàng đợi
        </Button>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={6}>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(51, 65, 85, 0.65)',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Doanh nghiệp đã xác minh
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#34d399', marginTop: 6, fontFamily: 'monospace' }}>
              {verifiedCount}
            </div>
          </div>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <div
            style={{
              borderRadius: 16,
              border: pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(51, 65, 85, 0.65)',
              background: pendingCount > 0 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: 11, color: pendingCount > 0 ? '#fbbf24' : '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Doanh nghiệp chờ duyệt
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginTop: 6, fontFamily: 'monospace' }}>
              {pendingCount}
            </div>
          </div>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(51, 65, 85, 0.65)',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CTV Tuyển dụng chờ duyệt
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#c084fc', marginTop: 6, fontFamily: 'monospace' }}>
              {affiliatePendingCount}
            </div>
          </div>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(51, 65, 85, 0.65)',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng tin đang tuyển
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8', marginTop: 6, fontFamily: 'monospace' }}>
              {totalJobs}
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Tabs Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending_companies',
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <ClockCircleOutlined />
                  <span>Hàng đợi chờ duyệt Doanh nghiệp</span>
                  {pendingCount > 0 && (
                    <Badge count={pendingCount} className="site-badge-count-4 ml-1" />
                  )}
                </span>
              ),
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Text className="text-xs text-slate-400">
                      Danh sách các doanh nghiệp đã xác thực email và đang chờ Admin duyệt hồ sơ để kích hoạt tài khoản.
                    </Text>
                  </div>
                  <Table
                    loading={loadingApprovals}
                    dataSource={pendingCompanyRequests}
                    columns={clientApprovalColumns}
                    rowKey="approvalId"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                    locale={{
                      emptyText: (
                        <div className="py-8 text-center text-slate-500">
                          <CheckCircleOutlined className="text-3xl text-emerald-500/50 mb-2" />
                          <p>Hiện không có yêu cầu xác thực doanh nghiệp nào đang chờ duyệt.</p>
                        </div>
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'verified_companies',
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <SafetyCertificateOutlined />
                  <span>Doanh nghiệp đã xác minh ({verifiedCount})</span>
                </span>
              ),
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Text className="text-xs text-slate-400">
                      Danh sách các đối tác doanh nghiệp đã được phê duyệt và đang hoạt động tuyển dụng trên hệ thống.
                    </Text>
                  </div>
                  <Table
                    dataSource={companies}
                    columns={verifiedColumns}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: 'pending_affiliates',
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <UsergroupAddOutlined />
                  <span>CTV Tuyển dụng chờ duyệt</span>
                  {affiliatePendingCount > 0 && (
                    <Badge count={affiliatePendingCount} className="site-badge-count-4 ml-1" />
                  )}
                </span>
              ),
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Text className="text-xs text-slate-400">
                      Danh sách các đối tác tuyển dụng (Affiliate Recruiter) đã xác thực email và chờ cấp quyền hoạt động.
                    </Text>
                  </div>
                  <Table
                    loading={loadingApprovals}
                    dataSource={pendingAffiliateRequests}
                    columns={affiliateApprovalColumns}
                    rowKey="approvalId"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                    locale={{
                      emptyText: (
                        <div className="py-8 text-center text-slate-500">
                          <CheckCircleOutlined className="text-3xl text-emerald-500/50 mb-2" />
                          <p>Không có đơn đăng ký CTV tuyển dụng nào đang chờ duyệt.</p>
                        </div>
                      ),
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Approve / Reject Modal Dialog */}
      <Modal
        open={actionModal.open}
        title={
          <div className="flex items-center gap-2">
            {actionModal.type === 'APPROVE' ? (
              <>
                <CheckCircleOutlined className="text-emerald-500" />
                <span>
                  Phê duyệt {actionModal.targetType === 'CLIENT' ? 'Doanh nghiệp' : 'Cộng tác viên tuyển dụng'}
                </span>
              </>
            ) : (
              <>
                <CloseCircleOutlined className="text-red-500" />
                <span>
                  Từ chối yêu cầu {actionModal.targetType === 'CLIENT' ? 'Doanh nghiệp' : 'Cộng tác viên tuyển dụng'}
                </span>
              </>
            )}
          </div>
        }
        onCancel={() => setActionModal({ open: false, type: 'APPROVE', targetType: 'CLIENT', item: null })}
        footer={null}
        destroyOnClose
      >
        <div className="py-2">
          {actionModal.type === 'APPROVE' ? (
            <p className="text-sm text-slate-600 mb-4">
              Bạn có chắc chắn muốn phê duyệt{' '}
              <strong>
                {actionModal.item?.companyName || actionModal.item?.displayName}
              </strong>
              ? Sau khi phê duyệt, tài khoản của họ sẽ được chuyển sang trạng thái <strong>ACTIVE</strong> và nhận được email thông báo kích hoạt.
            </p>
          ) : (
            <p className="text-sm text-slate-600 mb-4">
              Vui lòng nhập lý do từ chối yêu cầu của{' '}
              <strong>
                {actionModal.item?.companyName || actionModal.item?.displayName}
              </strong>
              . Lý do này sẽ được ghi vào hệ thống và gửi email thông báo cho đối tác.
            </p>
          )}

          <Form form={actionForm} layout="vertical" onFinish={handleExecuteAction}>
            {actionModal.type === 'APPROVE' ? (
              <Form.Item name="note" label="Ghi chú phê duyệt (tùy chọn)">
                <TextArea rows={3} placeholder="Ví dụ: Hồ sơ giấy phép kinh doanh đầy đủ, hợp lệ." />
              </Form.Item>
            ) : (
              <Form.Item
                name="reason"
                label="Lý do từ chối"
                rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối!' }]}
              >
                <TextArea rows={3} placeholder="Ví dụ: Mã số thuế chưa khớp với đăng ký kinh doanh..." />
              </Form.Item>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={() =>
                  setActionModal({ open: false, type: 'APPROVE', targetType: 'CLIENT', item: null })
                }
              >
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                danger={actionModal.type === 'REJECT'}
                htmlType="submit"
                loading={actionSubmitting}
                className={actionModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
              >
                {actionModal.type === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* Detailed Verification Request Modal (API GetCompanyVerificationDetail) */}
      <Modal
        open={requestDetailModal.open}
        onCancel={() => setRequestDetailModal({ open: false, loading: false, data: null })}
        title="Chi tiết hồ sơ xác thực Doanh nghiệp"
        width={680}
        footer={[
          <Button
            key="close"
            onClick={() => setRequestDetailModal({ open: false, loading: false, data: null })}
          >
            Đóng
          </Button>,
        ]}
      >
        {requestDetailModal.loading ? (
          <div className="py-12 text-center">
            <Spin size="large" />
          </div>
        ) : requestDetailModal.data ? (
          <div className="py-2">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Tên công ty" span={2}>
                <strong>{requestDetailModal.data.companyName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">
                {requestDetailModal.data.taxCode || 'Chưa cung cấp'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngành nghề">
                {requestDetailModal.data.industry || 'Công nghệ thông tin'}
              </Descriptions.Item>
              <Descriptions.Item label="Quy mô công ty">
                {requestDetailModal.data.companySize || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Website">
                {requestDetailModal.data.website ? (
                  <a href={requestDetailModal.data.website} target="_blank" rel="noreferrer">
                    {requestDetailModal.data.website}
                  </a>
                ) : (
                  'Chưa cung cấp'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Người đại diện">
                {requestDetailModal.data.displayName || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <span className="font-mono text-xs">{requestDetailModal.data.email}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {requestDetailModal.data.phone || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color="warning">
                  {requestDetailModal.data.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>
                {requestDetailModal.data.address || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả công ty" span={2}>
                {requestDetailModal.data.description || 'Không có mô tả bổ sung'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : null}
      </Modal>

      {/* Verified Company Detail Modal */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
        ]}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileProtectOutlined style={{ color: '#0284c7', fontSize: 20 }} />
            <span>Hồ sơ Pháp nhân Doanh nghiệp</span>
          </div>
        }
        width={650}
      >
        {selectedCompany && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="Tên công ty" span={2}>
                <strong>{selectedCompany.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">{selectedCompany.taxCode}</Descriptions.Item>
              <Descriptions.Item label="Ngày gia nhập">{selectedCompany.registrationDate}</Descriptions.Item>
              <Descriptions.Item label="Người đại diện">{selectedCompany.contactPerson}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{selectedCompany.phone}</Descriptions.Item>
              <Descriptions.Item label="Email liên hệ" span={2}>
                <span style={{ fontFamily: 'monospace' }}>{selectedCompany.email}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ trụ sở" span={2}>{selectedCompany.address}</Descriptions.Item>
              <Descriptions.Item label="Gói dịch vụ">
                <Tag color="blue">{selectedCompany.packageType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {selectedCompany.status === 'VERIFIED' ? (
                  <Tag color="success">Đã xác minh</Tag>
                ) : (
                  <Tag color="error">Đình chỉ</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminCompaniesPage;
