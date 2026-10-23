/**
 * @file AdminContactRequestsPage.tsx
 * @description Contact Requests management page for Platform Admin and Internal HR (SF-05).
 * Endpoints used:
 *   - GET /admin/contact-requests?status=&page=&pageSize=
 *   - PATCH /admin/contact-requests/{id} { status, note }
 */

import React, { useMemo, useState } from 'react';
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
  Select,
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
} from '@ant-design/icons';
import { contactApi } from '@/services/api/contactApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type {
  ContactRequestDto,
  ContactRequestStatus,
  ContactServiceInterest,
  UpdateContactRequestInput,
} from '@/types/api/contact';
import { formatDateTime } from './adminTheme';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_CONFIG: Record<ContactRequestStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'Mới tiếp nhận', tone: 'warning' },
  CONTACTED: { label: 'Đã liên hệ', tone: 'info' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
};

const SERVICE_INTEREST_LABELS: Record<ContactServiceInterest, { label: string; color: string }> = {
  HEADHUNT_COD: { label: 'Tuyển trọn gói (COD)', color: 'blue' },
  CV_SOURCING: { label: 'Cung cấp hồ sơ (Sourcing)', color: 'cyan' },
  CV_APPLICATION: { label: 'Đăng tin tuyển dụng', color: 'green' },
  OTHER: { label: 'Dịch vụ khác', color: 'default' },
};

const PAGE_SIZE = 20;

export const AdminContactRequestsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = (searchParams.get('status') || '') as ContactRequestStatus | '';
  const pageParam = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchTerm, setSearchTerm] = useState('');

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
  });

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

  const columns: ColumnsType<ContactRequestDto> = [
    {
      title: 'Họ tên',
      key: 'fullName',
      width: 220,
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
      width: 200,
      render: (val: string) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <MailOutlined className="text-slate-400 text-xs" />
          <a href={`mailto:${val}`} className="text-blue-600 hover:underline">
            {val}
          </a>
        </div>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (val?: string | null) =>
        val ? (
          <div className="flex items-center gap-1.5 text-slate-700">
            <PhoneOutlined className="text-slate-400 text-xs" />
            <a href={`tel:${val}`} className="text-slate-800 hover:text-blue-600 font-medium">
              {val}
            </a>
          </div>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Công ty',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 170,
      render: (val?: string | null) => (
        <span className="font-medium text-slate-800">{val || '—'}</span>
      ),
    },
    {
      title: 'Dịch vụ quan tâm',
      dataIndex: 'serviceInterest',
      key: 'serviceInterest',
      width: 190,
      render: (val: ContactServiceInterest) => {
        const conf = SERVICE_INTEREST_LABELS[val] || { label: val, color: 'default' };
        return <Tag color={conf.color} className="font-semibold">{conf.label}</Tag>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (val: ContactRequestStatus) => {
        const conf = STATUS_CONFIG[val] || { label: val, tone: 'neutral' };
        return <StatusDot tone={conf.tone}>{conf.label}</StatusDot>;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (val: string) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {formatDateTime(val)}
        </span>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (val?: string | null) => (
        <span className="text-xs text-slate-600 italic">
          {val ? val : <Text type="secondary">Chưa có ghi chú</Text>}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết nội dung lời nhắn">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailItem(record)}
            >
              Chi tiết
            </Button>
          </Tooltip>
          <Tooltip title="Đổi trạng thái và ghi chú">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openStatusModal(record)}
              className="font-semibold"
            >
              Xử lý
            </Button>
          </Tooltip>
        </Space>
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
          >
            Làm mới
          </Button>
        }
      />

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
          <FilterPills
            label="Lọc theo trạng thái"
            value={statusParam}
            onChange={handleStatusChangeFilter}
            options={filterOptions}
          />

          <div className="w-full sm:w-72">
            <Input
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo tên, email, công ty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg"
            />
          </div>
        </div>

        {/* Table */}
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
          scroll={{ x: 1200 }}
          className="admin-soft-table"
        />
      </Surface>

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span>Chi tiết yêu cầu tư vấn</span>
            {detailItem && (
              <Tag
                color={
                  SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.color || 'default'
                }
              >
                {SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.label ||
                  detailItem.serviceInterest}
              </Tag>
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
                  <div className="text-xs font-semibold text-slate-500 uppercase">
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
            <Descriptions title="Thông tin người liên hệ" column={1} bordered size="small">
              <Descriptions.Item label="Họ và tên">
                <span className="font-semibold text-slate-900">{detailItem.fullName}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <a href={`mailto:${detailItem.email}`} className="text-blue-600">
                  {detailItem.email}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {detailItem.phone ? (
                  <a href={`tel:${detailItem.phone}`} className="text-slate-900 font-medium">
                    {detailItem.phone}
                  </a>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Doanh nghiệp">
                {detailItem.companyName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Dịch vụ quan tâm">
                {SERVICE_INTEREST_LABELS[detailItem.serviceInterest]?.label ||
                  detailItem.serviceInterest}
              </Descriptions.Item>
            </Descriptions>

            {/* Customer Message */}
            <div>
              <div className="mb-2 font-bold text-slate-900 text-sm">Nội dung yêu cầu từ khách:</div>
              <div className="rounded-xl border border-solid border-blue-100 bg-blue-50/50 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
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
        title="Cập nhật trạng thái xử lý"
        open={Boolean(statusModalItem)}
        onCancel={() => setStatusModalItem(null)}
        footer={null}
        destroyOnHidden
      >
        {statusModalItem && (
          <Form
            form={updateForm}
            layout="vertical"
            onFinish={handleModalSubmit}
            className="mt-4 space-y-4"
          >
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Khách hàng: <strong>{statusModalItem.fullName}</strong> ({statusModalItem.email})
            </div>

            <Form.Item
              name="status"
              label={<span className="font-semibold text-slate-800">Trạng thái</span>}
              rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
            >
              <Radio.Group className="flex flex-col gap-2">
                <Radio value="NEW">
                  <StatusDot tone="warning">Mới tiếp nhận (Chưa liên hệ)</StatusDot>
                </Radio>
                <Radio value="CONTACTED">
                  <StatusDot tone="info">Đã liên hệ (Đang trao đổi / Báo giá)</StatusDot>
                </Radio>
                <Radio value="CLOSED">
                  <StatusDot tone="neutral">Đã đóng (Hoàn tất hoặc Không có nhu cầu)</StatusDot>
                </Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="note"
              label={<span className="font-semibold text-slate-800">Ghi chú xử lý nội bộ</span>}
            >
              <TextArea
                rows={4}
                maxLength={1000}
                showCount
                placeholder="Ghi nhận nội dung đã trao đổi với khách, kết quả tư vấn, lý do đóng..."
                className="rounded-lg"
              />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setStatusModalItem(null)}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
                className="bg-blue-600 font-semibold"
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
