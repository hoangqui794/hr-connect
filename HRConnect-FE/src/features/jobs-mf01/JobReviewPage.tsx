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
  Modal,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import { PageHero } from '@/features/admin-console/ui';
import '@/features/admin-console/admin-console.css';
import {
  AuditOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloseOutlined,
  CreditCardOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ApproveJobInput, Job, JobRejectReasonCode, JobStatus } from '@/types/api/jobs';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAlertStore } from '@/stores/alertStore';
import { formatMoney, useJobDetail, useJobFeeInfo, useJobMutations, useJobReviewQueue } from './useJobQueries';
import { JobDetailPanel, JobTemplateOriginTag } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import { CommercialTermsApprovalModal } from './CommercialTermsApprovalModal';
import {
  JOB_STATUS,
  REJECT_REASONS,
  SERVICE_TYPE_LABEL,
  formatDateTime,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
} from './jobDisplay';

const { Text } = Typography;

const waitingSince = (job: Job) => job.updatedAt;

type StatusFilter = 'PENDING_REVIEW' | 'PENDING_PAYMENT' | 'ACTIVE' | 'REJECTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Chờ duyệt', value: 'PENDING_REVIEW' },
  { label: 'Chờ thanh toán', value: 'PENDING_PAYMENT' },
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
        className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
          selected
            ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-2xs'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`font-semibold text-sm line-clamp-2 leading-snug ${selected ? 'text-blue-900' : 'text-slate-800'}`}>
            {job.title || 'Vị trí chưa đặt tên'}
          </div>
          <Tag color={statusMeta.color} className="m-0 shrink-0 text-[11px] font-medium leading-4 rounded-md">
            {statusMeta.label}
          </Tag>
        </div>

        <div className="mt-1 text-xs text-slate-500 line-clamp-1">
          {job.companyName ?? '—'}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {job.serviceTypeCode && (
            <Tag className="m-0 text-[11px] bg-slate-100 text-slate-600 border-slate-200/80 rounded font-normal">
              {SERVICE_TYPE_LABEL[job.serviceTypeCode]?.label ?? job.serviceTypeCode}
            </Tag>
          )}
          {job.templateId && (
            <Tag color="cyan" className="m-0 text-[11px] font-medium rounded">
              Có mẫu JD
            </Tag>
          )}
          {job.status === 'PENDING_PAYMENT' && (
            <Tag color="warning" className="m-0 text-[10px] font-medium rounded">
              {isAwaitingSourcingDeposit(job) ? 'Chờ đặt cọc' : 'Chờ nộp phí'}
            </Tag>
          )}
          <span className="text-[11px] text-slate-400 ml-auto">
            {formatDateTime(waitingSince(job))}
          </span>
        </div>

        {job.status === 'REJECTED' && job.statusReason && (
          <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 border border-solid border-rose-200/80 line-clamp-2">
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
  const [termsOpen, setTermsOpen] = useState(false);

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

  // Fee and package come from the backend (posting fee record, else the chosen package price).
  const feeInfo = useJobFeeInfo(job);
  const feeText = formatMoney(feeInfo.amount, feeInfo.currencyCode);
  const packageLabel = feeInfo.packageName ?? 'Gói đăng tin';
  const isStandardUnpaid = Boolean(
    job &&
      job.serviceTypeCode === 'CV_APPLICATION' &&
      (feeInfo.amount ?? 0) > 0 &&
      (!job.postingFeeStatus || job.postingFeeStatus === 'PENDING')
  );

  const needsTerms = job?.serviceTypeCode === 'HEADHUNT_COD' || job?.serviceTypeCode === 'CV_SOURCING';

  /** F2: approve with the commercial terms Internal HR agreed (HEADHUNT_COD, CV_SOURCING). */
  const approveWithTerms = (input: ApproveJobInput) => {
    if (!job) return Promise.resolve();
    return approve.mutateAsync({ jobId: job.jobId, token: job.concurrencyToken, input }).then((res) => {
      message.success(res.message);
      setTermsOpen(false);
      const isHeadhunt = job.serviceTypeCode === 'HEADHUNT_COD';
      useAlertStore.getState().addAlert({
        targetRole: 'INTERNAL_HR',
        type: 'success',
        title: isHeadhunt ? 'Đã duyệt yêu cầu tuyển Headhunt' : 'Đã duyệt job CV Sourcing',
        message: `Đã chốt điều khoản và duyệt "${job.title}" của ${job.companyName}.`,
        actionLabel: 'Xem chi tiết',
        actionRoute: `/internal/jobs/review?status=ALL&highlight=${encodeURIComponent(job.jobId)}`,
        relatedEntityId: job.jobId,
      });
      useAlertStore.getState().addAlert({
        targetRole: 'CLIENT',
        type: 'success',
        title: 'Yêu cầu tuyển dụng đã được duyệt',
        message: `Yêu cầu "${job.title}" đã được duyệt với điều khoản đã chốt. Xem chi tiết điều khoản trong tin tuyển dụng.`,
        actionLabel: 'Xem điều khoản',
        actionRoute: `/client/jobs?highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
        relatedEntityId: job.jobId,
      });
    });
  };

  const confirmApprove = () => {
    if (!job) return;

    if (needsTerms) {
      setTermsOpen(true);
    } else if (isStandardUnpaid) {
      modal.confirm({
        title: 'Duyệt nội dung & Tạo yêu cầu thanh toán?',
        icon: <FileDoneOutlined className="text-indigo-600 text-xl" />,
        width: 500,
        content: (
          <div className="py-2 space-y-3 text-xs leading-relaxed text-slate-700">
            <div className="rounded-xl bg-slate-50 p-3 border border-solid border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 text-sm">{job.title}</div>
              <div className="text-slate-600">{job.companyName ?? '—'}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Tag color="blue" className="m-0 font-medium">{packageLabel}</Tag>
                <Tag color="cyan" className="m-0 font-medium">{feeText}</Tag>
                {feeInfo.maxApplications ? (
                  <Tag color="purple" className="m-0 font-medium">Tối đa {feeInfo.maxApplications} hồ sơ</Tag>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-solid border-slate-200 text-slate-700 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <InfoCircleOutlined className="text-blue-500" /> Lưu ý quy trình kích hoạt:
              </div>
              <ul className="m-0 pl-4 space-y-1 text-[12px] text-slate-600">
                <li>Nội dung tin đã đạt tiêu chuẩn kiểm duyệt.</li>
                <li>Hệ thống tạo yêu cầu thanh toán <strong>{feeText}</strong> và gửi thông báo tới Doanh nghiệp.</li>
                <li>Tin sẽ tự động kích hoạt công khai ngay khi Doanh nghiệp thanh toán.</li>
              </ul>
            </div>
          </div>
        ),
        okText: 'Duyệt & Gửi yêu cầu thanh toán',
        okButtonProps: { className: '!bg-indigo-600 hover:!bg-indigo-500 font-semibold' },
        cancelText: 'Hủy bỏ',
        onOk: () =>
          approve
            .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
            .then((res) => {
              message.success(res.message);

              // 1. Thông báo cho Internal HR
              useAlertStore.getState().addAlert({
                targetRole: 'INTERNAL_HR',
                type: 'info',
                title: 'Đã duyệt nội dung & tạo đơn thanh toán',
                message: `Tin "${job.title}" của ${job.companyName} đã duyệt thành công. Đang chờ Doanh nghiệp thanh toán ${feeText}.`,
                actionLabel: 'Xem tin',
                actionRoute: `/internal/jobs/review?status=PENDING_PAYMENT&highlight=${encodeURIComponent(job.jobId)}`,
                relatedEntityId: job.jobId,
              });

              // 2. Thông báo trực tiếp cho Client (kèm link mở thẳng popup thanh toán)
              useAlertStore.getState().addAlert({
                targetRole: 'CLIENT',
                type: 'warning',
                title: 'Yêu cầu thanh toán phí đăng tin',
                message: `Tin tuyển dụng "${job.title}" đã được duyệt nội dung! Vui lòng hoàn tất thanh toán ${feeText} để kích hoạt và công khai tin.`,
                actionLabel: 'Thanh toán ngay',
                actionRoute: `/client/jobs?status=PENDING_PAYMENT&highlight=${encodeURIComponent(job.jobId)}&openPayment=true`,
                relatedEntityId: job.jobId,
              });
            })
            .catch((err) => message.error(getApiErrorMessage(err))),
      });
    } else {
      modal.confirm({
        title: 'Duyệt và công bố tin này?',
        content: `"${job.title}" sẽ chuyển sang trạng thái Đang tuyển (ACTIVE) và hiển thị công khai trên hệ thống.`,
        okText: 'Duyệt và công bố',
        cancelText: 'Hủy',
        onOk: () =>
          approve
            .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
            .then((res) => {
              message.success(res.message);

              // 1. Thông báo cho Internal HR
              useAlertStore.getState().addAlert({
                targetRole: 'INTERNAL_HR',
                type: 'success',
                title: 'Tin tuyển dụng đã được duyệt',
                message: `Tin tuyển dụng "${job.title}" đã được Internal HR phê duyệt và công bố công khai.`,
                actionLabel: 'Xem tin tuyển dụng',
                actionRoute: `/internal/jobs/review?status=ACTIVE&highlight=${encodeURIComponent(job.jobId)}`,
                relatedEntityId: job.jobId,
              });

              // 2. Thông báo cho Client
              useAlertStore.getState().addAlert({
                targetRole: 'CLIENT',
                type: 'success',
                title: 'Tin tuyển dụng đã được công khai',
                message: `Tin "${job.title}" đã được duyệt và chính thức hiển thị công khai để nhận hồ sơ ứng viên.`,
                actionLabel: 'Xem tin tuyển dụng',
                actionRoute: `/client/jobs?status=ACTIVE&highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
                relatedEntityId: job.jobId,
              });
            })
            .catch((err) => message.error(getApiErrorMessage(err))),
      });
    }
  };

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
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
          {/* ── Cột danh sách bên trái ── */}
          <aside className="admin-surface p-3" aria-label="Danh sách tin tuyển dụng">
            <div className="flex items-center justify-between px-1.5 py-1.5 border-0 border-b border-solid border-slate-100 mb-2.5">
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
                      : statusFilter === 'PENDING_PAYMENT'
                      ? 'Không có tin nào đang chờ thanh toán.'
                      : 'Không có tin tuyển dụng nào trong mục này.'
                  }
                />
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2.5 p-0">
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
                  <div className="flex flex-col gap-3 rounded-t-2xl border-0 border-b border-solid border-slate-200 bg-slate-50/70 px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 border border-solid border-amber-200/60">
                          <AuditOutlined className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              Duyệt nội dung tin tuyển dụng
                            </span>
                            {isStandardUnpaid ? (
                              <Tag color="blue" className="m-0 font-medium text-xs">
                                {packageLabel} · {feeText}
                              </Tag>
                            ) : (
                              <Tag color="gold" className="m-0 font-medium text-xs">
                                Cần phê duyệt
                              </Tag>
                            )}
                            {job.templateId && <JobTemplateOriginTag templateId={job.templateId} />}
                          </div>
                          <p className="text-xs text-slate-500 m-0 leading-relaxed max-w-2xl">
                            {isStandardUnpaid
                              ? 'Kiểm tra thông tin mô tả và yêu cầu ứng tuyển. Sau khi duyệt, hệ thống sẽ gửi thông báo yêu cầu thanh toán để doanh nghiệp kích hoạt tin công khai.'
                              : 'Kiểm tra thông tin mô tả và yêu cầu tuyển dụng trước khi công bố tin công khai trên hệ thống.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <Button danger icon={<CloseOutlined />} disabled={busy} onClick={() => setRejectOpen(true)}>
                          Từ chối tin
                        </Button>
                        <Button
                          type="primary"
                          className={
                            isStandardUnpaid
                              ? '!bg-indigo-600 hover:!bg-indigo-500 !border-indigo-600 font-semibold shadow-xs'
                              : 'font-semibold shadow-xs'
                          }
                          icon={isStandardUnpaid ? <SendOutlined /> : <CheckOutlined />}
                          loading={approve.isPending}
                          disabled={reject.isPending}
                          onClick={confirmApprove}
                        >
                          {needsTerms ? 'Chốt điều khoản & Duyệt' : isStandardUnpaid ? 'Duyệt & Gửi yêu cầu thanh toán' : 'Duyệt và công bố tin'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : job.status === 'PENDING_PAYMENT' ? (
                  <div className="flex flex-col gap-3 rounded-t-2xl border-0 border-b border-solid border-slate-200 bg-slate-50/70 px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 border border-solid border-blue-200/60">
                          <ClockCircleOutlined className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              Đã duyệt nội dung · Chờ doanh nghiệp thanh toán
                            </span>
                            <Tag color="processing" className="m-0 font-medium text-xs">
                              Chờ thanh toán
                            </Tag>
                          </div>
                          <p className="text-xs text-slate-500 m-0 leading-relaxed max-w-2xl">
                            {isAwaitingSourcingDeposit(job) ? (
                              <>
                                Đã tạo khoản cọc CV Sourcing <strong>{formatMoney(sourcingDepositAmount(job) ?? 0, 'VND')}</strong>. Platform Admin ghi nhận cọc ở trang <strong>Tài chính</strong>; tin tự chuyển sang <strong>Đang tuyển</strong> ngay sau đó.
                              </>
                            ) : (
                              <>
                                Đã tạo yêu cầu thanh toán <strong>{feeText}</strong> gửi tới Doanh nghiệp. Platform Admin ghi nhận tiền ở trang <strong>Tài chính › Phí đăng tin</strong>; tin tự chuyển sang <strong>Đang tuyển</strong> ngay sau đó.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : job.status === 'ACTIVE' ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-0 border-b border-solid border-emerald-200 bg-emerald-50/80 px-6 py-3.5">
                    <div className="flex items-center gap-2 text-emerald-900 text-sm font-medium">
                      <CheckCircleFilled className="text-emerald-600 text-base" />
                      <span>Tin tuyển dụng đã hoàn tất duyệt và thanh toán, đang hoạt động công khai trên hệ thống.</span>
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
                  <JobDetailPanel job={job} showHistory isInternalReview />
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {job && needsTerms && (
        <CommercialTermsApprovalModal
          job={job}
          open={termsOpen}
          loading={approve.isPending}
          onCancel={() => setTermsOpen(false)}
          onApprove={approveWithTerms}
        />
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
              reason: reasonText || (reasonCode as string),
            })
            .then((res) => {
              message.success(res.message);
              // 1. Thông báo cho Internal HR
              useAlertStore.getState().addAlert({
                targetRole: 'INTERNAL_HR',
                type: 'info',
                title: 'Đã từ chối duyệt tin tuyển dụng',
                message: `Đã từ chối tin "${job.title}" của ${job.companyName}. Lý do: ${reasonText || 'Không đạt chuẩn'}.`,
                actionLabel: 'Xem tin',
                actionRoute: `/internal/jobs/review?status=REJECTED&highlight=${encodeURIComponent(job.jobId)}`,
                relatedEntityId: job.jobId,
              });

              // 2. Thông báo cho Client
              useAlertStore.getState().addAlert({
                targetRole: 'CLIENT',
                type: 'error',
                title: 'Tin tuyển dụng cần chỉnh sửa',
                message: `Tin "${job.title}" chưa được duyệt. Lý do: ${reasonText || 'Vui lòng kiểm tra lại yêu cầu'}. Vui lòng cập nhật lại.`,
                actionLabel: 'Xem chi tiết',
                actionRoute: `/client/jobs?status=REJECTED&highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
                relatedEntityId: job.jobId,
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
