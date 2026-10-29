/**
 * @file ClientCandidatesPage.tsx
 * @description Client Company applications (GET /recruitment/applications, scoped by the backend:
 * CV_APPLICATION jobs plus HEADHUNT_COD / CV_SOURCING applications Internal HR has shortlisted).
 * Redesign 21/10 (ui-ux-pro-max): one toolbar (job, service, search, view), a single-row stage strip
 * that groups the stages, AI score with its tier, and a "next step" column. Filters live in the URL;
 * a row opens the shared ApplicationWorkbench, which shows the actions the backend allows.
 */
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AppstoreOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { screeningApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { RecruitmentApplicationItem } from '@/types/api/hr';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { Initials, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { applicationStatusOf, SERVICE_TYPE } from '@/features/hr-console/hrLabels';

const PAGE_SIZE = 10;

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

/** The stage strip: each cell groups the application statuses a Client thinks of as one step. */
const GROUPS = [
  { key: 'all', label: 'Tất cả', statuses: [] as string[] },
  { key: 'review', label: 'Cần xem', statuses: ['SUBMITTED', 'SCREENING'] },
  { key: 'shortlisted', label: 'Đã chọn', statuses: ['SHORTLISTED'] },
  { key: 'interview', label: 'Phỏng vấn', statuses: ['INTERVIEW', 'BACKUP'] },
  { key: 'offer', label: 'Offer', statuses: ['OFFER_PENDING', 'OFFER_ACCEPTED'] },
  { key: 'placed', label: 'Đã đi làm', statuses: ['PLACED'] },
  {
    key: 'closed',
    label: 'Kết thúc',
    statuses: ['REJECTED', 'BACKUP_NOT_SELECTED', 'INTERVIEW_FAILED', 'OFFER_DECLINED', 'NOT_STARTED', 'WITHDRAWN'],
  },
] as const;
type GroupKey = (typeof GROUPS)[number]['key'];
/** Cells that ask the Client to act; they are tinted when not empty. */
const ACTION_GROUPS: GroupKey[] = ['review', 'shortlisted', 'offer'];
const statusParam = (key: GroupKey) => {
  const g = GROUPS.find((x) => x.key === key)!;
  return g.statuses.length ? g.statuses.join(',') : undefined;
};

const SERVICES = [
  { value: 'all', label: 'Tất cả dịch vụ' },
  { value: 'CV_APPLICATION', label: SERVICE_TYPE.CV_APPLICATION },
  { value: 'HEADHUNT_COD', label: SERVICE_TYPE.HEADHUNT_COD },
  { value: 'CV_SOURCING', label: SERVICE_TYPE.CV_SOURCING },
];
const SERVICE_SHORT: Record<string, string> = { CV_APPLICATION: 'AP', HEADHUNT_COD: 'HH', CV_SOURCING: 'SS' };

/** Board columns: the active hiring stages, left to right. Closed ones stay in the list view. */
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

/** Tier labels follow match_tier_config (HIGH ≥ 80, MEDIUM_HIGH 70–79, MEDIUM 60–69, LOW < 60). */
const TIER: Record<string, { label: string; cls: string }> = {
  HIGH: { label: 'Rất phù hợp', cls: 'bg-emerald-50 text-emerald-800' },
  MEDIUM_HIGH: { label: 'Khá phù hợp', cls: 'bg-sky-50 text-sky-800' },
  MEDIUM: { label: 'Phù hợp một phần', cls: 'bg-amber-50 text-amber-800' },
  LOW: { label: 'Ít phù hợp', cls: 'bg-slate-100 text-slate-600' },
};

/** AI score rendered as a sleek mini progress bar with percentage. */
export const AiScore: React.FC<{ score: number | null; tier?: string | null; status?: string | null; compact?: boolean }> = ({
  score,
  tier,
  status,
  compact,
}) => {
  if (score == null) {
    const st = status?.toUpperCase();
    if (st === 'PENDING' || st === 'PROCESSING') return <span className="text-xs text-blue-600 font-medium">Đang chấm…</span>;
    return <span className="text-xs text-slate-400">Chưa có điểm</span>;
  }
  const rounded = Math.round(score);
  const t = tier ? TIER[tier.toUpperCase()] : undefined;
  const barColor =
    rounded >= 80 ? 'bg-emerald-500' : rounded >= 60 ? 'bg-blue-500' : rounded >= 40 ? 'bg-amber-500' : 'bg-slate-400';
  const textColor =
    rounded >= 80 ? 'text-emerald-700' : rounded >= 60 ? 'text-blue-700' : rounded >= 40 ? 'text-amber-700' : 'text-slate-600';

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap" title={t?.label ? `Điểm AI: ${rounded}% (${t.label})` : `Điểm AI: ${rounded}%`}>
      <div className={`${compact ? 'w-10' : 'w-16'} h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{rounded}%</span>
      {t && <span className="sr-only">{t.label}</span>}
    </div>
  );
};

/** The one thing the Client is expected to do next, if anything. */
export const nextStepOf = (r: Pick<RecruitmentApplicationItem, 'status' | 'serviceTypeCode' | 'sourcingDeliveryStatus'>): { label: string; urgent: boolean } | null => {
  const status = r.status.toUpperCase();
  if (r.serviceTypeCode === 'CV_SOURCING' && r.sourcingDeliveryStatus === 'DELIVERED') return { label: 'Phản hồi CV', urgent: true };
  switch (status) {
    case 'SUBMITTED':
    case 'SCREENING':
      return { label: 'Xem và chọn', urgent: true };
    case 'SHORTLISTED':
      return { label: 'Lên lịch phỏng vấn', urgent: true };
    case 'INTERVIEW':
      return { label: 'Ghi kết quả phỏng vấn', urgent: false };
    case 'BACKUP':
      return { label: 'Quyết định dự phòng', urgent: false };
    case 'OFFER_PENDING':
      return { label: 'Gửi offer', urgent: true };
    case 'OFFER_ACCEPTED':
      return { label: 'Xác nhận đi làm', urgent: true };
    default:
      return null;
  }
};

export const ClientCandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?status=CODE (links from Tổng quan) filters one exact status and highlights its strip cell.
  const exactStatus = searchParams.get('status')?.toUpperCase() || undefined;
  const group: GroupKey = (GROUPS.find((g) => g.key === searchParams.get('stage'))?.key ??
    (exactStatus ? GROUPS.find((g) => (g.statuses as readonly string[]).includes(exactStatus))?.key : undefined) ??
    'all') as GroupKey;
  const jobId = searchParams.get('job') ?? undefined;
  const service = searchParams.get('service') ?? undefined;
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const openId = searchParams.get('open') ?? undefined;
  // The CV list is the default; the stage board is opt-in (?view=board).
  const view: 'board' | 'list' = searchParams.get('view') === 'board' ? 'board' : 'list';
  const jobs = useMyJobs();

  const setParams = (changes: Record<string, string | undefined>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes) && !('open' in changes)) next.delete('page');
    setSearchParams(next, { replace });
  };
  const setParam = (key: string, value?: string) => setParams({ [key]: value }, key === 'open');

  const scope = { jobId, serviceTypeCode: service };

  // One small count per strip cell (cached); together they show where candidates wait.
  const counts = useQueries({
    queries: GROUPS.map((g) => ({
      queryKey: ['client-candidates', 'count', g.key, jobId ?? '', service ?? ''],
      queryFn: async () => (await screeningApi.list({ ...scope, status: statusParam(g.key), page: 1, pageSize: 1 })).total,
    })),
  });

  const jobOptions = (jobs.data ?? [])
    .filter((j) => ['ACTIVE', 'PAUSED', 'CLOSED'].includes(j.status) && (!service || j.serviceTypeCode === service))
    .sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  const selectedJob = (jobs.data ?? []).find((j) => j.jobId === jobId);

  const boardQueries = useQueries({
    queries: BOARD.map((b) => ({
      queryKey: ['client-candidates', 'board', b.code, jobId ?? '', service ?? '', q],
      queryFn: () => screeningApi.list({ ...scope, status: b.code, candidateName: q || undefined, page: 1, pageSize: BOARD_LIMIT }),
      enabled: view === 'board',
    })),
  });

  const list = useQuery({
    queryKey: ['client-candidates', 'list', exactStatus ?? group, jobId ?? '', service ?? '', q, page],
    queryFn: () => screeningApi.list({ ...scope, status: exactStatus ?? statusParam(group), candidateName: q || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
    enabled: view === 'list',
  });

  const columns: ColumnsType<RecruitmentApplicationItem> = [
    {
      title: 'Ứng viên',
      key: 'c',
      render: (_, r) => (
        <div>
          <PersonCell name={r.candidateName} secondary={r.candidateEmail} />
          <div className="mt-0.5 pl-[42px] text-xs text-slate-500">cập nhật {dayjs(r.updatedAt ?? r.appliedAt).fromNow()}</div>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      key: 'j',
      render: (_, r) => (
        <div className="max-w-[280px]">
          <div className="truncate font-medium text-slate-900">{r.jobTitle}</div>
          {r.serviceTypeCode && <div className="text-xs text-slate-500">{SERVICE_SHORT[r.serviceTypeCode] ?? r.serviceTypeCode}</div>}
        </div>
      ),
    },
    { title: 'Điểm AI', key: 'ai', width: 170, render: (_, r) => <AiScore score={r.aiMatchScore} tier={r.aiMatchTier} status={r.aiStatus} /> },
    {
      title: 'Giai đoạn',
      dataIndex: 'status',
      width: 170,
      render: (v: string, r) => {
        const st = applicationStatusOf(v, r.serviceTypeCode, r.sourcingDeliveryStatus);
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
    {
      title: 'Việc tiếp theo',
      key: 'next',
      width: 190,
      render: (_, r) => {
        const step = nextStepOf(r);
        if (!step) return <span className="text-xs text-slate-400">—</span>;
        return (
          <Button
            size="small"
            type={step.urgent ? 'primary' : 'default'}
            ghost={step.urgent}
            onClick={(e) => {
              e.stopPropagation();
              setParam('open', r.applicationId);
            }}
          >
            {step.label}
          </Button>
        );
      },
    },
  ];

  const filtered = Boolean(jobId || service || q || exactStatus || group !== 'all');

  return (
    <div>
      <PageHero
        eyebrow="Tuyển dụng"
        title="Hồ sơ ứng viên"
        description="Mọi hồ sơ vào tin của bạn. Mở hồ sơ để xem đánh giá AI, lên lịch phỏng vấn, gửi offer và xác nhận đi làm."
        actions={
          <Button icon={<ReloadOutlined />} size="large" onClick={() => (view === 'list' ? list.refetch() : boardQueries.forEach((b) => b.refetch()))}>
            Tải lại
          </Button>
        }
      />

      <Surface>
        <div className="space-y-4 px-5 pb-4 pt-5">
          {/* Toolbar: job, service, search, view */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              size="large"
              showSearch
              allowClear
              className="w-full sm:w-[300px]"
              placeholder="Tất cả tin tuyển dụng"
              aria-label="Chọn tin tuyển dụng"
              loading={jobs.isLoading}
              value={jobId}
              onChange={(v) => setParam('job', v)}
              optionFilterProp="label"
              options={jobOptions.map((j) => ({
                value: j.jobId,
                label: `${j.title || 'Vị trí chưa đặt tên'}${j.status !== 'ACTIVE' ? ' (đã dừng)' : ''}`,
              }))}
            />
            <Select
              size="large"
              className="w-full sm:w-[200px]"
              aria-label="Lọc theo dịch vụ"
              value={service ?? 'all'}
              onChange={(v) => setParams({ service: v === 'all' ? undefined : v, job: selectedJob && v !== 'all' && selectedJob.serviceTypeCode !== v ? undefined : jobId })}
              options={SERVICES}
            />
            <div key={q} className="min-w-[200px] flex-1">
              <Input
                size="large"
                allowClear
                defaultValue={q}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm ứng viên, nhấn Enter"
                onPressEnter={(e) => setParam('q', (e.target as HTMLInputElement).value.trim() || undefined)}
                onChange={(e) => !e.target.value && q && setParam('q', undefined)}
                aria-label="Tìm theo tên ứng viên"
              />
            </div>
            <div role="radiogroup" aria-label="Kiểu hiển thị" className="inline-flex rounded-full bg-slate-100 p-1">
              {(
                [
                  ['list', <UnorderedListOutlined key="l" />, 'Danh sách'],
                  ['board', <AppstoreOutlined key="b" />, 'Bảng'],
                ] as const
              ).map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setParams({ view: v === 'board' ? 'board' : undefined }, true)}
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

          {selectedJob?.serviceTypeCode === 'CV_SOURCING' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-solid border-teal-200 bg-teal-50/70 p-3.5">
              <div className="text-xs text-teal-950">
                <span className="block text-sm font-bold text-teal-900">Vị trí này thuộc dịch vụ CV Sourcing</span>
                <span>Hồ sơ được HR Connect sàng lọc và bàn giao; bạn phản hồi từng CV trong thời hạn xem xét.</span>
              </div>
              <Button size="small" onClick={() => navigate(`/client/jobs/${selectedJob.jobId}/sourcing`)}>
                Xem tiến độ và phản hồi CV
              </Button>
            </div>
          )}

          {/* Stage strip: one row, each cell a filter; cells that need the Client are tinted */}
          {view === 'list' && (
            <div role="radiogroup" aria-label="Lọc theo giai đoạn" className="grid grid-cols-3 overflow-hidden rounded-xl border border-solid border-slate-200 sm:grid-cols-7">
              {GROUPS.map((g, i) => {
                const n = counts[i].data;
                const selected = group === g.key;
                const needsAction = ACTION_GROUPS.includes(g.key) && (n ?? 0) > 0;
                return (
                  <button
                    key={g.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setParams({ stage: g.key === 'all' ? undefined : g.key, status: undefined })}
                    className={`cursor-pointer border-0 border-r border-solid border-slate-200 px-3 py-2.5 text-left transition-colors last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--console-accent)] ${
                      selected
                        ? 'bg-[color:var(--console-accent-soft)] shadow-[inset_0_-2px_0_var(--console-accent)]'
                        : needsAction
                          ? 'bg-orange-50/60 hover:bg-orange-50'
                          : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`block text-xs ${selected ? 'font-semibold text-[color:var(--console-accent-strong)]' : 'text-slate-600'}`}>
                      {g.label}
                      {needsAction && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 align-middle" aria-label="cần xử lý" />}
                    </span>
                    <span className="mt-0.5 block text-xl font-bold tabular-nums text-slate-900">{counts[i].isLoading ? '–' : n ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}
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
                                <Tooltip title="Điểm phù hợp do AI chấm">
                                  <span>
                                    <AiScore score={a.aiMatchScore} tier={a.aiMatchTier} status={a.aiStatus} compact />
                                  </span>
                                </Tooltip>
                                <span className="text-[11px] text-slate-500">{dayjs(a.updatedAt ?? a.appliedAt).fromNow()}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {(qy.data?.total ?? 0) > items.length && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setParams({ view: undefined, stage: GROUPS.find((g) => (g.statuses as readonly string[]).includes(b.code))?.key }, false)}
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
            pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, showSizeChanger: false, hideOnSinglePage: true, onChange: (p) => setParam('page', String(p)) }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {!filtered ? 'Chưa có hồ sơ nào. Hồ sơ sẽ xuất hiện khi ứng viên nộp vào tin của bạn.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>

      <ApplicationWorkbench applicationId={openId} audience="client" onClose={() => setParam('open', undefined)} />
    </div>
  );
};

export default ClientCandidatesPage;
