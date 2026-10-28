/**
 * @file CandidatePages.tsx
 * @description MF-02 branch A for the Candidate: overview, my applications (stage tracker from
 * GET /candidates/applications) and the CV vault (GET/POST/PATCH/DELETE /candidates/cv).
 * Applying itself happens on the job page through <ApplyButton />.
 */
import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  Select,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Upload,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InboxOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  StarFilled,
  StarOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  GiftOutlined,
  CalendarOutlined,
  HistoryOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  LayoutOutlined,
  FormOutlined,
  ArrowRightOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
  HeartOutlined,
  HeartFilled,
  CompassOutlined,
  DollarCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { candidateApplicationsApi, candidateConsentApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api, isCandidateOfferRespondable } from '@/services/api/mf04Api';
import { CandidateInterviewDetailModal } from '@/features/candidates/CandidateInterviewDetailModal';
import { CandidateCvBuilderModal } from './candidate/CandidateCvBuilderModal';
import type { CandidateOfferSummaryDto } from '@/types/api/mf04';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateApplication, CandidateApplicationDisplayGroup } from '@/types/api/mf02';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { CANDIDATE_STEPS, MAX_CV_MB, candidateAiStatus, candidateAiTier, candidateDisplayStage, candidateInterviewType, candidateOfferStatus, candidateStage, candidateTimelineEventCopy, cvFileError, fileSize } from './mf02Labels';
import { CandidatePageHeader, CandidateSurface } from './candidate/CandidateUi';
import { CandidateJobMatchesSection } from './candidate/CandidateJobMatchesSection';
import { JobHuntingModeWidget } from './candidate/JobHuntingModeWidget';
import { ProfileStrengthMeter } from './candidate/ProfileStrengthMeter';
import { ApplicationPipelineTracker } from './candidate/ApplicationPipelineTracker';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { formatSalary } from '@/features/jobs-mf01/jobDisplay';
import { useCandidateAppliedJobs } from './candidate/useCandidateAppliedJobs';

dayjs.extend(relativeTimePlugin);
dayjs.locale('vi');

export const candidateKeys = {
  cvs: ['candidate-cvs'] as const,
  applications: ['candidate-applications'] as const,
  applicationDetail: (applicationId: string) => ['candidate-applications', applicationId] as const,
  applicationTimeline: (applicationId: string) => ['candidate-application-timeline', applicationId] as const,
  submissionConsents: (status: string) => ['candidate-submission-consents', status] as const,
};

export const useCandidateCvs = () => useQuery({ queryKey: candidateKeys.cvs, queryFn: () => candidateCvApi.list() });
const useMyApplications = () =>
  useQuery({ queryKey: [...candidateKeys.applications, 'overview'], queryFn: () => candidateApplicationsApi.list({ page: 1, pageSize: 50 }) });

/** Opens a signed CV link in a new tab (tab opened first so popup blockers allow it). */
export const useOpenSignedUrl = () => {
  const { message } = AntApp.useApp();
  return async (getUrl: () => Promise<{ downloadUrl: string }>) => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { downloadUrl } = await getUrl();
      if (tab) tab.location.href = downloadUrl;
      else window.location.href = downloadUrl;
    } catch (err) {
      tab?.close();
      message.error(getApiErrorMessage(err, 'Không mở được CV.'));
    }
  };
};

// ─── Stage tracker ──────────────────────────────────────────────────────────

