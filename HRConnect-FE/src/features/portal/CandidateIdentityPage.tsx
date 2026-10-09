import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Skeleton, Tag } from 'antd';
import { CheckCircleOutlined, LinkOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { candidateIdentityApi } from '@/services/api/mf02/candidateIdentityApi';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateIdentityClaimState, CandidateIdentityClaimVerification } from '@/types/api/mf02';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';

const STORAGE_KEY = 'hrconnect:candidate-identity-claim';
export const candidateIdentityKeys = { all: ['candidate-email-identities'] as const };

const readPendingClaim = (): CandidateIdentityClaimState | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as CandidateIdentityClaimState;
    return value.claimId && value.concurrencyToken && value.expiresAt ? value : null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const savePendingClaim = (claim: CandidateIdentityClaimState | null) => {
  if (claim) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(claim));
  else sessionStorage.removeItem(STORAGE_KEY);
};

const secondsUntil = (value: string | undefined, now: number) => Math.max(0, Math.ceil((dayjs(value).valueOf() - now) / 1000));
const duration = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const CandidateIdentityPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.hasPermission('candidate.identity.manage_own'));
  const syncCurrentUser = useAuthStore((state) => state.syncCurrentUser);
  const [pending, setPending] = useState<CandidateIdentityClaimState | null>(() => readPendingClaim());
  const [result, setResult] = useState<CandidateIdentityClaimVerification | null>(null);
  const [otp, setOtp] = useState('');
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const identities = useQuery({
    queryKey: candidateIdentityKeys.all,
    queryFn: candidateIdentityApi.listEmailIdentities,
    enabled: canManage,
  });
  const expiresIn = pending ? secondsUntil(pending.expiresAt, clock) : 0;
  const resendIn = pending ? secondsUntil(pending.resendAfter, clock) : 0;

  const replacePending = (claim: CandidateIdentityClaimState | null) => {
    setPending(claim);
    savePendingClaim(claim);
  };

  const start = useMutation({
    mutationFn: (values: { email: string }) => candidateIdentityApi.start(values.email.trim()),
    onSuccess: (response) => {
      replacePending(response.data);
      setResult(null);
      setOtp('');
      message.success(response.message);
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể gửi yêu cầu xác minh email.')),
  });

  const resend = useMutation({
    mutationFn: () => {
      if (!pending) throw new Error('Không có yêu cầu xác minh đang hoạt động.');
      return candidateIdentityApi.resend(pending.claimId, pending.concurrencyToken);
    },
    onSuccess: (response) => {
      replacePending({
        claimId: response.claimId,
        maskedDestination: response.maskedDestination,
        expiresAt: response.expiresAt,
        resendAfter: response.resendAfter,
        concurrencyToken: response.concurrencyToken,
        resendCount: response.resendCount,
        emailDeliveryStatus: response.emailDeliveryStatus,
      });
      setOtp('');
      message.success(response.message);
    },
    onError: (error) => {
      const apiError = getApiError(error, 'Chưa thể gửi lại mã xác minh.');
      if (['STALE_IDENTITY_CLAIM', 'IDENTITY_CLAIM_CONCURRENT_UPDATE', 'IDENTITY_CLAIM_EXPIRED'].includes(apiError.code ?? '')) {
        replacePending(null);
      }
      message.error(apiError.message);
    },
  });

  const verify = useMutation({
    mutationFn: () => {
      if (!pending) throw new Error('Không có yêu cầu xác minh đang hoạt động.');
      return candidateIdentityApi.verify(pending.claimId, otp, pending.concurrencyToken);
    },
    onSuccess: async (response) => {
      replacePending(null);
      setOtp('');
      setResult(response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['candidate-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['candidate-cvs'] }),
        queryClient.invalidateQueries({ queryKey: ['candidate-affiliate-cvs'] }),
        syncCurrentUser(),
      ]);
      message.success(response.message);
    },
    onError: (error) => {
      const apiError = getApiError(error, 'Mã xác minh chưa được chấp nhận.');
      if (
        ['STALE_IDENTITY_CLAIM', 'IDENTITY_CLAIM_CONCURRENT_UPDATE', 'IDENTITY_CLAIM_EXPIRED'].includes(apiError.code ?? '') ||
        /hết hạn|quá số lần/i.test(apiError.message)
      ) {
        replacePending(null);
        setOtp('');
      }
      message.error(apiError.message);
    },
  });

  if (!canManage) return <Alert type="error" showIcon message="Bạn không có quyền quản lý email liên kết." />;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Danh tính Candidate"
        title="Email và hồ sơ liên kết"
        description="Xác minh email cũ để nhận lại CV và lịch sử ứng tuyển đã được Affiliate tạo trước khi bạn đăng ký. Email phụ không dùng để đăng nhập hoặc quên mật khẩu."
      />

      {result && (
        <Alert
          type={result.status === 'COMPLETED' ? 'success' : 'warning'}
          showIcon
          message={result.status === 'COMPLETED' ? 'Đã liên kết hồ sơ' : 'Đang chờ Admin đối chiếu'}
          description={result.message}
          closable
          onClose={() => setResult(null)}
        />
      )}

      <Surface>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="m-0 text-base font-bold text-slate-900">Email của tài khoản</h2>
          <p className="m-0 mt-1 text-sm text-slate-500">Email chính dùng đăng nhập; email phụ chỉ giúp nhận diện đúng hồ sơ Candidate.</p>
        </div>
        {identities.isLoading ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 3 }} /></div>
        ) : identities.isError ? (
          <div className="p-5"><Alert type="error" showIcon message="Không tải được email liên kết" description={getApiErrorMessage(identities.error)} /></div>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {(identities.data ?? []).map((identity) => (
              <li key={identity.emailIdentityId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><MailOutlined /></span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{identity.email}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {identity.verifiedAt ? `Xác minh ${dayjs(identity.verifiedAt).format('DD/MM/YYYY HH:mm')}` : 'Chưa xác minh'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag color={identity.kind === 'PRIMARY' ? 'blue' : 'cyan'}>{identity.kind === 'PRIMARY' ? 'Email chính' : 'Email phụ'}</Tag>
                  <StatusDot tone={identity.status === 'VERIFIED' ? 'success' : 'neutral'}>{identity.status}</StatusDot>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><LinkOutlined /></span>
          <div>
            <h2 className="m-0 text-base font-bold text-slate-900">Nhận lại hồ sơ theo email cũ</h2>
            <p className="m-0 mt-1 text-sm text-slate-600">Chỉ nhập email mà Affiliate từng dùng để nộp hồ sơ của chính bạn.</p>
          </div>
        </div>

        {!pending ? (
          <Form layout="vertical" className="mt-5 max-w-xl" onFinish={(values) => start.mutate(values)}>
            <Form.Item name="email" label="Email cũ" rules={[{ required: true, message: 'Vui lòng nhập email cũ.' }, { type: 'email', message: 'Email không đúng định dạng.' }]}>
              <Input type="email" maxLength={255} autoComplete="email" placeholder="email-cu@example.com" prefix={<MailOutlined />} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={start.isPending}>Gửi mã xác minh</Button>
          </Form>
        ) : expiresIn === 0 ? (
          <Alert
            className="mt-5"
            type="warning"
            showIcon
            message="Yêu cầu xác minh đã hết hạn"
            description="Hãy tạo yêu cầu mới để nhận mã OTP mới."
            action={<Button onClick={() => replacePending(null)}>Tạo yêu cầu mới</Button>}
          />
        ) : (
          <div className="mt-5 max-w-xl space-y-4">
            <Alert
              type="info"
              showIcon
              message={`Nhập mã đã gửi tới ${pending.maskedDestination}`}
              description={`Mã còn hiệu lực ${duration(expiresIn)}. Không chia sẻ mã này với Affiliate hoặc bất kỳ ai.`}
            />
            <div>
              <label htmlFor="candidate-identity-otp" className="mb-2 block text-sm font-medium text-slate-700">Mã OTP</label>
              <Input
                id="candidate-identity-otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Nhập 6 chữ số"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="primary" icon={<CheckCircleOutlined />} disabled={otp.length !== 6} loading={verify.isPending} onClick={() => verify.mutate()}>
                Xác minh và liên kết
              </Button>
              <Button disabled={resendIn > 0 || resend.isPending} loading={resend.isPending} onClick={() => resend.mutate()}>
                {resendIn > 0 ? `Gửi lại sau ${duration(resendIn)}` : 'Gửi lại mã'}
              </Button>
            </div>
            {pending.emailDeliveryStatus === 'FAILED' && <Alert type="warning" showIcon message="Email trước chưa gửi được. Bạn có thể bấm Gửi lại mã khi hết thời gian chờ." />}
          </div>
        )}
      </Surface>

      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="HR Connect chỉ liên kết sau khi xác minh email"
        description="Nếu hai hồ sơ đều đã có dữ liệu, hệ thống chuyển yêu cầu cho Admin đối chiếu để tránh gộp nhầm Candidate."
      />
    </div>
  );
};

export default CandidateIdentityPage;
