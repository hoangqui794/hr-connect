/**
 * @file ClientJobsListPage.tsx
 * @description MF-01 · Client Company — "Tin tuyển dụng của tôi" backed by GET /jobs/mine.
 * Actions follow the backend state machine: submit (DRAFT/REJECTED), pause (ACTIVE),
 * resume (PAUSED), close (ACTIVE/PAUSED). Every write sends the job's latest concurrencyToken.
 */
import React, { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
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
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { Job, JobCloseReasonCode, JobStatus } from '@/types/api/jobs';
import { FilterPills, PageHero, Surface } from '@/features/admin-console/ui';
import { screeningApi } from '@/services/api/hrApi';
import '@/features/admin-console/admin-console.css';
import { getApiErrorMessage } from '@/services/apiClient';
import { useJobDetail, useJobMutations, useMyJobs } from './useJobQueries';
import { JobDetailPanel, JobStatusTag } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import {
  CLOSE_REASONS,
  JOB_STATUS,
  SERVICE_TYPE_LABEL,
  clientActions,
  formatDate,
  formatSalary,
} from './jobDisplay';


type StatusFilter = 'ALL' | JobStatus;
const FILTER_ORDER: JobStatus[] = ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'PAUSED', 'CLOSED'];

type PendingAction = { kind: 'pause' | 'close'; job: Job } | null;

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
  const setFilter = (v: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'ALL') next.delete('status');
    else next.set('status', v);
    setSearchParams(next, { replace: true });
  };
  const [detailJobId, setDetailJobId] = useState<string>();
  const [pending, setPending] = useState<PendingAction>(null);

  const highlightParam = searchParams.get('highlight') || searchParams.get('jobId');
  const openDetailParam = searchParams.get('openDetail') === 'true';
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

  // Tự động tìm kiếm, làm nổi bật và cuộn tới bài viết khi người dùng nhấn từ thông báo
  React.useEffect(() => {
    if (!highlightParam || jobs.length === 0) return;

    const query = highlightParam.trim().toLowerCase();
    const matchedJob = jobs.find(
      (j) => j.jobId.toLowerCase() === query || j.title.toLowerCase().includes(query)
    );

    if (matchedJob) {
      setHighlightedJobId(matchedJob.jobId);

      // Nếu bộ lọc hiện tại đang ẩn bài này, tự động chuyển về ALL hoặc trạng thái của bài
      if (filter !== 'ALL' && matchedJob.status !== filter) {
        setFilter(matchedJob.status);
      }

      if (openDetailParam) {
        setDetailJobId(matchedJob.jobId);
      }

      // Cuộn mượt đến thẻ bài viết sau khi render
      const timer = setTimeout(() => {
        const el = document.getElementById(`job-card-${matchedJob.jobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [highlightParam, jobs]);

  const visibleJobs = useMemo(
    () =>
      [...(filter === 'ALL' ? jobs : jobs.filter((j) => j.status === filter))].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [jobs, filter]
  );

  const notifyError = (err: unknown) => message.error(getApiErrorMessage(err));

  // Application count per published job (jobs never published cannot have applications).
  const countable = visibleJobs.filter((j) => j.status === 'ACTIVE' || j.status === 'PAUSED' || j.status === 'CLOSED');
  const countQueries = useQueries({
    queries: countable.map((j) => ({
      queryKey: ['client-candidates', 'job-count', j.jobId],
      queryFn: async () => (await screeningApi.list({ jobId: j.jobId, page: 1, pageSize: 1 })).total,
      staleTime: 60_000,
    })),
  });
  const applicationsOf = (jobId: string) => {
    const i = countable.findIndex((j) => j.jobId === jobId);
    return i < 0 ? undefined : countQueries[i];
  };

  const confirmSubmit = (job: Job) =>
    modal.confirm({
      title: 'Gửi tin tuyển dụng đi duyệt?',
      content:
        'Internal HR sẽ xét duyệt trước khi tin được hiển thị. Trong lúc chờ duyệt bạn không sửa được tin. Tin cần ít nhất một yêu cầu bắt buộc.',
      okText: 'Gửi duyệt',
      cancelText: 'Để sau',
      onOk: () =>
        mutations.submit
          .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
          .then((res) => message.success(res.message))
          .catch(notifyError),
    });

  const resume = (job: Job) =>
    mutations.resume
      .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
      .then((res) => message.success(res.message))
      .catch(notifyError);

  const renderActions = (job: Job) => {
        const can = clientActions(job.status);
        const busy =
          (mutations.submit.isPending && mutations.submit.variables?.jobId === job.jobId) ||
          (mutations.resume.isPending && mutations.resume.variables?.jobId === job.jobId);
        const more = [
          { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
          ...(can.canPause ? [{ key: 'pause', label: 'Tạm dừng tuyển' }] : []),
          ...(can.canResume ? [{ key: 'resume', label: 'Mở lại tuyển' }] : []),
          ...(can.canClose ? [{ key: 'close', label: 'Đóng tin', danger: true }] : []),
        ];
        return (
          <div className="flex items-center justify-end gap-1">
            {can.canSubmit && (
              <Button size="small" type="primary" icon={<SendOutlined />} loading={busy} onClick={() => confirmSubmit(job)}>
                Gửi duyệt
              </Button>
            )}
            {can.canEdit && (
              <Tooltip title="Sửa tin">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={`Sửa tin ${job.title}`}
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
                  if (key === 'resume') resume(job);
                  if (key === 'pause' || key === 'close') setPending({ kind: key, job });
                },
              }}
            >
              <Button size="small" icon={<MoreOutlined />} aria-label={`Thao tác khác cho ${job.title}`} loading={busy && !can.canSubmit} />
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
          <div className="text-xs text-slate-500 mt-0.5">
            {job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode].label : '—'} · {job.location ?? 'Chưa có địa điểm'}
          </div>
          {job.status === 'REJECTED' && job.statusReason && (
            <div className="text-xs text-red-700 mt-1 line-clamp-2">Lý do từ chối: {job.statusReason}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (status: JobStatus) => (
        <Tooltip title={JOB_STATUS[status].hint}>
          <span>
            <JobStatusTag status={status} />
          </span>
        </Tooltip>
      ),
    },
    { title: 'Mức lương', key: 'salary', width: 220, render: (_, job) => formatSalary(job) },
    { title: <span className="whitespace-nowrap">Số lượng</span>, dataIndex: 'quantity', width: 110, align: 'right' },
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
    <div>
      <PageHero
        eyebrow="Tuyển dụng"
        title="Tin tuyển dụng của tôi"
        description="Tạo tin, gửi HR Connect duyệt và quản lý trạng thái tuyển dụng."
        actions={
          <>
            <Tooltip title="Tải lại">
              <Button size="large" icon={<ReloadOutlined />} aria-label="Tải lại danh sách" loading={isFetching && !isLoading} onClick={() => refetch()} />
            </Tooltip>
            <Button size="large" type="primary" icon={<PlusOutlined />} className="client-cta" onClick={() => navigate('/client/jobs/create')}>
              Đăng tin mới
            </Button>
          </>
        }
      />

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
                      className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                        view === v ? 'bg-white text-[color:var(--console-accent-strong)] shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'
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
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-5 pt-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleJobs.map((job) => {
                const count = applicationsOf(job.jobId);
                const isHighlighted = highlightedJobId === job.jobId;
                return (
                  <article
                    id={`job-card-${job.jobId}`}
                    key={job.jobId}
                    className={`client-soft-card relative flex flex-col gap-3 rounded-[18px] p-5 transition-all duration-500 ${
                      isHighlighted
                        ? 'bg-gradient-to-b from-blue-50/95 via-sky-50/50 to-white ring-4 ring-blue-500/80 border-2 border-solid border-blue-500 shadow-xl shadow-blue-500/25 scale-[1.02]'
                        : 'bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)]'
                    }`}
                  >
                    {isHighlighted && (
                      <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                        <span className="flex items-center gap-1.5 animate-pulse">
                          <span>🔔</span> Đang xem tin từ thông báo
                        </span>
                        <button
                          type="button"
                          onClick={() => setHighlightedJobId(null)}
                          className="cursor-pointer border-0 bg-transparent text-white/80 hover:text-white p-0 text-xs"
                          title="Tắt làm nổi bật"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <Tooltip title={JOB_STATUS[job.status].hint}>
                        <span>
                          <JobStatusTag status={job.status} />
                        </span>
                      </Tooltip>
                      <span className="text-xs text-slate-500">{formatDate(job.updatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailJobId(job.jobId)}
                      className={`cursor-pointer rounded border-0 bg-transparent p-0 text-left text-[16px] leading-snug hover:text-[color:var(--console-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                        isHighlighted ? 'font-bold text-blue-900' : 'font-semibold text-slate-900'
                      }`}
                    >
                      {job.title || 'Vị trí chưa đặt tên'}
                    </button>
                    <div className="space-y-1 text-[13px] text-slate-600">
                      <div className="font-semibold text-[color:var(--console-accent-strong)]">{formatSalary(job)}</div>
                      <div className="flex items-center gap-1.5">
                        <EnvironmentOutlined aria-hidden /> {job.location ?? 'Chưa có địa điểm'}
                      </div>
                      <div>{job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode].label : '—'}</div>
                    </div>
                    {job.status === 'REJECTED' && job.statusReason && (
                      <div className="line-clamp-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">Lý do từ chối: {job.statusReason}</div>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 border-0 border-t border-solid border-slate-100 pt-3">
                      {count ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/client/candidates?job=${job.jobId}`)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[color:var(--console-accent-soft)] px-3 py-1 text-[13px] font-medium text-[color:var(--console-accent-strong)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                        >
                          <TeamOutlined aria-hidden />
                          <span className="tabular-nums">{count.isLoading ? '…' : count.data ?? 0}</span> hồ sơ
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Cần {job.quantity} người</span>
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
              pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
            />
          )}
        </Surface>
      )}

      <Drawer
        open={Boolean(detailJobId)}
        onClose={() => setDetailJobId(undefined)}
        width="min(640px, 100vw)"
        title="Chi tiết tin tuyển dụng"
        destroyOnClose
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detail.isError ? (
          <Alert type="error" showIcon message={getApiErrorMessage(detail.error)} />
        ) : detail.data ? (
          <JobDetailPanel job={detail.data} showHistory />
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
    </div>
  );
};

export default ClientJobsListPage;
