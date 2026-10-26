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
  EditOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ApproveJobInput, Job, JobRejectReasonCode, JobStatus } from '@/types/api/jobs';
import { jobsApi, serviceAgreementsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAlertStore } from '@/stores/alertStore';
import { formatMoney, useCurrentServiceAgreement, useJobDetail, useJobFeeInfo, useJobMutations, useJobReviewQueue } from './useJobQueries';
import { JobDetailPanel, JobTemplateOriginTag } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import { CommercialTermsApprovalModal } from './CommercialTermsApprovalModal';
import {
  JOB_STATUS,
  REJECT_REASONS,
  SERVICE_TYPE_LABEL,
  formatDateTime,
  formatPostingPackage,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
} from './jobDisplay';

const { Text } = Typography;

const waitingSince = (job: Job) => job.updatedAt;

type StatusFilter = 'PENDING_REVIEW' | 'PENDING_AGREEMENT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'REJECTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Chờ duyệt', value: 'PENDING_REVIEW' },
  { label: 'Thỏa thuận dịch vụ', value: 'PENDING_AGREEMENT' },
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
        className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
          selected
            ? 'border-l-4 border-l-blue-600 border-y-slate-200/80 border-r-slate-200/80 bg-blue-50/40 shadow-xs'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`font-semibold text-sm line-clamp-1 leading-snug ${selected ? 'text-blue-900' : 'text-slate-800'}`}>
            {job.title || 'Vị trí chưa đặt tên'}
          </div>
          <Tag color={statusMeta.color} className="m-0 shrink-0 text-[11px] font-medium leading-4 rounded">
            {statusMeta.label}
          </Tag>
        </div>

        <div className="mt-1 text-xs text-slate-500 line-clamp-1">
          {job.companyName ?? '—'}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="truncate max-w-[170px] text-slate-500 text-[11px]">
            {job.serviceTypeCode ? (SERVICE_TYPE_LABEL[job.serviceTypeCode]?.label ?? job.serviceTypeCode) : ''}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">
            {formatDateTime(waitingSince(job))}
          </span>
        </div>

        {job.status === 'REJECTED' && job.statusReason && (
          <div className="mt-1.5 rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 border border-solid border-rose-200 line-clamp-1">
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
  const packageLabel = formatPostingPackage(job?.postingPackageCode, feeInfo.packageName);
  const isStandardUnpaid = Boolean(
    job &&
    job.serviceTypeCode === 'CV_APPLICATION' &&
    (feeInfo.amount ?? 0) > 0 &&
    (!job.postingFeeStatus || job.postingFeeStatus === 'PENDING')
  );

  const needsTerms = job?.serviceTypeCode === 'HEADHUNT_COD' || job?.serviceTypeCode === 'CV_SOURCING';

  // Thỏa thuận dịch vụ hiện hành (nếu là Headhunt hoặc Sourcing)
  const currentAgreementQuery = useCurrentServiceAgreement(
    job?.jobId,
    Boolean(job?.jobId && needsTerms)
  );
  const currentAgreement = currentAgreementQuery.data;

  /** F2: approve with the commercial terms Internal HR agreed (HEADHUNT_COD, CV_SOURCING) -> Send proposal to Client. */
  const approveWithTerms = async (input: ApproveJobInput) => {
    if (!job) return;
    try {
      if (needsTerms) {
        const terms = input.commercialTerms;
        await serviceAgreementsApi.createProposal(job.jobId, {
          concurrencyToken: job.concurrencyToken,
          feeMultiplier: terms?.feeMultiplier != null ? Number(terms.feeMultiplier) : undefined,
          warrantyDays: terms?.warrantyDays != null ? Number(terms.warrantyDays) : undefined,
          paymentDueDays: terms?.paymentDueDays != null ? Number(terms.paymentDueDays) : undefined,
          sourcingTarget: terms?.sourcingTarget != null ? Number(terms.sourcingTarget) : undefined,
          pricePerQualifiedCv: terms?.pricePerCv != null ? Number(terms.pricePerCv) : undefined,
          reviewDays: terms?.reviewDays != null ? Number(terms.reviewDays) : undefined,
          agreementReference: input.agreementReference || undefined,
          agreementNote: input.note || undefined,
        });
        message.success(
          job.status === 'PENDING_AGREEMENT'
            ? 'Đã cập nhật và gửi lại hợp đồng cho Doanh nghiệp'
            : 'Đã gửi hợp đồng cho Doanh nghiệp'
        );
        setTermsOpen(false);
        const isHeadhunt = job.serviceTypeCode === 'HEADHUNT_COD';
        useAlertStore.getState().addAlert({
          targetRole: 'INTERNAL_HR',
          type: 'success',
          title: isHeadhunt ? 'Đã gửi hợp đồng dịch vụ tuyển dụng' : 'Đã gửi hợp đồng tìm kiếm hồ sơ',
          message: `Đã gửi hợp đồng có sẵn chữ ký cho "${job.title}" của ${job.companyName}. Đang chờ Doanh nghiệp xem và ký.`,
          actionLabel: 'Xem chi tiết',
          actionRoute: `/internal/jobs/review?status=PENDING_AGREEMENT&highlight=${encodeURIComponent(job.jobId)}`,
          relatedEntityId: job.jobId,
        });
        useAlertStore.getState().addAlert({
          targetRole: 'CLIENT',
          type: 'info',
          title: 'Hợp đồng dịch vụ đã được soạn xong',
          message: `Đã soạn xong hợp đồng dịch vụ cho "${job.title}". Vui lòng tải hợp đồng về xem xét và thực hiện ký kết.`,
          actionLabel: 'Xem & Tải hợp đồng',
          actionRoute: `/client/agreements?jobId=${encodeURIComponent(job.jobId)}`,
          relatedEntityId: job.jobId,
        });
        await Promise.all([detail.refetch(), queue.refetch(), currentAgreementQuery.refetch()]);
      } else {
        const res = await approve.mutateAsync({ jobId: job.jobId, token: job.concurrencyToken, input });
        message.success(res.message);
        setTermsOpen(false);
      }
    } catch (err) {
      message.error(getApiErrorMessage(err));
      throw err;
    }
  };

  const handleViewClientSignedDoc = async () => {
    if (!job || !currentAgreement) return;
    try {
      message.loading({ content: 'Đang mở hợp đồng đã ký của Doanh nghiệp...', key: 'signed-doc' });
      const res = await serviceAgreementsApi.getDownloadUrl(job.jobId, currentAgreement.serviceAgreementId, true);
      message.success({ content: 'Mở tài liệu thành công', key: 'signed-doc' });
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      message.error({ content: getApiErrorMessage(err), key: 'signed-doc' });
    }
  };

  const confirmApprove = () => {
    if (!job) return;

    if (needsTerms) {
      setTermsOpen(true);
    } else if (isStandardUnpaid) {
      modal.confirm({
        title: 'Xác nhận duyệt tin tuyển dụng?',
        icon: <FileDoneOutlined className="text-indigo-600 text-xl" />,
        width: 480,
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
            <div className="rounded-lg bg-indigo-50/70 p-2.5 border border-solid border-indigo-100 text-xs text-indigo-900">
              Hệ thống sẽ gửi yêu cầu thanh toán <strong>{feeText}</strong> tới Doanh nghiệp để kích hoạt tin.
            </div>
          </div>
        ),
        okText: 'Duyệt tin',
        okButtonProps: { className: '!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold' },
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
                title: 'Yêu cầu thanh toán',
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
        content: `"${job.title}" sẽ chuyển sang trạng thái Đang tuyển và hiển thị công khai trên hệ thống.`,
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
                message: `Tin tuyển dụng "${job.title}" đã được bộ phận kiểm duyệt phê duyệt và công bố.`,
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

  const confirmPublishAgreementJob = () => {
    if (!job) return;
    const hasSigned = Boolean(currentAgreement?.hasSignedDocument);

    modal.confirm({
      title: hasSigned
        ? 'Xác nhận duyệt hợp đồng và công khai tin tuyển dụng?'
        : 'Xác nhận công khai tin tuyển dụng?',
      icon: <CheckCircleFilled className="text-emerald-600 text-xl" />,
      width: 520,
      content: (
        <div className="py-2 space-y-3 text-xs leading-relaxed text-slate-700">
          <div className="rounded-xl bg-slate-50 p-3 border border-solid border-slate-200 space-y-1">
            <div className="font-semibold text-slate-900 text-sm">{job.title}</div>
            <div className="text-slate-600">{job.companyName ?? '—'}</div>
          </div>
          {hasSigned ? (
            <div className="rounded-lg bg-emerald-50 p-2.5 border border-solid border-emerald-200 text-emerald-900">
              ✓ Doanh nghiệp đã ký và tải lên hợp đồng hợp lệ. Bạn đang thực hiện duyệt hoàn tất để công khai tin tuyển dụng lên nền tảng.
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 p-2.5 border border-solid border-amber-200 text-amber-900">
              ⚠ Doanh nghiệp chưa tải lên hợp đồng ký kết trên hệ thống. Nếu hai bên đã xác nhận ký kết ngoại tuyến, bạn có thể tiếp tục công khai tin.
            </div>
          )}
          <p className="m-0">
            Tin tuyển dụng sẽ được chuyển sang trạng thái <strong>Đang tuyển (ACTIVE)</strong> và hiển thị công khai trên hệ thống.
          </p>
        </div>
      ),
      okText: 'Công khai tin tuyển dụng',
      okButtonProps: { className: '!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold' },
      cancelText: 'Hủy bỏ',
      onOk: () =>
        approve
          .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
          .then((res) => {
            message.success(res.message || 'Công khai tin tuyển dụng thành công.');
            useAlertStore.getState().addAlert({
              targetRole: 'INTERNAL_HR',
              type: 'success',
              title: 'Tin tuyển dụng đã được công bố',
              message: `Hợp đồng dịch vụ cho "${job.title}" đã được duyệt và tin đang hoạt động công khai.`,
              actionLabel: 'Xem tin tuyển dụng',
              actionRoute: `/internal/jobs/review?status=ACTIVE&highlight=${encodeURIComponent(job.jobId)}`,
              relatedEntityId: job.jobId,
            });
            useAlertStore.getState().addAlert({
              targetRole: 'CLIENT',
              type: 'success',
              title: 'Tin tuyển dụng đã được công bố',
              message: `Hợp đồng dịch vụ đã được duyệt! Tin "${job.title}" của quý doanh nghiệp chính thức được công bố để nhận hồ sơ.`,
              actionLabel: 'Xem tin tuyển dụng',
              actionRoute: `/client/jobs?status=ACTIVE&highlight=${encodeURIComponent(job.jobId)}&openDetail=true`,
              relatedEntityId: job.jobId,
            });
          })
          .catch((err) => message.error(getApiErrorMessage(err))),
    });
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
        title="Duyệt và quản lý tin tuyển dụng"
        description="Kiểm tra nội dung, điều khoản và quyết định tin nào đủ điều kiện mở tuyển."
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
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-solid border-blue-200/60">
                          <AuditOutlined className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              Duyệt nội dung tin tuyển dụng
                            </span>
                            <Tag color="gold" className="m-0 font-medium text-xs">
                              Chờ duyệt
                            </Tag>
                          </div>
                          <p className="text-xs text-slate-500 m-0 leading-relaxed max-w-2xl">
                            {isStandardUnpaid
                              ? 'Kiểm tra nội dung tin. Sau khi duyệt, doanh nghiệp sẽ nhận yêu cầu thanh toán để kích hoạt tin.'
                              : 'Kiểm tra thông tin mô tả và yêu cầu trước khi công bố tin tuyển dụng.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <Button
                          className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg font-medium shadow-none hover:!border-rose-300 hover:!text-rose-700"
                          icon={<CloseOutlined />}
                          disabled={busy}
                          onClick={() => setRejectOpen(true)}
                        >
                          Từ chối tin
                        </Button>
                        <Button
                          type="primary"
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm active:scale-[0.98] font-medium border-0"
                          icon={<CheckOutlined />}
                          loading={approve.isPending}
                          disabled={reject.isPending}
                          onClick={confirmApprove}
                        >
                          Duyệt & Ký điều khoản
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : job.status === 'PENDING_AGREEMENT' ? (
                  <div className={`flex flex-col gap-3 rounded-t-2xl border-0 border-b border-solid px-6 py-4 ${
                    currentAgreement?.hasSignedDocument
                      ? 'border-emerald-300 bg-emerald-50/90'
                      : currentAgreement?.status === 'CHANGE_REQUESTED'
                      ? 'border-amber-300 bg-amber-50/90'
                      : 'border-purple-200 bg-purple-50/70'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border border-solid ${
                          currentAgreement?.hasSignedDocument
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300/60'
                            : currentAgreement?.status === 'CHANGE_REQUESTED'
                            ? 'bg-amber-500/10 text-amber-700 border-amber-300/60'
                            : 'bg-purple-500/10 text-purple-700 border-purple-200/60'
                        }`}>
                          {currentAgreement?.hasSignedDocument ? (
                            <CheckCircleFilled className="text-base text-emerald-600" />
                          ) : currentAgreement?.status === 'CHANGE_REQUESTED' ? (
                            <ExclamationCircleOutlined className="text-base text-amber-600" />
                          ) : (
                            <FileDoneOutlined className="text-base text-purple-600" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {currentAgreement?.hasSignedDocument
                                ? `Doanh nghiệp đã tải lên hợp đồng đã ký (v${currentAgreement.version})`
                                : currentAgreement?.status === 'CHANGE_REQUESTED'
                                ? `DN gửi yêu cầu điều chỉnh (v${currentAgreement.version})`
                                : `Hợp đồng đã gửi Doanh nghiệp (v${currentAgreement?.version ?? 1})`}
                            </span>
                            <Tag
                              color={
                                currentAgreement?.hasSignedDocument
                                  ? 'success'
                                  : currentAgreement?.status === 'CHANGE_REQUESTED'
                                  ? 'warning'
                                  : 'purple'
                              }
                              className="m-0 font-medium text-xs"
                            >
                              {currentAgreement?.hasSignedDocument
                                ? 'Đã có bản ký kết'
                                : currentAgreement?.status === 'CHANGE_REQUESTED'
                                ? 'DN yêu cầu điều chỉnh'
                                : 'Đã soạn xong HĐ'}
                            </Tag>
                          </div>
                          {currentAgreement?.hasSignedDocument ? (
                            <div className="text-xs text-emerald-900 bg-white/90 rounded-lg p-2.5 border border-solid border-emerald-200 m-0 leading-relaxed max-w-2xl">
                              Doanh nghiệp đã tải lên văn bản hợp đồng đã ký vào ngày{' '}
                              <strong>{dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')}</strong>
                              {currentAgreement.signerName ? ` bởi ${currentAgreement.signerName}` : ''}.
                              Internal HR vui lòng kiểm tra tệp hợp đồng và bấm <strong>"Công khai tin tuyển dụng"</strong> để phát hành tin.
                            </div>
                          ) : currentAgreement?.status === 'CHANGE_REQUESTED' && currentAgreement?.changeRequestReason ? (
                            <div className="text-xs text-amber-900 bg-white/90 rounded-lg p-2.5 border border-solid border-amber-200 m-0 leading-relaxed max-w-2xl">
                              <strong className="text-amber-950">Ghi chú từ Doanh nghiệp: </strong>
                              "{currentAgreement.changeRequestReason}"
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 m-0 leading-relaxed max-w-2xl">
                              Đã gửi hợp đồng có sẵn chữ ký cho Doanh nghiệp tải về ký ngoài hệ thống. Đang chờ Doanh nghiệp tải lên bản hợp đồng đã ký để đối soát và công khai tin.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentAgreement?.hasSignedDocument && (
                          <Button
                            type="default"
                            icon={<FilePdfOutlined />}
                            className="font-medium"
                            onClick={handleViewClientSignedDoc}
                          >
                            Xem HĐ Doanh nghiệp đã ký
                          </Button>
                        )}
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => setTermsOpen(true)}
                        >
                          {currentAgreement?.status === 'CHANGE_REQUESTED'
                            ? `Gửi bản mới (v${(currentAgreement?.version ?? 1) + 1})`
                            : 'Chỉnh sửa hợp đồng'}
                        </Button>
                        <Button
                          type="primary"
                          className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold"
                          icon={<CheckOutlined />}
                          loading={approve.isPending}
                          onClick={confirmPublishAgreementJob}
                        >
                          Công khai tin tuyển dụng
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
                                Đã gửi yêu cầu đặt cọc <strong>{formatMoney(sourcingDepositAmount(job) ?? 0, 'VND')}</strong> tới doanh nghiệp. Tin sẽ tự chuyển sang <strong>Đang tuyển</strong> sau khi nhận cọc.
                              </>
                            ) : (
                              <>
                                Đã gửi yêu cầu thanh toán <strong>{feeText}</strong> tới doanh nghiệp. Tin sẽ tự động chuyển sang <strong>Đang tuyển</strong> ngay khi doanh nghiệp thanh toán.
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
                  <JobDetailPanel
                    job={job}
                    showHistory
                    isInternalReview
                    agreementStatus={currentAgreement?.status}
                  />
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
          currentAgreement={currentAgreement}
          changeRequestReason={currentAgreement?.status === 'CHANGE_REQUESTED' ? currentAgreement.changeRequestReason : undefined}
          isRevision={job.status === 'PENDING_AGREEMENT'}
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
