/**
 * @file ClientInterviewsOffersPage.tsx
 * @description Client Company Interviews, Offers and Placements Management Hub.
 * Adheres to Anthropic Frontend Design and Vercel Web Interface Guidelines:
 *  - Executive Studio Header with hiring pace indicators
 *  - 3 High-craft Segmented Process Stage Cards (Interviews -> Offers -> Placements)
 *  - Smart Search & Filter Toolbar (Keyword, Job Filter, Status Filter)
 *  - Ergonomic Data Tables with visual date badges, compensation pills, and primary CTAs
 *  - Seamless integration with ClientInterviewDetailDrawer and ApplicationWorkbench
 */
import React, { useEffect, useMemo, useState } from 'react';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, Select, Skeleton, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { pipelineApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { InterviewItem, OfferItem, PlacementItem } from '@/types/api/hr';
import { PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { INTERVIEW_RESULT, INTERVIEW_STATUS, OFFER_STATUS, PLACEMENT_STATUS, pick } from '@/features/hr-console/hrLabels';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { ClientInterviewDetailDrawer } from '@/features/client-console/ClientInterviewDetailDrawer';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const PAGE_SIZE = 10;

type TabKey = 'interviews' | 'offers' | 'placements';
const TABS: TabKey[] = ['interviews', 'offers', 'placements'];

const money = (v: number | null, currency = 'VND') =>
  v == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(v)} ${currency === 'VND' ? '₫' : currency}`;

export const ClientInterviewsOffersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultStatusForTab = (t: TabKey) => (t === 'interviews' ? 'SCHEDULED' : 'all');

  const [tab, setTab] = useState<TabKey>(() => {
    const initial = searchParams.get('tab');
    return initial && (TABS as string[]).includes(initial) ? (initial as TabKey) : 'interviews';
  });

  const page = Number(searchParams.get('page')) || 1;
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get('open'));
  const [openInterviewId, setOpenInterviewId] = useState<string | null>(() => searchParams.get('interview'));

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return searchParams.get('status') || defaultStatusForTab(tab);
  });

  // Đồng bộ từ URL vào State nếu người dùng điều hướng back/forward hoặc đổi link
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && (TABS as string[]).includes(urlTab)) {
      setTab((prev) => (prev !== urlTab ? (urlTab as TabKey) : prev));
    }
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter((prev) => (prev !== urlStatus ? urlStatus : prev));
    }
  }, [searchParams]);

  const handleSetOpenInterviewId = (id: string | null) => {
    setOpenInterviewId(id);
  };

  const setOpen = (id?: string) => {
    setOpenId(id || null);
  };

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');

  const { data: myJobs = [], isLoading: loadingJobs } = useMyJobs();

  // Queries for counts
  const interviewScheduledCountQ = useQuery({
    queryKey: ['client-pipeline', 'count', 'interviews', 'SCHEDULED'],
    queryFn: async () => (await pipelineApi.interviews({ status: 'SCHEDULED', page: 1, pageSize: 1 })).total,
  });
  const interviewAllCountQ = useQuery({
    queryKey: ['client-pipeline', 'count', 'interviews', 'all'],
    queryFn: async () => (await pipelineApi.interviews({ page: 1, pageSize: 1 })).total,
  });
  const offerCountQ = useQuery({
    queryKey: ['client-pipeline', 'count', 'offers'],
    queryFn: async () => (await pipelineApi.offers({ page: 1, pageSize: 1 })).total,
  });
  const placementCountQ = useQuery({
    queryKey: ['client-pipeline', 'count', 'placements'],
    queryFn: async () => (await pipelineApi.placements({ page: 1, pageSize: 1 })).total,
  });

  // Query for current tab data
  const listQ = useQuery({
    queryKey: ['client-pipeline', tab, page, statusFilter === 'all' ? undefined : statusFilter],
    queryFn: async () => {
      const st = statusFilter === 'all' ? undefined : statusFilter;
      if (tab === 'interviews') {
        return await pipelineApi.interviews({ page, pageSize: PAGE_SIZE, status: st });
      }
      if (tab === 'offers') {
        return await pipelineApi.offers({ page, pageSize: PAGE_SIZE, status: st });
      }
      return await pipelineApi.placements({ page, pageSize: PAGE_SIZE, status: st });
    },
  });

  const switchTab = (nextTab: TabKey) => {
    setTab(nextTab);
    const defStatus = defaultStatusForTab(nextTab);
    setStatusFilter(defStatus);
    setOpenId(null);
    setOpenInterviewId(null);
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    next.set('status', defStatus);
    next.delete('page');
    next.delete('open');
    next.delete('interview');
    setSearchParams(next, { replace: true });
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.set('status', nextStatus);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.set('page', String(p));
    setSearchParams(next);
  };

  // Filter items locally by search keyword and job
  const filteredItems = useMemo(() => {
    const rawItems = (listQ.data?.items ?? []) as any[];
    return rawItems.filter((item) => {
      // 1. Job filter
      if (selectedJobId !== 'all') {
        const itemJobId = item.jobId || item.job?.jobId;
        const itemJobTitle = item.jobTitle || item.job?.title;
        const targetJob = myJobs.find((j) => j.jobId === selectedJobId);
        if (targetJob) {
          if (itemJobId && itemJobId !== selectedJobId) return false;
          if (itemJobTitle && itemJobTitle !== targetJob.title) return false;
        }
      }

      // 2. Keyword filter
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const candName = (item.candidateName || item.candidate?.fullName || '').toLowerCase();
        const candEmail = (item.candidateEmail || item.candidate?.email || '').toLowerCase();
        const jobTitle = (item.jobTitle || item.job?.title || '').toLowerCase();
        if (!candName.includes(q) && !candEmail.includes(q) && !jobTitle.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [listQ.data?.items, selectedJobId, searchKeyword, myJobs]);

  // ── Columns Definitions ──────────────────────────────────────────
  const interviewColumns: ColumnsType<InterviewItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 260,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold text-[#0C4A6E] border border-sky-100">
              {r.candidateName ? r.candidateName.charAt(0).toUpperCase() : <UserOutlined />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900 text-[13.5px] leading-tight">
                {r.candidateName}
              </div>
              <div className="truncate text-xs text-slate-500 mt-0.5">{r.candidateEmail || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        title: 'Vị trí tuyển dụng',
        key: 'j',
        width: 250,
        render: (_, r) => (
          <div className="py-1">
            <span className="line-clamp-2 font-semibold text-slate-800 text-[13px] leading-snug">
              {r.jobTitle}
            </span>
          </div>
        ),
      },
      {
        title: 'Vòng phỏng vấn',
        dataIndex: 'interviewRound',
        width: 120,
        align: 'center',
        render: (v) => (
          <span className="inline-flex items-center rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-[#0C4A6E] border border-sky-100">
            Vòng {v}
          </span>
        ),
      },
      {
        title: 'Thời gian hẹn',
        dataIndex: 'scheduledAt',
        width: 170,
        align: 'center',
        render: (v) => {
          if (!v) return <span className="text-slate-400 text-xs">—</span>;
          const dt = dayjs(v);
          const isToday = dt.isSame(dayjs(), 'day');
          return (
            <div className="inline-flex items-center gap-2.5 py-0.5">
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-[#0C4A6E] uppercase">{dt.format('MMM')}</span>
                <span className="text-sm font-black leading-none text-slate-900">{dt.format('DD')}</span>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                  <ClockCircleOutlined className="text-[#0C4A6E]" />
                  <span>{dt.format('HH:mm')}</span>
                </div>
                {isToday && (
                  <span className="inline-block rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 border border-amber-200">
                    Hôm nay
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: 'Trạng thái & Kết quả',
        key: 's',
        width: 200,
        render: (_, r) => {
          const st = pick(INTERVIEW_STATUS, r.status);
          const res = r.result ? INTERVIEW_RESULT[r.result] ?? r.result : null;
          return (
            <div className="py-1 space-y-1">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
              {res && (
                <div className="text-xs pl-3.5">
                  <span className="text-slate-500">Kết quả: </span>
                  <span
                    className={`font-bold ${
                      r.result === 'PASS'
                        ? 'text-emerald-700'
                        : r.result === 'FAIL'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {res}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 140,
        align: 'right',
        render: (_, r) => (
          <Button
            type="primary"
            size="small"
            className="!h-8 !rounded-lg !border-0 !bg-[#0C4A6E] hover:!bg-[#075985] text-white font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
            onClick={(e) => {
              e.stopPropagation();
              handleSetOpenInterviewId(r.interviewId);
            }}
          >
            Chi tiết & Đánh giá
          </Button>
        ),
      },
    ],
    []
  );

  const offerColumns: ColumnsType<OfferItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 260,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-sm font-bold text-purple-700 border border-purple-100">
              {r.candidateName ? r.candidateName.charAt(0).toUpperCase() : <UserOutlined />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900 text-[13.5px] leading-tight">
                {r.candidateName}
              </div>
              <div className="truncate text-xs text-slate-500 mt-0.5">{r.candidateEmail || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        title: 'Vị trí tuyển dụng',
        key: 'j',
        width: 250,
        render: (_, r) => (
          <div className="py-1">
            <span className="line-clamp-2 font-semibold text-slate-800 text-[13px] leading-snug">
              {r.jobTitle}
            </span>
          </div>
        ),
      },
      {
        title: 'Lương đề nghị',
        key: 'sal',
        width: 200,
        render: (_, r) => (
          <div className="py-1 space-y-0.5">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-100">
              <DollarOutlined />
              <span>{money(r.salary, r.currencyCode)}</span>
            </div>
            {r.salaryBasis && (
              <div className="text-[11px] text-slate-400 font-medium pl-1">
                Lương {r.salaryBasis} ({r.salaryPeriod === 'ANNUAL' ? 'Năm' : 'Tháng'})
              </div>
            )}
          </div>
        ),
      },
      {
        title: 'Hạn phản hồi',
        dataIndex: 'expiryDate',
        width: 140,
        align: 'center',
        render: (v) => (
          <span className="text-xs font-semibold tabular-nums text-slate-700">
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        ),
      },
      {
        title: 'Trạng thái Offer',
        key: 's',
        width: 180,
        render: (_, r) => {
          const st = pick(OFFER_STATUS, r.status);
          return (
            <div className="py-1">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
          );
        },
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 130,
        align: 'right',
        render: (_, r) => (
          <Button
            type="primary"
            size="small"
            className="!h-8 !rounded-lg !border-0 !bg-[#0C4A6E] hover:!bg-[#075985] text-white font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(r.applicationId);
            }}
          >
            Xem & gửi Offer
          </Button>
        ),
      },
    ],
    []
  );

  const placementColumns: ColumnsType<PlacementItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 260,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700 border border-emerald-100">
              {r.candidate?.fullName ? r.candidate.fullName.charAt(0).toUpperCase() : <UserOutlined />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900 text-[13.5px] leading-tight">
                {r.candidate?.fullName}
              </div>
              <div className="truncate text-xs text-slate-500 mt-0.5">{r.candidate?.email || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        title: 'Vị trí tuyển dụng',
        key: 'j',
        width: 250,
        render: (_, r) => (
          <div className="py-1">
            <span className="line-clamp-2 font-semibold text-slate-800 text-[13px] leading-snug">
              {r.job?.title}
            </span>
          </div>
        ),
      },
      {
        title: 'Chức danh tiếp nhận',
        dataIndex: 'position',
        width: 170,
        render: (v) => <span className="text-xs font-semibold text-slate-800">{v || '—'}</span>,
      },
      {
        title: 'Ngày đi làm thực tế',
        dataIndex: 'actualStartDate',
        width: 160,
        align: 'center',
        render: (v) => (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 border border-slate-200">
            <CalendarOutlined className="text-emerald-600" />
            {v ? dayjs(v).format('DD/MM/YYYY') : '—'}
          </span>
        ),
      },
      {
        title: 'Trạng thái',
        key: 's',
        width: 160,
        render: (_, r) => {
          const st = pick(PLACEMENT_STATUS, r.status);
          return (
            <div className="py-1">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
          );
        },
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 130,
        align: 'right',
        render: (_, r) => (
          <Button
            type="primary"
            size="small"
            className="!h-8 !rounded-lg !border-0 !bg-[#0C4A6E] hover:!bg-[#075985] text-white font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(r.applicationId);
            }}
          >
            Hồ sơ Onboard
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className={`${FONT} space-y-6 max-w-full animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── 1. Studio Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
              Điều hành phỏng vấn & đề nghị việc làm
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0C4A6E] border border-sky-100">
              Quy trình tuyển dụng
            </span>
          </div>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Điều phối lịch gặp gỡ ứng viên, đánh giá kết quả từng vòng, phát hành thư mời nhận việc (Offer) và xác nhận đi làm.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            icon={<ReloadOutlined />}
            aria-label="Tải lại danh sách"
            loading={listQ.isFetching}
            className="!h-10 !rounded-xl border-slate-200 hover:!border-slate-300 font-semibold text-slate-700"
            onClick={() => {
              listQ.refetch();
              interviewScheduledCountQ.refetch();
              interviewAllCountQ.refetch();
              offerCountQ.refetch();
              placementCountQ.refetch();
            }}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<TeamOutlined />}
            className="!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-[#0C4A6E] !to-[#0284C7] hover:!from-[#075985] hover:!to-[#0369A1] font-bold text-white shadow-sm transition-all active:scale-[0.98] !px-4"
            onClick={() => navigate('/client/candidates')}
          >
            Xem hồ sơ ứng viên
          </Button>
        </div>
      </div>

      {/* ── 2. Three Segmented Stage Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Stage Card 1: Interviews */}
        <button
          type="button"
          onClick={() => switchTab('interviews')}
          className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
            tab === 'interviews'
              ? 'border-[#0C4A6E] bg-white shadow-md ring-2 ring-[#0C4A6E]/15'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                tab === 'interviews' ? 'bg-[#0C4A6E] text-white shadow-xs' : 'bg-sky-50 text-sky-700'
              }`}
            >
              <CalendarOutlined />
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                tab === 'interviews' ? 'bg-sky-50 text-[#0C4A6E]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Giai đoạn 1
            </span>
          </div>
          <div className="my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lịch đã lên hẹn</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
              {interviewScheduledCountQ.isLoading ? (
                <Skeleton.Input active size="small" />
              ) : (
                interviewScheduledCountQ.data ?? 0
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
            <span>
              {interviewScheduledCountQ.data ?? 0} lịch sắp tới · {interviewAllCountQ.data ?? 0} tất cả
            </span>
            <span className={`font-bold ${tab === 'interviews' ? 'text-[#0C4A6E]' : 'text-slate-400'}`}>
              {tab === 'interviews' ? 'Đang xem' : 'Mở tab →'}
            </span>
          </div>
        </button>

        {/* Stage Card 2: Offers */}
        <button
          type="button"
          onClick={() => switchTab('offers')}
          className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
            tab === 'offers'
              ? 'border-purple-600 bg-white shadow-md ring-2 ring-purple-600/15'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                tab === 'offers' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-700'
              }`}
            >
              <SolutionOutlined />
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                tab === 'offers' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Giai đoạn 2
            </span>
          </div>
          <div className="my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Thư mời nhận việc</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
              {offerCountQ.isLoading ? <Skeleton.Input active size="small" /> : offerCountQ.data ?? 0}
            </div>
          </div>
          <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
            <span>Phát hành & Chờ phản hồi</span>
            <span className={`font-bold ${tab === 'offers' ? 'text-purple-600' : 'text-slate-400'}`}>
              {tab === 'offers' ? 'Đang xem' : 'Mở tab →'}
            </span>
          </div>
        </button>

        {/* Stage Card 3: Placements */}
        <button
          type="button"
          onClick={() => switchTab('placements')}
          className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
            tab === 'placements'
              ? 'border-emerald-600 bg-white shadow-md ring-2 ring-emerald-600/15'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                tab === 'placements' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <RocketOutlined />
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                tab === 'placements' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Giai đoạn 3
            </span>
          </div>
          <div className="my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Ứng viên đã đi làm</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
              {placementCountQ.isLoading ? <Skeleton.Input active size="small" /> : placementCountQ.data ?? 0}
            </div>
          </div>
          <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
            <span>Onboarding & Bảo hành</span>
            <span className={`font-bold ${tab === 'placements' ? 'text-emerald-600' : 'text-slate-400'}`}>
              {tab === 'placements' ? 'Đang xem' : 'Mở tab →'}
            </span>
          </div>
        </button>
      </div>

      {/* ── 3. Main Data Surface with Filters ── */}
      <Surface className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Filter Toolbar Top Row: Search + Job */}
        <div className="p-5 pb-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <Input
              size="large"
              placeholder="Tìm theo tên ứng viên hoặc vị trí..."
              aria-label="Tìm theo tên ứng viên hoặc vị trí"
              prefix={<SearchOutlined className="text-slate-400" />}
              allowClear
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="!rounded-xl"
            />
          </div>

          <Select
            size="large"
            value={selectedJobId}
            onChange={setSelectedJobId}
            loading={loadingJobs}
            className="w-full sm:w-72 font-medium"
            options={[
              { value: 'all', label: 'Tất cả vị trí tuyển dụng' },
              ...myJobs.map((j) => ({
                value: j.jobId,
                label: j.title || 'Vị trí chưa đặt tên',
              })),
            ]}
          />
        </div>

        {/* Filter Toolbar Bottom Row: Quick Status Pills */}
        <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Lọc theo trạng thái">
            <span className="text-xs font-bold text-slate-500 mr-1.5 uppercase tracking-wider">Trạng thái:</span>
            {tab === 'interviews' &&
              (
                [
                  { value: 'all', label: 'Tất cả', desc: 'Xem toàn bộ lịch sử' },
                  { value: 'SCHEDULED', label: 'Đã lên lịch', desc: 'Chỉ các lịch sắp tới' },
                  { value: 'COMPLETED', label: 'Đã phỏng vấn', desc: 'Các buổi đã hoàn thành' },
                  { value: 'NO_SHOW', label: 'Vắng mặt', desc: 'Ứng viên không tham gia' },
                  { value: 'CANCELLED', label: 'Đã hủy', desc: 'Lịch phỏng vấn bị hủy' },
                ] as const
              ).map((opt) => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => handleStatusChange(opt.value)}
                    title={opt.desc}
                    className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-sky-50 text-[#0C4A6E] border-sky-300 font-bold shadow-2xs ring-1 ring-sky-300/40'
                        : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

            {tab === 'offers' &&
              (
                [
                  { value: 'all', label: 'Tất cả' },
                  { value: 'SENT', label: 'Đã gửi' },
                  { value: 'ACCEPTED', label: 'Đã nhận' },
                  { value: 'EXPIRED', label: 'Hết hạn' },
                  { value: 'DECLINED', label: 'Từ chối' },
                  { value: 'WITHDRAWN', label: 'Đã thu hồi' },
                  { value: 'DRAFT', label: 'Bản nháp' },
                ] as const
              ).map((opt) => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold shadow-2xs ring-1 ring-purple-300/40'
                        : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

            {tab === 'placements' &&
              (
                [
                  { value: 'all', label: 'Tất cả' },
                  { value: 'STARTED', label: 'Đã đi làm' },
                  { value: 'LEFT_DURING_WARRANTY', label: 'Nghỉ trong bảo hành' },
                ] as const
              ).map((opt) => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shadow-2xs ring-1 ring-emerald-300/40'
                        : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
          </div>

          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Tìm thấy <b>{filteredItems.length}</b> kết quả
          </span>
        </div>

        {/* Content Table */}
        {listQ.isError ? (
          <div className="p-6">
            <Alert
              type="error"
              showIcon
              message="Không tải được dữ liệu danh sách"
              description={getApiErrorMessage(listQ.error)}
              action={<Button onClick={() => listQ.refetch()}>Thử lại</Button>}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-14 text-center">
            <Empty
              description={
                <div className="space-y-1">
                  <span className="block text-sm font-bold text-slate-700">
                    {searchKeyword.trim() || selectedJobId !== 'all' || statusFilter !== 'all'
                      ? 'Không tìm thấy kết quả phù hợp với bộ lọc'
                      : tab === 'interviews'
                      ? 'Chưa có buổi phỏng vấn nào'
                      : tab === 'offers'
                      ? 'Chưa có thư mời nhận việc nào'
                      : 'Chưa có nhân sự nào tiếp nhận công việc'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {tab === 'interviews'
                      ? 'Hãy vào "Hồ sơ ứng viên", chọn ứng viên tiềm năng và bấm Lên lịch phỏng vấn.'
                      : tab === 'offers'
                      ? 'Offer sẽ được phát hành sau khi ứng viên đạt phỏng vấn vòng cuối.'
                      : 'Thông tin onboard sẽ cập nhật sau khi ứng viên xác nhận đi làm.'}
                  </span>
                </div>
              }
            >
              {tab === 'interviews' && (
                <Button
                  type="primary"
                  className="mt-2 !bg-[#0C4A6E] font-semibold !rounded-xl"
                  onClick={() => navigate('/client/candidates?stage=shortlisted')}
                >
                  Chọn ứng viên phỏng vấn
                </Button>
              )}
            </Empty>
          </div>
        ) : tab === 'interviews' ? (
          <Table<InterviewItem>
            className="admin-soft-table"
            rowKey="interviewId"
            columns={interviewColumns}
            dataSource={filteredItems}
            loading={listQ.isFetching}
            scroll={{ x: 1000 }}
            pagination={{ itemRender: a11yItemRender,
              current: page,
              pageSize: PAGE_SIZE,
              total: listQ.data?.total ?? filteredItems.length,
              onChange: setPage,
              showSizeChanger: false,
            }}
            onRow={(r) => ({
              onClick: () => handleSetOpenInterviewId(r.interviewId),
              className: 'cursor-pointer hover:bg-slate-50/80 transition-colors',
            })}
          />
        ) : tab === 'offers' ? (
          <Table<OfferItem>
            className="admin-soft-table"
            rowKey="offerId"
            columns={offerColumns}
            dataSource={filteredItems}
            loading={listQ.isFetching}
            scroll={{ x: 1000 }}
            pagination={{ itemRender: a11yItemRender,
              current: page,
              pageSize: PAGE_SIZE,
              total: listQ.data?.total ?? filteredItems.length,
              onChange: setPage,
              showSizeChanger: false,
            }}
            onRow={(r) => ({
              onClick: () => setOpen(r.applicationId),
              className: 'cursor-pointer hover:bg-slate-50/80 transition-colors',
            })}
          />
        ) : (
          <Table<PlacementItem>
            className="admin-soft-table"
            rowKey="placementId"
            columns={placementColumns}
            dataSource={filteredItems}
            loading={listQ.isFetching}
            scroll={{ x: 1000 }}
            pagination={{ itemRender: a11yItemRender,
              current: page,
              pageSize: PAGE_SIZE,
              total: listQ.data?.total ?? filteredItems.length,
              onChange: setPage,
              showSizeChanger: false,
            }}
            onRow={(r) => ({
              onClick: () => setOpen(r.applicationId),
              className: 'cursor-pointer hover:bg-slate-50/80 transition-colors',
            })}
          />
        )}
      </Surface>

      {/* ── Drawers ── */}
      <ApplicationWorkbench applicationId={openId ?? undefined} audience="client" onClose={() => setOpen(undefined)} />

      <ClientInterviewDetailDrawer
        interviewId={openInterviewId}
        onClose={() => handleSetOpenInterviewId(null)}
        onOpenApplication={(appId) => {
          handleSetOpenInterviewId(null);
          setOpen(appId);
        }}
      />
    </div>
  );
};

export default ClientInterviewsOffersPage;

