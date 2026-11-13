/**
 * @file ClientServiceAgreementsPage.tsx
 * @description Client Service Agreements management page (MF-01).
 * Allows client companies to review commercial terms, request adjustments,
 * and digitally sign service agreements (Headhunt / CV Sourcing) via email OTP.
 * Revamped according to Vercel Web Interface Guidelines and Anthropic Frontend Design principles.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  App as AntApp,
  Button,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { Surface } from '@/features/admin-console/ui';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorMessage } from '@/services/apiClient';
import { serviceAgreementsApi } from '@/services/api/jobsApi';
import {
  formatMoney,
  jobQueryKeys,
  useCurrentServiceAgreement,
  useMyJobs,
  useServiceAgreementHistory,
} from '@/features/jobs-mf01/useJobQueries';
import {
  JOB_STATUS,
  SERVICE_AGREEMENT_STATUS,
  SERVICE_TYPE_LABEL,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
} from '@/features/jobs-mf01/jobDisplay';
import { PaymentDemoModal } from '@/features/jobs-mf01/PaymentDemoModal';
import type { Job, ServiceAgreementDto } from '@/types/api/jobs';

const { Text, Paragraph } = Typography;

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

type AgreementTabKey = 'ALL' | 'PENDING_AGREEMENT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'CLOSED';

export const ClientServiceAgreementsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const selectedJobIdParam = searchParams.get('jobId') || '';

  // 1. Fetch Client's jobs (focusing on Headhunt and CV Sourcing)
  const { data: allJobs = [], isLoading: loadingJobs, refetch: refetchJobs, isFetching: fetchingJobs } = useMyJobs();

  const eligibleJobs = useMemo(() => {
    return allJobs.filter(
      (j) => j.serviceTypeCode === 'HEADHUNT_COD' || j.serviceTypeCode === 'CV_SOURCING'
    );
  }, [allJobs]);

  // Filter state: Search + Status Select
  const [statusFilter, setStatusFilter] = useState<AgreementTabKey>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Breakdown counts for status tabs
  const counts = useMemo(() => {
    let pendingAgreement = 0;
    let pendingPayment = 0;
    let active = 0;
    let closed = 0;

    for (const j of eligibleJobs) {
      if (j.status === 'PENDING_AGREEMENT') pendingAgreement++;
      else if (j.status === 'PENDING_PAYMENT') pendingPayment++;
      else if (j.status === 'ACTIVE') active++;
      else if (j.status === 'CLOSED' || j.status === 'PAUSED') closed++;
    }

    return {
      all: eligibleJobs.length,
      pendingAgreement,
      pendingPayment,
      active,
      closed,
    };
  }, [eligibleJobs]);

  // Filtered jobs based on status and search keyword
  const filteredJobs = useMemo(() => {
    return eligibleJobs.filter((job) => {
      // 1. Status filter
      if (statusFilter === 'PENDING_AGREEMENT' && job.status !== 'PENDING_AGREEMENT') return false;
      if (statusFilter === 'PENDING_PAYMENT' && job.status !== 'PENDING_PAYMENT') return false;
      if (statusFilter === 'ACTIVE' && job.status !== 'ACTIVE') return false;
      if (statusFilter === 'CLOSED' && job.status !== 'CLOSED' && job.status !== 'PAUSED') return false;

      // 2. Search keyword
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const matchTitle = job.title?.toLowerCase().includes(q);
        const matchId = job.jobId?.toLowerCase().includes(q);
        if (!matchTitle && !matchId) return false;
      }

      return true;
    });
  }, [eligibleJobs, statusFilter, searchKeyword]);

  const [activeJobId, setActiveJobId] = useState<string>('');

  useEffect(() => {
    if (eligibleJobs.length > 0) {
      if (selectedJobIdParam && eligibleJobs.some((j) => j.jobId === selectedJobIdParam)) {
        setActiveJobId(selectedJobIdParam);
      } else if (!activeJobId || !eligibleJobs.some((j) => j.jobId === activeJobId)) {
        setActiveJobId(eligibleJobs[0].jobId);
      }
    }
  }, [eligibleJobs, selectedJobIdParam, activeJobId]);

  const handleStatusFilterChange = (key: AgreementTabKey) => {
    setStatusFilter(key);

    const nextList = eligibleJobs.filter((job) => {
      if (key === 'PENDING_AGREEMENT' && job.status !== 'PENDING_AGREEMENT') return false;
      if (key === 'PENDING_PAYMENT' && job.status !== 'PENDING_PAYMENT') return false;
      if (key === 'ACTIVE' && job.status !== 'ACTIVE') return false;
      if (key === 'CLOSED' && job.status !== 'CLOSED' && job.status !== 'PAUSED') return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        if (!job.title?.toLowerCase().includes(q) && !job.jobId?.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (nextList.length > 0 && !nextList.some((j) => j.jobId === activeJobId)) {
      setActiveJobId(nextList[0].jobId);
      setSearchParams({ jobId: nextList[0].jobId }, { replace: true });
    }
  };

  const activeJob = useMemo(
    () => eligibleJobs.find((j) => j.jobId === activeJobId),
    [eligibleJobs, activeJobId]
  );

  // 2. Fetch Current Agreement and History for active job
  const {
    data: currentAgreement,
    isLoading: loadingAgreement,
    refetch: refetchCurrent,
  } = useCurrentServiceAgreement(activeJobId, Boolean(activeJobId));

  const {
    data: historyAgreements = [],
    isLoading: loadingHistory,
    refetch: refetchHistory,
  } = useServiceAgreementHistory(activeJobId, Boolean(activeJobId));

  // Modals state
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Upload signed agreement state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // PDF Preview / Download
  const handleDownloadPdf = async (agreement: ServiceAgreementDto, signed: boolean = false) => {
    if (!activeJobId) return;
    try {
      message.loading({ content: 'Đang chuẩn bị tài liệu PDF...', key: 'pdf' });
      const res = await serviceAgreementsApi.getDownloadUrl(
        activeJobId,
        agreement.serviceAgreementId,
        signed
      );
      message.success({ content: 'Mở tài liệu thành công', key: 'pdf' });
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      message.error({ content: getApiErrorMessage(err), key: 'pdf' });
    }
  };

  // Xem hợp đồng ngay trên trang (modal)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const handleViewDocument = async (agreement: ServiceAgreementDto, signed: boolean) => {
    if (!activeJobId) return;
    try {
      message.loading({ content: 'Đang mở hợp đồng...', key: 'view' });
      const res = await serviceAgreementsApi.getDownloadUrl(
        activeJobId,
        agreement.serviceAgreementId,
        signed
      );
      message.destroy('view');
      setPreview({
        url: res.downloadUrl,
        title: signed ? 'Hợp đồng đã ký' : 'Văn bản hợp đồng dịch vụ',
      });
    } catch (err) {
      message.error({ content: getApiErrorMessage(err), key: 'view' });
    }
  };

  // Tải file về máy
  const handleSaveDocument = async (agreement: ServiceAgreementDto, signed: boolean) => {
    if (!activeJobId) return;
    let url = '';
    try {
      message.loading({ content: 'Đang tải hợp đồng...', key: 'save' });
      const res = await serviceAgreementsApi.getDownloadUrl(
        activeJobId,
        agreement.serviceAgreementId,
        signed
      );
      url = res.downloadUrl;
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.blob();
      });
      const extByMime: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      };
      const ext = extByMime[blob.type] ?? 'pdf';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${signed ? 'HopDong_DaKy' : 'HopDong'}_${agreement.verificationCode ?? agreement.serviceAgreementId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      message.success({ content: 'Đã tải hợp đồng về máy', key: 'save' });
    } catch (err) {
      if (url) {
        message.destroy('save');
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        message.error({ content: getApiErrorMessage(err), key: 'save' });
      }
    }
  };

  // Upload signed agreement handler
  const handleUploadSignedFile = async () => {
    if (!activeJobId || !currentAgreement) return;
    const firstItem = fileList[0];
    const file = (firstItem?.originFileObj || firstItem) as unknown as File;
    if (!file || !(file instanceof Blob) || fileList.length === 0) {
      message.warning('Vui lòng chọn tệp hợp đồng đã ký để tải lên.');
      return;
    }

    try {
      setUploading(true);
      await serviceAgreementsApi.uploadSignedDocument(
        activeJobId,
        currentAgreement.serviceAgreementId,
        file
      );
      message.success('Tải lên hợp đồng đã ký thành công. Đang chờ bên Internal HR kiểm tra và công khai tin tuyển dụng.');
      setUploadModalOpen(false);
      setFileList([]);
      await Promise.all([refetchCurrent(), refetchHistory(), refetchJobs()]);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // Action: Request revision
  const handleRequestRevision = async () => {
    if (!currentAgreement || !activeJobId) return;
    if (!revisionReason.trim()) {
      message.warning('Vui lòng nhập lý do hoặc đề xuất điều chỉnh.');
      return;
    }
    try {
      setSubmittingRevision(true);
      await serviceAgreementsApi.respond(activeJobId, currentAgreement.serviceAgreementId, {
        concurrencyToken: currentAgreement.concurrencyToken,
        action: 'REQUEST_CHANGES',
        changeRequestReason: revisionReason.trim(),
      });
      message.success('Đã gửi yêu cầu điều chỉnh tới HR Connect.');
      try {
        const changeMap = JSON.parse(localStorage.getItem('hrconnect_change_requested_jobs') || '{}');
        changeMap[activeJobId] = {
          reason: revisionReason.trim(),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('hrconnect_change_requested_jobs', JSON.stringify(changeMap));
      } catch {
        // ignore
      }
      setReviseModalOpen(false);
      setRevisionReason('');
      await Promise.all([refetchCurrent(), refetchHistory(), refetchJobs()]);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Helper calculation for CV Sourcing
  const sourcingEstimatedTotal = useMemo(() => {
    if (!currentAgreement || activeJob?.serviceTypeCode !== 'CV_SOURCING') return null;
    const count = currentAgreement.sourcingTarget ?? 0;
    const price = currentAgreement.pricePerQualifiedCv ?? 0;
    return count * price;
  }, [currentAgreement, activeJob]);

  // Tỷ lệ cọc thật: ưu tiên điều khoản thương mại của job, sau đó tới thỏa thuận (BE map từ Job.DepositPercent).
  const depositPercent = activeJob?.commercialTerms?.depositPercent ?? currentAgreement?.depositPercent ?? null;

  const sourcingEstimatedDeposit = useMemo(() => {
    if (!sourcingEstimatedTotal || !depositPercent) return null;
    return Math.round((sourcingEstimatedTotal * depositPercent) / 100);
  }, [sourcingEstimatedTotal, depositPercent]);

  const isPendingResponse =
    currentAgreement?.status === 'SENT_TO_CLIENT' ||
    currentAgreement?.status === 'ACCEPTED' ||
    currentAgreement?.status === 'AWAITING_SIGNATURE';

  // Helper kiểm tra trạng thái cọc
  const isDeposited = (j?: Job | null) => Boolean(j?.hasSubmittedDeposit);

  // Detection of pending deposit or posting fee
  const isAwaitingDeposit = Boolean(
    activeJob &&
      (isAwaitingSourcingDeposit(activeJob) ||
        (activeJob.serviceTypeCode === 'CV_SOURCING' && activeJob.status === 'PENDING_PAYMENT'))
  );
  const isAwaitingPostingPayment = Boolean(
    activeJob && activeJob.status === 'PENDING_PAYMENT' && !isAwaitingDeposit
  );
  const isPendingPayment = isAwaitingDeposit || isAwaitingPostingPayment;

  const depositAmount = useMemo<number | null>(() => {
    if (activeJob) {
      const amt = sourcingDepositAmount(activeJob);
      if (amt) return amt;
    }
    return sourcingEstimatedDeposit ?? null;
  }, [activeJob, sourcingEstimatedDeposit]);
  const DEPOSIT_PENDING_TEXT = 'HR Connect đang chốt số tiền cọc';
  const depositText = depositAmount != null ? formatMoney(depositAmount, 'VND') : null;

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  return (
    <div className={`space-y-6 ${FONT} max-w-full animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── 1. Compact header: the top bar already names the page, so one line with the count and actions. ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-600">
          <b className="text-slate-900">{counts.all}</b> thỏa thuận · Mua CV theo số lượng và Tuyển qua Affiliate
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Làm mới"
            icon={<ReloadOutlined className={fetchingJobs ? 'animate-spin' : ''} />}
            className="!h-11 !w-11 !rounded-lg border-slate-200"
            onClick={() => {
              refetchJobs();
              refetchCurrent();
              refetchHistory();
            }}
          />
          <Button
            icon={<FileTextOutlined />}
            className="!h-11 !rounded-lg border-slate-200 font-semibold text-[#0284C7] hover:!border-[#0284C7]"
            onClick={() => navigate('/client/jobs')}
          >
            Tin tuyển dụng
          </Button>
        </div>
      </div>

      {/* ── 2. Metric Strip: Process Overview Pills ── */}
      <div
        role="radiogroup"
        aria-label="Lọc theo trạng thái thỏa thuận"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5 rounded-2xl bg-slate-100/70 p-1.5 border border-slate-200/80"
      >
        {(
          [
            ['ALL', 'Tất cả', counts.all, false],
            ['PENDING_AGREEMENT', 'Chờ ký kết', counts.pendingAgreement, counts.pendingAgreement > 0],
            ['PENDING_PAYMENT', 'Chờ thanh toán', counts.pendingPayment, counts.pendingPayment > 0],
            ['ACTIVE', 'Đang tuyển dụng', counts.active, false],
            ['CLOSED', 'Đã đóng / dừng', counts.closed, false],
          ] as const
        ).map(([key, label, count, needsAction]) => {
          const selected = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleStatusFilterChange(key)}
              className={`group relative cursor-pointer rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                selected
                  ? 'border-[#0284C7] bg-white shadow-sm ring-2 ring-[#0284C7]/20'
                  : needsAction
                  ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/70 to-amber-50/30 hover:bg-white hover:border-slate-300'
                  : 'border-transparent bg-transparent hover:bg-white hover:border-slate-200 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs ${selected ? 'font-bold text-[#0284C7]' : 'font-medium text-slate-600'}`}>
                  {label}
                </span>
                {needsAction && (
                  <span className="flex h-2 w-2 items-center justify-center" aria-label="cần xử lý">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  </span>
                )}
              </div>
              <div className={`mt-1.5 text-2xl font-black tabular-nums tracking-tight ${selected ? 'text-[#0284C7]' : 'text-slate-900'}`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 3. Main Master-Detail Layout ── */}
      {loadingJobs ? (
        <Surface className="p-8 rounded-2xl bg-white border border-slate-200/90">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Surface>
      ) : eligibleJobs.length === 0 ? (
        <Surface className="p-12 text-center rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <Empty
            description={
              <div className="space-y-2">
                <Text strong className="text-base text-slate-800">
                  Chưa có thỏa thuận dịch vụ nào
                </Text>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Các vị trí tuyển dụng theo dịch vụ <strong>Tuyển dụng theo kết quả</strong>{' '}
                  hoặc <strong>Tìm hồ sơ phù hợp (CV Sourcing)</strong> sẽ xuất hiện tại đây sau khi được
                  HR Connect lập dự thảo thỏa thuận thương mại.
                </p>
              </div>
            }
          >
            <Button
              type="primary"
              className="!bg-[#0369A1] hover:!bg-[#075985] !border-0 rounded-xl font-bold !h-10 px-5 text-white shadow-sm shadow-sky-500/20"
              onClick={() => navigate('/client/jobs/create')}
            >
              Đăng tin tuyển dụng mới
            </Button>
          </Empty>
        </Surface>
      ) : (
        <Row gutter={[24, 24]}>
          {/* ── Left Column: Job Selector ── */}
          <Col xs={24} lg={8} xl={7}>
            <Surface className="p-4 rounded-2xl space-y-3 bg-white border border-slate-200/90 shadow-2xs">
              {/* Header Title & Counter */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <Text strong className="text-sm font-bold text-slate-900 block">
                    Vị trí tuyển dụng
                  </Text>
                  <span className="text-xs text-slate-500">
                    {filteredJobs.length} / {eligibleJobs.length} vị trí
                  </span>
                </div>
                {activeJob?.serviceTypeCode && SERVICE_TYPE_LABEL[activeJob.serviceTypeCode] && (
                  <span
                    className={`m-0 text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
                      activeJob.serviceTypeCode === 'HEADHUNT_COD'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                  >
                    {SERVICE_TYPE_LABEL[activeJob.serviceTypeCode].label}
                  </span>
                )}
              </div>

              {/* Search Control */}
              <Input
                placeholder="Tìm theo tên vị trí..."
                prefix={<SearchOutlined className="text-slate-400 text-xs" />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                size="large"
                className="!rounded-xl"
                aria-label="Tìm theo tên vị trí"
              />

              {/* Jobs List */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 pt-1" tabIndex={0} role="region" aria-label="Danh sách vị trí tuyển dụng">
                {filteredJobs.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Không có vị trí phù hợp"
                    className="py-10"
                  />
                ) : (
                  filteredJobs.map((job) => {
                    const isSelected = job.jobId === activeJobId;
                    const statusMeta = JOB_STATUS[job.status] ?? { label: job.status, color: 'default' };
                    const isSignedPendingReview =
                      job.status === 'PENDING_AGREEMENT' &&
                      Boolean(
                        job.hasSignedAgreement ||
                          (job.jobId === activeJobId &&
                            (currentAgreement?.status === 'SIGNED' ||
                              Boolean(currentAgreement?.hasSignedDocument) ||
                              Boolean(currentAgreement?.signedAt)))
                      );
                    const isAwaitingAction =
                      job.status === 'PENDING_AGREEMENT' || job.status === 'PENDING_PAYMENT';

                    return (
                      <button
                        key={job.jobId}
                        type="button"
                        onClick={() => {
                          setActiveJobId(job.jobId);
                          setSearchParams({ jobId: job.jobId }, { replace: true });
                        }}
                        className={`w-full cursor-pointer text-left rounded-xl p-3.5 transition-all border relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                          isSelected
                            ? 'border-[#0284C7] bg-sky-50/70 shadow-2xs ring-2 ring-[#0284C7]/20 border-l-4 border-l-[#0284C7]'
                            : isSignedPendingReview
                            ? 'border-teal-200/90 bg-teal-50/30 hover:border-teal-300 hover:bg-teal-50/50'
                            : isAwaitingAction
                            ? 'border-amber-300/80 bg-amber-50/30 hover:border-amber-400 hover:bg-amber-50/50'
                            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Text
                            strong
                            className={`text-sm line-clamp-1 ${
                              isSelected ? 'text-[#0284C7] font-bold' : 'text-slate-900'
                            }`}
                          >
                            {job.title}
                          </Text>
                          {(() => {
                            if (isSignedPendingReview) {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-teal-200 bg-teal-50 text-teal-700">
                                  Chờ HR duyệt bản ký
                                </span>
                              );
                            }
                            if (job.status === 'PENDING_PAYMENT' && isDeposited(job)) {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-sky-200 bg-sky-50 text-sky-700">
                                  Đã nộp cọc
                                </span>
                              );
                            }
                            if (job.status === 'ACTIVE') {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700">
                                  Đang tuyển
                                </span>
                              );
                            }
                            if (job.status === 'PENDING_AGREEMENT') {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-purple-200 bg-purple-50 text-purple-700">
                                  Chờ ký thỏa thuận
                                </span>
                              );
                            }
                            if (job.status === 'PENDING_PAYMENT') {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-amber-200 bg-amber-50 text-amber-700">
                                  Chờ thanh toán
                                </span>
                              );
                            }
                            if (job.status === 'CLOSED' || job.status === 'PAUSED') {
                              return (
                                <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-slate-200 bg-slate-100 text-slate-600">
                                  {job.status === 'PAUSED' ? 'Tạm dừng' : 'Đã đóng'}
                                </span>
                              );
                            }
                            return (
                              <span className="m-0 text-[10.5px] font-bold shrink-0 rounded px-2 py-0.5 border border-slate-200 bg-slate-100 text-slate-700">
                                {statusMeta.label}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">
                            {SERVICE_TYPE_LABEL[job.serviceTypeCode as keyof typeof SERVICE_TYPE_LABEL]?.label ?? job.serviceTypeCode}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {dayjs(job.updatedAt).format('DD/MM/YYYY')}
                          </span>
                        </div>

                        {job.status === 'PENDING_AGREEMENT' && (
                          <div
                            className={`mt-2 pt-1.5 border-t ${
                              isSignedPendingReview
                                ? 'border-teal-100 text-teal-700'
                                : 'border-amber-200 text-amber-800'
                            } flex items-center gap-1.5 text-[11px] font-semibold`}
                          >
                            <SafetyCertificateOutlined />
                            <span>
                              {isSignedPendingReview
                                ? 'Đã nộp bản ký · Chờ HR duyệt'
                                : 'Cần ký & tải lên hợp đồng'}
                            </span>
                          </div>
                        )}
                        {job.status === 'PENDING_PAYMENT' && (
                          <div
                            className={`mt-2 pt-1.5 border-t ${
                              isDeposited(job) ? 'border-blue-100 text-blue-700' : 'border-amber-200 text-amber-800'
                            } flex items-center gap-1.5 text-[11px] font-semibold`}
                          >
                            {isDeposited(job) ? <CheckCircleFilled /> : <ClockCircleOutlined />}
                            <span>{isDeposited(job) ? 'Đã nộp cọc · Chờ HR duyệt' : 'Đã ký · Chờ nộp tiền cọc'}</span>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </Surface>
          </Col>

          {/* ── Right Column: Agreement Details & Actions ── */}
          <Col xs={24} lg={16} xl={17}>
            {loadingAgreement ? (
              <Surface className="p-8 rounded-2xl bg-white border border-slate-200/90">
                <Skeleton active paragraph={{ rows: 10 }} />
              </Surface>
            ) : !currentAgreement ? (
              <Surface className="p-12 text-center rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="space-y-2 py-4">
                      <Text strong className="text-slate-800 text-base">
                        Chưa có bản thảo thỏa thuận dịch vụ
                      </Text>
                      <p className="text-slate-500 text-sm max-w-md mx-auto">
                        HR Connect đang kiểm tra thông tin và chuẩn bị dự thảo điều khoản thương mại cho
                        vị trí <strong>"{activeJob?.title}"</strong>. Sau khi dự thảo được gửi, bạn sẽ nhận
                        được thông báo và có thể ký kết tại đây.
                      </p>
                    </div>
                  }
                />
              </Surface>
            ) : (
              <div className="space-y-6">
                {/* ── Current Agreement Card ── */}
                <Surface className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-6">
                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Text strong className="text-lg font-bold text-slate-900">
                          Thỏa thuận dịch vụ{' '}
                          {activeJob?.serviceTypeCode ? SERVICE_TYPE_LABEL[activeJob.serviceTypeCode]?.label : ''}
                        </Text>
                        {(() => {
                          const s = currentAgreement.status;
                          const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
                            DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Dự thảo' },
                            SENT_TO_CLIENT: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'Chờ phản hồi' },
                            CHANGE_REQUESTED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Yêu cầu điều chỉnh' },
                            ACCEPTED: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', label: 'Đã chấp thuận' },
                            AWAITING_SIGNATURE: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Chờ nộp HĐ đã ký' },
                            SIGNED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Đã ký kết' },
                            VOID: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Đã hủy' },
                            LEGACY_CONFIRMED: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Đã xác nhận' },
                          };
                          const meta = styles[s] ?? {
                            bg: 'bg-slate-100',
                            text: 'text-slate-700',
                            border: 'border-slate-200',
                            label: SERVICE_AGREEMENT_STATUS[s]?.label ?? s,
                          };
                          return (
                            <span className={`font-bold text-xs rounded-full border px-2.5 py-0.5 ${meta.bg} ${meta.text} ${meta.border}`}>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-4">
                        <span>
                          Vị trí: <strong className="text-slate-800">{activeJob?.title}</strong>
                        </span>
                        <span>
                          Số HĐ:{' '}
                          <code className="text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                            {currentAgreement.verificationCode || 'Đang cấp'}
                          </code>
                        </span>
                        <span>
                          Tạo ngày: {dayjs(currentAgreement.createdAt).format('DD/MM/YYYY HH:mm')}
                        </span>
                        {currentAgreement.signedAt && (
                          <span className="text-emerald-700 font-bold">
                            Ký ngày: {dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons in header */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isPendingPayment && (
                        <Button
                          type="primary"
                          icon={isDeposited(activeJob) ? <CheckCircleFilled /> : <CreditCardOutlined />}
                          disabled={isDeposited(activeJob)}
                          className={
                            isDeposited(activeJob)
                              ? '!bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed rounded-xl font-bold h-10'
                              : '!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-2xs font-bold h-10 px-4'
                          }
                          onClick={() => !isDeposited(activeJob) && setPaymentModalOpen(true)}
                        >
                          {isDeposited(activeJob)
                            ? 'Đã nộp cọc (Chờ HR duyệt)'
                            : isAwaitingDeposit
                            ? (depositText ? `Đặt cọc (${depositText})` : 'Đặt cọc')
                            : 'Thanh toán phí đăng tin'}
                        </Button>
                      )}
                      {isPendingResponse && (
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => setReviseModalOpen(true)}
                          className="!h-10 !rounded-xl font-semibold border-slate-200 text-slate-700 hover:!border-slate-300"
                        >
                          Yêu cầu điều chỉnh
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Status Banner Cards ── */}
                  {isPendingResponse && !currentAgreement.hasSignedDocument && !isPendingPayment && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 flex items-center gap-3 text-sm text-sky-950">
                      <InfoCircleOutlined className="text-sky-600 text-base shrink-0" />
                      <span>
                        HR Connect đã chuẩn bị hợp đồng dịch vụ. Quý doanh nghiệp vui lòng <strong>xem / tải về</strong>, ký kết và <strong>tải lên bản đã ký</strong> để kích hoạt tin tuyển dụng.
                      </span>
                    </div>
                  )}

                  {isPendingPayment ? (
                    isDeposited(activeJob) ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-blue-950 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-start gap-3">
                          <CheckCircleFilled className="text-blue-600 text-xl mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="font-bold text-blue-900 flex items-center gap-2">
                              Đã xác nhận nộp tiền cọc dịch vụ tìm kiếm hồ sơ
                              <span className="m-0 font-bold text-xs px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">Chờ HR xác nhận</span>
                            </div>
                            <div className="text-xs text-blue-800 leading-relaxed">
                              Doanh nghiệp đã hoàn tất gửi thông tin nộp cọc{depositText ? ` (${depositText})` : ''}. Đội ngũ HR Connect đang đối soát và sẽ kích hoạt tin tuyển dụng trong thời gian sớm nhất.
                            </div>
                          </div>
                        </div>
                        <Button
                          disabled
                          className="!bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed rounded-xl font-semibold shrink-0 self-start sm:self-center"
                        >
                          Đã gửi xác nhận nộp cọc
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-start gap-3">
                          <CreditCardOutlined className="text-amber-600 text-xl mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="font-bold text-amber-900 flex items-center gap-2">
                              {isAwaitingDeposit ? 'Chờ đặt cọc dịch vụ tìm kiếm hồ sơ' : 'Chờ thanh toán phí gói đăng tin'}
                              <span className="m-0 font-bold text-xs px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">Chờ thanh toán</span>
                            </div>
                            <div className="text-xs text-amber-800 leading-relaxed">
                              {isAwaitingDeposit
                                ? `Hợp đồng đã được ký kết. Quý doanh nghiệp vui lòng nộp tiền cọc (${depositText ?? DEPOSIT_PENDING_TEXT}) để mở nguồn ứng viên và tiến hành săn đón hồ sơ.`
                                : 'Nội dung tin đã được duyệt. Quý doanh nghiệp vui lòng hoàn tất thanh toán phí gói đăng tin để công khai tin tuyển dụng.'}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          icon={<CreditCardOutlined />}
                          className="!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-2xs font-bold !h-10 px-5 shrink-0 self-start sm:self-center transition-all active:scale-[0.98]"
                          onClick={() => setPaymentModalOpen(true)}
                        >
                          {isAwaitingDeposit ? 'Đặt cọc ngay' : 'Thanh toán ngay'}
                        </Button>
                      </div>
                    )
                  ) : isPendingResponse && currentAgreement.hasSignedDocument ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 text-sm flex items-start gap-3">
                      <CheckCircleFilled className="text-emerald-600 text-lg mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <div className="font-bold">Đã tải lên hợp đồng đã ký thành công</div>
                        <div className="text-xs text-emerald-800 leading-relaxed">
                          Doanh nghiệp đã nộp bản hợp đồng ký kết{currentAgreement.signedAt ? ` vào ngày ${dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')}` : ''}.
                          Đội ngũ HR Connect đang đối soát và sẽ công khai tin tuyển dụng trong thời gian sớm nhất.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {currentAgreement.status === 'CHANGE_REQUESTED' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 text-sm flex items-start gap-3">
                      <ClockCircleOutlined className="text-amber-600 text-lg mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <div className="font-bold">Đang chờ HR Connect xem xét yêu cầu điều chỉnh</div>
                        <div className="text-xs text-amber-800 leading-relaxed">
                          Doanh nghiệp đã gửi yêu cầu điều chỉnh với nội dung:{' '}
                          <span className="italic font-semibold">
                            "{currentAgreement.changeRequestReason}"
                          </span>
                          . HR Connect sẽ xem xét và cập nhật lại bản hợp đồng trong thời gian sớm nhất.
                        </div>
                      </div>
                    </div>
                  )}

                  {currentAgreement.status === 'SIGNED' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 text-sm flex items-start gap-3">
                      <CheckCircleFilled className="text-emerald-600 text-lg mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <div className="font-bold">Hợp đồng dịch vụ đã có hiệu lực pháp lý</div>
                        <div className="text-xs text-emerald-800 leading-relaxed">
                          Hợp đồng đã hoàn tất thủ tục ký kết giữa hai bên vào ngày{' '}
                          {dayjs(currentAgreement.signedAt || currentAgreement.createdAt).format('DD/MM/YYYY HH:mm')}.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Commercial Terms Summary Grid ── */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Điều khoản thương mại chính
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {activeJob?.serviceTypeCode === 'HEADHUNT_COD' ? (
                        <>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Phí tuyển dụng</span>
                            <span className="text-base font-black text-slate-900">
                              {currentAgreement.feeMultiplier != null ? `${currentAgreement.feeMultiplier} tháng lương` : 'Theo thỏa thuận'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Thời gian bảo hành</span>
                            <span className="text-base font-black text-slate-900">
                              {currentAgreement.warrantyDays != null ? `${currentAgreement.warrantyDays} ngày` : '—'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Hạn thanh toán</span>
                            <span className="text-base font-black text-slate-900">
                              {currentAgreement.paymentDueDays != null ? `${currentAgreement.paymentDueDays} ngày` : '—'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Đổi người thay thế</span>
                            {/* TODO(ReplacementPolicy): ServiceAgreementDto chưa có chính sách thay thế; hiển thị theo hợp đồng cho tới khi BE trả về. */}
                            <span className="text-base font-black text-emerald-700">Theo điều khoản hợp đồng</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Số lượng CV mục tiêu</span>
                            <span className="text-base font-black text-slate-900">
                              {currentAgreement.sourcingTarget != null ? `${currentAgreement.sourcingTarget} hồ sơ` : '—'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Đơn giá mỗi CV</span>
                            <span className="text-base font-black text-slate-900">
                              {currentAgreement.pricePerQualifiedCv != null
                                ? formatMoney(currentAgreement.pricePerQualifiedCv, 'VND')
                                : '—'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">Tổng phí dự kiến</span>
                            <span className="text-base font-black text-slate-900">
                              {sourcingEstimatedTotal != null ? formatMoney(sourcingEstimatedTotal, 'VND') : '—'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <span className="text-xs text-slate-500 font-medium block">
                              Tiền cọc ban đầu{depositPercent ? ` (${depositPercent}%)` : ''}
                            </span>
                            <span className="text-base font-black text-[#0284C7]">
                              {depositText ?? DEPOSIT_PENDING_TEXT}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Document Action Box ── */}
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
                    {/* Row 1: Original agreement from HR Connect */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 text-2xl shrink-0">
                          <FilePdfOutlined />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900">Văn bản hợp đồng dịch vụ</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Do HR Connect soạn thảo · Số HĐ: {currentAgreement.verificationCode} · Định dạng PDF
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => handleViewDocument(currentAgreement, false)}
                          className="!rounded-xl font-semibold !h-9 text-slate-700 border-slate-200"
                        >
                          Xem
                        </Button>
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => handleSaveDocument(currentAgreement, false)}
                          className="!rounded-xl font-semibold !h-9 text-slate-700 border-slate-200"
                        >
                          Tải về
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: Signed document from client */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${
                        currentAgreement.hasSignedDocument ? 'bg-emerald-50/30' : 'bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
                            currentAgreement.hasSignedDocument
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-600'
                              : 'bg-white border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          {currentAgreement.hasSignedDocument ? <CheckCircleFilled /> : <FileTextOutlined />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Hợp đồng đã ký
                            {currentAgreement.hasSignedDocument ? (
                              <span className="m-0 text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 rounded px-2 py-0.5">Đã nộp</span>
                            ) : (
                              <span className="m-0 text-[10px] font-bold border border-amber-300 bg-amber-50 text-amber-800 rounded px-2 py-0.5">Chưa nộp</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {currentAgreement.hasSignedDocument
                              ? `${currentAgreement.signedAt ? `Nộp lúc ${dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')} · ` : ''}Đang chờ HR Connect duyệt`
                              : 'Bản hợp đồng có chữ ký / con dấu của doanh nghiệp'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentAgreement.hasSignedDocument && (
                          <Button
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDocument(currentAgreement, true)}
                            className="!rounded-xl font-semibold !h-9 text-slate-700 border-slate-200"
                          >
                            Xem
                          </Button>
                        )}
                        {isPendingPayment && (
                          <Button
                            type="primary"
                            icon={isDeposited(activeJob) ? <CheckCircleFilled /> : <CreditCardOutlined />}
                            disabled={isDeposited(activeJob)}
                            className={
                              isDeposited(activeJob)
                                ? '!bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed rounded-xl font-semibold'
                                : '!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-2xs font-bold !h-9 px-4 transition-all active:scale-[0.98]'
                            }
                            onClick={() => !isDeposited(activeJob) && setPaymentModalOpen(true)}
                          >
                            {isDeposited(activeJob)
                              ? 'Đã nộp cọc'
                              : isAwaitingDeposit
                              ? 'Đặt cọc'
                              : 'Thanh toán'}
                          </Button>
                        )}
                        {isPendingResponse && (
                          <Button
                            type={currentAgreement.hasSignedDocument ? 'default' : 'primary'}
                            icon={<UploadOutlined />}
                            className={
                              currentAgreement.hasSignedDocument
                                ? '!h-9 rounded-xl font-semibold text-slate-700 border-slate-200'
                                : '!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-2xs transition-all active:scale-[0.98] font-bold !h-9 px-4'
                            }
                            onClick={() => setUploadModalOpen(true)}
                          >
                            {currentAgreement.hasSignedDocument ? 'Thay thế' : 'Tải lên'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Extra conditions */}
                  {currentAgreement.agreementNote && (
                    <div className="rounded-xl border border-slate-200/90 p-4 bg-slate-50/60 space-y-1">
                      <div className="text-xs font-bold text-slate-700">
                        Ghi chú bổ sung từ HR Connect:
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {currentAgreement.agreementNote}
                      </div>
                    </div>
                  )}
                </Surface>

                {/* ── Revision History Card ── */}
                {historyAgreements.length > 1 && (
                  <Surface className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2">
                      <HistoryOutlined className="text-slate-500" />
                      <Text strong className="text-sm font-bold text-slate-900">
                        Lịch sử các phiên bản thỏa thuận ({historyAgreements.length})
                      </Text>
                    </div>

                    <Table
                      dataSource={historyAgreements}
                      rowKey="serviceAgreementId"
                      pagination={false}
                      size="middle"
                      className="admin-soft-table"
                      columns={[
                        {
                          title: 'Phiên bản',
                          dataIndex: 'version',
                          key: 'version',
                          render: (v: number) => <Tag color="blue" className="font-bold border-0">v{v}</Tag>,
                        },
                        {
                          title: 'Trạng thái',
                          dataIndex: 'status',
                          key: 'status',
                          render: (st: string) => {
                            const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
                              DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Dự thảo' },
                              SENT_TO_CLIENT: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'Chờ phản hồi' },
                              CHANGE_REQUESTED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Yêu cầu điều chỉnh' },
                              ACCEPTED: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', label: 'Đã chấp thuận' },
                              AWAITING_SIGNATURE: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Chờ nộp HĐ đã ký' },
                              SIGNED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Đã ký kết' },
                              VOID: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Đã hủy' },
                              LEGACY_CONFIRMED: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Đã xác nhận' },
                            };
                            const meta = styles[st] ?? {
                              bg: 'bg-slate-100',
                              text: 'text-slate-700',
                              border: 'border-slate-200',
                              label: SERVICE_AGREEMENT_STATUS[st as keyof typeof SERVICE_AGREEMENT_STATUS]?.label ?? st,
                            };
                            return (
                              <span className={`font-semibold text-xs rounded px-2 py-0.5 border ${meta.bg} ${meta.text} ${meta.border}`}>
                                {meta.label}
                              </span>
                            );
                          },
                        },
                        {
                          title: 'Ngày tạo',
                          dataIndex: 'createdAt',
                          key: 'createdAt',
                          render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
                        },
                        {
                          title: 'Phản hồi / Ghi chú',
                          key: 'note',
                          render: (_: unknown, r: ServiceAgreementDto) =>
                            r.changeRequestReason || r.agreementNote || '—',
                        },
                        {
                          title: 'Tài liệu',
                          key: 'action',
                          render: (_: unknown, r: ServiceAgreementDto) => (
                            <Button
                              type="link"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownloadPdf(r)}
                              className="font-bold text-[#0284C7] hover:underline p-0"
                            >
                              Tải PDF
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </Surface>
                )}
              </div>
            )}
          </Col>
        </Row>
      )}

      {/* ── Modal: Yêu cầu điều chỉnh hợp đồng ── */}
      <Modal
        title={<span className="font-bold text-slate-900">Yêu cầu điều chỉnh hợp đồng</span>}
        open={reviseModalOpen}
        onCancel={() => setReviseModalOpen(false)}
        onOk={handleRequestRevision}
        confirmLoading={submittingRevision}
        okText="Gửi yêu cầu điều chỉnh"
        cancelText="Đóng"
        destroyOnHidden
        className={FONT}
        okButtonProps={{ className: '!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 rounded-xl font-bold h-9' }}
        cancelButtonProps={{ className: '!rounded-xl font-semibold h-9' }}
      >
        <div className="space-y-4 py-2">
          <Paragraph className="text-xs text-slate-600 mb-0">
            Quý doanh nghiệp vui lòng nhập nội dung đề xuất điều chỉnh về hợp đồng dịch vụ đã nhận.
            Đội ngũ Internal HR sẽ xem xét để phản hồi và cập nhật lại bản hợp đồng.
          </Paragraph>

          <Input.TextArea
            rows={4}
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            placeholder="Ví dụ: Đề xuất điều chỉnh điều khoản thanh toán, bổ sung thông tin đại diện pháp lý hoặc thời hạn phản hồi..."
            maxLength={1000}
            showCount
            className="!rounded-xl"
          />
        </div>
      </Modal>

      {/* ── Modal: Xem hợp đồng ── */}
      <Modal
        title={<span className="font-bold text-slate-900">{preview?.title}</span>}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        width={960}
        centered
        destroyOnHidden
        className={FONT}
        footer={[
          <Button
            key="tab"
            onClick={() => preview && window.open(preview.url, '_blank', 'noopener,noreferrer')}
            className="!rounded-xl font-semibold h-9"
          >
            Mở tab mới
          </Button>,
          <Button
            key="close"
            type="primary"
            className="!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 text-white rounded-xl shadow-2xs font-bold h-9"
            onClick={() => setPreview(null)}
          >
            Đóng
          </Button>,
        ]}
      >
        {preview && (
          <iframe
            title={preview.title}
            src={preview.url}
            className="w-full h-[70vh] rounded-xl border border-slate-200 bg-slate-50"
          />
        )}
      </Modal>

      {/* ── Modal: Tải lên hợp đồng đã ký ── */}
      <Modal
        title={<span className="font-bold text-slate-900">Tải lên hợp đồng dịch vụ đã ký</span>}
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setFileList([]);
        }}
        onOk={handleUploadSignedFile}
        confirmLoading={uploading}
        okText="Xác nhận tải lên"
        cancelText="Hủy"
        destroyOnHidden
        className={FONT}
        okButtonProps={{ className: '!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 rounded-xl font-bold h-9' }}
        cancelButtonProps={{ className: '!rounded-xl font-semibold h-9' }}
      >
        <div className="space-y-4 py-2">
          <Paragraph className="text-xs text-slate-600 mb-0">
            Quý doanh nghiệp vui lòng tải lên bản hợp đồng dịch vụ đã có đầy đủ chữ ký hoặc con dấu của người đại diện hợp pháp.
          </Paragraph>

          <Upload.Dragger
            name="file"
            multiple={false}
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              const isValidExt = /\.(pdf|png|jpe?g|docx?)$/i.test(file.name);
              if (!isValidExt) {
                message.error('Chỉ chấp nhận tệp định dạng PDF, hình ảnh (JPG, PNG) hoặc Word (DOC, DOCX).');
                return Upload.LIST_IGNORE;
              }
              const isLt25M = file.size / 1024 / 1024 < 25;
              if (!isLt25M) {
                message.error('Kích thước tệp tin phải nhỏ hơn 25MB.');
                return Upload.LIST_IGNORE;
              }
              const rcFile = file as RcFile;
              const uploadFileItem: UploadFile = {
                uid: rcFile.uid || `${Date.now()}`,
                name: rcFile.name,
                size: rcFile.size,
                type: rcFile.type,
                status: 'done',
                originFileObj: rcFile,
              };
              setFileList([uploadFileItem]);
              return false;
            }}
            onChange={({ fileList: newFileList }) => {
              if (newFileList.length > 0) {
                const latest = newFileList[newFileList.length - 1];
                setFileList([latest]);
              } else {
                setFileList([]);
              }
            }}
            onRemove={() => {
              setFileList([]);
            }}
            className="!rounded-2xl"
          >
            <p className="ant-upload-drag-icon text-[#0284C7] text-4xl mb-2">
              <InboxOutlined />
            </p>
            <p className="text-sm font-bold text-slate-800">
              Nhấp hoặc kéo thả tệp hợp đồng đã ký vào đây
            </p>
            <p className="text-xs text-slate-400">
              Định dạng hỗ trợ: PDF, JPG, PNG, DOC, DOCX. Dung lượng tối đa 25MB.
            </p>
          </Upload.Dragger>
        </div>
      </Modal>

      {/* ── Modal: Thanh toán / Đặt cọc dịch vụ ── */}
      {activeJob && (
        <PaymentDemoModal
          open={paymentModalOpen}
          jobId={activeJob.jobId}
          jobTitle={activeJob.title}
          isDeposit={isAwaitingDeposit}
          depositAmount={depositAmount}
          serviceTypeCode={activeJob.serviceTypeCode}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentSuccess={async () => {
            setPaymentModalOpen(false);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: jobQueryKeys.all }),
              refetchCurrent(),
              refetchHistory(),
            ]);
          }}
        />
      )}
    </div>
  );
};

export default ClientServiceAgreementsPage;
