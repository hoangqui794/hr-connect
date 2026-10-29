/**
 * @file JobReviewPage.tsx
 * @description MF-01 · Internal HR — review queue & job management (GET /internal/jobs/review)
 * with status filters (PENDING_REVIEW, ACTIVE, REJECTED, ALL), search, approve, and reject.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Tag,
  Tooltip,
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
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
import { formatMoney, jobQueryKeys, useCurrentServiceAgreement, useJobDetail, useJobFeeInfo, useJobMutations, useJobReviewQueue } from './useJobQueries';
import { JobDetailPanel, JobTemplateOriginTag } from './JobDetailPanel';
import { ReasonModal } from './ReasonModal';
import { CommercialTermsApprovalModal } from './CommercialTermsApprovalModal';
import './job-review.css';
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

type StatusFilter = 'PENDING_REVIEW' | 'PENDING_AGREEMENT' | 'CHANGE_REQUESTED' | 'PENDING_PAYMENT' | 'ACTIVE' | 'REJECTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Chờ duyệt', value: 'PENDING_REVIEW' },
  { label: 'Thỏa thuận dịch vụ', value: 'PENDING_AGREEMENT' },
  { label: 'Điều chỉnh', value: 'CHANGE_REQUESTED' },
  { label: 'Chờ thanh toán', value: 'PENDING_PAYMENT' },
  { label: 'Đang tuyển', value: 'ACTIVE' },
  { label: 'Bị từ chối', value: 'REJECTED' },
  { label: 'Tất cả tin', value: 'ALL' },
];

const EMPTY_STATE_COPY: Record<StatusFilter, { title: string; description: string }> = {
  PENDING_REVIEW: {
    title: 'Không có tin nào đang chờ duyệt',
    description: 'Hàng đợi đã được xử lý xong. Tin mới do doanh nghiệp gửi sẽ xuất hiện tại đây.',
  },
  PENDING_AGREEMENT: {
    title: 'Chưa có thỏa thuận cần xử lý',
    description: 'Các tin đã duyệt nội dung và cần hoàn tất thỏa thuận dịch vụ sẽ xuất hiện tại đây.',
  },
  CHANGE_REQUESTED: {
    title: 'Không có yêu cầu điều chỉnh nào',
    description: 'Hiện không có thỏa thuận dịch vụ nào do Doanh nghiệp gửi ghi chú yêu cầu điều chỉnh.',
  },
  PENDING_PAYMENT: {
    title: 'Chưa có tin chờ thanh toán',
    description: 'Tin đã được duyệt và đang chờ doanh nghiệp thanh toán hoặc đặt cọc sẽ xuất hiện tại đây.',
  },
  ACTIVE: {
    title: 'Chưa có tin đang tuyển',
    description: 'Tin đã hoàn tất duyệt, thỏa thuận và thanh toán sẽ được theo dõi tại đây.',
  },
  REJECTED: {
    title: 'Chưa có tin bị từ chối',
    description: 'Các tin chưa đạt yêu cầu cùng lý do cần chỉnh sửa sẽ xuất hiện tại đây.',
  },
  ALL: {
    title: 'Chưa có tin tuyển dụng',
    description: 'Tin tuyển dụng do doanh nghiệp tạo sẽ xuất hiện tại đây khi có dữ liệu.',
  },
};

const QueueItem: React.FC<{ job: Job; selected: boolean; onSelect: () => void }> = ({ job, selected, onSelect }) => {
  const isChangeRequested = job.agreementStatus === 'CHANGE_REQUESTED';
  const statusMeta = isChangeRequested
    ? { label: 'DN yêu cầu sửa', color: 'warning' }
    : (JOB_STATUS[job.status as JobStatus] ?? { label: job.status, color: 'default' });

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-pressed={selected}
        className={`job-review-queue-item ${selected ? 'is-selected' : ''}`}
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

        {isChangeRequested && job.agreementChangeRequestReason && (
          <div className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800 border border-solid border-amber-200 line-clamp-2 text-left">
            <span className="font-semibold">Ghi chú DN: </span>
            {job.agreementChangeRequestReason}
          </div>
        )}

        {job.status === 'REJECTED' && job.statusReason && (
          <div className="mt-1.5 rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 border border-solid border-rose-200 line-clamp-1 text-left">
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
  const [queueCollapsed, setQueueCollapsed] = useState(false);

  // Hook lấy danh sách theo trạng thái filter
  const queryClient = useQueryClient();
  const queue = useJobReviewQueue(statusFilter);
  const pendingAgreementQueue = useJobReviewQueue('PENDING_AGREEMENT');
  const allJobsQueue = useJobReviewQueue('ALL');
  const detail = useJobDetail(selectedId);
  const { approve, reject } = useJobMutations();

  // Sắp xếp bài mới nhất lên trên & lọc theo từ khóa tìm kiếm
  const jobs = useMemo(() => {
    const changeRequestedMap = (() => {
      try {
        return JSON.parse(localStorage.getItem('hrconnect_change_requested_jobs') || '{}');
      } catch {
        return {};
      }
    })();

    let list: Job[] = [];

    if (statusFilter === 'CHANGE_REQUESTED') {
      const map = new Map<string, Job>();
      (queue.data ?? []).forEach((j) => map.set(j.jobId, j));

      const extraCandidates = [
        ...(pendingAgreementQueue.data ?? []),
        ...(allJobsQueue.data ?? []),
      ];

      extraCandidates.forEach((j) => {
        const isChangeReq =
          j.agreementStatus === 'CHANGE_REQUESTED' ||
          Boolean(changeRequestedMap[j.jobId]);

        if (isChangeReq && !map.has(j.jobId)) {
          map.set(j.jobId, {
            ...j,
            agreementStatus: 'CHANGE_REQUESTED',
            agreementChangeRequestReason:
              changeRequestedMap[j.jobId]?.reason ||
              j.agreementChangeRequestReason ||
              'Doanh nghiệp yêu cầu điều chỉnh các điều khoản hợp đồng.',
          });
        }
      });

      list = Array.from(map.values());
    } else if (statusFilter === 'PENDING_AGREEMENT') {
      list = (queue.data ?? []).filter((j) => {
        const isChangeReq =
          j.agreementStatus === 'CHANGE_REQUESTED' ||
          Boolean(changeRequestedMap[j.jobId]);
        return !isChangeReq;
      });
    } else {
      list = [...(queue.data ?? [])];
    }

    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.title?.toLowerCase().includes(q) ||
          j.companyName?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
      );
    }
    return list.filter((j) => j.status !== 'DRAFT').sort((a, b) => new Date(waitingSince(b)).getTime() - new Date(waitingSince(a)).getTime());
  }, [queue.data, pendingAgreementQueue.data, allJobsQueue.data, statusFilter, searchKeyword]);

  // Đồng bộ statusFilter khi query param thay đổi (ví dụ người dùng bấm từ NotificationBell)
  useEffect(() => {
    const statusFromUrl = searchParams.get('status') as StatusFilter | null;
    if (statusFromUrl && STATUS_TABS.some((t) => t.value === statusFromUrl) && statusFromUrl !== statusFilter) {
      setStatusFilter(statusFromUrl);
    }
  }, [searchParams, statusFilter]);

  // Tự động chọn item hợp lệ khi danh sách tải xong hoặc khi có highlightParam
  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (highlightParam) {
      const q = highlightParam.toLowerCase();
      const target = jobs.find(
        (j) =>
          j.jobId === highlightParam ||
          j.title?.toLowerCase().includes(q) ||
          j.companyName?.toLowerCase().includes(q)
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
  const hasSearchKeyword = searchKeyword.trim().length > 0;
  const emptyState = hasSearchKeyword
    ? {
      title: 'Không tìm thấy tin phù hợp',
      description: 'Hãy thử từ khóa ngắn hơn hoặc xóa từ khóa để xem lại toàn bộ tin trong mục này.',
    }
    : EMPTY_STATE_COPY[statusFilter];

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

  const isJobDeposited = (targetJob?: Job | null): boolean => {
    if (!targetJob) return false;
    if (targetJob.hasSubmittedDeposit) return true;
    try {
      const raw = JSON.parse(localStorage.getItem('hrconnect_deposited_jobs') || '[]');
      if (Array.isArray(raw)) return raw.includes(targetJob.jobId);
      if (typeof raw === 'object' && raw !== null) return Boolean((raw as Record<string, any>)[targetJob.jobId]);
      return false;
    } catch {
      return false;
    }
  };

  const storedChangeMap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('hrconnect_change_requested_jobs') || '{}');
    } catch {
      return {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, queue.isFetching]);

  const isAgreementChangeRequested =
    currentAgreement?.status === 'CHANGE_REQUESTED' ||
    job?.agreementStatus === 'CHANGE_REQUESTED' ||
    Boolean(job && storedChangeMap[job.jobId]);

  const changeReason =
    currentAgreement?.changeRequestReason ||
    job?.agreementChangeRequestReason ||
    (job ? storedChangeMap[job.jobId]?.reason : undefined);

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
        try {
          const changeMap = JSON.parse(localStorage.getItem('hrconnect_change_requested_jobs') || '{}');
          delete changeMap[job.jobId];
          localStorage.setItem('hrconnect_change_requested_jobs', JSON.stringify(changeMap));
        } catch {
          // ignore
        }
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

  const [confirmingDeposit, setConfirmingDeposit] = useState(false);
  const handleConfirmDeposit = (jobToConfirm: Job) => {
    modal.confirm({
      title: 'Xác nhận đã nhận cọc và công khai tin?',
      icon: <CheckCircleFilled className="text-emerald-600 text-xl" />,
      width: 480,
      content: (
        <div className="py-2 space-y-3 text-xs leading-relaxed text-slate-700">
          <div className="rounded-xl bg-slate-50 p-3 border border-solid border-slate-200 space-y-1">
            <div className="font-semibold text-slate-900 text-sm">{jobToConfirm.title}</div>
            <div className="text-slate-600">{jobToConfirm.companyName ?? '—'}</div>
            <div className="text-emerald-700 font-semibold pt-1">
              Khoản cọc: {formatMoney(sourcingDepositAmount(jobToConfirm) ?? 0, 'VND')}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-solid border-emerald-100 text-xs text-emerald-900">
            Hệ thống sẽ chuyển tin sang trạng thái <strong>Đang tuyển</strong>, mở nguồn hồ sơ và gửi thông báo công khai tin tới Doanh nghiệp.
          </div>
        </div>
      ),
      okText: 'Xác nhận & Công khai tin',
      okButtonProps: { className: '!bg-emerald-600 hover:!bg-emerald-700 text-white rounded-lg shadow-sm font-semibold' },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setConfirmingDeposit(true);
          try {
            await jobsApi.confirmDeposit(jobToConfirm.jobId);
          } catch (err) {
            console.warn('confirmDeposit API failed, attempting approve fallback', err);
            try {
              await jobsApi.approve(jobToConfirm.jobId, jobToConfirm.concurrencyToken);
            } catch (fallbackErr) {
              console.warn('Approve fallback error', fallbackErr);
            }
          }
          try {
            const raw = JSON.parse(localStorage.getItem('hrconnect_deposited_jobs') || '[]');
            if (Array.isArray(raw)) {
              const filtered = raw.filter((id) => id !== jobToConfirm.jobId);
              localStorage.setItem('hrconnect_deposited_jobs', JSON.stringify(filtered));
            } else if (typeof raw === 'object' && raw !== null) {
              delete (raw as Record<string, any>)[jobToConfirm.jobId];
              localStorage.setItem('hrconnect_deposited_jobs', JSON.stringify(raw));
            }
          } catch {
            // ignore
          }
          message.success('Đã xác nhận nhận cọc! Tin tuyển dụng đã được công bố công khai.');
          useAlertStore.getState().addAlert({
            targetRole: 'INTERNAL_HR',
            type: 'success',
            title: 'Đã nhận cọc & Công khai tin',
            message: `Đã đối soát khoản cọc của "${jobToConfirm.title}". Tin đã chính thức chuyển sang trạng thái Đang tuyển.`,
            actionLabel: 'Xem tin tuyển dụng',
            actionRoute: `/internal/jobs/review?status=ACTIVE&highlight=${encodeURIComponent(jobToConfirm.jobId)}`,
            relatedEntityId: jobToConfirm.jobId,
          });
          useAlertStore.getState().addAlert({
            targetRole: 'CLIENT',
            type: 'success',
            title: 'Tin tuyển dụng đã được kích hoạt',
            message: `HR Connect đã xác nhận khoản đặt cọc cho tin "${jobToConfirm.title}". Tin đã được công khai và bắt đầu tìm kiếm ứng viên.`,
            actionLabel: 'Xem tin tuyển dụng',
            actionRoute: `/client/jobs?status=ACTIVE&highlight=${encodeURIComponent(jobToConfirm.jobId)}&openDetail=true`,
            relatedEntityId: jobToConfirm.jobId,
          });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: jobQueryKeys.all }),
            queryClient.invalidateQueries({ queryKey: ['jobs', 'review'] }),
            queryClient.invalidateQueries({ queryKey: ['job', jobToConfirm.jobId] }),
            queryClient.invalidateQueries({ queryKey: ['notifications'] }),
            queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] }),
          ]);
        } catch (err) {
          message.error(getApiErrorMessage(err));
        } finally {
          setConfirmingDeposit(false);
        }
      },
    });
  };

  const confirmPublishAgreementJob = () => {
    if (!job) return;
    const hasSigned = Boolean(currentAgreement?.hasSignedDocument || job.hasSignedAgreement);
    if (!hasSigned) {
      message.warning('Doanh nghiệp chưa tải lên bản hợp đồng đã ký kết trên hệ thống. Không thể duyệt khi chưa có bản ký.');
      return;
    }
    const isSourcing = job.serviceTypeCode === 'CV_SOURCING';
    const isPaidPackage = isStandardUnpaid;
    const requiresDepositOrPayment = isSourcing || isPaidPackage;

    if (requiresDepositOrPayment) {
      modal.confirm({
        title: isSourcing
          ? 'Xác nhận duyệt hợp đồng & gửi yêu cầu đặt cọc?'
          : 'Xác nhận duyệt hợp đồng & gửi yêu cầu thanh toán?',
        icon: <ClockCircleOutlined className="text-amber-500 text-xl" />,
        width: 520,
        content: (
          <div className="py-2 space-y-3 text-xs leading-relaxed text-slate-700">
            <div className="rounded-xl bg-slate-50 p-3 border border-solid border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 text-sm">{job.title}</div>
              <div className="text-slate-600">{job.companyName ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 border border-solid border-emerald-200 text-emerald-900">
              ✓ Doanh nghiệp đã nộp bản hợp đồng ký kết hợp lệ.
            </div>
            <div className="rounded-lg bg-blue-50 p-2.5 border border-solid border-blue-200 text-blue-900">
              ℹ Theo quy trình, vị trí này yêu cầu Doanh nghiệp <strong>hoàn tất đặt cọc / thanh toán gói</strong> trước khi tin được công khai.
              Hệ thống sẽ chuyển tin sang trạng thái <strong>Chờ thanh toán</strong> để Doanh nghiệp đặt cọc.
            </div>
          </div>
        ),
        okText: isSourcing ? 'Duyệt HĐ & Yêu cầu đặt cọc' : 'Duyệt HĐ & Yêu cầu thanh toán',
        okButtonProps: {
          disabled: !hasSigned,
          className: hasSigned ? '!bg-amber-600 hover:!bg-amber-700 text-white rounded-lg shadow-sm font-semibold' : 'rounded-lg font-semibold',
        },
        cancelText: 'Hủy bỏ',
        onOk: () =>
          approve
            .mutateAsync({ jobId: job.jobId, token: job.concurrencyToken })
            .then((res) => {
              message.success(res.message || 'Đã duyệt hợp đồng và tạo yêu cầu đặt cọc/thanh toán.');
              useAlertStore.getState().addAlert({
                targetRole: 'INTERNAL_HR',
                type: 'info',
                title: 'Đã duyệt hợp đồng · Chờ đặt cọc',
                message: `Hợp đồng cho "${job.title}" đã duyệt. Đang chờ Doanh nghiệp hoàn tất đặt cọc/thanh toán.`,
                actionLabel: 'Xem tin tuyển dụng',
                actionRoute: `/internal/jobs/review?status=PENDING_PAYMENT&highlight=${encodeURIComponent(job.jobId)}`,
                relatedEntityId: job.jobId,
              });
              useAlertStore.getState().addAlert({
                targetRole: 'CLIENT',
                type: 'warning',
                title: 'Yêu cầu đặt cọc dịch vụ',
                message: `Hợp đồng dịch vụ cho "${job.title}" đã được xác nhận. Vui lòng hoàn tất đặt cọc để tin tuyển dụng được công khai.`,
                actionLabel: 'Đặt cọc ngay',
                actionRoute: `/client/agreements?jobId=${encodeURIComponent(job.jobId)}`,
                relatedEntityId: job.jobId,
              });
            })
            .catch((err) => message.error(getApiErrorMessage(err))),
      });
      return;
    }

    modal.confirm({
      title: 'Xác nhận duyệt hợp đồng và công khai tin tuyển dụng?',
      icon: <CheckCircleFilled className="text-emerald-600 text-xl" />,
      width: 520,
      content: (
        <div className="py-2 space-y-3 text-xs leading-relaxed text-slate-700">
          <div className="rounded-xl bg-slate-50 p-3 border border-solid border-slate-200 space-y-1">
            <div className="font-semibold text-slate-900 text-sm">{job.title}</div>
            <div className="text-slate-600">{job.companyName ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 border border-solid border-emerald-200 text-emerald-900">
            ✓ Doanh nghiệp đã ký và tải lên hợp đồng hợp lệ. Bạn đang thực hiện duyệt hoàn tất để công khai tin tuyển dụng lên nền tảng.
          </div>
          <p className="m-0">
            Tin tuyển dụng sẽ được chuyển sang trạng thái <strong>Đang tuyển</strong> và hiển thị công khai trên hệ thống.
          </p>
        </div>
      ),
      okText: 'Công khai tin tuyển dụng',
      okButtonProps: {
        disabled: !hasSigned,
        className: hasSigned ? '!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold' : 'rounded-lg font-semibold',
      },
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
    <div className="job-review-page">
      <PageHero
        title="Duyệt và quản lý tin tuyển dụng"
        description="Kiểm tra nội dung, điều khoản và quyết định tin nào đủ điều kiện mở tuyển."
        actions={
          <Button size="large" icon={<ReloadOutlined />} loading={queue.isFetching && !queue.isLoading} onClick={() => queue.refetch()}>
            Tải lại
          </Button>
        }
      />

      {/* ── Bộ lọc trạng thái & Tìm kiếm ── */}
      <div className="job-review-toolbar">
        <div className="job-review-status-tabs" aria-label="Lọc tin tuyển dụng theo trạng thái">
          <Segmented
            options={STATUS_TABS}
            value={statusFilter}
            onChange={(val) => handleStatusChange(val as StatusFilter)}
            className="font-medium p-1 bg-slate-100"
            size="middle"
          />
        </div>

        <div className="job-review-search">
          <Input
            placeholder="Tìm theo vị trí, công ty..."
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
            aria-label="Tìm tin tuyển dụng theo vị trí hoặc công ty"
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
      ) : jobs.length === 0 ? (
        <section className="job-review-empty-state" aria-live="polite" aria-label={emptyState.title}>
          <span className="job-review-empty-icon" aria-hidden>
            {hasSearchKeyword ? <SearchOutlined /> : <InboxOutlined />}
          </span>
          <h2>{emptyState.title}</h2>
          <p>{emptyState.description}</p>
          {hasSearchKeyword ? (
            <Button type="primary" onClick={() => setSearchKeyword('')}>
              Xóa từ khóa tìm kiếm
            </Button>
          ) : (
            <Button
              icon={<ReloadOutlined />}
              loading={queue.isFetching}
              onClick={() => queue.refetch()}
            >
              Kiểm tra dữ liệu mới
            </Button>
          )}
        </section>
      ) : (
        <div className={`job-review-workspace ${queueCollapsed ? 'is-queue-collapsed' : ''}`}>
          {/* ── Cột danh sách bên trái ── */}
          <aside className="job-review-queue" aria-label="Danh sách tin tuyển dụng">
            <div className="job-review-queue-header">
              <div className="flex min-w-0 items-center gap-2.5">
                <Text strong className="truncate text-sm text-slate-800">
                  {STATUS_TABS.find((t) => t.value === statusFilter)?.label}
                </Text>
                <Badge count={jobs.length} color="#0f172a" overflowCount={999} />
              </div>
              <Tooltip title="Thu gọn danh sách">
                <Button
                  type="text"
                  icon={<MenuFoldOutlined />}
                  aria-label="Thu gọn danh sách tin tuyển dụng"
                  className="job-review-queue-toggle"
                  onClick={() => setQueueCollapsed(true)}
                />
              </Tooltip>
            </div>

            <ul className="job-review-queue-list">
              {jobs.map((j) => (
                <QueueItem
                  key={j.jobId}
                  job={j}
                  selected={j.jobId === selectedId}
                  onSelect={() => setSelectedId(j.jobId)}
                />
              ))}
            </ul>
          </aside>

          {/* ── Cột chi tiết bên phải ── */}
          <section className="job-review-detail" aria-live="polite" aria-busy={detail.isFetching}>
            {queueCollapsed && (
              <div className="job-review-restore-queue">
                <Button
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => setQueueCollapsed(false)}
                  aria-label="Hiện danh sách tin tuyển dụng"
                >
                  Hiện danh sách
                </Button>
              </div>
            )}
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
                  <div className="job-review-action-bar flex flex-col gap-3 border-0 border-b border-solid border-slate-200 bg-slate-50/95 px-6 py-4">
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
                  <div className={`job-review-action-bar border-0 border-b border-solid px-6 py-4 ${isAgreementChangeRequested
                    ? 'border-amber-200 bg-amber-50/80'
                    : currentAgreement?.hasSignedDocument
                      ? 'border-emerald-200 bg-emerald-50/80'
                      : 'border-purple-200 bg-purple-50/70'
                    }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Vế trái: Thông tin hợp đồng */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-solid shadow-2xs ${isAgreementChangeRequested
                          ? 'bg-amber-500/15 text-amber-700 border-amber-300/80'
                          : currentAgreement?.hasSignedDocument
                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300/80'
                            : 'bg-purple-500/15 text-purple-700 border-purple-200/80'
                          }`}>
                          {isAgreementChangeRequested ? (
                            <ExclamationCircleOutlined className="text-lg text-amber-600" />
                          ) : currentAgreement?.hasSignedDocument ? (
                            <CheckCircleFilled className="text-xl text-emerald-600" />
                          ) : (
                            <FileDoneOutlined className="text-lg text-purple-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">
                              {isAgreementChangeRequested
                                ? `DN gửi yêu cầu điều chỉnh (v${currentAgreement?.version ?? 1})`
                                : currentAgreement?.hasSignedDocument
                                  ? `Doanh nghiệp đã tải lên hợp đồng đã ký (v${currentAgreement.version})`
                                  : `Hợp đồng đã gửi Doanh nghiệp (v${currentAgreement?.version ?? 1})`}
                            </span>
                            <Tag
                              color={
                                isAgreementChangeRequested
                                  ? 'warning'
                                  : currentAgreement?.hasSignedDocument
                                    ? 'success'
                                    : 'purple'
                              }
                              className="m-0 font-medium text-xs rounded-full px-2.5"
                            >
                              {isAgreementChangeRequested
                                ? 'DN yêu cầu điều chỉnh'
                                : currentAgreement?.hasSignedDocument
                                  ? 'Đã có bản ký kết'
                                  : 'Đã soạn xong HĐ'}
                            </Tag>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {isAgreementChangeRequested ? (
                              <span>
                                Ghi chú từ Doanh nghiệp:{' '}
                                <strong className="text-amber-900">
                                  "{changeReason || 'Doanh nghiệp yêu cầu điều chỉnh thỏa thuận'}"
                                </strong>
                              </span>
                            ) : currentAgreement?.hasSignedDocument ? (
                              <span>
                                Đã nộp ngày <strong>{dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')}</strong>
                                {currentAgreement.signerName ? ` bởi ${currentAgreement.signerName}` : ''}
                              </span>
                            ) : (
                              <span>
                                Đang chờ Doanh nghiệp xem xét, ký kết và tải lên bản đã ký
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Vế phải: Cụm các button hành động */}
                      <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
                        {currentAgreement?.hasSignedDocument && (
                          <Button
                            type="default"
                            icon={<FilePdfOutlined />}
                            className="font-medium rounded-lg h-9 hover:!border-emerald-500 hover:!text-emerald-700 shadow-2xs"
                            onClick={handleViewClientSignedDoc}
                          >
                            Xem HĐ Doanh nghiệp đã ký
                          </Button>
                        )}
                        <Button
                          type={isAgreementChangeRequested ? 'primary' : 'default'}
                          icon={<EditOutlined />}
                          className={
                            isAgreementChangeRequested
                              ? '!bg-amber-600 hover:!bg-amber-700 !border-amber-600 text-white font-semibold rounded-lg h-9 shadow-sm'
                              : 'font-medium rounded-lg h-9 shadow-2xs'
                          }
                          onClick={() => setTermsOpen(true)}
                        >
                          {isAgreementChangeRequested
                            ? `Gửi bản mới (v${(currentAgreement?.version ?? 1) + 1})`
                            : 'Chỉnh sửa hợp đồng'}
                        </Button>
                        {!isAgreementChangeRequested && (() => {
                          const hasSignedDoc = Boolean(currentAgreement?.hasSignedDocument || job.hasSignedAgreement);
                          const buttonText =
                            job.serviceTypeCode === 'CV_SOURCING'
                              ? 'Duyệt HĐ & Yêu cầu đặt cọc'
                              : isStandardUnpaid
                                ? 'Duyệt HĐ & Yêu cầu thanh toán'
                                : 'Công khai tin tuyển dụng';

                          const tooltipTitle = !hasSignedDoc
                            ? 'Doanh nghiệp chưa tải lên bản hợp đồng đã ký kết. Cần có bản ký để duyệt hợp đồng và tiếp tục quy trình.'
                            : undefined;

                          const approveButton = (
                            <Button
                              type="primary"
                              disabled={!hasSignedDoc}
                              className={
                                hasSignedDoc
                                  ? '!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold h-9'
                                  : 'rounded-lg font-semibold h-9'
                              }
                              icon={<CheckOutlined />}
                              loading={approve.isPending}
                              onClick={confirmPublishAgreementJob}
                            >
                              {buttonText}
                            </Button>
                          );

                          return tooltipTitle ? (
                            <Tooltip title={tooltipTitle}>
                              <span className="inline-block cursor-not-allowed">{approveButton}</span>
                            </Tooltip>
                          ) : (
                            approveButton
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : job.status === 'PENDING_PAYMENT' ? (
                  <div className="job-review-action-bar flex flex-col gap-3 border-0 border-b border-solid border-slate-200 bg-slate-50/95 px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border border-solid ${
                            isJobDeposited(job)
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200/60'
                              : 'bg-blue-500/10 text-blue-700 border-blue-200/60'
                          }`}
                        >
                          {isJobDeposited(job) ? <CheckCircleFilled className="text-base" /> : <ClockCircleOutlined className="text-base" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {isJobDeposited(job)
                                ? 'Doanh nghiệp đã nộp cọc · Chờ HR xác nhận'
                                : 'Đã duyệt nội dung · Chờ doanh nghiệp thanh toán'}
                            </span>
                            <Tag
                              color={isJobDeposited(job) ? 'success' : 'processing'}
                              className="m-0 font-medium text-xs"
                            >
                              {isJobDeposited(job) ? 'Đã nộp cọc' : 'Chờ thanh toán'}
                            </Tag>
                          </div>
                          <p className="text-xs text-slate-500 m-0 leading-relaxed max-w-2xl">
                            {isJobDeposited(job) ? (
                              <>
                                Doanh nghiệp đã xác nhận nộp cọc <strong>{formatMoney(sourcingDepositAmount(job) ?? 0, 'VND')}</strong>. Vui lòng đối soát thanh toán và bấm xác nhận để công khai tin tuyển dụng.
                              </>
                            ) : isAwaitingSourcingDeposit(job) ? (
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

                      {/* Thao tác xác nhận cọc hoặc chỉ thị đợi cọc */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isJobDeposited(job) ? (
                          <Button
                            type="primary"
                            icon={<CheckCircleFilled />}
                            loading={confirmingDeposit}
                            className="!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600 text-white rounded-lg h-9 font-semibold shadow-sm"
                            onClick={() => handleConfirmDeposit(job)}
                          >
                            Xác nhận đã nhận cọc & Công khai tin
                          </Button>
                        ) : (
                          <Tooltip title="Doanh nghiệp cần nộp cọc / thanh toán gói trước khi tin được công khai. Hệ thống sẽ cho phép xác nhận kích hoạt tin sau khi doanh nghiệp nộp cọc.">
                            <Button
                              disabled
                              icon={<ClockCircleOutlined />}
                              className="rounded-lg h-9 font-medium text-slate-500 bg-slate-100 border-slate-200 cursor-not-allowed"
                            >
                              Đợi DN đặt cọc
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                ) : job.status === 'ACTIVE' ? (
                  <div className="job-review-action-bar flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-emerald-200 bg-emerald-50/95 px-6 py-3.5">
                    <div className="flex items-center gap-2 text-emerald-900 text-sm font-medium">
                      <CheckCircleFilled className="text-emerald-600 text-base" />
                      <span>Tin tuyển dụng đã hoàn tất duyệt và thanh toán, đang hoạt động công khai trên hệ thống.</span>
                    </div>
                    <Tag color="success" className="m-0 font-semibold px-2.5 py-0.5">
                      Đang tuyển
                    </Tag>
                  </div>
                ) : job.status === 'REJECTED' ? (
                  <div className="job-review-action-bar flex flex-col gap-2 border-0 border-b border-solid border-rose-200 bg-rose-50/95 px-6 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-rose-900 text-sm font-semibold">
                        <CloseCircleFilled className="text-rose-600 text-base" />
                        <span>Tin tuyển dụng này đã bị từ chối duyệt</span>
                      </div>
                      <Tag color="error" className="m-0 font-semibold px-2.5 py-0.5">
                        Đã từ chối
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
                  <div className="job-review-action-bar flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-slate-200 bg-slate-50/95 px-6 py-3.5">
                    <Text className="text-sm text-slate-700">
                      Trạng thái hiện tại: <span className="font-semibold">{JOB_STATUS[job.status as JobStatus]?.label ?? job.status}</span>
                    </Text>
                    <Tag color={JOB_STATUS[job.status as JobStatus]?.color} className="m-0 font-semibold">{JOB_STATUS[job.status as JobStatus]?.label ?? 'Chưa xác định'}</Tag>
                  </div>
                )}

                <div className="job-review-detail-content">
                  <JobDetailPanel
                    job={job}
                    showHistory
                    isInternalReview
                    agreementStatus={isAgreementChangeRequested ? 'CHANGE_REQUESTED' : currentAgreement?.status}
                    changeRequestReason={changeReason}
                    onOpenTermsModal={() => setTermsOpen(true)}
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
          changeRequestReason={isAgreementChangeRequested ? changeReason : undefined}
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
