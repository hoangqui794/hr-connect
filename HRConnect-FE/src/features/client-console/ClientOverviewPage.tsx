/**
 * @file ClientOverviewPage.tsx
 * @description Client Company overview, sleek enterprise SaaS UI: greeting + to-do list built from
 * real stage counts, KPI tiles, candidate funnel (SUBMITTED → PLACED), upcoming interviews, and
 * active jobs. Every number comes directly from the backend.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { pipelineApi, screeningApi } from '@/services/api/hrApi';
import { useMyJobs } from '@/features/jobs-mf01/useJobQueries';
import { useAuthStore } from '@/stores/authStore';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const FUNNEL = [
  { code: 'SUBMITTED', label: 'Mới nộp' },
  { code: 'SCREENING', label: 'Đang xem' },
  { code: 'SHORTLISTED', label: 'Đã chọn' },
  { code: 'INTERVIEW', label: 'Phỏng vấn' },
  { code: 'OFFER_PENDING', label: 'Chờ offer' },
  { code: 'OFFER_ACCEPTED', label: 'Nhận offer' },
  { code: 'PLACED', label: 'Đã đi làm' },
] as const;

const Kpi: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: number;
  loading: boolean;
  hint: string;
  onClick: () => void;
}> = ({ icon, iconBg, iconColor, label, value, loading, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${FONT} group flex flex-col justify-between rounded-xl border border-solid border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30 cursor-pointer`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconBg} ${iconColor} text-base transition-transform group-hover:scale-110`}>
        {icon}
      </span>
    </div>
    <div className="my-2.5">
      <span className="text-[28px] font-extrabold tracking-tight text-slate-900 tabular-nums">
        {loading ? <Skeleton.Input active size="small" /> : value ?? 0}
      </span>
    </div>
    <div className="truncate text-[12px] text-slate-500">{hint}</div>
  </button>
);

export const ClientOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const jobs = useMyJobs();

  const stageQueries = useQueries({
    queries: FUNNEL.map((f) => ({
      queryKey: ['client-overview', 'stage', f.code],
      queryFn: async () => (await screeningApi.list({ status: f.code, page: 1, pageSize: 1 })).total,
    })),
  });
  const stage = (code: (typeof FUNNEL)[number]['code']) => stageQueries[FUNNEL.findIndex((f) => f.code === code)];
  const stagesLoading = stageQueries.some((q) => q.isLoading);

  const list = jobs.data ?? [];
  const activeJobs = list.filter((j) => j.status === 'ACTIVE');
  const needFix = list.filter((j) => j.status === 'DRAFT' || j.status === 'REJECTED').length;
  const pendingReview = list.filter((j) => j.status === 'PENDING_REVIEW').length;

  const perJob = useQueries({
    queries: activeJobs.slice(0, 6).map((j) => ({
      queryKey: ['client-overview', 'job-applications', j.jobId],
      queryFn: async () => (await screeningApi.list({ jobId: j.jobId, page: 1, pageSize: 1 })).total,
    })),
  });

  const interviews = useQuery({
    queryKey: ['client-overview', 'interviews'],
    queryFn: async () => (await pipelineApi.interviews({ status: 'SCHEDULED', page: 1, pageSize: 4 })).items,
  });

  const n = (code: (typeof FUNNEL)[number]['code']) => stage(code)?.data ?? 0;
  const funnelMax = Math.max(1, ...FUNNEL.map((f) => n(f.code)));
  const firstName = (user?.name || 'bạn').trim().split(/\s+/).slice(-1)[0];

  const todos = [
    { count: n('SUBMITTED') + n('SCREENING'), text: 'hồ sơ chờ bạn xem và quyết định', to: '/client/candidates?status=SUBMITTED' },
    { count: n('SHORTLISTED'), text: 'ứng viên đã chọn, chưa có lịch phỏng vấn', to: '/client/candidates?status=SHORTLISTED' },
    { count: n('INTERVIEW'), text: 'ứng viên đang phỏng vấn, cần ghi kết quả', to: '/client/candidates?status=INTERVIEW' },
    { count: n('OFFER_PENDING'), text: 'ứng viên đạt, cần tạo hoặc gửi offer', to: '/client/candidates?status=OFFER_PENDING' },
    { count: n('OFFER_ACCEPTED'), text: 'ứng viên nhận offer, chờ xác nhận đi làm', to: '/client/candidates?status=OFFER_ACCEPTED' },
    { count: needFix, text: 'tin nháp hoặc bị từ chối cần gửi duyệt', to: '/client/jobs?status=DRAFT' },
  ].filter((t) => t.count > 0);

  return (
    <div className={`${FONT} space-y-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Greeting + to-do ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-solid border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div>
            <div className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0C4A6E]">
              {dayjs().format('dddd, DD/MM/YYYY')}
            </div>
            <h1 className="m-0 mt-2.5 text-2xl sm:text-[26px] font-bold leading-tight tracking-tight text-slate-900">
              Chào {firstName},
            </h1>
            <p className="m-0 mt-2 max-w-lg text-[14px] leading-relaxed text-slate-600">
              {jobs.isLoading || stagesLoading
                ? 'Đang tổng hợp tình hình tuyển dụng...'
                : `Bạn có ${activeJobs.length} tin đang tuyển${pendingReview ? `, ${pendingReview} tin chờ duyệt` : ''} và ${
                    n('SUBMITTED') + n('SCREENING')
                  } hồ sơ đang chờ xem.`}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="!h-10 !rounded-lg !border-0 !bg-[#0C4A6E] !px-5 font-semibold !text-white shadow-sm transition-all duration-200 hover:!bg-[#075985] active:scale-[0.98]"
                onClick={() => navigate('/client/jobs/create')}
              >
                Đăng tin mới
              </Button>
              <Button
                className="!h-10 !rounded-lg border-solid border-slate-200/90 !px-5 font-medium text-slate-700 transition-all hover:!border-slate-300 hover:!bg-slate-50 active:scale-[0.98]"
                onClick={() => navigate('/client/candidates')}
              >
                Xem hồ sơ ứng viên
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-solid border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 pb-3">
            <h2 className="m-0 text-[15px] font-bold text-slate-900">Việc Cần Làm</h2>
            {todos.length > 0 && (
              <span className="inline-flex h-5 items-center rounded-full bg-amber-50 px-2 text-[11px] font-bold text-amber-700">
                {todos.length} mục
              </span>
            )}
          </div>
          {jobs.isLoading || stagesLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} className="mt-4" />
          ) : todos.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <CheckCircleFilled className="text-3xl text-emerald-600" aria-hidden />
              <p className="m-0 mt-2.5 text-[13.5px] font-medium text-slate-600">
                Không có việc nào đang chờ. Mọi hồ sơ đã được xử lý.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {todos.map((t) => (
                <button
                  key={t.text}
                  type="button"
                  onClick={() => navigate(t.to)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-1 py-3 text-left transition-colors duration-150 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-[12px] font-bold text-amber-700">
                      {t.count}
                    </span>
                    <span className="text-[13.5px] font-medium text-slate-700 transition-colors group-hover:text-slate-900">
                      {t.text}
                    </span>
                  </div>
                  <ArrowRightOutlined className="text-[11px] text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-[#0C4A6E]" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── KPI tiles (Stripe Style) ─────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<FileTextOutlined />}
          iconBg="bg-sky-50"
          iconColor="text-sky-700"
          label="Tin đang tuyển"
          value={activeJobs.length}
          loading={jobs.isLoading}
          hint={`${list.length} tin tổng cộng`}
          onClick={() => navigate('/client/jobs?status=ACTIVE')}
        />
        <Kpi
          icon={<InboxOutlined />}
          iconBg="bg-amber-50"
          iconColor="text-amber-700"
          label="Hồ sơ mới"
          value={n('SUBMITTED')}
          loading={stagesLoading}
          hint="Chưa mở xem"
          onClick={() => navigate('/client/candidates?status=SUBMITTED')}
        />
        <Kpi
          icon={<CalendarOutlined />}
          iconBg="bg-purple-50"
          iconColor="text-purple-700"
          label="Đang phỏng vấn"
          value={n('INTERVIEW')}
          loading={stagesLoading}
          hint="Có lịch hoặc chờ kết quả"
          onClick={() => navigate('/client/candidates?status=INTERVIEW')}
        />
        <Kpi
          icon={<SolutionOutlined />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
          label="Đã đi làm"
          value={n('PLACED')}
          loading={stagesLoading}
          hint="Tuyển thành công"
          onClick={() => navigate('/client/candidates?status=PLACED')}
        />
      </div>

      {/* ── Funnel + interviews ───────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-solid border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="m-0 text-[15px] font-bold text-slate-900">Phễu Ứng Viên</h2>
              <p className="m-0 mt-0.5 text-[13px] text-slate-500">Số hồ sơ đang ở từng giai đoạn, trên mọi tin của bạn.</p>
            </div>
            <Button
              type="link"
              className="!px-0 text-[13px] font-semibold text-[#0C4A6E] hover:text-[#075985]"
              onClick={() => navigate('/client/candidates')}
            >
              Mở bảng <ArrowRightOutlined className="text-xs" />
            </Button>
          </div>
          {stagesLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <ol className="m-0 list-none space-y-2 p-0" aria-label="Phễu ứng viên">
              {FUNNEL.map((f, i) => {
                const value = n(f.code);
                const width = value === 0 ? 0 : Math.max(6, Math.round((value / funnelMax) * 100));
                return (
                  <li key={f.code}>
                    <button
                      type="button"
                      onClick={() => navigate(`/client/candidates?status=${f.code}`)}
                      className="grid w-full cursor-pointer grid-cols-[100px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30"
                      aria-label={`${f.label}: ${value} hồ sơ`}
                    >
                      <span className="text-[13px] font-medium text-slate-700">{f.label}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${width}%`,
                            background: `linear-gradient(90deg, rgba(12,74,110,${0.6 + i * 0.05}), rgba(2,132,199,${0.85}))`,
                          }}
                        />
                      </span>
                      <span className="text-right text-[13px] font-bold tabular-nums text-slate-900">{value}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-solid border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-[15px] font-bold text-slate-900">Phỏng Vấn Sắp Tới</h2>
            <Button
              type="link"
              className="!px-0 text-[13px] font-semibold text-[#0C4A6E] hover:text-[#075985]"
              onClick={() => navigate('/client/interviews-offers')}
            >
              Lịch <ArrowRightOutlined className="text-xs" />
            </Button>
          </div>
          {interviews.isLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (interviews.data ?? []).length === 0 ? (
            <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-[13.5px] text-slate-600">
              <CalendarOutlined className="mb-2 text-2xl text-slate-400" aria-hidden />
              <div className="font-medium text-slate-700">Chưa có lịch phỏng vấn nào.</div>
              <div className="mt-1 text-[12.5px] text-slate-500">Chọn một ứng viên rồi bấm “Lên lịch phỏng vấn”.</div>
            </div>
          ) : (
            <ul className="m-0 list-none space-y-2.5 p-0">
              {interviews.data!.map((iv) => (
                <li key={iv.interviewId} className="flex items-center gap-3.5 rounded-xl border border-solid border-slate-100 bg-slate-50/70 p-3 transition-colors hover:bg-slate-50">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-solid border-slate-200/80 bg-white py-1 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0C4A6E]">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('MMM') : '—'}
                    </span>
                    <span className="text-[16px] font-bold leading-tight text-slate-900">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('DD') : '—'}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-slate-900">{iv.candidateName}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('HH:mm') : ''} · Vòng {iv.interviewRound} · {iv.jobTitle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Active jobs ───────────────────────────────────────────────── */}
      <section aria-labelledby="active-jobs-title">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 id="active-jobs-title" className="m-0 text-[16px] font-bold text-slate-900">
              Tin Tuyển Dụng Đang Mở
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-slate-500">Các vị trí đang nhận hồ sơ ứng viên</p>
          </div>
          <Button
            type="link"
            className="!px-0 text-[13px] font-semibold text-[#0C4A6E] hover:text-[#075985]"
            onClick={() => navigate('/client/jobs')}
          >
            Tất cả tin ({list.length}) <ArrowRightOutlined className="text-xs" />
          </Button>
        </div>
        {jobs.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : activeJobs.length === 0 ? (
          <div className="rounded-2xl border border-solid border-slate-200/90 bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="m-0 text-[14px] text-slate-600">Chưa có tin nào đang tuyển.</p>
            <Button
              type="primary"
              className="mt-3.5 !h-9 !rounded-lg !border-0 !bg-[#0C4A6E] px-4 font-semibold text-white hover:!bg-[#075985]"
              icon={<PlusOutlined />}
              onClick={() => navigate('/client/jobs/create')}
            >
              Đăng tin đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeJobs.slice(0, 6).map((j, i) => (
              <button
                key={j.jobId}
                type="button"
                onClick={() => navigate(`/client/candidates?job=${j.jobId}`)}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-solid border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30"
              >
                <div>
                  <span className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 group-hover:text-[#0C4A6E] transition-colors">
                    {j.title || 'Vị trí chưa đặt tên'}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
                    <EnvironmentOutlined className="text-slate-400" aria-hidden />
                    {j.location || 'Chưa có địa điểm'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3">
                  <span className="flex items-center gap-1.5 text-[13px] text-slate-700">
                    <TeamOutlined className="text-[#0C4A6E]" aria-hidden />
                    <b className="tabular-nums font-bold text-slate-900">{perJob[i]?.isLoading ? '…' : perJob[i]?.data ?? 0}</b> hồ sơ
                  </span>
                  <span className="text-[12px] font-medium text-slate-500">cần tuyển {j.quantity} người</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientOverviewPage;
