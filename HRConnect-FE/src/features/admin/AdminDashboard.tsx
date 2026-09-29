import React, { useState } from 'react';
import {
  Table, Typography, Space, Tag, Button, Modal, Input,
  Row, Col, Alert, Badge, Tabs, message, Empty,
} from 'antd';
import {
  SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  DollarOutlined, ClockCircleOutlined, TeamOutlined,
  BankOutlined, ApartmentOutlined, AuditOutlined, ArrowRightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { KNOWN_DUPLICATES } from '@/services/mockData';
import { useCommissions } from '@/services/queries/useFinancials';
import { PayoutStatusBadge } from '@/components/common/StatusBadge';
import { PayoutStatus } from '@/types/affiliate';
import type { Commission } from '@/types/affiliate';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@/stores/authStore';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';
import { AntiDuplicationBadge } from '@/components/common/AntiDuplicationBadge';

const { TextArea } = Input;

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDemoAdmin = user?.id === 'admin-001' || user?.email?.includes('admin@hrconnect');
  const disputes = isDemoAdmin ? KNOWN_DUPLICATES : [];

  const { data: commissions } = useCommissions();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const payableCommissions = commissions?.filter((c) => c.status === PayoutStatus.PAYABLE) ?? [];

  const disputeColumns = [
    {
      title: 'ỨNG VIÊN & VỊ TRÍ',
      key: 'email',
      render: (_: unknown, record: typeof KNOWN_DUPLICATES[0]) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{record.candidateEmail}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">Job: {record.jobId}</div>
        </div>
      ),
    },
    {
      title: 'FIRST-SUBMISSION TIMESTAMP (BẰNG CHỨNG GỐC)',
      key: 'original',
      render: (_: unknown, record: typeof KNOWN_DUPLICATES[0]) => (
        <div className="space-y-1">
          <div className="font-bold text-xs text-blue-600">{record.originalAffiliateName}</div>
          <AntiDuplicationBadge
            timestamp={record.originalTimestamp}
            affiliateName={record.originalAffiliateName}
          />
        </div>
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            s === 'BLOCKED'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : s === 'DISPUTE_PENDING'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {s === 'DISPUTE_PENDING' ? 'Chờ phán quyết' : s}
        </span>
      ),
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      render: () => (
        <Button
          size="small"
          type="primary"
          onClick={() => setResolveOpen(true)}
          className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 border-none text-xs text-white"
        >
          Phán quyết
        </Button>
      ),
    },
  ];

  const payoutColumns: ColumnsType<Commission> = [
    {
      title: 'ỨNG VIÊN',
      dataIndex: 'candidateName',
      key: 'name',
      render: (v) => <span className="font-semibold text-slate-900">{v}</span>,
    },
    {
      title: 'HEADHUNTER THỤ HƯỞNG',
      dataIndex: 'affiliateName',
      key: 'affiliate',
      render: (v) => <span className="text-slate-600 font-medium">{v}</span>,
    },
    {
      title: 'SỐ TIỀN CHI TRẢ',
      dataIndex: 'commissionAmount',
      key: 'amount',
      render: (v: number) => (
        <span className="font-mono font-bold text-emerald-600 text-sm">
          ${v.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      render: (s: PayoutStatus) => <PayoutStatusBadge status={s} />,
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      render: (_, record) =>
        record.status === PayoutStatus.PAYABLE ? (
          <Button
            size="small"
            className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none text-xs"
            onClick={() =>
              void message.success(
                `Lệnh chi trả $${record.commissionAmount.toLocaleString()} cho ${record.affiliateName} đã được thực thi!`
              )
            }
          >
            Thực thi Payout
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Minimalist B2B Header ────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Bảng Điều Khiển Quản Trị Nền Tảng (Platform Administration)"
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            ⚙️ Root Control
          </span>
        }
        subtitle="Giám sát vận hành sàn HRConnect, phân xử tranh chấp ứng viên dựa trên First-Submission Timestamp và duyệt lệnh thanh toán Payout."
      />

      {/* ─── Admin KPI Metrics ────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Tranh chấp chờ xử lý"
            value={disputes.length}
            subLabel="Dựa trên First-Submission"
            statusBadge="Audit Trail"
            statusType="warranty"
            icon={<ExclamationCircleOutlined />}
            iconColor="#e11d48"
            onClick={() => navigate('/admin/disputes')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Hoa hồng chờ chi trả"
            value={payableCommissions.length}
            subLabel="Hoàn tất 60 ngày bảo hành"
            statusBadge="Đủ điều kiện rút"
            statusType="eligible"
            icon={<DollarOutlined />}
            iconColor="#10b981"
            onClick={() => navigate('/admin/payouts')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Doanh nghiệp tuyển dụng"
            value={isDemoAdmin ? 12 : 2}
            subLabel="Đối tác doanh nghiệp đã xác thực"
            statusBadge="Verified B2B"
            statusType="paid"
            icon={<BankOutlined />}
            iconColor="#2563eb"
            onClick={() => navigate('/admin/companies')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Mạng lưới CTV & Headhunter"
            value={isDemoAdmin ? 48 : 5}
            subLabel="Thành viên OPR Hub hoạt động"
            statusBadge="Network Active"
            statusType="info"
            icon={<ApartmentOutlined />}
            iconColor="#6366f1"
            onClick={() => navigate('/admin/affiliates')}
          />
        </Col>
      </Row>

      {/* ─── 4 Core Administrative Domains Quick Access ────────────────────── */}
      <div className="b2b-card p-5">
        <div className="mb-4 pb-3 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight m-0">
            Phân hệ Quản trị Vận hành Toàn diện (Core Administration Modules)
          </h3>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/users')}
              className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-2">
                <TeamOutlined className="text-blue-600 text-base" />
                <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600">
                  Người dùng & Phân quyền
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Quản lý danh sách tài khoản, khóa/mở khóa tài khoản và phân quyền vai trò.
              </p>
              <div className="text-xs text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Truy cập ngay <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/disputes')}
              className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 hover:border-rose-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-2">
                <SafetyCertificateOutlined className="text-rose-600 text-base" />
                <span className="font-bold text-sm text-rose-900 group-hover:text-rose-700">
                  Xử lý Tranh chấp Hồ sơ
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Giải quyết tranh chấp trùng lặp ứng viên dựa trên First-Submission Timestamp.
              </p>
              <div className="text-xs text-rose-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Xem {disputes.length} vụ việc <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/payouts')}
              className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 hover:border-emerald-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarOutlined className="text-emerald-600 text-base" />
                <span className="font-bold text-sm text-emerald-900 group-hover:text-emerald-700">
                  Duyệt Chi trả Payout
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Giám sát doanh thu sàn và duyệt lệnh chi trả hoa hồng hết 60 ngày bảo hành.
              </p>
              <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Duyệt Payout <ArrowRightOutlined />
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} lg={6}>
            <div
              onClick={() => navigate('/admin/audit-trail')}
              className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 hover:border-indigo-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-2">
                <AuditOutlined className="text-indigo-600 text-base" />
                <span className="font-bold text-sm text-indigo-900 group-hover:text-indigo-700">
                  Nhật ký Kiểm toán
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Lưu vết kiểm tra bất biến đối soát toàn bộ hành động bảo mật và tài chính.
              </p>
              <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Xem Audit Trail <ArrowRightOutlined />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* ─── Operational Tabs: Disputes & Payouts ──────────────────── */}
      <Tabs
        defaultActiveKey="disputes"
        items={[
          {
            key: 'disputes',
            label: (
              <Space>
                <ExclamationCircleOutlined className="text-rose-500" />
                <span className="text-slate-800 font-semibold">Tranh chấp trùng lặp ứng viên</span>
                <Badge count={disputes.length} style={{ background: '#ef4444' }} />
              </Space>
            ),
            children: (
              <div className="b2b-card p-5">
                <Alert
                  type="warning"
                  showIcon
                  message={<span className="text-amber-800 font-bold text-xs">Bảo chứng First-Submission Audit Trail</span>}
                  description={<span className="text-xs text-slate-600">Mọi tranh chấp giữa các CTV đều được phân xử tự động và minh bạch bằng chứng First-Submission Timestamps bất biến.</span>}
                  className="mb-4 bg-amber-50/80 border-amber-200 rounded-xl"
                />
                {disputes.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span className="text-xs text-slate-500">Hiện không có tranh chấp trùng lặp ứng viên nào cần xử lý.</span>}
                    className="py-6"
                  />
                ) : (
                  <Table
                    dataSource={disputes}
                    columns={disputeColumns}
                    rowKey="originalSubmissionId"
                    pagination={false}
                    size="middle"
                    className="bg-transparent"
                  />
                )}
              </div>
            ),
          },
          {
            key: 'payouts',
            label: (
              <Space>
                <DollarOutlined className="text-emerald-600" />
                <span className="text-slate-800 font-semibold">Thực thi Chi trả Hoa hồng (Payout Execution)</span>
                <Badge count={payableCommissions.length} style={{ background: '#059669' }} />
              </Space>
            ),
            children: (
              <div className="b2b-card p-5">
                <Table
                  dataSource={commissions ?? []}
                  columns={payoutColumns}
                  rowKey="id"
                  size="middle"
                  pagination={{ pageSize: 10 }}
                  className="bg-transparent"
                />
              </div>
            ),
          },
        ]}
      />

      {/* Resolve Dispute Modal */}
      <Modal
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        title={
          <Space>
            <CheckCircleOutlined className="text-emerald-600" />
            <span className="font-bold text-slate-900">Phán quyết Tranh chấp Trùng lặp Hồ sơ</span>
          </Space>
        }
        onOk={() => {
          setResolveOpen(false);
          void message.success('Đã phân xử tranh chấp thành công. Quyền lợi hoa hồng đã được cập nhật.');
        }}
        okText="Xác nhận phán quyết"
        okButtonProps={{ className: 'rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none' }}
        cancelButtonProps={{ className: 'rounded-xl font-medium' }}
      >
        <Alert
          type="info"
          showIcon
          message="Nguyên tắc phân xử"
          description="Công nhận quyền nhận hoa hồng cho đối tác CTV nộp hồ sơ sớm nhất theo mốc thời gian First-Submission được ghi nhận trong cơ sở dữ liệu."
          className="mb-4 rounded-xl"
        />
        <div className="mb-2">
          <span className="font-semibold text-xs text-slate-700">Ghi chú phán quyết (Bắt buộc cho Audit Trail)</span>
        </div>
        <TextArea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Nhập lý do và cơ sở đối soát..."
          rows={4}
          className="rounded-xl bg-white border-slate-300 text-slate-900"
        />
      </Modal>
    </div>
  );
};

export default AdminDashboard;
