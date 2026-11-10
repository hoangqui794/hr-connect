/**
 * MF-05 warranty screens (HEADHUNT_COD), GET /warranties scoped by role on the server.
 * - Client › Bảo hành: own placements, service fees, and "Báo nghỉ việc" while the warranty is active.
 * - Internal HR › Theo dõi bảo hành: every warranty, reported resignations first, confirm or reject.
 */
import React, { useEffect, useState } from 'react';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Form, Input, Modal, Radio, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { ServiceFee, ServiceFeeStatus, Warranty, WarrantyStatus } from '@/types/api/finance';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { COMMISSION_STATUS, SERVICE_FEE_STATUS, WARRANTY_STATUS, date, labelOf, money } from './financeLabels';
import { ReplacementQuotaCard } from './ReplacementQuotaCard';
import { PlacementDetailDrawer } from './PlacementDetailDrawer';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const PAGE_SIZE = 20;
type Mode = 'client' | 'hr';

const WarrantyList: React.FC<{ mode: Mode }> = ({ mode }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WarrantyStatus | 'all'>(mode === 'hr' ? 'CLAIMED' : 'all');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Warranty | null>(null);
  const [detailPlacementId, setDetailPlacementId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();

  const list = useQuery({
    queryKey: ['mf05-warranties', mode, status, page],
    queryFn: () => financeApi.warranties({ status, page, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const highlightParam = searchParams.get('highlight');
  useEffect(() => {
    if (!highlightParam || list.isLoading || !list.data) return;
    const q = highlightParam.toLowerCase();
    const match = list.data.items.find(
      (w) => w.warrantyId.toLowerCase() === q || w.placementId.toLowerCase() === q
    );
    if (match) {
      if (mode === 'hr' && match.status === 'CLAIMED') {
        form.setFieldsValue({ decision: 'confirm', note: '' });
        setTarget(match);
      } else {
        setDetailPlacementId(match.placementId);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    } else if (status !== 'all') {
      setStatus('all');
    }
  }, [highlightParam, list.isLoading, list.data, mode, status, form, searchParams, setSearchParams]);

  const submit = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields();
      if (!target) return null;
      if (mode === 'client') {
        await financeApi.reportResignation(target.placementId, {
          lastWorkingDate: (v.lastWorkingDate as Dayjs).format('YYYY-MM-DD'),
          reason: v.reason,
        });
        return null;
      } else {
        return await financeApi.resolveResignation(target.placementId, { confirmed: v.decision === 'confirm', note: v.note });
      }
    },
    onSuccess: (claimRes) => {
      if (mode === 'client') {
        message.success('Đã báo nghỉ việc. Internal HR sẽ xác minh.');
      } else {
        if (claimRes?.replacement) {
          if (claimRes.replacement.status === 'OPEN') {
            message.success(
              `Đã xác minh báo nghỉ việc. Suất tuyển thay thế đã được kích hoạt (hạn đến ${date(
                claimRes.replacement.expiresAt
              )}).`
            );
          } else if (claimRes.replacement.status === 'WAITING_PAYMENT') {
            message.info(
              'Đã xác minh báo nghỉ việc. Suất thay thế sẽ tự động mở khi Doanh nghiệp thanh toán phí dịch vụ.'
            );
          } else {
            message.success('Đã xử lý báo nghỉ.');
          }
        } else {
          message.success('Đã xử lý báo nghỉ.');
        }
      }
      setTarget(null);
      form.resetFields();
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('mf05-') });
    },
    onError: (error) => {
      // validateFields rejects with field errors, already shown under each field.
      if (!(error && typeof error === 'object' && 'errorFields' in error)) message.error(getApiErrorMessage(error));
    },
  });


  const columns: ColumnsType<Warranty> = [
    {
      title: 'Ứng viên',
      key: 'who',
      render: (_, w) => (
        <div>
          <div className="font-semibold text-slate-900">{w.candidateName ?? '—'}</div>
          <div className="text-xs text-slate-500">{w.position ?? w.jobTitle ?? '—'}</div>
        </div>
      ),
    },
    ...(mode === 'hr' ? [{ title: 'Doanh nghiệp', dataIndex: 'companyName', render: (v: string | null) => v ?? '—' }] : []),
    {
      title: 'Bảo hành',
      key: 'period',
      render: (_, w) => (
        <span className="tabular-nums">
          {date(w.startDate)} → {date(w.endDate)}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: WarrantyStatus, w) => {
        const s = labelOf(WARRANTY_STATUS, v);
        return (
          <Tooltip title={w.resultNote ?? undefined}>
            <span><StatusDot tone={s.tone}>{s.label}</StatusDot></span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Phí dịch vụ',
      key: 'fee',
      render: (_, w) => {
        const s = labelOf(SERVICE_FEE_STATUS, w.serviceFeeStatus);
        return (
          <div>
            <div className="tabular-nums">{money(w.serviceFeeAmount)}</div>
            {w.serviceFeeStatus && <StatusDot tone={s.tone}>{s.label}</StatusDot>}
          </div>
        );
      },
    },
    ...(mode === 'hr'
      ? [
          {
            title: 'Hoa hồng',
            key: 'commission',
            render: (_: unknown, w: Warranty) => {
              if (!w.commissionStatus) return <span className="text-slate-400">Không có Affiliate</span>;
              const s = labelOf(COMMISSION_STATUS, w.commissionStatus);
              return (
                <div>
                  <div className="tabular-nums">{money(w.commissionAmount)}</div>
                  <StatusDot tone={s.tone}>{s.label}</StatusDot>
                </div>
              );
            },
          },
        ]
      : []),
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, w) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailPlacementId(w.placementId)}
          >
            Chi tiết
          </Button>
          {mode === 'client' ? (
            w.status === 'ACTIVE' && (
              <Button size="small" danger onClick={() => { form.setFieldsValue({ lastWorkingDate: dayjs() }); setTarget(w); }}>
                Báo nghỉ việc
              </Button>
            )
          ) : (
            w.status === 'CLAIMED' && (
              <Button size="small" type="primary" onClick={() => { form.setFieldsValue({ decision: 'confirm' }); setTarget(w); }}>
                Xác minh
              </Button>
            )
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterPills<WarrantyStatus | 'all'>
          label="Trạng thái bảo hành"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            ...(mode === 'hr' ? [{ value: 'CLAIMED' as const, label: 'Chờ xác minh' }] : []),
            { value: 'all', label: 'Tất cả' },
            { value: 'ACTIVE', label: 'Đang bảo hành' },
            ...(mode === 'client' ? [{ value: 'CLAIMED' as const, label: 'Đã báo nghỉ' }] : []),
            { value: 'PASSED', label: 'Đã qua' },
            { value: 'VOIDED', label: 'Nghỉ trong bảo hành' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => list.refetch()} loading={list.isFetching}>Làm mới</Button>
      </div>
      {list.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(list.error)} />}
      <Surface>
        <Table
          rowKey="warrantyId"
          columns={columns}
          dataSource={list.data?.items}
          loading={list.isFetching}
          scroll={{ x: 760 }}
          pagination={{ itemRender: a11yItemRender, current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
          locale={{ emptyText: mode === 'hr' && status === 'CLAIMED' ? 'Không có báo nghỉ nào chờ xác minh.' : 'Chưa có bảo hành nào.' }}
        />
      </Surface>

      <Modal
        open={Boolean(target)}
        title={mode === 'client' ? 'Báo ứng viên nghỉ việc' : 'Xác minh báo nghỉ việc'}
        okText={mode === 'client' ? 'Gửi báo nghỉ' : 'Xác nhận'}
        cancelText="Đóng"
        okButtonProps={{ danger: mode === 'client' }}
        confirmLoading={submit.isPending}
        onOk={() => submit.mutate()}
        onCancel={() => { setTarget(null); form.resetFields(); }}
        destroyOnHidden
      >
        {target && (
          <Form form={form} layout="vertical" preserve={false}>
            {mode === 'client' ? (
              <>
                <Alert
                  className="mb-4"
                  type="warning"
                  showIcon
                  message={`${target.candidateName ?? 'Ứng viên'} — bảo hành đến ${date(target.endDate)}. Internal HR sẽ xác minh; nếu đúng, HR Connect áp dụng chính sách tìm ứng viên thay thế miễn phí theo hợp đồng Headhunt hoặc điều chỉnh phí.`}
                />
                <Form.Item name="lastWorkingDate" label="Ngày làm việc cuối cùng" rules={[{ required: true, message: 'Chọn ngày.' }]}>
                  <DatePicker
                    className="w-full"
                    format="DD/MM/YYYY"
                    disabledDate={(d) => d.isBefore(dayjs(target.startDate), 'day') || (target.endDate ? !d.isBefore(dayjs(target.endDate), 'day') : false)}
                  />
                </Form.Item>
                <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }, { max: 2000 }]}>
                  <Input.TextArea rows={3} placeholder="Ví dụ: ứng viên xin nghỉ vì lý do cá nhân." />
                </Form.Item>
              </>
            ) : (
              <>
                <Alert className="mb-4" type="info" showIcon message={target.resultNote ?? 'Client đã báo ứng viên nghỉ việc trong thời gian bảo hành.'} />
                <Form.Item
                  name="decision"
                  label="Kết quả xác minh"
                  rules={[{ required: true }]}
                  extra="Đúng: bảo hành chấm dứt, hoa hồng của Affiliate bị hủy, xử lý thay thế theo hợp đồng. Không đúng: bảo hành tiếp tục, hoa hồng trở lại trạng thái đang trong thời gian bảo hành."
                >
                  <Radio.Group>
                    <Radio value="confirm">Đúng, ứng viên đã nghỉ</Radio>
                    <Radio value="reject">Không đúng, ứng viên vẫn đi làm</Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(a, b) => a.decision !== b.decision}>
                  {({ getFieldValue }) => (
                    <Form.Item
                      name="note"
                      label="Ghi chú & Phương án xử lý"
                      rules={[{ required: getFieldValue('decision') === 'reject', whitespace: true, message: 'Bác bỏ cần ghi chú lý do.' }]}
                    >
                      <Input.TextArea rows={3} placeholder="Ghi chú xác minh và phương án: Tìm ứng viên thay thế / gia hạn bảo hành / điều chỉnh phí…" />
                    </Form.Item>
                  )}
                </Form.Item>
              </>
            )}
          </Form>
        )}
      </Modal>

      <PlacementDetailDrawer
        open={Boolean(detailPlacementId)}
        placementId={detailPlacementId || undefined}
        mode={mode}
        onClose={() => setDetailPlacementId(null)}
      />
    </>
  );
};

