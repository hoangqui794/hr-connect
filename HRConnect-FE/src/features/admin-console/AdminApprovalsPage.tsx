/**
 * @file AdminApprovalsPage.tsx
 * @description Admin · one approval queue for Affiliate applications and Company verification
 * (GET /admin/approvals). Detail, approve and reject use services/adminService.ts.
 * Filters live in the URL; reject needs a reason (backend: required, max 500).
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
  Segmented,
  Select,
  Skeleton,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminService, type ApprovalListItemDto } from '@/services/adminService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AdminPageHeader, StatusBadge, adminTokens, formatDateTime } from './adminTheme';

const { Text } = Typography;
const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  UNDER_REVIEW: { label: 'Chờ duyệt', tone: 'warning' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
};
const TYPE_LABEL: Record<string, string> = { AFFILIATE: 'Cộng tác viên (Affiliate)', CLIENT: 'Doanh nghiệp' };

/** Submitted payloads are JSON strings; show them as label/value rows, never as raw HTML. */
const PayloadRows: React.FC<{ raw: string | null | undefined }> = ({ raw }) => {
  const entries = useMemo(() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? Object.entries(parsed as Record<string, unknown>) : [];
    } catch {
      return [['Nội dung', raw] as [string, unknown]];
    }
  }, [raw]);
  if (entries.length === 0) return <Text type="secondary">Không có dữ liệu đăng ký kèm theo.</Text>;
  return (
    <Descriptions size="small" column={1} bordered>
      {entries.map(([k, v]) => (
        <Descriptions.Item key={k} label={k}>
          <span className="break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</span>
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
};

const ApprovalDetail: React.FC<{ item: ApprovalListItemDto }> = ({ item }) => {
  const isClient = item.type === 'CLIENT';
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-approval-detail', item.type, item.approvalId],
    queryFn: async () =>
      isClient
        ? (await adminService.getCompanyVerificationDetail(item.approvalId)).data
        : (await adminService.getAffiliateApplicationDetail(item.approvalId)).data,
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (isError || !data) return <Alert type="error" showIcon message={getApiErrorMessage(error, 'Không tải được chi tiết hồ sơ.')} />;

  const company = isClient ? (data as Awaited<ReturnType<typeof adminService.getCompanyVerificationDetail>>['data']) : undefined;
  const affiliate = !isClient ? (data as Awaited<ReturnType<typeof adminService.getAffiliateApplicationDetail>>['data']) : undefined;

  return (
    <div className="space-y-5">
      <Descriptions size="small" column={1} labelStyle={{ width: 150, color: adminTokens.textMuted }}>
        <Descriptions.Item label="Loại hồ sơ">{TYPE_LABEL[item.type]}</Descriptions.Item>
        <Descriptions.Item label="Người đăng ký">{data.displayName ?? item.displayName}</Descriptions.Item>
        <Descriptions.Item label="Email">{data.email}</Descriptions.Item>
        <Descriptions.Item label="Điện thoại">{data.phone ?? '—'}</Descriptions.Item>
        {company && (
          <>
            <Descriptions.Item label="Doanh nghiệp">{company.companyName}</Descriptions.Item>
            <Descriptions.Item label="Mã số thuế">{company.taxCode ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngành">{company.industry ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Quy mô">{company.companySize ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Website">{company.website ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">{company.address ?? '—'}</Descriptions.Item>
          </>
        )}
        {affiliate && <Descriptions.Item label="Loại Affiliate">{affiliate.affiliateType}</Descriptions.Item>}
        <Descriptions.Item label="Gửi lúc">{formatDateTime(data.submittedAt)}</Descriptions.Item>
        {data.reviewedAt && (
          <Descriptions.Item label="Đã xử lý">
            {formatDateTime(data.reviewedAt)} · {data.reviewerName ?? '—'}
          </Descriptions.Item>
        )}
        {data.reviewNote && <Descriptions.Item label="Ghi chú xử lý">{data.reviewNote}</Descriptions.Item>}
      </Descriptions>
      {company?.description && (
        <section>
          <Text strong className="mb-1 block">Giới thiệu doanh nghiệp</Text>
          <Typography.Paragraph className="whitespace-pre-line mb-0">{company.description}</Typography.Paragraph>
        </section>
      )}
      <section>
        <Text strong className="mb-2 block">Dữ liệu đăng ký gốc</Text>
        <PayloadRows raw={company?.submittedPayload ?? affiliate?.submittedData} />
      </section>
    </div>
  );
};

export const AdminApprovalsPage: React.FC<{ presetType?: 'AFFILIATE' | 'CLIENT' }> = ({ presetType }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<ApprovalListItemDto | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [form] = Form.useForm<{ text?: string }>();

  const status = searchParams.get('status') ?? 'UNDER_REVIEW';
  const type = (searchParams.get('type') as 'AFFILIATE' | 'CLIENT' | null) ?? presetType;
  const search = searchParams.get('q') ?? undefined;
  const page = Number(searchParams.get('page')) || 1;

  const params = { status, type, search, page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: ['admin-approvals', params],
    queryFn: () => adminService.getApprovals(params),
    placeholderData: (prev) => prev,
  });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const act = useMutation({
    mutationFn: async ({ kind, item, text }: { kind: 'approve' | 'reject'; item: ApprovalListItemDto; text?: string }) => {
      if (item.type === 'CLIENT') {
        return kind === 'approve'
          ? adminService.approveCompanyVerification(item.approvalId, text || undefined)
          : adminService.rejectCompanyVerification(item.approvalId, text ?? '');
      }
      return kind === 'approve'
        ? adminService.approveAffiliate(item.approvalId, text || undefined)
        : adminService.rejectAffiliate(item.approvalId, text ?? '');
    },
    onSuccess: (res, vars) => {
      message.success(res.message || (vars.kind === 'approve' ? 'Đã duyệt hồ sơ.' : 'Đã từ chối hồ sơ.'));
      setDecision(null);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const isPending = (s: string) => s === 'UNDER_REVIEW' || s === 'PENDING';

  const columns: ColumnsType<ApprovalListItemDto> = [
    {
      title: 'Người đăng ký',
      key: 'who',
      render: (_, r) => (
        <div className="min-w-[220px]">
          <div className="font-semibold text-slate-900">{r.companyName || r.displayName}</div>
          <div className="text-xs text-slate-600">
            {r.companyName ? `${r.displayName} · ` : ''}
            {r.email}
          </div>
        </div>
      ),
    },
    { title: 'Loại', dataIndex: 'type', width: 190, render: (t: string) => TYPE_LABEL[t] ?? t },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (s: string) => <StatusBadge tone={STATUS_LABEL[s]?.tone ?? 'neutral'}>{STATUS_LABEL[s]?.label ?? s}</StatusBadge>,
    },
    { title: 'Gửi lúc', dataIndex: 'submittedAt', width: 160, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  const data = list.data?.data;

  return (
    <div>
      <AdminPageHeader
        title="Phê duyệt tài khoản"
        description="Duyệt đăng ký Cộng tác viên và xác thực Doanh nghiệp trước khi họ dùng nền tảng."
        actions={
          <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <section className="rounded-xl border border-solid border-slate-200 bg-white">
        <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 border-b border-solid border-slate-100 p-3">
          <Segmented
            value={status}
            onChange={(v) => setParam('status', String(v))}
            options={[
              { value: 'UNDER_REVIEW', label: 'Chờ duyệt' },
              { value: 'APPROVED', label: 'Đã duyệt' },
              { value: 'REJECTED', label: 'Đã từ chối' },
            ]}
            aria-label="Lọc theo trạng thái"
          />
          <Select
            allowClear
            value={type}
            placeholder="Mọi loại hồ sơ"
            className="w-56"
            onChange={(v) => setParam('type', v)}
            options={[
              { value: 'CLIENT', label: TYPE_LABEL.CLIENT },
              { value: 'AFFILIATE', label: TYPE_LABEL.AFFILIATE },
            ]}
            aria-label="Lọc theo loại hồ sơ"
          />
          <Input.Search
            allowClear
            defaultValue={search}
            placeholder="Tên, email, doanh nghiệp..."
            className="w-72"
            maxLength={100}
            onSearch={(v) => setParam('q', v.trim() || undefined)}
            aria-label="Tìm hồ sơ"
          />
        </div>

        {list.isError ? (
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được hàng đợi phê duyệt" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<ApprovalListItemDto>
            rowKey="approvalId"
            loading={list.isLoading}
            columns={columns}
            dataSource={data?.items ?? []}
            scroll={{ x: 760 }}
            locale={{ emptyText: status === 'UNDER_REVIEW' ? 'Không có hồ sơ nào đang chờ duyệt.' : 'Không có hồ sơ phù hợp bộ lọc.' }}
            onRow={(r) => ({
              onClick: () => setSelected(r),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setSelected(r);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Mở hồ sơ ${r.companyName || r.displayName}`,
            })}
            pagination={{
              current: data?.page ?? page,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => setParam('page', String(p)),
            }}
          />
        )}
      </section>

      <Drawer
        open={Boolean(selected)}
        width={560}
        onClose={() => setSelected(null)}
        title={selected ? selected.companyName || selected.displayName : ''}
        destroyOnClose
        extra={
          selected &&
          isPending(selected.status) && (
            <div className="flex gap-2">
              <Button danger icon={<CloseOutlined />} onClick={() => setDecision('reject')}>
                Từ chối
              </Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => setDecision('approve')}>
                Duyệt
              </Button>
            </div>
          )
        }
      >
        {selected && <ApprovalDetail item={selected} />}
      </Drawer>

      <Modal
        open={Boolean(decision)}
        title={decision === 'approve' ? 'Duyệt hồ sơ này?' : 'Từ chối hồ sơ này?'}
        okText={decision === 'approve' ? 'Duyệt' : 'Từ chối'}
        cancelText="Hủy"
        okButtonProps={{ danger: decision === 'reject', loading: act.isPending }}
        onCancel={() => setDecision(null)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Typography.Paragraph style={{ color: adminTokens.textMuted }}>
          {decision === 'approve'
            ? 'Tài khoản sẽ được kích hoạt và người đăng ký nhận email thông báo.'
            : 'Người đăng ký sẽ thấy lý do này. Viết rõ cần bổ sung gì.'}
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={({ text }) => selected && decision && act.mutate({ kind: decision, item: selected, text: text?.trim() })}
        >
          <Form.Item
            name="text"
            label={decision === 'approve' ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối'}
            rules={
              decision === 'reject'
                ? [
                    { required: true, whitespace: true, message: 'Nhập lý do từ chối.' },
                    { max: 500, message: 'Tối đa 500 ký tự.' },
                  ]
                : [{ max: 500, message: 'Tối đa 500 ký tự.' }]
            }
          >
            <Input.TextArea rows={4} showCount maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminApprovalsPage;
