import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Checkbox, Popconfirm, Result, Skeleton } from 'antd';
import { EyeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import durationPlugin from 'dayjs/plugin/duration';
import { useNavigate, useParams } from 'react-router-dom';
import { candidateConsentApi } from '@/services/api/mf02Api';
import { getApiError } from '@/services/apiClient';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';

dayjs.extend(durationPlugin);

const consentKey = (submissionId: string) => ['candidate-submission-consent', submissionId] as const;

const remainingText = (expiresAt: string, now: number) => {
  const remaining = dayjs(expiresAt).valueOf() - now;
  if (remaining <= 0) return 'Đã hết hạn';
  const duration = dayjs.duration(remaining);
  const hours = Math.floor(duration.asHours());
  return `${hours.toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
};

export const CandidateSubmissionConsentPage: React.FC = () => {
  const { submissionId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();
  const [allowFutureReuse, setAllowFutureReuse] = useState(false);
  const [now, setNow] = useState(Date.now());

  const review = useQuery({
    queryKey: consentKey(submissionId),
    queryFn: () => candidateConsentApi.review(submissionId),
    enabled: Boolean(submissionId),
    retry: false,
  });

  useEffect(() => {
    if (review.data) setAllowFutureReuse(review.data.affiliateReuseStatus === 'ALLOWED');
  }, [review.data]);

  useEffect(() => {
    if (review.data?.status !== 'PENDING') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [review.data?.status]);

  const respond = useMutation({
    mutationFn: (decision: 'CONFIRM' | 'DECLINE') =>
      candidateConsentApi.respond(submissionId, decision, allowFutureReuse),
    onSuccess: async (result) => {
      message.success(result.message);
      await queryClient.invalidateQueries({ queryKey: consentKey(submissionId) });
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Không thể ghi nhận lựa chọn của bạn.');
      message.error(
        apiError.status === 429 && apiError.retryAfterSeconds
          ? `${apiError.message} Vui lòng thử lại sau ${apiError.retryAfterSeconds} giây.`
          : apiError.message
      );
      if (apiError.status === 409) await queryClient.invalidateQueries({ queryKey: consentKey(submissionId) });
    },
  });

  const countdown = useMemo(
    () => (review.data ? remainingText(review.data.expiresAt, now) : ''),
    [review.data, now]
  );

  if (review.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (review.isError || !review.data) {
    const error = getApiError(review.error, 'Không tải được yêu cầu xác nhận hồ sơ.');
    return (
      <Result
        status={error.status === 403 ? '403' : error.status === 404 ? '404' : 'error'}
        title="Không thể mở yêu cầu xác nhận"
        subTitle={error.message}
        extra={<Button onClick={() => navigate('/candidate/dashboard')}>Về trang Candidate</Button>}
      />
    );
  }

  const consent = review.data;
  const isPending = consent.status === 'PENDING' && dayjs(consent.expiresAt).isAfter(now);

  if (!isPending) {
    const confirmed = consent.status === 'CONFIRMED';
    return (
      <Result
        status={confirmed ? 'success' : 'info'}
        title={confirmed ? 'Bạn đã đồng ý nộp hồ sơ' : consent.status === 'DECLINED' ? 'Bạn đã từ chối hồ sơ' : 'Yêu cầu xác nhận đã kết thúc'}
        subTitle="Yêu cầu này không thể phản hồi thêm."
        extra={<Button type="primary" onClick={() => navigate('/candidate/applications')}>Xem đơn ứng tuyển</Button>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Xác nhận hồ sơ"
        title="Affiliate muốn giới thiệu bạn vào một công việc"
        description="Hãy kiểm tra kỹ thông tin và CV trước khi cho phép gửi hồ sơ đến doanh nghiệp."
        actions={<StatusDot tone="warning">Còn {countdown}</StatusDot>}
      />

      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="Bạn luôn là người quyết định"
        description="Chỉ khi bạn đồng ý, hệ thống mới tạo đơn ứng tuyển, ghi nhận nguồn giới thiệu và chuyển CV sang MF03 để đánh giá."
      />

      <Surface className="space-y-5 p-6">
        <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Candidate</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.candidateName}</dd></div>
          <div><dt className="text-slate-500">Công việc</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.jobTitle}</dd></div>
          <div><dt className="text-slate-500">Doanh nghiệp</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.companyName}</dd></div>
          <div><dt className="text-slate-500">Tệp CV</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.cvFileName}</dd></div>
          <div><dt className="text-slate-500">Hạn xác nhận</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{dayjs(consent.expiresAt).format('HH:mm DD/MM/YYYY')}</dd></div>
        </dl>

        {consent.cvDownloadUrl ? (
          <Button icon={<EyeOutlined />} onClick={() => window.open(consent.cvDownloadUrl!, '_blank', 'noopener,noreferrer')}>
            Xem CV trước khi quyết định
          </Button>
        ) : (
          <Alert type="warning" showIcon message="Liên kết CV đã hết hạn" description="Tải lại trang để nhận liên kết xem CV mới." />
        )}

        <Checkbox checked={allowFutureReuse} disabled={respond.isPending} onChange={(event) => setAllowFutureReuse(event.target.checked)}>
          Cho phép Affiliate này dùng lại CV để gửi yêu cầu xác nhận cho công việc khác. Mỗi công việc mới vẫn cần tôi đồng ý riêng.
        </Checkbox>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          <Button type="primary" size="large" loading={respond.isPending} disabled={respond.isPending} onClick={() => respond.mutate('CONFIRM')}>
            Đồng ý nộp hồ sơ
          </Button>
          <Popconfirm
            title="Từ chối yêu cầu này?"
            description="Hồ sơ sẽ không được gửi đến doanh nghiệp và MF03 sẽ không chấm điểm."
            okText="Từ chối"
            okButtonProps={{ danger: true }}
            cancelText="Quay lại"
            disabled={respond.isPending}
            onConfirm={() => respond.mutate('DECLINE')}
          >
            <Button danger size="large" disabled={respond.isPending}>Từ chối</Button>
          </Popconfirm>
        </div>
      </Surface>
    </div>
  );
};
