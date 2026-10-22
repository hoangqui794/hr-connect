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
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
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

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [activeConcurrencyToken, setActiveConcurrencyToken] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState(false);

  // PDF Preview / Download
  const handleDownloadPdf = async (agreement: ServiceAgreementDto) => {
    if (!activeJobId) return;
    try {
      message.loading({ content: 'Đang chuẩn bị tài liệu PDF...', key: 'pdf' });
      const isSigned = agreement.status === 'SIGNED';
      const res = await serviceAgreementsApi.getDownloadUrl(
        activeJobId,
        agreement.serviceAgreementId,
        isSigned
      );
      message.success({ content: 'Mở tài liệu thành công', key: 'pdf' });
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      message.error({ content: getApiErrorMessage(err), key: 'pdf' });
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
            <Surface className="p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <Text strong className="text-sm text-slate-800">
                  Vị trí tuyển dụng ({eligibleJobs.length})
                </Text>
                <Tag color="cyan">
                  {activeJob?.serviceTypeCode && SERVICE_TYPE_LABEL[activeJob.serviceTypeCode]
                    ? SERVICE_TYPE_LABEL[activeJob.serviceTypeCode].label
                    : ''}
                </Tag>
              </div>

              <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                {eligibleJobs.map((job) => {
                  const isSelected = job.jobId === activeJobId;
                  const statusMeta = JOB_STATUS[job.status] ?? { label: job.status, color: 'default' };
                  return (
                    <button
                      key={job.jobId}
                      type="button"
                      onClick={() => {
                        setActiveJobId(job.jobId);
                        setSearchParams({ jobId: job.jobId }, { replace: true });
                      }}
                      className={`w-full cursor-pointer text-left rounded-xl p-3.5 transition-all border ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500/20'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Text
                          strong
                          className={`text-sm line-clamp-1 ${
                            isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'
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
                        <span>
                          {job.serviceTypeCode && SERVICE_TYPE_LABEL[job.serviceTypeCode]
                            ? SERVICE_TYPE_LABEL[job.serviceTypeCode].label
                            : job.serviceTypeCode ?? ''}
                        </span>
                        <span>{dayjs(job.updatedAt).format('DD/MM/YYYY')}</span>
                      </div>
                    </button>
                  );
                })}
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
                        <Tag color="blue" className="font-semibold text-xs rounded">
                          Phiên bản v{currentAgreement.version}
                        </Tag>
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

                    <div className="flex items-center gap-2">
                      <Button
                        icon={<FilePdfOutlined />}
                        onClick={() => handleDownloadPdf(currentAgreement)}
                      >
                        Xem bản PDF
                      </Button>
                    </div>
                  </div>

                  {/* Status Notice Banner */}
                  {isPendingResponse && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 text-sm flex items-start gap-3">
                      <InfoCircleOutlined className="text-blue-600 text-lg mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">Dự thảo thỏa thuận đang chờ Doanh nghiệp xem xét</div>
                        <div className="text-xs text-blue-800 leading-relaxed">
                          Quý khách vui lòng kiểm tra kỹ các điều khoản thương mại bên dưới. Nếu có điểm
                          cần thương lượng lại, hãy bấm <strong>"Yêu cầu điều chỉnh"</strong>. Nếu đã đồng
                          ý, hãy bấm <strong>"Đồng ý & Ký thỏa thuận"</strong> để ký số bằng mã OTP gửi về
                          email.
                        </div>
                      </div>
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
                          . HR Connect sẽ phản hồi và gửi lại bản thỏa thuận mới trong thời gian sớm nhất.
                        </div>
                      </div>
                    </div>
                  )}

                  {currentAgreement.status === 'SIGNED' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 text-sm flex items-start gap-3">
                      <CheckCircleFilled className="text-emerald-600 text-lg mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">Thỏa thuận đã được ký kết và có hiệu lực pháp lý</div>
                        <div className="text-xs text-emerald-800 leading-relaxed">
                          Đại diện doanh nghiệp <strong>{currentAgreement.signerName}</strong> (
                          {currentAgreement.signerEmail}) đã hoàn tất ký điện tử vào{' '}
                          {dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm:ss')}.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commercial Terms Breakdown */}
                  <div>
                    <Text strong className="text-sm text-slate-800 mb-3 block">
                      Chi tiết điều khoản thương mại
                    </Text>

                    {activeJob?.serviceTypeCode === 'HEADHUNT_COD' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                          <span className="text-xs text-slate-500 font-medium">Tỷ lệ phí tuyển dụng</span>
                          <div className="text-2xl font-bold text-indigo-700">
                            {currentAgreement.feeMultiplier ?? '—'}%
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Hệ số / tỷ lệ phần trăm phí tuyển dụng thành công
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                          <span className="text-xs text-slate-500 font-medium">Thời hạn bảo hành</span>
                          <div className="text-2xl font-bold text-slate-800">
                            {currentAgreement.warrantyDays ?? '—'} ngày
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Cam kết tìm ứng viên thay thế miễn phí trong thời gian này
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                          <span className="text-xs text-slate-500 font-medium">Hạn thanh toán</span>
                          <div className="text-2xl font-bold text-slate-800">
                            {currentAgreement.paymentDueDays ?? '—'} ngày
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Sau ngày ứng viên chính thức bắt đầu nhận việc (Onboard)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                            <span className="text-xs text-slate-500 font-medium">Số hồ sơ cam kết</span>
                            <div className="text-2xl font-bold text-indigo-700">
                              {currentAgreement.sourcingTarget ?? '—'} hồ sơ
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Hồ sơ đạt tiêu chuẩn sàng lọc ban đầu
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                            <span className="text-xs text-slate-500 font-medium">Đơn giá mỗi hồ sơ</span>
                            <div className="text-2xl font-bold text-slate-800">
                              {formatMoney(currentAgreement.pricePerQualifiedCv)}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Chi phí cho mỗi hồ sơ doanh nghiệp duyệt nhận
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                            <span className="text-xs text-slate-500 font-medium">Thời gian duyệt hồ sơ</span>
                            <div className="text-2xl font-bold text-slate-800">
                              {currentAgreement.reviewDays ?? '—'} ngày
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Thời hạn để doanh nghiệp phản hồi hồ sơ đã giao
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-1">
                            <span className="text-xs text-slate-500 font-medium">Hạn thanh toán</span>
                            <div className="text-2xl font-bold text-slate-800">
                              {currentAgreement.paymentDueDays ?? '—'} ngày
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Thời hạn thanh toán sau khi duyệt hồ sơ
                            </span>
                          </div>
                        </div>

                        {sourcingEstimatedTotal != null && (
                          <div className="rounded-xl bg-slate-100/80 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                            <div>
                              <span className="text-slate-500">Ước tính tổng chi phí chiến dịch: </span>
                              <strong className="text-slate-900 text-sm">
                                {formatMoney(sourcingEstimatedTotal)}
                              </strong>
                            </div>
                            {sourcingEstimatedDeposit != null && (
                              <div>
                                <span className="text-slate-500">Khoản cọc ước tính (30%): </span>
                                <strong className="text-amber-700 text-sm">
                                  {formatMoney(sourcingEstimatedDeposit)}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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

                  {/* Digital Signature Audit Card if signed */}
                  {currentAgreement.status === 'SIGNED' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                        <SafetyCertificateFilled className="text-emerald-600 text-base" />
                        Chứng thực ký kết điện tử (Digital Signature Audit)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 block">Đại diện ký:</span>
                          <strong className="text-slate-800">{currentAgreement.signerName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Email người ký:</span>
                          <strong className="text-slate-800">{currentAgreement.signerEmail}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Thời gian xác thực OTP:</span>
                          <strong className="text-slate-800">
                            {dayjs(currentAgreement.signedAt).format('DD/MM/YYYY HH:mm:ss')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Mã xác thực:</span>
                          <span className="text-slate-600 font-mono text-[11px] truncate block">
                            {currentAgreement.verificationCode || currentAgreement.serviceAgreementId.slice(0, 18)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isPendingResponse && (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => setReviseModalOpen(true)}
                      >
                        Yêu cầu điều chỉnh
                      </Button>
                      <Button
                        type="primary"
                        icon={<SafetyCertificateOutlined />}
                        className="bg-indigo-600 hover:bg-indigo-500"
                        onClick={handleOpenSignModal}
                      >
                        Đồng ý & Ký thỏa thuận
                      </Button>
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

      {/* Modal: Request Revision */}
      <Modal
        title="Yêu cầu điều chỉnh điều khoản thương mại"
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
            Vui lòng nêu rõ các điều khoản bạn mong muốn thương thảo lại (ví dụ: điều chỉnh tỷ lệ phí,
            thời gian bảo hành, số lượng hồ sơ cam kết, đơn giá...). Đội ngũ HR Connect sẽ liên hệ trao
            đổi và cập nhật lại dự thảo thỏa thuận.
          </Paragraph>

          <Input.TextArea
            rows={4}
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            placeholder="Ví dụ: Doanh nghiệp đề xuất giảm tỷ lệ phí tuyển dụng xuống 15% hoặc gia hạn thời gian bảo hành ứng viên lên 60 ngày..."
            maxLength={1000}
            showCount
          />
        </div>
      </Modal>

      {/* Modal: Sign Agreement with OTP */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <SafetyCertificateFilled className="text-indigo-600 text-lg" />
            <span>Ký thỏa thuận dịch vụ điện tử qua mã OTP</span>
          </div>
        }
        open={signModalOpen}
        onCancel={() => setSignModalOpen(false)}
        onOk={handleConfirmSign}
        confirmLoading={signingLoading}
        okText="Ký thỏa thuận & Xác nhận"
        cancelText="Hủy"
        width={560}
        destroyOnClose
      >
        <div className="space-y-4 py-3">
          {/* Summary */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Vị trí tuyển dụng:</span>
              <strong className="text-slate-900">{activeJob?.title}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dịch vụ:</span>
              <span className="font-semibold text-slate-800">
                {activeJob?.serviceTypeCode && SERVICE_TYPE_LABEL[activeJob.serviceTypeCode]
                  ? SERVICE_TYPE_LABEL[activeJob.serviceTypeCode].label
                  : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Người thực hiện ký:</span>
              <span className="font-semibold text-slate-800">
                {user?.name} ({user?.email})
              </span>
            </div>
          </div>

          {/* Dev OTP Box */}
          {devOtp && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Mã OTP xác thực (Hiệu lực 10 phút):
                </span>
                <Button
                  size="small"
                  type="primary"
                  className="bg-amber-600 hover:bg-amber-500 border-none text-xs"
                  onClick={() => setOtpCode(devOtp)}
                >
                  Tự động điền mã
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-mono font-bold tracking-[0.25em] text-amber-950 bg-white/95 border border-amber-300 px-3 py-1 rounded-lg shadow-sm">
                  {devOtp}
                </div>
                <span className="text-[11px] text-amber-800 leading-tight">
                  Mã có hiệu lực trong 10 phút (vẫn dùng được bình thường kể cả khi thông báo trên màn hình biến mất).
                </span>
              </div>
            </div>
          )}

          {/* OTP Section */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Text strong className="text-xs text-indigo-950">
                Mã xác thực OTP (6 chữ số)
              </Text>
              <Button
                type="link"
                size="small"
                loading={sendingChallenge}
                onClick={() =>
                  currentAgreement && sendChallenge(currentAgreement.serviceAgreementId)
                }
              >
                Gửi lại mã OTP
              </Button>
            </div>

            <Input
              size="large"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Nhập 6 số OTP từ email..."
              className="text-center tracking-widest text-lg font-mono font-bold"
            />

            <div className="text-[11px] text-slate-500">
              Mã xác thực đã được gửi tới địa chỉ email đăng ký của bạn. Vui lòng kiểm tra hộp thư đến
              (và cả mục Spam/Junk nếu cần).
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2">
            <Checkbox
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="text-xs text-slate-700 leading-normal"
            >
              Tôi cam kết là đại diện có thẩm quyền hợp pháp của Doanh nghiệp. Tôi đã đọc kỹ, hiểu rõ,
              đồng ý với toàn bộ nội dung thỏa thuận dịch vụ và chấp thuận việc ký kết điện tử có giá
              trị ràng buộc pháp lý theo quy định của pháp luật.
            </Checkbox>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientServiceAgreementsPage;
