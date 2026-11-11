/**
 * @file CandidateHome.tsx
 * @description The Candidate home dashboard, real data only, following "HR Connect – Trang chủ Guest và Candidate.pdf" Page 3:
 * upcoming interview alert, personalized AI job matches (matching primary CV), profile completeness card with
 * job hunting toggle, recent applications with distinct status pills, featured employer banners, and newly posted jobs.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Popover, Skeleton, Switch } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { candidateApplicationsApi, candidateConsentApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { candidateDisplayStage, candidateInterviewType } from '@/features/portal/mf02Labels';
import type { CandidateJobMatchDto } from '@/types/api/candidateJobMatch';
import { CompanyMark, JobCard, SaveJobButton, salaryText } from './components/SiteParts';
import { companyPhoto, useFeaturedCompanies } from './useFeaturedCompanies';

const LINK = 'font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline';
const H2 = 'm-0 text-[22px] font-bold text-gray-900';
const EMPTY = 'rounded-xl border border-solid border-gray-200 bg-white p-6 text-center text-[14px] text-gray-600';

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-amber-700">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const interviewWhen = (iso: string) => {
  const d = dayjs(iso).locale('vi');
  const weekday = d.format('dddd').replace(/ (\S)/, (_, c: string) => ` ${c.toUpperCase()}`);
  return `${d.format('HH:mm')} ${weekday} ${d.format('DD/MM')}`;
};

const MatchCard: React.FC<{ match: CandidateJobMatchDto; onDismiss: () => void; dismissing: boolean }> = ({ match: m, onDismiss, dismissing }) => {
  const isRequirementFull = !m.missingRequirements?.length;
  return (
    <article className="group flex min-w-0 gap-3.5 rounded-xl border border-solid border-gray-200 bg-white p-3.5 transition-all duration-200 hover:border-sky-300 hover:shadow-xs">
      <CompanyMark name={m.companyName} logoUrl={m.companyLogoUrl} size={54} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/candidate/jobs/${m.jobId}`} title={m.jobTitle} className="truncate text-[15px] font-bold text-gray-900 no-underline group-hover:text-sky-800 transition-colors">
            {m.jobTitle}
          </Link>
          <SaveJobButton jobId={m.jobId} title={m.jobTitle} />
        </div>
        <div className="mt-0.5 truncate text-[13px] text-gray-600">{m.companyName}</div>
        <div className="mt-1 font-semibold text-[#059669] text-[14px]">{salaryText(m)}</div>

        {/* Match breakdown & Criteria badges */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <Popover
            trigger="click"
            title={<span className="font-bold text-[#0369A1]">Mức độ phù hợp: {Math.round(m.matchScore)}%</span>}
            content={
              <div className="max-w-[280px] text-[13px] space-y-2">
                {(m.matchingReasons ?? []).length > 0 && (
                  <div>
                    <span className="font-semibold text-emerald-700 block mb-1">✓ Yêu cầu đã đáp ứng:</span>
                    <ul className="m-0 pl-4 space-y-0.5 text-gray-700">
                      {m.matchingReasons!.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {(m.missingRequirements ?? []).length > 0 && (
                  <div>
                    <span className="font-semibold text-amber-700 block mb-1">! Cần trau dồi thêm:</span>
                    <ul className="m-0 pl-4 space-y-0.5 text-gray-700">
                      {m.missingRequirements!.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            }
          >
            <button
              type="button"
              className="cursor-pointer rounded-full border border-solid border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0C4A6E] hover:bg-sky-100 transition-colors"
            >
              Phù hợp {Math.round(m.matchScore)}%
            </button>
          </Popover>

          {isRequirementFull ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
              {m.matchingReasons?.[0] || 'Đạt yêu cầu bắt buộc'}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 border border-slate-200">
              Thiếu: {m.missingRequirements?.[0]}
            </span>
          )}

          <button
            type="button"
            disabled={dismissing}
            onClick={onDismiss}
            className="ml-auto cursor-pointer border-0 bg-transparent text-[12px] text-gray-400 hover:text-gray-600 underline"
          >
            Không quan tâm
          </button>
        </div>
      </div>
    </article>
  );
};

export const CandidateHome: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const matches = useQuery({ queryKey: ['candidate-job-matches'], queryFn: () => candidateJobMatchApi.getJobMatches() });
  const applications = useQuery({ queryKey: ['candidate-home', 'applications'], queryFn: () => candidateApplicationsApi.list({ page: 1, pageSize: 50 }) });
  const consents = useQuery({ queryKey: ['candidate-home', 'consents'], queryFn: () => candidateConsentApi.list({ status: 'PENDING', page: 1, pageSize: 1 }) });
  const cvs = useQuery({ queryKey: ['candidate-home', 'cvs'], queryFn: () => candidateCvApi.list() });
  const profile = useQuery({ queryKey: ['candidate', 'profile'], queryFn: () => mf04Api.getProfile() });
  const latest = usePublicJobSearch({ page: 1, pageSize: 6 });
  const { companies: employers } = useFeaturedCompanies();

  const apps = useMemo(() => applications.data?.items ?? [], [applications.data]);
  const interviewApp = apps.find((a) => a.displayGroup === 'INTERVIEW');
  const interviews = useQuery({
    queryKey: ['candidate-home', 'interviews', interviewApp?.applicationId],
    queryFn: () => mf04Api.getInterviews({ applicationId: interviewApp!.applicationId, sortDirection: 'ASC' }),
    enabled: Boolean(interviewApp),
  });
  const nextInterview = (interviews.data ?? []).find(
    (i) => i.scheduledAt && dayjs(i.scheduledAt).isAfter(dayjs()) && !['CANCELLED', 'COMPLETED'].includes(String(i.status).toUpperCase())
  );

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

  // Profile completeness percentage
  const fields = [p?.fullName, p?.phone, p?.currentAddress, p?.currentJobTitle, p?.targetRole, p?.yearsOfExperience, p?.summary, p?.preferredLocations?.length];
  const completion = p ? Math.round((fields.filter(Boolean).length / fields.length) * 100) : null;
  const missingSkills = Boolean(p) && !p?.skills?.length;
  const missingSalary = Boolean(p) && p?.expectedSalaryMin == null && p?.expectedSalaryMax == null;

  const isPublic = (p?.profileVisibility ?? '').toUpperCase() === 'PUBLIC';

  const matchItems = (matches.data?.items ?? []).slice(0, 6);
  const recentApps = apps.slice(0, 3);
  const latestJobs = (latest.data?.items ?? []).slice(0, 6);

  return (
    <>
      {/* 1. Upcoming interview and referrals to confirm: only when there are real ones */}
      {(nextInterview || pendingConsents > 0) && (
        <div className="border-0 border-b border-solid border-amber-200 bg-[#FFF7ED]">
          <div className="mx-auto flex max-w-[1248px] flex-col gap-2 px-4 py-3 text-[#7C2D12] sm:px-6">
            {nextInterview?.scheduledAt && interviewApp && (
              <div className="flex flex-wrap items-center gap-3 text-[14px]">
                <AlertIcon />
                <span>
                  <b>Phỏng vấn sắp tới:</b> {interviewApp.jobTitle} tại {interviewApp.companyName}, {interviewWhen(nextInterview.scheduledAt)}, {candidateInterviewType(nextInterview.interviewType).toLowerCase()}
                </span>
                <Link to={`/candidate/interviews/${nextInterview.interviewId}`} className="ml-auto font-bold text-[#0284C7] no-underline hover:text-[#0369A1] hover:underline">
                  Xem lịch phỏng vấn
                </Link>
              </div>
            )}
            {pendingConsents > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-[14px]">
                <AlertIcon />
                <span><b>Cần bạn xác nhận:</b> {pendingConsents} lời giới thiệu từ Affiliate</span>
                <Link to="/candidate/applications?tab=consents" className="ml-auto font-bold text-[#0284C7] no-underline hover:text-[#0369A1] hover:underline">
                  Xem và xác nhận
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-[1248px] flex-col gap-10 px-4 pb-14 pt-7 sm:px-6">
        {/* 2. Main 2-Column Bento Grid Layout (7:5 or 8:4 ratio) */}
        <div className="flex flex-wrap items-start gap-6">
          {/* Left Column: Việc làm phù hợp với hồ sơ của bạn */}
          <section aria-labelledby="home-fit" className="min-w-0 flex-[999_1_640px]">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="home-fit" className={H2}>Việc làm phù hợp với hồ sơ của bạn</h2>
              <Link to="/candidate/jobs" className={LINK}>Xem tất cả</Link>
            </div>
            <p className="m-0 mb-4 text-[13px] text-gray-500">
              {primaryCv ? (
                <>
                  Xếp theo mức độ phù hợp với CV chính{' '}
                  <Link to="/candidate/cvs" className="font-semibold text-sky-700 no-underline hover:underline">
                    {primaryCv.title || primaryCv.fileName}
                  </Link>
                  . Bấm vào mức phù hợp để xem yêu cầu nào bạn đã đáp ứng.
                </>
              ) : (
                <>
                  Bạn chưa có CV chính.{' '}
                  <Link to="/candidate/cvs" className="font-semibold text-sky-700 no-underline hover:underline">Chọn CV chính</Link>
                  {' '}để nhận gợi ý việc làm.
                </>
              )}
            </p>

            {matches.isLoading ? (
              <div className={EMPTY}><Skeleton active paragraph={{ rows: 3 }} /></div>
            ) : matches.isError ? (
              <div className={EMPTY}>
                Chưa tải được gợi ý việc làm.{' '}
                <button type="button" onClick={() => matches.refetch()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-sky-700 hover:underline">Thử lại</button>
              </div>
            ) : matchItems.length === 0 ? (
              <div className={EMPTY}>
                Chưa có gợi ý nào. Gợi ý được tạo từ CV chính khi hồ sơ của bạn ở chế độ công khai.{' '}
                <Link to="/candidate/jobs" className={LINK}>Xem tất cả việc làm</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {matchItems.map((m) => (
                  <MatchCard
                    key={m.candidateJobMatchId}
                    match={m}
                    dismissing={dismiss.isPending}
                    onDismiss={() => dismiss.mutate(m.candidateJobMatchId)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right Column: Profile Completeness & Recent Applications */}
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            {/* Card 1: Hồ sơ của bạn */}
            <section aria-labelledby="home-profile" className="rounded-xl border border-solid border-gray-200 bg-white p-5 shadow-xs">
              <div className="flex items-baseline justify-between">
                <h2 id="home-profile" className="m-0 text-[16px] font-bold text-gray-900">Hồ sơ của bạn</h2>
                {completion !== null && <span className="font-extrabold text-[18px] text-[#0C4A6E]">{completion}%</span>}
              </div>
              <div className="mb-3.5 mt-2.5 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="Mức hoàn thiện hồ sơ" aria-valuenow={completion ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-sky-600 transition-all duration-300" style={{ width: `${completion ?? 0}%` }} />
              </div>
              {(missingSkills || missingSalary) && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
                  {missingSkills && (
                    <li>
                      <Link to="/candidate/profile" className="text-sky-700 font-medium no-underline hover:underline">
                        Thêm kỹ năng chính
                      </Link>{' '}
                      <span className="text-gray-500">để gợi ý chính xác hơn</span>
                    </li>
                  )}
                  {missingSalary && (
                    <li>
                      <Link to="/candidate/profile" className="text-sky-700 font-medium no-underline hover:underline">
                        Cập nhật mức lương mong muốn
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              <div className="mt-4 flex cursor-pointer items-center justify-between gap-3 border-0 border-t border-solid border-slate-100 pt-3.5">
                <div>
                  <b className="block text-[14px] text-gray-900">Đang tìm việc</b>
                  <span className="text-[12px] text-gray-500">Nhà tuyển dụng thấy bạn sẵn sàng</span>
                </div>
                <Switch
                  checked={isPublic}
                  disabled={!p}
                  loading={visibility.isPending}
                  onChange={(checked) => visibility.mutate(checked ? 'PUBLIC' : 'PRIVATE')}
                  className="bg-slate-300"
                />
              </div>
            </section>

            {/* Card 2: Đơn ứng tuyển (Xem tất cả) */}
            <section aria-labelledby="home-apps" className="rounded-xl border border-solid border-gray-200 bg-white p-5 shadow-xs">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="home-apps" className="m-0 text-[16px] font-bold text-gray-900">Đơn ứng tuyển</h2>
                <Link to="/candidate/applications" className={`text-[13px] ${LINK}`}>Xem tất cả</Link>
              </div>
              {applications.isLoading ? (
                <Skeleton active title={false} paragraph={{ rows: 3 }} />
              ) : recentApps.length === 0 ? (
                <p className="m-0 py-2 text-[13px] text-gray-500">
                  Bạn chưa có đơn ứng tuyển nào. <Link to="/candidate/jobs" className={LINK}>Tìm việc làm</Link>
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentApps.map((a) => {
                    const stageLabel = candidateDisplayStage(a.displayGroup, a.displayLabel).label;
                    const isInterview = stageLabel.includes('Phỏng vấn');
                    const isScreening = stageLabel.includes('sàng lọc') || stageLabel.includes('xem');
                    const badgeClass = isInterview
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : isScreening
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

                    return (
                      <Link
                        key={a.applicationId}
                        to={`/candidate/applications/${a.applicationId}`}
                        className="block py-3 text-gray-800 no-underline hover:text-sky-800 group transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-bold text-[14px] text-gray-900 group-hover:text-sky-800">{a.jobTitle}</span>
                          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                            {stageLabel}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[13px] text-gray-500">{a.companyName}</div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* 3. Nhà tuyển dụng nổi bật */}
        {employers.length > 0 && (
          <section aria-labelledby="home-brands">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 id="home-brands" className={H2}>Nhà tuyển dụng nổi bật</h2>
                <p className="m-0 mt-0.5 text-[13px] text-slate-500">Các công ty đã xác minh đang tuyển trên HR Connect</p>
              </div>
              <Link to="/companies" className={LINK}>Xem tất cả</Link>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {employers.slice(0, 3).map((company) => {
                const photo = companyPhoto(company.companyName);
                const about = company.description || company.industry?.name;
                return (
                  <Link
                    key={company.companyId}
                    to={`/jobs?keyword=${encodeURIComponent(company.companyName)}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white text-slate-900 no-underline shadow-xs transition-all duration-300 hover:border-sky-300 hover:shadow-lg hover:-translate-y-1"
                  >
                    <div className="relative flex h-[140px] flex-col justify-end overflow-hidden bg-[#0C4A6E] p-4">
                      {photo && (
                        <img
                          src={photo}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
                      <span className="absolute top-3 right-3 z-10 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-0.5 text-[10.5px] font-bold text-sky-800 shadow-sm">
                        Nổi bật
                      </span>
                      <div className="relative z-10">
                        <span className="block text-[16px] font-bold tracking-tight text-white drop-shadow-sm">
                          {company.companyName}
                        </span>
                        {about && (
                          <span className="mt-1 block text-[12px] text-slate-200 line-clamp-1 drop-shadow-xs font-medium">
                            {about}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-solid border-slate-100 bg-white px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 overflow-hidden rounded-lg border border-slate-100 shadow-xs">
                          <CompanyMark name={company.companyName} logoUrl={company.logoUrl} size={42} />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-bold text-[14.5px] text-slate-900 group-hover:text-sky-800 transition-colors">
                            {company.companyName}
                          </span>
                          <span className="text-[12.5px] font-semibold text-sky-700">
                            {company.activeJobCount} việc làm đang tuyển
                          </span>
                        </div>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors ml-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. Việc làm mới đăng */}
        <section aria-labelledby="home-latest">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="home-latest" className={H2}>Việc làm mới đăng</h2>
            <Link to="/candidate/jobs?tab=all" className={LINK}>
              Xem tất cả{latest.data?.totalCount ? ` ${latest.data.totalCount.toLocaleString('vi-VN')}` : ''} việc làm
            </Link>
          </div>
          {latest.isLoading ? (
            <div className={EMPTY}><Skeleton active paragraph={{ rows: 2 }} /></div>
          ) : latestJobs.length === 0 ? (
            <div className={EMPTY}>Hiện chưa có việc làm mới.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {latestJobs.map((job) => <JobCard key={job.jobId} job={job} saveable={false} />)}
            </div>
          )}
        </section>
      </main>
    </>
  );
};
