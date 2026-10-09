/**
 * @file JobReviewPage.tsx
 * @description MF-01 · Internal HR — review queue (GET /internal/jobs/review) with approve
 * (PENDING_REVIEW → ACTIVE) and reject (→ REJECTED, reason code + text required).
 * Oldest submissions first so nothing waits forever.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App as AntApp, Badge, Button, Empty, Skeleton, Tag, Typography } from 'antd';
import { PageHero } from '@/features/admin-console/ui';
import '@/features/admin-console/admin-console.css';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Job, JobRejectReasonCode } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAlertStore } from '@/stores/alertStore';
import { useJobDetail, useJobMutations, useJobReviewQueue } from './useJobQueries';
import { JobDetailPanel } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import { REJECT_REASONS, SERVICE_TYPE_LABEL, formatDateTime } from './jobDisplay';

const { Text } = Typography;

const waitingSince = (job: Job) => job.updatedAt;

const QueueItem: React.FC<{ job: Job; selected: boolean; onSelect: () => void }> = ({ job, selected, onSelect }) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`w-full cursor-pointer rounded-lg border border-solid px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
        selected
          ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)]'
          : 'border-transparent bg-white hover:border-slate-300'
      }`}
    >
      <div className="font-semibold text-slate-900 line-clamp-2">{job.title || 'Vị trí chưa đặt tên'}</div>
      <div className="mt-0.5 text-xs text-slate-600">{job.companyName ?? '—'}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {job.serviceTypeCode && <Tag className="m-0 text-[11px]">{SERVICE_TYPE_LABEL[job.serviceTypeCode].label}</Tag>}
        <Text type="secondary" className="text-[11px]">
          Gửi lúc {formatDateTime(waitingSince(job))}
        </Text>
      </div>
    </button>
  </li>
);

export const JobReviewPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queue = useJobReviewQueue();
  const [selectedId, setSelectedId] = useState<string>();
  const [rejectOpen, setRejectOpen] = useState(false);
  const detail = useJobDetail(selectedId);
  const { approve, reject } = useJobMutations();

  // Hiển thị công việc mới gửi nhất lên trên cùng của danh sách chờ duyệt
  const jobs = useMemo(
    () => [...(queue.data ?? [])].sort((a, b) => new Date(waitingSince(b)).getTime() - new Date(waitingSince(a)).getTime()),
    [queue.data]
  );

  // Keep a valid selection: first item by default, next item after a decision.
  useEffect(() => {
    if (jobs.length === 0) setSelectedId(undefined);
    else if (!selectedId || !jobs.some((j) => j.jobId === selectedId)) setSelectedId(jobs[0].jobId);
  }, [jobs, selectedId]);

  const job = detail.data;
  const busy = approve.isPending || reject.isPending;

  const confirmApprove = () =>
    job &&
    modal.confirm({
      title: 'Duyệt và công bố tin này?',
      content: `"${job.title}" sẽ chuyển sang Đang tuyển và hiển thị theo phạm vi doanh nghiệp đã chọn.`,
      okText: 'Duyệt và công bố',
      cancelText: 'Hủy',
      onOk: () =>
        approve
          .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
          .then((res) => {
            message.success(res.message);
            useAlertStore.getState().addAlert({
              type: 'success',
              title: 'Tin tuyển dụng đã được duyệt',
              message: `Tin tuyển dụng "${job.title}" đã được Internal HR phê duyệt và công bố công khai.`,
              actionLabel: 'Xem tin tuyển dụng',
              actionRoute: `/client/jobs?highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
            });
          })
          .catch((err) => message.error(getApiErrorMessage(err))),
    });

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Duyệt tin tuyển dụng"
        description="Kiểm tra mô tả và yêu cầu trước khi tin được công bố. Tin gửi mới nhất ở đầu danh sách."
        actions={
          <Button size="large" icon={<ReloadOutlined />} loading={queue.isFetching && !queue.isLoading} onClick={() => queue.refetch()}>
            Tải lại
          </Button>
        }
      />

      {queue.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được hàng đợi duyệt"
          description={getApiErrorMessage(queue.error)}
          action={<Button onClick={() => queue.refetch()}>Thử lại</Button>}
        />
      ) : queue.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : jobs.length === 0 ? (
        <div className="admin-surface py-16">
          <Empty description="Không có tin nào đang chờ duyệt." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="admin-surface p-2" aria-label="Hàng đợi duyệt">
            <div className="flex items-center justify-between px-2 py-1.5">
              <Text strong>Chờ duyệt</Text>
              <Badge count={jobs.length} color="#0f172a" />
            </div>
            <ul className="m-0 list-none space-y-1.5 p-0 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
              {jobs.map((j) => (
                <QueueItem key={j.jobId} job={j} selected={j.jobId === selectedId} onSelect={() => setSelectedId(j.jobId)} />
              ))}
            </ul>
          </aside>

          <section className="admin-surface" aria-live="polite" aria-busy={detail.isFetching}>
            {detail.isError ? (
              <div className="p-6">
                <Alert type="error" showIcon message={getApiErrorMessage(detail.error)} />
              </div>
            ) : detail.isLoading || !job ? (
              <div className="p-6">
                <Skeleton active paragraph={{ rows: 12 }} />
              </div>
            ) : (
              <>
                {/* Actions first, so the reviewer can decide without scrolling. */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-0 border-b border-solid border-slate-100 bg-white/95 px-6 py-3 backdrop-blur">
                  <Text className="text-sm text-slate-600">
                    Kiểm tra mô tả, yêu cầu và quyền lợi rồi quyết định.
                  </Text>
                  <div className="flex gap-2">
                    <Button danger icon={<CloseOutlined />} disabled={busy} onClick={() => setRejectOpen(true)}>
                      Từ chối
                    </Button>
                    <Button type="primary" icon={<CheckOutlined />} loading={approve.isPending} disabled={reject.isPending} onClick={confirmApprove}>
                      Duyệt và công bố
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  <JobDetailPanel job={job} showHistory />
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <ReasonModal
        open={rejectOpen}
        title="Từ chối tin tuyển dụng"
        description="Doanh nghiệp sẽ thấy lý do này, sửa tin rồi gửi duyệt lại. Hãy nói rõ cần bổ sung gì."
        confirmText="Từ chối"
        danger
        reasonOptions={REJECT_REASONS}
        textRequired
        loading={reject.isPending}
        onCancel={() => setRejectOpen(false)}
        onConfirm={({ reasonCode, reasonText }) =>
          job &&
          reject
            .mutateAsync({
              jobId: job.jobId,
              token: job.concurrencyToken,
              reasonCode: reasonCode as JobRejectReasonCode,
              reasonText,
            })
            .then((res) => {
              message.success(res.message);
              useAlertStore.getState().addAlert({
                type: 'error',
                title: 'Tin tuyển dụng bị từ chối duyệt',
                message: `Tin tuyển dụng "${job.title}" đã bị từ chối: ${reasonText || 'Vui lòng kiểm tra lại yêu cầu'}.`,
                actionLabel: 'Xem tin tuyển dụng',
                actionRoute: `/client/jobs?highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
              });
              setRejectOpen(false);
            })
            .catch((err) => message.error(getApiErrorMessage(err)))
        }
      />
    </div>
  );
};

export default JobReviewPage;
