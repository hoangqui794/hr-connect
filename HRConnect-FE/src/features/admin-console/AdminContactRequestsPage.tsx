/**
 * @file AdminContactRequestsPage.tsx
 * @description Contact Requests management page for Platform Admin and Internal HR (SF-05).
 * Designed following Vercel Web Interface Guidelines & Anthropic Frontend Design:
 * - Fluid table layout without horizontal clipping
 * - KPI summary cards for operational visibility
 * - Cohesive fintech color palette for service types and request states
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  PhoneOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  LockOutlined,
  InboxOutlined,
  ThunderboltOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { contactApi } from '@/services/api/contactApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type {
  ContactRequestDto,
  ContactRequestStatus,
  ContactServiceInterest,
  UpdateContactRequestInput,
} from '@/types/api/contact';
import { formatDateTime } from './adminTheme';
import { PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';

const { Text } = Typography;
const { TextArea } = Input;

const STATUS_CONFIG: Record<ContactRequestStatus, { label: string; tone: Tone; badgeClass: string }> = {
  NEW: {
    label: 'Mới tiếp nhận',
    tone: 'warning',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  CONTACTED: {
    label: 'Đã liên hệ',
    tone: 'info',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80',
  },
  CLOSED: {
    label: 'Đã đóng',
    tone: 'neutral',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const SERVICE_INTEREST_LABELS: Record<ContactServiceInterest, { label: string; color: string; badgeStyle: string }> = {
  HEADHUNT_COD: {
    label: 'Tuyển trọn gói (COD)',
    color: 'blue',
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
  },
  CV_SOURCING: {
    label: 'Cung cấp hồ sơ (Sourcing)',
    color: 'cyan',
    badgeStyle: 'bg-cyan-50 text-cyan-700 border-cyan-200/70',
  },
  CV_APPLICATION: {
    label: 'Đăng tin tuyển dụng',
    color: 'green',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  },
  OTHER: {
    label: 'Dịch vụ khác',
    color: 'default',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const PAGE_SIZE = 20;

export const AdminContactRequestsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = (searchParams.get('status') || '') as ContactRequestStatus | '';
  const pageParam = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchTerm, setSearchTerm] = useState('');

  const { user, role } = useAuthStore();
  const isAdmin = user?.roles?.includes('PLATFORM_ADMIN') || role === UserRole.ADMIN;
  const hasManagePermission = isAdmin || (user?.permissions ? user.permissions.includes('contact_request.manage') : true);

  // Selected item for drawer detail / quick update
  const [detailItem, setDetailItem] = useState<ContactRequestDto | null>(null);
  const [statusModalItem, setStatusModalItem] = useState<ContactRequestDto | null>(null);
  const [updateForm] = Form.useForm<{ status: ContactRequestStatus; note?: string }>();

  // Fetch list from backend
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-contact-requests', statusParam, pageParam],
    queryFn: () =>
      contactApi.list({
        status: statusParam || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    enabled: hasManagePermission,
  });

  const highlightParam = searchParams.get('highlight');
  useEffect(() => {
    if (!highlightParam || isLoading || !data?.items) return;
    const q = highlightParam.toLowerCase();
    const match = data.items.find((item) => item.contactRequestId.toLowerCase() === q);
    if (match) {
      setDetailItem(match);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }
  }, [highlightParam, isLoading, data, searchParams, setSearchParams]);

  const isForbidden =
    !hasManagePermission ||
    (isError && ((error as any)?.response?.status === 403 || (error as any)?.status === 403 || String(error).includes('403')));

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContactRequestInput }) =>
      contactApi.updateStatus(id, input),
    onSuccess: (updated) => {
      void message.success('Cập nhật trạng thái yêu cầu liên hệ thành công');
      void queryClient.invalidateQueries({ queryKey: ['admin-contact-requests'] });
      setStatusModalItem(null);
      if (detailItem && detailItem.contactRequestId === updated.contactRequestId) {
        setDetailItem(updated);
      }
    },
    onError: (err) => {
      void message.error(getApiErrorMessage(err, 'Cập nhật thất bại. Vui lòng thử lại.'));
    },
  });

  const handleStatusChangeFilter = (newStatus: ContactRequestStatus | '') => {
    const next = new URLSearchParams(searchParams);
    if (newStatus) {
      next.set('status', newStatus);
    } else {
      next.delete('status');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  const openStatusModal = (item: ContactRequestDto) => {
    setStatusModalItem(item);
    updateForm.setFieldsValue({
      status: item.status,
      note: item.note || '',
    });
  };

  const handleModalSubmit = async (values: { status: ContactRequestStatus; note?: string }) => {
    if (!statusModalItem) return;
    await updateMutation.mutateAsync({
      id: statusModalItem.contactRequestId,
      input: {
        status: values.status,
        note: values.note?.trim() || null,
      },
    });
  };

  // Client-side text filter over current page items
  const filteredItems = useMemo(() => {
    const raw = data?.items || [];
    if (!searchTerm.trim()) return raw;
    const q = searchTerm.toLowerCase();
    return raw.filter(
      (item) =>
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (item.companyName && item.companyName.toLowerCase().includes(q)) ||
        (item.message && item.message.toLowerCase().includes(q))
    );
  }, [data?.items, searchTerm]);

  // Operational KPI stats
  const kpiStats = useMemo(() => {
    const items = data?.items || [];
    const total = data?.totalCount || items.length;
    const newCount = items.filter((i) => i.status === 'NEW').length;
    const contactedCount = items.filter((i) => i.status === 'CONTACTED').length;
    const closedCount = items.filter((i) => i.status === 'CLOSED').length;
    return { total, newCount, contactedCount, closedCount };
  }, [data]);

  // Optimized table columns without overlapping or clipping
  const columns: ColumnsType<ContactRequestDto> = [
    {
      title: 'Họ tên & Doanh nghiệp',
      key: 'fullName',
      render: (_, record) => (
        <PersonCell
          name={record.fullName}
          secondary={record.companyName || 'Khách vãng lai'}
        />
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (val: string) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <MailOutlined className="text-slate-400 text-xs shrink-0" />
          <a href={`mailto:${val}`} className="text-sky-600 hover:text-sky-800 hover:underline truncate max-w-[200px]" title={val}>
            {val}
          </a>
        </div>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      render: (val?: string | null) =>
        val ? (
          <div className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
            <PhoneOutlined className="text-slate-400 text-xs shrink-0" />
            <a href={`tel:${val}`} className="text-slate-800 hover:text-sky-600 font-medium tabular-nums">
              {val}
            </a>
          </div>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Dịch vụ quan tâm',
      dataIndex: 'serviceInterest',
      key: 'serviceInterest',
      render: (val: ContactServiceInterest) => {
        const conf = SERVICE_INTEREST_LABELS[val] || { label: val, color: 'default', badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200' };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-solid ${conf.badgeStyle}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (val: ContactRequestStatus) => {
        const conf = STATUS_CONFIG[val] || { label: val, tone: 'neutral' };
        return <StatusDot tone={conf.tone}>{conf.label}</StatusDot>;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => (
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {formatDateTime(val)}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <Tooltip title="Xem chi tiết nội dung lời nhắn">
            <button
              type="button"
              onClick={() => setDetailItem(record)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-solid border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <EyeOutlined className="text-[13px] text-slate-400" />
              <span>Chi tiết</span>
            </button>
          </Tooltip>
          <Tooltip title="Đổi trạng thái và ghi chú">
            <button
              type="button"
              onClick={() => openStatusModal(record)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-solid border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors cursor-pointer"
            >
              <EditOutlined className="text-[13px] text-sky-600" />
              <span>Xử lý</span>
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const filterOptions: { value: ContactRequestStatus | ''; label: string }[] = [
    { value: '', label: 'Tất cả yêu cầu' },
    { value: 'NEW', label: 'Mới tiếp nhận' },
    { value: 'CONTACTED', label: 'Đã liên hệ' },
    { value: 'CLOSED', label: 'Đã đóng' },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Quản lý liên hệ"
        title="Yêu cầu tư vấn dịch vụ"
        description="Danh sách các yêu cầu liên hệ tư vấn từ khách hàng vãng lai và doanh nghiệp tiềm năng."
        actions={
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
            loading={isFetching}
            className="rounded-lg font-medium"
          >
            Làm mới
          </Button>
        }
      />

      {isForbidden ? (
        <Surface className="p-16 text-center my-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <LockOutlined className="text-3xl" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Bạn chưa được cấp quyền truy cập mục này
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
            Tài khoản của bạn hiện chưa được phân quyền quản lý yêu cầu liên hệ tư vấn. Vui lòng liên hệ Quản trị viên hệ thống để được hỗ trợ cấp quyền.
          </p>
          <div className="mt-6">
            <Button onClick={() => window.history.back()} className="rounded-lg shadow-sm font-medium">
              Quay lại
            </Button>
          </div>
        </Surface>
      ) : (
        <>
          {/* Quick KPI Overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-solid border-slate-200/90 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng yêu cầu</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-xs">
                  <InboxOutlined />
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                {kpiStats.total}
              </div>
            </div>

            <div className="rounded-xl border border-solid border-amber-200 bg-amber-50/50 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Cần phản hồi</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-xs">
                  <ThunderboltOutlined />
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-amber-700 tabular-nums">
                {kpiStats.newCount}
              </div>
            </div>

            <div className="rounded-xl border border-solid border-sky-200 bg-sky-50/50 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-800">Đã liên hệ</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 text-xs">
                  <PhoneOutlined />
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-sky-700 tabular-nums">
                {kpiStats.contactedCount}
              </div>
            </div>

            <div className="rounded-xl border border-solid border-slate-200 bg-slate-50/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã đóng</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-600 text-xs">
                  <CheckSquareOutlined />
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-700 tabular-nums">
                {kpiStats.closedCount}
              </div>
            </div>
          </div>

          {isError && (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(error, 'Không thể tải danh sách yêu cầu tư vấn')}
            />
          )}

          <Surface padded className="space-y-4">
            {/* Filter bar: status pills + quick search */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {filterOptions.map((opt) => {
                  const active = statusParam === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusChangeFilter(opt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-solid ${
                        active
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="w-full sm:w-72">
                <Input
                  allowClear
                  prefix={<SearchOutlined className="text-slate-400" />}
                  placeholder="Tìm theo tên, email, công ty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg h-9"
                />
              </div>
            </div>

            {/* Table without forced horizontal scrolling */}
            <div className="overflow-x-auto">
              <Table<ContactRequestDto>
                columns={columns}
                dataSource={filteredItems}
                rowKey="contactRequestId"
                loading={isLoading}
                pagination={{
                  current: pageParam,
                  pageSize: PAGE_SIZE,
                  total: data?.totalCount || 0,
                  showTotal: (total) => `Tổng cộng ${total} yêu cầu`,
                  onChange: handlePageChange,
                  showSizeChanger: false,
                }}
                className="admin-soft-table w-full [&_.ant-table-thead>tr>th]:!bg-slate-50/80 [&_.ant-table-thead>tr>th]:!text-[12px] [&_.ant-table-thead>tr>th]:!font-bold [&_.ant-table-thead>tr>th]:!text-slate-600"
              />
            </div>
          </Surface>
        </>
      )}

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Chi tiết yêu cầu tư vấn</span>
            {detailItem && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-solid ${SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.badgeStyle || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.label || detailItem.serviceInterest}
              </span>
            )}
          </div>
        }
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        width={560}
        extra={
          detailItem && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const cur = detailItem;
                setDetailItem(null);
                openStatusModal(cur);
              }}
              className="bg-sky-600 hover:bg-sky-700 font-semibold"
            >
              Cập nhật xử lý
            </Button>
          )
        }
      >
        {detailItem && (
          <div className="space-y-6">
            {/* Status overview */}
            <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Trạng thái hiện tại
                  </div>
                  <div className="mt-1">
                    <StatusDot tone={STATUS_CONFIG[detailItem.status]?.tone || 'neutral'}>
                      {STATUS_CONFIG[detailItem.status]?.label || detailItem.status}
                    </StatusDot>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  <div>
                    Ngày gửi: <strong>{formatDateTime(detailItem.createdAt)}</strong>
                  </div>
                  {detailItem.updatedAt && (
                    <div className="mt-0.5">
                      Cập nhật: {formatDateTime(detailItem.updatedAt)}
                    </div>
                  )}
                </div>
              </div>

              {detailItem.handledBy && (
                <div className="mt-3 pt-3 border-0 border-t border-solid border-slate-200 text-xs text-slate-600">
                  Người xử lý: <strong>{detailItem.handledBy}</strong>
                </div>
              )}
            </div>

            {/* Customer Info */}
            <Descriptions title="Thông tin người liên hệ" column={1} bordered size="small" className="rounded-lg overflow-hidden">
              <Descriptions.Item label="Họ và tên">
                <span className="font-semibold text-slate-900">{detailItem.fullName}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <a href={`mailto:${detailItem.email}`} className="text-sky-600 hover:underline">
                  {detailItem.email}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {detailItem.phone ? (
                  <a href={`tel:${detailItem.phone}`} className="text-slate-900 font-medium hover:text-sky-600">
                    {detailItem.phone}
                  </a>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Doanh nghiệp">
                {detailItem.companyName || 'Khách vãng lai'}
              </Descriptions.Item>
              <Descriptions.Item label="Dịch vụ quan tâm">
                {SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.label ||
                  detailItem.serviceInterest}
              </Descriptions.Item>
            </Descriptions>

            {/* Customer Message */}
            <div>
              <div className="mb-2 font-bold text-slate-900 text-sm">Nội dung yêu cầu từ khách:</div>
              <div className="rounded-xl border border-solid border-sky-100 bg-sky-50/50 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                {detailItem.message}
              </div>
            </div>

            {/* Internal Note */}
            <div>
              <div className="mb-2 font-bold text-slate-900 text-sm">Ghi chú nội bộ:</div>
              {detailItem.note ? (
                <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {detailItem.note}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Chưa có ghi chú nội bộ cho yêu cầu này.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Status & Note Update Modal */}
      <Modal
        title={<span className="text-[17px] font-bold text-slate-900">Cập nhật trạng thái xử lý</span>}
        open={Boolean(statusModalItem)}
        onCancel={() => setStatusModalItem(null)}
        footer={null}
        destroyOnHidden
        centered
        className="[&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!p-6"
      >
        {statusModalItem && (
          <Form
            form={updateForm}
            layout="vertical"
            onFinish={handleModalSubmit}
            className="mt-4 space-y-4"
          >
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
              Khách hàng: <strong>{statusModalItem.fullName}</strong> ({statusModalItem.email})
            </div>

            <Form.Item
              name="status"
              label={<span className="font-semibold text-slate-800 text-[13px]">Trạng thái xử lý</span>}
              rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
            >
              <Radio.Group className="flex flex-col gap-2.5">
                <Radio value="NEW" className="!p-2.5 !rounded-lg hover:!bg-amber-50/50 !border !border-solid !border-slate-200 transition-colors">
                  <StatusDot tone="warning">Mới tiếp nhận (Chưa liên hệ khách)</StatusDot>
                </Radio>
                <Radio value="CONTACTED" className="!p-2.5 !rounded-lg hover:!bg-sky-50/50 !border !border-solid !border-slate-200 transition-colors">
                  <StatusDot tone="info">Đã liên hệ (Đang trao đổi / Tư vấn báo giá)</StatusDot>
                </Radio>
                <Radio value="CLOSED" className="!p-2.5 !rounded-lg hover:!bg-slate-100/50 !border !border-solid !border-slate-200 transition-colors">
                  <StatusDot tone="neutral">Đã đóng (Đã chốt hợp đồng hoặc Không có nhu cầu)</StatusDot>
                </Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="note"
              label={<span className="font-semibold text-slate-800 text-[13px]">Ghi chú xử lý nội bộ</span>}
            >
              <TextArea
                rows={4}
                maxLength={1000}
                showCount
                placeholder="Ghi nhận nội dung đã trao đổi với khách, kết quả tư vấn, lý do đóng..."
                className="!rounded-lg"
              />
            </Form.Item>

            <div className="flex justify-end gap-2.5 pt-3 border-0 border-t border-solid border-slate-100">
              <Button onClick={() => setStatusModalItem(null)} className="rounded-lg h-9 px-4 font-medium">
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
                className="bg-sky-600 hover:bg-sky-700 font-semibold rounded-lg h-9 px-5"
              >
                Lưu cập nhật
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default AdminContactRequestsPage;
