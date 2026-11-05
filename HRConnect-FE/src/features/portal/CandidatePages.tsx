/**
 * @file CandidatePages.tsx
 * @description MF-02 branch A for the Candidate: overview, my applications (stage tracker from
 * GET /candidates/applications) and the CV vault (GET/POST/PATCH/DELETE /candidates/cv).
 * Applying itself happens on the job page through <ApplyButton />.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App as AntApp,
  Button,
  Divider,
  Tooltip,
} from 'antd';
import {
  CheckCircleFilled,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  PlusOutlined,
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
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { candidateDisplayStage, fileSize } from './mf02Labels';
import { CandidateSurface } from './candidate/CandidateUi';
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

import type { CandidateCv } from '@/types/api/mf02';
import {
  cvStorage,
  getSavedCvs,
  getSavedCvById,
  mapStoredCvToCandidateCv,
  setPrimarySavedCv,
  CV_STORAGE_EVENT,
  CANDIDATE_CV_UPDATED_EVENT,
} from './candidate/cv-builder/services/cvStorage';

import { candidateKeys } from './candidate/candidateKeys';
export { candidateKeys };

export const useCandidateCvs = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    };

    window.addEventListener(CANDIDATE_CV_UPDATED_EVENT, handleUpdate);
    window.addEventListener(CV_STORAGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(CANDIDATE_CV_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(CV_STORAGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: candidateKeys.cvs,
    queryFn: async () => {
      let apiCvs: CandidateCv[] = [];
      try {
        apiCvs = await candidateCvApi.list();
      } catch (err) {
        console.warn('candidateCvApi fetch warning:', err);
      }
      const localCvs = cvStorage.getAll().map(cvStorage.mapToCandidateCv);
      const combinedCvs = [
        ...localCvs,
        ...(apiCvs || []).filter((s) => !localCvs.some((l) => (l.cvId || l.id) === (s.cvId || s.id))),
      ];
      return combinedCvs;
    },
  });
};
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

  // Auto-refresh when CVs are modified in builder or other tabs
  useEffect(() => {
    const onCvUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      void cvs.refetch();
    };

    window.addEventListener(CANDIDATE_CV_UPDATED_EVENT, onCvUpdated);
    window.addEventListener(CV_STORAGE_EVENT, onCvUpdated);
    return () => {
      window.removeEventListener(CANDIDATE_CV_UPDATED_EVENT, onCvUpdated);
      window.removeEventListener(CV_STORAGE_EVENT, onCvUpdated);
    };
  }, [queryClient, cvs]);

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
                onClick={() => navigate('/candidate/cv-builder')}
                className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-xl shadow-xs border-none font-semibold text-xs h-9 px-3.5"
              >
                Tạo CV Online mới
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
                  onClick={() => navigate('/candidate/cv-builder')}
                  className="rounded-xl border border-slate-200 font-semibold text-slate-700 text-xs h-9 px-4 hover:border-blue-400"
                >
                  Tạo CV Online mới
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {cvList.slice(0, 3).map((cv) => {
                const cvIdentifier = cv.cvId || cv.id || '';
                const isOnline = Boolean(
                  cv.isOnlineCv ||
                  cv.creationMethod === 'PLATFORM_BUILDER' ||
                  cv.creationMethod === 'TEMPLATE_FORM' ||
                  (cv.cvId && cv.cvId.startsWith('cv_builder_')) ||
                  (cv.id && cv.id.startsWith('cv_builder_')) ||
                  cvStorage.getById(cvIdentifier)
                );

                return (
                  <div
                    key={cvIdentifier}
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
                              title={cv.title || cv.name || cv.fileName || 'CV'}
                              onClick={() => {
                                if (isOnline) {
                                  navigate(`/candidate/cv-builder/${cvIdentifier}?action=preview`);
                                } else {
                                  openSigned(() => candidateCvApi.downloadUrl(cv.cvId));
                                }
                              }}
                            >
                              {cv.title || cv.name || cv.fileName || 'Bản CV'}
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
                            onClick={() => {
                              if (isOnline) {
                                navigate(`/candidate/cv-builder/${cvIdentifier}?action=preview`);
                              } else {
                                openSigned(() => candidateCvApi.downloadUrl(cv.cvId));
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200/80 bg-white cursor-pointer"
                          >
                            <EyeOutlined className="text-xs" />
                            <span>Xem</span>
                          </button>
                        </Tooltip>
                        <Tooltip title="Tải xuống PDF">
                          <button
                            type="button"
                            onClick={() => {
                              if (isOnline) {
                                navigate(`/candidate/cv-builder/${cvIdentifier}?action=download`);
                              } else {
                                openSigned(() => candidateCvApi.downloadUrl(cv.cvId));
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200/80 bg-white cursor-pointer"
                          >
                            <DownloadOutlined className="text-xs" />
                            <span>Tải</span>
                          </button>
                        </Tooltip>
                        {isOnline && (
                          <Tooltip title="Chỉnh sửa trực tuyến">
                            <button
                              type="button"
                              onClick={() => navigate(`/candidate/cv-builder/${cvIdentifier}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors border border-blue-200/80 bg-blue-50/30 cursor-pointer"
                            >
                              <EditOutlined className="text-xs" />
                              <span>Sửa</span>
                            </button>
                          </Tooltip>
                        )}
                      </div>

                      {!cv.isPrimary && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (isOnline) {
                                setPrimarySavedCv(cvIdentifier);
                              } else {
                                await candidateCvApi.setPrimary(cv.cvId);
                              }
                              message.success(`Đã đặt "${cv.title || cv.name || cv.fileName}" làm CV chính.`);
                              void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
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
                );
              })}
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
