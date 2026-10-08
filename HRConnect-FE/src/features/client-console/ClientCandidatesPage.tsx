/**
 * @file ClientCandidatesPage.tsx
 * @description Client Company applications (GET /recruitment/applications, scoped by the backend:
 * CV_APPLICATION jobs plus HEADHUNT_COD / CV_SOURCING applications Internal HR has shortlisted).
 * Stage pills and the job filter live in the URL; a row opens the shared ApplicationWorkbench,
 * which shows the actions the backend allows (screening, interview, offer, start of work).
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Skeleton, Table, Tooltip } from 'antd';
import { JobStatusTag } from '@/features/jobs-mf01/JobDetailPanel';
import type { ColumnsType } from 'antd/es/table';
import { AppstoreOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { screeningApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { RecruitmentApplicationItem } from '@/types/api/hr';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { FilterPills, Initials, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { statusOf } from '@/features/hr-console/hrLabels';

const STAGES = ['all', 'SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'PLACED', 'BACKUP', 'REJECTED'] as const;
type Stage = (typeof STAGES)[number];
const STAGE_LABEL: Record<Stage, string> = {
  all: 'Tất cả',
  SUBMITTED: 'Mới nộp',
  SCREENING: 'Đang xem',
  SHORTLISTED: 'Đã chọn',
  INTERVIEW: 'Phỏng vấn',
  OFFER_PENDING: 'Chờ offer',
  OFFER_ACCEPTED: 'Nhận offer',
  PLACED: 'Đã đi làm',
  BACKUP: 'Dự phòng',
  REJECTED: 'Đã loại',
};
const PAGE_SIZE = 10;

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

/** Board columns: the active hiring stages, left to right. Rejected/backup stay in the list view. */
const BOARD: { code: string; label: string; dot: string }[] = [
  { code: 'SUBMITTED', label: 'Mới nộp', dot: 'bg-orange-500' },
  { code: 'SCREENING', label: 'Đang xem', dot: 'bg-sky-500' },
  { code: 'SHORTLISTED', label: 'Đã chọn', dot: 'bg-blue-600' },
  { code: 'INTERVIEW', label: 'Phỏng vấn', dot: 'bg-violet-600' },
  { code: 'OFFER_PENDING', label: 'Chờ offer', dot: 'bg-amber-500' },
  { code: 'OFFER_ACCEPTED', label: 'Nhận offer', dot: 'bg-teal-600' },
  { code: 'PLACED', label: 'Đã đi làm', dot: 'bg-emerald-600' },
];
const BOARD_LIMIT = 20;

