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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { candidateApplicationsApi, candidateConsentApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api, isCandidateOfferRespondable } from '@/services/api/mf04Api';
import type { CandidateOfferSummaryDto } from '@/types/api/mf04';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateApplication, CandidateApplicationDisplayGroup } from '@/types/api/mf02';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { CANDIDATE_STEPS, MAX_CV_MB, candidateDisplayStage, candidateStage, candidateTimelineEventCopy, cvFileError, fileSize } from './mf02Labels';
import { CandidatePageHeader, CandidateSurface } from './candidate/CandidateUi';

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

const StageTracker: React.FC<{ status: string }> = ({ status }) => {
  const st = candidateStage(status);
  return (
    <ol className="m-0 flex list-none items-center gap-1 p-0" aria-label={`Tiến độ: ${st.label}`}>
      {CANDIDATE_STEPS.map((label, i) => {
        const reached = i <= st.step;
        const color = st.closed && i === st.step && st.tone !== 'success' ? 'bg-slate-400' : reached ? 'bg-[color:var(--console-accent)]' : 'bg-slate-200';
        return (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={`h-1.5 rounded-full ${color}`} aria-hidden />
            <span className={`hidden text-[11px] sm:block ${reached ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

const PublicApplicationProgress: React.FC<{ application: CandidateApplication }> = ({ application }) => {
  const stage = candidateDisplayStage(application.displayGroup, application.displayLabel);
  const statusClass = application.displayGroup.toLowerCase().replace(/_/g, '-');

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

  return (
    <ol className={`candidate-application-progress candidate-application-progress--${statusClass} m-0 flex list-none items-center gap-1 p-0`} aria-label={`Tiến độ: ${stage.label}`}>
      {CANDIDATE_STEPS.map((label, index) => {
        const reached = index <= stage.step;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={`candidate-application-progress__bar h-1.5 rounded-full ${reached ? 'candidate-application-progress__bar--reached' : 'bg-slate-200'}`} aria-hidden />
            <span className={`hidden text-[11px] sm:block ${reached ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

const ApplicationCard: React.FC<{ a: CandidateApplication }> = ({ a }) => {
  const navigate = useNavigate();
  const stage = candidateDisplayStage(a.displayGroup, a.displayLabel);
  const statusClass = a.displayGroup.toLowerCase().replace(/_/g, '-');
  const isPositiveOutcome = a.displayGroup === 'SELECTED' || a.displayGroup === 'HIRED';
  const isClosedOutcome = a.displayGroup === 'NOT_SELECTED' || a.displayGroup === 'WITHDRAWN';
  return (
    <article className={`candidate-surface candidate-application-card candidate-application-card--${statusClass} flex flex-col gap-3 p-5 ${isClosedOutcome ? 'candidate-application-card--closed' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[16px] font-semibold leading-snug text-slate-900">{a.jobTitle}</div>
          <div className="text-[13px] text-slate-600">{a.companyName}</div>
        </div>
        <span className={`candidate-application-status candidate-application-status--${statusClass}`}>
          {isPositiveOutcome ? <CheckCircleFilled aria-hidden /> : isClosedOutcome ? <CloseCircleOutlined aria-hidden /> : <HistoryOutlined aria-hidden />}
          {stage.label}
        </span>
      </div>
      <PublicApplicationProgress application={a} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Nộp {dayjs(a.appliedAt).fromNow()}</span>
        {a.cvTitle && (
          <span className="inline-flex items-center gap-1">
            <FilePdfOutlined aria-hidden /> {a.cvTitle}
          </span>
        )}
      </div>
      <div>
        <Button type="link" className="!h-auto !p-0" onClick={() => navigate(`/candidate/applications/${a.applicationId}`)}>
          Xem chi tiết
        </Button>
      </div>
    </article>
  );
};

// ─── Overview ───────────────────────────────────────────────────────────────

export const CandidateHomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const apps = useMyApplications();
  const cvs = useCandidateCvs();
  const items = apps.data?.items ?? [];
  const active = items.filter((a) => !candidateDisplayStage(a.displayGroup, a.displayLabel).closed);
  const interviewing = items.filter((a) => a.displayGroup === 'INTERVIEW').length;
  const firstName = (user?.name || 'bạn').trim().split(/\s+/).slice(-1)[0];

  return (
    <div className="candidate-page candidate-dashboard-page">
      <section className="candidate-dashboard-hero">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="relative">
          <h1 className="m-0 text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">Chào {firstName},</h1>
          <p className="m-0 mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
            {apps.isLoading
              ? 'Đang tải đơn ứng tuyển của bạn...'
              : items.length === 0
                ? 'Bạn chưa ứng tuyển công việc nào. Tìm việc phù hợp và ứng tuyển chỉ với một CV.'
                : `Bạn có ${active.length} đơn đang được xử lý${interviewing ? `, trong đó ${interviewing} đơn đã được chọn hoặc đang phỏng vấn` : ''}.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="primary" size="large" icon={<SearchOutlined />} className="!rounded-full !px-6" onClick={() => navigate('/candidate/jobs')}>
              Tìm việc làm
            </Button>
            <Button size="large" className="!rounded-full !px-6" onClick={() => navigate('/candidate/cvs')}>
              Quản lý CV
            </Button>
          </div>
        </div>
      </section>

      {!cvs.isLoading && (cvs.data ?? []).length === 0 && (
        <Alert
          type="info"
          showIcon
          message="Bạn chưa có CV nào trong kho"
          description="Tải một CV dạng PDF lên trước để ứng tuyển nhanh hơn."
          action={<Button onClick={() => navigate('/candidate/cvs')}>Tải CV</Button>}
        />
      )}

      <div className="candidate-stat-grid">
        {[
          { label: 'Đơn đã nộp', value: items.length, to: '/candidate/applications' },
          { label: 'Đang xử lý', value: active.length, to: '/candidate/applications' },
          { label: 'CV trong kho', value: cvs.data?.length ?? 0, to: '/candidate/cvs' },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => navigate(k.to)}
            className="candidate-surface candidate-stat-card cursor-pointer p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--candidate-accent)]"
          >
            <span className="block text-[13px] font-medium text-slate-600">{k.label}</span>
            <span className="mt-1 block text-[28px] font-bold tabular-nums text-slate-900">
              {apps.isLoading || cvs.isLoading ? <Skeleton.Input active size="small" /> : k.value}
            </span>
          </button>
        ))}
      </div>

      <section className="candidate-dashboard-section">
        <div className="candidate-section-heading">
          <h2 className="m-0 text-base font-bold text-slate-900">Đơn gần đây</h2>
          {items.length > 0 && (
            <Button type="link" className="!px-0" onClick={() => navigate('/candidate/applications')}>
              Xem tất cả
            </Button>
          )}
        </div>
        {apps.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : apps.isError ? (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(apps.error)}
            action={<Button onClick={() => apps.refetch()}>Thử lại</Button>}
          />
        ) : items.length === 0 ? (
          <CandidateSurface className="candidate-empty-surface p-8 text-center text-sm text-slate-600">
            Chưa có đơn ứng tuyển nào.
          </CandidateSurface>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            {items.slice(0, 4).map((a) => (
              <ApplicationCard key={a.applicationId} a={a} />
            ))}
          </div>
        )}
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
          <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => navigate('/candidate/jobs')}>
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
              <p className="m-0 mt-1 text-sm text-slate-500">Affiliate chỉ có thể gửi hồ sơ đến doanh nghiệp sau khi bạn đồng ý.</p>
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
      <CandidateSurface className="candidate-filter-bar">
        <Input.Search
          aria-label="Tìm theo công việc hoặc doanh nghiệp"
          allowClear
          value={searchDraft}
          placeholder="Tên công việc hoặc doanh nghiệp"
          className="min-w-64 flex-1"
          onChange={(event) => {
            setSearchDraft(event.target.value);
            if (!event.target.value) updateFilters({ search: undefined });
          }}
          onSearch={(value) => updateFilters({ search: value.trim() || undefined })}
        />
        <Select
          aria-label="Lọc theo trạng thái"
          allowClear
          placeholder="Tất cả trạng thái"
          value={status}
          onChange={(value) => updateFilters({ status: value })}
          className="min-w-52"
          options={[
            ['SUBMITTED', 'Đã nộp'],
            ['IN_REVIEW', 'Đang xem xét'],
            ['SELECTED', 'Được chọn phỏng vấn'],
            ['INTERVIEW', 'Phỏng vấn'],
            ['OFFER', 'Đã nhận lời mời'],
            ['HIRED', 'Đã tuyển'],
            ['NOT_SELECTED', 'Chưa phù hợp'],
            ['WITHDRAWN', 'Đã rút đơn'],
          ].map(([value, label]) => ({ value: value as CandidateApplicationDisplayGroup, label }))}
        />
        <Select
          aria-label="Lọc theo nguồn ứng tuyển"
          allowClear
          placeholder="Tất cả nguồn"
          value={submissionSource}
          onChange={(value) => updateFilters({ submissionSource: value })}
          className="min-w-48"
          options={[
            { value: 'CANDIDATE', label: 'Tôi tự ứng tuyển' },
            { value: 'AFFILIATE', label: 'Affiliate giới thiệu' },
          ]}
        />
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
        {(status || fromDate || toDate || jobId || search || submissionSource) && (
          <Button onClick={() => { setSearchDraft(''); setSearchParams({}); }}>Xóa bộ lọc</Button>
        )}
      </CandidateSurface>
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
            <Button type="primary" className="mt-3" icon={<SearchOutlined />} onClick={() => navigate('/candidate/jobs')}>
              Tìm việc làm
            </Button>
          )}
        </CandidateSurface>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
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
  const stage = candidateStage(application.status);
  const allowedActions: string[] = application.allowedActions || [];
  const canWithdraw = allowedActions.includes('WITHDRAW_APPLICATION');

  const interviews: any[] = application.interviews || [];
  const offers: any[] = application.offers || [];
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
        actions={<StatusDot tone={stage.tone}>{stage.label}</StatusDot>}
      />

      {/* Main Info Surface */}
      <CandidateSurface className="space-y-5 p-6">
        <StageTracker status={application.status} />
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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
              {application.submissionSource === 'AFFILIATE' ? 'Affiliate giới thiệu' : 'Candidate tự ứng tuyển'}
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
      <CandidateSurface className="p-6">
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
            {interviews.map((iv: any) => (
              <Card
                key={iv.interviewId}
                size="small"
                className="border border-slate-200 rounded-xl bg-slate-50/50"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        Vòng {iv.interviewRound}: {iv.interviewType || 'Phỏng vấn'}
                      </span>
                      <Tag color={iv.status === 'SCHEDULED' ? 'blue' : iv.status === 'COMPLETED' ? 'green' : 'default'}>
                        {iv.status}
                      </Tag>
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
                  {iv.meetingLink && (
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
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </CandidateSurface>

      {/* Offers Section */}
      <CandidateSurface className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <GiftOutlined className="text-emerald-600 text-lg" />
          <h2 className="m-0 text-base font-bold text-slate-900">
            Thư mời nhận việc (Offers) {offers.length > 0 ? `(${offers.length})` : ''}
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
                  className="border border-emerald-200 rounded-xl bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Phiên bản #{offer.offerVersion}</span>
                        <Tag color={offer.status === 'ACCEPTED' ? 'green' : offer.status === 'DECLINED' ? 'red' : 'blue'}>
                          {offer.status}
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
                          Tài liệu Offer
                        </Button>
                      )}
                      {canRespond && (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            className="bg-emerald-600 hover:bg-emerald-500 border-none"
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
          <h2 className="m-0 text-base font-bold text-slate-900">Thông tin Tiếp nhận việc làm (Placement)</h2>
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
          <h2 className="m-0 text-base font-bold text-slate-900">Kết quả AI</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-slate-500">Trạng thái</span><strong className="mt-1 block text-slate-900">{application.aiStatus || 'Chưa có kết quả'}</strong></div>
            <div><span className="text-slate-500">Điểm phù hợp</span><strong className="mt-1 block text-slate-900">{application.aiMatchScore == null ? '—' : `${application.aiMatchScore}%`}</strong></div>
            <div><span className="text-slate-500">Mức phù hợp</span><strong className="mt-1 block text-slate-900">{application.aiMatchTier || '—'}</strong></div>
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
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const cvs = useCandidateCvs();
  const openSigned = useOpenSignedUrl();
  const [busyId, setBusyId] = useState<string>();
  const [editing, setEditing] = useState<{ cvId: string; title: string }>();
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
      <CandidatePageHeader eyebrow="Hồ sơ" title="Kho CV" description="CV bạn tải lên được dùng để ứng tuyển. CV chính được chọn sẵn khi bạn bấm Ứng tuyển." />
      {!canView && <Alert className="mb-5" type="error" showIcon message="Bạn không có quyền xem kho CV cá nhân." />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {cvs.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : cvs.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(cvs.error)} />
          ) : list.length === 0 ? (
            <CandidateSurface className="candidate-empty-surface p-10 text-center text-sm text-slate-600">Chưa có CV nào. Tải CV đầu tiên ở khung bên cạnh.</CandidateSurface>
          ) : (
            list.map((cv) => (
              <article key={cv.cvId} className="candidate-surface candidate-cv-card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-2xl text-red-700" aria-hidden>
                  <FilePdfOutlined />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-900">{cv.title || cv.fileName || 'CV'}</span>
                    {cv.isPrimary && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--console-accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--console-accent-strong)]">
                        <CheckCircleFilled aria-hidden /> CV chính
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {cv.fileName} · {fileSize(cv.fileSizeBytes)} · cập nhật {dayjs(cv.updatedAt).format('DD/MM/YYYY')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {cv.applicationUsageCount > 0
                      ? `Đang được lưu trong ${cv.applicationUsageCount} đơn ứng tuyển${cv.submissionUsageCount > cv.applicationUsageCount ? ` và ${cv.submissionUsageCount - cv.applicationUsageCount} lượt nộp khác` : ''}.`
                      : cv.submissionUsageCount > 0
                        ? `Đã được dùng trong ${cv.submissionUsageCount} lượt nộp hồ sơ.`
                        : 'Chưa được dùng trong lượt nộp nào.'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canView && (
                    <Tooltip title="Xem CV">
                      <Button icon={<EyeOutlined />} aria-label={`Xem ${cv.title ?? 'CV'}`} onClick={() => openSigned(() => candidateCvApi.downloadUrl(cv.cvId))} />
                    </Tooltip>
                  )}
                  {canUpdate && (
                    <Tooltip title="Đổi tên CV">
                      <Button icon={<EditOutlined />} aria-label={`Đổi tên ${cv.title ?? 'CV'}`} onClick={() => setEditing({ cvId: cv.cvId, title: cv.title || cv.fileName || '' })} />
                    </Tooltip>
                  )}
                  {canUpdate && !cv.isPrimary && (
                    <Tooltip title="Đặt làm CV chính">
                      <Button
                        icon={busyId === cv.cvId ? undefined : <StarOutlined />}
                        loading={busyId === cv.cvId}
                        aria-label="Đặt làm CV chính"
                        onClick={() => act(cv.cvId, () => candidateCvApi.setPrimary(cv.cvId), 'Đã đặt làm CV chính.')}
                      />
                    </Tooltip>
                  )}
                  {cv.isPrimary && (
                    <Button icon={<StarFilled />} disabled aria-label="CV chính" className="!text-amber-600" />
                  )}
                  {canDelete && <Popconfirm
                    title="Gỡ CV khỏi kho?"
                    description={cv.deleteBehavior === 'ARCHIVE_HISTORY'
                      ? 'CV sẽ ẩn khỏi kho cá nhân nhưng bản đã gắn với lượt nộp và đơn ứng tuyển vẫn được giữ làm lịch sử.'
                      : 'CV chưa được sử dụng nên sẽ được xóa khỏi kho.'}
                    okText="Gỡ khỏi kho"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    onConfirm={() => act(cv.cvId, () => candidateCvApi.remove(cv.cvId), 'Đã gỡ CV khỏi kho.')}
                  >
                    <Button danger icon={<DeleteOutlined />} aria-label={`Gỡ ${cv.title ?? 'CV'} khỏi kho`} />
                  </Popconfirm>}
                </div>
              </article>
            ))
          )}
        </div>
        {canCreate && <aside className="lg:sticky lg:top-24 lg:self-start">
          <CandidateSurface className="candidate-cv-upload p-5">
            <h2 className="m-0 mb-3 text-base font-semibold text-slate-900">Tải CV mới</h2>
            <CvUploader />
          </CandidateSurface>
        </aside>}
      </div>
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
    </div>
  );
};
