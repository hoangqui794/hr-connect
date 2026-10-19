/**
 * @file AdminDisputesPage.tsx
 * @description Platform Admin management for SF-04 Duplicate & Attribution Disputes.
 */

import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Drawer,
  Form,
  Input,
  Radio,
  Skeleton,
  Alert,
  App as AntApp,
} from 'antd';
import {
  SolutionOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disputeApi } from '@/services/api/disputeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import type { AdminDisputeListItemDto, AdminDisputeDetailDto } from '@/types/api/dispute';

const fmt = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

const STATUS_CONFIG: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  OPEN: { label: 'Chờ xử lý', tone: 'warning' },
  UPHELD: { label: 'Đã chấp thuận', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  DUPLICATE_SUBMISSION: { label: 'Trùng ứng viên', color: 'orange' },
  ATTRIBUTION: { label: 'Tranh chấp nguồn', color: 'blue' },
};

export const AdminDisputesPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [resolveForm] = Form.useForm();

  // Fetch disputes list
  const listQuery = useQuery({
    queryKey: ['admin-disputes', statusFilter, typeFilter],
    queryFn: () =>
      disputeApi.getAdminDisputes({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        pageSize: 50,
      }),
  });

  // Fetch dispute detail
  const detailQuery = useQuery({
    queryKey: ['admin-dispute-detail', selectedDisputeId],
    queryFn: () => disputeApi.getAdminDisputeDetail(selectedDisputeId!),
    enabled: Boolean(selectedDisputeId),
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (values: { decision: 'UPHELD' | 'REJECTED'; resolution: string }) =>
      disputeApi.resolveDispute(selectedDisputeId!, values),
    onSuccess: (data) => {
      message.success('Đã giải quyết khiếu nại thành công.');
      resolveForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-detail', selectedDisputeId] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể xử lý khiếu nại.')),
  });

  const d = detailQuery.data;

  const columns: ColumnsType<AdminDisputeListItemDto> = [
    {
      title: 'Ứng viên & Tin tuyển dụng',
      key: 'cand',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.candidateName || 'Ứng viên'}</div>
          <div className="text-xs text-slate-500">{r.jobTitle || 'Tin tuyển dụng'}</div>
        </div>
      ),
    },
    {
      title: 'Loại khiếu nại',
      dataIndex: 'disputeType',
      width: 170,
      render: (v: string) => {
        const cfg = TYPE_CONFIG[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'CTV khiếu nại',
      dataIndex: 'raisedByAffiliateName',
      width: 180,
      render: (v: string | null) => v || 'Cộng tác viên',
    },
    {
      title: 'Thời gian tạo',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: string) => <span className="text-xs tabular-nums text-slate-600">{fmt(v)}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      render: (v: string) => {
        const cfg = STATUS_CONFIG[v] || { label: v, tone: 'warning' };
        return <StatusDot tone={cfg.tone}>{cfg.label}</StatusDot>;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedDisputeId(r.disputeId)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Xử lý khiếu nại (SF-04)"
        description="Giải quyết khiếu nại về hồ sơ bị chặn trùng lặp hoặc tranh chấp quyền ghi nhận nguồn ứng viên giữa các Cộng tác viên."
      />

      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-4 border-0 border-b border-solid border-slate-100 p-5">
          <div className="flex flex-wrap gap-4">
            <FilterPills
              label="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                { value: 'OPEN', label: 'Chờ xử lý' },
                { value: 'UPHELD', label: 'Đã chấp thuận' },
                { value: 'REJECTED', label: 'Đã từ chối' },
              ]}
            />
            <FilterPills
              label="Loại khiếu nại"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                { value: 'DUPLICATE_SUBMISSION', label: 'Trùng ứng viên' },
                { value: 'ATTRIBUTION', label: 'Tranh chấp nguồn' },
              ]}
            />
          </div>
        </div>

        <Table
          className="admin-soft-table"
          rowKey="disputeId"
          columns={columns}
          dataSource={listQuery.data?.items ?? []}
          loading={listQuery.isFetching}
          pagination={{
            total: listQuery.data?.totalCount ?? 0,
            pageSize: 20,
            showSizeChanger: false,
          }}
          locale={{ emptyText: <div className="py-12 text-slate-500">Chưa có khiếu nại nào theo điều kiện lọc.</div> }}
        />
      </Surface>

      {/* Drawer: Dispute Details & Resolution */}
      <Drawer
        open={Boolean(selectedDisputeId)}
        onClose={() => setSelectedDisputeId(null)}
        width="min(720px, 100vw)"
        title="Chi tiết khiếu nại"
        destroyOnClose
        styles={{ body: { background: '#F8FAFC', padding: 24 } }}
      >
        {detailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detailQuery.isError || !d ? (
          <Alert type="error" showIcon message="Không tải được chi tiết khiếu nại." />
        ) : (
          <div className="space-y-5">
            {/* Header summary */}
            <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag color={TYPE_CONFIG[d.disputeType]?.color || 'default'}>
                      {TYPE_CONFIG[d.disputeType]?.label || d.disputeType}
                    </Tag>
                    <StatusDot tone={STATUS_CONFIG[d.status]?.tone || 'warning'}>
                      {STATUS_CONFIG[d.status]?.label || d.status}
                    </StatusDot>
                  </div>
                  <h3 className="m-0 mt-2 text-lg font-bold text-slate-900">
                    Ứng viên: {d.candidateName || '—'}
                  </h3>
                  <div className="text-sm text-slate-600">Vị trí: {d.jobTitle || '—'}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Tạo lúc: {fmt(d.createdAt)}</div>
                  {d.resolvedAt && <div className="mt-0.5 text-emerald-700">Đã giải quyết: {fmt(d.resolvedAt)}</div>}
                </div>
              </div>

              {(d.candidateNormalizedEmail || d.candidateNormalizedPhone) && (
                <div className="mt-4 flex flex-wrap gap-4 border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-600">
                  {d.candidateNormalizedEmail && <span><b>Email:</b> {d.candidateNormalizedEmail}</span>}
                  {d.candidateNormalizedPhone && <span><b>SĐT:</b> {d.candidateNormalizedPhone}</span>}
                </div>
              )}
            </div>

            {/* Complainant & Description */}
            <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h4 className="m-0 text-sm font-bold text-slate-900">Nội dung khiếu nại</h4>
              <div className="text-sm">
                <span className="text-slate-500">Người khiếu nại: </span>
                <span className="font-semibold text-slate-900">{d.raisedByAffiliateName || 'Cộng tác viên'}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
                <b>Mô tả: </b>{d.description}
              </div>
              {d.evidence && (
                <div className="rounded-xl border border-solid border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
                  <b>Bằng chứng / Ghi chú: </b>{d.evidence}
                </div>
              )}
            </div>

            {/* Submissions comparison */}
            <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h4 className="m-0 text-sm font-bold text-slate-900">
                Các lượt nộp của ứng viên ({d.submissions.length})
              </h4>
              <div className="space-y-2">
                {d.submissions.map((s, idx) => (
                  <div
                    key={s.submissionId}
                    className={`rounded-xl p-3 text-xs border border-solid ${
                      s.isDisputed
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        #{idx + 1} - CTV: {s.affiliateName || 'Ẩn danh'} {s.isDisputed && <Tag color="blue" className="ml-1">Bị khiếu nại</Tag>}
                      </span>
                      <span className="text-slate-500">{fmt(s.submittedAt)}</span>
                    </div>
                    <div className="mt-1 text-slate-600 flex gap-4">
                      <span>Nguồn: <b>{s.source}</b></span>
                      <span>Trạng thái: <b>{s.status}</b></span>
                      {s.consentStatus && <span>Đồng ý: <b>{s.consentStatus}</b></span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Attribution */}
            {d.currentAttribution && (
              <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm space-y-2">
                <h4 className="m-0 text-sm font-bold text-slate-900">Quyền ghi nhận nguồn (Attribution) hiện tại</h4>
                <div className="text-sm text-slate-700">
                  Ghi nhận cho CTV: <b>{d.currentAttribution.affiliateName || 'Cộng tác viên'}</b>
                </div>
                <div className="text-xs text-slate-500">
                  Quy tắc: {d.currentAttribution.attributionRule} · Thời điểm: {fmt(d.currentAttribution.establishedAt)}
                </div>
                {d.currentAttribution.commissionStatuses.length > 0 && (
                  <div className="text-xs text-slate-600">
                    Hoa hồng liên quan: {d.currentAttribution.commissionStatuses.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Resolution Section */}
            {d.status === 'OPEN' ? (
              <div className="rounded-2xl border border-solid border-blue-200 bg-white p-5 shadow-sm space-y-4">
                <h4 className="m-0 text-base font-bold text-slate-900">Ra quyết định giải quyết</h4>
                <Form
                  form={resolveForm}
                  layout="vertical"
                  initialValues={{ decision: 'UPHELD' }}
                  onFinish={(v) => resolveMutation.mutate(v)}
                >
                  <Form.Item
                    name="decision"
                    label="Quyết định của Admin"
                    rules={[{ required: true }]}
                  >
                    <Radio.Group className="flex flex-col gap-2">
                      <Radio value="UPHELD">
                        <span className="font-semibold text-emerald-700">Chấp thuận khiếu nại (UPHELD)</span>
                        <div className="text-xs text-slate-500">
                          Chuyển quyền ghi nhận nguồn (Attribution) sang Cộng tác viên khiếu nại. Các khoản hoa hồng chưa chi trả sẽ chuyển theo.
                        </div>
                      </Radio>
                      <Radio value="REJECTED">
                        <span className="font-semibold text-red-700">Từ chối khiếu nại (REJECTED)</span>
                        <div className="text-xs text-slate-500">
                          Giữ nguyên quyền ghi nhận nguồn hiện tại. Đóng khiếu nại.
                        </div>
                      </Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    name="resolution"
                    label="Căn cứ giải quyết / Phản hồi (bắt buộc)"
                    rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập căn cứ giải quyết.' }]}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Nêu rõ lý do và căn cứ bằng chứng đối soát để thông báo tới các bên..."
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    className="w-full"
                    loading={resolveMutation.isPending}
                  >
                    Xác nhận giải quyết khiếu nại
                  </Button>
                </Form>
              </div>
            ) : (
              <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm space-y-2">
                <h4 className="m-0 text-sm font-bold text-slate-900">Kết quả giải quyết</h4>
                <div className="text-sm">
                  Quyết định: <b>{d.status === 'UPHELD' ? 'Chấp thuận khiếu nại' : 'Từ chối khiếu nại'}</b>
                </div>
                {d.resolution && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                    <b>Căn cứ giải quyết: </b>{d.resolution}
                  </div>
                )}
                {d.resolvedAt && (
                  <div className="text-xs text-slate-500">Thời gian xử lý: {fmt(d.resolvedAt)}</div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminDisputesPage;
