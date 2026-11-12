/**
 * @file ClientJobsListPage.tsx
 * @description MF-01 · Client Company — "Tin tuyển dụng của tôi" backed by GET /jobs/mine.
 * Actions follow the backend state machine: submit (DRAFT/REJECTED), pause (ACTIVE),
 * resume (PAUSED), close (ACTIVE/PAUSED). Every write sends the job's latest concurrencyToken.
 */
import React, { useMemo, useState } from 'react';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Button,
  Drawer,
  Dropdown,
  Empty,
  Skeleton,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  CreditCardOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import type { Job, JobCloseReasonCode, JobStatus, ServiceTypeCode } from '@/types/api/jobs';
import { FilterPills, PageHero, Surface } from '@/features/admin-console/ui';
import { screeningApi } from '@/services/api/hrApi';
import '@/features/admin-console/admin-console.css';
import { getApiErrorMessage } from '@/services/apiClient';
import { jobsApi } from '@/services/api/jobsApi';
import { formatMoney, useJobDetail, useJobMutations, useMyJobs } from './useJobQueries';
import { JobDetailPanel, JobStatusTag } from './JobDetailPanel';
import { PaymentDemoModal } from './PaymentDemoModal';
import { ReasonModal } from './ReasonModal';
import {
  CLOSE_REASONS,
  JOB_STATUS,
  SERVICE_TYPE_LABEL,
  clientActions,
  formatDate,
  formatSalary,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
  formatHeadcount,
} from './jobDisplay';


const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

type StatusFilter = 'ALL' | JobStatus;
const FILTER_ORDER: JobStatus[] = ['DRAFT', 'PENDING_REVIEW', 'PENDING_AGREEMENT', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CLOSED', 'REJECTED'];

type PendingAction = { kind: 'pause' | 'close'; job: Job } | null;

const ServiceTypeTag: React.FC<{ code?: string | null }> = ({ code }) => {
  if (!code || !SERVICE_TYPE_LABEL[code as ServiceTypeCode]) return null;
  const info = SERVICE_TYPE_LABEL[code as ServiceTypeCode];
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {info.label}
    </span>
  );
};

