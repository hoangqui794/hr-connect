import React, { useState, useMemo } from 'react';
import {
  Card, Table, Progress, Button, Modal, Form, Input, DatePicker,
  Typography, Space, Row, Col, Tooltip, Tag, message, Upload,
  Tabs, Badge, Avatar, Divider, Segmented, Alert,
} from 'antd';
import {
  DollarOutlined, ClockCircleOutlined, BankOutlined,
  ArrowUpOutlined, CheckCircleOutlined, InfoCircleOutlined,
  CheckCircleFilled, DownloadOutlined,
  SafetyCertificateOutlined, UserOutlined, ApartmentOutlined,
  ReloadOutlined, SearchOutlined, InboxOutlined, FilePdfOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useCommissions, useLedgerSummary, useRecordOfflinePayout } from '@/services/queries/useFinancials';
import { useCurrentUser } from '@/stores/useAuthStore';
import { PayoutStatus } from '@/types/affiliate';
import type { Commission } from '@/types/affiliate';
import { UserRole } from '@/types/roles';

const { Title, Text, Paragraph } = Typography;

// Sample mock electronic receipt for quick preview
const DEFAULT_RECEIPT_PREVIEW =
  'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80';

export const FinancialLedger: React.FC = () => {
  const { user } = useCurrentUser();
  const { data: commissions, isLoading, refetch } = useCommissions(user?.id);
  const { data: summary } = useLedgerSummary(user?.id);
  const { mutateAsync: recordOfflinePayout, isPending: recordingPayout } = useRecordOfflinePayout();

  // Role perspective mode: allows toggling between Affiliate view and Admin Ops view
  const [viewPerspective, setViewPerspective] = useState<'AFFILIATE' | 'ADMIN'>(
    user?.role === UserRole.ADMIN ? 'ADMIN' : 'AFFILIATE'
  );

  // Modals state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [targetPayableCommission, setTargetPayableCommission] = useState<Commission | null>(null);

  // Search & Status filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PayoutStatus>('ALL');

  // Admin record payout form
  const [adminForm] = Form.useForm();
  const [uploadedReceiptList, setUploadedReceiptList] = useState<UploadFile[]>([]);
  const [sampleReceiptUrl, setSampleReceiptUrl] = useState(DEFAULT_RECEIPT_PREVIEW);

  // Filtered commissions
  const filteredCommissions = useMemo(() => {
    if (!commissions) return [];
    return commissions.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchSearch =
        !searchQuery.trim() ||
        item.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [commissions, statusFilter, searchQuery]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // Open Evidence Modal (Affiliate / Admin)
  const handleOpenEvidenceModal = (commission: Commission) => {
    setSelectedCommission(commission);
    setEvidenceModalOpen(true);
  };

  // Open Admin Record Payout Modal
  const handleOpenAdminRecordModal = (commission: Commission) => {
    setTargetPayableCommission(commission);
    setAdminModalOpen(true);
    setSampleReceiptUrl(DEFAULT_RECEIPT_PREVIEW);
    setUploadedReceiptList([
      {
        uid: '-1',
        name: `UNC_VCB_${commission.commissionAmount}USD_${commission.candidateName.replace(/\s+/g, '')}.pdf`,
        status: 'done',
        url: DEFAULT_RECEIPT_PREVIEW,
      },
    ]);

    adminForm.setFieldsValue({
      paidAmount: commission.commissionAmount,
      bankReferenceCode: `VCB-FT${Date.now().toString().slice(-9)}`,
      transferDate: dayjs(),
      adminNotes: `Đã thực hiện lệnh chuyển tiền ngoài qua Vietcombank. Hoa hồng tuyển dụng ứng viên ${commission.candidateName} (${commission.jobTitle}).`,
    });
  };

  // Submit Admin Record Payout
  const handleAdminRecordSubmit = async () => {
    try {
      const values = await adminForm.validateFields();
      if (!targetPayableCommission) return;

      const transferDateStr = values.transferDate
        ? (values.transferDate as dayjs.Dayjs).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');

      const fileName =
        uploadedReceiptList.length > 0 && uploadedReceiptList[0].name
          ? uploadedReceiptList[0].name
          : `UNC_ChuyenKhoan_${targetPayableCommission.commissionAmount}USD.pdf`;

      await recordOfflinePayout({
        commissionId: targetPayableCommission.id,
        paidAmount: Number(values.paidAmount),
        bankReferenceCode: values.bankReferenceCode as string,
        transferDate: transferDateStr,
        receiptImageUrl: sampleReceiptUrl,
        receiptFileName: fileName,
        receiptFileSize: '485 KB',
        adminNotes: values.adminNotes as string | undefined,
        recordedBy: `${user?.name || 'Alex Nguyen'} (${user?.role || 'Admin'})`,
      });

      setAdminModalOpen(false);
      adminForm.resetFields();
      void message.success({
        content: (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Xác nhận chuyển tiền ngoài thành công!
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              Mã tham chiếu: <strong>{values.bankReferenceCode as string}</strong> · Đã lưu hồ sơ kiểm toán bất biến.
            </div>
          </div>
        ),
        duration: 5,
        icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
      });
    } catch {
      // Form validation failure
    }
  };

  const handleExportCSV = () => {
    if (!commissions || commissions.length === 0) {
      void message.warning('Không có dữ liệu hoa hồng để xuất!');
      return;
    }

    const headers = [
      'Mã Hợp đồng',
      'Ứng viên',
      'Vị trí',
      'Công ty',
      'Lương ($)',
      'Tỷ lệ (%)',
      'Hoa hồng ($)',
      'Trạng thái',
      'Tiến độ 60 ngày',
      'Mã GD Ngân hàng (Ref ID)',
      'Ngày chuyển tiền ngoài',
    ];
    const rows = commissions.map((c) => [
      c.id,
      `"${c.candidateName}"`,
      `"${c.jobTitle}"`,
      `"${c.companyName}"`,
      c.baseSalary,
      c.commissionRate,
      c.commissionAmount,
      c.status,
      c.warrantyExpired ? 'Đã hoàn tất 60/60 ngày' : `Còn ${c.probationDaysRemaining}/60 ngày`,
      c.payoutEvidence?.bankReferenceCode ? `"${c.payoutEvidence.bankReferenceCode}"` : 'N/A',
      c.payoutEvidence?.transferDate ? `"${c.payoutEvidence.transferDate}"` : 'N/A',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `HR_Connect_So_Cai_Hoa_Hong_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    void message.success('Xuất file sao kê đối soát CSV thành công!');
  };

  // ─── Table Columns ────────────────────────────────────────────────────────
  const columns: ColumnsType<Commission> = [
    {
      title: 'Ứng viên & Vị trí tuyển dụng',
      key: 'candidateInfo',
      width: 250,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
            size={40}
          >
            {record.candidateName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(-2)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', lineHeight: 1.3 }}>
              {record.candidateName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <BriefcaseIcon />
              <span>{record.jobTitle}</span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 1,
              }}
            >
              <ApartmentOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
              <span>{record.companyName}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Số tiền Hoa hồng',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      width: 170,
      sorter: (a, b) => a.commissionAmount - b.commissionAmount,
      render: (amount: number, record) => (
        <Tooltip
          title={`Lương: ${record.baseSalary.toLocaleString()} ${record.currency} × Tỷ lệ: ${record.commissionRate}% = ${amount.toLocaleString()} ${record.currency}`}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: record.status === PayoutStatus.PAYABLE ? '#10b981' : '#0284c7',
                letterSpacing: '-0.02em',
              }}
            >
              {amount.toLocaleString()} {record.currency}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Tỷ lệ: <strong>{record.commissionRate}%</strong> (Lương {record.baseSalary.toLocaleString()} {record.currency})
            </div>
          </div>
        </Tooltip>
      ),
    },
    {
      title: (
        <Space size={4}>
          <span>Thời hạn bảo hành thử việc (Còn X/60 ngày)</span>
          <Tooltip title="Chu kỳ bảo hành 60 ngày thử việc: Khi hoàn thành 60/60 ngày, hoa hồng chuyển từ 'Chờ duyệt' sang 'Đủ điều kiện nhận'.">
            <InfoCircleOutlined style={{ color: '#0284c7', cursor: 'pointer' }} />
          </Tooltip>
        </Space>
      ),
      key: 'probationWarranty',
      width: 260,
      render: (_, record) => {
        const isComplete = record.warrantyExpired || record.probationProgress >= 100;
        const progressStroke = isComplete
          ? { '0%': '#10b981', '100%': '#059669' }
          : record.probationProgress >= 50
          ? { '0%': '#0284c7', '100%': '#38bdf8' }
          : { '0%': '#f59e0b', '100%': '#fbbf24' };

        return (
          <div>
            {isComplete ? (
              <div>
                <Tag
                  color="success"
                  style={{
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#15803d',
                  }}
                >
                  <CheckCircleFilled style={{ color: '#16a34a' }} />
                  Đã hoàn tất 60/60 ngày
                </Tag>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                  Mốc kết thúc: {new Date(record.probationEndDate).toLocaleDateString('vi-VN')}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                    Còn {record.probationDaysRemaining}/60 ngày
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
                    {record.probationProgress}%
                  </span>
                </div>
                <Progress
                  percent={record.probationProgress}
                  size="small"
                  showInfo={false}
                  strokeColor={progressStroke}
                  trailColor="#e2e8f0"
                  style={{ margin: '3px 0' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                  <span>Nhận việc: {new Date(record.probationStartDate).toLocaleDateString('vi-VN')}</span>
                  <span>Mốc 60d: {new Date(record.probationEndDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (status: PayoutStatus) => {
        if (status === PayoutStatus.PAYABLE) {
          return (
            <Tag
              style={{
                background: '#f0fdf4',
                color: '#16a34a',
                border: '1px solid #86efac',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 6,
                padding: '3px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                  boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.25)',
                }}
              />
              Đủ điều kiện nhận
            </Tag>
          );
        }

        if (status === PayoutStatus.ON_HOLD) {
          return (
            <Tag
              style={{
                background: '#fffbeb',
                color: '#d97706',
                border: '1px solid #fde68a',
                fontWeight: 600,
                fontSize: 12,
                borderRadius: 6,
                padding: '3px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ClockCircleOutlined style={{ color: '#d97706' }} />
              Chờ duyệt
            </Tag>
          );
        }

        if (status === PayoutStatus.PAID) {
          return (
            <Tag
              style={{
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                fontWeight: 600,
                fontSize: 12,
                borderRadius: 6,
                padding: '3px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CheckCircleOutlined style={{ color: '#0284c7' }} />
              Đã thanh toán
            </Tag>
          );
        }

        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Hành động & Bằng chứng',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_, record) => {
        const isPaid = record.status === PayoutStatus.PAID;
        const isPayable = record.status === PayoutStatus.PAYABLE;

        return (
          <Space size={8} wrap>
            {/* If PAID: Show "Xem Bằng Chứng Chuyển Khoản" button */}
            {isPaid && (
              <Button
                type="primary"
                size="middle"
                icon={<FilePdfOutlined />}
                onClick={() => handleOpenEvidenceModal(record)}
                style={{
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Xem Bằng Chứng Chuyển Khoản
              </Button>
            )}

            {/* If PAYABLE: Admin can record offline payout */}
            {isPayable && viewPerspective === 'ADMIN' && (
              <Button
                type="primary"
                size="middle"
                icon={<BankOutlined />}
                onClick={() => handleOpenAdminRecordModal(record)}
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                }}
              >
                Ghi nhận ủy nhiệm chi ngoài hệ thống
              </Button>
            )}

            {/* If PAYABLE in Affiliate View: Show info badge */}
            {isPayable && viewPerspective === 'AFFILIATE' && (
              <Tag
                color="success"
                style={{
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontWeight: 600,
                  fontSize: 12,
                  margin: 0,
                }}
              >
                Đủ điều kiện nhận · Chờ kế toán chuyển tiền
              </Tag>
            )}

            {/* If ON_HOLD */}
            {record.status === PayoutStatus.ON_HOLD && (
              <Tooltip title={`Đang trong 60 ngày bảo hành. Còn lại ${record.probationDaysRemaining} ngày thử việc.`}>
                <Tag
                  color="warning"
                  style={{
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontWeight: 600,
                    fontSize: 11,
                    margin: 0,
                  }}
                >
                  Còn {record.probationDaysRemaining}/60 ngày
                </Tag>
              </Tooltip>
            )}

            {/* Audit log quick peek button */}
            <Tooltip title="Xem lịch sử kiểm toán & tiến độ bảo hành">
              <Button
                type="text"
                size="middle"
                icon={<AuditOutlined />}
                onClick={() => handleOpenEvidenceModal(record)}
                style={{ borderRadius: 6, color: '#64748b' }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* ─── Mandatory Offline Architecture Notice Banner ─────────────────── */}
      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: '#0284c7', fontSize: 16 }} />
            <strong style={{ color: '#0f172a', fontSize: 13 }}>
              HỆ THỐNG GHI NHẬN THANH TOÁN NGOẠI TUYẾN & KIỂM TOÁN ĐỐI SOÁT (MF-04 & MF-05)
            </strong>
          </div>
        }
        description={
          <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
            Nền tảng HR-Connect <strong>KHÔNG thực hiện lệnh thanh toán ngân hàng trực tuyến</strong>. Toàn bộ tiền hoa hồng được bộ phận Kế toán chuyển khoản thủ công ngoài hệ thống ngân hàng (Vietcombank / Techcombank / Napas 24/7) và lưu vết bằng chứng chuyển khoản (Ủy nhiệm chi / UNC) cùng <strong>Lịch sử kiểm toán bất biến (Immutable Audit Trail)</strong>.
          </span>
        }
        type="info"
        showIcon={false}
        style={{
          borderRadius: 14,
          marginBottom: 20,
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
        }}
      />

      {/* ─── Top Header with Perspective Switcher ─────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 18,
          padding: '24px 28px',
          marginBottom: 24,
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(2, 132, 199, 0.2)',
                border: '1px solid rgba(2, 132, 199, 0.4)',
                color: '#38bdf8',
                fontSize: 18,
              }}
            >
              <DollarOutlined />
            </span>
            <Title level={3} style={{ margin: 0, color: '#ffffff', fontWeight: 800 }}>
              Sổ cái Hoa hồng & Hồ sơ Bằng chứng Thanh toán Ngoài
            </Title>
            <Tag
              color="cyan"
              style={{
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 11,
                border: 'none',
                background: 'rgba(6, 182, 212, 0.2)',
                color: '#22d3ee',
              }}
            >
              SCR-AFF-04 & SCR-ADM-02
            </Tag>
          </div>
          <Paragraph style={{ color: '#94a3b8', margin: 0, fontSize: 13, maxWidth: 700 }}>
            Kiểm soát thời hạn bảo hành 60 ngày thử việc của ứng viên, lưu trữ bằng chứng ủy nhiệm chi ngân hàng ngoài và biên bản kiểm toán cho từng khoản hoa hồng.
          </Paragraph>
        </div>

        {/* View Perspective Switcher & Fast Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '4px 6px',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <Segmented
              value={viewPerspective}
              onChange={(val) => setViewPerspective(val as 'AFFILIATE' | 'ADMIN')}
              options={[
                {
                  label: (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '0 6px' }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      Affiliate View (David Tran)
                    </span>
                  ),
                  value: 'AFFILIATE',
                },
                {
                  label: (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '0 6px' }}>
                      <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                      Admin View (Alex Nguyen - Ghi nhận Payout)
                    </span>
                  ),
                  value: 'ADMIN',
                },
              ]}
            />
          </div>

          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Xuất CSV
          </Button>

          <Button
            icon={<ReloadOutlined spin={isLoading} />}
            onClick={() => void refetch()}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#ffffff',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* ─── Stat Cards: Affiliate View (Pending/On-Hold vs Payable) ─────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Card 1: Hoa hồng Chờ duyệt (Pending) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 20px -2px rgba(245, 158, 11, 0.12)',
              border: '1px solid #fde68a',
              background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
              transition: 'all 0.25s ease',
            }}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
                  Hoa hồng Chờ duyệt (Pending)
                </Text>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                  ${summary?.pendingAmount?.toLocaleString() ?? '9,450'}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#d97706', marginLeft: 4 }}>USD</span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  fontSize: 20,
                }}
              >
                <ClockCircleOutlined />
              </div>
            </div>
            <Divider style={{ margin: '14px 0 10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#78350f' }}>
                Đang thử việc: <strong>{summary?.activeProbations ?? 2} ứng viên</strong>
              </span>
              <Tag color="warning" style={{ borderRadius: 4, margin: 0, fontSize: 11, fontWeight: 600 }}>
                Thời hạn bảo hành (Còn X/60 ngày)
              </Tag>
            </div>
          </Card>
        </Col>

        {/* Card 2: Đủ điều kiện nhận (Payable) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.12)',
              border: '1px solid #bbf7d0',
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
              transition: 'all 0.25s ease',
            }}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                  Đủ điều kiện nhận (Payable)
                </Text>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                  ${summary?.payableAmount?.toLocaleString() ?? '7,200'}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a', marginLeft: 4 }}>USD</span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                  fontSize: 20,
                }}
              >
                <ArrowUpOutlined />
              </div>
            </div>
            <Divider style={{ margin: '14px 0 10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                ✓ Đã hoàn thành 60/60 ngày bảo hành
              </span>
              <Tag color="success" style={{ borderRadius: 4, margin: 0, fontSize: 11, fontWeight: 700 }}>
                {viewPerspective === 'ADMIN' ? 'Cần thanh toán' : 'Đủ điều kiện nhận'}
              </Tag>
            </div>
          </Card>
        </Col>

        {/* Card 3: Đã thanh toán (Paid) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.12)',
              border: '1px solid #bae6fd',
              background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
              transition: 'all 0.25s ease',
            }}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                  Đã thanh toán (Paid)
                </Text>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                  ${summary?.paidAmount?.toLocaleString() ?? '2,880'}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0284c7', marginLeft: 4 }}>USD</span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  fontSize: 20,
                }}
              >
                <CheckCircleOutlined />
              </div>
            </div>
            <Divider style={{ margin: '14px 0 10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#0369a1' }}>
                Có chứng từ ủy nhiệm chi (UNC)
              </span>
              <Tag color="processing" style={{ borderRadius: 4, margin: 0, fontSize: 11 }}>
                Đã thanh toán
              </Tag>
            </div>
          </Card>
        </Col>

        {/* Card 4: Tổng Hoa Hồng Tích Lũy */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              transition: 'all 0.25s ease',
            }}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Tổng Hoa Hồng Tích Lũy
                </Text>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  ${summary?.totalEarned?.toLocaleString() ?? '19,530'}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>USD</span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  fontSize: 20,
                }}
              >
                <DollarOutlined />
              </div>
            </div>
            <Divider style={{ margin: '14px 0 10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Tổng tuyển dụng: <strong>{summary?.totalPlacements ?? 4} ứng viên</strong>
              </span>
              <Tag color="default" style={{ borderRadius: 4, margin: 0, fontSize: 11 }}>
                Tất cả thời gian
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ─── Search & Status Tabs ─────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          marginBottom: 16,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12} lg={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm kiếm ứng viên, công ty, vị trí hoặc mã hợp đồng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="middle"
              style={{ borderRadius: 8 }}
            />
          </Col>

          <Col xs={24} md={12} lg={14} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tabs
              activeKey={statusFilter}
              onChange={(key) => setStatusFilter(key as 'ALL' | PayoutStatus)}
              size="small"
              tabBarStyle={{ marginBottom: 0 }}
              items={[
                {
                  key: 'ALL',
                  label: (
                    <span>
                      Tất cả <Badge count={commissions?.length ?? 0} style={{ backgroundColor: '#64748b' }} />
                    </span>
                  ),
                },
                {
                  key: PayoutStatus.ON_HOLD,
                  label: (
                    <span>
                      Chờ duyệt <Badge count={commissions?.filter((c) => c.status === PayoutStatus.ON_HOLD).length ?? 0} style={{ backgroundColor: '#f59e0b' }} />
                    </span>
                  ),
                },
                {
                  key: PayoutStatus.PAYABLE,
                  label: (
                    <span>
                      Đủ điều kiện nhận <Badge count={commissions?.filter((c) => c.status === PayoutStatus.PAYABLE).length ?? 0} style={{ backgroundColor: '#10b981' }} />
                    </span>
                  ),
                },
                {
                  key: PayoutStatus.PAID,
                  label: (
                    <span>
                      Đã thanh toán <Badge count={commissions?.filter((c) => c.status === PayoutStatus.PAID).length ?? 0} style={{ backgroundColor: '#0284c7' }} />
                    </span>
                  ),
                },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* ─── Main Antd Table ──────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table<Commission>
          columns={columns}
          dataSource={filteredCommissions}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 8,
            showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} trên ${total} khoản hoa hồng`,
            style: { padding: '16px 24px', margin: 0 },
          }}
          scroll={{ x: 1100 }}
          rowClassName={(record) =>
            record.status === PayoutStatus.PAYABLE ? 'bg-emerald-50/20' : ''
          }
        />
      </Card>

      {/* ─── MODAL 1: Xem Bằng Chứng Chuyển Khoản & Audit Trail (SCR-AFF-04) ─── */}
      <Modal
        open={evidenceModalOpen}
        onCancel={() => setEvidenceModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setEvidenceModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
        ]}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              <FilePdfOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                Hồ sơ Bằng chứng Chuyển khoản Ngoài (Bank Transfer Evidence)
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Đối soát chứng từ ủy nhiệm chi & Lịch sử kiểm toán bất biến
              </div>
            </div>
          </div>
        }
        width={680}
        destroyOnClose
      >
        {selectedCommission && (
          <div style={{ paddingTop: 12 }}>
            {selectedCommission.status === PayoutStatus.PAID && selectedCommission.payoutEvidence ? (
              <div>
                {/* Bank Reference & Payment Date Summary Card */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    border: '1px solid #bae6fd',
                    marginBottom: 20,
                  }}
                >
                  <Row gutter={[16, 12]}>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Mã tham chiếu ngân hàng (Ref ID)
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0284c7', marginTop: 2, fontFamily: 'monospace' }}>
                        {selectedCommission.payoutEvidence.bankReferenceCode}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Ngày thực hiện chuyển khoản
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginTop: 2 }}>
                        {selectedCommission.payoutEvidence.transferDate}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Số tiền thực chi
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#16a34a', marginTop: 2 }}>
                        ${selectedCommission.payoutEvidence.paidAmount.toLocaleString()} {selectedCommission.currency}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Người ghi nhận chuyển tiền
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#334155', marginTop: 2 }}>
                        {selectedCommission.payoutEvidence.recordedBy}
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Uploaded Receipt Document Preview */}
                <Title level={5} style={{ color: '#0f172a', marginBottom: 10 }}>
                  Chứng từ Ủy nhiệm chi đính kèm (Uploaded Receipt Document)
                </Title>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                    background: '#f8fafc',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FilePdfOutlined style={{ fontSize: 24, color: '#ef4444' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                          {selectedCommission.payoutEvidence.receiptFileName || 'UNC_ChuyenKhoan_Ngoai.pdf'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Dung lượng: {selectedCommission.payoutEvidence.receiptFileSize || '428 KB'} · Đã ký số điện tử
                        </div>
                      </div>
                    </div>
                    <Tag color="success" style={{ fontWeight: 700, borderRadius: 4 }}>
                      ✓ ĐÃ XÁC THỰC
                    </Tag>
                  </div>

                  {/* Bank Transfer Receipt Graphic / Image Box */}
                  <div
                    style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        padding: '10px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 12 }}>
                        VIETCOMBANK — LỆNH CHUYỂN TIỀN NGOẠI HỆ THỐNG (ỦY NHIỆM CHI)
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.9 }}>
                        Mã GD: {selectedCommission.payoutEvidence.bankReferenceCode}
                      </span>
                    </div>

                    <div style={{ padding: 16 }}>
                      <Row gutter={[12, 8]} style={{ fontSize: 12 }}>
                        <Col span={12}>
                          <span style={{ color: '#64748b' }}>Đơn vị trả tiền:</span>{' '}
                          <strong>CÔNG TY CP NỀN TẢNG HR-CONNECT</strong>
                        </Col>
                        <Col span={12}>
                          <span style={{ color: '#64748b' }}>Người thụ hưởng:</span>{' '}
                          <strong>{selectedCommission.affiliateName.toUpperCase()}</strong>
                        </Col>
                        <Col span={12}>
                          <span style={{ color: '#64748b' }}>Số tài khoản nhận:</span>{' '}
                          <strong>{selectedCommission.bankDetails?.accountNumber || '0071001234567'}</strong>
                        </Col>
                        <Col span={12}>
                          <span style={{ color: '#64748b' }}>Ngân hàng thụ hưởng:</span>{' '}
                          <strong>{selectedCommission.bankDetails?.bankName || 'Vietcombank'}</strong>
                        </Col>
                        <Col span={24}>
                          <span style={{ color: '#64748b' }}>Nội dung chuyển tiền:</span>{' '}
                          <span style={{ color: '#0f172a' }}>
                            Thanh toán hoa hồng tuyển dụng ứng viên {selectedCommission.candidateName} (HĐ: {selectedCommission.id})
                          </span>
                        </Col>
                      </Row>

                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 10,
                          borderTop: '1px dashed #cbd5e1',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          Trạng thái hạch toán: <strong style={{ color: '#16a34a' }}>ĐÃ HẠCH TOÁN THÀNH CÔNG</strong>
                        </span>
                        <div
                          style={{
                            border: '2px solid #ef4444',
                            borderRadius: 6,
                            padding: '2px 8px',
                            color: '#ef4444',
                            fontWeight: 800,
                            fontSize: 11,
                            letterSpacing: '0.05em',
                            transform: 'rotate(-4deg)',
                          }}
                        >
                          NGÂN HÀNG ĐÃ ĐÓNG DẤU
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Immutable Audit Trail Section */}
                <Title level={5} style={{ color: '#0f172a', marginBottom: 10 }}>
                  <AuditOutlined style={{ marginRight: 6, color: '#0284c7' }} />
                  Lịch sử Kiểm toán Bất biến (Immutable Audit Trail)
                </Title>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(selectedCommission.auditTrail || [
                      {
                        id: 'aud-01',
                        action: 'OFFLINE_PAYOUT_RECORDED',
                        actorName: selectedCommission.payoutEvidence.recordedBy,
                        actorRole: 'ADMIN',
                        timestamp: selectedCommission.payoutEvidence.recordedAt,
                        details: `Ghi nhận chuyển khoản ngoài: $${selectedCommission.payoutEvidence.paidAmount} USD. Mã giao dịch: ${selectedCommission.payoutEvidence.bankReferenceCode}. Đính kèm chứng từ ủy nhiệm chi.`,
                      },
                    ]).map((entry, idx) => (
                      <div key={entry.id || idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                              {entry.actorName}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              {new Date(entry.timestamp).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            {entry.details}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  message="Chưa phát sinh lệnh chuyển tiền ngoài"
                  description={
                    selectedCommission.status === PayoutStatus.PAYABLE
                      ? 'Khoản hoa hồng này đã hoàn tất 60 ngày bảo hành và đang chờ Admin ghi nhận chuyển khoản ngoài.'
                      : `Khoản hoa hồng này đang trong chu kỳ bảo hành 60 ngày thử việc (Còn ${selectedCommission.probationDaysRemaining}/60 ngày).`
                  }
                  style={{ borderRadius: 10 }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─── MODAL 2: Admin Ghi Nhận Chuyển Tiền Ngoài (SCR-ADM-02) ─────────── */}
      <Modal
        open={adminModalOpen}
        onCancel={() => {
          setAdminModalOpen(false);
          adminForm.resetFields();
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              <BankOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                Ghi nhận ủy nhiệm chi ngoài hệ thống
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Dành cho Kế toán / Quản trị: Lưu chứng từ ủy nhiệm chi & Cập nhật trạng thái sang Đã thanh toán
              </div>
            </div>
          </div>
        }
        onOk={handleAdminRecordSubmit}
        okText="Ghi nhận ủy nhiệm chi ngoài hệ thống"
        cancelText="Hủy bỏ"
        okButtonProps={{
          loading: recordingPayout,
          type: 'primary',
          size: 'large',
          style: {
            backgroundColor: '#059669',
            borderColor: '#059669',
            borderRadius: 8,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
          },
        }}
        cancelButtonProps={{ size: 'large', style: { borderRadius: 8 } }}
        width={620}
        destroyOnClose
      >
        {targetPayableCommission && (
          <div style={{ paddingTop: 14 }}>
            {/* Target Item Brief */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 20,
                border: '1px solid #e2e8f0',
              }}
            >
              <Row gutter={16}>
                <Col span={14}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Đối tượng thụ hưởng
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginTop: 2 }}>
                    {targetPayableCommission.affiliateName} (ID: {targetPayableCommission.affiliateId})
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Ứng viên: <strong>{targetPayableCommission.candidateName}</strong> · {targetPayableCommission.jobTitle}
                  </div>
                </Col>
                <Col span={10} style={{ textAlign: 'right', borderLeft: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Hoa hồng thỏa thuận
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: '#059669', marginTop: 2 }}>
                    ${targetPayableCommission.commissionAmount.toLocaleString()} USD
                  </div>
                  <Tag color="success" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10, margin: 0 }}>
                    ✓ ĐÃ HẾT BẢO HÀNH 60D
                  </Tag>
                </Col>
              </Row>
            </div>

            {/* Ant Design Form v5 for Admin Record */}
            <Form form={adminForm} layout="vertical" requiredMark="optional">
              <Row gutter={16}>
                {/* 1. Paid Amount */}
                <Col span={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 700, fontSize: 13 }}>[Paid Amount] Số tiền thực chuyển ($)</span>}
                    name="paidAmount"
                    rules={[
                      { required: true, message: 'Vui lòng nhập số tiền thực chi!' },
                    ]}
                  >
                    <Input
                      type="number"
                      size="large"
                      placeholder="7200"
                      prefix={<span style={{ color: '#64748b', fontWeight: 600 }}>$</span>}
                      suffix={<span style={{ color: '#94a3b8', fontSize: 12 }}>USD</span>}
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>
                </Col>

                {/* 3. Transfer Date */}
                <Col span={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 700, fontSize: 13 }}>[Transfer Date] Ngày chuyển khoản</span>}
                    name="transferDate"
                    rules={[{ required: true, message: 'Vui lòng chọn ngày thực hiện chuyển khoản!' }]}
                  >
                    <DatePicker
                      size="large"
                      style={{ width: '100%', borderRadius: 8 }}
                      format="YYYY-MM-DD"
                    />
                  </Form.Item>
                </Col>

                {/* 2. Bank Reference Code */}
                <Col span={24}>
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        [Bank Reference Code] Mã tham chiếu giao dịch ngân hàng ngoài
                      </span>
                    }
                    name="bankReferenceCode"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mã giao dịch ngân hàng / Ref ID!' },
                      { min: 5, message: 'Mã giao dịch tối thiểu 5 ký tự!' },
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="Ví dụ: VCB-FT26258901234567 hoặc TCB-20260918-9921"
                      style={{ borderRadius: 8, fontFamily: 'monospace', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>

                {/* 4. Upload Receipt Image / Document */}
                <Col span={24}>
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        [Upload Receipt Image] Bằng chứng chứng từ / Ủy nhiệm chi (UNC)
                      </span>
                    }
                    required
                  >
                    <Upload.Dragger
                      fileList={uploadedReceiptList}
                      beforeUpload={(file) => {
                        setUploadedReceiptList([
                          {
                            uid: file.uid,
                            name: file.name,
                            status: 'done',
                            url: DEFAULT_RECEIPT_PREVIEW,
                          },
                        ]);
                        return false;
                      }}
                      onRemove={() => setUploadedReceiptList([])}
                      maxCount={1}
                      style={{ borderRadius: 10, background: '#fafafa' }}
                    >
                      <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
                        <InboxOutlined style={{ color: '#0284c7', fontSize: 32 }} />
                      </p>
                      <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 2px 0', color: '#0f172a' }}>
                        Kéo thả file biên lai UNC vào đây, hoặc bấm để tải lên
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                        Hỗ trợ định dạng PDF, PNG, JPG (Dung lượng tối đa 10MB)
                      </p>
                    </Upload.Dragger>
                  </Form.Item>
                </Col>

                {/* Admin Audit Notes */}
                <Col span={24}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 13 }}>Ghi chú đối soát nội bộ</span>}
                    name="adminNotes"
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="Ghi chú số phiếu chi, tài khoản nguồn chuyển tiền..."
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            {/* Audit commitment alert */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '10px 14px',
                background: '#ecfdf5',
                borderRadius: 8,
                border: '1px solid #bbf7d0',
              }}
            >
              <CheckCircleFilled style={{ color: '#059669', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#065f46' }}>
                Hành động này sẽ cập nhật trạng thái hợp đồng từ <strong>PAYABLE</strong> sang <strong>PAID</strong>, lưu vết bằng chứng chuyển tiền và ghi nhận vào lịch sử kiểm toán bất biến của hệ thống.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─── Inline Icon Helper ─────────────────────────────────────────────────────
const BriefcaseIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#64748b"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
