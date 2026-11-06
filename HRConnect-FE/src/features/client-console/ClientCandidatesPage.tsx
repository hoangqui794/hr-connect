/**
 * @file ClientCandidatesPage.tsx
 * @description Client Company applications (GET /recruitment/applications, scoped by the backend:
 * CV_APPLICATION jobs plus HEADHUNT_COD / CV_SOURCING applications Internal HR has shortlisted).
 * Redesign: modern Studio header, high-craft stage pipeline strip, AI score with tier indicator,
 * actionable next-step button, unified filter toolbar with view toggle (Table / Kanban Board).
 * Follows Vercel Web Interface Guidelines and Anthropic Frontend Design principles.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Skeleton, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { screeningApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { RecruitmentApplicationItem } from '@/types/api/hr';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { Initials, StatusDot, Surface } from '@/features/admin-console/ui';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { applicationStatusOf, SERVICE_TYPE } from '@/features/hr-console/hrLabels';
import { SERVICE_TYPE_LABEL } from '@/features/jobs-mf01/jobDisplay';
import type { ServiceTypeCode } from '@/types/api/jobs';

const PAGE_SIZE = 10;
const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

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
  HIGH: { label: 'Rất phù hợp', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200/80' },
  MEDIUM_HIGH: { label: 'Khá phù hợp', cls: 'bg-sky-50 text-sky-800 border-sky-200/80' },
  MEDIUM: { label: 'Phù hợp một phần', cls: 'bg-amber-50 text-amber-800 border-amber-200/80' },
  LOW: { label: 'Ít phù hợp', cls: 'bg-slate-100 text-slate-600 border-slate-200/80' },
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
    if (st === 'PENDING' || st === 'PROCESSING') return <span className="text-xs text-[#0C4A6E] font-medium">Đang chấm…</span>;
    return <span className="text-xs text-slate-400 font-medium">Chưa có điểm</span>;
  }
  const rounded = Math.round(score);
  const t = tier ? TIER[tier.toUpperCase()] : undefined;
  const barColor =
    rounded >= 80
      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
      : rounded >= 60
      ? 'bg-gradient-to-r from-blue-500 to-sky-500'
      : rounded >= 40
      ? 'bg-gradient-to-r from-amber-500 to-orange-400'
      : 'bg-slate-400';
  const textColor =
    rounded >= 80 ? 'text-emerald-700' : rounded >= 60 ? 'text-blue-700' : rounded >= 40 ? 'text-amber-700' : 'text-slate-600';

  return (
    <div
      className="inline-flex flex-col gap-1"
      title={t?.label ? `Điểm AI: ${rounded}% (${t.label})` : `Điểm AI: ${rounded}%`}
    >
      <div className="inline-flex items-center gap-2 whitespace-nowrap">
        <div className={`${compact ? 'w-10' : 'w-16'} h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 ring-1 ring-black/5`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }}
          />
        </div>
        <span className={`text-xs font-bold tabular-nums min-w-[32px] ${textColor}`}>{rounded}%</span>
      </div>
      {t && (
        <span className={`inline-block text-[10.5px] font-semibold px-1.5 py-0.5 rounded border leading-none w-fit ${t.cls}`}>
          {t.label}
        </span>
      )}
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
  const exactStatus = searchParams.get('status')?.toUpperCase() || undefined;
  const group: GroupKey = (GROUPS.find((g) => g.key === searchParams.get('stage'))?.key ??
    (exactStatus ? GROUPS.find((g) => (g.statuses as readonly string[]).includes(exactStatus))?.key : undefined) ??
    'all') as GroupKey;
  const jobId = searchParams.get('job') ?? undefined;
  const service = searchParams.get('service') ?? undefined;
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const urlOpenId = searchParams.get('open') ?? undefined;
  const view: 'board' | 'list' = searchParams.get('view') === 'board' ? 'board' : 'list';
  const jobs = useMyJobs();

  // Local state for modal workbench so opening drawer doesn't reload page or displace behind screen
  const [activeAppId, setActiveAppId] = useState<string | undefined>(urlOpenId);

  // Sync urlOpenId if it arrives from outside navigation
  React.useEffect(() => {
    if (urlOpenId !== activeAppId) {
      setActiveAppId(urlOpenId);
    }
  }, [urlOpenId]);

  const setParams = (changes: Record<string, string | undefined>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes) && !('open' in changes)) next.delete('page');
    setSearchParams(next, { replace });
  };
  const setParam = (key: string, value?: string) => setParams({ [key]: value }, key === 'open');

  const handleOpenCandidate = (appId: string) => {
    setActiveAppId(appId);
    setParam('open', appId);
  };

  const handleCloseCandidate = () => {
    setActiveAppId(undefined);
    setParam('open', undefined);
  };

  const scope = { jobId, serviceTypeCode: service };

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
      width: 280,
      render: (_, r) => (
        <div className="flex items-start gap-3 py-1">
          <Initials name={r.candidateName} size={38} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="truncate text-[14px] font-bold text-slate-900 hover:text-[#0C4A6E] transition-colors">
              {r.candidateName}
            </div>
            <div className="truncate text-[12px] text-slate-500">{r.candidateEmail || 'Chưa có email'}</div>
            <div className="text-[11px] text-slate-400">cập nhật {dayjs(r.updatedAt ?? r.appliedAt).fromNow()}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      key: 'j',
      width: 270,
      render: (_, r) => {
        const s = r.serviceTypeCode ? SERVICE_TYPE_LABEL[r.serviceTypeCode as ServiceTypeCode] : null;
        const color = r.serviceTypeCode === 'HEADHUNT_COD' ? 'blue' : r.serviceTypeCode === 'CV_SOURCING' ? 'purple' : 'cyan';
        return (
          <div className="max-w-[270px] space-y-1.5 py-1">
            <div className="truncate font-semibold text-slate-900 text-[13.5px]" title={r.jobTitle}>
              {r.jobTitle}
            </div>
            {s && (
              <span className="inline-block">
                <Tag color={color} className="m-0 text-[11px] font-medium border-0 px-2 py-0.5 rounded">
                  {s.short} · {s.label}
                </Tag>
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Điểm AI',
      key: 'ai',
      width: 170,
      render: (_, r) => (
        <div className="py-1">
          <AiScore score={r.aiMatchScore} tier={r.aiMatchTier} status={r.aiStatus} />
        </div>
      ),
    },
    {
      title: 'Giai đoạn',
      dataIndex: 'status',
      width: 170,
      render: (v: string, r) => {
        const st = applicationStatusOf(v, r.serviceTypeCode, r.sourcingDeliveryStatus);
        return (
          <div className="py-1 inline-flex items-center">
            <StatusDot tone={st.tone}>{st.label}</StatusDot>
          </div>
        );
      },
    },
    {
      title: 'Việc tiếp theo',
      key: 'next',
      width: 170,
      render: (_, r) => {
        const step = nextStepOf(r);
        if (!step) {
          return (
            <div className="flex h-8 w-[130px] items-center justify-center text-slate-300">
              <span>—</span>
            </div>
          );
        }
        return (
          <Button
            size="middle"
            type={step.urgent ? 'primary' : 'default'}
            ghost={step.urgent}
            className={`w-[135px] !h-8 text-xs font-semibold rounded-lg shadow-2xs transition-all ${
              step.urgent
                ? '!border-[#0C4A6E] !text-[#0C4A6E] hover:!bg-[#0C4A6E] hover:!text-white'
                : '!border-slate-200 text-slate-700 hover:!border-slate-300 hover:bg-slate-50'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenCandidate(r.applicationId);
            }}
          >
            {step.label}
          </Button>
        );
      },
    },
  ];

  const filtered = Boolean(jobId || service || q || exactStatus || group !== 'all');

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className={`${FONT} space-y-6 max-w-full animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── 1. Studio Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
              Hồ Sơ Ứng Viên
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-[#0C4A6E] border border-sky-200/80 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0C4A6E] animate-pulse" />
              {view === 'list' ? `${list.data?.total ?? 0} hồ sơ` : 'Bảng Kanban'}
            </span>
          </div>
          <p className="m-0 text-sm text-slate-500 max-w-2xl">
            Đối soát điểm AI Match, theo dõi lộ trình tuyển dụng và ra quyết định hẹn lịch hoặc gửi offer cho ứng viên.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            icon={<ReloadOutlined className={list.isFetching ? 'animate-spin' : ''} />}
            aria-label="Tải lại danh sách"
            className="!h-10 !rounded-xl border-slate-200 hover:!border-slate-300 font-semibold text-slate-700 bg-white shadow-2xs hover:shadow-xs transition-all"
            onClick={() => (view === 'list' ? list.refetch() : boardQueries.forEach((b) => b.refetch()))}
          >
            Tải lại
          </Button>
        </div>
      </div>

      <Surface className="rounded-2xl border border-solid border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] bg-white overflow-hidden">
        <div className="space-y-4 px-5 pb-4 pt-5">
          {/* ── 2. Unified Filter Toolbar ── */}
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
              className="w-full sm:w-[190px]"
              aria-label="Lọc theo dịch vụ"
              value={service ?? 'all'}
              onChange={(v) =>
                setParams({
                  service: v === 'all' ? undefined : v,
                  job: selectedJob && v !== 'all' && selectedJob.serviceTypeCode !== v ? undefined : jobId,
                })
              }
              options={SERVICES}
            />
            <div key={q} className="min-w-[220px] flex-1">
              <Input
                size="large"
                allowClear
                defaultValue={q}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm ứng viên theo tên, email... (Enter)"
                onPressEnter={(e) => setParam('q', (e.target as HTMLInputElement).value.trim() || undefined)}
                onChange={(e) => !e.target.value && q && setParam('q', undefined)}
                aria-label="Tìm theo tên ứng viên"
                className="!rounded-xl"
              />
            </div>

            {filtered && (
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilters}
                className="!h-10 !rounded-xl border-dashed border-slate-300 text-slate-600 hover:!border-rose-400 hover:!text-rose-600 font-medium"
              >
                Xóa bộ lọc
              </Button>
            )}

            {/* View Mode Switch */}
            <div
              role="radiogroup"
              aria-label="Kiểu hiển thị"
              className="inline-flex h-10 items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/60"
            >
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
                  className={`flex h-8 cursor-pointer items-center gap-2 rounded-lg border-0 px-3.5 text-[13px] font-medium transition-all ${
                    view === v
                      ? 'bg-white text-[#0C4A6E] shadow-2xs font-bold'
                      : 'bg-transparent text-slate-600 hover:text-slate-900'
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
              <Button
                size="small"
                className="font-medium !rounded-md"
                onClick={() => navigate(`/client/jobs/${selectedJob.jobId}/sourcing`)}
              >
                Xem tiến độ và phản hồi CV
              </Button>
            </div>
          )}

          {/* ── 3. Stage Pipeline Strip: Interactive Process Cards ── */}
          {view === 'list' && (
            <div
              role="radiogroup"
              aria-label="Lọc theo giai đoạn"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 rounded-2xl bg-slate-50/80 p-1.5 border border-slate-200/80"
            >
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
                    className={`group relative cursor-pointer rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0C4A6E] ${
                      selected
                        ? 'border-[#0C4A6E] bg-white shadow-sm ring-2 ring-[#0C4A6E]/20'
                        : needsAction
                        ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/60 to-amber-50/20 hover:bg-white hover:border-slate-300'
                        : 'border-transparent bg-transparent hover:bg-white hover:border-slate-200 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs ${
                          selected ? 'font-bold text-[#0C4A6E]' : 'font-medium text-slate-600'
                        }`}
                      >
                        {g.label}
                      </span>
                      {needsAction && (
                        <span className="flex h-2.5 w-2.5 items-center justify-center" aria-label="cần xử lý">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-1.5 text-2xl font-black tabular-nums tracking-tight ${
                        selected ? 'text-[#0C4A6E]' : 'text-slate-900'
                      }`}
                    >
                      {counts[i].isLoading ? '–' : n ?? 0}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 4. Main Content: Board or Table ── */}
        {view === 'board' ? (
          <div className="overflow-x-auto px-5 pb-5" role="region" aria-label="Bảng ứng viên theo giai đoạn" tabIndex={0}>
            <div className="flex min-w-max gap-3.5 pt-1">
              {BOARD.map((b, i) => {
                const qy = boardQueries[i];
                const items = qy.data?.items ?? [];
                return (
                  <section
                    key={b.code}
                    aria-label={b.label}
                    className="flex w-[260px] shrink-0 flex-col rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3"
                  >
                    <header className="mb-2.5 flex items-center justify-between px-1">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                        <span className={`h-2.5 w-2.5 rounded-full ${b.dot} shadow-2xs`} aria-hidden />
                        {b.label}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-2xs border border-slate-200/60">
                        {qy.data?.total ?? 0}
                      </span>
                    </header>
                    {qy.isLoading ? (
                      <Skeleton active paragraph={{ rows: 2 }} title={false} className="px-1.5" />
                    ) : items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                        Chưa có ứng viên
                      </div>
                    ) : (
                      <ul className="m-0 list-none space-y-2.5 p-0">
                        {items.map((a) => (
                          <li key={a.applicationId}>
                            <button
                              type="button"
                              onClick={() => handleOpenCandidate(a.applicationId)}
                              className="client-soft-card group flex w-full cursor-pointer flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-3.5 text-left shadow-2xs transition-all duration-200 hover:border-[#0C4A6E]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0C4A6E]"
                            >
                              <span className="flex items-center gap-2.5">
                                <Initials name={a.candidateName} size={32} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13.5px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors">
                                    {a.candidateName}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">{a.jobTitle}</span>
                                </span>
                              </span>
                              <span className="flex items-center justify-between pt-1 border-t border-slate-100">
                                <Tooltip title="Điểm phù hợp do AI chấm">
                                  <span>
                                    <AiScore score={a.aiMatchScore} tier={a.aiMatchTier} status={a.aiStatus} compact />
                                  </span>
                                </Tooltip>
                                <span className="text-[11px] text-slate-400">{dayjs(a.updatedAt ?? a.appliedAt).fromNow()}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {(qy.data?.total ?? 0) > items.length && (
                          <li>
                            <button
                              type="button"
                              onClick={() =>
                                setParams(
                                  {
                                    view: undefined,
                                    stage: GROUPS.find((g) => (g.statuses as readonly string[]).includes(b.code))?.key,
                                  },
                                  false
                                )
                              }
                              className="w-full cursor-pointer rounded-xl border border-slate-200/60 bg-white py-2 text-xs font-semibold text-[#0C4A6E] hover:bg-sky-50/50 shadow-2xs transition-all"
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
              onClick: () => handleOpenCandidate(r.applicationId),
              onKeyDown: (e) => e.key === 'Enter' && handleOpenCandidate(r.applicationId),
              tabIndex: 0,
              className: 'cursor-pointer hover:bg-sky-50/40 transition-colors',
            })}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: list.data?.total ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => setParam('page', String(p)),
            }}
            locale={{
              emptyText: (
                <div className="py-12 text-center text-slate-500 text-[13.5px]">
                  {!filtered ? 'Chưa có hồ sơ nào. Hồ sơ sẽ xuất hiện khi ứng viên nộp vào tin của bạn.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>

      {/* ── 5. Application Workbench Drawer ── */}
      <ApplicationWorkbench applicationId={activeAppId} audience="client" onClose={handleCloseCandidate} />
    </div>
  );
};

export default ClientCandidatesPage;
