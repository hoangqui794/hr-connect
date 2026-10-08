/**
 * @file CandidateSubmissionConsentsTab.tsx
 * @description Candidate Submission Consents screen & confirmation modal:
 * - Displays referral requests from Affiliate partners waiting for candidate confirmation.
 * - Shows job details, employer, affiliate name, CV file preview.
 * - Two distinct actions: "Đồng ý" (CONFIRM) and "Từ chối" (DECLINE) via POST /candidates/me/submission-consents/{submissionId}/respond.
 * - Supports allowFutureReuse checkbox to control future referrals.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Skeleton,
  Tag,
  Tooltip,
} from 'antd';
import {
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloseCircleOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  candidateAffiliateCvsApi,
  submissionConsentsApi,
  type CandidateAffiliateCvUsageItem,
  type SubmissionConsentReviewData,
} from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { FilterPills, Surface } from '@/features/admin-console/ui';
import { candidateKeys, useOpenSignedUrl } from './CandidatePages';

interface Props {
  initialSubmissionId?: string | null;
  onClearInitialSubmissionId?: () => void;
}

interface EnrichedSubmissionItem extends CandidateAffiliateCvUsageItem {
  cvId: string;
  cvFileName?: string;
}

export const CandidateSubmissionConsentsTab: React.FC<Props> = ({
  initialSubmissionId,
  onClearInitialSubmissionId,
}) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const openSigned = useOpenSignedUrl();

  const [filterGroup, setFilterGroup] = useState<'pending' | 'confirmed' | 'declined' | 'all'>('pending');

  // Modal states for reviewing/responding
  const [activeConsentSubmissionId, setActiveConsentSubmissionId] = useState<string | null>(initialSubmissionId ?? null);
  const [allowFutureReuse, setAllowFutureReuse] = useState(true);
  const [declineReason, setDeclineReason] = useState('');
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [pendingDeclineSubmissionId, setPendingDeclineSubmissionId] = useState<string | null>(null);

  // 1. Fetch all affiliate CVs
  const affiliateCvsQuery = useQuery({
    queryKey: ['candidate-affiliate-cvs-for-consents'],
    queryFn: () => candidateAffiliateCvsApi.list({ page: 1, pageSize: 50 }),
  });

  const cvItems = affiliateCvsQuery.data?.data?.items ?? [];

  // 2. Fetch usages across all CVs to compile referral submissions
  const usagesQuery = useQuery({
    queryKey: ['candidate-all-cv-usages', cvItems.map((c) => c.cvId).join(',')],
    queryFn: async () => {
      if (cvItems.length === 0) return [];
      const results = await Promise.all(
        cvItems.map(async (cv) => {
          try {
            const res = await candidateAffiliateCvsApi.usages(cv.cvId, { page: 1, pageSize: 50 });
            const items = res?.data?.items ?? [];
            return items.map((u: CandidateAffiliateCvUsageItem) => ({
              ...u,
              cvId: cv.cvId,
              cvFileName: cv.fileName,
            }));
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    enabled: cvItems.length > 0,
  });

  const allSubmissions: EnrichedSubmissionItem[] = usagesQuery.data ?? [];

  // 3. Query consent details when modal opens
  const consentDetailQuery = useQuery({
    queryKey: ['submission-consent-detail', activeConsentSubmissionId],
    queryFn: () => (activeConsentSubmissionId ? submissionConsentsApi.reviewAuth(activeConsentSubmissionId) : null),
    enabled: Boolean(activeConsentSubmissionId),
  });

  const consentDetail: SubmissionConsentReviewData | undefined = consentDetailQuery.data?.data;

  // 4. Respond Mutation (CONFIRM or DECLINE)
  const respondMutation = useMutation({
    mutationFn: ({
      submissionId,
      decision,
      allowReuse,
    }: {
      submissionId: string;
      decision: 'CONFIRM' | 'DECLINE';
      allowReuse?: boolean;
    }) => submissionConsentsApi.respondAuth(submissionId, { decision, allowFutureReuse: allowReuse }),
    onSuccess: (res, vars) => {
      if (vars.decision === 'CONFIRM') {
        message.success(res.message || 'Đã đồng ý giới thiệu! Hồ sơ đã được chuyển đến nhà tuyển dụng.');
      } else {
        message.info(res.message || 'Đã từ chối lượt giới thiệu này.');
      }
      setActiveConsentSubmissionId(null);
      setIsDeclineModalOpen(false);
      setPendingDeclineSubmissionId(null);
      onClearInitialSubmissionId?.();
      queryClient.invalidateQueries({ queryKey: ['candidate-all-cv-usages'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-affiliate-cvs'] });
      queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể xử lý phản hồi.')),
  });

  // Filtered submissions
  const pendingItems = useMemo(
    () => allSubmissions.filter((s) => s.consentStatus === 'PENDING'),
    [allSubmissions]
  );
  const confirmedItems = useMemo(
    () => allSubmissions.filter((s) => s.consentStatus === 'CONFIRMED'),
    [allSubmissions]
  );
  const declinedItems = useMemo(
    () => allSubmissions.filter((s) => s.consentStatus === 'DECLINED' || s.consentStatus === 'EXPIRED'),
    [allSubmissions]
  );

  const displayedItems = useMemo(() => {
    switch (filterGroup) {
      case 'pending':
        return pendingItems;
      case 'confirmed':
        return confirmedItems;
      case 'declined':
        return declinedItems;
      default:
        return allSubmissions;
    }
  }, [filterGroup, pendingItems, confirmedItems, declinedItems, allSubmissions]);

  const isLoading = affiliateCvsQuery.isLoading || usagesQuery.isLoading;

  return (
    <div className="space-y-5">
      {/* Hero / Explanation */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="m-0 flex items-center gap-2 text-base font-bold text-slate-900">
              <SafetyCertificateOutlined className="text-teal-600" /> Xác nhận lượt giới thiệu việc làm
            </h2>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">
              Đối tác tuyển dụng (Affiliate) đã tìm thấy cơ hội việc làm phù hợp và đề xuất hồ sơ của bạn cho nhà tuyển
              dụng. <strong>Chỉ khi bạn bấm "Đồng ý"</strong>, hồ sơ và CV mới chính thức được chuyển đến doanh nghiệp
              để xét duyệt.
            </p>
          </div>
          {pendingItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-amber-800 shadow-xs">
              <ClockCircleOutlined className="text-base text-amber-600" />
              <div>
                <span className="block text-xs font-semibold">Cần bạn xác nhận</span>
                <span className="text-sm font-bold">{pendingItems.length} cơ hội đang chờ</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Lọc theo trạng thái"
          value={filterGroup}
          onChange={(v) => setFilterGroup(v as any)}
          options={[
            { value: 'pending', label: 'Chờ xác nhận', count: pendingItems.length },
            { value: 'confirmed', label: 'Đã đồng ý', count: confirmedItems.length },
            { value: 'declined', label: 'Từ chối / Hết hạn', count: declinedItems.length },
            { value: 'all', label: 'Tất cả', count: allSubmissions.length },
          ]}
        />
      </div>

      {/* List Submissions */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ) : displayedItems.length === 0 ? (
        <Surface className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-600">
            <SafetyCertificateOutlined />
          </div>
          <h3 className="m-0 mt-3 text-base font-semibold text-slate-800">
            {filterGroup === 'pending'
              ? 'Không có lượt giới thiệu nào đang chờ bạn xác nhận'
              : 'Chưa có lượt giới thiệu nào trong nhóm này'}
          </h3>
          <p className="m-0 mt-1 text-sm text-slate-500">
            {filterGroup === 'pending'
              ? 'Khi đối tác Affiliate giới thiệu việc làm mới, thông báo và yêu cầu xác nhận sẽ xuất hiện tại đây.'
              : 'Hãy chuyển sang bộ lọc khác để xem lại các lượt giới thiệu trước đây.'}
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {displayedItems.map((item) => {
            const isPending = item.consentStatus === 'PENDING';
            const isConfirmed = item.consentStatus === 'CONFIRMED';
            const isDeclined = item.consentStatus === 'DECLINED';
            const isExpired = item.consentStatus === 'EXPIRED';

            return (
              <article
                key={item.submissionId}
                className={`admin-surface rounded-2xl border p-5 transition-shadow hover:shadow-md ${
                  isPending ? 'border-amber-200 bg-amber-50/20 shadow-xs' : 'border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Job & Affiliate info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-slate-900">{item.jobTitle}</span>
                      {isPending && (
                        <Tag color="orange" className="!rounded-full !px-2.5 font-medium">
                          <ClockCircleOutlined /> Chờ bạn xác nhận
                        </Tag>
                      )}
                      {isConfirmed && (
                        <Tag color="green" className="!rounded-full !px-2.5 font-medium">
                          <CheckCircleFilled /> Đã đồng ý
                        </Tag>
                      )}
                      {isDeclined && (
                        <Tag color="red" className="!rounded-full !px-2.5 font-medium">
                          <CloseCircleFilled /> Đã từ chối
                        </Tag>
                      )}
                      {isExpired && (
                        <Tag color="default" className="!rounded-full !px-2.5 font-medium">
                          Đã hết hạn
                        </Tag>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">{item.companyName}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <UserOutlined className="text-slate-400" />
                        Người giới thiệu: <strong className="text-slate-800">{item.affiliateDisplayName}</strong>
                      </span>
                    </div>

                    {/* Meta info: CV used, Expiration countdown */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                      {item.cvFileName && (
                        <span className="inline-flex items-center gap-1">
                          <FilePdfOutlined className="text-red-600" /> Bản CV: {item.cvFileName}
                        </span>
                      )}
                      <span>Gửi lúc: {dayjs(item.submittedAt).format('HH:mm DD/MM/YYYY')}</span>
                      {isPending && item.consentExpiresAt && (
                        <span className="font-semibold text-amber-700">
                          Hạn xác nhận: {dayjs(item.consentExpiresAt).format('HH:mm DD/MM/YYYY')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                    {/* View CV button */}
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => openSigned(() => candidateAffiliateCvsApi.downloadUrl(item.cvId))}
                    >
                      Xem CV đã nộp
                    </Button>

                    {isPending ? (
                      <>
                        <Button
                          danger
                          onClick={() => {
                            setPendingDeclineSubmissionId(item.submissionId);
                            setIsDeclineModalOpen(true);
                          }}
                        >
                          Từ chối
                        </Button>
                        <Button
                          type="primary"
                          className="!bg-teal-600 hover:!bg-teal-700 !font-semibold"
                          onClick={() => {
                            setActiveConsentSubmissionId(item.submissionId);
                          }}
                        >
                          Đồng ý nộp hồ sơ
                        </Button>
                      </>
                    ) : isConfirmed ? (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        Đang trong quy trình tuyển dụng
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Modal: Review & Confirm Submission Consent ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <SafetyCertificateOutlined className="text-teal-600" />
            Xác nhận ứng tuyển vào vị trí
          </div>
        }
        open={Boolean(activeConsentSubmissionId)}
        onCancel={() => {
          setActiveConsentSubmissionId(null);
          onClearInitialSubmissionId?.();
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setActiveConsentSubmissionId(null);
              onClearInitialSubmissionId?.();
            }}
          >
            Để sau
          </Button>,
          <Button
            key="decline"
            danger
            onClick={() => {
              const sid = activeConsentSubmissionId;
              setActiveConsentSubmissionId(null);
              if (sid) {
                setPendingDeclineSubmissionId(sid);
                setIsDeclineModalOpen(true);
              }
            }}
          >
            Từ chối
          </Button>,
          <Button
            key="confirm"
            type="primary"
            className="!bg-teal-600 hover:!bg-teal-700"
            loading={respondMutation.isPending}
            onClick={() => {
              if (activeConsentSubmissionId) {
                respondMutation.mutate({
                  submissionId: activeConsentSubmissionId,
                  decision: 'CONFIRM',
                  allowReuse: allowFutureReuse,
                });
              }
            }}
          >
            Đồng ý nộp hồ sơ
          </Button>,
        ]}
        width={620}
        destroyOnClose
      >
        <div className="py-2 space-y-4">
          {consentDetailQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : consentDetailQuery.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(consentDetailQuery.error)} />
          ) : consentDetail ? (
            <>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">{consentDetail.jobTitle}</h3>
                    <p className="m-0 text-sm font-medium text-slate-600">{consentDetail.companyName}</p>
                  </div>
                  <Tag color="orange">Chờ bạn xác nhận</Tag>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400">Ứng viên:</span>{' '}
                    <strong className="text-slate-800">{consentDetail.candidateName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Hạn phản hồi:</span>{' '}
                    <strong className="text-amber-700">{dayjs(consentDetail.expiresAt).format('HH:mm DD/MM/YYYY')}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <FilePdfOutlined className="text-red-600 text-base" />
                    <span>Tệp CV: <strong>{consentDetail.cvFileName}</strong></span>
                  </div>
                  {consentDetail.cvDownloadUrl && (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(consentDetail.cvDownloadUrl, '_blank')}
                    >
                      Xem nội dung CV
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-teal-50/60 border border-teal-100 p-3.5 text-xs text-teal-900 leading-relaxed space-y-1.5">
                <p className="m-0 font-medium">
                  ✓ Khi bạn bấm <strong>Đồng ý nộp hồ sơ</strong>:
                </p>
                <ul className="m-0 pl-4 space-y-1 text-slate-600">
                  <li>Hồ sơ của bạn sẽ được gửi thẳng đến bộ phận nhân sự của <strong>{consentDetail.companyName}</strong>.</li>
                  <li>Hệ thống AI sẽ tự động phân tích độ phù hợp với tiêu chí tuyển dụng.</li>
                  <li>Bạn có thể theo dõi tiến độ phỏng vấn và trạng thái đơn tại mục "Đơn ứng tuyển".</li>
                </ul>
              </div>

              {/* Allow Future Reuse Checkbox */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <Checkbox
                  checked={allowFutureReuse}
                  onChange={(e) => setAllowFutureReuse(e.target.checked)}
                >
                  <span className="text-xs font-medium text-slate-800">
                    Cho phép đối tác này tái sử dụng CV này để giới thiệu cho các công việc khác trong tương lai
                  </span>
                </Checkbox>
                <p className="m-0 mt-1 pl-6 text-[11px] text-slate-500">
                  Lưu ý: Ngay cả khi được cho phép tái sử dụng, mỗi công việc mới vẫn bắt buộc phải có sự xác nhận đồng ý riêng từ bạn.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* ── Modal: Confirm Decline ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-red-600">
            <CloseCircleOutlined />
            Từ chối lượt giới thiệu việc làm
          </div>
        }
        open={isDeclineModalOpen}
        onCancel={() => {
          setIsDeclineModalOpen(false);
          setPendingDeclineSubmissionId(null);
        }}
        confirmLoading={respondMutation.isPending}
        okButtonProps={{ danger: true }}
        okText="Xác nhận từ chối"
        cancelText="Quay lại"
        onOk={() => {
          if (pendingDeclineSubmissionId) {
            respondMutation.mutate({
              submissionId: pendingDeclineSubmissionId,
              decision: 'DECLINE',
            });
          }
        }}
        destroyOnClose
      >
        <div className="py-2 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn từ chối lượt giới thiệu cho vị trí này?
          </p>
          <div className="rounded-xl bg-red-50/70 border border-red-100 p-3 text-xs text-red-700">
            Sau khi từ chối, hồ sơ của bạn sẽ không được gửi tới doanh nghiệp tuyển dụng. Đối tác giới thiệu sẽ nhận được
            thông báo kết quả.
          </div>
        </div>
      </Modal>
    </div>
  );
};
