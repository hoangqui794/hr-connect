/**
 * @file HrOverviewPage.tsx
 * @description "Việc cần làm" for Internal HR: job review queue (MF-01), applications waiting
 * for screening (MF-03), newest applications and upcoming interviews (read-only, MF-04).
 * Every number comes from a backend endpoint; nothing is mocked.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from 'antd';
import { ArrowRightOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { jobsApi } from '@/services/api/jobsApi';
import { pipelineApi, screeningApi } from '@/services/api/hrApi';
import { useAuthStore } from '@/stores/authStore';
import { PersonCell, StatTile, StatusDot, Surface } from '@/features/admin-console/ui';
import { pick, INTERVIEW_STATUS, statusOf } from './hrLabels';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

const Count: React.FC<{ q: { isLoading: boolean; isError: boolean; data?: number } }> = ({ q }) =>
  q.isLoading ? <Skeleton.Input active size="small" /> : <>{q.isError ? '—' : q.data}</>;

const useApplicationCount = (status: string) =>
  useQuery({
    queryKey: ['hr-overview', 'applications', status],
    queryFn: async () => (await screeningApi.list({ status, page: 1, pageSize: 1 })).total,
  });

export const HrOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const jobs = useQuery({ queryKey: ['hr-overview', 'jobs'], queryFn: async () => (await jobsApi.getReviewQueue()).length });
  const submitted = useApplicationCount('SUBMITTED');
  const screening = useApplicationCount('SCREENING');
  const shortlisted = useApplicationCount('SHORTLISTED');
  const recent = useQuery({
    queryKey: ['hr-overview', 'recent'],
    queryFn: async () => (await screeningApi.list({ page: 1, pageSize: 6 })).items,
  });
  const upcoming = useQuery({
    queryKey: ['hr-overview', 'interviews'],
    queryFn: async () => (await pipelineApi.interviews({ status: 'SCHEDULED', page: 1, pageSize: 4 })).items,
  });

  const firstName = (user?.name || 'bạn').trim().split(/\s+/).slice(-1)[0];
  const loading = jobs.isLoading || submitted.isLoading;
  const waiting = (jobs.data ?? 0) + (submitted.data ?? 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-4">
      {/* Hero */}
      <Surface className="relative overflow-hidden p-7 lg:col-span-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(3,105,161,0.12), transparent 70%)' }}
        />
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-800">{dayjs().format('dddd, DD/MM/YYYY')}</div>
        <h1 className="m-0 mt-2 text-[28px] font-bold leading-tight tracking-[-0.01em] text-slate-900">Chào {firstName},</h1>
        <p className="m-0 mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
          {loading
            ? 'Đang tổng hợp việc cần làm...'
            : waiting === 0
              ? 'Không có tin hay hồ sơ nào đang chờ bạn. Mọi thứ đã được xử lý.'
              : `Có ${jobs.data ?? 0} tin tuyển dụng chờ duyệt và ${submitted.data ?? 0} hồ sơ mới chờ sàng lọc.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="primary" size="large" onClick={() => navigate('/hr/screening?status=SUBMITTED')}>
            Sàng lọc hồ sơ
          </Button>
          <Button size="large" onClick={() => navigate('/hr/jobs')}>
            Duyệt tin tuyển dụng
          </Button>
        </div>
      </Surface>

      <StatTile
        label="Tin chờ duyệt"
        value={<Count q={jobs} />}
        hint="Client đã gửi, chưa công bố"
        tone="warning"
        onClick={() => navigate('/hr/jobs')}
      />
      <StatTile
        label="Hồ sơ mới"
        value={<Count q={submitted} />}
        hint="Chưa ai mở sàng lọc"
        tone="warning"
        onClick={() => navigate('/hr/screening?status=SUBMITTED')}
      />

      {/* Newest applications */}
      <Surface className="p-6 lg:col-span-2 lg:row-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-slate-900">Hồ sơ mới nhất</h2>
          <Button type="link" className="!px-0" onClick={() => navigate('/hr/screening')}>
            Xem tất cả <ArrowRightOutlined />
          </Button>
        </div>
        {recent.isLoading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : recent.isError ? (
          <p className="m-0 text-sm text-slate-600">Không tải được danh sách hồ sơ.</p>
        ) : (recent.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-slate-600">Chưa có hồ sơ nào.</p>
        ) : (
          <ol className="m-0 list-none space-y-1 p-0">
            {recent.data!.map((a) => {
              const st = statusOf(a.status);
              return (
                <li key={a.applicationId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/hr/screening?open=${a.applicationId}`)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-2 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                  >
                    <span className="min-w-0 flex-1">
                      <PersonCell name={a.candidateName} secondary={`${a.jobTitle} · ${a.companyName}`} size={34} />
                    </span>
                    {a.aiMatchScore != null && (
                      <span className="shrink-0 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky-900">
                        AI {Math.round(a.aiMatchScore)}
                      </span>
                    )}
                    <span className="hidden shrink-0 sm:block">
                      <StatusDot tone={st.tone}>{st.label}</StatusDot>
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-600">{dayjs(a.appliedAt).fromNow()}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Surface>

      <StatTile
        label="Đang sàng lọc"
        value={<Count q={screening} />}
        hint="Đã mở, chưa quyết định"
        tone="info"
        onClick={() => navigate('/hr/screening?status=SCREENING')}
      />
      <StatTile
        label="Đã chọn gửi Client"
        value={<Count q={shortlisted} />}
        hint="Client đã thấy hồ sơ"
        tone="success"
        onClick={() => navigate('/hr/screening?status=SHORTLISTED')}
      />

      {/* Upcoming interviews (read-only) */}
      <Surface className="p-6 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-slate-900">Phỏng vấn sắp tới</h2>
          <Button type="link" className="!px-0" onClick={() => navigate('/hr/pipeline')}>
            Tiến độ <ArrowRightOutlined />
          </Button>
        </div>
        {upcoming.isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (upcoming.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-slate-600">
            Chưa có lịch phỏng vấn nào. Client lên lịch sau khi bạn chọn hồ sơ gửi đi.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {upcoming.data!.map((iv) => {
              const st = pick(INTERVIEW_STATUS, iv.status);
              return (
                <li key={iv.interviewId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <CalendarOutlined className="text-sky-800" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {iv.candidateName} · vòng {iv.interviewRound}
                    </span>
                    <span className="block truncate text-xs text-slate-600">{iv.jobTitle}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-700">
                    {iv.scheduledAt ? dayjs(iv.scheduledAt).format('HH:mm DD/MM') : '—'}
                  </span>
                  <StatusDot tone={st.tone}>{st.label}</StatusDot>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </div>
  );
};

export default HrOverviewPage;