const AiScore: React.FC<{ score: number | null }> = ({ score }) => {
  if (score == null) return <span className="text-xs text-slate-500">—</span>;
  const s = Math.round(score);
  const tone = s >= 75 ? 'bg-emerald-50 text-emerald-800' : s >= 50 ? 'bg-indigo-50 text-indigo-900' : 'bg-amber-50 text-amber-800';
  return <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${tone}`}>{s}</span>;
};

export const ClientCandidatesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stage = (STAGES as readonly string[]).includes(searchParams.get('status') ?? '') ? (searchParams.get('status') as Stage) : 'all';
  const jobId = searchParams.get('job') ?? undefined;
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const openId = searchParams.get('open') ?? undefined;
  // The CV list is the default; the stage board is opt-in (?view=board).
  const view: 'board' | 'list' = searchParams.get('view') === 'board' && !searchParams.get('status') ? 'board' : 'list';
  const jobs = useMyJobs();

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'open') next.delete('page');
    setSearchParams(next, { replace: key === 'open' });
  };

  // One count per pill (small requests, cached); the pills show where candidates are stuck.
  const countQueries = useQueries({
    queries: STAGES.map((s) => ({
      queryKey: ['client-candidates', 'count', s, jobId ?? ''],
      queryFn: async () => (await screeningApi.list({ status: s === 'all' ? undefined : s, jobId, page: 1, pageSize: 1 })).total,
    })),
  });

  const railJobs = (jobs.data ?? [])
    .filter((j) => j.status === 'ACTIVE' || j.status === 'PAUSED' || j.status === 'CLOSED')
    .sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  const railCounts = useQueries({
    queries: railJobs.map((j) => ({
      queryKey: ['client-candidates', 'job-count', j.jobId],
      queryFn: async () => (await screeningApi.list({ jobId: j.jobId, page: 1, pageSize: 1 })).total,
      staleTime: 60_000,
    })),
  });
  const selectedJob = railJobs.find((j) => j.jobId === jobId) ?? (jobs.data ?? []).find((j) => j.jobId === jobId);
  // CVs of the selected job (or of every job when none is selected).
  const totalAll = countQueries[STAGES.indexOf('all')].data;
  // CVs across every job, for the "Tất cả tin" row: independent of the selected job.
  const everyJobTotal = useQuery({
    queryKey: ['client-candidates', 'count', 'all', ''],
    queryFn: async () => (await screeningApi.list({ page: 1, pageSize: 1 })).total,
  });

  const boardQueries = useQueries({
    queries: BOARD.map((b) => ({
      queryKey: ['client-candidates', 'board', b.code, jobId ?? '', q],
      queryFn: () => screeningApi.list({ status: b.code, jobId, candidateName: q || undefined, page: 1, pageSize: BOARD_LIMIT }),
      enabled: view === 'board',
    })),
  });
  const setView = (v: 'board' | 'list') => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    if (v === 'board') {
      next.set('view', 'board');
      next.delete('status');
    } else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const list = useQuery({
    queryKey: ['client-candidates', 'list', stage, jobId ?? '', q, page],
    queryFn: () => screeningApi.list({ status: stage === 'all' ? undefined : stage, jobId, candidateName: q || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
    enabled: view === 'list',
  });

  const columns: ColumnsType<RecruitmentApplicationItem> = [
    { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidateName} secondary={r.candidateEmail} /> },
    {
      title: 'Tin tuyển dụng',
      key: 'j',
      render: (_, r) => <div className="max-w-[320px] truncate font-medium text-slate-900">{r.jobTitle}</div>,
    },
    { title: 'AI', key: 'ai', width: 90, render: (_, r) => <AiScore score={r.aiMatchScore} /> },
    {
      title: 'Giai đoạn',
      dataIndex: 'status',
      width: 190,
      render: (v: string) => {
        const st = statusOf(v);
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
    { title: 'Nộp lúc', dataIndex: 'appliedAt', width: 150, render: (v: string) => <span className="tabular-nums">{dayjs(v).format('HH:mm DD/MM/YYYY')}</span> },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Tuyển dụng"
        title="Hồ sơ ứng viên"
        description="Mọi hồ sơ vào tin của bạn, theo từng giai đoạn. Mở hồ sơ để xem đánh giá AI, chọn ứng viên, lên lịch phỏng vấn, gửi offer và xác nhận đi làm."
        actions={
          <Button icon={<ReloadOutlined />} size="large" onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Job rail: pick a job to see every CV sent to it ─────────────── */}
        <nav aria-label="Chọn tin tuyển dụng" className="admin-surface self-start p-3 lg:sticky lg:top-24">
          <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tin tuyển dụng</div>
          <ul className="m-0 max-h-[60vh] list-none space-y-1 overflow-y-auto p-0 lg:max-h-[calc(100vh-180px)]">
            <li>
              <button
                type="button"
                aria-current={!jobId ? 'true' : undefined}
                onClick={() => setParam('job', undefined)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-0 px-3 py-2.5 text-left text-[13.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                  !jobId ? 'bg-[color:var(--console-accent-soft)] font-semibold text-[color:var(--console-accent-strong)]' : 'bg-transparent text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Tất cả tin</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">{everyJobTotal.data ?? '…'}</span>
              </button>
            </li>
            {jobs.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} title={false} className="px-3 pt-2" />
            ) : (
              railJobs.map((j, i) => {
                const active = j.jobId === jobId;
                return (
                  <li key={j.jobId}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setParam('job', j.jobId)}
                      className={`flex w-full cursor-pointer flex-col gap-1 rounded-xl border-0 px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                        active ? 'bg-[color:var(--console-accent-soft)]' : 'bg-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className={`line-clamp-2 text-[13.5px] leading-snug ${active ? 'font-semibold text-[color:var(--console-accent-strong)]' : 'font-medium text-slate-800'}`}>
                          {j.title || 'Vị trí chưa đặt tên'}
                        </span>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">
                          {railCounts[i]?.isLoading ? '…' : railCounts[i]?.data ?? 0}
                        </span>
                      </span>
                      {j.status !== 'ACTIVE' && (
                        <span>
                          <JobStatusTag status={j.status} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <p className="m-0 px-2 pt-2 text-[12px] text-slate-500">Chỉ tin đã được duyệt mới nhận CV.</p>
        </nav>

      <Surface>
        <div className="space-y-3 px-5 pb-3 pt-5">
          <div>
            <h2 className="m-0 text-[17px] font-bold text-slate-900">{selectedJob ? selectedJob.title || 'Vị trí chưa đặt tên' : 'CV của tất cả tin'}</h2>
            <p className="m-0 mt-0.5 text-[13px] text-slate-600">
              {selectedJob
                ? `${totalAll ?? 0} CV đã nộp vào tin này · cần tuyển ${selectedJob.quantity} người`
                : `${totalAll ?? 0} CV trên mọi tin của bạn. Chọn một tin ở bên trái để xem riêng.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Kiểu hiển thị" className="inline-flex rounded-full bg-slate-100 p-1">
              {(
                [
                  ['list', <UnorderedListOutlined key="l" />, 'Danh sách CV'],
                  ['board', <AppstoreOutlined key="b" />, 'Bảng theo giai đoạn'],
                ] as const
              ).map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={`flex h-9 cursor-pointer items-center gap-2 rounded-full border-0 px-4 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                    view === v ? 'bg-white text-[color:var(--console-accent-strong)] shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
          {view === 'list' && (
          <FilterPills
            label="Lọc theo giai đoạn"
            value={stage}
            onChange={(v) => {
              const next = new URLSearchParams(searchParams);
              next.delete('view');
              next.delete('page');
              if (v === 'all') next.delete('status');
              else next.set('status', v);
              setSearchParams(next);
            }}
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s], count: countQueries[STAGES.indexOf(s)].data }))}
          />
          )}
          <div key={q} className="flex flex-wrap items-center gap-3">
            <Input
              size="large"
              allowClear
              defaultValue={q}
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo tên ứng viên, nhấn Enter"
              className="w-full sm:max-w-xs"
              onPressEnter={(e) => setParam('q', (e.target as HTMLInputElement).value.trim() || undefined)}
              onChange={(e) => !e.target.value && q && setParam('q', undefined)}
              aria-label="Tìm theo tên ứng viên"
            />
          </div>
        </div>
        {view === 'board' ? (
          <div className="overflow-x-auto px-5 pb-5" role="region" aria-label="Bảng ứng viên theo giai đoạn" tabIndex={0}>
            <div className="flex min-w-max gap-3">
              {BOARD.map((b, i) => {
                const qy = boardQueries[i];
                const items = qy.data?.items ?? [];
                return (
                  <section key={b.code} aria-label={b.label} className="flex w-[236px] shrink-0 flex-col rounded-2xl bg-slate-50 p-2.5">
                    <header className="mb-2 flex items-center justify-between px-1.5 py-1">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                        <span className={`h-2 w-2 rounded-full ${b.dot}`} aria-hidden />
                        {b.label}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">{qy.data?.total ?? 0}</span>
                    </header>
                    {qy.isLoading ? (
                      <Skeleton active paragraph={{ rows: 2 }} title={false} className="px-1.5" />
                    ) : items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">Trống</div>
                    ) : (
                      <ul className="m-0 list-none space-y-2 p-0">
                        {items.map((a) => (
                          <li key={a.applicationId}>
                            <button
                              type="button"
                              onClick={() => setParam('open', a.applicationId)}
                              className="client-soft-card flex w-full cursor-pointer flex-col gap-2 rounded-xl border-0 bg-white p-3 text-left shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_2px_6px_-2px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                            >
                              <span className="flex items-center gap-2.5">
                                <Initials name={a.candidateName} size={30} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13.5px] font-semibold text-slate-900">{a.candidateName}</span>
                                  <span className="block truncate text-xs text-slate-600">{a.jobTitle}</span>
                                </span>
                              </span>
                              <span className="flex items-center justify-between">
                                {a.aiMatchScore != null ? (
                                  <Tooltip title="Điểm phù hợp do AI chấm">
                                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-blue-800">AI {Math.round(a.aiMatchScore)}</span>
                                  </Tooltip>
                                ) : (
                                  <span />
                                )}
                                <span className="text-[11px] text-slate-500">{dayjs(a.appliedAt).fromNow()}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {(qy.data?.total ?? 0) > items.length && (
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                const next = new URLSearchParams(searchParams);
                                next.delete('view');
                                next.set('status', b.code);
                                setSearchParams(next);
                              }}
                              className="w-full cursor-pointer rounded-xl border-0 bg-transparent py-2 text-xs font-medium text-[color:var(--console-accent-strong)] hover:bg-white"
                            >
                              Xem tất cả {qy.data?.total}
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ) : list.isError ? (
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
            pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, showSizeChanger: false, onChange: (p) => setParam('page', String(p)) }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {stage === 'all' && !jobId && !q ? 'Chưa có hồ sơ nào. Hồ sơ sẽ xuất hiện khi ứng viên nộp vào tin của bạn.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>
      </div>

      <ApplicationWorkbench applicationId={openId} audience="client" onClose={() => setParam('open', undefined)} />
    </div>
  );
};

export default ClientCandidatesPage;
