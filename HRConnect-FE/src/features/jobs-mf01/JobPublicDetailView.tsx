/**
 * @file JobPublicDetailView.tsx
 * @description Job detail at /jobs/:id (mockup 03/11, JobDetail.dc.html), for guests and every role.
 *  Sections without data are left out. Candidates apply through the real MF-02 modal, affiliates go to the referral form.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Navbar } from '@/features/landing/components/Navbar';
import { CompanyMark, jobHref, postedText, salaryText } from '@/features/landing/components/SiteParts';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { ApplyModal } from '@/features/portal/JobApplyActions';
import { useCandidateCvs } from '@/features/portal/CandidatePages';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/api/jobs';
import { EMPLOYMENT_TYPE_LABEL, experienceText } from './jobDisplay';
import { WORK_MODE_LABEL, detectWorkMode } from './jobFormOptions';
import { useJobDetail, usePublicJobSearch } from './useJobQueries';

const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white';
const H2 = 'm-0 mb-[10px] text-[17px] font-bold text-[#1F2937]';

/** Job text is stored as plain lines; each line becomes one bullet. */
const toLines = (text?: string | null) =>
  (text ?? '').split(/\r?\n/).map((line) => line.trim().replace(/^[-•*+]\s*/, '')).filter(Boolean);

/** Only web addresses become links; anything else in the company's website field stays out of href. */
const websiteHref = (website: string) => {
  if (/^https?:\/\//i.test(website)) return website;
  return /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(website) ? `https://${website}` : null;
};

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-[#1F2937] [line-height:normal]">
    <Navbar />
    <main className="mx-auto max-w-[1248px] px-4 pb-14 pt-5 sm:px-6">{children}</main>
  </div>
);

const BulletSection: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <>
      <h2 className={H2}>{title}</h2>
      <ul className="m-0 mb-[22px] list-disc pl-5">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </>
  );

const Heart: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#E11D48' : 'none'} stroke={filled ? '#E11D48' : 'currentColor'} strokeWidth="1.8" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </svg>
);

