/**
 * @file CandidateSavedJobsPage.tsx
 * @description Candidate Saved Jobs (Việc làm đã lưu của ứng viên - MF-01 & FE-tasks-sang Mục 5).
 * Backed by candidateSavedJobApi (GET /candidates/me/saved-jobs, DELETE /candidates/me/saved-jobs/{jobId}).
 * Displays 3 states: Loading, Empty, Error (with retry).
 * Quick actions: Apply Now, Unsave, View Details.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Pagination,
  Popconfirm,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CompassOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  ReloadOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { SAVED_JOBS_QUERY_KEY, SAVED_JOBS_CUSTOM_EVENT, SAVED_JOBS_EVENT } from '@/hooks/useSavedJobs';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { ApplyJobModal, JobToApply } from '@/features/candidates/ApplyJobModal';
import {
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatExperience,
  formatSalary,
} from '@/features/jobs-mf01/jobDisplay';
import { CandidatePageHeader, CandidateSurface } from '@/features/portal/candidate/CandidateUi';
import type { SavedJobDto, JobListItemDto } from '@/types/api/candidateSavedJobs';

const PAGE_SIZE = 10;

export const CandidateSavedJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isApplied, getApplication } = useCandidateAppliedJobs();

  const [page, setPage] = useState(1);
  const [selectedJobToApply, setSelectedJobToApply] = useState<JobToApply | null>(null);
  const [unsavingJobId, setUnsavingJobId] = useState<string | null>(null);

  const queryKey = ['candidate-saved-jobs-list', page, PAGE_SIZE] as const;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => candidateSavedJobApi.getSavedJobs({ page, pageSize: PAGE_SIZE }),
    staleTime: 15000,
  });

  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;

  const handleUnsave = async (jobId: string, jobTitle?: string) => {
    try {
      setUnsavingJobId(jobId);
      await candidateSavedJobApi.unsaveJob(jobId);
      message.success(`Đã bỏ lưu tin tuyển dụng ${jobTitle ? `"${jobTitle}"` : ''}`);

      // Invalidate both paginated list and global bookmark cache
      queryClient.invalidateQueries({ queryKey: ['candidate-saved-jobs-list'] });
      queryClient.invalidateQueries({ queryKey: SAVED_JOBS_QUERY_KEY });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SAVED_JOBS_EVENT));
        window.dispatchEvent(new CustomEvent(SAVED_JOBS_CUSTOM_EVENT));
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể bỏ lưu việc làm.'));
    } finally {
      setUnsavingJobId(null);
    }
  };

  const getJobStatusBadge = (job: JobListItemDto) => {
    const isJobExpired =
      job.isAcceptingApplications === false ||
      (job.applicationDeadline && new Date(job.applicationDeadline) <= new Date());

    if (job.status === 'CLOSED' || job.status === 'REJECTED') {
      return (
        <Tag color="error" className="m-0 font-medium">
          Đã đóng
        </Tag>
      );
    }

    if (isJobExpired) {
      return (
        <Tag color="warning" icon={<ClockCircleOutlined />} className="m-0 font-medium">
          Hết hạn nhận hồ sơ
        </Tag>
      );
    }

    return (
      <Tag color="success" icon={<SafetyCertificateOutlined />} className="m-0 font-medium">
        Còn hạn nhận hồ sơ
      </Tag>
    );
  };

  return (
    <div className="candidate-page candidate-saved-jobs-page space-y-6 pb-16">
      {/* ─── Page Header ─── */}
      <CandidatePageHeader
        eyebrow="Cơ hội bạn quan tâm"
        title="Việc làm đã lưu"
        description="Quản lý và ứng tuyển nhanh các vị trí tuyển dụng bạn đã đánh dấu quan tâm từ Sàn việc làm."
        actions={
          <Button
            type="primary"
            icon={<CompassOutlined />}
            onClick={() => navigate('/jobs')}
            className="!h-10 !px-5 !rounded-full !font-semibold !shadow-xs"
          >
            Tìm kiếm việc làm mới
          </Button>
        }
      />

      {/* ─── State 1: Loading ─── */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <CandidateSurface key={idx} className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
              <Skeleton active avatar paragraph={{ rows: 3 }} />
            </CandidateSurface>
          ))}
        </div>
      )}

      {/* ─── State 2: Error with Retry button ─── */}
      {!isLoading && isError && (
        <CandidateSurface className="p-8 rounded-2xl border border-rose-200 bg-rose-50/40 text-center">
          <Alert
            type="error"
            showIcon
            message="Không thể tải danh sách việc làm đã lưu"
            description={getApiErrorMessage(error, 'Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng thử lại.')}
            className="text-left mb-6 rounded-xl border-rose-300"
          />
          <Button
            type="primary"
            danger
            size="large"
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
            className="!rounded-full !px-6 !font-semibold"
          >
            Thử lại
          </Button>
        </CandidateSurface>
      )}

      {/* ─── State 3: Empty ─── */}
      {!isLoading && !isError && items.length === 0 && (
        <CandidateSurface className="p-10 sm:p-14 text-center rounded-2xl border border-slate-200/90 shadow-xs bg-white">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-rose-50 border border-rose-200/80 flex items-center justify-center relative shadow-inner">
            <HeartOutlined className="text-3xl text-rose-500" />
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-sm">
              0
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            Bạn chưa lưu việc làm nào
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            Khám phá các vị trí tuyển dụng phù hợp trên sàn tuyển dụng và bấm nút lưu để sẵn sàng ứng tuyển bất cứ lúc nào.
          </p>

          <Button
            type="primary"
            size="large"
            icon={<CompassOutlined />}
            onClick={() => navigate('/jobs')}
            className="!h-11 !px-7 !rounded-full !font-bold !bg-blue-600 hover:!bg-blue-500 !text-white !shadow-xs"
          >
            Khám phá việc làm ngay
          </Button>
        </CandidateSurface>
      )}

      {/* ─── State 4: List of Saved Jobs ─── */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 px-1">
            <span>
              Hiển thị <strong className="text-slate-900">{items.length}</strong> / <strong>{totalCount}</strong> việc làm đã lưu
            </span>
            {isFetching && <span className="text-blue-600 font-medium">Đang cập nhật...</span>}
          </div>

          {items.map((item: SavedJobDto) => {
            const job = item.job || ({} as JobListItemDto);
            const jobId = job.jobId || item.jobId || item.savedJobId;
            const applied = isApplied(jobId);
            const appliedApp = applied ? getApplication(jobId) : undefined;
            const isAccepting = job.isAcceptingApplications !== false && job.status === 'ACTIVE';

            return (
              <CandidateSurface
                key={item.savedJobId || jobId}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 bg-white/95 border border-slate-200/90 hover:border-blue-400 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all duration-200"
              >
                {/* ── Left Content: Company Logo + Job Info ── */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <CompanyLogo
                    companyName={job.companyName || 'Công ty Tuyển dụng'}
                    logoUrl={job.company?.logoUrl || undefined}
                    size="md"
                    className="w-14 h-14 rounded-xl shrink-0"
                  />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Header Row: Title & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/candidate/jobs/${jobId}`}
                        className="font-bold text-slate-900 text-base sm:text-lg hover:text-blue-600 transition-colors line-clamp-1 no-underline"
                      >
                        {job.title || 'Vị trí tuyển dụng'}
                      </Link>
                      {applied && (
                        <Tag color="success" icon={<CheckCircleFilled />} className="m-0 font-medium text-xs">
                          Đã ứng tuyển
                        </Tag>
                      )}
                      {getJobStatusBadge(job)}
                    </div>

                    {/* Company Name */}
                    <div className="text-sm font-semibold text-slate-600 truncate">
                      {job.companyName || 'Doanh nghiệp Tuyển dụng'}
                    </div>

                    {/* Metadata: Salary, Location, Type, Experience, Deadline */}
                    <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap pt-0.5">
                      <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60">
                        <DollarCircleOutlined className="text-blue-600" />
                        {formatSalary(job as any)}
                      </span>

                      {job.location && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <EnvironmentOutlined className="text-slate-400" />
                            {job.location}
                          </span>
                        </>
                      )}

                      {job.employmentType && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>{EMPLOYMENT_TYPE_LABEL[job.employmentType as keyof typeof EMPLOYMENT_TYPE_LABEL] || job.employmentType}</span>
                        </>
                      )}

                      <span className="text-slate-300">•</span>
                      <span>{formatExperience(job.minExperienceYears, job.maxExperienceYears)}</span>

                      {job.applicationDeadline && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <ClockCircleOutlined className="text-slate-400" />
                            Hạn nộp: {formatDate(job.applicationDeadline)}
                          </span>
                        </>
                      )}

                      {item.savedAt && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400">
                            Đã lưu: {formatDate(item.savedAt)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Skills tags */}
                    {Array.isArray(job.skills) && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {job.skills.slice(0, 4).map((skill, sIdx) => (
                          <Tag key={sIdx} className="m-0 text-2xs bg-slate-50 text-slate-600 border-slate-200/80">
                            {typeof skill === 'string' ? skill : (skill as any)?.skillName || ''}
                          </Tag>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="text-2xs text-slate-400">+{job.skills.length - 4} kỹ năng</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right Actions: Quick Apply, Unsave, View Details ── */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Action 1: Ứng tuyển ngay */}
                  {applied ? (
                    <Button
                      type="default"
                      icon={<CheckCircleFilled className="text-emerald-600" />}
                      onClick={() => {
                        if (appliedApp?.applicationId) {
                          navigate(`/candidate/applications/${appliedApp.applicationId}`);
                        } else {
                          navigate('/candidate/applications');
                        }
                      }}
                      className="!rounded-xl font-semibold !text-emerald-700 !border-emerald-300 !bg-emerald-50/60 hover:!border-emerald-400"
                    >
                      Xem đơn
                    </Button>
                  ) : isAccepting ? (
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() =>
                        setSelectedJobToApply({
                          id: jobId,
                          title: job.title || 'Vị trí tuyển dụng',
                          company: job.companyName || 'Doanh nghiệp Tuyển dụng',
                          salaryMin: job.salaryMin ?? undefined,
                          salaryMax: job.salaryMax ?? undefined,
                        })
                      }
                      className="!rounded-xl font-bold !bg-blue-600 hover:!bg-blue-500 !text-white shadow-xs"
                    >
                      Ứng tuyển ngay
                    </Button>
                  ) : (
                    <Tooltip title="Tin tuyển dụng này đã hết hạn hoặc tạm dừng nhận hồ sơ">
                      <Button disabled icon={<SendOutlined />} className="!rounded-xl font-medium">
                        Đã hết hạn
                      </Button>
                    </Tooltip>
                  )}

                  {/* Action 2: Xem chi tiết */}
                  <Button
                    type="default"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/candidate/jobs/${jobId}`)}
                    className="!rounded-xl font-semibold text-slate-700 hover:text-blue-600"
                  >
                    Chi tiết
                  </Button>

                  {/* Action 3: Bỏ lưu tin */}
                  <Popconfirm
                    title="Bỏ lưu việc làm này?"
                    description="Việc làm sẽ được xóa khỏi danh sách đã lưu của bạn."
                    okText="Bỏ lưu"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleUnsave(jobId, job.title)}
                  >
                    <Tooltip title="Bỏ lưu tin này">
                      <Button
                        type="text"
                        danger
                        icon={<HeartFilled className="text-rose-500 fill-rose-500" />}
                        loading={unsavingJobId === jobId}
                        className="!rounded-xl !p-2 hover:!bg-rose-50"
                        aria-label="Bỏ lưu việc làm"
                      />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </CandidateSurface>
            );
          })}

          {/* ── Pagination ── */}
          {totalCount > PAGE_SIZE && (
            <div className="flex justify-center pt-6">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={totalCount}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
                className="bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-2xs"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Quick Apply Modal ── */}
      {selectedJobToApply && (
        <ApplyJobModal
          open={Boolean(selectedJobToApply)}
          job={selectedJobToApply}
          onClose={() => setSelectedJobToApply(null)}
          onSuccess={() => {
            setSelectedJobToApply(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default CandidateSavedJobsPage;
