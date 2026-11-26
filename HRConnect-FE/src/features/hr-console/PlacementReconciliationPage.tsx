/**
 * MF-04 UC-41: Internal HR verifies the Client's reported start-work outcome.
 * Platform Admin only resolves records that HR has flagged as inconsistent.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Descriptions, Drawer, Form, Input, Modal, Radio, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined, FormOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { placementReconciliationApi } from '@/services/api/hrApi';
import type {
  PlacementReconciliationItem,
  PlacementReconciliationStatus,
  ReconciliationContactChannel,
} from '@/types/api/hr';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface, type Tone } from '@/features/admin-console/ui';
import { matchesSearch } from '@/utils/searchMatch';

const PAGE_SIZE = 10;
const statusMeta: Record<PlacementReconciliationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Chờ đối soát', tone: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  FLAGGED: { label: 'Cần xử lý', tone: 'danger' },
};
const channelLabels: Record<ReconciliationContactChannel, string> = {
  CANDIDATE: 'Ứng viên',
  AFFILIATE: 'Affiliate',
  BOTH: 'Ứng viên và Affiliate',
};
const money = (amount: number | null, currency?: string | null) =>
  amount == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency === 'VND' ? '₫' : (currency ?? '')}`;
const date = (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY') : '—';
const dateTime = (value?: string | null) => value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—';

interface ActionValues {
  decision: 'CONFIRM' | 'FLAG';
  contactChannel: ReconciliationContactChannel;
  note?: string;
  resolutionAction?: 'CONFIRM_REPORTED_OUTCOME' | 'REOPEN_FOR_CLIENT_CONFIRMATION';
}

const PlacementReconciliationPage: React.FC<{ admin?: boolean }> = ({ admin = false }) => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PlacementReconciliationStatus | 'ALL'>(admin ? 'FLAGGED' : 'PENDING');
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<PlacementReconciliationItem | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [form] = Form.useForm<ActionValues>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = AntApp.useApp();

  useEffect(() => setPage(1), [status]);
  const list = useQuery({
    queryKey: ['placement-reconciliations', admin ? 'admin' : 'hr', status, page],
    queryFn: () => placementReconciliationApi.list({ status: status === 'ALL' ? undefined : status, page, pageSize: PAGE_SIZE }, admin),
    placeholderData: (previous) => previous,
  });

  const highlightParam = searchParams.get('highlight');
  useEffect(() => {
    if (!highlightParam || list.isLoading || list.isPlaceholderData || !list.data) return;
    const q = highlightParam.toLowerCase();
    const match = list.data.items.find(
      (item) =>
        item.applicationId.toLowerCase() === q ||
        item.reconciliationId.toLowerCase() === q ||
        (item.placementId != null && item.placementId.toLowerCase() === q)
    );
    const clearHighlight = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    };
    if (match) {
      setSelected(match);
      clearHighlight();
    } else if (status !== 'ALL') {
      setStatus('ALL');
    } else if (page * PAGE_SIZE < list.data.totalCount) {
      // Older records sit on later pages: keep looking instead of silently giving up.
      setPage(page + 1);
    } else {
      clearHighlight();
    }
  }, [highlightParam, list.isLoading, list.isPlaceholderData, list.data, status, page, searchParams, setSearchParams]);

  const finish = async (text: string) => {
    message.success(text);
    setActionOpen(false);
    setSelected(null);
    form.resetFields();
    await Promise.all(
      [
        ['placement-reconciliations'],
        ['hr-nav-counts'],
        ['hr-pipeline'],
        ['hr-overview'],
        ['client-pipeline'],
        ['client-candidates'],
        ['client-overview'],
        ['mf05-client-fees'],
        ['mf05-fees'],
        ['mf05-commissions'],
        ['mf05-warranties'],
        ['mf05-replacement-slots'],
        ['mf05-replacement-slots-summary'],
        ['mf05-replacement-refunds'],
        ['mf05-count'],
        ['client-billing'],
        ['placements'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    );
  };

  const reconcile = useMutation({
    mutationFn: (values: ActionValues) => placementReconciliationApi.reconcile(selected!.applicationId, {
      decision: values.decision,
      contactChannel: values.contactChannel,
      note: values.note?.trim() || null,
      concurrencyToken: selected!.concurrencyToken,
    }),
    onSuccess: () => finish(form.getFieldValue('decision') === 'FLAG' ? 'Đã chuyển hồ sơ sang Platform Admin xử lý.' : 'Đã xác nhận kết quả nhận việc.'),
    onError: async (error) => {
      if (getApiError(error, '').status !== 409) return;
      message.warning('Hồ sơ vừa được cập nhật. Danh sách đang được tải lại.');
      setActionOpen(false);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['placement-reconciliations'] });
    },
  });
  const resolve = useMutation({
    mutationFn: (values: ActionValues) => placementReconciliationApi.resolve(selected!.applicationId, {
      action: values.resolutionAction ?? 'CONFIRM_REPORTED_OUTCOME',
      note: values.note!.trim(),
      concurrencyToken: selected!.concurrencyToken,
    }),
    onSuccess: () => finish('Đã hoàn tất xử lý hồ sơ đối soát.'),
    onError: async (error) => {
      if (getApiError(error, '').status !== 409) return;
      message.warning('Hồ sơ vừa được cập nhật. Danh sách đang được tải lại.');
      setActionOpen(false);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['placement-reconciliations'] });
    },
  });
  const activeMutation = admin ? resolve : reconcile;

  const openAction = (decision?: ActionValues['decision']) => {
    form.setFieldsValue(admin
      ? { decision: 'CONFIRM', contactChannel: selected?.contactChannel ?? 'BOTH', resolutionAction: 'CONFIRM_REPORTED_OUTCOME', note: '' }
      : { decision: decision ?? 'CONFIRM', contactChannel: 'CANDIDATE', note: '' });
    setActionOpen(true);
  };

  const columns = useMemo<ColumnsType<PlacementReconciliationItem>>(() => [
    {
      title: 'Ứng viên', key: 'candidate',
      render: (_, row) => <PersonCell name={row.candidateName} secondary={row.candidateEmail ?? undefined} />,
    },
    {
      title: 'Tin tuyển dụng', key: 'job',
      render: (_, row) => <div><div className="font-medium text-slate-900">{row.jobTitle}</div><div className="text-xs text-slate-600">{row.companyName}</div></div>,
    },
    { title: 'Affiliate', dataIndex: 'affiliateName', render: (value) => value || '—' },
    {
      title: 'Client khai', key: 'outcome', width: 150,
      render: (_, row) => <div><div className="font-medium">{row.claimedOutcome === 'STARTED' ? 'Đã đi làm' : 'Không đi làm'}</div>{row.claimedOutcome === 'STARTED' && <div className="text-xs text-slate-600">{date(row.actualStartDate)}</div>}</div>,
    },
    { title: 'Phí dự kiến', key: 'fee', align: 'right', render: (_, row) => money(row.serviceFeeAmount, row.serviceFeeCurrency) },
    {
      title: 'Trạng thái', key: 'status', width: 145,
      render: (_, row) => <StatusDot tone={statusMeta[row.status].tone}>{statusMeta[row.status].label}</StatusDot>,
    },
    { title: '', key: 'actions', width: 128, align: 'right', className: 'w-32 text-right pr-4', render: (_, row) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(row)}>Xem</Button> },
  ], []);

  const submit = async () => {
    try {
      activeMutation.mutate(await form.validateFields());
    } catch {
      // Ant Form renders the field errors; keep the modal open for correction.
    }
  };
  const decision = Form.useWatch('decision', form);

  const hasSearch = searchText.trim().length > 0;
  const visibleItems = useMemo(() => {
    const rows = list.data?.items ?? [];
    if (!hasSearch) return rows;
    return rows.filter((row) =>
      matchesSearch(
        searchText,
        row.candidateName,
        row.candidateEmail,
        row.jobTitle,
        row.companyName,
        row.affiliateName
      )
    );
  }, [list.data?.items, hasSearch, searchText]);

  return (
    <div>
      <PageHero
        eyebrow={admin ? 'Platform Admin' : 'Internal HR'}
        title={admin ? 'Xử lý đối soát nhận việc' : 'Đối soát kết quả nhận việc'}
        description={admin
          ? 'Xử lý các trường hợp Internal HR xác minh thấy thông tin Client khai không khớp.'
          : 'Xác minh với ứng viên hoặc Affiliate trước khi hệ thống cho phép phí dịch vụ tiếp tục.'}
      />
      <Alert
        className="mb-5"
        type={admin ? 'warning' : 'info'}
        showIcon
        message={admin ? 'Chỉ xử lý hồ sơ đã được báo không khớp' : 'Internal HR chỉ xác minh, không thay đổi quyết định tuyển dụng của Client'}
        description={admin
          ? 'Ghi rõ kết quả xử lý. Khi hoàn tất, phí của placement mới được tiếp tục theo hạn thanh toán.'
          : 'Nếu Client nhập sai ngày đi làm, sửa ngày trước rồi mới xác nhận. Nếu thông tin không khớp, ghi chú và chuyển Admin xử lý.'}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Lọc trạng thái đối soát"
          value={status}
          onChange={(value) => setStatus(value as PlacementReconciliationStatus | 'ALL')}
          options={[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'PENDING', label: 'Chờ đối soát' },
            { value: 'FLAGGED', label: 'Cần xử lý' },
            { value: 'CONFIRMED', label: 'Đã xác nhận' },
          ]}
        />
        <Input
          allowClear
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Tìm theo ứng viên, email, tin tuyển dụng, công ty, Affiliate..."
          aria-label="Tìm kiếm đối soát nhận việc"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full sm:w-[340px]"
        />
      </div>
      <Surface>
        {list.isError ? (
          <div className="p-5"><Alert type="error" showIcon message="Không tải được danh sách đối soát" description={getApiErrorMessage(list.error)} /></div>
        ) : (
          <Table
            className="admin-soft-table w-full table-auto"
            rowKey="reconciliationId"
            columns={columns}
            dataSource={visibleItems}
            loading={list.isFetching}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: hasSearch ? visibleItems.length : (list.data?.totalCount ?? 0), showSizeChanger: false, onChange: setPage }}
            locale={{
              emptyText: hasSearch ? (
                <div className="py-8 text-slate-600">
                  <div>Không tìm thấy hồ sơ đối soát phù hợp trên trang này.</div>
                  <Button className="mt-3" onClick={() => setSearchText('')}>Xóa từ khóa tìm kiếm</Button>
                </div>
              ) : 'Không có hồ sơ phù hợp.',
            }}
          />
        )}
      </Surface>

      <Drawer title="Chi tiết đối soát" width={560} open={selected !== null} onClose={() => setSelected(null)}>
        {selected && <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Ứng viên">{selected.candidateName}</Descriptions.Item>
            <Descriptions.Item label="Email">{selected.candidateEmail ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Công việc">{selected.jobTitle} · {selected.companyName}</Descriptions.Item>
            <Descriptions.Item label="Affiliate">{selected.affiliateName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Client khai">{selected.claimedOutcome === 'STARTED' ? `Đã đi làm từ ${date(selected.actualStartDate)}` : 'Không đi làm'}</Descriptions.Item>
            <Descriptions.Item label="Phí dự kiến">{money(selected.serviceFeeAmount, selected.serviceFeeCurrency)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><StatusDot tone={statusMeta[selected.status].tone}>{statusMeta[selected.status].label}</StatusDot></Descriptions.Item>
            <Descriptions.Item label="Thời điểm Client gửi">{dateTime(selected.createdAt)}</Descriptions.Item>
            {selected.reviewedAt && <Descriptions.Item label="Thời điểm đối soát">{dateTime(selected.reviewedAt)}</Descriptions.Item>}
            {selected.contactChannel && <Descriptions.Item label="Đã liên hệ">{channelLabels[selected.contactChannel]}</Descriptions.Item>}
            {selected.note && <Descriptions.Item label="Ghi chú không khớp">{selected.note}</Descriptions.Item>}
            {selected.resolutionNote && <Descriptions.Item label="Kết quả xử lý">{selected.resolutionNote}</Descriptions.Item>}
            {selected.resolutionAction && <Descriptions.Item label="Hướng xử lý">{selected.resolutionAction === 'REOPEN_FOR_CLIENT_CONFIRMATION' ? 'Mở lại để Client xác nhận' : 'Xác nhận kết quả Client đã khai'}</Descriptions.Item>}
          </Descriptions>
          {!admin && selected.status === 'PENDING' && <div className="mt-5 flex flex-wrap gap-2">
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openAction('CONFIRM')}>Xác nhận đúng</Button>
            <Button danger icon={<ExclamationCircleOutlined />} onClick={() => openAction('FLAG')}>Báo không khớp</Button>
            {selected.placementId && <Button icon={<FormOutlined />} onClick={() => navigate(`/hr/placement-review?highlight=${selected.placementId}`)}>Xem liên hệ &amp; sửa ngày</Button>}
          </div>}
          {admin && selected.status === 'FLAGGED' && <div className="mt-5"><Button type="primary" onClick={() => openAction()}>Ghi nhận đã xử lý</Button></div>}
        </>}
      </Drawer>

      <Modal
        title={admin ? 'Hoàn tất xử lý đối soát' : decision === 'FLAG' ? 'Báo thông tin không khớp' : 'Xác nhận kết quả nhận việc'}
        open={actionOpen}
        okText={admin ? 'Hoàn tất xử lý' : decision === 'FLAG' ? 'Chuyển Admin xử lý' : 'Xác nhận đúng'}
        cancelText="Hủy"
        confirmLoading={activeMutation.isPending}
        onOk={submit}
        onCancel={() => setActionOpen(false)}
      >
        {activeMutation.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(activeMutation.error)} />}
        <Form form={form} layout="vertical" requiredMark="optional">
          {admin && selected?.claimedOutcome === 'NOT_STARTED' && (
            <Form.Item name="resolutionAction" label="Hướng xử lý" rules={[{ required: true, message: 'Chọn hướng xử lý.' }]}>
              <Radio.Group className="flex flex-col gap-2">
                <Radio value="CONFIRM_REPORTED_OUTCOME">Xác nhận ứng viên không đi làm</Radio>
                <Radio value="REOPEN_FOR_CLIENT_CONFIRMATION">Client khai sai — mở lại để xác nhận đi làm</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {!admin && <>
            <Form.Item name="decision" hidden><Input /></Form.Item>
            <Form.Item name="contactChannel" label="Đã xác minh với" rules={[{ required: true, message: 'Chọn kênh đã dùng để xác minh.' }]}>
              <Select options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </>}
          <Form.Item
            name="note"
            label={admin ? 'Kết quả xử lý' : decision === 'FLAG' ? 'Thông tin không khớp' : 'Ghi chú'}
            rules={[
              { required: admin || decision === 'FLAG', whitespace: true, message: 'Nhập nội dung xác minh.' },
              { max: 1000, message: 'Tối đa 1000 ký tự.' },
            ]}
          >
            <Input.TextArea rows={5} maxLength={1000} showCount placeholder="Ghi rõ người đã liên hệ, kết quả xác minh và thông tin liên quan." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export const HrPlacementReconciliationPage = () => <PlacementReconciliationPage />;
export const AdminPlacementReconciliationPage = () => <PlacementReconciliationPage admin />;
