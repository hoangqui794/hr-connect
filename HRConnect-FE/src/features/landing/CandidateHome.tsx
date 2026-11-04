/**
 * @file CandidateHome.tsx
 * @description What a signed-in Candidate sees under the search band; follows Candidate.dc.html of the
 * 03/11 mockup: upcoming interview, jobs matching the primary CV, profile strength, recent applications,
 * featured employers and new jobs.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Popover, Skeleton } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';
import { candidateApplicationsApi, candidateConsentApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { candidateDisplayStage, candidateInterviewType } from '@/features/portal/mf02Labels';
import type { CandidateJobMatchDto } from '@/types/api/candidateJobMatch';
import { CompanyMark, JobCard, SaveJobButton, salaryText } from './components/SiteParts';

const LINK = 'font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline';
const H2 = 'm-0 text-[22px] font-bold text-gray-800';

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const interviewWhen = (iso: string) => {
  const d = dayjs(iso).locale('vi');
  const weekday = d.format('dddd').replace(/ (\S)/, (_, c: string) => ` ${c.toUpperCase()}`);
  return `${d.format('HH:mm')} ${weekday} ${d.format('DD/MM')}`;
};

const MatchCard: React.FC<{ match: CandidateJobMatchDto; onDismiss: () => void; dismissing: boolean }> = ({ match: m, onDismiss, dismissing }) => (
  <article className="flex min-w-0 gap-3 rounded-lg border border-solid border-gray-200 bg-white p-3.5">
    <CompanyMark name={m.companyName} logoUrl={m.companyLogoUrl} />
    <div className="min-w-0 flex-1">
      <Link to={`/candidate/jobs/${m.jobId}`} title={m.jobTitle} className="block truncate text-[15px] font-semibold text-gray-900 no-underline hover:text-sky-800">{m.jobTitle}</Link>
      <div className="mt-0.5 truncate text-[13px] text-gray-600">{m.companyName}</div>
      <div className="mt-1.5 font-semibold text-[#C2410C]">{salaryText(m)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
        <Popover
          trigger="click"
          title="Mức phù hợp"
          content={
            <div className="max-w-[280px] text-[13px]">
              {(m.matchingReasons ?? []).length > 0 && <ul className="m-0 pl-4">{m.matchingReasons!.map((r) => <li key={r}>{r}</li>)}</ul>}
              {(m.missingRequirements ?? []).length > 0 && (
                <>
                  <b className="mt-2 block">Còn thiếu</b>
                  <ul className="m-0 pl-4">{m.missingRequirements!.map((r) => <li key={r}>{r}</li>)}</ul>
                </>
              )}
              {!(m.matchingReasons ?? []).length && !(m.missingRequirements ?? []).length && 'Chưa có chi tiết.'}
            </div>
          }
        >
          <button type="button" className="cursor-pointer rounded border border-solid border-slate-300 bg-slate-50 px-2 py-0.5 text-[12px] font-semibold text-slate-800">Phù hợp {Math.round(m.matchScore)}%</button>
        </Popover>
        {m.missingRequirements?.[0]
          ? <span className="text-gray-500">Thiếu: {m.missingRequirements[0]}</span>
          : m.matchingReasons?.[0] && <span className="text-gray-500">{m.matchingReasons[0]}</span>}
        <button type="button" disabled={dismissing} onClick={onDismiss} className="ml-auto min-h-8 cursor-pointer border-0 bg-transparent text-[12px] text-gray-600 underline">Không quan tâm</button>
      </div>
    </div>
    <SaveJobButton jobId={m.jobId} title={m.jobTitle} />
  </article>
);

export const CandidateHome: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const matches = useQuery({ queryKey: ['candidate-job-matches'], queryFn: () => candidateJobMatchApi.getJobMatches() });
  const applications = useQuery({ queryKey: ['candidate-home', 'applications'], queryFn: () => candidateApplicationsApi.list({ page: 1, pageSize: 50 }) });
  const consents = useQuery({ queryKey: ['candidate-home', 'consents'], queryFn: () => candidateConsentApi.list({ status: 'PENDING', page: 1, pageSize: 1 }) });
  const cvs = useQuery({ queryKey: ['candidate-home', 'cvs'], queryFn: () => candidateCvApi.list() });
  const profile = useQuery({ queryKey: ['candidate', 'profile'], queryFn: () => mf04Api.getProfile() });
  const featured = useQuery({ queryKey: ['public-companies', 'featured'], queryFn: () => companyDirectoryApi.featured(), staleTime: 5 * 60_000 });
  const latest = usePublicJobSearch({ page: 1, pageSize: 6 });

  const apps = applications.data?.items ?? [];
  const interviewApp = apps.find((a) => a.displayGroup === 'INTERVIEW');
  const interviews = useQuery({
    queryKey: ['candidate-home', 'interviews', interviewApp?.applicationId],
    queryFn: () => mf04Api.getInterviews({ applicationId: interviewApp!.applicationId, sortDirection: 'ASC' }),
    enabled: Boolean(interviewApp),
  });
  const nextInterview = (interviews.data ?? []).find((i) => i.scheduledAt && dayjs(i.scheduledAt).isAfter(dayjs()) && !['CANCELLED', 'COMPLETED'].includes(String(i.status).toUpperCase()));

  const dismiss = useMutation({
    mutationFn: (id: string) => candidateJobMatchApi.dismissJobMatch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate-job-matches'] }),
    onError: (e) => message.error(getApiErrorMessage(e, 'Chưa ẩn được việc này.')),
  });
  const visibility = useMutation({
    mutationFn: (next: 'PUBLIC' | 'PRIVATE') => mf04Api.updateVisibility({ visibility: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate', 'profile'] }),
    onError: (e) => message.error(getApiErrorMessage(e, 'Chưa đổi được trạng thái.')),
  });

  const pendingConsents = consents.data?.total ?? 0;
  const primaryCv = (cvs.data ?? []).find((c) => c.isPrimary);
  const p = profile.data;
  // The same eight fields the profile page counts, so both show one number.
  const fields = [p?.fullName, p?.phone, p?.currentAddress, p?.currentJobTitle, p?.targetRole, p?.yearsOfExperience, p?.summary, p?.preferredLocations?.length];
  const completion = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const todo: { label: string; note?: string }[] = [
    ...(p?.skills?.length ? [] : [{ label: 'Thêm kỹ năng chính', note: 'để gợi ý chính xác hơn' }]),
    ...(p?.targetRole ? [] : [{ label: 'Cập nhật vị trí mong muốn' }]),
    ...(p?.summary ? [] : [{ label: 'Viết giới thiệu ngắn' }]),
    ...(p?.yearsOfExperience ? [] : [{ label: 'Thêm số năm kinh nghiệm' }]),
  ].slice(0, 2);
  const isPublic = (p?.profileVisibility || 'PRIVATE').toUpperCase() === 'PUBLIC';
  const brands = (featured.data ?? []).filter((c) => c.activeJobCount > 0).slice(0, 3);

  return (
    <>
      {(interviewApp || pendingConsents > 0) && (
        <div className="border-0 border-b border-solid border-orange-200 bg-orange-50">
          <div className="mx-auto flex max-w-[1248px] flex-col gap-2 px-4 py-3 text-[#7C2D12] sm:px-6">
            {interviewApp && (
              <div className="flex flex-wrap items-center gap-3">
                <AlertIcon />
                <span>
                  <b>{nextInterview ? 'Phỏng vấn sắp tới:' : 'Đang ở vòng phỏng vấn:'}</b> {interviewApp.jobTitle} tại {interviewApp.companyName}
                  {nextInterview?.scheduledAt && `, ${interviewWhen(nextInterview.scheduledAt)}, ${candidateInterviewType(nextInterview.interviewType).toLowerCase()}`}
                </span>
                <Link to={nextInterview ? `/candidate/interviews/${nextInterview.interviewId}` : `/candidate/applications/${interviewApp.applicationId}`} className="ml-auto font-semibold text-orange-800 no-underline hover:underline">Xem lịch phỏng vấn</Link>
              </div>
            )}
            {pendingConsents > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <AlertIcon />
                <span><b>Cần bạn xác nhận:</b> {pendingConsents} lời giới thiệu từ Affiliate</span>
                <Link to="/candidate/applications?tab=consents" className="ml-auto font-semibold text-orange-800 no-underline hover:underline">Xem và xác nhận</Link>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-[1248px] flex-col gap-10 px-4 pb-14 pt-7 sm:px-6">
        <div className="flex flex-wrap items-start gap-6">
          <section aria-labelledby="home-fit" className="min-w-0 flex-[999_1_640px]">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="home-fit" className={H2}>Việc làm phù hợp với hồ sơ của bạn</h2>
              <Link to="/candidate/jobs" className={LINK}>Xem tất cả</Link>
            </div>
            <p className="m-0 mb-3.5 text-[13px] text-gray-500">
              {primaryCv
                ? <>Xếp theo mức độ phù hợp với CV chính <Link to="/candidate/cvs" className="text-sky-700 no-underline hover:underline">{primaryCv.title || primaryCv.fileName}</Link>. Bấm vào mức phù hợp để xem yêu cầu nào bạn đã đáp ứng.</>
                : <>Chọn một CV chính trong <Link to="/candidate/cvs" className="text-sky-700 no-underline hover:underline">Kho CV</Link> để nhận gợi ý.</>}
            </p>
            {matches.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="rounded-lg border border-solid border-gray-200 bg-white p-3.5"><Skeleton active avatar paragraph={{ rows: 2 }} title={false} /></div>)}</div>
            ) : (matches.data?.items ?? []).length === 0 ? (
              <div className="rounded-lg border border-solid border-gray-200 bg-white px-4 py-10 text-center">
                <div className="font-semibold text-gray-900">Chưa có việc làm phù hợp</div>
                <p className="m-0 mt-1 text-[13px] text-gray-600">Gợi ý cần hồ sơ công khai và một CV chính. Hệ thống cập nhật định kỳ.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(matches.data?.items ?? []).slice(0, 6).map((m) => (
                  <MatchCard key={m.candidateJobMatchId} match={m} dismissing={dismiss.isPending} onDismiss={() => dismiss.mutate(m.candidateJobMatchId)} />
                ))}
              </div>
            )}
          </section>

          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
            <section aria-labelledby="home-profile" className="rounded-lg border border-solid border-gray-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <h2 id="home-profile" className="m-0 text-[16px] font-bold text-gray-800">Hồ sơ của bạn</h2>
                {p && <span className="font-semibold">{completion}%</span>}
              </div>
              {profile.isLoading ? <Skeleton active paragraph={{ rows: 2 }} title={false} /> : (
                <>
                  <div className="mb-3 mt-2.5 h-1.5 rounded-[3px] bg-gray-200" role="progressbar" aria-label="Mức hoàn thiện hồ sơ" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-1.5 rounded-[3px] bg-sky-700" style={{ width: `${completion}%` }} />
                  </div>
                  {todo.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {todo.map((t) => (
                        <li key={t.label}><Link to="/candidate/profile" className="text-sky-700 no-underline hover:underline">{t.label}</Link>{t.note && <span className="text-gray-500"> {t.note}</span>}</li>
                      ))}
                    </ul>
                  )}
                  <label className="mt-3.5 flex cursor-pointer items-center justify-between gap-3 border-0 border-t border-solid border-slate-100 pt-3">
                    <span><b className="block">Đang tìm việc</b><span className="text-[13px] text-gray-500">Nhà tuyển dụng thấy bạn sẵn sàng</span></span>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      disabled={visibility.isPending}
                      onChange={(e) => visibility.mutate(e.target.checked ? 'PUBLIC' : 'PRIVATE')}
                      className="h-5 w-5 shrink-0 cursor-pointer accent-sky-700"
                    />
                  </label>
                </>
              )}
            </section>

            <section aria-labelledby="home-apps" className="rounded-lg border border-solid border-gray-200 bg-white p-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <h2 id="home-apps" className="m-0 text-[16px] font-bold text-gray-800">Đơn ứng tuyển</h2>
                <Link to="/candidate/applications" className={`text-[13px] ${LINK}`}>Xem tất cả</Link>
              </div>
              {applications.isLoading ? <Skeleton active paragraph={{ rows: 2 }} title={false} /> : apps.length === 0 ? (
                <p className="m-0 border-0 border-t border-solid border-slate-100 pt-3 text-[13px] text-gray-600">Bạn chưa ứng tuyển việc nào.</p>
              ) : apps.slice(0, 3).map((a) => (
                <Link key={a.applicationId} to={`/candidate/applications/${a.applicationId}`} className="block border-0 border-t border-solid border-slate-100 py-2.5 text-gray-800 no-underline hover:text-gray-900">
                  <div className="truncate font-semibold">{a.jobTitle}</div>
                  <div className="mt-0.5 flex justify-between gap-2 text-[13px]"><span className="truncate text-gray-500">{a.companyName}</span><span className="shrink-0 font-medium text-slate-900">{candidateDisplayStage(a.displayGroup, a.displayLabel).label}</span></div>
                </Link>
              ))}
            </section>
          </aside>
        </div>

        {brands.length > 0 && (
          <section aria-labelledby="home-brands">
            <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="home-brands" className={H2}>Nhà tuyển dụng nổi bật</h2>
              <Link to="/companies" className={LINK}>Xem tất cả</Link>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {brands.map((c) => (
                <Link key={c.companyId} to={`/companies/${c.companyId}`} className="flex flex-col overflow-hidden rounded-lg border border-solid border-gray-200 bg-white text-gray-900 no-underline hover:text-gray-900">
                  {/* The API has no company banner image yet; this block is where it goes. */}
                  <span className="flex h-[150px] items-center justify-center bg-[#E7ECF3] px-5 text-center text-[12px] leading-relaxed text-slate-600">
                    <span className="line-clamp-4">{c.description}</span>
                  </span>
                  <span className="flex items-center gap-2.5 px-3.5 py-3">
                    <CompanyMark name={c.companyName} logoUrl={c.logoUrl} size={40} />
                    <span className="min-w-0"><span className="block truncate font-semibold">{c.companyName}</span><span className="text-[13px] text-sky-700">{c.activeJobCount} việc làm</span></span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="home-latest">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="home-latest" className={H2}>Việc làm mới đăng</h2>
            <Link to="/candidate/jobs?tab=all" className={LINK}>Xem tất cả{latest.data?.totalCount ? ` ${latest.data.totalCount.toLocaleString('vi-VN')}` : ''} việc làm</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(latest.data?.items ?? []).slice(0, 6).map((job) => <JobCard key={job.jobId} job={job} saveable={false} />)}
          </div>
        </section>
      </main>
    </>
  );
};
