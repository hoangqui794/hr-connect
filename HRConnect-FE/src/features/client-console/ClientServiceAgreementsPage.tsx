/**
 * @file ClientServiceAgreementsPage.tsx
 * @description Client Service Agreements management page (MF-01).
 * Allows client companies to review commercial terms, request adjustments,
 * and digitally sign service agreements (Headhunt / CV Sourcing) via email OTP.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Surface } from '@/features/admin-console/ui';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorMessage } from '@/services/apiClient';
import { serviceAgreementsApi } from '@/services/api/jobsApi';
import {
  formatMoney,
  useCurrentServiceAgreement,
  useMyJobs,
  useServiceAgreementHistory,
} from '@/features/jobs-mf01/useJobQueries';
import {
  JOB_STATUS,
  SERVICE_AGREEMENT_STATUS,
  SERVICE_TYPE_LABEL,
} from '@/features/jobs-mf01/jobDisplay';
import type { ServiceAgreementDto } from '@/types/api/jobs';

const { Text, Title, Paragraph } = Typography;

type AgreementTabKey = 'ALL' | 'PENDING_AGREEMENT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'CLOSED';

export const ClientServiceAgreementsPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const selectedJobIdParam = searchParams.get('jobId') || '';

  // 1. Fetch Client's jobs (focusing on Headhunt and CV Sourcing)
  const { data: allJobs = [], isLoading: loadingJobs } = useMyJobs();

  const eligibleJobs = useMemo(() => {
    return allJobs.filter(
      (j) => j.serviceTypeCode === 'HEADHUNT_COD' || j.serviceTypeCode === 'CV_SOURCING'
    );
  }, [allJobs]);

  // Filter state: Search + Status Select
  const [statusFilter, setStatusFilter] = useState<AgreementTabKey>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Breakdown counts for select options
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
        const target = eligibleJobs.find((j) => j.jobId === selectedJobIdParam);
        if (target) {
          if (target.status === 'PENDING_AGREEMENT') setStatusFilter('PENDING_AGREEMENT');
          else if (target.status === 'PENDING_PAYMENT') setStatusFilter('PENDING_PAYMENT');
          else if (target.status === 'ACTIVE') setStatusFilter('ACTIVE');
          else if (target.status === 'CLOSED' || target.status === 'PAUSED') setStatusFilter('CLOSED');
        }
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

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [activeConcurrencyToken, setActiveConcurrencyToken] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState(false);

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

  // Tải file về máy (fallback mở tab mới nếu trình duyệt chặn CORS)
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
    if (fileList.length === 0 || !fileList[0].originFileObj) {
      message.warning('Vui lòng chọn tệp hợp đồng đã ký để tải lên.');
      return;
    }
    const file = fileList[0].originFileObj as File;
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
      await Promise.all([refetchCurrent(), refetchHistory()]);
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
      setReviseModalOpen(false);
      setRevisionReason('');
      await Promise.all([refetchCurrent(), refetchHistory()]);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Action: Open Sign Modal & Send OTP
  const handleOpenSignModal = async () => {
    if (!currentAgreement || !activeJobId) return;
    setSignModalOpen(true);
    setOtpSent(false);
    setOtpCode('');
    setDevOtp(null);
    setActiveConcurrencyToken(currentAgreement.concurrencyToken);
    setConsentChecked(false);
    // Request challenge immediately
    sendChallenge(currentAgreement.serviceAgreementId);
  };

  const sendChallenge = async (agreementId: string) => {
    if (!activeJobId || !currentAgreement) return;
    try {
      setSendingChallenge(true);
      const res = await serviceAgreementsApi.createSignatureChallenge(activeJobId, agreementId);
      setOtpSent(true);

      if (res.concurrencyToken) {
        setActiveConcurrencyToken(res.concurrencyToken);
      }

      // Auto-extract dev OTP if available
      const extractedOtp = res.devOtp || res.message?.match(/\b\d{6}\b/)?.[0] || null;
      if (extractedOtp) {
        setDevOtp(extractedOtp);
        setOtpCode(extractedOtp);
      }

      message.success(
        res.message || `Mã OTP xác thực đã được gửi tới email ${res.signerEmail}.`,
        12
      );
      await refetchCurrent();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setSendingChallenge(false);
    }
  };


  // Action: Submit Sign
  const handleConfirmSign = async () => {
    if (!currentAgreement || !activeJobId) return;
    if (!otpCode || otpCode.trim().length !== 6) {
      message.warning('Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số.');
      return;
    }
    if (!consentChecked) {
      message.warning('Vui lòng tích xác nhận đồng ý các điều khoản thỏa thuận.');
      return;
    }

    try {
      setSigningLoading(true);
      const tokenToUse = activeConcurrencyToken || currentAgreement.concurrencyToken;
      await serviceAgreementsApi.sign(activeJobId, currentAgreement.serviceAgreementId, {
        concurrencyToken: tokenToUse,
        otp: otpCode.trim(),
        consentAccepted: true,
        consentTextVersion: '1.0',
      });

      message.success('Ký thỏa thuận dịch vụ thành công!');
      setSignModalOpen(false);
      await Promise.all([refetchCurrent(), refetchHistory()]);

      // Pop-up next steps
      if (activeJob?.serviceTypeCode === 'CV_SOURCING') {
        modal.success({
          title: 'Thỏa thuận đã được ký kết!',
          content: (
            <div className="space-y-2 py-2">
              <p>
                Thỏa thuận tìm kiếm hồ sơ cho vị trí <strong>{activeJob.title}</strong> đã được hai
                bên ký kết thành công.
              </p>
              <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Bước tiếp theo: Vui lòng hoàn tất nộp tiền cọc để HR Connect và mạng lưới CTV bắt đầu tìm
                kiếm & sàng lọc hồ sơ chất lượng cao cho doanh nghiệp.
              </p>
            </div>
          ),
          okText: 'Xem tin tuyển dụng',
          onOk: () => navigate(`/client/jobs?highlight=${encodeURIComponent(activeJob.jobId)}`),
        });
      } else {
        modal.success({
          title: 'Thỏa thuận tuyển dụng đã có hiệu lực!',
          content: (
            <div className="space-y-2 py-2">
              <p>
                Thỏa thuận tuyển dụng theo kết quả (Headhunt) cho vị trí{' '}
                <strong>{activeJob?.title}</strong> đã được kích hoạt thành công.
              </p>
              <p className="text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                Tin tuyển dụng đã chính thức công khai. Các chuyên gia tuyển dụng và cộng tác viên của
                HR Connect sẽ bắt đầu giới thiệu những ứng viên sáng giá nhất!
              </p>
            </div>
          ),
          okText: 'Xem chi tiết tin tuyển dụng',
          onOk: () =>
            activeJob && navigate(`/client/jobs?highlight=${encodeURIComponent(activeJob.jobId)}`),
        });
      }
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setSigningLoading(false);
    }
  };

  // Helper calculation for CV Sourcing
  const sourcingEstimatedTotal = useMemo(() => {
    if (!currentAgreement || activeJob?.serviceTypeCode !== 'CV_SOURCING') return null;
    const count = currentAgreement.sourcingTarget ?? 0;
    const price = currentAgreement.pricePerQualifiedCv ?? 0;
    return count * price;
  }, [currentAgreement, activeJob]);

  const sourcingEstimatedDeposit = useMemo(() => {
    if (!sourcingEstimatedTotal) return null;
    // Default deposit 30% if not explicitly set
    return Math.round((sourcingEstimatedTotal * 30) / 100);
  }, [sourcingEstimatedTotal]);

  const isPendingResponse =
    currentAgreement?.status === 'SENT_TO_CLIENT' ||
    currentAgreement?.status === 'ACCEPTED' ||
    currentAgreement?.status === 'AWAITING_SIGNATURE';

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <Surface className="border-0 bg-white p-6 shadow-sm rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Title level={4} className="!mb-0 text-slate-900 font-bold">
                Thỏa thuận & Hợp đồng dịch vụ
              </Title>
              <Tag color="blue" className="rounded-full px-2.5 font-medium">
                Doanh nghiệp
              </Tag>
            </div>
            <Paragraph className="!mb-0 text-slate-500 text-sm mt-1 max-w-2xl">
              Xem xét, phản hồi điều khoản thương mại và ký số điện tử qua OTP cho các vị trí tuyển dụng
              Headhunt hoặc tìm kiếm hồ sơ ứng viên (CV Sourcing).
            </Paragraph>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                refetchCurrent();
                refetchHistory();
              }}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/client/jobs')}
            >
              Quản lý tin tuyển dụng
            </Button>
          </div>
        </div>
      </Surface>

      {/* Main Content Area */}
      {loadingJobs ? (
        <Surface className="p-8">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Surface>
      ) : eligibleJobs.length === 0 ? (
        <Surface className="p-12 text-center">
          <Empty
            description={
              <div className="space-y-2">
                <Text strong className="text-base text-slate-700">
                  Chưa có thỏa thuận dịch vụ nào
                </Text>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Các vị trí tuyển dụng theo dịch vụ <strong>Tuyển dụng theo kết quả (Headhunt)</strong>{' '}
                  hoặc <strong>Tìm kiếm hồ sơ (CV Sourcing)</strong> sẽ xuất hiện tại đây sau khi được
                  HR Connect lập dự thảo thỏa thuận thương mại.
                </p>
              </div>
            }
          >
            <Button type="primary" onClick={() => navigate('/client/jobs/create')}>
              Đăng tin tuyển dụng mới
            </Button>
          </Empty>
        </Surface>
      ) : (
        <Row gutter={[24, 24]}>
          {/* Left Column: Job Selector */}
          <Col xs={24} lg={8} xl={7}>
            <Surface className="p-4 rounded-2xl space-y-3 bg-white shadow-xs">
              {/* Header Title & Counter */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <Text strong className="text-base text-slate-900 block">
                    Vị trí tuyển dụng
                  </Text>
                  <span className="text-xs text-slate-500">
                    {filteredJobs.length} / {eligibleJobs.length} vị trí
                  </span>
                </div>
                {activeJob?.serviceTypeCode && SERVICE_TYPE_LABEL[activeJob.serviceTypeCode] && (
                  <Tag color="cyan" className="m-0 text-xs font-medium rounded-full px-2.5">
                    {SERVICE_TYPE_LABEL[activeJob.serviceTypeCode].label}
                  </Tag>
                )}
              </div>

              {/* Search + Status Select Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 pb-1">
                <Input
                  placeholder="Tìm theo tên vị trí..."
                  prefix={<SearchOutlined className="text-slate-400 text-xs" />}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  allowClear
                  size="middle"
                  className="rounded-lg flex-1 min-w-0"
                />
                <Select
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  size="middle"
                  className="w-full sm:w-44 shrink-0 font-medium"
                  options={[
                    { value: 'ALL', label: `Tất cả (${counts.all})` },
                    { value: 'PENDING_AGREEMENT', label: `Chờ ký (${counts.pendingAgreement})` },
                    { value: 'PENDING_PAYMENT', label: `Chờ thanh toán (${counts.pendingPayment})` },
                    { value: 'ACTIVE', label: `Đang tuyển (${counts.active})` },
                    { value: 'CLOSED', label: `Đã đóng (${counts.closed})` },
                  ]}
                />
              </div>

              {/* Jobs List */}
              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1 pt-1">
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
                        className={`w-full cursor-pointer text-left rounded-xl p-3.5 transition-all border relative ${isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500/20 border-l-4 border-l-indigo-600'
                            : isAwaitingAction
                              ? 'border-purple-200/90 bg-purple-50/20 hover:border-purple-300 hover:bg-purple-50/40'
                              : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Text
                            strong
                            className={`text-sm line-clamp-1 ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'
                              }`}
                          >
                            {job.title}
                          </Text>
                          <Tag
                            color={statusMeta.color}
                            className="m-0 text-[10px] font-semibold shrink-0 rounded"
                          >
                            {statusMeta.label}
                          </Tag>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium text-slate-600">
                            {job.serviceTypeCode === 'HEADHUNT_COD'
                              ? 'Tuyển dụng kết quả'
                              : job.serviceTypeCode === 'CV_SOURCING'
                                ? 'Tìm kiếm hồ sơ'
                                : job.serviceTypeCode ?? ''}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {dayjs(job.updatedAt).format('DD/MM/YYYY')}
                          </span>
                        </div>

                        {job.status === 'PENDING_AGREEMENT' && (
                          <div className="mt-2 pt-1.5 border-t border-purple-100 flex items-center gap-1.5 text-[11px] text-purple-700 font-medium">
                            <SafetyCertificateOutlined />
                            <span>Cần xem xét & ký số thỏa thuận</span>
                          </div>
                        )}
                        {job.status === 'PENDING_PAYMENT' && (
                          <div className="mt-2 pt-1.5 border-t border-amber-100 flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                            <ClockCircleOutlined />
                            <span>Đã ký thỏa thuận · Chờ đặt cọc</span>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </Surface>
          </Col>

          {/* Right Column: Agreement Details & Actions */}
          <Col xs={24} lg={16} xl={17}>
            {loadingAgreement ? (
              <Surface className="p-8">
                <Skeleton active paragraph={{ rows: 10 }} />
              </Surface>
            ) : !currentAgreement ? (
              <Surface className="p-12 text-center rounded-2xl">
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
                {/* Current Agreement Card */}
                <Surface className="p-6 rounded-2xl bg-white shadow-sm space-y-6">
                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Text strong className="text-lg text-slate-900">
                          Thỏa thuận dịch vụ{' '}
                          {activeJob?.serviceTypeCode === 'HEADHUNT_COD' ? 'Tuyển dụng' : 'Tìm kiếm hồ sơ'}
                        </Text>
                        {(() => {
                          const meta =
                            SERVICE_AGREEMENT_STATUS[currentAgreement.status] ?? {
                              label: currentAgreement.status,
                              color: 'default',
                            };
                          return (
                            <Tag color={meta.color} className="font-medium text-xs rounded">
                              {meta.label}
                            </Tag>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-4">
                        <span>
                          Vị trí: <strong>{activeJob?.title}</strong>
                        </span>
                        <span>
                          Tạo ngày: {dayjs(currentAgreement.createdAt).format('DD/MM/YYYY HH:mm')}
                        </span>
                        {currentAgreement.signedAt && (
                          <span className="text-emerald-700 font-medium">
                            Ký ngày: {dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thao tác phụ duy nhất trên header */}
                    {isPendingResponse && (
                      <Button icon={<EditOutlined />} onClick={() => setReviseModalOpen(true)}>
                        Yêu cầu điều chỉnh
                      </Button>
                    )}
                  </div>

                  {/* Hướng dẫn ngắn gọn */}
                  {isPendingResponse && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 flex items-center gap-3 text-sm text-slate-700">
                      <InfoCircleOutlined className="text-indigo-600 text-base shrink-0" />
                      <span>
                        HR Connect đã gửi hợp đồng. Vui lòng <strong>xem / tải về</strong> hợp đồng, ký bên ngoài hệ thống,
                        sau đó <strong>tải lên bản đã ký</strong> để HR Connect duyệt và công khai tin.
                      </span>
                    </div>
                  )}

                  {currentAgreement.status === 'CHANGE_REQUESTED' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 text-sm flex items-start gap-3">
                      <ClockCircleOutlined className="text-amber-600 text-lg mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">Đang chờ HR Connect xem xét yêu cầu điều chỉnh</div>
                        <div className="text-xs text-amber-800 leading-relaxed">
                          Doanh nghiệp đã gửi yêu cầu điều chỉnh với nội dung:{' '}
                          <span className="italic font-medium">
                            "{currentAgreement.changeRequestReason}"
                          </span>
                          . HR Connect sẽ xem xét và phản hồi hoặc cập nhật lại bản hợp đồng trong thời gian sớm nhất.
                        </div>
                      </div>
                    </div>
                  )}

                  {currentAgreement.status === 'SIGNED' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 text-sm flex items-start gap-3">
                      <CheckCircleFilled className="text-emerald-600 text-lg mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">Hợp đồng dịch vụ đã được duyệt và có hiệu lực pháp lý</div>
                        <div className="text-xs text-emerald-800 leading-relaxed">
                          Hợp đồng đã được ký kết và hoàn tất thủ tục giữa hai bên vào ngày{' '}
                          {dayjs(currentAgreement.signedAt || currentAgreement.createdAt).format('DD/MM/YYYY HH:mm')}.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Danh sách tài liệu: mỗi thao tác chỉ xuất hiện 1 lần */}
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {/* Dòng 1: Hợp đồng do HR Connect soạn */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 text-xl shrink-0">
                          <FilePdfOutlined />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800">Văn bản hợp đồng dịch vụ</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Do HR Connect soạn · Số HĐ: {currentAgreement.verificationCode} · PDF
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button icon={<EyeOutlined />} onClick={() => handleViewDocument(currentAgreement, false)}>
                          Xem
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={() => handleSaveDocument(currentAgreement, false)}>
                          Tải về
                        </Button>
                      </div>
                    </div>

                    {/* Dòng 2: Hợp đồng doanh nghiệp đã ký */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${
                        currentAgreement.hasSignedDocument ? 'bg-emerald-50/40' : 'bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 border ${
                            currentAgreement.hasSignedDocument
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-600'
                              : 'bg-white border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          {currentAgreement.hasSignedDocument ? <CheckCircleFilled /> : <FileTextOutlined />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                            Hợp đồng đã ký
                            {currentAgreement.hasSignedDocument ? (
                              <Tag color="success" className="m-0 text-[10px]">Đã nộp</Tag>
                            ) : (
                              <Tag color="warning" className="m-0 text-[10px]">Chưa nộp</Tag>
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
                          <Button icon={<EyeOutlined />} onClick={() => handleViewDocument(currentAgreement, true)}>
                            Xem
                          </Button>
                        )}
                        {isPendingResponse && (
                          <Button
                            type={currentAgreement.hasSignedDocument ? 'default' : 'primary'}
                            icon={<UploadOutlined />}
                            className={currentAgreement.hasSignedDocument ? '' : '!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-medium'}
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
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-1">
                      <div className="text-xs font-semibold text-slate-700">
                        Ghi chú bổ sung từ HR Connect:
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {currentAgreement.agreementNote}
                      </div>
                    </div>
                  )}

                </Surface>

                {/* Revision History Card */}
                {historyAgreements.length > 1 && (
                  <Surface className="p-6 rounded-2xl bg-white shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <HistoryOutlined className="text-slate-500" />
                      <Text strong className="text-sm text-slate-800">
                        Lịch sử các phiên bản thỏa thuận ({historyAgreements.length})
                      </Text>
                    </div>

                    <Table
                      dataSource={historyAgreements}
                      rowKey="serviceAgreementId"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Phiên bản',
                          dataIndex: 'version',
                          key: 'version',
                          render: (v: number) => <Tag color="blue">v{v}</Tag>,
                        },
                        {
                          title: 'Trạng thái',
                          dataIndex: 'status',
                          key: 'status',
                          render: (st: string) => {
                            const meta =
                              SERVICE_AGREEMENT_STATUS[st as keyof typeof SERVICE_AGREEMENT_STATUS] ?? {
                                label: st,
                                color: 'default',
                              };
                            return <Tag color={meta.color}>{meta.label}</Tag>;
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

      {/* Modal: Yêu cầu điều chỉnh hợp đồng */}
      <Modal
        title="Yêu cầu điều chỉnh hợp đồng"
        open={reviseModalOpen}
        onCancel={() => setReviseModalOpen(false)}
        onOk={handleRequestRevision}
        confirmLoading={submittingRevision}
        okText="Gửi yêu cầu điều chỉnh"
        cancelText="Đóng"
        destroyOnClose
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
          />
        </div>
      </Modal>

      {/* Modal: Xem hợp đồng */}
      <Modal
        title={preview?.title}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        width={960}
        centered
        destroyOnClose
        footer={[
          <Button
            key="tab"
            onClick={() => preview && window.open(preview.url, '_blank', 'noopener,noreferrer')}
          >
            Mở tab mới
          </Button>,
          <Button key="close" type="primary" className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]" onClick={() => setPreview(null)}>
            Đóng
          </Button>,
        ]}
      >
        {preview && (
          <iframe
            title={preview.title}
            src={preview.url}
            className="w-full h-[70vh] rounded-lg border border-slate-200 bg-slate-50"
          />
        )}
      </Modal>

      {/* Modal: Tải lên hợp đồng đã ký */}
      <Modal
        title="Tải lên hợp đồng dịch vụ đã ký"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setFileList([]);
        }}
        onOk={handleUploadSignedFile}
        confirmLoading={uploading}
        okText="Xác nhận tải lên"
        cancelText="Hủy"
        destroyOnClose
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
              setFileList([file]);
              return false;
            }}
            onRemove={() => {
              setFileList([]);
            }}
          >
            <p className="ant-upload-drag-icon text-indigo-500 text-3xl mb-2">
              <InboxOutlined />
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Nhấp hoặc kéo thả tệp hợp đồng đã ký vào đây
            </p>
            <p className="text-xs text-slate-400">
              Định dạng hỗ trợ: PDF, JPG, PNG, DOC, DOCX. Tối đa 25MB.
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
};

export default ClientServiceAgreementsPage;