const StageTracker: React.FC<{ status: string; offerStatuses?: string[] }> = ({ status, offerStatuses }) => {
  const st = candidateStage(status, offerStatuses);
  return (
    <ol className="m-0 flex list-none items-start gap-1 p-0" aria-label={`Tiến độ: ${st.label}`}>
      {CANDIDATE_STEPS.map((label, i) => {
        const reached = i <= st.step;
        const color = st.closed && i === st.step && st.tone !== 'success' ? 'bg-slate-400' : reached ? 'bg-[color:var(--console-accent)]' : 'bg-slate-200';
        return (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={`h-1.5 rounded-full ${color}`} aria-hidden />
            <span className={`hidden min-h-8 text-[11px] leading-4 sm:block ${reached ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

const CandidateDetailStatus: React.FC<{ stage: ReturnType<typeof candidateStage> }> = ({ stage }) => (
  <span className={`candidate-detail-status candidate-detail-status--${stage.tone}`} role="status">
    {stage.tone === 'success'
      ? <CheckCircleFilled aria-hidden />
      : stage.closed
        ? <CloseCircleOutlined aria-hidden />
        : <HistoryOutlined aria-hidden />}
    {stage.label}
  </span>
);

const parseJobTitleAndCode = (title: string) => {
  const match = title.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return { code: match[1], title: match[2] };
  }
  return { code: null, title };
};

const PublicApplicationProgress: React.FC<{ application: CandidateApplication }> = ({ application }) => {
  const stage = candidateDisplayStage(application.displayGroup, application.displayLabel);

  if (stage.terminalMessage && application.displayGroup !== 'HIRED') {
    const outcomeClass = application.displayGroup === 'NOT_SELECTED'
      ? 'candidate-application-outcome--not-selected'
      : 'candidate-application-outcome--withdrawn';
    return (
      <div className={`candidate-application-outcome ${outcomeClass}`} role="status" aria-label={stage.label}>
        <CloseCircleOutlined className="candidate-application-outcome__icon text-base" aria-hidden />
        <div className="min-w-0">
          <div className="candidate-application-outcome__title text-xs font-semibold">Cập nhật từ nhà tuyển dụng</div>
          <div className="candidate-application-outcome__message mt-0.5 text-[11px] leading-relaxed">{stage.terminalMessage}</div>
        </div>
      </div>
    );
  }

  const currentStep = stage.step;

  return (
    <div className="candidate-card-progress" aria-label={`Tiến độ: ${stage.label}`}>
      {CANDIDATE_STEPS.map((stepLabel, idx) => {
        const reached = idx <= currentStep;
        const current = idx === currentStep;
        return (
          <div key={stepLabel} className={`candidate-card-progress__step${reached ? ' is-reached' : ''}${current ? ' is-current' : ''}`}>
            <span className="candidate-card-progress__bar" aria-hidden />
            <span className="candidate-card-progress__label">{stepLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

const ApplicationCard: React.FC<{ a: CandidateApplication }> = ({ a }) => {
  const navigate = useNavigate();
  const stage = candidateDisplayStage(a.displayGroup, a.displayLabel);
  const statusClass = a.displayGroup.toLowerCase().replace(/_/g, '-');
  const isPositiveOutcome = a.displayGroup === 'SELECTED' || a.displayGroup === 'HIRED';
  const isClosedOutcome = a.displayGroup === 'NOT_SELECTED' || a.displayGroup === 'WITHDRAWN';
  const parsed = parseJobTitleAndCode(a.jobTitle);

  return (
    <article className={`candidate-application-card-v2 candidate-application-card-v2--${statusClass}${isClosedOutcome ? ' is-closed' : ''}`}>
      <div className="candidate-application-card-v2__header candidate-application-card__heading">
        <CompanyLogo companyName={a.companyName} size="md" className="candidate-application-card-v2__logo" />
        <div className="candidate-application-card-v2__identity">
          <div className="candidate-application-card-v2__title-row">
            {parsed.code && (
              <span className="candidate-application-card-v2__code">
                [{parsed.code}]
              </span>
            )}
            <h2>{parsed.title}</h2>
          </div>
          <p>{a.companyName}</p>
        </div>
        <div className="candidate-application-card-v2__status candidate-application-card__status-row">
          <span className={`candidate-application-status-v2 candidate-application-status-v2--${statusClass}`} role="status">
            {isPositiveOutcome ? <CheckCircleFilled aria-hidden /> : isClosedOutcome ? <CloseCircleOutlined aria-hidden /> : <HistoryOutlined aria-hidden />}
            {stage.label}
          </span>
        </div>
      </div>

      <div className="candidate-application-card-v2__progress">
        <div className="candidate-application-card-v2__progress-heading">
          <span>Tiến trình tuyển dụng</span>
        </div>
        <PublicApplicationProgress application={a} />
      </div>

      <div className="candidate-application-card-v2__footer">
        <div className="candidate-application-card-v2__meta">
          <span><HistoryOutlined aria-hidden /> Nộp {dayjs(a.appliedAt).fromNow()}</span>
        {a.cvTitle && (
          <span>
            <FilePdfOutlined aria-hidden /> {a.cvTitle}
          </span>
        )}
          <span>{a.submissionSource === 'AFFILIATE' ? 'Được đối tác tuyển dụng giới thiệu' : 'Bạn tự ứng tuyển'}</span>
        </div>
        <Button className="candidate-application-card-v2__action" onClick={() => navigate(`/candidate/applications/${a.applicationId}`)}>
          Xem chi tiết <ArrowRightOutlined aria-hidden />
        </Button>
      </div>
    </article>
  );
};

// ─── Overview ───────────────────────────────────────────────────────────────

export const CandidateHomePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const apps = useMyApplications();
  const cvs = useCandidateCvs();
  const { savedJobsCount, savedJobs, toggleSaveJob } = useSavedJobs();
  const { isApplied } = useCandidateAppliedJobs();
  const openSigned = useOpenSignedUrl();
  const pendingConsents = useQuery({
    queryKey: candidateKeys.submissionConsents('PENDING'),
    queryFn: () => candidateConsentApi.list({ status: 'PENDING', page: 1, pageSize: 5 }),
  });
  const items = apps.data?.items ?? [];
  const active = items.filter((a) => !candidateDisplayStage(a.displayGroup, a.displayLabel).closed);
  const interviewing = items.filter((a) => a.displayGroup === 'INTERVIEW').length;
  const nameParts = (user?.name || 'bạn').trim().split(/\s+/);
  const lastNamePart = nameParts[nameParts.length - 1] || 'bạn';
  const firstName = lastNamePart.toLowerCase() === 'candidate' && nameParts.length > 1
    ? nameParts[0]
    : lastNamePart;
  const cvList = cvs.data ?? [];
  const cvCount = cvList.length;
  const pendingConsentCount = pendingConsents.data?.total ?? 0;
  const nextInterview = items.find((application) => application.displayGroup === 'INTERVIEW');

  return (
    <div className="candidate-page candidate-dashboard-page space-y-6">
      {/* 1. Widget Bật/Tắt Trạng Thái Tìm Việc (JobHuntingModeWidget) */}
      <JobHuntingModeWidget cvs={cvList} />

      {/* 2. Hero Chào Mừng & Thước Đo Sức Mạnh Hồ Sơ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section className="lg:col-span-7 candidate-dashboard-hero bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
          <div className="candidate-dashboard-hero__content">
            <p className="candidate-dashboard-hero__date text-xs font-semibold uppercase tracking-wider text-slate-500 m-0 mb-1">
              Không gian cá nhân của ứng viên
            </p>
            <h1 className="m-0 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Chào {firstName},
            </h1>
            <p className="m-0 mt-2 text-sm sm:text-base leading-relaxed text-slate-600">
              {apps.isLoading
                ? 'Đang tải thông tin cá nhân của bạn...'
                : items.length === 0 && savedJobsCount === 0
                  ? 'Bảng điều khiển cá nhân dành riêng để bạn quản lý CV, lưu việc làm yêu thích và theo dõi hồ sơ ứng tuyển. Để tìm kiếm cơ hội mới, hãy duyệt tin tại Trang chủ hoặc Trang việc làm.'
                  : `Bạn đang theo dõi ${savedJobsCount} việc làm đã lưu và ${active.length} đơn ứng tuyển đang trong quy trình xử lý.`}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="primary"
              size="large"
              icon={<CompassOutlined />}
              onClick={() => navigate('/jobs')}
              className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-xl shadow-sm transition-all active:scale-[0.98] border-none font-semibold px-5"
            >
              Tìm việc làm ngay
            </Button>
            <Button
              size="large"
              icon={<HeartFilled className="text-rose-500" />}
              onClick={() => navigate('/candidate/saved-jobs')}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5"
            >
              Việc đã lưu ({savedJobsCount})
            </Button>
            <Button
              size="large"
              icon={<FolderOpenOutlined className="text-blue-500" />}
              onClick={() => navigate('/candidate/cvs')}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-5"
            >
              Kho Hồ sơ & CV
            </Button>
          </div>
        </section>

        {/* Thước Đo Sức Mạnh Hồ Sơ (Profile Strength Meter) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <ProfileStrengthMeter cvCount={cvCount} hasSkills={true} hasCertificates={false} hasProjects={false} />
        </div>
      </div>

      {/* Action Center nếu có việc cần xử lý */}
      {(pendingConsentCount > 0 || nextInterview) && (
        <CandidateSurface className="candidate-action-center overflow-hidden">
          <div className="candidate-section-heading border-b border-slate-100 px-5 py-4 !mb-0">
            <div>
              <h2 className="m-0 text-base font-bold text-slate-950">Việc cần bạn xử lý</h2>
              <p className="m-0 mt-1 text-sm text-slate-500">Hoàn thành sớm để không bỏ lỡ cơ hội.</p>
            </div>
            <span className="candidate-attention-count">{pendingConsentCount + (nextInterview ? 1 : 0)}</span>
          </div>
          <div className="candidate-action-list">
            {pendingConsentCount > 0 && (
              <button type="button" className="candidate-action-row" onClick={() => navigate('/candidate/applications?tab=consents')}>
                <span className="candidate-action-row__icon candidate-action-row__icon--warning"><BellOutlined aria-hidden /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold text-slate-900">Xác nhận hồ sơ được giới thiệu</span>
                  <span className="mt-1 block text-sm text-slate-500">Bạn có {pendingConsentCount} yêu cầu đang chờ quyết định.</span>
                </span>
                <span className="candidate-action-row__cta">Xem ngay <ArrowRightOutlined /></span>
              </button>
            )}
            {nextInterview && (
              <button type="button" className="candidate-action-row" onClick={() => navigate(`/candidate/applications/${nextInterview.applicationId}`)}>
                <span className="candidate-action-row__icon candidate-action-row__icon--info"><CalendarOutlined aria-hidden /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-slate-900">Theo dõi lịch phỏng vấn</span>
                  <span className="mt-1 block truncate text-sm text-slate-500">{nextInterview.jobTitle} · {nextInterview.companyName}</span>
                </span>
                <span className="candidate-action-row__cta">Chi tiết <ArrowRightOutlined /></span>
              </button>
            )}
          </div>
        </CandidateSurface>
      )}

      {/* 2. Khối Bộ Chỉ Số Ứng Tuyển & Việc Làm Đã Lưu (Metric Cards) */}
      <section className="candidate-dashboard-section">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight text-slate-900">Không gian quản lý cá nhân</h2>
            <p className="m-0 mt-0.5 text-xs sm:text-sm text-slate-500">Theo dõi việc làm đã lưu và tiến trình ứng tuyển của bạn</p>
          </div>
          <Button type="link" className="!px-0 font-semibold text-blue-600" onClick={() => navigate('/candidate/applications')}>
            Xem tất cả đơn
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Việc làm đã lưu',
              desc: 'Vị trí bạn yêu thích',
              value: savedJobsCount,
              to: '/candidate/saved-jobs',
              icon: <HeartFilled className="text-rose-500" />,
              bg: 'bg-rose-50/60 hover:bg-rose-50 border-rose-100',
              badgeColor: 'text-rose-700',
            },
            {
              label: 'Đã nộp',
              desc: 'Hồ sơ đã gửi thành công',
              value: items.length,
              to: '/candidate/applications?status=SUBMITTED',
              icon: <FileTextOutlined className="text-blue-600" />,
              bg: 'bg-blue-50/60 hover:bg-blue-50 border-blue-100',
              badgeColor: 'text-blue-700',
            },
            {
              label: 'Đang xét duyệt',
              desc: 'Đang trong quy trình xử lý',
              value: active.length,
              to: '/candidate/applications?status=PROCESSING',
              icon: <ClockCircleOutlined className="text-amber-600" />,
              bg: 'bg-amber-50/60 hover:bg-amber-50 border-amber-100',
              badgeColor: 'text-amber-700',
            },
            {
              label: 'Lịch phỏng vấn',
              desc: 'Đang chờ hoặc phỏng vấn',
              value: interviewing,
              to: '/candidate/applications?status=INTERVIEW',
              icon: <CalendarOutlined className="text-purple-600" />,
              bg: 'bg-purple-50/60 hover:bg-purple-50 border-purple-100',
              badgeColor: 'text-purple-700',
            },
          ].map((card) => (
            <div
              key={card.label}
              onClick={() => navigate(card.to)}
              className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm ${card.bg}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-2xs text-base">
                  {card.icon}
                </span>
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                  Chi tiết →
                </span>
              </div>
              <div>
                <strong className={`block text-2xl sm:text-3xl font-extrabold tracking-tight ${card.badgeColor}`}>
                  {apps.isLoading ? '—' : card.value}
                </strong>
                <span className="block font-bold text-slate-900 text-xs sm:text-sm mt-0.5">{card.label}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-1">{card.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Khối Việc Làm Yêu Thích Đã Lưu (Saved Favorite Jobs) */}
      <section className="candidate-dashboard-section">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 text-sm">
                  <HeartFilled />
                </span>
                <h2 className="m-0 text-lg font-bold text-slate-900">Việc làm yêu thích đã lưu</h2>
                {savedJobsCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/60">
                    {savedJobsCount} việc
                  </span>
                )}
              </div>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Các vị trí tuyển dụng bạn đã đánh dấu từ Sàn việc làm để tiện theo dõi và ứng tuyển
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => navigate('/candidate/saved-jobs')}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs h-9 px-3.5"
              >
                Xem tất cả đã lưu {savedJobsCount > 0 && `(${savedJobsCount})`}
              </Button>
              <Button
                type="primary"
                icon={<CompassOutlined />}
                onClick={() => navigate('/jobs')}
                className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-xl shadow-xs border-none font-semibold text-xs h-9 px-3.5"
              >
                Khám phá việc làm mới
              </Button>
            </div>
          </div>

          {savedJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/40">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center mx-auto mb-3">
                <HeartOutlined className="text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-800 m-0">Bạn chưa lưu công việc yêu thích nào</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5 mb-5 leading-relaxed">
                Khi tìm kiếm cơ hội nghề nghiệp tại Trang chủ hoặc Trang việc làm công khai, hãy bấm biểu tượng trái tim để lưu lại vào không gian cá nhân này.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="primary"
                  icon={<CompassOutlined />}
                  onClick={() => navigate('/jobs')}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 px-4"
                >
                  Tìm việc làm ngay
                </Button>
                <Button
                  onClick={() => navigate('/jobs')}
                  className="rounded-xl border border-slate-200 font-semibold text-slate-700 text-xs h-9 px-4 hover:border-blue-400"
                >
                  Duyệt tin tại Sàn việc làm
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {savedJobs.slice(0, 3).map((job) => {
                const applied = isApplied(job.id);
                return (
                  <div
                    key={job.id}
                    className="group rounded-xl p-4 border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2.5 mb-2.5">
                        <CompanyLogo
                          companyName={job.company || 'Doanh nghiệp'}
                          logoUrl={job.companyLogo}
                          size="sm"
                          className="w-10 h-10 rounded-lg shrink-0 border border-slate-100"
                        />
                        <div className="flex items-center gap-1">
                          {applied && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                              <CheckCircleFilled className="text-[10px]" /> Đã ứng tuyển
                            </span>
                          )}
                          <Tooltip title="Bỏ lưu khỏi danh sách">
                            <button
                              type="button"
                              onClick={async () => {
                                await toggleSaveJob(job.id);
                                message.success(`Đã bỏ lưu "${job.title}".`);
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors border-0 bg-transparent cursor-pointer"
                              aria-label="Bỏ lưu"
                            >
                              <HeartFilled className="text-base" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      <h4
                        className="text-sm font-bold text-slate-900 line-clamp-1 m-0 hover:text-blue-600 cursor-pointer"
                        title={job.title}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        {job.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5 mb-2">
                        {job.company}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60 text-[11.5px]">
                          {formatSalary(job.job || job)}
                        </span>
                        {job.location && (
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] truncate max-w-[140px]">
                            <EnvironmentOutlined className="text-slate-400" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        {job.deadline ? `Hạn: ${job.deadline}` : 'Đang tuyển'}
                      </span>
                      <Button
                        type="link"
                        size="small"
                        className="!p-0 !h-auto font-semibold text-blue-600 hover:text-blue-700"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        {applied ? 'Xem chi tiết →' : 'Ứng tuyển ngay →'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Khối Kho Hồ Sơ & CV (CV Management Card) */}
      <section className="candidate-dashboard-section">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-sm">
                  <FolderOpenOutlined />
                </span>
                <h2 className="m-0 text-lg font-bold text-slate-900">Kho Hồ Sơ & CV</h2>
              </div>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Quản lý các bản CV dùng để ứng tuyển và bật chế độ tìm việc
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => navigate('/candidate/cvs')}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs h-9 px-3.5"
              >
                Quản lý tất cả CV {cvList.length > 0 && `(${cvList.length})`}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/candidate/cvs?action=new')}
                className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-xl shadow-xs border-none font-semibold text-xs h-9 px-3.5"
              >
                Tải lên / Tạo CV mới
              </Button>
            </div>
          </div>

          {cvs.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200/70 p-4 animate-pulse bg-slate-50/50">
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3 mb-3" />
                  <div className="h-8 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : cvList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/40">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-3">
                <FilePdfOutlined className="text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-800 m-0">Bạn chưa có CV nào trong kho hồ sơ</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5 mb-5 leading-relaxed">
                Tải lên bản CV dạng PDF có sẵn hoặc tự tạo CV chuẩn chuyên nghiệp bằng công cụ trực tuyến của HR Connect để sẵn sàng ứng tuyển mọi lúc.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => navigate('/candidate/cvs?action=new')}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 px-4"
                >
                  Tải CV lên (PDF)
                </Button>
                <Button
                  onClick={() => navigate('/candidate/cvs?action=builder')}
                  className="rounded-xl border border-slate-200 font-semibold text-slate-700 text-xs h-9 px-4 hover:border-blue-400"
                >
                  Tạo CV Online mới
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {cvList.slice(0, 3).map((cv) => (
                <div
                  key={cv.cvId}
                  className={`rounded-xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                    cv.isPrimary
                      ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                      : 'border-slate-200/80 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200/60 font-black text-xs">
                          PDF
                        </span>
                        <div className="min-w-0">
                          <h4
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate m-0 hover:text-blue-600 cursor-pointer"
                            title={cv.title || cv.fileName || 'CV'}
                            onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))}
                          >
                            {cv.title || cv.fileName || 'Bản CV'}
                          </h4>
                          <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                            {fileSize(cv.fileSizeBytes)} · Cập nhật {dayjs(cv.updatedAt || cv.createdAt).format('DD/MM/YYYY')}
                          </span>
                        </div>
                      </div>
                      {cv.isPrimary && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                          ✓ Mặc định
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Tooltip title="Xem trước CV">
                        <button
                          type="button"
                          onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200/80 bg-white cursor-pointer"
                        >
                          <EyeOutlined className="text-xs" />
                          <span>Xem</span>
                        </button>
                      </Tooltip>
                      <Tooltip title="Tải xuống PDF">
                        <button
                          type="button"
                          onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200/80 bg-white cursor-pointer"
                        >
                          <DownloadOutlined className="text-xs" />
                          <span>Tải</span>
                        </button>
                      </Tooltip>
                    </div>

                    {!cv.isPrimary && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await candidateCvApi.setPrimary(cv.cvId);
                            message.success(`Đã đặt "${cv.title || cv.fileName}" làm CV chính.`);
                            queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
                          } catch (err) {
                            message.error(getApiErrorMessage(err));
                          }
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline bg-transparent border-0 cursor-pointer p-0"
                      >
                        Đặt làm CV chính
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Khối Tiến Độ Ứng Tuyển Gần Đây (Application Pipeline Tracker) */}
      <section className="candidate-dashboard-section">
        <div className="candidate-section-heading flex items-center justify-between mb-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight text-slate-900">Tiến trình đơn ứng tuyển</h2>
            <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">Theo dõi trạng thái xử lý từng bước từ nhà tuyển dụng</p>
          </div>
          {items.length > 0 && (
            <Button type="link" className="!px-0 font-semibold text-blue-600" onClick={() => navigate('/candidate/applications')}>
              Xem tất cả đơn ({items.length})
            </Button>
          )}
        </div>
        <ApplicationPipelineTracker applications={items} isLoading={apps.isLoading} limit={4} />
      </section>
    </div>
  );
};

// ─── Applications ───────────────────────────────────────────────────────────

export const CandidateApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = searchParams.get('status') || undefined;
  const jobId = searchParams.get('jobId') || undefined;
  const fromDate = searchParams.get('fromDate') || undefined;
  const toDate = searchParams.get('toDate') || undefined;
  const search = searchParams.get('search') || undefined;
  const submissionSource = (searchParams.get('submissionSource') || undefined) as 'CANDIDATE' | 'AFFILIATE' | undefined;
  const [searchDraft, setSearchDraft] = useState(search ?? '');
  const filters = { status, jobId, fromDate, toDate, search, submissionSource, page, pageSize: 10 };
  const apps = useQuery({
    queryKey: [...candidateKeys.applications, filters],
    queryFn: () => candidateApplicationsApi.list(filters),
    placeholderData: (previous) => previous,
  });
  const items = apps.data?.items ?? [];
  const pendingConsents = useQuery({
    queryKey: candidateKeys.submissionConsents('PENDING'),
    queryFn: () => candidateConsentApi.list({ status: 'PENDING', page: 1, pageSize: 5 }),
  });

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="candidate-page candidate-applications-page">
      <CandidatePageHeader
        eyebrow="Ứng tuyển"
        title="Đơn ứng tuyển của tôi"
        description="Theo dõi từng đơn từ lúc nộp đến khi nhận việc. Trạng thái được cập nhật ngay khi nhà tuyển dụng xử lý."
        actions={
          <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => navigate('/jobs')}>
            Tìm việc làm
          </Button>
        }
      />
      {pendingConsents.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa tải được yêu cầu xác nhận hồ sơ"
          description={getApiErrorMessage(pendingConsents.error)}
          action={<Button onClick={() => pendingConsents.refetch()}>Thử lại</Button>}
        />
      ) : pendingConsents.isLoading ? (
        <CandidateSurface className="p-5"><Skeleton active paragraph={{ rows: 2 }} /></CandidateSurface>
      ) : (pendingConsents.data?.items.length ?? 0) > 0 ? (
        <CandidateSurface className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="m-0 text-base font-bold text-slate-900">Đang chờ bạn xác nhận</h2>
              <p className="m-0 mt-1 text-sm text-slate-500">Đối tác tuyển dụng chỉ có thể gửi hồ sơ đến doanh nghiệp sau khi bạn đồng ý.</p>
            </div>
            <StatusDot tone="warning">{pendingConsents.data?.total ?? 0} yêu cầu</StatusDot>
          </div>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {pendingConsents.data?.items.map((consent) => (
              <li key={consent.submissionId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{consent.jobTitle}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {consent.companyName} · do {consent.affiliateDisplayName} giới thiệu · hết hạn {dayjs(consent.expiresAt).format('HH:mm DD/MM/YYYY')}
                  </div>
                </div>
                <Button type="primary" onClick={() => navigate(`/candidate/submission-consents/${consent.submissionId}`)}>
                  Xem và xác nhận
                </Button>
              </li>
            ))}
          </ul>
        </CandidateSurface>
      ) : null}
      <section className="candidate-applications-filters" aria-label="Lọc đơn ứng tuyển">
        <div className="candidate-applications-filters__heading">
          <div>
            <h2>Tìm đơn ứng tuyển</h2>
            <p>Lọc theo công việc, trạng thái hoặc thời gian bạn đã nộp hồ sơ.</p>
          </div>
          {(status || fromDate || toDate || jobId || search || submissionSource) && (
            <Button type="link" onClick={() => { setSearchDraft(''); setSearchParams({}); }}>Xóa tất cả bộ lọc</Button>
          )}
        </div>
        <div className="candidate-applications-filters__grid">
          <label className="candidate-filter-field candidate-filter-field--search">
            <span>Công việc hoặc doanh nghiệp</span>
            <Input.Search
              aria-label="Tìm theo công việc hoặc doanh nghiệp"
              allowClear
              value={searchDraft}
              placeholder="Ví dụ: Backend Developer"
              onChange={(event) => {
                setSearchDraft(event.target.value);
                if (!event.target.value) updateFilters({ search: undefined });
              }}
              onSearch={(value) => updateFilters({ search: value.trim() || undefined })}
            />
          </label>
          <label className="candidate-filter-field">
            <span>Trạng thái hiện tại</span>
            <Select
              aria-label="Lọc theo trạng thái"
              allowClear
              placeholder="Tất cả trạng thái"
              value={status}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                ['SUBMITTED', 'Đã nộp'],
                ['IN_REVIEW', 'Đang xem xét'],
                ['SELECTED', 'Được chọn phỏng vấn'],
                ['INTERVIEW', 'Phỏng vấn'],
                ['OFFER', 'Chờ hoặc đã nhận offer'],
                ['HIRED', 'Đã tuyển'],
                ['NOT_SELECTED', 'Chưa phù hợp'],
                ['WITHDRAWN', 'Đã rút đơn'],
              ].map(([value, label]) => ({ value: value as CandidateApplicationDisplayGroup, label }))}
            />
          </label>
          <label className="candidate-filter-field">
            <span>Nguồn ứng tuyển</span>
            <Select
              aria-label="Lọc theo nguồn ứng tuyển"
              allowClear
              placeholder="Tất cả nguồn"
              value={submissionSource}
              onChange={(value) => updateFilters({ submissionSource: value })}
              options={[
                { value: 'CANDIDATE', label: 'Tôi tự ứng tuyển' },
                { value: 'AFFILIATE', label: 'Đối tác tuyển dụng giới thiệu' },
              ]}
            />
          </label>
          <label className="candidate-filter-field">
            <span>Ngày ứng tuyển</span>
            <DatePicker.RangePicker
              aria-label="Lọc theo ngày ứng tuyển"
              format="DD/MM/YYYY"
              value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
              onChange={(dates) =>
                updateFilters({
                  fromDate: dates?.[0]?.startOf('day').toISOString(),
                  toDate: dates?.[1]?.endOf('day').toISOString(),
                })
              }
            />
          </label>
        </div>
      </section>
      {apps.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : apps.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được đơn ứng tuyển"
          description={getApiErrorMessage(apps.error)}
          action={<Button onClick={() => apps.refetch()}>Thử lại</Button>}
        />
      ) : items.length === 0 ? (
        <CandidateSurface className="candidate-empty-surface p-10 text-center">
          <p className="m-0 text-sm text-slate-600">{status || fromDate || toDate || jobId || search || submissionSource ? 'Không có đơn nào phù hợp bộ lọc.' : 'Bạn chưa ứng tuyển công việc nào.'}</p>
          {!status && !fromDate && !toDate && !jobId && !search && !submissionSource && (
            <Button type="primary" className="mt-3" icon={<SearchOutlined />} onClick={() => navigate('/jobs')}>
              Tìm việc làm
            </Button>
          )}
        </CandidateSurface>
      ) : (
        <div className="candidate-applications-list">
          {items.map((a) => (
            <ApplicationCard key={a.applicationId} a={a} />
          ))}
        </div>
      )}
      {(apps.data?.totalPages ?? 0) > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={10}
            total={apps.data?.total ?? 0}
            showSizeChanger={false}
            onChange={(nextPage) => updateFilters({ page: String(nextPage) })}
          />
        </div>
      )}
    </div>
  );
};

