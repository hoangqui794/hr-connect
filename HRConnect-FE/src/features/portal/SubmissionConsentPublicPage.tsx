/**
 * @file SubmissionConsentPublicPage.tsx
 * @description Standalone public page for Candidate to review and confirm/decline referral submission consent.
 * Supports token via URL hash (#token=...) or query param (?token=...), as well as authenticated flow (?submissionId=...).
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Result,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  submissionConsentsApi,
  type SubmissionConsentReviewData,
} from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text, Paragraph } = Typography;

export const SubmissionConsentPublicPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = AntApp.useApp();
  const { isAuthenticated } = useAuthStore();

  // Parse token or submissionId from either query param or hash
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = searchParams.get('token') || hashParams.get('token') || '';
  const submissionId = searchParams.get('submissionId') || hashParams.get('submissionId') || '';

  const [allowFutureReuse, setAllowFutureReuse] = useState(true);
  const [completedDecision, setCompletedDecision] = useState<'CONFIRM' | 'DECLINE' | null>(null);

  // Review Query
  const reviewQuery = useQuery({
    queryKey: ['submission-consent-public-review', token, submissionId],
    queryFn: async () => {
      if (token) {
        return (await submissionConsentsApi.reviewPublic(token)).data;
      }
      if (submissionId && isAuthenticated) {
        return (await submissionConsentsApi.reviewAuth(submissionId)).data;
      }
      throw new Error('Không tìm thấy token hoặc mã yêu cầu xác nhận hợp lệ.');
    },
    enabled: Boolean(token || (submissionId && isAuthenticated)),
    retry: 1,
  });

  const consentData: SubmissionConsentReviewData | undefined = reviewQuery.data;

  // Respond Mutation
  const respondMutation = useMutation({
    mutationFn: async (decision: 'CONFIRM' | 'DECLINE') => {
      if (token) {
        return await submissionConsentsApi.respondPublic({
          token,
          decision,
          allowFutureReuse,
        });
      }
      if (submissionId) {
        return await submissionConsentsApi.respondAuth(submissionId, {
          decision,
          allowFutureReuse,
        });
      }
      throw new Error('Thiếu thông tin xác nhận.');
    },
    onSuccess: (res, decision) => {
      setCompletedDecision(decision);
      message.success(
        res.message ||
          (decision === 'CONFIRM'
            ? 'Đã đồng ý nộp hồ sơ thành công!'
            : 'Đã ghi nhận từ chối giới thiệu.')
      );
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể xử lý yêu cầu xác nhận.'));
    },
  });

  // If already responded or finished
  if (completedDecision) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-lg !rounded-3xl border border-slate-200/80 shadow-xl">
          <Result
            status={completedDecision === 'CONFIRM' ? 'success' : 'info'}
            title={
              completedDecision === 'CONFIRM'
                ? 'Đã xác nhận nộp hồ sơ thành công!'
                : 'Đã từ chối lượt giới thiệu'
            }
            subTitle={
              completedDecision === 'CONFIRM'
                ? `Hồ sơ của bạn đã được chuyển đến nhà tuyển dụng ${consentData?.companyName || ''} để xét duyệt.`
                : 'Hồ sơ của bạn sẽ không được nộp vào vị trí này. Bạn có thể đóng trang này.'
            }
            extra={[
              <Button
                key="home"
                type="primary"
                icon={<HomeOutlined />}
                className="!rounded-full !px-6"
                onClick={() => navigate(isAuthenticated ? '/candidate/dashboard' : '/')}
              >
                {isAuthenticated ? 'Về trang cá nhân' : 'Về trang chủ'}
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 via-slate-50 to-white py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-xl">
        {/* Brand / Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-2xl font-black text-teal-800 tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
              HC
            </span>
            HR Connect
          </div>
          <p className="mt-2 text-sm text-slate-500">Nền tảng Tuyển dụng & Giới thiệu Nhân sự Thông minh</p>
        </div>

        {/* Card */}
        <Card className="!rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <SafetyCertificateOutlined className="text-xl text-teal-600" />
                <h1 className="m-0 text-xl font-bold text-slate-900">Xác nhận hồ sơ ứng tuyển</h1>
              </div>
              <p className="m-0 mt-1.5 text-sm text-slate-600">
                Đối tác giới thiệu muốn đề xuất bạn vào cơ hội việc làm sau. Vui lòng kiểm tra và quyết định:
              </p>
            </div>

            {reviewQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : reviewQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="Không thể tải yêu cầu xác nhận"
                description={
                  getApiErrorMessage(reviewQuery.error) ||
                  'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.'
                }
              />
            ) : consentData ? (
              <>
                {/* Status banner if already closed */}
                {consentData.status !== 'PENDING' && (
                  <Alert
                    type={consentData.status === 'CONFIRMED' ? 'success' : 'warning'}
                    showIcon
                    message={
                      consentData.status === 'CONFIRMED'
                        ? 'Yêu cầu này đã được đồng ý trước đó.'
                        : consentData.status === 'DECLINED'
                        ? 'Yêu cầu này đã bị từ chối trước đó.'
                        : 'Yêu cầu này đã hết hạn hiệu lực.'
                    }
                  />
                )}

                {/* Details Section */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vị trí ứng tuyển</span>
                    <div className="text-lg font-bold text-slate-900 leading-snug">{consentData.jobTitle}</div>
                    <div className="text-sm font-semibold text-teal-700">{consentData.companyName}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Ứng viên:</span>
                      <div className="font-semibold text-slate-800">{consentData.candidateName}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Hạn phản hồi:</span>
                      <div className="font-semibold text-amber-700">
                        {dayjs(consentData.expiresAt).format('HH:mm DD/MM/YYYY')}
                      </div>
                    </div>
                  </div>

                  {/* CV info & download */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <FilePdfOutlined className="text-base text-red-600" />
                      <span>{consentData.cvFileName}</span>
                    </div>
                    {consentData.cvDownloadUrl && (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => window.open(consentData.cvDownloadUrl, '_blank')}
                      >
                        Xem tệp CV
                      </Button>
                    )}
                  </div>
                </div>

                {consentData.status === 'PENDING' && (
                  <>
                    {/* Reuse Checkbox */}
                    <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3.5">
                      <Checkbox
                        checked={allowFutureReuse}
                        onChange={(e) => setAllowFutureReuse(e.target.checked)}
                      >
                        <span className="text-xs font-medium text-slate-800">
                          Cho phép đối tác này tái sử dụng CV để đề xuất bạn vào các công việc khác trong tương lai
                        </span>
                      </Checkbox>
                      <p className="m-0 mt-1 pl-6 text-[11px] text-slate-500">
                        (Mỗi công việc mới vẫn cần sự xác nhận riêng từ bạn trước khi gửi tới doanh nghiệp.)
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
                      <Button
                        type="primary"
                        size="large"
                        className="!flex-1 !bg-teal-600 hover:!bg-teal-700 !font-semibold !rounded-xl"
                        loading={respondMutation.isPending && respondMutation.variables === 'CONFIRM'}
                        onClick={() => respondMutation.mutate('CONFIRM')}
                      >
                        Đồng ý nộp hồ sơ
                      </Button>
                      <Button
                        danger
                        size="large"
                        className="!rounded-xl sm:!w-32"
                        loading={respondMutation.isPending && respondMutation.variables === 'DECLINE'}
                        onClick={() => respondMutation.mutate('DECLINE')}
                      >
                        Từ chối
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
};
