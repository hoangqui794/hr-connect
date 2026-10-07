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
  Select,
  Skeleton,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { adminService, type ApprovalListItemDto } from '@/services/adminService';
import { getApiErrorMessage } from '@/services/apiClient';
import { adminTokens, formatDateTime } from './adminTheme';
import { FilterPills, Initials, PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';

const { Text } = Typography;
const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
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

  const rows: [string, React.ReactNode][] = [
    ['Loại hồ sơ', TYPE_LABEL[item.type]],
    ['Email', data.email],
    ['Điện thoại', data.phone ?? '—'],
    ...(company
      ? ([
          ['Mã số thuế', company.taxCode ?? '—'],
          ['Ngành', company.industry ?? '—'],
          ['Quy mô', company.companySize ?? '—'],
          ['Website', company.website ?? '—'],
          ['Địa chỉ', company.address ?? '—'],
        ] as [string, React.ReactNode][])
      : []),
    ...(affiliate ? ([['Loại Affiliate', affiliate.affiliateType]] as [string, React.ReactNode][]) : []),
    ['Gửi lúc', formatDateTime(data.submittedAt)],
    ...(data.reviewedAt ? ([['Đã xử lý', `${formatDateTime(data.reviewedAt)} · ${data.reviewerName ?? '—'}`]] as [string, React.ReactNode][]) : []),
    ...(data.reviewNote ? ([['Ghi chú xử lý', data.reviewNote]] as [string, React.ReactNode][]) : []),
  ];
  const title = company?.companyName ?? data.displayName ?? item.displayName;

  return (
    <div className="space-y-4">
      <div className="admin-surface flex items-center gap-4 p-5">
        <Initials name={title} size={56} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-900">{title}</div>
          <div className="truncate text-sm text-slate-600">{company ? data.displayName : data.email}</div>
          <div className="mt-1">
            <StatusDot tone={STATUS_LABEL[data.status]?.tone ?? 'neutral'}>{STATUS_LABEL[data.status]?.label ?? data.status}</StatusDot>
          </div>
        </div>
      </div>
      <div className="admin-surface px-5 py-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 border-0 border-t border-solid border-slate-100 py-2.5 first:border-t-0">
            <span className="text-[13px] text-slate-600">{label}</span>
            <span className="break-all text-right text-[13.5px] font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>
      {company?.description && (
        <div className="admin-surface p-5">
          <Text strong className="mb-1 block">Giới thiệu doanh nghiệp</Text>
          <Typography.Paragraph className="mb-0 whitespace-pre-line text-slate-700">{company.description}</Typography.Paragraph>
        </div>
      )}
      <div className="admin-surface p-5">
        <Text strong className="mb-2 block">Dữ liệu đăng ký gốc</Text>
        <PayloadRows raw={company?.submittedPayload ?? affiliate?.submittedData} />
      </div>
    </div>
  );
};

/** Total approvals for a status (pageSize 1, read `total`). */
const useApprovalCount = (status: string, type?: 'AFFILIATE' | 'CLIENT') =>
  useQuery({
    queryKey: ['admin-approvals', 'count', status, type ?? 'ALL'],
    queryFn: async () => (await adminService.getApprovals({ status, type, pageSize: 1 })).data.total,
  });

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
  const countPending = useApprovalCount('UNDER_REVIEW', type);
  const countApproved = useApprovalCount('APPROVED', type);
  const countRejected = useApprovalCount('REJECTED', type);
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
        <div className="min-w-[240px]">
          <PersonCell
            name={r.companyName || r.displayName}
            secondary={`${r.companyName ? `${r.displayName} · ` : ''}${r.email}`}
          />
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      width: 200,
      render: (t: string) => <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700">{TYPE_LABEL[t] ?? t}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (s: string) => <StatusDot tone={STATUS_LABEL[s]?.tone ?? 'neutral'}>{STATUS_LABEL[s]?.label ?? s}</StatusDot>,
    },
    { title: 'Gửi lúc', dataIndex: 'submittedAt', width: 160, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  const data = list.data?.data;

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Phê duyệt tài khoản"
        description="Duyệt đăng ký Cộng tác viên và xác thực Doanh nghiệp trước khi họ dùng nền tảng."
        actions={
          <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <Surface>
        <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-5">
          <FilterPills
            label="Lọc theo trạng thái"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={[
              { value: 'UNDER_REVIEW', label: 'Chờ duyệt', count: countPending.data },
              { value: 'APPROVED', label: 'Đã duyệt', count: countApproved.data },
              { value: 'REJECTED', label: 'Đã từ chối', count: countRejected.data },
            ]}
          />
          <Select
            allowClear
            size="large"
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
          <Input
            allowClear
            size="large"
            defaultValue={search}
            prefix={<SearchOutlined className="text-slate-500" aria-hidden />}
            placeholder="Tên, email, doanh nghiệp... nhấn Enter"
            className="max-w-xs"
            maxLength={100}
            onPressEnter={(e) => setParam('q', e.currentTarget.value.trim() || undefined)}
            onChange={(e) => !e.target.value && search && setParam('q', undefined)}
            aria-label="Tìm hồ sơ"
          />
        </div>

        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được hàng đợi phê duyệt" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<ApprovalListItemDto>
            className="admin-soft-table"
            rowKey="approvalId"
            loading={list.isLoading}
            columns={columns}
            dataSource={data?.items ?? []}
            scroll={{ x: 760 }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {status === 'UNDER_REVIEW' ? 'Không có hồ sơ nào đang chờ duyệt. Mọi đăng ký đã được xử lý.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
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
      </Surface>

      <Drawer
        open={Boolean(selected)}
        width="min(540px, 100vw)"
        onClose={() => setSelected(null)}
        title="Hồ sơ đăng ký"
        destroyOnClose
        styles={{ body: { background: '#F4F6FA', padding: 20 } }}
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
