/**
 * @file JobReviewPage.tsx
 * @description MF-01 · Internal HR — review queue & job management (GET /internal/jobs/review)
 * with status filters (PENDING_REVIEW, ACTIVE, REJECTED, ALL), search, approve, and reject.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Empty,
  Input,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import { PageHero } from '@/features/admin-console/ui';
import '@/features/admin-console/admin-console.css';
import {
  CheckCircleFilled,
  CheckOutlined,
  CloseCircleFilled,
  CloseOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Job, JobRejectReasonCode, JobStatus } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAlertStore } from '@/stores/alertStore';
import { useJobDetail, useJobMutations, useJobReviewQueue } from './useJobQueries';
import { JobDetailPanel } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import { JOB_STATUS, REJECT_REASONS, SERVICE_TYPE_LABEL, formatDateTime } from './jobDisplay';

const { Text } = Typography;

const waitingSince = (job: Job) => job.updatedAt;

type StatusFilter = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Chờ duyệt', value: 'PENDING_REVIEW' },
  { label: 'Đang tuyển', value: 'ACTIVE' },
  { label: 'Bị từ chối', value: 'REJECTED' },
  { label: 'Tất cả tin', value: 'ALL' },
];

const QueueItem: React.FC<{ job: Job; selected: boolean; onSelect: () => void }> = ({ job, selected, onSelect }) => {
  const statusMeta = JOB_STATUS[job.status as JobStatus] ?? { label: job.status, color: 'default' };

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`w-full cursor-pointer rounded-lg border border-solid p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
          selected
            ? 'border-blue-500 bg-blue-50/70 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="font-semibold text-slate-900 line-clamp-2 leading-tight">
            {job.title || 'Vị trí chưa đặt tên'}
          </div>
          <Tag color={statusMeta.color} className="m-0 shrink-0 text-[10px] font-medium leading-4">
            {statusMeta.label}
          </Tag>
        </div>

        <div className="mt-1 text-xs text-slate-600 line-clamp-1">
          {job.companyName ?? '—'}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {job.serviceTypeCode && (
            <Tag className="m-0 text-[11px] bg-slate-100 text-slate-700 border-slate-200">
              {SERVICE_TYPE_LABEL[job.serviceTypeCode]?.label ?? job.serviceTypeCode}
            </Tag>
          )}
          <Text type="secondary" className="text-[11px]">
            Cập nhật: {formatDateTime(waitingSince(job))}
          </Text>
        </div>

        {job.status === 'REJECTED' && job.statusReason && (
          <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700 border border-solid border-rose-200 line-clamp-2">
            <span className="font-semibold">Lý do: </span>
            {job.statusReason}
          </div>
        )}
      </button>
    </li>
  );
};

export const JobReviewPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Đọc trạng thái từ query param nếu có
  const initialStatus = (searchParams.get('status') as StatusFilter) || 'PENDING_REVIEW';
  const highlightParam = searchParams.get('highlight') || searchParams.get('jobId');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>();
  const [rejectOpen, setRejectOpen] = useState(false);

  // Hook lấy danh sách theo trạng thái filter
  const queue = useJobReviewQueue(statusFilter);
  const detail = useJobDetail(selectedId);
  const { approve, reject } = useJobMutations();

  // Sắp xếp bài mới nhất lên trên & lọc theo từ khóa tìm kiếm
  const jobs = useMemo(() => {
    let list = [...(queue.data ?? [])];
    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.title?.toLowerCase().includes(q) ||
          j.companyName?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(waitingSince(b)).getTime() - new Date(waitingSince(a)).getTime());
  }, [queue.data, searchKeyword]);

  // Tự động chọn item hợp lệ khi danh sách tải xong hoặc khi có highlightParam
  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (highlightParam) {
      const target = jobs.find(
        (j) =>
          j.jobId === highlightParam ||
          j.title?.toLowerCase().includes(highlightParam.toLowerCase())
      );
      if (target) {
        setSelectedId(target.jobId);
        return;
      }
    }

    if (!selectedId || !jobs.some((j) => j.jobId === selectedId)) {
      setSelectedId(jobs[0].jobId);
    }
  }, [jobs, selectedId, highlightParam]);

  const job = detail.data;
  const busy = approve.isPending || reject.isPending;

  const confirmApprove = () =>
    job &&
    modal.confirm({
      title: 'Duyệt và công bố tin này?',
      content: `"${job.title}" sẽ chuyển sang trạng thái Đang tuyển và hiển thị theo phạm vi doanh nghiệp đã chọn.`,
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

  const handleStatusChange = (val: StatusFilter) => {
    setStatusFilter(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('status', val);
      return next;
    });
  };

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Duyệt & Quản lý tin tuyển dụng"
        description="Kiểm tra, phê duyệt và theo dõi trạng thái các tin tuyển dụng của doanh nghiệp trên toàn hệ thống."
        actions={
          <Button size="large" icon={<ReloadOutlined />} loading={queue.isFetching && !queue.isLoading} onClick={() => queue.refetch()}>
            Tải lại
          </Button>
        }
      />

      {/* ── Bộ lọc trạng thái & Tìm kiếm ── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-solid border-slate-200 shadow-xs">
        <Segmented
          options={STATUS_TABS}
          value={statusFilter}
          onChange={(val) => handleStatusChange(val as StatusFilter)}
          className="font-medium p-1 bg-slate-100"
          size="middle"
        />

        <div className="w-full sm:w-72">
          <Input
            placeholder="Tìm theo vị trí, công ty..."
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
      </div>

      {queue.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách tin tuyển dụng"
          description={getApiErrorMessage(queue.error)}
          action={<Button onClick={() => queue.refetch()}>Thử lại</Button>}
        />
      ) : queue.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── Cột danh sách bên trái ── */}
          <aside className="admin-surface p-2.5" aria-label="Danh sách tin tuyển dụng">
            <div className="flex items-center justify-between px-2 py-1.5 border-0 border-b border-solid border-slate-100 mb-2">
              <Text strong className="text-sm text-slate-700">
                {STATUS_TABS.find((t) => t.value === statusFilter)?.label}
              </Text>
              <Badge count={jobs.length} color="#0f172a" overflowCount={999} />
            </div>

            {jobs.length === 0 ? (
              <div className="py-12 text-center">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    searchKeyword
                      ? 'Không tìm thấy tin nào khớp từ khóa.'
                      : statusFilter === 'PENDING_REVIEW'
                      ? 'Không có tin nào đang chờ duyệt.'
                      : 'Không có tin tuyển dụng nào trong mục này.'
                  }
                />
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto pr-1">
                {jobs.map((j) => (
                  <QueueItem
                    key={j.jobId}
                    job={j}
                    selected={j.jobId === selectedId}
                    onSelect={() => setSelectedId(j.jobId)}
                  />
                ))}
              </ul>
            )}
          </aside>

          {/* ── Cột chi tiết bên phải ── */}
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
                {/* ── Action bar theo trạng thái của Job ── */}
                {job.status === 'PENDING_REVIEW' ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-0 border-b border-solid border-amber-200 bg-amber-50/70 px-6 py-3.5 backdrop-blur">
                    <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
                      <ExclamationCircleOutlined className="text-amber-600 text-base" />
                      <span>Tin đang chờ duyệt. Kiểm tra kỹ mô tả, yêu cầu và quyền lợi trước khi công bố.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button danger icon={<CloseOutlined />} disabled={busy} onClick={() => setRejectOpen(true)}>
                        Từ chối
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={approve.isPending}
                        disabled={reject.isPending}
                        onClick={confirmApprove}
                      >
                        Duyệt và công bố
                      </Button>
                    </div>
                  </div>
                ) : job.status === 'ACTIVE' ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-0 border-b border-solid border-emerald-200 bg-emerald-50/80 px-6 py-3.5">
                    <div className="flex items-center gap-2 text-emerald-900 text-sm font-medium">
                      <CheckCircleFilled className="text-emerald-600 text-base" />
                      <span>Tin tuyển dụng đã được duyệt và đang hoạt động công khai trên hệ thống.</span>
                    </div>
                    <Tag color="success" className="m-0 font-semibold px-2.5 py-0.5">
                      Đang tuyển (ACTIVE)
                    </Tag>
                  </div>
                ) : job.status === 'REJECTED' ? (
                  <div className="flex flex-col gap-2 rounded-t-2xl border-0 border-b border-solid border-rose-200 bg-rose-50/90 px-6 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-rose-900 text-sm font-semibold">
                        <CloseCircleFilled className="text-rose-600 text-base" />
                        <span>Tin tuyển dụng này đã bị từ chối duyệt</span>
                      </div>
                      <Tag color="error" className="m-0 font-semibold px-2.5 py-0.5">
                        Đã từ chối (REJECTED)
                      </Tag>
                    </div>
                    {job.statusReason && (
                      <div className="text-xs text-rose-800 bg-white/80 rounded-lg p-2.5 border border-solid border-rose-200">
                        <span className="font-semibold text-rose-900">Lý do từ chối gửi doanh nghiệp: </span>
                        {job.statusReason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-0 border-b border-solid border-slate-200 bg-slate-50 px-6 py-3.5">
                    <Text className="text-sm text-slate-700">
                      Trạng thái hiện tại: <span className="font-semibold">{JOB_STATUS[job.status as JobStatus]?.label ?? job.status}</span>
                    </Text>
                    <Tag className="m-0 font-semibold">{job.status}</Tag>
                  </div>
                )}

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