const ClientFees: React.FC = () => {
  const [page, setPage] = useState(1);
  const fees = useQuery({
    queryKey: ['mf05-client-fees', page],
    // The warranty page is Headhunt only (HR feedback 28/10): CV Sourcing deposits and settlements stay out.
    queryFn: () => financeApi.serviceFees({ kind: 'PLACEMENT', page, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });
  const columns: ColumnsType<ServiceFee> = [
    {
      title: 'Ứng viên',
      key: 'who',
      render: (_, f) => (
        <div>
          <div className="font-semibold text-slate-900">{f.candidateName ?? '—'}</div>
          <div className="text-xs text-slate-500">{f.jobTitle ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Phí dịch vụ',
      key: 'amount',
      align: 'right',
      render: (_, f) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{money(f.amount, f.currencyCode)}</div>
          <div className="text-xs text-slate-500">{money(f.baseSalary, f.currencyCode)} × {f.feeMultiplier}</div>
        </div>
      ),
    },
    {
      title: 'Hạn thanh toán',
      key: 'dueDate',
      render: (_, fee) => fee.reconciliationStatus && fee.reconciliationStatus !== 'CONFIRMED'
        ? <span className="text-slate-500">Sau khi đối soát</span>
        : date(fee.dueDate),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, fee) => {
        if (fee.reconciliationStatus === 'PENDING') return <StatusDot tone="warning">Đang đối soát</StatusDot>;
        if (fee.reconciliationStatus === 'FLAGGED') return <StatusDot tone="danger">Đang xác minh</StatusDot>;
        const status = labelOf(SERVICE_FEE_STATUS, fee.status);
        return <StatusDot tone={status.tone}>{status.label}</StatusDot>;
      },
    },
  ];
  return (
    <Surface>
      <Table
        rowKey="serviceFeeId"
        columns={columns}
        dataSource={fees.data?.items}
        loading={fees.isFetching}
        scroll={{ x: 600 }}
        pagination={{ itemRender: a11yItemRender, current: page, pageSize: PAGE_SIZE, total: fees.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
        locale={{ emptyText: 'Chưa có khoản phí nào.' }}
      />
    </Surface>
  );
};

export const ClientWarrantyPage: React.FC = () => (
  <div className={`${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
    {/* ── Studio Header ── */}
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
            Chính sách & quản lý bảo hành
          </h1>
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0C4A6E] border border-sky-100">
            Tuyển dụng theo kết quả
          </span>
        </div>
        <p className="m-0 mt-1 text-sm text-slate-500">
          Theo dõi thời hạn cam kết bảo hành ứng viên đã đi làm và gửi yêu cầu suất tuyển thay thế miễn phí khi cần.
        </p>
      </div>
    </div>
    <ReplacementQuotaCard mode="client" />
    <h2 className="mb-3 mt-8 text-base font-semibold text-slate-900 tracking-tight">Danh sách bảo hành ứng viên</h2>
    <WarrantyList mode="client" />
    <h2 className="mb-3 mt-8 text-base font-semibold text-slate-900 tracking-tight">Công nợ phí dịch vụ</h2>
    <p className="-mt-2 mb-3 text-xs text-slate-500">Phí = lương gross tháng trong offer × hệ số phí. Thanh toán bằng chuyển khoản; HR Connect ghi nhận khi nhận được tiền.</p>
    <ClientFees />
  </div>
);

export const HrWarrantyPage: React.FC = () => (
  <div>
    <PageHero
      eyebrow="HH · Tuyển dụng theo kết quả"
      title="Theo dõi bảo hành"
      tip
      description="Bảo hành tự qua khi đủ thời hạn (hoa hồng Affiliate được ghi nhận 100%). Khi Client báo nghỉ, xác minh với ứng viên và Client rồi xác nhận hoặc bác bỏ."
    />
    <ReplacementQuotaCard mode="hr" />
    <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">Danh sách bảo hành ứng viên</h2>
    <WarrantyList mode="hr" />
  </div>
);

