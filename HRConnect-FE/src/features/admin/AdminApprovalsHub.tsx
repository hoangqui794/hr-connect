import React, { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Modal, Input, Row, Col,
  Tabs, message, Drawer, Descriptions, Alert, Space,
  Select, Tooltip, Badge, Spin, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  ReloadOutlined, ClockCircleOutlined, SearchOutlined,
  ApartmentOutlined, BankOutlined, SafetyCertificateOutlined,
  UserOutlined, MailOutlined, PhoneOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { FintechMetricCard } from '@/components/common/FintechMetricCard';
import type {
  ApprovalListItemDto,
  ApprovalType,
  ApprovalStatus,
} from '@/types/admin';
import {
  useAdminApprovals,
  useAffiliateApplicationDetail,
  useCompanyVerificationDetail,
  useApproveAffiliate,
  useRejectAffiliate,
  useApproveCompany,
  useRejectCompany,
} from '@/services/queries/useAdminApprovals';

const { TextArea } = Input;
const { Text, Title } = Typography;

export const AdminApprovalsHub: React.FC = () => {
  // ─── Query Params State ───────────────────────────────────────────────────
  const [selectedTypeTab, setSelectedTypeTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // React Query hook
  const {
    data: approvalsResponse,
    isLoading,
    isFetching,
    refetch,
  } = useAdminApprovals({
    type: selectedTypeTab === 'ALL' ? undefined : (selectedTypeTab as ApprovalType),
    status: statusFilter === 'ALL' ? undefined : (statusFilter as ApprovalStatus),
    search: searchTerm || undefined,
    page,
    pageSize,
    sortBy: 'submittedAt',
    sortDirection: 'desc',
  });

  const approvalList = approvalsResponse?.data?.items || [];
  const totalItems = approvalsResponse?.data?.total || 0;

  // KPI counts (all pending, pending affiliate, pending client)
  const { data: allApprovalsResponse } = useAdminApprovals({ page: 1, pageSize: 100 });
  const allItems = allApprovalsResponse?.data?.items || [];

  const pendingAffiliateCount = useMemo(
    () => allItems.filter((i) => i.type === 'AFFILIATE' && i.status === 'PENDING').length,
    [allItems]
  );
  const pendingClientCount = useMemo(
    () => allItems.filter((i) => i.type === 'CLIENT' && i.status === 'PENDING').length,
    [allItems]
  );
  const totalPendingCount = pendingAffiliateCount + pendingClientCount;
  const totalApprovedCount = useMemo(
    () => allItems.filter((i) => i.status === 'APPROVED').length,
    [allItems]
  );

  // ─── Drawer & Action States ───────────────────────────────────────────────
  const [selectedRecord, setSelectedRecord] = useState<ApprovalListItemDto | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Approve Modal state
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [targetToApprove, setTargetToApprove] = useState<ApprovalListItemDto | null>(null);
  const [approveNote, setApproveNote] = useState('');

  // Reject Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [targetToReject, setTargetToReject] = useState<ApprovalListItemDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Mutations
  const approveAffiliateMutation = useApproveAffiliate();
  const rejectAffiliateMutation = useRejectAffiliate();
  const approveCompanyMutation = useApproveCompany();
  const rejectCompanyMutation = useRejectCompany();

  const isActionPending =
    approveAffiliateMutation.isPending ||
    rejectAffiliateMutation.isPending ||
    approveCompanyMutation.isPending ||
    rejectCompanyMutation.isPending;

  // Detail Queries
  const isAffiliateSelected = selectedRecord?.type === 'AFFILIATE';
  const isClientSelected = selectedRecord?.type === 'CLIENT';

  const {
    data: affDetailResponse,
    isLoading: isAffDetailLoading,
  } = useAffiliateApplicationDetail(
    isDetailDrawerOpen && isAffiliateSelected ? selectedRecord.approvalId : ''
  );

  const {
    data: cliDetailResponse,
    isLoading: isCliDetailLoading,
  } = useCompanyVerificationDetail(
    isDetailDrawerOpen && isClientSelected ? selectedRecord.approvalId : ''
  );

  const affDetail = affDetailResponse?.data;
  const cliDetail = cliDetailResponse?.data;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenDetail = (record: ApprovalListItemDto) => {
    setSelectedRecord(record);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenApprove = (record: ApprovalListItemDto) => {
    setTargetToApprove(record);
    setApproveNote('');
    setIsApproveModalOpen(true);
  };

  const handleOpenReject = (record: ApprovalListItemDto) => {
    setTargetToReject(record);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!targetToApprove) return;
    try {
      if (targetToApprove.type === 'AFFILIATE') {
        const res = await approveAffiliateMutation.mutateAsync({
          id: targetToApprove.approvalId,
          body: { note: approveNote.trim() || undefined },
        });
        message.success(res.message || 'Phê duyệt đối tác Affiliate Recruiter thành công!');
      } else {
        const res = await approveCompanyMutation.mutateAsync({
          id: targetToApprove.approvalId,
          body: { note: approveNote.trim() || undefined },
        });
        message.success(res.message || 'Phê duyệt xác thực Doanh nghiệp thành công!');
      }
      setIsApproveModalOpen(false);
      setTargetToApprove(null);
      if (selectedRecord?.approvalId === targetToApprove.approvalId) {
        setIsDetailDrawerOpen(false);
      }
      void refetch();
    } catch (err: any) {
      message.error(err.message || 'Thao tác phê duyệt thất bại.');
    }
  };

  const handleConfirmReject = async () => {
    if (!targetToReject) return;
    if (!rejectReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    try {
      if (targetToReject.type === 'AFFILIATE') {
        const res = await rejectAffiliateMutation.mutateAsync({
          id: targetToReject.approvalId,
          body: { reason: rejectReason.trim() },
        });
        message.success(res.message || 'Đã từ chối đơn đăng ký Affiliate.');
      } else {
        const res = await rejectCompanyMutation.mutateAsync({
          id: targetToReject.approvalId,
          body: { reason: rejectReason.trim() },
        });
        message.success(res.message || 'Đã từ chối xác thực Doanh nghiệp.');
      }
      setIsRejectModalOpen(false);
      setTargetToReject(null);
      if (selectedRecord?.approvalId === targetToReject.approvalId) {
        setIsDetailDrawerOpen(false);
      }
      void refetch();
    } catch (err: any) {
      message.error(err.message || 'Thao tác từ chối thất bại.');
    }
  };

  const handleSearchSubmit = () => {
    setSearchTerm(searchInput.trim());
    setPage(1);
  };

  // ─── Table Columns ────────────────────────────────────────────────────────
  const columns: ColumnsType<ApprovalListItemDto> = [
    {
      title: 'LOẠI YÊU CẦU',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (type: string) => {
        if (type === 'AFFILIATE') {
          return (
            <Tag
              icon={<ApartmentOutlined />}
              className="px-2.5 py-0.5 rounded-full font-medium text-xs border border-indigo-200 bg-indigo-50 text-indigo-700"
            >
              Affiliate Recruiter
            </Tag>
          );
        }
        return (
          <Tag
            icon={<BankOutlined />}
            className="px-2.5 py-0.5 rounded-full font-medium text-xs border border-blue-200 bg-blue-50 text-blue-700"
          >
            Doanh nghiệp (Client)
          </Tag>
        );
      },
    },
    {
      title: 'ĐỐI TÁC / ĐẠI DIỆN',
      key: 'partner',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
            {record.displayName || 'Chưa cập nhật'}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
            <MailOutlined className="text-slate-400" />
            {record.email || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'DOANH NGHIỆP LIÊN KẾT',
      dataIndex: 'companyName',
      key: 'companyName',
      render: (companyName, record) => (
        <span className="text-sm text-slate-700 font-medium">
          {companyName ? (
            companyName
          ) : record.type === 'AFFILIATE' ? (
            <span className="text-xs text-slate-400 italic">Cá nhân tự do (Headhunter)</span>
          ) : (
            <span className="text-xs text-slate-400 italic">Đang cập nhật</span>
          )}
        </span>
      ),
    },
    {
      title: 'NGÀY GỬI YÊU CẦU',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 170,
      render: (dateStr: string) => (
        <span className="text-xs text-slate-600 font-mono">
          {dayjs(dateStr).isValid() ? dayjs(dateStr).format('DD/MM/YYYY HH:mm') : dateStr}
        </span>
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        if (status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Chờ phê duyệt
            </span>
          );
        }
        if (status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircleOutlined className="text-emerald-600" />
              Đã phê duyệt
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <CloseCircleOutlined className="text-rose-600" />
            Đã từ chối
          </span>
        );
      },
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      width: 220,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết hồ sơ">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetail(record)}
              className="text-slate-600 hover:text-blue-600 border-slate-200 rounded-lg text-xs"
            >
              Chi tiết
            </Button>
          </Tooltip>

          {record.status === 'PENDING' && (
            <>
              <Tooltip title="Phê duyệt yêu cầu">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleOpenApprove(record)}
                  className="bg-emerald-600 hover:bg-emerald-700 border-none rounded-lg text-xs font-semibold text-white"
                >
                  Duyệt
                </Button>
              </Tooltip>

              <Tooltip title="Từ chối yêu cầu">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleOpenReject(record)}
                  className="rounded-lg text-xs font-semibold"
                >
                  Từ chối
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Trung Tâm Phê Duyệt Tập Trung (Admin Approvals Hub)"
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            ⚖️ Verification Authority
          </span>
        }
        subtitle="Tiếp nhận, đối soát pháp lý và xử lý phê duyệt hồ sơ đối tác CTV (Affiliate Recruiter) và yêu cầu xác thực Doanh nghiệp (Client Company Verification)."
        actions={
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
            className="rounded-xl border-slate-300 font-medium text-slate-700 hover:text-blue-600 text-xs"
          >
            Làm mới dữ liệu
          </Button>
        }
      />

      {/* ─── KPI Metrics ──────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Yêu cầu chờ xử lý"
            value={totalPendingCount}
            subLabel="Tổng hợp Affiliate & Client"
            statusBadge="Cần thẩm định"
            statusType="warranty"
            icon={<ClockCircleOutlined />}
            iconColor="#d97706"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Đơn Affiliate chờ duyệt"
            value={pendingAffiliateCount}
            subLabel="Hồ sơ CTV & Headhunter"
            statusBadge="KYC Đối tác"
            statusType="info"
            icon={<ApartmentOutlined />}
            iconColor="#6366f1"
            onClick={() => {
              setSelectedTypeTab('AFFILIATE');
              setStatusFilter('PENDING');
            }}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Doanh nghiệp chờ xác thực"
            value={pendingClientCount}
            subLabel="Đối soát MST & Pháp nhân"
            statusBadge="Client Verification"
            statusType="paid"
            icon={<BankOutlined />}
            iconColor="#2563eb"
            onClick={() => {
              setSelectedTypeTab('CLIENT');
              setStatusFilter('PENDING');
            }}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <FintechMetricCard
            label="Hồ sơ đã phê duyệt"
            value={totalApprovedCount}
            subLabel="Đối tác hoạt động chính thức"
            statusBadge="Đạt tiêu chuẩn"
            statusType="eligible"
            icon={<CheckCircleOutlined />}
            iconColor="#10b981"
            onClick={() => setStatusFilter('APPROVED')}
          />
        </Col>
      </Row>

      {/* ─── Filter Tabs & Control Bar ────────────────────────────────────── */}
      <div className="b2b-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200/80">
          <Tabs
            activeKey={selectedTypeTab}
            onChange={(key) => {
              setSelectedTypeTab(key);
              setPage(1);
            }}
            className="b2b-tabs m-0"
            items={[
              {
                key: 'ALL',
                label: (
                  <span className="font-semibold text-sm">
                    Tất cả yêu cầu <Badge count={totalPendingCount} overflowCount={99} className="ml-1" />
                  </span>
                ),
              },
              {
                key: 'AFFILIATE',
                label: (
                  <span className="font-semibold text-sm">
                    Cộng tác viên (Affiliate){' '}
                    <Badge count={pendingAffiliateCount} overflowCount={99} className="ml-1" />
                  </span>
                ),
              },
              {
                key: 'CLIENT',
                label: (
                  <span className="font-semibold text-sm">
                    Doanh nghiệp (Client){' '}
                    <Badge count={pendingClientCount} overflowCount={99} className="ml-1" />
                  </span>
                ),
              },
            ]}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'PENDING', label: '⏳ Chờ phê duyệt' },
                { value: 'APPROVED', label: '✅ Đã phê duyệt' },
                { value: 'REJECTED', label: '❌ Đã từ chối' },
              ]}
              className="rounded-lg text-xs"
            />

            <Input
              placeholder="Tìm theo tên, email, công ty..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearchSubmit}
              style={{ width: 260 }}
              allowClear
              onClear={() => {
                setSearchInput('');
                setSearchTerm('');
              }}
              className="rounded-lg text-xs"
            />

            <Button
              type="primary"
              onClick={handleSearchSubmit}
              className="rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700"
            >
              Lọc
            </Button>
          </div>
        </div>

        {/* ─── Main Approvals Table ────────────────────────────────────────── */}
        <Table<ApprovalListItemDto>
          rowKey="approvalId"
          columns={columns}
          dataSource={approvalList}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            onChange: (p) => setPage(p),
            showTotal: (total) => `Tổng cộng ${total} yêu cầu`,
            size: 'small',
          }}
          className="b2b-table"
        />
      </div>

      {/* ─── Detail Drawer (Affiliate or Client) ───────────────────────────── */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <SafetyCertificateOutlined className="text-blue-600" />
            <span className="font-bold text-slate-900">
              {selectedRecord?.type === 'AFFILIATE'
                ? 'Hồ Sơ Đăng Ký Đối Tác Tuyển Dụng (Affiliate Recruiter)'
                : 'Hồ Sơ Xác Thực Doanh Nghiệp Tuyển Dụng (Client Verification)'}
            </span>
          </div>
        }
        placement="right"
        width={680}
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        footer={
          selectedRecord?.status === 'PENDING' ? (
            <div className="flex items-center justify-between py-2">
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenReject(selectedRecord)}
                disabled={isActionPending}
                className="font-semibold rounded-lg"
              >
                Từ chối hồ sơ
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenApprove(selectedRecord)}
                loading={isActionPending}
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-lg text-white border-none"
              >
                Phê duyệt chính thức
              </Button>
            </div>
          ) : (
            <div className="text-right py-2">
              <Button onClick={() => setIsDetailDrawerOpen(false)} className="rounded-lg">
                Đóng
              </Button>
            </div>
          )
        }
      >
        {isAffDetailLoading || isCliDetailLoading ? (
          <div className="py-20 text-center">
            <Spin size="large" tip="Đang tải dữ liệu chi tiết..." />
          </div>
        ) : selectedRecord?.type === 'AFFILIATE' && affDetail ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 m-0">
                  {affDetail.displayName || 'Chưa có tên hiển thị'}
                </h4>
                <p className="text-xs text-indigo-700 m-0 font-medium">
                  {affDetail.affiliateType === 'COMPANY'
                    ? 'Doanh nghiệp Headhunting / Công ty Tuyển dụng'
                    : 'Chuyên gia Tuyển dụng Tự do (Independent Headhunter)'}
                </p>
              </div>
              <div>
                {affDetail.status === 'PENDING' && (
                  <Tag color="warning" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Chờ phê duyệt
                  </Tag>
                )}
                {affDetail.status === 'APPROVED' && (
                  <Tag color="success" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Đã phê duyệt
                  </Tag>
                )}
                {affDetail.status === 'REJECTED' && (
                  <Tag color="error" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Đã từ chối
                  </Tag>
                )}
              </div>
            </div>

            <Descriptions title="Thông tin cá nhân & Liên hệ" bordered column={1} size="small">
              <Descriptions.Item label="Email tài khoản">
                <span className="font-mono text-slate-800">{affDetail.email || 'N/A'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại liên lạc">
                <span className="font-mono text-slate-800">{affDetail.phone || 'N/A'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Người đại diện / Liên hệ">
                {affDetail.contactPerson || affDetail.displayName || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ hoạt động">
                {affDetail.address || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Thông tin Thuế & Định danh (KYC)">
                <span className="font-mono font-semibold text-blue-700">
                  {affDetail.taxInformation || 'Chưa cung cấp MST'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian gửi đơn">
                <span className="font-mono text-xs">
                  {dayjs(affDetail.submittedAt).format('DD/MM/YYYY HH:mm:ss')}
                </span>
              </Descriptions.Item>
            </Descriptions>

            <div className="space-y-2">
              <span className="font-bold text-sm text-slate-900">Dữ liệu & Chứng từ kèm theo:</span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                {affDetail.submittedData || 'Không có ghi chú hoặc dữ liệu nộp bổ sung.'}
              </div>
            </div>

            {affDetail.status !== 'PENDING' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900">Lịch sử thẩm định:</div>
                <div className="text-xs text-slate-600">
                  Thực hiện bởi: <strong>{affDetail.reviewerName || 'Platform Admin'}</strong> lúc{' '}
                  {affDetail.reviewedAt ? dayjs(affDetail.reviewedAt).format('DD/MM/YYYY HH:mm') : 'N/A'}
                </div>
                {affDetail.reviewNote && (
                  <div className="text-xs text-slate-700 mt-2 p-2 bg-white rounded border border-slate-200">
                    Ghi chú: {affDetail.reviewNote}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : selectedRecord?.type === 'CLIENT' && cliDetail ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 m-0">
                  {cliDetail.companyName || 'Doanh nghiệp tuyển dụng'}
                </h4>
                <p className="text-xs text-blue-700 m-0 font-medium font-mono">
                  MST: {cliDetail.taxCode || 'Chưa có MST'}
                </p>
              </div>
              <div>
                {cliDetail.status === 'PENDING' && (
                  <Tag color="warning" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Chờ xác thực
                  </Tag>
                )}
                {cliDetail.status === 'APPROVED' && (
                  <Tag color="success" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Đã xác thực
                  </Tag>
                )}
                {cliDetail.status === 'REJECTED' && (
                  <Tag color="error" className="px-3 py-1 font-semibold rounded-full text-xs">
                    Bị từ chối
                  </Tag>
                )}
              </div>
            </div>

            <Descriptions title="Hồ sơ Pháp lý & Doanh nghiệp" bordered column={1} size="small">
              <Descriptions.Item label="Tên công ty">
                <span className="font-bold text-slate-900">{cliDetail.companyName}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế Doanh nghiệp (MST)">
                <span className="font-mono font-bold text-blue-700">{cliDetail.taxCode || 'N/A'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Ngành nghề hoạt động">
                {cliDetail.industry || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Quy mô công ty">
                {cliDetail.companySize || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Website chính thức">
                {cliDetail.website ? (
                  <a href={cliDetail.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {cliDetail.website}
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ trụ sở">
                {cliDetail.address || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Người đại diện / Đăng ký">
                <span className="font-medium">{cliDetail.displayName || 'N/A'}</span> ({cliDetail.email || 'N/A'} - {cliDetail.phone || 'N/A'})
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian gửi yêu cầu">
                <span className="font-mono text-xs">
                  {dayjs(cliDetail.submittedAt).format('DD/MM/YYYY HH:mm:ss')}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {cliDetail.description && (
              <div className="space-y-1.5">
                <span className="font-bold text-sm text-slate-900">Giới thiệu về doanh nghiệp:</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed font-sans">
                  {cliDetail.description}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="font-bold text-sm text-slate-900">Chứng từ pháp lý đính kèm:</span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono whitespace-pre-wrap">
                {cliDetail.submittedPayload || 'Không có payload chứng từ đính kèm.'}
              </div>
            </div>

            {cliDetail.status !== 'PENDING' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900">Lịch sử thẩm định:</div>
                <div className="text-xs text-slate-600">
                  Thực hiện bởi: <strong>{cliDetail.reviewerName || 'Platform Admin'}</strong> lúc{' '}
                  {cliDetail.reviewedAt ? dayjs(cliDetail.reviewedAt).format('DD/MM/YYYY HH:mm') : 'N/A'}
                </div>
                {cliDetail.reviewNote && (
                  <div className="text-xs text-slate-700 mt-2 p-2 bg-white rounded border border-slate-200">
                    Ghi chú: {cliDetail.reviewNote}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Alert message="Không tìm thấy thông tin chi tiết hồ sơ." type="warning" showIcon />
        )}
      </Drawer>

      {/* ─── Modal Approve ────────────────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircleOutlined />
            <span>Xác Nhận Phê Duyệt Hồ Sơ</span>
          </div>
        }
        open={isApproveModalOpen}
        onCancel={() => {
          if (!isActionPending) {
            setIsApproveModalOpen(false);
            setTargetToApprove(null);
          }
        }}
        onOk={handleConfirmApprove}
        confirmLoading={isActionPending}
        okText="Xác nhận phê duyệt"
        cancelText="Hủy bỏ"
        okButtonProps={{
          className: 'bg-emerald-600 hover:bg-emerald-700 border-none font-semibold text-white',
        }}
      >
        <div className="space-y-4 py-2">
          <Alert
            type="info"
            showIcon
            message={
              targetToApprove?.type === 'AFFILIATE'
                ? `Phê duyệt đối tác CTV: ${targetToApprove?.displayName}`
                : `Xác thực doanh nghiệp: ${targetToApprove?.companyName || targetToApprove?.displayName}`
            }
            description="Sau khi phê duyệt, đối tác sẽ được cấp quyền truy cập đầy đủ các phân hệ làm việc trên sàn HRConnect."
          />

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Ghi chú phê duyệt (Không bắt buộc):
            </label>
            <TextArea
              rows={3}
              placeholder="VD: Đã kiểm tra đối soát MST hợp lệ trên cổng thông tin Quốc gia."
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* ─── Modal Reject ─────────────────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-700 font-bold">
            <CloseCircleOutlined />
            <span>Từ Chối Hồ Sơ Yêu Cầu</span>
          </div>
        }
        open={isRejectModalOpen}
        onCancel={() => {
          if (!isActionPending) {
            setIsRejectModalOpen(false);
            setTargetToReject(null);
          }
        }}
        onOk={handleConfirmReject}
        confirmLoading={isActionPending}
        okText="Xác nhận từ chối"
        cancelText="Hủy bỏ"
        okButtonProps={{
          danger: true,
          disabled: !rejectReason.trim() || isActionPending,
          className: 'font-semibold',
        }}
      >
        <div className="space-y-4 py-2">
          <Alert
            type="error"
            showIcon
            message="Yêu cầu nhập lý do từ chối"
            description="Lý do từ chối là BẮT BUỘC để hệ thống gửi thông báo phản hồi giúp đối tác hiểu rõ nguyên nhân và khắc phục hồ sơ."
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-900">
                Lý do từ chối <span className="text-rose-500">*</span>:
              </label>
              <span className="text-[11px] text-slate-400">Bắt buộc</span>
            </div>
            <TextArea
              rows={4}
              placeholder="VD: Mã số thuế không tồn tại, địa chỉ đăng ký kinh doanh không trùng khớp với giấy phép..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rounded-lg text-xs"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminApprovalsHub;