export const ClientJobsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  // The status filter lives in the URL so overview tiles can deep-link (e.g. ?status=ACTIVE).
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get('status');
  const filter: StatusFilter = rawStatus && (FILTER_ORDER as string[]).includes(rawStatus) ? (rawStatus as JobStatus) : 'ALL';
  const view: 'grid' | 'table' = searchParams.get('view') === 'table' ? 'table' : 'grid';
  const setView = (v: 'grid' | 'table') => {
    const next = new URLSearchParams(searchParams);
    if (v === 'grid') next.delete('view');
    else next.set('view', v);
    setSearchParams(next, { replace: true });
  };
  const setFilter = React.useCallback((v: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'ALL') next.delete('status');
    else next.set('status', v);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [detailJobId, setDetailJobId] = useState<string>();
  const [pending, setPending] = useState<PendingAction>(null);
  const [paymentModalJob, setPaymentModalJob] = useState<{
    jobId: string;
    title: string;
    isDeposit?: boolean;
    depositAmount?: number | null;
  } | null>(null);

  const highlightParam = searchParams.get('highlight') || searchParams.get('jobId');
  const openDetailParam = searchParams.get('openDetail') === 'true';
  const openPaymentParam = searchParams.get('openPayment') === 'true';
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);

  // One request for everything, filtered locally so each tab can show its count.
  const { data: jobs = [], isLoading, isError, error, refetch, isFetching } = useMyJobs();
  const detail = useJobDetail(detailJobId);
  const mutations = useJobMutations();

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(FILTER_ORDER.map((s) => [s, 0])) as Record<JobStatus, number>;
    jobs.forEach((j) => {
      byStatus[j.status] += 1;
    });
    return byStatus;
  }, [jobs]);

  // Tự động tìm kiếm, làm nổi bật và mở thanh toán khi người dùng nhấn từ thông báo
  React.useEffect(() => {
    if (jobs.length === 0) return;

    let targetJob: typeof jobs[0] | undefined;

    if (highlightParam) {
      const query = highlightParam.trim().toLowerCase();
      targetJob = jobs.find(
        (j) => j.jobId.toLowerCase() === query || j.title.toLowerCase().includes(query)
      );
    }

    if (!targetJob && openPaymentParam) {
      targetJob = jobs.find((j) => j.status === 'PENDING_PAYMENT');
    }

    if (targetJob) {
      setHighlightedJobId(targetJob.jobId);

      // Nếu bộ lọc hiện tại đang ẩn bài này, tự động chuyển về trạng thái của bài hoặc ALL
      if (filter !== 'ALL' && targetJob.status !== filter) {
        setFilter(targetJob.status);
      }

      if (openDetailParam) {
        setDetailJobId(targetJob.jobId);
      }

      if (openPaymentParam) {
        setPaymentModalJob({ jobId: targetJob.jobId, title: targetJob.title });
      }

      // Cuộn mượt đến thẻ bài viết sau khi render
      const timer = setTimeout(() => {
        const el = document.getElementById(`job-card-${targetJob?.jobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [highlightParam, openPaymentParam, openDetailParam, jobs, filter, setFilter]);

  const expiredJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (j.expiresAt && new Date(j.expiresAt) <= new Date()) ||
          (j.status === 'CLOSED' && Boolean(j.statusReason?.toLowerCase().includes('hết hạn')))
      ),
    [jobs]
  );

  const visibleJobs = useMemo(
    () =>
      [...(filter === 'ALL' ? jobs : jobs.filter((j) => j.status === filter))].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [jobs, filter]
  );

  const notifyError = (err: unknown) => {
    message.error(getApiErrorMessage(err));
    refetch();
  };

  // Application count per published job (jobs never published cannot have applications).
  const countable = visibleJobs.filter((j) => j.status === 'ACTIVE' || j.status === 'PAUSED' || j.status === 'CLOSED');
  // One grouped request for every job (C-07), instead of one list request per job.
  const countableIds = countable.map((j) => j.jobId);
  const jobCounts = useQuery({
    queryKey: ['client-candidates', 'job-counts', countableIds.join(',')],
    queryFn: () => screeningApi.counts('job', {}, countableIds),
    enabled: countableIds.length > 0,
    staleTime: 60_000,
  });
  const applicationsOf = (jobId: string) =>
    countableIds.includes(jobId)
      ? { data: jobCounts.data?.[jobId] ?? (jobCounts.data ? 0 : undefined), isLoading: jobCounts.isLoading }
      : undefined;

  const confirmSubmit = (job: Job) =>
    modal.confirm({
      title: 'Gửi tin tuyển dụng đi duyệt?',
      content:
        'Bộ phận kiểm duyệt của HR Connect sẽ kiểm tra trước khi tin được hiển thị. Trong lúc chờ duyệt, bạn chưa thể sửa tin.',
      okText: 'Gửi duyệt',
      cancelText: 'Để sau',
      onOk: async () => {
        try {
          const fresh = await jobsApi.getById(job.jobId);
          if (fresh.status !== 'DRAFT' && fresh.status !== 'REJECTED') {
            message.info('Tin tuyển dụng đã ở trạng thái chờ duyệt hoặc đã được cập nhật.');
            refetch();
            return;
          }
          const res = await mutations.submit.mutateAsync({ jobId: job.jobId, token: fresh.concurrencyToken });
          message.success(res.message);
        } catch (err) {
          notifyError(err);
        }
      },
    });

  const resume = (job: Job) =>
    mutations.resume
      .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
      .then((res) => message.success(res.message))
      .catch(notifyError);

  const renderActions = (job: Job) => {
    const can = clientActions(job.status);
    // CV_SOURCING pays a deposit recorded by Platform Admin, not the posting fee.
    // N1: only once HR approved the content (PENDING_PAYMENT), never while still waiting for review.
    const needsPayment = !isAwaitingSourcingDeposit(job) && job.status === 'PENDING_PAYMENT';
    const busy =
      (mutations.submit.isPending && mutations.submit.variables?.jobId === job.jobId) ||
      (mutations.resume.isPending && mutations.resume.variables?.jobId === job.jobId);
    const more = [
      { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
      ...(job.serviceTypeCode === 'HEADHUNT_COD' || job.serviceTypeCode === 'CV_SOURCING'
        ? [{ key: 'agreement', icon: <FileDoneOutlined />, label: 'Thỏa thuận dịch vụ' }]
        : []),
      ...(job.serviceTypeCode === 'CV_SOURCING' ? [{ key: 'sourcing', icon: <TeamOutlined />, label: 'Kho CV tìm kiếm' }] : []),
      ...(can.canPause ? [{ key: 'pause', label: 'Tạm dừng tuyển' }] : []),
      ...(can.canResume ? [{ key: 'resume', label: 'Mở lại tuyển' }] : []),
      ...(can.canClose ? [{ key: 'close', label: 'Đóng tin', danger: true }] : []),
    ];
    return (
      <div className="flex items-center justify-end gap-1.5">
        {job.serviceTypeCode === 'CV_SOURCING' && job.status !== 'PENDING_AGREEMENT' && (
          <Button
            size="small"
            className="!text-sky-800 !border-sky-200 hover:!border-sky-400 bg-sky-50 hover:bg-sky-100 font-medium whitespace-nowrap !h-8 !rounded-lg text-xs"
            icon={<TeamOutlined />}
            onClick={() => navigate(`/client/jobs/${job.jobId}/sourcing`)}
          >
            Kho CV
          </Button>
        )}
        {needsPayment && (
          <Button
            size="small"
            type="primary"
            className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white !rounded-lg shadow-sm transition-all active:scale-[0.98] font-medium !h-8 px-3 text-xs"
            icon={<CreditCardOutlined />}
            onClick={() => setPaymentModalJob({ jobId: job.jobId, title: job.title })}
          >
            Thanh toán
          </Button>
        )}
        {can.canSubmit && !needsPayment && (
          <Button
            size="small"
            type="primary"
            className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white !rounded-lg shadow-sm transition-all active:scale-[0.98] font-medium !h-8 px-3 text-xs"
            icon={<SendOutlined />}
            loading={busy}
            onClick={() => confirmSubmit(job)}
          >
            Gửi duyệt
          </Button>
        )}
        {can.canEdit && (
          <Tooltip title="Sửa tin">
            <Button
              size="small"
              icon={<EditOutlined />}
              aria-label={`Sửa tin ${job.title}`}
              className="!h-8 !w-8 !rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
              onClick={() => navigate(`/client/jobs/${job.jobId}/edit`)}
            />
          </Tooltip>
        )}
        <Dropdown
          trigger={['click']}
          menu={{
            items: more,
            onClick: ({ key }) => {
              if (key === 'view') setDetailJobId(job.jobId);
              if (key === 'agreement') navigate(`/client/agreements?jobId=${job.jobId}`);
              if (key === 'sourcing') navigate(`/client/jobs/${job.jobId}/sourcing`);
              if (key === 'resume') resume(job);
              if (key === 'pause' || key === 'close') setPending({ kind: key, job });
            },
          }}
        >
          <Button
            size="small"
            icon={<MoreOutlined />}
            aria-label={`Thao tác khác cho ${job.title}`}
            loading={busy && !can.canSubmit}
            className="!h-8 !w-8 !rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
          />
        </Dropdown>
      </div>
    );
  };

  const columns: ColumnsType<Job> = [
    {
      title: 'Vị trí',
      key: 'title',
      render: (_, job) => (
        <div className="min-w-[220px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetailJobId(job.jobId)}
              className="text-left font-semibold text-slate-900 hover:text-emerald-700 cursor-pointer bg-transparent border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 rounded"
            >
              {job.title || 'Vị trí chưa đặt tên'}
            </button>
            {job.jobId === highlightedJobId && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 animate-pulse">
                🔔 Từ thông báo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <ServiceTypeTag code={job.serviceTypeCode} />
            <span className="text-xs text-slate-500">{job.location ?? 'Chưa có địa điểm'}</span>
          </div>
          {job.status === 'REJECTED' && job.statusReason && (
            <div className="text-xs text-red-700 mt-1 line-clamp-2">Lý do từ chối: {job.statusReason}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, job) => (
        <div className="space-y-1">
          <Tooltip title={job.status === 'PENDING_AGREEMENT' && job.hasSignedAgreement ? 'Đã nộp hợp đồng đã ký kết, đang chờ Internal HR kiểm tra và duyệt tin' : JOB_STATUS[job.status].hint}>
            <span>
              <JobStatusTag status={job.status} hasSignedAgreement={job.hasSignedAgreement} />
            </span>
          </Tooltip>
          {job.postingFeeStatus === 'PENDING' && job.status === 'PENDING_PAYMENT' && !isAwaitingSourcingDeposit(job) && (
            <div>
              <Tag color="warning" className="m-0 text-[11px] font-medium">Chờ phí đăng tin</Tag>
            </div>
          )}
          {job.postingFeeStatus === 'PAID' && (
            <div>
              <Tag color="success" className="m-0 text-[11px] font-medium">Đã nộp phí</Tag>
            </div>
          )}
        </div>
      ),
    },
    { title: 'Mức lương', key: 'salary', width: 220, render: (_, job) => formatSalary(job) },
    {
      title: <span className="whitespace-nowrap">Số lượng / Quota</span>,
      key: 'quantity',
      width: 140,
      render: (_, job) => {
        const count = applicationsOf(job.jobId);
        return (
          <div className="text-xs space-y-0.5">
            <div>{job.serviceTypeCode === 'CV_SOURCING' ? 'Cần nhận' : 'Tuyển'}: <span className="font-semibold text-slate-800">{formatHeadcount(job)}</span></div>
            {job.maxApplications && (
              <div className="text-slate-500">
                Hồ sơ: <span className="font-semibold text-emerald-700">{count?.data ?? 0}/{job.maxApplications}</span>
              </div>
            )}
          </div>
        );
      },
    },
    { title: 'Cập nhật', dataIndex: 'updatedAt', width: 120, render: (v: string) => formatDate(v) },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'actions',
      width: 230,
      fixed: 'right',
      render: (_, job) => renderActions(job),
    },
  ];

  const filterOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'ALL', label: 'Tất cả', count: jobs.length },
    ...FILTER_ORDER.map((s) => ({ value: s as StatusFilter, label: JOB_STATUS[s].label, count: counts[s] })),
  ];

  return (
    <div className={`${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Compact header: the top bar already shows the page title ── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sr-only">
              Chiến dịch tuyển dụng
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0284C7] border border-sky-100">
              {jobs.length} tin tổng cộng
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Tooltip title="Tải lại danh sách">
            <Button
              icon={<ReloadOutlined />}
              aria-label="Tải lại danh sách"
              loading={isFetching && !isLoading}
              onClick={() => refetch()}
              className="!h-10 !w-10 !rounded-xl border-slate-200 hover:!border-slate-300 text-slate-600 hover:text-slate-900"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="!h-10 !rounded-xl !border-0 !bg-[#0284C7] hover:!bg-[#0369A1] font-bold text-white shadow-sm shadow-sky-500/15 transition-all active:scale-[0.98] !px-4.5"
            onClick={() => navigate('/client/jobs/create')}
          >
            Đăng tin mới
          </Button>
        </div>
      </div>

      {expiredJobs.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          className="mb-4"
          message={`Bạn có ${expiredJobs.length} tin tuyển dụng đã hết hạn hiển thị`}
          description="Các tin đã hết thời hạn hiển thị sẽ tự động đóng. Bạn có thể tạo tin mới và chọn gói tiêu chuẩn để tiếp tục tuyển dụng."
          action={
            <Button size="small" type="primary" onClick={() => navigate('/client/jobs/create')}>
              Đăng tin mới
            </Button>
          }
        />
      )}

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách tin tuyển dụng"
          description={getApiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : (
        <Surface>
          <div className="px-5 pb-3 pt-5" aria-busy={isLoading}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterPills label="Lọc theo trạng thái" value={filter} onChange={setFilter} options={filterOptions} />
              <div role="radiogroup" aria-label="Kiểu hiển thị" className="inline-flex rounded-full bg-slate-100 p-1">
                {(
                  [
                    ['grid', <AppstoreOutlined key="g" />, 'Dạng thẻ'],
                    ['table', <UnorderedListOutlined key="t" />, 'Dạng bảng'],
                  ] as const
                ).map(([v, icon, label]) => (
                  <Tooltip key={v} title={label}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={view === v}
                      aria-label={label}
                      onClick={() => setView(v)}
                      className={`flex h-9 w-10 cursor-pointer items-center justify-center rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${view === v ? 'bg-white text-[color:var(--console-accent-strong)] shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      {icon}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-5">
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          ) : visibleJobs.length === 0 ? (
            <Empty
              className="py-14"
              description={
                filter === 'ALL'
                  ? 'Bạn chưa có tin tuyển dụng nào.'
                  : `Không có tin ở trạng thái "${JOB_STATUS[filter].label}".`
              }
            >
              {filter === 'ALL' && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/client/jobs/create')}>
                  Đăng tin đầu tiên
                </Button>
              )}
            </Empty>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-5 pt-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleJobs.map((job) => {
                const count = applicationsOf(job.jobId);
                const isHighlighted = highlightedJobId === job.jobId;
                const totalApps = count?.data ?? 0;
                const maxApps = job.maxApplications || (job.quantity * 5 || 10);
                const progressPct = Math.min(100, Math.max(8, Math.round((totalApps / maxApps) * 100)));

                return (
                  <article
                    id={`job-card-${job.jobId}`}
                    key={job.jobId}
                    className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 border ${
                      isHighlighted
                        ? 'bg-sky-50/60 border-sky-500 ring-2 ring-sky-500/30 shadow-lg'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:-translate-y-1'
                    }`}
                  >
                    <div>
                      {isHighlighted && (
                        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-3.5 py-2 text-xs font-bold text-white shadow-sm">
                          <span className="flex items-center gap-1.5">
                            <span>🔔</span> Đang xem tin từ thông báo
                          </span>
                          <button
                            type="button"
                            onClick={() => setHighlightedJobId(null)}
                            className="cursor-pointer border-0 bg-transparent text-white/80 hover:text-white p-0 text-xs font-bold"
                            title="Tắt làm nổi bật"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Header tags */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Tooltip
                            title={
                              job.status === 'PENDING_AGREEMENT' && job.hasSignedAgreement
                                ? 'Đã nộp hợp đồng đã ký kết, đang chờ Internal HR kiểm tra và duyệt tin'
                                : JOB_STATUS[job.status].hint
                            }
                          >
                            <span>
                              <JobStatusTag status={job.status} hasSignedAgreement={job.hasSignedAgreement} />
                            </span>
                          </Tooltip>
                          <ServiceTypeTag code={job.serviceTypeCode} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                          {formatDate(job.updatedAt)}
                        </span>
                      </div>

                      {/* Title */}
                      <button
                        type="button"
                        onClick={() => setDetailJobId(job.jobId)}
                        className={`cursor-pointer rounded border-0 bg-transparent p-0 text-left text-base font-bold leading-snug hover:text-[#0284C7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284C7] transition-colors mb-2.5 line-clamp-2 ${
                          isHighlighted ? 'text-[#0284C7]' : 'text-slate-900'
                        }`}
                      >
                        {job.title || 'Vị trí chưa đặt tên'}
                      </button>

                      {/* Meta highlights */}
                      <div className="space-y-1 mb-3.5">
                        <div className="text-sm font-bold text-slate-800 tracking-tight">
                          {formatSalary(job)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <EnvironmentOutlined aria-hidden className="text-slate-400" />
                          <span className="truncate">{job.location ?? 'Chưa xác định địa điểm'}</span>
                          <span className="text-slate-300">·</span>
                          <span>Cần tuyển {formatHeadcount(job)}</span>
                        </div>
                      </div>

                      {/* Special Callout Banners */}
                      {job.status === 'PENDING_AGREEMENT' &&
                        (job.hasSignedAgreement ? (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/90 p-3 text-xs text-slate-800 mb-3.5 shadow-2xs">
                            <span className="font-semibold text-xs">Đã nộp hợp đồng · Đang chờ duyệt tin</span>
                            <Button
                              type="primary"
                              size="small"
                              className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white rounded-lg shadow-sm font-semibold !text-xs !h-8 whitespace-nowrap ml-2"
                              onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                            >
                              Xem hợp đồng
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/90 p-3 text-xs text-slate-800 mb-3.5 shadow-2xs">
                            <span className="font-semibold text-xs">Hợp đồng dịch vụ sẵn sàng ký kết</span>
                            <Button
                              type="primary"
                              size="small"
                              className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white rounded-lg shadow-sm font-semibold !text-xs !h-8 whitespace-nowrap ml-2"
                              onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                            >
                              Ký hợp đồng
                            </Button>
                          </div>
                        ))}

                      {isAwaitingSourcingDeposit(job) && (
                        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 border border-slate-200/90 p-3 text-xs text-slate-800 mb-3.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">
                              Chờ cọc ({formatMoney(sourcingDepositAmount(job) ?? 200000, 'VND')})
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">Kích hoạt tin khi nhận cọc</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-0 border-t border-solid border-slate-200/60">
                            <Button
                              type="primary"
                              size="small"
                              className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white rounded-lg shadow-sm font-bold !text-xs !h-8"
                              onClick={() =>
                                setPaymentModalJob({
                                   jobId: job.jobId,
                                   title: job.title,
                                   isDeposit: true,
                                   depositAmount: sourcingDepositAmount(job) ?? 200000,
                                })
                              }
                            >
                              Đặt cọc ngay
                            </Button>
                            <Button
                              size="small"
                              className="!text-xs !h-8 border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg font-medium"
                              onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                            >
                              Hợp đồng cọc
                            </Button>
                          </div>
                        </div>
                      )}

                      {job.status === 'PENDING_PAYMENT' && !isAwaitingSourcingDeposit(job) && (
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/90 px-3 py-2 text-xs text-slate-700 mb-3.5">
                          <span className="font-semibold text-xs">Chờ thanh toán phí đăng để công bố tin</span>
                        </div>
                      )}

                      {job.status === 'REJECTED' && job.statusReason && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-800 mb-3.5">
                          <div className="font-bold text-rose-900 mb-0.5">Lý do từ chối:</div>
                          <div className="line-clamp-2 leading-relaxed">{job.statusReason}</div>
                        </div>
                      )}

                      {/* Visual Application Progress Bar */}
                      {job.status === 'ACTIVE' && (
                        <div className="mb-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                          <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-slate-600">
                            <span>Tiến độ nhận CV</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {totalApps} {job.maxApplications ? `/ ${job.maxApplications}` : 'hồ sơ'}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                            <div
                              className="h-full rounded-full bg-[#0284C7] transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-2 flex items-center justify-between gap-2 border-0 border-t border-solid border-slate-100 pt-3">
                      {totalApps > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/client/candidates?job=${job.jobId}`)}
                          className="flex min-h-11 sm:min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-sky-200/70 bg-sky-50 px-3 py-1.5 text-xs font-bold text-[#0284C7] hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284C7] shrink-0 whitespace-nowrap transition-colors"
                        >
                          <TeamOutlined aria-hidden className="text-[#0284C7]" />
                          <span>Xem {totalApps} ứng viên</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium shrink-0 whitespace-nowrap">
                          Chưa có ứng viên
                        </span>
                      )}
                      {renderActions(job)}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Table<Job>
              className="admin-soft-table"
              rowKey="jobId"
              columns={columns}
              dataSource={visibleJobs}
              rowClassName={(record) =>
                record.jobId === highlightedJobId
                  ? '!bg-blue-50/90 !border-l-4 !border-l-blue-600 font-semibold transition-colors duration-300'
                  : ''
              }
              onRow={(record) => ({
                id: `job-card-${record.jobId}`,
              })}
              scroll={{ x: 1080 }}
              pagination={{ itemRender: a11yItemRender, pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
            />
          )}
        </Surface>
      )}

      <Drawer
        open={Boolean(detailJobId)}
        onClose={() => setDetailJobId(undefined)}
        width="min(640px, 100vw)"
        title="Chi tiết tin tuyển dụng"
        destroyOnHidden
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detail.isError ? (
          <Alert type="error" showIcon message={getApiErrorMessage(detail.error)} />
        ) : detail.data ? (
          <JobDetailPanel
            job={detail.data}
            showHistory
            onPaySuccess={() => {
              refetch();
              detail.refetch();
            }}
          />
        ) : null}
      </Drawer>

      <ReasonModal
        open={pending?.kind === 'pause'}
        title="Tạm dừng tuyển dụng"
        description="Tin sẽ ngừng nhận hồ sơ mới cho đến khi bạn mở lại. Hồ sơ đã nhận vẫn được giữ nguyên."
        confirmText="Tạm dừng"
        textRequired={false}
        loading={mutations.pause.isPending}
        onCancel={() => setPending(null)}
        onConfirm={({ reasonText }) =>
          pending &&
          mutations.pause
            .mutateAsync({ jobId: pending.job.jobId, token: pending.job.concurrencyToken, reasonText: reasonText || undefined })
            .then((res) => {
              message.success(res.message);
              setPending(null);
            })
            .catch(notifyError)
        }
      />

      <ReasonModal
        open={pending?.kind === 'close'}
        title="Đóng tin tuyển dụng"
        description="Đóng tin là thao tác không hoàn tác: tin sẽ không nhận hồ sơ nữa và không mở lại được."
        confirmText="Đóng tin"
        danger
        reasonOptions={CLOSE_REASONS}
        textRequired
        loading={mutations.close.isPending}
        onCancel={() => setPending(null)}
        onConfirm={({ reasonCode, reasonText }) =>
          pending &&
          mutations.close
            .mutateAsync({
              jobId: pending.job.jobId,
              token: pending.job.concurrencyToken,
              reasonCode: reasonCode as JobCloseReasonCode,
              reasonText,
            })
            .then((res) => {
              message.success(res.message);
              setPending(null);
            })
            .catch(notifyError)
        }
      />

      <PaymentDemoModal
        visible={Boolean(paymentModalJob)}
        jobId={paymentModalJob?.jobId ?? ''}
        jobTitle={paymentModalJob?.title ?? ''}
        isDeposit={paymentModalJob?.isDeposit}
        depositAmount={paymentModalJob?.depositAmount}
        onClose={() => {
          setPaymentModalJob(null);
          if (searchParams.has('openPayment')) {
            const next = new URLSearchParams(searchParams);
            next.delete('openPayment');
            setSearchParams(next, { replace: true });
          }
        }}
        onPaymentSuccess={() => {
          setPaymentModalJob(null);
          if (searchParams.has('openPayment')) {
            const next = new URLSearchParams(searchParams);
            next.delete('openPayment');
            setSearchParams(next, { replace: true });
          }
          refetch();
        }}
      />
    </div>
  );
};

export default ClientJobsListPage;
