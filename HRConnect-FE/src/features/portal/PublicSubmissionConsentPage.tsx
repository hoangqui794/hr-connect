import React, { useLayoutEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Checkbox, Popconfirm, Result, Skeleton } from 'antd';
import { EyeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { candidateConsentApi } from '@/services/api/mf02Api';
import { getApiError } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';

const fragmentToken = () => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('token')?.trim() || null;
};

export const PublicSubmissionConsentPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [allowFutureReuse, setAllowFutureReuse] = useState(false);
  const [completed, setCompleted] = useState<string>();
  const consumedFragment = React.useRef(false);

  useLayoutEffect(() => {
    if (consumedFragment.current) return;
    consumedFragment.current = true;
    const value = fragmentToken();
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    setToken(value);
  }, []);

  const review = useQuery({
    queryKey: ['public-submission-consent', token ? 'available' : 'missing'],
    queryFn: () => candidateConsentApi.reviewPublic(token!),
    enabled: typeof token === 'string' && token.length > 0,
    retry: false,
  });

  React.useEffect(() => {
    if (review.data) setAllowFutureReuse(review.data.affiliateReuseStatus === 'ALLOWED');
  }, [review.data]);

  const respond = useMutation({
    mutationFn: (decision: 'CONFIRM' | 'DECLINE') =>
      candidateConsentApi.respondPublic(token!, decision, allowFutureReuse),
    onSuccess: (result) => {
      setCompleted(result.submissionStatus);
      message.success(result.message);
    },
    onError: (error) => {
      const apiError = getApiError(error, 'Không thể ghi nhận lựa chọn của bạn.');
      message.error(
        apiError.status === 429 && apiError.retryAfterSeconds
          ? `${apiError.message} Vui lòng thử lại sau ${apiError.retryAfterSeconds} giây.`
          : apiError.message
      );
    },
  });

  if (token === undefined) return <div className="mx-auto max-w-3xl p-6"><Skeleton active paragraph={{ rows: 7 }} /></div>;

  if (!token) {
    return (
      <Result
        status="warning"
        title="Liên kết xác nhận không hợp lệ"
        subTitle="Vui lòng mở lại liên kết mới nhất được HR Connect gửi qua email."
        extra={<Button type="primary" href="/">Về trang chủ</Button>}
      />
    );
  }

  if (review.isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton active paragraph={{ rows: 7 }} /></div>;

  if (review.isError || !review.data) {
    const error = getApiError(review.error, 'Không tải được yêu cầu xác nhận hồ sơ.');
    return (
      <Result
        status={error.status === 404 ? '404' : error.status === 403 ? '403' : 'error'}
        title="Không thể mở yêu cầu xác nhận"
        subTitle={error.message}
        extra={<Button type="primary" href="/">Về trang chủ</Button>}
      />
    );
  }

  const consent = review.data;
  if (completed || consent.status !== 'PENDING' || dayjs(consent.expiresAt).isBefore(dayjs())) {
    const accepted = completed === 'ACCEPTED' || consent.status === 'CONFIRMED';
    return (
      <Result
        status={accepted ? 'success' : 'info'}
        title={accepted ? 'Đã đồng ý nộp hồ sơ' : completed === 'CONSENT_REJECTED' || consent.status === 'DECLINED' ? 'Đã từ chối hồ sơ' : 'Yêu cầu xác nhận đã kết thúc'}
        subTitle={accepted ? 'HR Connect đã tạo đơn ứng tuyển và chuyển hồ sơ sang bước đánh giá tiếp theo.' : 'Hồ sơ sẽ không được gửi đến doanh nghiệp.'}
        extra={<Button type="primary" href="/">Về trang chủ</Button>}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="text-center">
          <a href="/" className="text-xl font-extrabold tracking-tight text-teal-700">HR Connect</a>
          <h1 className="m-0 mt-5 text-3xl font-extrabold text-slate-900">Xác nhận hồ sơ ứng tuyển</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Kiểm tra thông tin trước khi cho phép Affiliate gửi CV của bạn đến doanh nghiệp.</p>
        </header>

        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="Bạn chưa cần tạo tài khoản để phản hồi"
          description="Liên kết này chỉ dùng một lần. HR Connect không tạo Application và không gửi CV sang MF03 cho đến khi bạn đồng ý."
        />

        <Surface className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="m-0 text-lg font-bold text-slate-900">Thông tin hồ sơ</h2>
            <StatusDot tone="warning">Hạn {dayjs(consent.expiresAt).format('HH:mm DD/MM/YYYY')}</StatusDot>
          </div>
          <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Candidate</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.candidateName}</dd></div>
            <div><dt className="text-slate-500">Công việc</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.jobTitle}</dd></div>
            <div><dt className="text-slate-500">Doanh nghiệp</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.companyName}</dd></div>
            <div><dt className="text-slate-500">Tệp CV</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{consent.cvFileName}</dd></div>
          </dl>

          {consent.cvDownloadUrl && (
            <Button icon={<EyeOutlined />} onClick={() => window.open(consent.cvDownloadUrl!, '_blank', 'noopener,noreferrer')}>
              Xem CV trước khi quyết định
            </Button>
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
              description="Hồ sơ sẽ không được gửi đến doanh nghiệp."
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
    </main>
  );
};