/** Real match score only; the CV query needs a candidate session, so this mounts for candidates alone. */
const FitBanner: React.FC<{ score: number; onChangeCv: () => void }> = ({ score, onChangeCv }) => {
  const cvs = useCandidateCvs();
  const primary = cvs.data?.find((cv) => cv.isPrimary);
  const cvName = primary?.title || primary?.fileName;
  return (
    <section aria-labelledby="fit" className="mt-3 flex flex-wrap items-center gap-[14px] rounded-lg border border-solid border-[#E2E8F0] bg-[#F8FAFC] px-[18px] py-[14px]">
      <span className="text-[20px] font-bold text-[#0C4A6E]">{Math.round(score)}%</span>
      <div className="min-w-0 flex-[1_1_400px]">
        <h2 id="fit" className="m-0 text-[14px] font-semibold text-[#1F2937]">Mức phù hợp ước tính với CV chính của bạn</h2>
        <p className="m-0 mt-0.5 text-[13px] text-[#4B5563]">
          Tính từ hồ sơ{cvName ? <> và <Link to="/candidate/cvs" className={LINK}>{cvName}</Link></> : null}. Sau khi ứng tuyển, hệ thống đánh giá chi tiết từng yêu cầu kèm bằng chứng trích từ CV.
        </p>
      </div>
      <button type="button" onClick={onChangeCv} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold ${LINK}`}>
        Đổi CV dùng để ứng tuyển
      </button>
    </section>
  );
};

const SimilarJobs: React.FC<{ job: Job }> = ({ job }) => {
  const search = job.skills.find((skill) => skill.skillName)?.skillName ?? job.title;
  const results = usePublicJobSearch({ search, page: 1, pageSize: 5 });
  const similar = (results.data?.items ?? []).filter((other) => other.jobId !== job.jobId).slice(0, 4);
  if (similar.length === 0) return null;
  return (
    <section aria-labelledby="similar" className={`${CARD} p-[18px]`}>
      <h2 id="similar" className="m-0 mb-1.5 text-[15px] font-bold text-[#1F2937]">Việc làm tương tự</h2>
      {similar.map((other) => (
        <Link key={other.jobId} to={jobHref(other.jobId)} className="flex gap-2.5 border-0 border-t border-solid border-[#F1F5F9] py-2.5 text-[#1F2937] no-underline hover:text-[#075985]">
          <CompanyMark name={other.companyName} logoUrl={other.companyLogoUrl} size={42} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{other.title}</span>
            <span className="block text-[13px] text-[#6B7280]">{other.companyName}</span>
            <span className="block text-[13px] font-semibold text-[#059669]">{salaryText(other)}</span>
          </span>
        </Link>
      ))}
    </section>
  );
};

const JobContent: React.FC<{ job: Job }> = ({ job }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAnyRole = useAuthStore((s) => s.hasAnyRole);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { isSaved, toggleSave } = useSavedJobs();
  const { isApplied, getApplication } = useCandidateAppliedJobs();
  const [applyOpen, setApplyOpen] = useState(false);

  const isCandidate = isAuthenticated && hasAnyRole([UserRole.CANDIDATE]);
  const isReferrer = isAuthenticated && hasAnyRole([UserRole.AFFILIATE]) && hasPermission('submission.create');
  const applied = isCandidate && isApplied(job.jobId);
  const canApply = isCandidate && !applied && job.isAcceptingApplications !== false && hasPermission('application.create');

  const matches = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    enabled: isCandidate,
    staleTime: 5 * 60_000,
  });
  const match = matches.data?.items.find((item) => item.jobId === job.jobId);

  // Back from login with the intent to apply: open the modal once, then clear the intent.
  const resumeApply = (location.state as { intent?: string } | null)?.intent === 'apply';
  useEffect(() => {
    if (!isAuthenticated || !resumeApply) return;
    if (canApply) setApplyOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [canApply, isAuthenticated, location.pathname, navigate, resumeApply]);

  const goToLogin = (intent?: 'apply') => navigate('/login', { state: { from: location.pathname, intent } });
  const open = () => setApplyOpen(true);

  const applyAction = (() => {
    if (job.status !== 'ACTIVE') return null;
    if (!isAuthenticated) return { label: 'Ứng tuyển ngay', onClick: () => goToLogin('apply') };
    if (isReferrer) return { label: 'Giới thiệu ứng viên', onClick: () => navigate(`/affiliate/submit-candidate?job=${job.jobId}`) };
    if (!isCandidate) return null;
    if (applied) {
      const applicationId = getApplication(job.jobId)?.applicationId;
      return { label: 'Đã ứng tuyển · Xem đơn', applied: true, onClick: () => navigate(applicationId ? `/candidate/applications/${applicationId}` : '/candidate/applications') };
    }
    if (job.isAcceptingApplications === false) return { label: 'Đã hết hạn nhận hồ sơ', disabled: true };
    if (!hasPermission('application.create')) return { label: 'Tài khoản chưa có quyền ứng tuyển', disabled: true };
    return { label: 'Ứng tuyển ngay', onClick: open };
  })();

  const applyClass = (size: string) =>
    `${size} ${FONT} inline-flex items-center justify-center whitespace-nowrap cursor-pointer rounded-xl font-bold transition-all disabled:cursor-not-allowed disabled:bg-[#9CA3AF] disabled:text-white ` +
    (applyAction?.applied
      ? 'border border-solid border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs hover:bg-emerald-100 hover:text-emerald-800'
      : 'border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/25 hover:from-sky-400 hover:to-blue-500 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.98]');

  const saved = isCandidate && isSaved(job.jobId);
  const canSave = !isAuthenticated || isCandidate;

  const deadline = job.applicationDeadline ?? job.expiresAt;
  const daysLeft = deadline ? dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
  const company = job.company;
  const companyName = job.companyName ?? company?.companyName;
  const companyLegalName = company?.companyName ?? job.companyName;
  const logoUrl = company?.logoUrl ?? job.companyLogoUrl;
  const website = company?.website ? websiteHref(company.website) : null;
  const locations = job.location
    ? job.location.split(/;\s*|\n+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const locationValue: React.ReactNode =
    locations.length > 1 ? (
      <div className="space-y-1">
        {locations.map((loc, idx) => (
          <div key={idx} className="flex items-start gap-1.5 leading-snug">
            <span className="text-[#9CA3AF] select-none shrink-0">•</span>
            <span>{loc}</span>
          </div>
        ))}
      </div>
    ) : (
      locations[0] ?? '—'
    );

  const facts: { label: string; value: React.ReactNode; accent?: boolean }[] = [
    { label: 'Mức lương', value: salaryText(job), accent: true },
    { label: 'Địa điểm', value: locationValue },
    { label: 'Kinh nghiệm', value: experienceText(job.minExperienceYears, job.maxExperienceYears) },
    { label: 'Loại hình làm việc', value: job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : '—' },
    { label: 'Hình thức làm việc', value: WORK_MODE_LABEL[detectWorkMode(job)] ?? 'Tại văn phòng (On-site)' },
    { label: 'Số lượng tuyển', value: `${job.quantity} người` },
    { label: 'Hạn nộp hồ sơ', value: deadline ? dayjs(deadline).format('DD/MM/YYYY') : '—' },
  ];
  const companyFacts = [
    { label: 'Lĩnh vực', value: company?.industry },
    { label: 'Quy mô', value: company?.companySize },
    { label: 'Website', value: company?.website, href: website },
    { label: 'Địa chỉ', value: company?.address },
  ].filter((fact) => fact.value);

  return (
    <>
      <nav aria-label="Đường dẫn" className="mb-[14px] text-[13px] text-[#6B7280]">
        <Link to="/" className={LINK}>Trang chủ</Link> › <Link to="/jobs" className={LINK}>Việc làm</Link> › {job.title}
      </nav>

      <section aria-labelledby="jobtitle" className={`${CARD} flex flex-wrap items-start gap-[18px] p-5`}>
        {job.companyId ? (
          <Link to={`/companies/${job.companyId}`} className="shrink-0 transition-transform duration-200 hover:scale-105" title={`Xem trang ${companyName}`}>
            <CompanyMark name={companyName} logoUrl={logoUrl} size={82} />
          </Link>
        ) : (
          <CompanyMark name={companyName} logoUrl={logoUrl} size={82} />
        )}
        <div className="min-w-0 flex-[1_1_420px]">
          <h1 id="jobtitle" className="m-0 text-[22px] font-bold text-[#111827]">{job.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {job.companyId ? (
              <Link to={`/companies/${job.companyId}`} className={`font-medium ${LINK}`}>{companyName}</Link>
            ) : (
              <span className="font-medium text-[#1F2937]">{companyName}</span>
            )}
            {company?.isVerified && <span className="rounded bg-[#DCFCE7] px-1.5 py-px text-[12px] text-[#166534]">Đã xác minh</span>}
          </div>
          <dl className="m-0 mt-[14px] grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[12px] text-[#6B7280]">{fact.label}</dt>
                <dd className={`m-0 mt-0.5 ${fact.accent ? 'font-bold text-[#059669]' : 'font-medium'}`}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[220px] sm:flex-none">
          {applyAction && (
            <button type="button" disabled={applyAction.disabled} onClick={applyAction.onClick} className={applyClass('h-[46px] text-[15px]')}>
              {applyAction.label}
            </button>
          )}
          {canSave && (
            <button
              type="button"
              aria-pressed={saved}
              onClick={() => (isAuthenticated ? toggleSave(job.jobId, job.title) : goToLogin())}
              className={`${FONT} flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-solid border-[#D1D5DB] bg-white text-[14px] font-medium text-[#1F2937] hover:bg-[#F9FAFB]`}
            >
              <Heart filled={saved} />{saved ? 'Đã lưu việc' : 'Lưu việc'}
            </button>
          )}
          {job.postedAt && <span className="text-center text-[12px] text-[#6B7280]">Đăng {postedText(job.postedAt).toLowerCase()}</span>}
        </div>
      </section>

      {match && <FitBanner score={match.matchScore} onChangeCv={open} />}

      <div className="mt-5 flex flex-wrap items-start gap-5">
        <article className={`${CARD} min-w-0 flex-[999_1_620px] p-6 leading-[1.65]`}>
          <BulletSection title="Mô tả công việc" items={toLines(job.description)} />
          <BulletSection title="Yêu cầu bắt buộc" items={job.requirements.filter((r) => r.requirementType === 'MUST_HAVE').map((r) => r.content)} />
          <BulletSection title="Ưu tiên" items={job.requirements.filter((r) => r.requirementType === 'SHOULD_HAVE').map((r) => r.content)} />
          {job.skills.length > 0 && (
            <>
              <h2 className={H2}>Kỹ năng</h2>
              <div className="mb-[22px] flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <span key={skill.skillId} className="rounded bg-[#F3F4F6] px-2.5 py-[3px] text-[13px]">{skill.skillName}</span>
                ))}
              </div>
            </>
          )}
          <BulletSection title="Quyền lợi" items={toLines(job.benefits)} />
          {job.workingTime && (
            <>
              <h2 className={H2}>Thời gian làm việc</h2>
              <p className="m-0 whitespace-pre-line">{job.workingTime}</p>
            </>
          )}
          {(applyAction || (daysLeft !== null && daysLeft > 0)) && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5 border-0 border-t border-solid border-[#F1F5F9] pt-[18px]">
              {applyAction && (
                <button type="button" disabled={applyAction.disabled} onClick={applyAction.onClick} className={applyClass('h-11 px-[22px] text-[14px]')}>
                  {applyAction.label}
                </button>
              )}
              {daysLeft !== null && daysLeft > 0 && <span className="text-[13px] text-[#6B7280]">Hạn nộp còn {daysLeft} ngày</span>}
            </div>
          )}
        </article>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="company" className={`${CARD} p-[18px]`}>
            <div className="flex items-center gap-3">
              {job.companyId ? (
                <Link to={`/companies/${job.companyId}`} className="shrink-0 transition-transform duration-200 hover:scale-105" title={`Xem trang ${companyLegalName}`}>
                  <CompanyMark name={companyName} logoUrl={logoUrl} size={58} />
                </Link>
              ) : (
                <CompanyMark name={companyName} logoUrl={logoUrl} size={58} />
              )}
              {job.companyId ? (
                <Link to={`/companies/${job.companyId}`} className="no-underline group min-w-0">
                  <h2 id="company" className="m-0 text-[15px] font-bold text-[#1F2937] group-hover:text-[#0369A1] group-hover:underline truncate">{companyLegalName}</h2>
                </Link>
              ) : (
                <h2 id="company" className="m-0 text-[15px] font-bold text-[#1F2937] truncate">{companyLegalName}</h2>
              )}
            </div>
            {companyFacts.length > 0 && (
              <dl className="m-0 mt-[14px] flex flex-col gap-2 text-[13px]">
                {companyFacts.map((fact) => (
                  <div key={fact.label} className="flex gap-2">
                    <dt className="flex-[0_0_82px] text-[#6B7280]">{fact.label}</dt>
                    <dd className="m-0 min-w-0 break-words">
                      {fact.href ? <a href={fact.href} target="_blank" rel="noopener noreferrer" className={LINK}>{fact.value}</a> : fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {job.companyId && (
              <Link to={`/companies/${job.companyId}`} className="mt-[14px] block rounded-md border border-solid border-[#D1D5DB] p-[9px] text-center font-medium text-[#1F2937] no-underline hover:bg-[#F9FAFB] hover:text-[#1F2937]">
                Xem trang công ty
              </Link>
            )}
          </section>
          <SimilarJobs job={job} />
        </aside>
      </div>

      {canApply && <ApplyModal job={job} open={applyOpen} onClose={() => setApplyOpen(false)} />}
    </>
  );
};

export const JobPublicDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const detail = useJobDetail(id);

  return (
    <Frame>
      {detail.isError ? (
        <div className={`${CARD} px-6 py-12 text-center`}>
          <h1 className="m-0 text-[20px] font-bold text-[#111827]">Không tìm thấy việc làm này</h1>
          <p className="m-0 mt-2 text-[#4B5563]">Tin tuyển dụng có thể đã đóng hoặc bạn không có quyền xem.</p>
          <Link to="/jobs" className={`mt-4 inline-block font-semibold ${LINK}`}>Xem các việc làm khác</Link>
        </div>
      ) : detail.isLoading || !detail.data ? (
        <div className={`${CARD} p-6`}><Skeleton active paragraph={{ rows: 12 }} /></div>
      ) : (
        <JobContent key={detail.data.jobId} job={detail.data} />
      )}
    </Frame>
  );
};
