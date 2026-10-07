/**
 * @file ClientJobsListPage.tsx
 * @description MF-01 · Client Company — "Tin tuyển dụng của tôi" backed by GET /jobs/mine.
 * Actions follow the backend state machine: submit (DRAFT/REJECTED), pause (ACTIVE),
 * resume (PAUSED), close (ACTIVE/PAUSED). Every write sends the job's latest concurrencyToken.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Button,
  Drawer,
  Dropdown,
  Empty,
  Segmented,
  Skeleton,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { Job, JobCloseReasonCode, JobStatus } from '@/types/api/jobs';
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

const { Title, Text } = Typography;

type StatusFilter = 'ALL' | JobStatus;
const FILTER_ORDER: JobStatus[] = ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'PAUSED', 'CLOSED'];

type PendingAction = { kind: 'pause' | 'close'; job: Job } | null;

export const ClientJobsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [detailJobId, setDetailJobId] = useState<string>();
  const [pending, setPending] = useState<PendingAction>(null);

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

  const visibleJobs = useMemo(
    () =>
      [...(filter === 'ALL' ? jobs : jobs.filter((j) => j.status === filter))].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [jobs, filter]
  );

  const notifyError = (err: unknown) => message.error(getApiErrorMessage(err));

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

  const columns: ColumnsType<Job> = [
    {
      title: 'Vị trí',
      key: 'title',
      render: (_, job) => (
        <div className="min-w-[220px]">
          <button
            type="button"
            onClick={() => setDetailJobId(job.jobId)}
            className="text-left font-semibold text-slate-900 hover:text-emerald-700 cursor-pointer bg-transparent border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 rounded"
          >
            {job.title || 'Vị trí chưa đặt tên'}
          </button>
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
      render: (_, job) => {
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
      },
    },
  ];

  const segmentOptions = [
    { value: 'ALL', label: `Tất cả (${jobs.length})` },
    ...FILTER_ORDER.map((s) => ({ value: s, label: `${JOB_STATUS[s].label} (${counts[s]})` })),
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title level={3} className="!mb-1">
            Tin tuyển dụng của tôi
          </Title>
          <Text type="secondary">Tạo tin, gửi Internal HR duyệt và quản lý trạng thái tuyển dụng.</Text>
        </div>
        <div className="flex gap-2">
          <Tooltip title="Tải lại">
            <Button icon={<ReloadOutlined />} aria-label="Tải lại danh sách" loading={isFetching && !isLoading} onClick={() => refetch()} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/client/jobs/create')}>
            Đăng tin mới
          </Button>
        </div>
      </header>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách tin tuyển dụng"
          description={getApiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : (
        <section className="rounded-xl border border-solid border-slate-200 bg-white" aria-busy={isLoading}>
          <div className="overflow-x-auto border-b border-solid border-slate-100 p-3">
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as StatusFilter)}
              options={segmentOptions}
              aria-label="Lọc theo trạng thái"
            />
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
          ) : (
            <Table<Job>
              rowKey="jobId"
              columns={columns}
              dataSource={visibleJobs}
              scroll={{ x: 1080 }}
              pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
            />
          )}
        </section>
      )}

      <Drawer
        open={Boolean(detailJobId)}
        onClose={() => setDetailJobId(undefined)}
        width={640}
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
