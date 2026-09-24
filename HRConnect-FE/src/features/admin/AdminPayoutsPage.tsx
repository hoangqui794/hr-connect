import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, message, Tabs, Statistic, Alert, Popconfirm,
} from 'antd';
import {
  DollarOutlined, CheckCircleOutlined,
  BankOutlined, DownloadOutlined, SafetyCertificateOutlined,
  AuditOutlined, SendOutlined,
} from '@ant-design/icons';
import { useCommissions } from '@/services/queries/useFinancials';
import { PayoutStatus } from '@/types/affiliate';
import type { Commission } from '@/types/affiliate';
import type { ColumnsType } from 'antd/es/table';
import {
  getPayouts,
  updatePayoutStatus as updateStoredPayout,
  PayoutRecord as PayoutItem,
} from '@/services/localStorageService';
import { ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const INITIAL_PAYOUTS: PayoutItem[] = [
  {
    id: 'pay-001',
    candidateName: 'Le Hoang Minh',
    affiliateName: 'David Tran',
    affiliateBank: 'Techcombank',
    affiliateBankAccount: '19034567890123',
    jobTitle: 'Senior React Developer (COD)',
    hiredDate: '2026-07-15',
    warrantyEndDate: '2026-09-15',
    commissionAmount: 25000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-002',
    candidateName: 'Tran Thi Thu',
    affiliateName: 'Sarah Le',
    affiliateBank: 'Vietcombank',
    affiliateBankAccount: '0071001234567',
    jobTitle: 'Product Manager - Fintech',
    hiredDate: '2026-07-20',
    warrantyEndDate: '2026-09-20',
    commissionAmount: 32000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-003',
    candidateName: 'Nguyen Van B',
    affiliateName: 'Minh Vu Recruiter',
    affiliateBank: 'MB Bank',
    affiliateBankAccount: '888899991234',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    hiredDate: '2026-07-22',
    warrantyEndDate: '2026-09-22',
    commissionAmount: 18000000,
    status: PayoutStatus.PAYABLE,
  },
  {
    id: 'pay-004',
    candidateName: 'Phan Thanh Tung',
    affiliateName: 'David Tran',
    affiliateBank: 'Techcombank',
    affiliateBankAccount: '19034567890123',
    jobTitle: 'Backend Java Lead',
    hiredDate: '2026-06-01',
    warrantyEndDate: '2026-08-01',
    commissionAmount: 40000000,
    status: PayoutStatus.PAID,
  },
  {
    id: 'pay-005',
    candidateName: 'Vu Dinh Trong',
    affiliateName: 'Sarah Le',
    affiliateBank: 'Vietcombank',
    affiliateBankAccount: '0071001234567',
    jobTitle: 'Mobile Flutter Engineer',
    hiredDate: '2026-08-25',
    warrantyEndDate: '2026-10-25',
    commissionAmount: 20000000,
    status: PayoutStatus.ON_HOLD,
  },
];

interface RevenueSplit {
  key: string;
  clientName: string;
  jobTitle: string;
  packageType: string;
  totalInvoice: number;
  affiliateShare: number; // 80%
  platformMargin: number; // 20%
  status: string;
}

const REVENUE_SPLITS: RevenueSplit[] = [
  {
    key: '1',
    clientName: 'Blata33 Technology JSC',
    jobTitle: 'Senior React Developer',
    packageType: 'COD Tuyển dụng',
    totalInvoice: 31250000,
    affiliateShare: 25000000,
    platformMargin: 6250000,
    status: 'Đã thanh toán',
  },
  {
    key: '2',
    clientName: 'VNG Corporation',
    jobTitle: 'Product Manager - Fintech',
    packageType: 'COD Tuyển dụng',
    totalInvoice: 40000000,
    affiliateShare: 32000000,
    platformMargin: 8000000,
    status: 'Đã thanh toán',
  },
  {
    key: '3',
    clientName: 'Techcombank Digital Lab',
    jobTitle: 'DevOps Engineer',
    packageType: 'COD Tuyển dụng',
    totalInvoice: 22500000,
    affiliateShare: 18000000,
    platformMargin: 4500000,
    status: 'Đã thanh toán',
  },
  {
    key: '4',
    clientName: 'NexGen AI Solutions Ltd',
    jobTitle: 'AI Research Scientist',
    packageType: 'CV Sourcing Subscription',
    totalInvoice: 15000000,
    affiliateShare: 0,
    platformMargin: 15000000,
    status: 'Đã thu tiền',
  },
];


export const AdminPayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutItem[]>(getPayouts);

  const handleRefresh = () => {
    setPayouts(getPayouts());
  };

  const payablePayouts = payouts.filter((p) => p.status === PayoutStatus.PAYABLE);
  const totalPayableAmount = payablePayouts.reduce((acc, p) => acc + p.commissionAmount, 0);
  const paidPayouts = payouts.filter((p) => p.status === PayoutStatus.PAID);
  const totalPaidAmount = paidPayouts.reduce((acc, p) => acc + p.commissionAmount, 0);

  // Helper format currency
  const formatCurrency = (amount: number): string => `${amount.toLocaleString('vi-VN')} đ`;

  const recordPayoutAuditAndNotification = (item: PayoutItem) => {
    // 1. Update status in hrconnect_commissions to 'PAID'
    try {
      const comRaw = localStorage.getItem('hrconnect_commissions');
      if (comRaw) {
        const parsed = JSON.parse(comRaw);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((c: any) => {
            if (
              (c.candidateName && item.candidateName && c.candidateName.toLowerCase() === item.candidateName.toLowerCase()) ||
              (c.affiliateName && item.affiliateName && c.affiliateName.toLowerCase() === item.affiliateName.toLowerCase())
            ) {
              return { ...c, status: 'PAID', updatedAt: new Date().toISOString() };
            }
            return c;
          });
          localStorage.setItem('hrconnect_commissions', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.error('Failed to update hrconnect_commissions:', e);
    }

    // 2. Resolve affiliate email from hrconnect_users
    let affiliateEmail = (item as any).affiliateEmail;
    if (!affiliateEmail) {
      try {
        const usersRaw = localStorage.getItem('hrconnect_users');
        if (usersRaw) {
          const users = JSON.parse(usersRaw);
          if (Array.isArray(users)) {
            const matchUser = users.find(
              (u: any) => (u.fullName && item.affiliateName && u.fullName.toLowerCase() === item.affiliateName.toLowerCase()) ||
                          (u.name && item.affiliateName && u.name.toLowerCase() === item.affiliateName.toLowerCase())
            );
            if (matchUser) affiliateEmail = matchUser.email;
          }
        }
      } catch {
        // noop
      }
    }
    if (!affiliateEmail) affiliateEmail = 'affiliate@demo.com';

    // 3. Write log into hrconnect_audit_logs:
    // { id: 'AUD-' + Date.now(), timestamp: new Date().toISOString(), action: 'Chi trả Payout', target: 'CTV ' + affiliateName + ' - ' + formatCurrency(amount), actor: 'Platform Admin' }
    try {
      const logRaw = localStorage.getItem('hrconnect_audit_logs');
      let logList: any[] = [];
      if (logRaw) {
        const parsed = JSON.parse(logRaw);
        if (Array.isArray(parsed)) logList = parsed;
      }
      const newAuditLog = {
        id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        action: 'Chi trả Payout',
        target: 'CTV ' + item.affiliateName + ' - ' + formatCurrency(item.commissionAmount),
        actor: 'Platform Admin',
      };
      logList.unshift(newAuditLog);
      localStorage.setItem('hrconnect_audit_logs', JSON.stringify(logList));
    } catch (e) {
      console.error('Failed to record audit log:', e);
    }

    // 4. Create notification into hrconnect_notifications:
    // { id: 'NOTIF-' + Date.now(), recipientEmail: affiliateEmail, title: 'Hoa hồng đã được thanh toán', content: 'Khoản chi trả hoa hồng ' + formatCurrency(amount) + ' đã được phê duyệt.', createdAt: new Date().toISOString(), isRead: false }
    try {
      const notifRaw = localStorage.getItem('hrconnect_notifications');
      let notifList: any[] = [];
      if (notifRaw) {
        const parsed = JSON.parse(notifRaw);
        if (Array.isArray(parsed)) notifList = parsed;
      }
      const newNotif = {
        id: 'NOTIF-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        recipientEmail: affiliateEmail,
        title: 'Hoa hồng đã được thanh toán',
        content: 'Khoản chi trả hoa hồng ' + formatCurrency(item.commissionAmount) + ' đã được phê duyệt.',
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      notifList.unshift(newNotif);
      localStorage.setItem('hrconnect_notifications', JSON.stringify(notifList));
    } catch (e) {
      console.error('Failed to trigger notification:', e);
    }
  };

  // Execute single payout
  const handleExecutePayout = (item: PayoutItem) => {
    updateStoredPayout(item.id, PayoutStatus.PAID);
    recordPayoutAuditAndNotification(item);

    setPayouts((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, status: PayoutStatus.PAID } : p))
    );
    message.success(
      `Đã thực thi lệnh chi trả ${formatCurrency(item.commissionAmount)} tới ${
        item.affiliateName
      } (${item.affiliateBank} - ${item.affiliateBankAccount})!`
    );
  };

  const handleApprovePayout = handleExecutePayout;

  // Batch execute all payable payouts
  const handleBatchPayout = () => {
    payablePayouts.forEach((p) => {
      updateStoredPayout(p.id, PayoutStatus.PAID);
      recordPayoutAuditAndNotification(p);
    });
    setPayouts((prev) =>
      prev.map((p) => (p.status === PayoutStatus.PAYABLE ? { ...p, status: PayoutStatus.PAID } : p))
    );
    message.success(
      `Đã thực thi chi trả hàng loạt thành công cho ${
        payablePayouts.length
      } khoản hoa hồng (Tổng cộng: ${formatCurrency(totalPayableAmount)})!`
    );
  };

  const handleBatchApprove = handleBatchPayout;

  const payoutColumns: ColumnsType<PayoutItem> = [
    {
      title: 'Ứng viên & Vị trí',
      key: 'candidate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.candidateName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.jobTitle}</div>
        </div>
      ),
    },
    {
      title: 'Đối tác CTV thụ hưởng',
      key: 'affiliate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#059669' }}>{record.affiliateName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <BankOutlined style={{ marginRight: 4 }} />
            {record.affiliateBank}: {record.affiliateBankAccount}
          </div>
        </div>
      ),
    },
    {
      title: 'Mốc bảo hành 60 ngày',
      key: 'warranty',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Onboard: {record.hiredDate}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
            Hết hạn: {record.warrantyEndDate}
          </div>
          <Tag color="cyan" style={{ fontSize: 10, borderRadius: 4, marginTop: 2 }}>
            Đạt bảo hành 60 ngày
          </Tag>
        </div>
      ),
    },
    {
      title: 'Số tiền chi trả (80%)',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      render: (v: number) => (
        <span style={{ fontWeight: 800, fontSize: 15, color: '#059669' }}>
          {v.toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: PayoutStatus) => {
        if (s === PayoutStatus.PAYABLE) {
          return <Badge status="processing" text={<span style={{ fontWeight: 700, color: '#0284c7' }}>Đủ điều kiện chi trả</span>} />;
        }
        if (s === PayoutStatus.PAID) {
          return <Badge status="success" text={<span style={{ fontWeight: 700, color: '#16a34a' }}>Đã chuyển tiền</span>} />;
        }
        return <Badge status="warning" text={<span style={{ fontWeight: 600, color: '#d97706' }}>Đang bảo hành</span>} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        record.status === PayoutStatus.PAYABLE ? (
          <Popconfirm
            title="Thực thi lệnh chi trả hoa hồng"
            description={`Xác nhận chuyển ${record.commissionAmount.toLocaleString('vi-VN')} đ cho ${record.affiliateName}?`}
            onConfirm={() => handleExecutePayout(record)}
            okText="Xác nhận chi trả"
            cancelText="Hủy"
            okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
          >
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #059669, #047857)',
                borderColor: '#059669',
              }}
            >
              Thực thi Payout
            </Button>
          </Popconfirm>
        ) : record.status === PayoutStatus.PAID ? (
          <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
            <CheckCircleOutlined style={{ marginRight: 4 }} />
            Đã thanh toán
          </span>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Chờ hết 60 ngày</span>
        )
      ),
    },
  ];

  const revenueColumns: ColumnsType<RevenueSplit> = [
    {
      title: 'Doanh nghiệp (Client)',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (t: string) => <strong>{t}</strong>,
    },
    {
      title: 'Vị trí tuyển dụng',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
    },
    {
      title: 'Gói dịch vụ',
      dataIndex: 'packageType',
      key: 'packageType',
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: 'Tổng thu từ Client',
      dataIndex: 'totalInvoice',
      key: 'totalInvoice',
      render: (v: number) => <span style={{ fontWeight: 700 }}>{v.toLocaleString('vi-VN')} đ</span>,
    },
    {
      title: 'Chi trả CTV (80%)',
      dataIndex: 'affiliateShare',
      key: 'affiliateShare',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#059669' }}>
          {v > 0 ? `${v.toLocaleString('vi-VN')} đ` : '—'}
        </span>
      ),
    },
    {
      title: 'Doanh thu sàn (20% Phí)',
      dataIndex: 'platformMargin',
      key: 'platformMargin',
      render: (v: number) => (
        <span style={{ fontWeight: 800, color: '#0284c7' }}>
          {v.toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <DollarOutlined style={{ color: '#059669', marginRight: 10 }} />
          Quản trị Tài chính Nền tảng & Duyệt Chi trả Hoa hồng
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Cổng giám sát doanh thu nền tảng, đối soát tỷ lệ chia sẻ hoa hồng và phê duyệt lệnh chi trả (Payout Execution) cho đối tác CTV sau khi hoàn thành bảo hành 60 ngày.
        </Text>
      </div>

      {/* Financial KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng GMV Tuyển dụng"
              value={1850000000}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#0f172a', fontWeight: 800, fontSize: 18 }}
              prefix={<DollarOutlined style={{ color: '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Doanh thu Nền tảng (20%)"
              value={370000000}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 18 }}
              prefix={<SafetyCertificateOutlined style={{ color: '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Hoa hồng đã chi trả CTV"
              value={totalPaidAmount + 1105000000}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 18 }}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Đến hạn Payout chờ duyệt"
              value={totalPayableAmount}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#059669', fontWeight: 800, fontSize: 18 }}
              prefix={<Badge count={payablePayouts.length} style={{ backgroundColor: '#059669' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="payouts"
        items={[
          {
            key: 'payouts',
            label: (
              <Space>
                <SendOutlined style={{ color: '#059669' }} />
                <span>Duyệt chi trả hoa hồng (Payout Execution)</span>
                <Badge count={payablePayouts.length} style={{ backgroundColor: '#059669' }} />
              </Space>
            ),
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <strong>Danh sách các khoản hoa hồng đã kết thúc 60 ngày bảo hành</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Các khoản hoa hồng đạt trạng thái PAYABLE sẵn sàng thực thi chuyển khoản đến tài khoản ngân hàng của CTV.
                    </div>
                  </div>

                  {payablePayouts.length > 0 && (
                    <Popconfirm
                      title="Duyệt chi trả hàng loạt"
                      description={`Bạn có chắc muốn thực thi chi trả toàn bộ ${payablePayouts.length} khoản hoa hồng (${totalPayableAmount.toLocaleString('vi-VN')} đ)?`}
                      onConfirm={handleBatchPayout}
                      okText="Duyệt tất cả"
                      cancelText="Hủy"
                    >
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        style={{
                          borderRadius: 8,
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          borderColor: '#059669',
                        }}
                      >
                        Duyệt chi trả hàng loạt ({payablePayouts.length})
                      </Button>
                    </Popconfirm>
                  )}
                </div>

                <Table
                  dataSource={payouts}
                  columns={payoutColumns}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  size="middle"
                />
              </Card>
            ),
          },
          {
            key: 'revenue',
            label: (
              <Space>
                <AuditOutlined style={{ color: '#0284c7' }} />
                <span>Báo cáo Doanh thu & Dòng tiền Nền tảng (Revenue Margin)</span>
              </Space>
            ),
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <Alert
                  type="info"
                  showIcon
                  message="Mô hình Phân bổ Doanh thu Tuyển dụng (Revenue Split Model)"
                  description="Đối với gói COD tuyển dụng thành công: 80% hoa hồng được phân bổ cho CTV/Headhunter giới thiệu ứng viên đạt mốc 60 ngày; 20% phí nền tảng giữ lại cho vận hành, kiểm định chất lượng và bảo chứng rủi ro."
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />

                <Table
                  dataSource={REVENUE_SPLITS}
                  columns={revenueColumns}
                  pagination={false}
                  size="middle"
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AdminPayoutsPage;

