/**
 * @file AffiliateCommissionsPage.tsx
 * @path src/pages/affiliate/AffiliateCommissionsPage.tsx
 * @description Enterprise Financial Ledger & Commission Payout Console for Headhunter (David Tran - aff-001).
 * 
 * Spec Compliance:
 * 1. Fixed Layout Breakage:
 *    4 evenly distributed KPI cards using Antd <Row gutter={[16, 16]}> with zero text overlap:
 *    - Tổng hoa hồng tích lũy (VND)
 *    - Đang chờ duyệt (Trong 60 ngày bảo hành)
 *    - Đủ điều kiện nhận (Đã hoàn tất thử việc)
 *    - Đã thanh toán (Kèm số lệnh UNC)
 * 2. Table Column Standards:
 *    - Min-widths specified per column to prevent cell clipping.
 *    - Columns: [Ứng viên & Job] | [Số tiền hoa hồng & %] | [Tiến độ bảo hành 60 ngày] | [Trạng thái] | [Hành động].
 *    - Action: Button [Xem chứng từ UNC] for PAID records to open Payment Evidence modal with bank receipt.
 */

import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Progress, Button, Card, Row, Col, Typography,
  Avatar, Modal, Input, Select, Tooltip, message, Popconfirm, Divider,
} from 'antd';
import {
  DollarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileDoneOutlined, BankOutlined, DownloadOutlined,
  SearchOutlined,
  AuditOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/authStore';
import type { AffiliateCommissionDTO, CommissionPayoutStatus } from '@/types/affiliate';

const { Title, Text } = Typography;

// ─── Format Currency to VNĐ: 25000000 -> 25.000.000 đ ─────────────────────────
export const formatCurrencyVND = (amount: number): string => {
  return `${amount.toLocaleString('vi-VN')} đ`;
};

// ─── Mock Commissions Data for David Tran (aff-001) ───────────────────────────
const INITIAL_COMMISSIONS: AffiliateCommissionDTO[] = [
  {
    id: 'COM-AFF-001',
    candidateName: 'Nguyễn Văn Hoàng',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    companyName: 'TechCorp Việt Nam',
    commissionRate: 15,
    amount: 25000000,
    probationDaysPassed: 35,
    totalDays: 60,
    status: 'PENDING',
    hiredDate: '2026-02-15',
    warrantyEndDate: '2026-04-16',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    id: 'COM-AFF-002',
    candidateName: 'Lê Hoàng Long',
    jobTitle: 'Senior Java Backend Engineer (Microservices)',
    companyName: 'TechCorp Việt Nam',
    commissionRate: 15,
    amount: 30000000,
    probationDaysPassed: 60,
    totalDays: 60,
    status: 'ELIGIBLE',
    hiredDate: '2026-01-10',
    warrantyEndDate: '2026-03-11',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'COM-AFF-003',
    candidateName: 'Trần Thị Mai',
    jobTitle: 'Product Manager (Fintech Platform)',
    companyName: 'Fintech Hub Global',
    commissionRate: 18,
    amount: 38000000,
    probationDaysPassed: 60,
    totalDays: 60,
    status: 'APPROVED',
    hiredDate: '2025-12-20',
    warrantyEndDate: '2026-02-18',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  {
    id: 'COM-AFF-004',
    candidateName: 'Đặng Ngọc Lan',
    jobTitle: 'Frontend Tech Lead (React & TypeScript)',
    companyName: 'TechCorp Việt Nam',
    commissionRate: 15,
    amount: 25000000,
    probationDaysPassed: 60,
    totalDays: 60,
    status: 'PAID',
    uncNumber: 'UNC-VCB-20260312-8821',
    uncUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80',
    paidAt: '2026-03-12T15:30:24.000Z',
    bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    accountNumber: '0071001234567',
    beneficiaryName: 'TRAN VAN DAVID',
    hiredDate: '2026-01-05',
    warrantyEndDate: '2026-03-06',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
  },
];

export const AffiliateCommissionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isDemoAffiliate = user?.id === 'aff-001' || user?.email?.includes('david.tran');
  const [commissions, setCommissions] = useState<AffiliateCommissionDTO[]>(isDemoAffiliate ? INITIAL_COMMISSIONS : []);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // UNC Receipt Modal State
  const [selectedUnc, setSelectedUnc] = useState<AffiliateCommissionDTO | null>(null);
  const [isUncModalOpen, setIsUncModalOpen] = useState<boolean>(false);

  // Filtered dataset
  const filteredCommissions = useMemo(() => {
    return commissions.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [commissions, searchTerm, statusFilter]);

  // Aggregated KPI Metrics
  const metrics = useMemo(() => {
    const totalAccumulated = commissions.reduce((sum, item) => sum + item.amount, 0);
    const inProbationPending = commissions
      .filter((item) => item.status === 'PENDING')
      .reduce((sum, item) => sum + item.amount, 0);
    const eligibleAmount = commissions
      .filter((item) => item.status === 'ELIGIBLE' || item.status === 'APPROVED' || item.status === 'PAYABLE')
      .reduce((sum, item) => sum + item.amount, 0);
    const paidCommissions = commissions.filter((item) => item.status === 'PAID');
    const paidAmount = paidCommissions.reduce((sum, item) => sum + item.amount, 0);

    return {
      totalAccumulated,
      inProbationPending,
      eligibleAmount,
      paidAmount,
      paidUncCount: paidCommissions.length,
    };
  }, [commissions]);

  // Open UNC Modal
  const handleOpenUnc = (record: AffiliateCommissionDTO) => {
    setSelectedUnc(record);
    setIsUncModalOpen(true);
  };

  // Request Payout Action
  const handleRequestPayout = (recordId: string) => {
    setCommissions((prev) =>
      prev.map((item) => {
        if (item.id === recordId) {
          message.success('Đã gửi yêu cầu rút hoa hồng thành công! Kế toán sẽ phê duyệt lệnh chi trong 24h.');
          return { ...item, status: 'APPROVED' };
        }
        return item;
      })
    );
  };

  // Status tag mapper
  const renderStatusTag = (status: CommissionPayoutStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Đang chờ duyệt (60 ngày BH)
          </Tag>
        );
      case 'ELIGIBLE':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Đủ điều kiện nhận (PASS)
          </Tag>
        );
      case 'APPROVED':
      case 'PAYABLE':
        return (
          <Tag color="cyan" icon={<FileDoneOutlined />}>
            Đã duyệt lệnh chi (Payable)
          </Tag>
        );
      case 'PAID':
        return (
          <Tag color="blue" icon={<CheckCircleFilled />}>
            Đã thanh toán (PAID)
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // Table Columns Definition (Strict minWidth to avoid text clipping)
  const columns: ColumnsType<AffiliateCommissionDTO> = [
    {
      title: 'Ứng viên & Vị trí tuyển dụng',
      key: 'candidateJob',
      minWidth: 260,
      render: (_: any, record: AffiliateCommissionDTO) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={42} style={{ border: '2px solid #e2e8f0' }}>
            {record.candidateName.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{record.candidateName}</div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{record.jobTitle}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {record.companyName} • Onboarding: <strong>{dayjs(record.hiredDate).format('DD/MM/YYYY')}</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Số tiền hoa hồng & %',
      key: 'commission',
      minWidth: 200,
      sorter: (a, b) => a.amount - b.amount,
      render: (_: any, record: AffiliateCommissionDTO) => (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
            {formatCurrencyVND(record.amount)}
          </div>
          <Tag color="purple" style={{ marginTop: 4, fontSize: 11 }}>
            {record.commissionRate}% Hoa hồng COD
          </Tag>
        </div>
      ),
    },
    {
      title: 'Tiến độ bảo hành 60 ngày',
      key: 'probationProgress',
      minWidth: 260,
      render: (_: any, record: AffiliateCommissionDTO) => {
        const percent = Math.min(100, Math.round((record.probationDaysPassed / record.totalDays) * 100));
        const isPassed = record.probationDaysPassed >= record.totalDays;

        return (
          <div style={{ width: '100%', maxWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: isPassed ? '#16a34a' : '#0284c7' }}>
                {isPassed ? 'Hoàn tất thử việc (60/60)' : `Đã thử việc ${record.probationDaysPassed}/${record.totalDays} ngày`}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                Hạn BH: {dayjs(record.warrantyEndDate).format('DD/MM')}
              </span>
            </div>
            <Progress
              percent={percent}
              size="small"
              strokeColor={isPassed ? '#16a34a' : '#2563eb'}
              status={isPassed ? 'success' : 'active'}
              format={() => `${percent}%`}
            />
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      minWidth: 180,
      render: (_: any, record: AffiliateCommissionDTO) => renderStatusTag(record.status),
    },
    {
      title: 'Hành động',
      key: 'actions',
      minWidth: 170,
      render: (_: any, record: AffiliateCommissionDTO) => {
        if (record.status === 'PAID') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<AuditOutlined />}
              style={{ background: '#0284c7', borderColor: '#0284c7' }}
              onClick={() => handleOpenUnc(record)}
            >
              Xem chứng từ UNC
            </Button>
          );
        }

        if (record.status === 'ELIGIBLE') {
          return (
            <Popconfirm
              title="Gửi yêu cầu rút hoa hồng?"
              description={`Rút ${formatCurrencyVND(record.amount)} về tài khoản ngân hàng của bạn?`}
              onConfirm={() => handleRequestPayout(record.id)}
              okText="Rút tiền ngay"
              cancelText="Hủy"
            >
              <Button type="primary" size="small" style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                Yêu cầu rút tiền
              </Button>
            </Popconfirm>
          );
        }

        if (record.status === 'APPROVED') {
          return <Tag color="blue">Kế toán đang giải ngân</Tag>;
        }

        return (
          <Tooltip title="Hoa hồng sẽ mở khóa rút khi ứng viên hoàn thành 60 ngày thử việc">
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Đang bảo hành</span>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Sổ cái Hoa hồng & Quản lý Payout
        </Title>
        <Text style={{ color: '#64748b' }}>
          Headhunter: <strong style={{ color: '#0f172a' }}>{user?.name || 'Chuyên viên Tuyển dụng'}</strong> ({user?.company || 'Cộng tác viên Độc lập'}) • Giám sát dòng tiền hoa hồng theo các mốc 60 ngày bảo hành
        </Text>
      </div>

      {/* ─── 4 EVENLY DISTRIBUTED KPI CARDS (FIXED OVERLAPPING BUG) ─────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Card 1: Tổng hoa hồng tích lũy */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  1. Tổng hoa hồng tích lũy
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 6, whiteSpace: 'nowrap' }}>
                  {formatCurrencyVND(metrics.totalAccumulated)}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  fontSize: 18,
                }}
              >
                <DollarOutlined />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              Toàn bộ các deal thành công
            </div>
          </Card>
        </Col>

        {/* Card 2: Đang chờ duyệt (Trong 60 ngày BH) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 8,
              border: '1px solid #fed7aa',
              background: '#fffaf5',
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, color: '#9a3412' }}>
                  2. Đang chờ duyệt (60 ngày BH)
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#c2410c', marginTop: 6, whiteSpace: 'nowrap' }}>
                  {formatCurrencyVND(metrics.inProbationPending)}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                  fontSize: 18,
                }}
              >
                <ClockCircleOutlined />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#9a3412', marginTop: 8 }}>
              Ứng viên đang trong thời gian thử việc
            </div>
          </Card>
        </Col>

        {/* Card 3: Đủ điều kiện nhận (Đã hoàn tất thử việc) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              background: '#f7fee7',
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>
                  3. Đủ điều kiện nhận (PASS)
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#15803d', marginTop: 6, whiteSpace: 'nowrap' }}>
                  {formatCurrencyVND(metrics.eligibleAmount)}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                  fontSize: 18,
                }}
              >
                <CheckCircleOutlined />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 8 }}>
              Đã xong 60 ngày, sẵn sàng rút tiền
            </div>
          </Card>
        </Col>

        {/* Card 4: Đã thanh toán (Kèm số lệnh UNC) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 8,
              border: '1px solid #bae6fd',
              background: '#f0f9ff',
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, color: '#0369a1' }}>
                  4. Đã thanh toán (PAID)
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7', marginTop: 6, whiteSpace: 'nowrap' }}>
                  {formatCurrencyVND(metrics.paidAmount)}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  fontSize: 18,
                }}
              >
                <BankOutlined />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#0369a1', marginTop: 8 }}>
              Kèm <strong>{metrics.paidUncCount}</strong> lệnh UNC chuyển khoản
            </div>
          </Card>
        </Col>
      </Row>

      {/* ─── FILTER CONTROLS ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm theo tên ứng viên, vị trí tuyển dụng, công ty..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 260 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái hoa hồng' },
                { value: 'PENDING', label: 'Đang chờ duyệt (Trong 60 ngày BH)' },
                { value: 'ELIGIBLE', label: 'Đủ điều kiện nhận (PASS)' },
                { value: 'APPROVED', label: 'Đã duyệt lệnh chi' },
                { value: 'PAID', label: 'Đã thanh toán (Có UNC)' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* ─── COMMISSIONS TABLE ────────────────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<AffiliateCommissionDTO>
          columns={columns}
          dataSource={filteredCommissions}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} khoản hoa hồng` }}
          scroll={{ x: 1080 }}
          locale={{ emptyText: 'Chưa có khoản hoa hồng nào phù hợp.' }}
        />
      </Card>

      {/* ─── MODAL: XEM CHỨNG TỪ ỦY NHIỆM CHI (UNC) ─────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0284c7' }}>
            <AuditOutlined />
            <span>Chứng từ Ủy nhiệm chi Ngân hàng (Payment Evidence)</span>
          </div>
        }
        open={isUncModalOpen}
        onCancel={() => setIsUncModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsUncModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
            onClick={() => message.success(`Đang tải file UNC điện tử: ${selectedUnc?.uncNumber}.pdf`)}
          >
            Tải File UNC PDF
          </Button>,
        ]}
        width={620}
        destroyOnClose
      >
        {selectedUnc && (
          <div style={{ padding: '8px 0' }}>
            {/* Header Stamp */}
            <div
              style={{
                padding: '16px',
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: 15 }}>
                  <CheckCircleFilled style={{ fontSize: 18, color: '#16a34a' }} />
                  GIAO DỊCH CHUYỂN TIỀN THÀNH CÔNG
                </div>
                <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
                  Mã lệnh UNC: <strong style={{ color: '#0f172a' }}>{selectedUnc.uncNumber}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Số tiền thực chuyển</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>
                  {formatCurrencyVND(selectedUnc.amount)}
                </div>
              </div>
            </div>

            {/* Bank Transfer Details Table */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 8,
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: 16,
              }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Ngân hàng thụ hưởng:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedUnc.bankName || 'Vietcombank'}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Số tài khoản nhận:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                    {selectedUnc.accountNumber || '0071001234567'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Người thụ hưởng:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {selectedUnc.beneficiaryName || 'TRAN VAN DAVID'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Thời gian thực hiện:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {dayjs(selectedUnc.paidAt).format('DD/MM/YYYY HH:mm:ss')}
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '14px 0' }} />

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Nội dung chuyển khoản đối soát:</Text>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#1e293b', marginTop: 2 }}>
                  HRCONNECT THANH TOAN HOA HONG DEAL {selectedUnc.candidateName.toUpperCase()} - {selectedUnc.uncNumber}
                </div>
              </div>
            </div>

            {/* Electronic Receipt Watermark Preview */}
            <div
              style={{
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: '12px',
                textAlign: 'center',
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                Chứng từ số được phát hành và bảo đảm bởi HR Connect Finance Engine
              </div>
              <img
                src={selectedUnc.uncUrl}
                alt="UNC Evidence Receipt"
                style={{
                  maxHeight: 180,
                  maxWidth: '100%',
                  borderRadius: 6,
                  objectFit: 'cover',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AffiliateCommissionsPage;
