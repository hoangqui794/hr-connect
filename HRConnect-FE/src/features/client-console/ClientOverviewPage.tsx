/**
 * @file ClientOverviewPage.tsx
 * @description Client Company overview, "Soft UI" (ui-ux-pro-max): greeting + to-do list built from
 * real stage counts, KPI tiles, the candidate funnel (SUBMITTED → PLACED), upcoming interviews and
 * the active jobs with their application counts. Every number comes from the backend.
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
import { Surface } from '@/features/admin-console/ui';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

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
  label: string;
  value?: number;
  loading: boolean;
  hint: string;
  onClick: () => void;
}> = ({ icon, label, value, loading, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-xl border border-slate-200/80 p-5 text-left cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 flex flex-col justify-between"
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-slate-400 text-lg">{icon}</span>
    </div>
    <div className="my-2">
      <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
        {loading ? <Skeleton.Input active size="small" /> : value ?? 0}
      </span>
    </div>
    <div className="text-xs text-slate-500 truncate">{hint}</div>
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
    <div className="space-y-6">
      {/* ── Greeting + to-do ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white border border-slate-200/80 p-7 sm:p-8 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">{dayjs().format('dddd, DD/MM/YYYY')}</div>
            <h1 className="m-0 mt-2 text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-slate-900">Chào {firstName},</h1>
            <p className="m-0 mt-2 max-w-lg text-sm sm:text-[15px] leading-relaxed text-slate-600">
              {jobs.isLoading || stagesLoading
                ? 'Đang tổng hợp tình hình tuyển dụng...'
                : `Bạn có ${activeJobs.length} tin đang tuyển${pendingReview ? `, ${pendingReview} tin chờ duyệt` : ''} và ${
                    n('SUBMITTED') + n('SCREENING')
                  } hồ sơ đang chờ xem.`}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button
                size="large"
                type="primary"
                icon={<PlusOutlined />}
                className="!bg-blue-600 hover:!bg-blue-700 !text-white !rounded-lg !border-0 font-medium shadow-sm transition-all active:scale-[0.98] !px-5"
                onClick={() => navigate('/client/jobs/create')}
              >
                Đăng tin mới
              </Button>
              <Button
                size="large"
                className="!rounded-lg !px-5 border-slate-200 hover:!border-slate-300 text-slate-700"
                onClick={() => navigate('/client/candidates')}
              >
                Xem ứng viên
              </Button>
            </div>
          </div>
        </section>

        <Surface className="p-6">
          <h2 className="m-0 text-base font-bold text-slate-900">Việc cần làm</h2>
          {jobs.isLoading || stagesLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} className="mt-4" />
          ) : todos.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-4 text-center">
              <CheckCircleFilled className="text-4xl text-emerald-600" aria-hidden />
              <p className="m-0 mt-3 text-sm text-slate-600">Không có việc nào đang chờ. Mọi hồ sơ đã được xử lý.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {todos.map((t) => (
                <button
                  key={t.text}
                  type="button"
                  onClick={() => navigate(t.to)}
                  className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-slate-50/80 transition-colors group cursor-pointer border-0 bg-transparent rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-amber-50 text-amber-700 font-bold text-xs inline-flex items-center justify-center shrink-0">
                      {t.count}
                    </span>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{t.text}</span>
                  </div>
                  <ArrowRightOutlined className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all text-xs" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </Surface>
      </div>

      {/* ── KPI tiles (Stripe Style) ─────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<FileTextOutlined />} label="Tin đang tuyển" value={activeJobs.length} loading={jobs.isLoading} hint={`${list.length} tin tổng cộng`} onClick={() => navigate('/client/jobs?status=ACTIVE')} />
        <Kpi icon={<InboxOutlined />} label="Hồ sơ mới" value={n('SUBMITTED')} loading={stagesLoading} hint="Chưa ai mở xem" onClick={() => navigate('/client/candidates?status=SUBMITTED')} />
        <Kpi icon={<CalendarOutlined />} label="Đang phỏng vấn" value={n('INTERVIEW')} loading={stagesLoading} hint="Có lịch hoặc chờ kết quả" onClick={() => navigate('/client/candidates?status=INTERVIEW')} />
        <Kpi icon={<SolutionOutlined />} label="Đã đi làm" value={n('PLACED')} loading={stagesLoading} hint="Tuyển thành công" onClick={() => navigate('/client/candidates?status=PLACED')} />
      </div>

      {/* ── Funnel + interviews ───────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Surface className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-bold text-slate-900">Phễu ứng viên</h2>
              <p className="m-0 mt-0.5 text-[13px] text-slate-600">Số hồ sơ đang ở từng giai đoạn, trên mọi tin của bạn.</p>
            </div>
            <Button type="link" className="!px-0" onClick={() => navigate('/client/candidates')}>
              Mở bảng <ArrowRightOutlined />
            </Button>
          </div>
          {stagesLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <ol className="m-0 list-none space-y-2.5 p-0" aria-label="Phễu ứng viên">
              {FUNNEL.map((f, i) => {
                const value = n(f.code);
                const width = value === 0 ? 0 : Math.max(6, Math.round((value / funnelMax) * 100));
                return (
                  <li key={f.code}>
                    <button
                      type="button"
                      onClick={() => navigate(`/client/candidates?status=${f.code}`)}
                      className="grid w-full cursor-pointer grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-3 rounded-xl border-0 bg-transparent px-1 py-1 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                      aria-label={`${f.label}: ${value} hồ sơ`}
                    >
                      <span className="text-[13px] font-medium text-slate-700">{f.label}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${width}%`,
                            background: `linear-gradient(90deg, rgba(37,99,235,${0.55 + i * 0.06}), rgba(96,165,250,${0.75}))`,
                          }}
                        />
                      </span>
                      <span className="text-right text-sm font-bold tabular-nums text-slate-900">{value}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Surface>

        <Surface className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-base font-bold text-slate-900">Phỏng vấn sắp tới</h2>
            <Button type="link" className="!px-0" onClick={() => navigate('/client/interviews-offers')}>
              Lịch <ArrowRightOutlined />
            </Button>
          </div>
          {interviews.isLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (interviews.data ?? []).length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              <CalendarOutlined className="mb-2 text-2xl text-slate-400" aria-hidden />
              <div>Chưa có lịch phỏng vấn nào.</div>
              <div className="text-[13px] text-slate-500">Chọn một ứng viên rồi bấm “Lên lịch phỏng vấn”.</div>
            </div>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {interviews.data!.map((iv) => (
                <li key={iv.interviewId} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-white py-1 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-blue-700">{iv.scheduledAt ? dayjs(iv.scheduledAt).format('MMM') : '—'}</span>
                    <span className="text-lg font-bold leading-tight text-slate-900">{iv.scheduledAt ? dayjs(iv.scheduledAt).format('DD') : '—'}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{iv.candidateName}</span>
                    <span className="block truncate text-xs text-slate-600">
                      {iv.scheduledAt ? dayjs(iv.scheduledAt).format('HH:mm') : ''} · vòng {iv.interviewRound} · {iv.jobTitle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      {/* ── Active jobs ───────────────────────────────────────────────── */}
      <section aria-labelledby="active-jobs-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="active-jobs-title" className="m-0 text-base font-bold text-slate-900">
            Tin đang tuyển
          </h2>
          <Button type="link" className="!px-0" onClick={() => navigate('/client/jobs')}>
            Tất cả tin <ArrowRightOutlined />
          </Button>
        </div>
        {jobs.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : activeJobs.length === 0 ? (
          <Surface className="p-8 text-center">
            <p className="m-0 text-sm text-slate-600">Chưa có tin nào đang tuyển.</p>
            <Button type="primary" className="client-cta mt-3 !rounded-full" icon={<PlusOutlined />} onClick={() => navigate('/client/jobs/create')}>
              Đăng tin đầu tiên
            </Button>
          </Surface>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeJobs.slice(0, 6).map((j, i) => (
              <button
                key={j.jobId}
                type="button"
                onClick={() => navigate(`/client/candidates?job=${j.jobId}`)}
                className="admin-surface client-soft-card flex cursor-pointer flex-col gap-3 border-0 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
              >
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{j.title || 'Vị trí chưa đặt tên'}</span>
                <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
                  <EnvironmentOutlined aria-hidden /> {j.location || 'Chưa có địa điểm'}
                </span>
                <span className="mt-auto flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3">
                  <span className="flex items-center gap-1.5 text-[13px] text-slate-700">
                    <TeamOutlined className="text-blue-700" aria-hidden />
                    <b className="tabular-nums">{perJob[i]?.isLoading ? '…' : perJob[i]?.data ?? 0}</b> hồ sơ
                  </span>
                  <span className="text-xs text-slate-500">cần {j.quantity} người</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientOverviewPage;
