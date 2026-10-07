/**
 * @file HrScreeningPage.tsx
 * @description MF-03 screening for Internal HR (HEADHUNT_COD and CV_SOURCING jobs; the backend
 * scopes the list). Opening an application calls start-screening, which moves SUBMITTED to
 * SCREENING. Actions follow the detail's allowedActions: shortlist (send to Client), reject with
 * a reason code, and — when the backend offers it — backup. Filters live in the URL.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Drawer, Form, Input, Modal, Select, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, ExperimentOutlined, FileOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { screeningApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { RecruitmentApplicationDetail, RecruitmentApplicationItem } from '@/types/api/hr';
import { FilterPills, Initials, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { REJECTION_REASONS, SERVICE_TYPE, parseHighlights, reasonLabel, statusOf } from './hrLabels';

const STATUS_FILTERS = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'all'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const FILTER_LABEL: Record<StatusFilter, string> = {
  SUBMITTED: 'Mới nộp',
  SCREENING: 'Đang sàng lọc',
  SHORTLISTED: 'Đã chọn',
  REJECTED: 'Đã loại',
  all: 'Tất cả',
};

const useStatusCount = (status: StatusFilter) =>
  useQuery({
    queryKey: ['hr-screening', 'count', status],
    queryFn: async () => (await screeningApi.list({ status: status === 'all' ? undefined : status, page: 1, pageSize: 1 })).total,
  });

const formatDateTime = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

const AiScore: React.FC<{ score: number | null; status: string | null }> = ({ score, status }) => {
  if (score == null) {
    const label = status === 'FAILED' ? 'Chấm lỗi' : status === 'PENDING' || status === 'PROCESSING' ? 'Đang chấm' : 'Chưa chấm';
    return <span className={`text-xs ${status === 'FAILED' ? 'font-semibold text-red-700' : 'text-slate-600'}`}>{label}</span>;
  }
  const rounded = Math.round(score);
  const tone = rounded >= 75 ? 'bg-emerald-50 text-emerald-800' : rounded >= 50 ? 'bg-sky-50 text-sky-900' : 'bg-amber-50 text-amber-800';
  return <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${tone}`}>{rounded}</span>;
};

// ─── Detail drawer ───────────────────────────────────────────────────────────

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-0 border-t border-solid border-slate-100 py-2.5 text-sm first:border-t-0">
    <span className="shrink-0 text-slate-600">{label}</span>
    <span className="min-w-0 text-right font-medium text-slate-900">{children}</span>
  </div>
);

const Panel: React.FC<{ title?: string; children: React.ReactNode; extra?: React.ReactNode }> = ({ title, children, extra }) => (
  <section className="admin-surface p-5">
    {title && (
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold text-slate-900">{title}</h3>
        {extra}
      </div>
    )}
    {children}
  </section>
);

const ApplicationDrawer: React.FC<{ applicationId?: string; onClose: () => void }> = ({ applicationId, onClose }) => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm] = Form.useForm<{ reasonCode: string; reason?: string }>();
  const startedFor = useRef<string>();

  const detail = useQuery({
    queryKey: ['hr-application', applicationId],
    queryFn: () => screeningApi.get(applicationId!),
    enabled: Boolean(applicationId),
  });
  const timeline = useQuery({
    queryKey: ['hr-application-timeline', applicationId],
    queryFn: () => screeningApi.timeline(applicationId!),
    enabled: Boolean(applicationId),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-application', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['hr-application-timeline', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['hr-screening'] });
    queryClient.invalidateQueries({ queryKey: ['hr-overview'] });
  };

  // MF-03: opening the application is the start of screening (idempotent on the backend).
  const start = useMutation({
    mutationFn: (d: RecruitmentApplicationDetail) => screeningApi.startScreening(d.jobId, d.applicationId),
    onSuccess: (res) => res.changed && refreshAll(),
  });
  useEffect(() => {
    const d = detail.data;
    if (d && d.allowedActions.includes('START_SCREENING') && startedFor.current !== d.applicationId) {
      startedFor.current = d.applicationId;
      start.mutate(d);
    }
  }, [detail.data, start]);

  const decide = useMutation({
    mutationFn: (input: { targetStatus: 'SHORTLISTED' | 'REJECTED' | 'BACKUP'; reasonCode?: string; reason?: string }) =>
      screeningApi.updateStatus(detail.data!.jobId, detail.data!.applicationId, {
        ...input,
        concurrencyToken: detail.data!.concurrencyToken,
      }),
    onSuccess: (res, input) => {
      message.success(
        res.message ||
          (input.targetStatus === 'SHORTLISTED' ? 'Đã chọn hồ sơ gửi Client.' : input.targetStatus === 'REJECTED' ? 'Đã loại hồ sơ.' : 'Đã đưa vào dự phòng.')
      );
      setRejectOpen(false);
      rejectForm.resetFields();
      refreshAll();
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không cập nhật được hồ sơ.'));
      refreshAll(); // a 409 means someone else changed it; show the latest state
    },
  });

  const retry = useMutation({
    mutationFn: () => screeningApi.retryAiScoring(applicationId!),
    onSuccess: (res) => {
      message.success(res.message || 'Đã gửi yêu cầu AI chấm lại.');
      refreshAll();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không gửi được yêu cầu chấm lại.')),
  });

  const d = detail.data;
  const actions = d?.allowedActions ?? [];
  const canShortlist = actions.includes('SHORTLIST');
  const canReject = actions.includes('REJECT');
  const canBackup = actions.includes('MARK_BACKUP');
  const st = d ? statusOf(d.status) : null;
  const highlights = parseHighlights(d?.aiMatch?.candidateHighlight);
  const busy = decide.isPending || start.isPending;

  const confirmShortlist = () =>
    modal.confirm({
      title: 'Chọn hồ sơ này gửi Client?',
      content: `Client sẽ thấy hồ sơ của ${d?.candidateFullName} và có thể lên lịch phỏng vấn.`,
      okText: 'Chọn gửi Client',
      cancelText: 'Hủy',
      onOk: () => decide.mutateAsync({ targetStatus: 'SHORTLISTED' }),
    });

  return (
    <Drawer
      open={Boolean(applicationId)}
      width="min(760px, 100vw)"
      onClose={onClose}
      title="Hồ sơ ứng tuyển"
      destroyOnClose
      styles={{ body: { background: '#F4F7FB', padding: 20 } }}
      footer={
        d && (canShortlist || canReject || canBackup) ? (
          <div className="flex flex-wrap justify-end gap-2 py-1">
            {canBackup && (
              <Button size="large" disabled={busy} onClick={() => decide.mutate({ targetStatus: 'BACKUP' })}>
                Đưa vào dự phòng
              </Button>
            )}
            {canReject && (
              <Button size="large" danger icon={<CloseOutlined />} disabled={busy} onClick={() => setRejectOpen(true)}>
                Loại hồ sơ
              </Button>
            )}
            {canShortlist && (
              <Button size="large" type="primary" icon={<CheckOutlined />} loading={decide.isPending} disabled={start.isPending} onClick={confirmShortlist}>
                Chọn gửi Client
              </Button>
            )}
          </div>
        ) : null
      }
    >
      {detail.isLoading ? (
        <Skeleton active avatar paragraph={{ rows: 10 }} />
      ) : detail.isError || !d ? (
        <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được hồ sơ.')} />
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <Panel>
            <div className="flex items-start gap-4">
              <Initials name={d.candidateFullName} size={56} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold text-slate-900">{d.candidateFullName}</div>
                <div className="truncate text-sm text-slate-600">
                  {d.jobTitle} · {d.companyName}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {st && <StatusDot tone={st.tone}>{st.label}</StatusDot>}
                  {d.serviceTypeCode && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {SERVICE_TYPE[d.serviceTypeCode] ?? d.serviceTypeCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-[13px] text-sky-950">
              {d.contactOwner === 'InternalHr'
                ? 'Internal HR là bên liên hệ ứng viên cho job này. Client chỉ thấy thông tin liên hệ khi ứng viên đã đi làm.'
                : 'Sau khi bạn chọn, HR của Client sẽ tự liên hệ ứng viên.'}
            </div>
            {d.status === 'REJECTED' && (
              <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-900">
                <b>Lý do loại:</b> {reasonLabel(d.statusReasonCode) ?? '—'}
                {d.statusReason ? ` — ${d.statusReason}` : ''}
              </div>
            )}
          </Panel>

          {/* AI */}
          <Panel
            title="Đánh giá của AI"
            extra={
              <Tooltip title="Gửi lại hồ sơ cho AI chấm điểm, ví dụ khi lần chấm trước lỗi hoặc job vừa sửa yêu cầu.">
                <Button size="small" icon={<ExperimentOutlined />} loading={retry.isPending} onClick={() => retry.mutate()}>
                  Yêu cầu chấm lại
                </Button>
              </Tooltip>
            }
          >
            {!d.aiMatch ? (
              <p className="m-0 text-sm text-slate-600">Hồ sơ chưa được AI chấm điểm.</p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-4">
                  <span className="text-[34px] font-bold leading-none tabular-nums text-slate-900">
                    {d.aiMatch.matchScore != null ? Math.round(d.aiMatch.matchScore) : '—'}
                  </span>
                  <span className="mt-1 text-xs text-slate-600">điểm phù hợp / 100</span>
                  {d.aiMatch.requiresManualReview && <span className="mt-2 text-xs font-semibold text-amber-800">Cần xem tay</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  {highlights.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-slate-900">Điểm khớp</div>
                      <ul className="m-0 space-y-1 pl-5 text-slate-700">
                        {highlights.slice(0, 6).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.aiMatch.missingRequirements.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-slate-900">Còn thiếu</div>
                      <ul className="m-0 space-y-1 pl-5 text-slate-700">
                        {d.aiMatch.missingRequirements.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.aiMatch.warnings.length > 0 && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{d.aiMatch.warnings.join(' · ')}</div>
                  )}
                  {highlights.length === 0 && d.aiMatch.missingRequirements.length === 0 && (
                    <p className="m-0 text-slate-600">AI chưa trả về giải thích chi tiết.</p>
                  )}
                </div>
              </div>
            )}
          </Panel>

          {/* Candidate */}
          <Panel title="Thông tin ứng viên">
            <Row label="Email">{d.candidateEmail ?? '—'}</Row>
            <Row label="Điện thoại">{d.candidatePhone ?? '—'}</Row>
            <Row label="Địa chỉ">{d.currentAddress ?? '—'}</Row>
            <Row label="Kinh nghiệm">{d.yearsOfExperience != null ? `${d.yearsOfExperience} năm` : '—'}</Row>
            <Row label="Học vấn">{d.highestEducation ?? '—'}</Row>
            <Row label="CV">
              {d.cv ? (
                <span className="inline-flex items-center gap-1.5">
                  <FileOutlined aria-hidden /> {d.cv.fileName ?? d.cv.title ?? 'CV'}
                </span>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Nộp lúc">{formatDateTime(d.appliedAt)}</Row>
          </Panel>

          {/* Timeline */}
          <Panel title="Lịch sử hồ sơ">
            {timeline.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (timeline.data ?? []).length === 0 ? (
              <p className="m-0 text-sm text-slate-600">Chưa có sự kiện.</p>
            ) : (
              <ol className="m-0 list-none space-y-0 p-0">
                {timeline.data!.map((e, i) => (
                  <li key={`${e.eventType}-${e.timestamp}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="relative flex w-3 justify-center" aria-hidden>
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#0369A1]" />
                      {i < timeline.data!.length - 1 && <span className="absolute top-4 h-full w-px bg-slate-200" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">{e.title}</div>
                      {e.description && <div className="text-[13px] text-slate-600">{e.description}</div>}
                      {e.reasonCode && <div className="text-[13px] text-red-800">Lý do: {reasonLabel(e.reasonCode)}</div>}
                      <div className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(e.timestamp)}
                        {e.actorName ? ` · ${e.actorName}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      <Modal
        open={rejectOpen}
        title="Loại hồ sơ"
        okText="Loại hồ sơ"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: decide.isPending }}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        destroyOnClose
      >
        <p className="mt-0 text-sm text-slate-600">
          Chọn lý do để Client và các bên liên quan hiểu vì sao hồ sơ không được chọn.
        </p>
        <Form
          form={rejectForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(v) => decide.mutate({ targetStatus: 'REJECTED', reasonCode: v.reasonCode, reason: v.reason?.trim() || undefined })}
        >
          <Form.Item name="reasonCode" label="Lý do" rules={[{ required: true, message: 'Chọn một lý do.' }]}>
            <Select options={REJECTION_REASONS} placeholder="Chọn lý do loại" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.reasonCode !== b.reasonCode}>
            {({ getFieldValue }) => (
              <Form.Item
                name="reason"
                label={getFieldValue('reasonCode') === 'OTHER' ? 'Ghi chú (bắt buộc)' : 'Ghi chú (không bắt buộc)'}
                rules={[
                  { required: getFieldValue('reasonCode') === 'OTHER', whitespace: true, message: 'Lý do khác cần ghi chú.' },
                  { max: 2000, message: 'Tối đa 2000 ký tự.' },
                ]}
              >
                <Input.TextArea rows={3} showCount maxLength={2000} />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const HrScreeningPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (STATUS_FILTERS as readonly string[]).includes(searchParams.get('status') ?? '')
    ? (searchParams.get('status') as StatusFilter)
    : 'SUBMITTED';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const openId = searchParams.get('open') ?? undefined;

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'open') next.delete('page');
    setSearchParams(next, { replace: key === 'open' });
  };

  const counts = {
    SUBMITTED: useStatusCount('SUBMITTED'),
    SCREENING: useStatusCount('SCREENING'),
    SHORTLISTED: useStatusCount('SHORTLISTED'),
    REJECTED: useStatusCount('REJECTED'),
    all: useStatusCount('all'),
  };

  const list = useQuery({
    queryKey: ['hr-screening', 'list', status, q, page],
    queryFn: () => screeningApi.list({ status: status === 'all' ? undefined : status, candidateName: q || undefined, page, pageSize: 10 }),
    placeholderData: (prev) => prev,
  });

  const columns: ColumnsType<RecruitmentApplicationItem> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, r) => <PersonCell name={r.candidateName} secondary={r.candidateEmail} />,
    },
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      render: (_, r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{r.jobTitle}</div>
          <div className="truncate text-[12.5px] text-slate-600">{r.companyName}</div>
        </div>
      ),
    },
    { title: 'AI', key: 'ai', width: 110, render: (_, r) => <AiScore score={r.aiMatchScore} status={r.aiStatus} /> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 190,
      render: (v: string) => {
        const st = statusOf(v);
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
    { title: 'Nộp lúc', dataIndex: 'appliedAt', width: 150, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Sàng lọc hồ sơ"
        description="Hồ sơ ứng tuyển vào job Headhunt và Tìm nguồn CV. Mở hồ sơ để bắt đầu sàng lọc, rồi chọn gửi Client hoặc loại kèm lý do."
        actions={
          <Button icon={<ReloadOutlined />} size="large" onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <Surface>
        <div key={searchParams.get('q') ?? ''} className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
          <FilterPills
            label="Lọc theo trạng thái"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: FILTER_LABEL[s], count: counts[s].data }))}
          />
          <Input
            size="large"
            allowClear
            defaultValue={q}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm theo tên ứng viên, nhấn Enter"
            className="max-w-xs"
            onPressEnter={(e) => setParam('q', (e.target as HTMLInputElement).value.trim() || undefined)}
            onChange={(e) => !e.target.value && q && setParam('q', undefined)}
            aria-label="Tìm theo tên ứng viên"
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được hồ sơ" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<RecruitmentApplicationItem>
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
            rowKey="applicationId"
            columns={columns}
            dataSource={list.data?.items ?? []}
            loading={list.isFetching}
            onRow={(r) => ({
              onClick: () => setParam('open', r.applicationId),
              onKeyDown: (e) => e.key === 'Enter' && setParam('open', r.applicationId),
              tabIndex: 0,
              className: 'cursor-pointer',
            })}
            pagination={{
              current: page,
              pageSize: 10,
              total: list.data?.total ?? 0,
              showSizeChanger: false,
              onChange: (p) => setParam('page', String(p)),
            }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {status === 'SUBMITTED' ? 'Không có hồ sơ mới. Mọi hồ sơ đã được mở sàng lọc.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>

      <ApplicationDrawer applicationId={openId} onClose={() => setParam('open', undefined)} />
    </div>
  );
};

export default HrScreeningPage;