export const CandidateApplicationDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { applicationId = '' } = useParams();

  // Primary Detail Query (MF-04 with fallback to MF-02 for backwards compatibility)
  const detail = useQuery({
    queryKey: candidateKeys.applicationDetail(applicationId),
    queryFn: async () => {
      try {
        return await mf04Api.getApplicationDetail(applicationId);
      } catch (err: any) {
        // Fallback to legacy MF-02 endpoint if recruitment detail is unavailable
        return await candidateApplicationsApi.detail(applicationId);
      }
    },
    enabled: Boolean(applicationId),
  });

  // Public Sanitized Timeline Query
  const timelineQuery = useQuery({
    queryKey: candidateKeys.applicationTimeline(applicationId),
    queryFn: () => mf04Api.getApplicationTimeline(applicationId),
    enabled: Boolean(applicationId),
  });

  // State for CV download
  const [isDownloadingCv, setIsDownloadingCv] = useState(false);
  const handleDownloadCv = async () => {
    try {
      setIsDownloadingCv(true);
      const res = await mf04Api.getApplicationCvDownloadUrl(applicationId);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      } else {
        message.error('Không thể tạo liên kết tải CV.');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể tải CV đã nộp.');
    } finally {
      setIsDownloadingCv(false);
    }
  };

  // State for Withdraw Application Modal
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const appData = detail.data as any;
      return await mf04Api.withdrawApplication(applicationId, {
        reason: withdrawReason.trim() || undefined,
        concurrencyToken: appData?.concurrencyToken,
      });
    },
    onSuccess: (res) => {
      message.success(res?.message || 'Đã rút đơn ứng tuyển thành công.');
      setIsWithdrawModalOpen(false);
      setWithdrawReason('');
      queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        message.warning('Dữ liệu đơn ứng tuyển đã được cập nhật từ hệ thống. Đang tải lại dữ liệu...');
        setIsWithdrawModalOpen(false);
        queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
        queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
        return;
      }
      message.error(err?.response?.data?.message || 'Không thể rút đơn ứng tuyển.');
    },
  });

  // State for Offer Response Modal
  const [selectedOffer, setSelectedOffer] = useState<CandidateOfferSummaryDto | null>(null);
  const [offerResponseChoice, setOfferResponseChoice] = useState<'ACCEPTED' | 'DECLINED'>('ACCEPTED');
  const [declineReason, setDeclineReason] = useState('');
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const respondOfferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOffer) return;
      return await mf04Api.respondOffer(selectedOffer.offerId, {
        response: offerResponseChoice,
        declineReason: offerResponseChoice === 'DECLINED' ? declineReason.trim() || undefined : undefined,
        concurrencyToken: selectedOffer.concurrencyToken,
      });
    },
    onSuccess: (res) => {
      message.success(res?.message || 'Đã phản hồi lời mời nhận việc thành công.');
      setSelectedOffer(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        message.warning('Trạng thái lời mời nhận việc đã thay đổi trên hệ thống. Đang tải lại...');
        setSelectedOffer(null);
        queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
        queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
        return;
      }
      message.error(err?.response?.data?.message || 'Không thể gửi phản hồi lời mời nhận việc.');
    },
  });

  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (detail.isError || !detail.data) {
    return (
      <CandidateSurface className="p-6">
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết đơn ứng tuyển"
          description={getApiErrorMessage(detail.error)}
          action={
            <Space>
              <Button onClick={() => detail.refetch()}>Thử lại</Button>
              <Button onClick={() => navigate('/candidate/applications')}>Về danh sách</Button>
            </Space>
          }
        />
      </CandidateSurface>
    );
  }

  const application: any = detail.data;
  const allowedActions: string[] = application.allowedActions || [];
  const canWithdraw = allowedActions.includes('WITHDRAW_APPLICATION');

  const interviews: any[] = application.interviews || [];
  const offers: any[] = application.offers || [];
  const offerStatuses = offers.map((offer) => String(offer.status || ''));
  const stage = candidateStage(application.status, offerStatuses);
  const placement: any = application.placement || null;
  const timelineEvents: any[] = timelineQuery.data?.events || [];

  return (
    <div className="candidate-page candidate-application-detail-page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          className="candidate-detail-back"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/candidate/applications')}
        >
          Đơn ứng tuyển
        </Button>

        {/* Server-Driven Action Buttons */}
        <Space>
          {canWithdraw && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setIsWithdrawModalOpen(true)}
            >
              Rút đơn ứng tuyển
            </Button>
          )}
        </Space>
      </div>

      <CandidatePageHeader
        eyebrow="Chi tiết ứng tuyển"
        title={application.jobTitle}
        description={application.companyName}
        actions={<CandidateDetailStatus stage={stage} />}
      />

      {/* Main Info Surface */}
      <CandidateSurface className="candidate-application-overview space-y-5 p-6">
        <StageTracker status={application.status} offerStatuses={offerStatuses} />
        <dl className="candidate-application-facts grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">CV đã nộp</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900 flex items-center gap-2">
              <span>{application.submittedCv?.title || application.submittedCv?.fileName || application.cvTitle || application.cvFileName || 'Không có tên CV'}</span>
              <Button
                size="small"
                type="link"
                icon={<DownloadOutlined />}
                loading={isDownloadingCv}
                onClick={handleDownloadCv}
                className="p-0 font-normal"
              >
                Tải CV đã nộp
              </Button>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Nguồn hồ sơ</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">
              {application.submissionSource === 'AFFILIATE' ? 'Đối tác tuyển dụng giới thiệu' : 'Bạn tự ứng tuyển'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ngày ứng tuyển</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(application.appliedAt).format('HH:mm DD/MM/YYYY')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Cập nhật gần nhất</dt>
            <dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(application.updatedAt).format('HH:mm DD/MM/YYYY')}</dd>
          </div>
          {application.plannedStartDate && (
            <div>
              <dt className="text-slate-500">Ngày nhận việc dự kiến</dt>
              <dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(application.plannedStartDate).format('DD/MM/YYYY')}</dd>
            </div>
          )}
        </dl>
        {application.statusReason && <Alert type="info" showIcon message="Thông tin trạng thái" description={application.statusReason} />}
      </CandidateSurface>

      {/* Interviews Section */}
      <CandidateSurface className="candidate-detail-section candidate-detail-section--interviews p-6">
        <div className="flex items-center gap-2 mb-4">
          <VideoCameraOutlined className="text-blue-600 text-lg" />
          <h2 className="m-0 text-base font-bold text-slate-900">
            Lịch phỏng vấn {interviews.length > 0 ? `(${interviews.length})` : ''}
          </h2>
        </div>
        {interviews.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có lịch phỏng vấn nào được lên lịch cho đơn ứng tuyển này."
          />
        ) : (
          <div className="space-y-4">
            {interviews.map((iv: any) => {
              const normalizedStatus = String(iv.status || '').toUpperCase();
              const statusCopy = normalizedStatus === 'COMPLETED'
                ? { label: 'Đã hoàn thành', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
                : normalizedStatus === 'CANCELLED'
                  ? { label: 'Đã hủy', className: 'border-rose-200 bg-rose-50 text-rose-700' }
                  : normalizedStatus === 'NO_SHOW'
                    ? { label: 'Đã ghi nhận vắng mặt', className: 'border-slate-200 bg-slate-100 text-slate-600' }
                    : { label: normalizedStatus === 'RESCHEDULED' ? 'Đã dời lịch' : 'Đã lên lịch', className: 'border-blue-200 bg-blue-50 text-blue-700' };

              return (
                <Card
                  key={iv.interviewId}
                  size="small"
                  className="candidate-interview-card rounded-xl border border-slate-200 bg-white shadow-none"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          Vòng {iv.interviewRound}: {candidateInterviewType(iv.interviewType)}
                        </span>
                        <span
                          role="status"
                          className={`inline-flex items-center gap-1.5 rounded-full border border-solid px-2.5 py-1 text-xs font-semibold shadow-none ${statusCopy.className}`}
                        >
                          {statusCopy.label}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-4">
                        {iv.scheduledAt && (
                          <span>
                            <CalendarOutlined className="mr-1" />
                            {dayjs(iv.scheduledAt).format('HH:mm - DD/MM/YYYY')}
                          </span>
                        )}
                        {iv.durationMinutes && <span>Thời lượng: {iv.durationMinutes} phút</span>}
                        {iv.location && (
                          <span>
                            <EnvironmentOutlined className="mr-1" />
                            {iv.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Space wrap>
                      <Button
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={() => setSelectedInterviewId(iv.interviewId)}
                      >
                        Chi tiết
                      </Button>
                    {iv.meetingLink && (
                      <>
                        <Tooltip title="Sao chép link phòng họp">
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(iv.meetingLink);
                                message.success('Đã sao chép link phòng họp!');
                              } else {
                                message.info(iv.meetingLink);
                              }
                            }}
                          />
                        </Tooltip>
                        <Button
                          type="primary"
                          size="small"
                          href={iv.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          icon={<VideoCameraOutlined />}
                        >
                          Vào phòng họp
                        </Button>
                      </>
                    )}
                    </Space>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CandidateSurface>

      {/* Offers Section */}
      <CandidateSurface className="candidate-detail-section candidate-detail-section--offers p-6">
        <div className="flex items-center gap-2 mb-4">
          <GiftOutlined className="text-emerald-600 text-lg" />
          <h2 className="m-0 text-base font-bold text-slate-900">
            Thư mời nhận việc {offers.length > 0 ? `(${offers.length})` : ''}
          </h2>
        </div>
        {offers.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có thư mời nhận việc nào cho đơn ứng tuyển này."
          />
        ) : (
          <div className="space-y-4">
            {offers.map((offer: any) => {
              const canRespond = isCandidateOfferRespondable(offer);
              return (
                <Card
                  key={offer.offerId}
                  size="small"
                  className="candidate-offer-card border border-emerald-200 rounded-xl bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Phiên bản #{offer.offerVersion}</span>
                        <Tag color={offer.status === 'ACCEPTED' ? 'green' : offer.status === 'DECLINED' ? 'red' : 'blue'}>
                          {candidateOfferStatus(offer.status)}
                        </Tag>
                      </div>
                      <div className="mt-2 text-sm text-slate-800">
                        Mức lương:{' '}
                        <strong className="text-emerald-700">
                          {offer.salary != null ? `${offer.salary.toLocaleString('vi-VN')} ${offer.currencyCode || 'VND'}` : 'Thương lượng'}
                        </strong>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-4">
                        {offer.startDate && <span>Bắt đầu: {dayjs(offer.startDate).format('DD/MM/YYYY')}</span>}
                        {(offer.expiryDate || offer.validUntil || offer.expiresAt) && (
                          <span>
                            Hạn phản hồi: {dayjs(offer.expiryDate || offer.validUntil || offer.expiresAt).format('DD/MM/YYYY')}
                          </span>
                        )}
                      </div>
                      {offer.declineReason && (
                        <div className="mt-2 text-xs text-rose-600">
                          Lý do từ chối: {offer.declineReason}
                        </div>
                      )}
                    </div>

                    <Space>
                      {offer.offerDocumentUrl && (
                        <Button
                          size="small"
                          href={offer.offerDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          icon={<DownloadOutlined />}
                        >
                          Xem thư mời
                        </Button>
                      )}
                      {canRespond && (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] border-none"
                            onClick={() => {
                              setSelectedOffer(offer);
                              setOfferResponseChoice('ACCEPTED');
                              setDeclineReason('');
                            }}
                          >
                            Chấp nhận
                          </Button>
                          <Button
                            danger
                            size="small"
                            onClick={() => {
                              setSelectedOffer(offer);
                              setOfferResponseChoice('DECLINED');
                              setDeclineReason('');
                            }}
                          >
                            Từ chối
                          </Button>
                        </Space>
                      )}
                    </Space>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CandidateSurface>

      {/* Placement Section */}
      {placement && (
        <CandidateSurface className="p-6">
          <h2 className="m-0 text-base font-bold text-slate-900">Thông tin nhận việc</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="text-slate-500">Vị trí</span>
              <strong className="mt-1 block text-slate-900">{placement.position || application.jobTitle}</strong>
            </div>
            <div>
              <span className="text-slate-500">Phòng ban</span>
              <strong className="mt-1 block text-slate-900">{placement.department || 'Đang cập nhật'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Ngày bắt đầu thực tế</span>
              <strong className="mt-1 block text-slate-900">{dayjs(placement.actualStartDate).format('DD/MM/YYYY')}</strong>
            </div>
          </div>
        </CandidateSurface>
      )}

      {/* Public Sanitized Timeline */}
      {timelineQuery.isLoading ? (
        <CandidateSurface className="p-6">
          <Skeleton active paragraph={{ rows: 2 }} />
        </CandidateSurface>
      ) : timelineQuery.isError ? (
        <CandidateSurface className="p-6">
          <Alert
            type="warning"
            showIcon
            message="Không tải được dòng thời gian"
            description={getApiErrorMessage(timelineQuery.error)}
            action={<Button size="small" onClick={() => timelineQuery.refetch()}>Thử lại</Button>}
          />
        </CandidateSurface>
      ) : timelineEvents.length > 0 ? (
        <CandidateSurface className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <HistoryOutlined className="text-slate-600 text-lg" />
            <h2 className="m-0 text-base font-bold text-slate-900">Dòng thời gian tuyển dụng</h2>
          </div>
          <Timeline
            className="mt-4"
            items={timelineEvents.map((evt: any) => {
              const copy = candidateTimelineEventCopy(evt);
              return {
                color: evt.status === 'HIRED' || evt.status === 'SELECTED' ? 'green' : evt.status === 'NOT_SELECTED' ? 'gray' : 'blue',
                children: (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{copy.title}</span>
                    <span className="text-xs text-slate-400">
                      {dayjs(evt.timestamp).format('HH:mm DD/MM/YYYY')}
                    </span>
                  </div>
                  {copy.description && <div className="text-xs text-slate-600 mt-1">{copy.description}</div>}
                </div>
              ),
              };
            })}
          />
        </CandidateSurface>
      ) : null}

      {/* AI Result Section (if available from legacy or model) */}
      {(application.aiStatus || application.aiMatchScore != null) && (
        <CandidateSurface className="p-6">
          <h2 className="m-0 text-base font-bold text-slate-900">Đánh giá mức độ phù hợp</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-slate-500">Trạng thái</span><strong className="mt-1 block text-slate-900">{candidateAiStatus(application.aiStatus)}</strong></div>
            <div><span className="text-slate-500">Điểm phù hợp</span><strong className="mt-1 block text-slate-900">{application.aiMatchScore == null ? '—' : `${application.aiMatchScore}%`}</strong></div>
            <div><span className="text-slate-500">Mức phù hợp</span><strong className="mt-1 block text-slate-900">{candidateAiTier(application.aiMatchTier)}</strong></div>
          </div>
        </CandidateSurface>
      )}

      {/* Modal 1: Withdraw Application */}
      <Modal
        title="Rút đơn ứng tuyển"
        open={isWithdrawModalOpen}
        onCancel={() => setIsWithdrawModalOpen(false)}
        onOk={() => withdrawMutation.mutate()}
        okText="Xác nhận rút đơn"
        cancelText="Đóng"
        okButtonProps={{ danger: true, loading: withdrawMutation.isPending }}
      >
        <p className="text-sm text-slate-600">
          Bạn có chắc chắn muốn rút đơn ứng tuyển cho vị trí <strong>{application.jobTitle}</strong>? Sau khi rút đơn, nhà tuyển dụng sẽ không thể xử lý tiếp hồ sơ của bạn.
        </p>
        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Lý do rút đơn (tùy chọn):
          </label>
          <Input.TextArea
            rows={3}
            placeholder="VD: Đã nhận được lời mời làm việc từ đơn vị khác..."
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Modal 2: Respond Offer */}
      <Modal
        title={`Phản hồi Thư nhận việc #${selectedOffer?.offerVersion || ''}`}
        open={Boolean(selectedOffer)}
        onCancel={() => setSelectedOffer(null)}
        onOk={() => respondOfferMutation.mutate()}
        okText={offerResponseChoice === 'ACCEPTED' ? 'Xác nhận chấp nhận' : 'Xác nhận từ chối'}
        cancelText="Hủy"
        okButtonProps={{
          loading: respondOfferMutation.isPending,
          danger: offerResponseChoice === 'DECLINED',
          disabled: offerResponseChoice === 'DECLINED' && !declineReason.trim(),
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Vui lòng chọn quyết định của bạn đối với lời mời nhận việc này:
          </p>
          <Radio.Group
            value={offerResponseChoice}
            onChange={(e) => setOfferResponseChoice(e.target.value)}
            className="space-y-2 block"
          >
            <Radio value="ACCEPTED" className="block">
              <span className="font-semibold text-emerald-700">Đồng ý nhận việc (Accepted)</span>
              <p className="text-xs text-slate-500 m-0 ml-6">Tôi đồng ý với các điều khoản đãi ngộ và thời gian bắt đầu công việc.</p>
            </Radio>
            <Radio value="DECLINED" className="block">
              <span className="font-semibold text-rose-700">Từ chối nhận việc (Declined)</span>
              <p className="text-xs text-slate-500 m-0 ml-6">Tôi xin phép từ chối cơ hội làm việc này.</p>
            </Radio>
          </Radio.Group>

          {offerResponseChoice === 'DECLINED' && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Lý do từ chối <span className="text-rose-500">*</span> (bắt buộc):
              </label>
              <Input.TextArea
                rows={3}
                placeholder="VD: Mức đãi ngộ chưa đạt kỳ vọng / Khoảng cách địa lý..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 3: Interview Detail */}
      <CandidateInterviewDetailModal
        open={Boolean(selectedInterviewId)}
        interviewId={selectedInterviewId || undefined}
        onClose={() => setSelectedInterviewId(null)}
      />
    </div>
  );
};

// ─── CV vault ───────────────────────────────────────────────────────────────

export const CvUploader: React.FC<{ onUploaded?: () => void; compact?: boolean }> = ({ onUploaded, compact }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => candidateCvApi.upload(file, file.name.replace(/\.pdf$/i, '')),
    onSuccess: (res) => {
      message.success(res.message || 'Đã tải CV lên.');
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      onUploaded?.();
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không tải được CV lên.')),
  });

  return (
    <Upload.Dragger
      accept="application/pdf,.pdf"
      multiple={false}
      showUploadList={false}
      disabled={upload.isPending}
      beforeUpload={(file) => {
        const error = cvFileError(file);
        if (error) message.error(error);
        else upload.mutate(file);
        return false; // we upload ourselves through the API client
      }}
      className={compact ? '!rounded-2xl' : '!rounded-2xl !bg-white'}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined className="!text-[color:var(--console-accent)]" />
      </p>
      <p className="ant-upload-text">{upload.isPending ? 'Đang tải lên...' : 'Kéo thả CV vào đây hoặc bấm để chọn file'}</p>
      <p className="ant-upload-hint">Chỉ nhận PDF, tối đa {MAX_CV_MB}MB.</p>
    </Upload.Dragger>
  );
};

export const CandidateCvsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const cvs = useCandidateCvs();
  const openSigned = useOpenSignedUrl();
  const [busyId, setBusyId] = useState<string>();
  const [editing, setEditing] = useState<{ cvId: string; title: string }>();

  // Structured CV builder modal states
  const [createBuilderOpen, setCreateBuilderOpen] = useState(
    searchParams.get('action') === 'builder' || searchParams.get('action') === 'new'
  );
  const [editStructuredCvId, setEditStructuredCvId] = useState<string>();

  const canView = hasPermission('cv.view_own');
  const canCreate = hasPermission('cv.create');
  const canUpdate = hasPermission('cv.update_own');
  const canDelete = hasPermission('cv.delete_own');

  const act = async (cvId: string, run: () => Promise<{ message?: string }>, ok: string) => {
    setBusyId(cvId);
    try {
      const res = await run();
      message.success(res.message || ok);
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const list = cvs.data ?? [];

  const saveTitle = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      message.error('Tiêu đề CV không được để trống.');
      return;
    }
    if (title.length > 180) {
      message.error('Tiêu đề CV không được vượt quá 180 ký tự.');
      return;
    }
    await act(editing.cvId, () => candidateCvApi.updateTitle(editing.cvId, title), 'Đã cập nhật tên CV.');
    setEditing(undefined);
  };

  return (
    <div className="candidate-page candidate-cv-page">
      <CandidatePageHeader
        eyebrow="Hồ sơ"
        title="Kho CV"
        description="CV bạn tải lên hoặc tự dựng được dùng để ứng tuyển. CV chính được chọn sẵn khi bạn bấm Ứng tuyển."
        actions={
          canCreate ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="!rounded-xl !bg-blue-600 hover:!bg-blue-700 font-semibold"
              onClick={() => setCreateBuilderOpen(true)}
            >
              Tạo CV mới
            </Button>
          ) : undefined
        }
      />
      {!canView && <Alert className="mb-5" type="error" showIcon message="Bạn không có quyền xem kho CV cá nhân." />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {cvs.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : cvs.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(cvs.error)} />
          ) : list.length === 0 ? (
            <CandidateSurface className="candidate-empty-surface p-10 text-center text-sm text-slate-600">
              <p className="mb-4">Chưa có CV nào. Tạo CV theo mẫu hoặc tải CV có sẵn ở khung bên cạnh.</p>
              {canCreate && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateBuilderOpen(true)}
                  className="!rounded-xl !bg-blue-600"
                >
                  Tạo CV đầu tiên
                </Button>
              )}
            </CandidateSurface>
          ) : (
            list.map((cv) => {
              const isStructured =
                cv.creationMethod === 'TEMPLATE_FORM' ||
                cv.creationMethod === 'PLATFORM_BUILDER';

              return (
                <article key={cv.cvId} className={`candidate-surface candidate-cv-card ${cv.isPrimary ? 'candidate-cv-card--primary' : ''} flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/80 text-slate-600 text-lg" aria-hidden>
                    <FileTextOutlined />
                  </span>
                  <div className="candidate-cv-card__content min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-semibold text-slate-900">{cv.title || cv.fileName || 'CV'}</span>
                      {cv.isPrimary && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          <CheckCircleFilled className="text-blue-600 text-xs" /> CV Mặc định
                        </span>
                      )}
                      {cv.creationMethod === 'TEMPLATE_FORM' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                          <LayoutOutlined aria-hidden /> Mẫu thiết kế
                        </span>
                      )}
                      {cv.creationMethod === 'PLATFORM_BUILDER' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          <FormOutlined aria-hidden /> Tự dựng
                        </span>
                      )}
                    </div>
                    <div className="candidate-cv-card__meta truncate text-xs text-slate-500">
                      {cv.fileName} · {fileSize(cv.fileSizeBytes)} · cập nhật {dayjs(cv.updatedAt).format('DD/MM/YYYY')}
                    </div>
                    <div className="candidate-cv-card__usage mt-1 text-xs text-slate-500">
                      {cv.applicationUsageCount > 0
                        ? `Đang được lưu trong ${cv.applicationUsageCount} đơn ứng tuyển${cv.submissionUsageCount > cv.applicationUsageCount ? ` và ${cv.submissionUsageCount - cv.applicationUsageCount} lượt nộp khác` : ''}.`
                        : cv.submissionUsageCount > 0
                          ? `Đã được dùng trong ${cv.submissionUsageCount} lượt nộp hồ sơ.`
                          : 'Chưa được dùng trong lượt nộp nào.'}
                    </div>
                  </div>
                  <div className="candidate-cv-card__actions flex shrink-0 items-center gap-1">
                    {canView && (
                      <Tooltip title="Xem CV">
                        <button
                          type="button"
                          className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md p-1.5 transition-colors border-0 bg-transparent inline-flex items-center justify-center cursor-pointer text-sm"
                          aria-label={`Xem ${cv.title ?? 'CV'}`}
                          onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))}
                        >
                          <EyeOutlined />
                        </button>
                      </Tooltip>
                    )}
                    {canUpdate && isStructured && (
                      <Tooltip title="Sửa nội dung CV">
                        <button
                          type="button"
                          className="hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-md p-1.5 transition-colors border-0 bg-transparent inline-flex items-center justify-center cursor-pointer text-sm"
                          aria-label={`Sửa nội dung ${cv.title ?? 'CV'}`}
                          onClick={() => setEditStructuredCvId(cv.cvId)}
                        >
                          <FormOutlined />
                        </button>
                      </Tooltip>
                    )}
                    {canUpdate && (
                      <Tooltip title="Đổi tên CV">
                        <button
                          type="button"
                          className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md p-1.5 transition-colors border-0 bg-transparent inline-flex items-center justify-center cursor-pointer text-sm"
                          aria-label={`Đổi tên ${cv.title ?? 'CV'}`}
                          onClick={() => setEditing({ cvId: cv.cvId, title: cv.title || cv.fileName || '' })}
                        >
                          <EditOutlined />
                        </button>
                      </Tooltip>
                    )}
                    {canUpdate && !cv.isPrimary && (
                      <Tooltip title="Đặt làm CV mặc định">
                        <button
                          type="button"
                          disabled={busyId === cv.cvId}
                          className="hover:bg-slate-100 text-slate-500 hover:text-amber-500 rounded-md p-1.5 transition-colors border-0 bg-transparent inline-flex items-center justify-center cursor-pointer text-sm disabled:opacity-50"
                          aria-label="Đặt làm CV mặc định"
                          onClick={() => act(cv.cvId, () => candidateCvApi.setPrimary(cv.cvId), 'Đã đặt làm CV mặc định.')}
                        >
                          <StarOutlined />
                        </button>
                      </Tooltip>
                    )}
                    {cv.isPrimary && (
                      <span className="p-1.5 text-amber-500 inline-flex items-center justify-center text-sm" title="CV mặc định">
                        <StarFilled />
                      </span>
                    )}
                    {canDelete && (
                      <Popconfirm
                        title="Gỡ CV khỏi kho?"
                        description={cv.deleteBehavior === 'ARCHIVE_HISTORY'
                          ? 'CV sẽ ẩn khỏi kho cá nhân nhưng bản đã gắn với lượt nộp và đơn ứng tuyển vẫn được giữ làm lịch sử.'
                          : 'CV chưa được sử dụng nên sẽ được xóa khỏi kho.'}
                        okText="Gỡ khỏi kho"
                        okButtonProps={{ danger: true }}
                        cancelText="Hủy"
                        onConfirm={() => act(cv.cvId, () => candidateCvApi.remove(cv.cvId), 'Đã gỡ CV khỏi kho.')}
                      >
                        <button
                          type="button"
                          className="hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-md p-1.5 transition-colors border-0 bg-transparent inline-flex items-center justify-center cursor-pointer text-sm"
                          aria-label={`Gỡ ${cv.title ?? 'CV'} khỏi kho`}
                        >
                          <DeleteOutlined />
                        </button>
                      </Popconfirm>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
        {canCreate && (
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <CandidateSurface className="candidate-cv-upload p-5">
              <div className="candidate-cv-upload__heading">
                <span><PlusOutlined /></span>
                <div>
                  <h2 className="m-0 text-base font-semibold text-slate-900">Thêm CV vào hồ sơ</h2>
                  <p>Chọn cách phù hợp nhất với bạn</p>
                </div>
              </div>

              {/* 3 clear choices */}
              <div className="space-y-2 mb-4">
                <Button
                  type="primary"
                  icon={<LayoutOutlined />}
                  block
                  className="candidate-cv-upload__primary !rounded-xl !h-11 text-xs font-semibold flex items-center justify-center gap-2"
                  onClick={() => setCreateBuilderOpen(true)}
                >
                  Tạo CV theo mẫu chuyên nghiệp
                </Button>
                <Button
                  icon={<FormOutlined />}
                  block
                  className="!rounded-xl !h-10 text-xs font-semibold flex items-center justify-center gap-2 text-slate-700 hover:text-blue-600 hover:border-blue-500"
                  onClick={() => setCreateBuilderOpen(true)}
                >
                  Soạn CV thân thiện với hệ thống tuyển dụng
                </Button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[11px] text-slate-400">hoặc tải PDF có sẵn</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="mt-2">
                <CvUploader />
              </div>
            </CandidateSurface>
          </aside>
        )}
      </div>

      {/* Rename Modal */}
      <Modal
        title="Đổi tên CV"
        open={Boolean(editing)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={Boolean(editing && busyId === editing.cvId)}
        okButtonProps={{ disabled: !editing?.title.trim() || (editing?.title.trim().length ?? 0) > 180 }}
        onOk={saveTitle}
        onCancel={() => setEditing(undefined)}
      >
        <Input
          autoFocus
          maxLength={180}
          showCount
          value={editing?.title ?? ''}
          aria-label="Tiêu đề CV"
          onChange={(event) => setEditing((current) => current ? { ...current, title: event.target.value } : current)}
          onPressEnter={saveTitle}
        />
      </Modal>

      {/* Create Structured CV Modal */}
      <CandidateCvBuilderModal
        open={createBuilderOpen}
        onClose={() => {
          setCreateBuilderOpen(false);
          if (searchParams.get('action')) {
            const next = new URLSearchParams(searchParams);
            next.delete('action');
            setSearchParams(next, { replace: true });
          }
        }}
        mode="create"
      />

      {/* Edit Structured CV Modal */}
      <CandidateCvBuilderModal
        open={Boolean(editStructuredCvId)}
        editCvId={editStructuredCvId}
        onClose={() => setEditStructuredCvId(undefined)}
        mode="edit"
      />
    </div>
  );
};
