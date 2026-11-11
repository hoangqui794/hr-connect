/**
 * @file ClientOverviewPage.tsx
 * @description Client Company Executive Overview — High-craft Enterprise Command Center.
 * Features:
 *  - Executive Studio Hero with ambient gradient & live hiring health pulse
 *  - Action Priority Center (Interactive cards for pending CVs, interviews, offers, and drafts)
 *  - 4 Executive KPI Cards with layered shadows and micro-metrics
 *  - Full Interactive Hiring Funnel with multi-tone gradient progression
 *  - Upcoming Interviews Schedule with calendar date-badge cards
 *  - Active Job Campaigns Showcase with visual application progress bars
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  RocketOutlined,
  SolutionOutlined,
  TeamOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { pipelineApi, screeningApi } from '@/services/api/hrApi';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { useAuthStore } from '@/stores/authStore';
import { SERVICE_TYPE_LABEL, formatSalary } from '@/features/jobs-mf01/jobDisplay';
import type { ServiceTypeCode } from '@/types/api/jobs';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const FUNNEL = [
  { code: 'SUBMITTED', label: 'Mới nộp', color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50 text-amber-700' },
  { code: 'SCREENING', label: 'Đang xem', color: 'from-sky-500 to-cyan-500', bg: 'bg-sky-50 text-sky-700' },
  { code: 'SHORTLISTED', label: 'Đã chọn', color: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50 text-blue-700' },
  { code: 'INTERVIEW', label: 'Phỏng vấn', color: 'from-violet-600 to-purple-600', bg: 'bg-purple-50 text-purple-700' },
  { code: 'OFFER_PENDING', label: 'Chờ offer', color: 'from-indigo-500 to-sky-600', bg: 'bg-indigo-50 text-indigo-700' },
  { code: 'OFFER_ACCEPTED', label: 'Nhận offer', color: 'from-teal-500 to-emerald-600', bg: 'bg-teal-50 text-teal-700' },
  { code: 'PLACED', label: 'Đã đi làm', color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50 text-emerald-700' },
] as const;

export const ClientOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const jobs = useMyJobs();

  // Funnel: one request grouped by status (C-07) instead of one per stage.
  const stageCounts = useQuery({
    queryKey: ['client-overview', 'stages'],
    queryFn: () => screeningApi.counts('status', {}, FUNNEL.map((f) => f.code)),
  });
  const stagesLoading = stageCounts.isLoading;

  const list = jobs.data ?? [];
  const activeJobs = list.filter((j) => j.status === 'ACTIVE');
  const needFix = list.filter((j) => j.status === 'DRAFT' || j.status === 'REJECTED').length;
  const pendingReview = list.filter((j) => j.status === 'PENDING_REVIEW').length;
  const pendingAgreements = list.filter((j) => j.status === 'PENDING_AGREEMENT').length;

  const shownJobIds = activeJobs.slice(0, 6).map((j) => j.jobId);
  const jobCounts = useQuery({
    queryKey: ['client-overview', 'job-applications', shownJobIds.join(',')],
    queryFn: () => screeningApi.counts('job', {}, shownJobIds),
    enabled: shownJobIds.length > 0,
  });
  const perJob = shownJobIds.map((id) => ({ data: jobCounts.data?.[id] ?? 0, isLoading: jobCounts.isLoading }));

  const interviews = useQuery({
    queryKey: ['client-overview', 'interviews'],
    queryFn: async () => (await pipelineApi.interviews({ status: 'SCHEDULED', page: 1, pageSize: 4 })).items,
  });

  const n = (code: (typeof FUNNEL)[number]['code']) => stageCounts.data?.[code] ?? 0;
  const totalCandidates = FUNNEL.reduce((acc, f) => acc + n(f.code), 0);
  const funnelMax = Math.max(1, ...FUNNEL.map((f) => n(f.code)));
  // Full display name: the last word alone turned "Demo Client" into "Client" (C-11).
  const firstName = (user?.name || '').trim() || 'Quý đối tác';

  const pendingCVCount = n('SUBMITTED') + n('SCREENING');
  const shortlistedCount = n('SHORTLISTED');
  const interviewCount = n('INTERVIEW');
  const offerCount = n('OFFER_PENDING') + n('OFFER_ACCEPTED');

  return (
    <div className={`${FONT} space-y-7 max-w-full animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── 1. Executive Studio Hero Banner ──────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1528] via-[#0C4A6E] to-[#0369A1] px-5 py-4 text-white sm:px-6 sm:py-5">
        {/* Ambient background glow */}
        
        

        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{dayjs().format('dddd, DD/MM/YYYY')}</span>
              <span className="text-white/40">·</span>
              <span>Cổng quản trị tuyển dụng</span>
            </div>

            <h1 className="m-0 mt-2 text-xl font-extrabold tracking-tight text-white sm:text-[22px]">
              Chào {firstName}, chúc một ngày tuyển dụng hiệu quả!
            </h1>

            <p className="m-0 mt-1.5 text-sm leading-relaxed text-sky-100/90">
              {jobs.isLoading || stagesLoading ? (
                'Đang đồng bộ nhịp thở dữ liệu tuyển dụng...'
              ) : (
                <>
                  Doanh nghiệp đang vận hành <b className="text-white font-bold">{activeJobs.length} tin tuyển dụng</b> đang mở
                  {pendingReview > 0 ? `, ${pendingReview} tin đang chờ duyệt` : ''}. Có{' '}
                  <b className="text-amber-300 font-bold">{pendingCVCount} ứng viên mới</b> sẵn sàng để bạn đánh giá.
                </>
              )}
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/client/jobs/create')}
                className="!h-10 !rounded-lg !border-0 !bg-white !px-4 text-sm font-bold !text-[#0C4A6E] transition-all hover:!bg-sky-50 active:scale-[0.98]"
              >
                Đăng tin tuyển dụng mới
              </Button>
              <Button
                onClick={() => navigate('/client/candidates')}
                className="!h-10 !rounded-lg !border !border-white/25 !bg-white/10 !px-4 text-sm font-semibold !text-white backdrop-blur-md transition-all hover:!bg-white/20 active:scale-[0.98]"
              >
                Xem tất cả hồ sơ ({totalCandidates})
              </Button>
            </div>
          </div>

          {/* Mini Health Pulse Card */}
          <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md lg:w-64">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-200">
              <span className="flex items-center gap-1.5">
                <ThunderboltFilled className="text-amber-400" /> Nhịp độ tuyển dụng
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-semibold">Live</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1 text-center">
              <div className="rounded-xl bg-black/15 p-2">
                <div className="text-xl font-extrabold text-white tabular-nums">{activeJobs.length}</div>
                <div className="text-[11px] text-sky-200/80">Tin mở</div>
              </div>
              <div className="rounded-xl bg-black/15 p-2">
                <div className="text-xl font-extrabold text-amber-300 tabular-nums">{pendingCVCount}</div>
                <div className="text-[11px] text-sky-200/80">Chờ duyệt</div>
              </div>
              <div className="rounded-xl bg-black/15 p-2">
                <div className="text-xl font-extrabold text-sky-300 tabular-nums">{interviewCount}</div>
                <div className="text-[11px] text-sky-200/80">Phỏng vấn</div>
              </div>
            </div>

            <div className="text-[11.5px] text-sky-200/90 leading-tight">
              Tỷ lệ hồ sơ đạt chuẩn đi tiếp phỏng vấn đạt mức tích cực.
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Action Priority Center (Trung tâm xử lý khẩn cấp) ──────── */}
      <section aria-labelledby="action-center-title">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 id="action-center-title" className="m-0 text-base font-bold text-slate-900">
              Trung tâm xử lý khẩn cấp
            </h2>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/60">
              Cần hành động
            </span>
          </div>
          <span className="text-xs text-slate-500">Ưu tiên xử lý để đảm bảo tốc độ tuyển dụng</span>
        </div>

        {jobs.isLoading || stagesLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Action Card 1: Review CVs */}
            <div
              onClick={() => navigate('/client/candidates?stage=review')}
              className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                pendingCVCount > 0
                  ? 'border-amber-200/90 bg-gradient-to-b from-amber-50/50 to-white shadow-2xs'
                  : 'border-slate-200/80 bg-white opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 text-base font-bold">
                    <InboxOutlined />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      pendingCVCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {pendingCVCount} hồ sơ
                  </span>
                </div>
                <h3 className="m-0 mt-3.5 text-[15px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors leading-snug">
                  Duyệt hồ sơ mới
                </h3>
                <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Ứng viên vừa nộp hoặc do sourcing chuyển sang, cần xem và chọn lọc.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs font-bold text-[#0C4A6E]">
                <span>Xem danh sách</span>
                <ArrowRightOutlined className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Action Card 2: Schedule Interviews */}
            <div
              onClick={() => navigate('/client/candidates?stage=shortlisted')}
              className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                shortlistedCount > 0
                  ? 'border-indigo-200/90 bg-gradient-to-b from-indigo-50/50 to-white shadow-2xs'
                  : 'border-slate-200/80 bg-white opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-700 text-base font-bold">
                    <CalendarOutlined />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      shortlistedCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {shortlistedCount} ứng viên
                  </span>
                </div>
                <h3 className="m-0 mt-3.5 text-[15px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors leading-snug">
                  Lên lịch phỏng vấn
                </h3>
                <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Các ứng viên đã chọn (Shortlisted) đang chờ bạn xếp lịch gặp mặt.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs font-bold text-[#0C4A6E]">
                <span>Lên lịch ngay</span>
                <ArrowRightOutlined className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Action Card 3: Offer & Result */}
            <div
              onClick={() => navigate('/client/candidates?stage=offer')}
              className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                offerCount > 0
                  ? 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/50 to-white shadow-2xs'
                  : 'border-slate-200/80 bg-white opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 text-base font-bold">
                    <SolutionOutlined />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      offerCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {offerCount} mục
                  </span>
                </div>
                <h3 className="m-0 mt-3.5 text-[15px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors leading-snug">
                  Phát hành Offer
                </h3>
                <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Ứng viên phỏng vấn đạt cần gửi đề nghị hoặc xác nhận ngày đi làm.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs font-bold text-[#0C4A6E]">
                <span>Xem offer</span>
                <ArrowRightOutlined className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Action Card 4: Agreements or Fixes */}
            <div
              onClick={() =>
                pendingAgreements > 0
                  ? navigate('/client/agreements')
                  : needFix > 0
                  ? navigate('/client/jobs?status=DRAFT')
                  : navigate('/client/jobs')
              }
              className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                pendingAgreements > 0 || needFix > 0
                  ? 'border-rose-200/90 bg-gradient-to-b from-rose-50/50 to-white shadow-2xs'
                  : 'border-slate-200/80 bg-white opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-700 text-base font-bold">
                    <FileTextOutlined />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      pendingAgreements > 0 || needFix > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {pendingAgreements + needFix} tin
                  </span>
                </div>
                <h3 className="m-0 mt-3.5 text-[15px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors leading-snug">
                  {pendingAgreements > 0 ? 'Ký thỏa thuận dịch vụ' : 'Tin nháp & hoàn thiện'}
                </h3>
                <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
                  {pendingAgreements > 0
                    ? 'Có hợp đồng cần bạn kiểm tra và ký kết để mở tin tuyển dụng.'
                    : 'Các tin nháp hoặc tin bị yêu cầu sửa đổi cần gửi lại duyệt.'}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs font-bold text-[#0C4A6E]">
                <span>Xử lý ngay</span>
                <ArrowRightOutlined className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Executive KPI Tiles ────────────────────────────────────── */}
      <section aria-labelledby="kpi-title" className="space-y-3">
        <h2 id="kpi-title" className="sr-only">
          Chỉ số hiệu suất chính
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1 */}
          <div
            onClick={() => navigate('/client/jobs?status=ACTIVE')}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tin đang tuyển</span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 text-lg transition-transform group-hover:scale-110">
                <RocketOutlined />
              </span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {jobs.isLoading ? <Skeleton.Input active size="small" /> : activeJobs.length}
              </span>
            </div>
            <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
              <span>{list.length} tin tổng cộng</span>
              <span className="font-semibold text-[#0C4A6E]">Quản lý →</span>
            </div>
          </div>

          {/* KPI 2 */}
          <div
            onClick={() => navigate('/client/candidates?stage=review')}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hồ sơ mới chờ xem</span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 text-lg transition-transform group-hover:scale-110">
                <InboxOutlined />
              </span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {stagesLoading ? <Skeleton.Input active size="small" /> : pendingCVCount}
              </span>
            </div>
            <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
              <span>{n('SUBMITTED')} mới nộp hoàn toàn</span>
              <span className="font-semibold text-amber-700">Xem ngay →</span>
            </div>
          </div>

          {/* KPI 3 */}
          <div
            onClick={() => navigate('/client/candidates?status=INTERVIEW')}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Đang phỏng vấn</span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 text-lg transition-transform group-hover:scale-110">
                <CalendarOutlined />
              </span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {stagesLoading ? <Skeleton.Input active size="small" /> : n('INTERVIEW')}
              </span>
            </div>
            <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
              <span>Lịch hẹn & chờ kết quả</span>
              <span className="font-semibold text-purple-700">Chi tiết →</span>
            </div>
          </div>

          {/* KPI 4 */}
          <div
            onClick={() => navigate('/client/candidates?status=PLACED')}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tuyển thành công</span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 text-lg transition-transform group-hover:scale-110">
                <CheckCircleFilled />
              </span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {stagesLoading ? <Skeleton.Input active size="small" /> : n('PLACED')}
              </span>
            </div>
            <div className="flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3 text-xs text-slate-500">
              <span>Ứng viên đã onboard</span>
              <span className="font-semibold text-emerald-700">Bảo hành →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Funnel & Upcoming Interviews ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Phễu ứng viên (7 cols) */}
        <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-base font-bold text-slate-900">Phễu chuyển đổi tuyển dụng</h2>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#0C4A6E]">
                  Toàn bộ chiến dịch
                </span>
              </div>
              <p className="m-0 mt-1 text-xs text-slate-500">
                Phân bổ {totalCandidates} hồ sơ qua các giai đoạn từ tiếp nhận đến tiếp nhận việc làm.
              </p>
            </div>
            <Button
              type="link"
              className="!px-0 text-xs font-bold text-[#0C4A6E] hover:text-[#075985]"
              onClick={() => navigate('/client/candidates')}
            >
              Mở bảng Kanban <ArrowRightOutlined className="text-xs" />
            </Button>
          </div>

          {stagesLoading ? (
            <Skeleton active paragraph={{ rows: 7 }} />
          ) : (
            <div className="space-y-3" aria-label="Biểu đồ phễu ứng viên">
              {FUNNEL.map((f, i) => {
                const value = n(f.code);
                const widthPercent = value === 0 ? 0 : Math.max(8, Math.round((value / funnelMax) * 100));
                const sharePercent = totalCandidates > 0 ? Math.round((value / totalCandidates) * 100) : 0;

                return (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => navigate(`/client/candidates?status=${f.code}`)}
                    className="group relative flex w-full cursor-pointer items-center justify-between rounded-xl border border-transparent p-2 text-left transition-all hover:border-slate-200 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30"
                  >
                    <div className="flex w-32 shrink-0 items-center gap-2">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${f.bg}`}>
                        {f.label}
                      </span>
                    </div>

                    <div className="mx-3 flex-1">
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${f.color} transition-all duration-500`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex w-24 shrink-0 items-center justify-end gap-2 text-right">
                      <span className="text-xs text-slate-400 font-medium">{sharePercent}%</span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 group-hover:text-[#0C4A6E]">
                        {value}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Lịch phỏng vấn sắp tới (5 cols) */}
        <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-base font-bold text-slate-900">Lịch phỏng vấn sắp tới</h2>
              <span className="inline-flex h-5 items-center rounded-full bg-purple-50 px-2 text-[11px] font-bold text-purple-700">
                {interviews.data?.length ?? 0} buổi
              </span>
            </div>
            <Button
              type="link"
              className="!px-0 text-xs font-bold text-[#0C4A6E] hover:text-[#075985]"
              onClick={() => navigate('/client/interviews-offers')}
            >
              Lịch đầy đủ <ArrowRightOutlined className="text-xs" />
            </Button>
          </div>

          {interviews.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (interviews.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm text-xl mb-3">
                <CalendarOutlined />
              </div>
              <p className="m-0 text-sm font-semibold text-slate-800">Chưa có lịch phỏng vấn nào sắp diễn ra</p>
              <p className="m-0 mt-1 max-w-xs text-xs text-slate-500">
                Hãy duyệt hồ sơ ở trạng thái “Đã chọn” và tiến hành lên lịch phỏng vấn đầu tiên.
              </p>
              <Button
                size="small"
                type="primary"
                className="mt-4 !bg-[#0C4A6E] font-semibold !rounded-lg"
                onClick={() => navigate('/client/candidates?stage=shortlisted')}
              >
                Chọn ứng viên phỏng vấn
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {interviews.data!.map((iv) => (
                <div
                  key={iv.interviewId}
                  onClick={() => navigate(`/client/interviews-offers?tab=interviews&interview=${iv.interviewId}`)}
                  className="group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition-all hover:border-slate-200 hover:bg-slate-50 hover:shadow-2xs"
                >
                  {/* Date badge */}
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0C4A6E]">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('MMM') : '—'}
                    </span>
                    <span className="text-lg font-black leading-tight text-slate-900">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('DD') : '—'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors">
                        {iv.candidateName}
                      </span>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-[#0C4A6E]">
                        Vòng {iv.interviewRound}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <ClockCircleOutlined className="text-[#0C4A6E]" />
                        {iv.scheduledAt ? dayjs(iv.scheduledAt).format('HH:mm') : ''}
                      </span>
                      <span>·</span>
                      <span className="truncate">{iv.jobTitle}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── 5. Active Jobs Showcase ──────────────────────────────────── */}
      <section aria-labelledby="active-jobs-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="active-jobs-title" className="m-0 text-base font-bold text-slate-900">
                Chiến dịch tuyển dụng đang mở
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                {activeJobs.length} vị trí
              </span>
            </div>
            <p className="m-0 mt-0.5 text-xs text-slate-500">
              Các vị trí đang trực tiếp tiếp nhận hồ sơ và triển khai sourcing từ đối tác
            </p>
          </div>
          <Button
            type="link"
            className="!px-0 text-xs font-bold text-[#0C4A6E] hover:text-[#075985]"
            onClick={() => navigate('/client/jobs')}
          >
            Tất cả chiến dịch ({list.length}) <ArrowRightOutlined className="text-xs" />
          </Button>
        </div>

        {jobs.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : activeJobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-2xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-[#0C4A6E] mb-3">
              <RocketOutlined />
            </div>
            <h3 className="m-0 text-base font-bold text-slate-900">Chưa có vị trí tuyển dụng nào đang mở</h3>
            <p className="m-0 mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
              Đăng tin tuyển dụng mới để tiếp cận mạng lưới ứng viên chất lượng cao cùng dịch vụ tuyển dụng theo kết quả chuyên sâu.
            </p>
            <Button
              type="primary"
              className="mt-4 !h-10 !rounded-xl !border-0 !bg-[#0C4A6E] px-5 font-bold text-white shadow-sm hover:!bg-[#075985]"
              icon={<PlusOutlined />}
              onClick={() => navigate('/client/jobs/create')}
            >
              Tạo vị trí tuyển dụng đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeJobs.slice(0, 6).map((job, i) => {
              const count = perJob[i]?.data ?? 0;
              const serviceInfo = job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode as ServiceTypeCode] : null;

              return (
                <div
                  key={job.jobId}
                  onClick={() => navigate(`/client/candidates?job=${job.jobId}`)}
                  className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
                >
                  <div>
                    {/* Top tags */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      {serviceInfo ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#0C4A6E] border border-sky-100">
                          {serviceInfo.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Tiêu chuẩn
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-medium">
                        Cần {job.quantity || 1} nhân sự
                      </span>
                    </div>

                    {/* Job Title */}
                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-[#0C4A6E] transition-colors m-0">
                      {job.title || 'Vị trí chưa đặt tên'}
                    </h3>

                    {/* Salary & Location */}
                    <div className="mt-2.5 space-y-1">
                      <div className="text-xs font-bold text-[#0C4A6E] bg-sky-50/70 inline-block px-2 py-0.5 rounded">
                        {formatSalary(job)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                        <EnvironmentOutlined className="text-slate-400" />
                        <span className="truncate">{job.location || 'Toàn quốc / Chưa rõ'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar and counter */}
                  <div className="mt-4 border-0 border-t border-solid border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <TeamOutlined className="text-[#0C4A6E]" />
                        <b className="tabular-nums font-bold text-slate-900">
                          {perJob[i]?.isLoading ? '…' : count}
                        </b>{' '}
                        hồ sơ đã nhận
                      </span>
                      <span className="text-[11px] font-semibold text-[#0C4A6E] group-hover:underline">
                        Xem hồ sơ →
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0C4A6E] to-[#0284C7] transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(10, Math.round((count / (job.quantity * 5 || 10)) * 100)))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientOverviewPage;
