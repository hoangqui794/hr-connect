/**
 * @file CandidateIdentityPage.tsx
 * @description Candidate's Login Email Settings (mockup 03/11, Page 22) and Identity Reconciliation
 * view (mockup 03/11, Page 31) on /candidate/settings/email-identities.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Popconfirm, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import { candidateIdentityApi } from '@/services/api/mf02/candidateIdentityApi';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  CandidateDuplicateCaseItem,
  CandidateIdentityClaimState,
  CandidateIdentityClaimVerification,
} from '@/types/api/mf02';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';

const STORAGE_KEY = 'hrconnect:candidate-identity-claim';
export const candidateIdentityKeys = {
  all: ['candidate-email-identities'] as const,
  duplicateCases: ['candidate-duplicate-cases'] as const,
};

const EVIDENCE_LABEL: Record<string, string> = {
  VERIFIED_EMAIL: 'Trùng email',
  MATCHING_CV_AND_NAME: 'Trùng file CV & họ tên',
  OTHER_REVIEW_SIGNAL: 'Trùng thông tin liên hệ',
};

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200';
const LINK = 'text-sky-600 no-underline transition-colors duration-200 hover:text-sky-700 hover:underline font-semibold';
const PRIMARY_BTN = `${FONT} inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-[14px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const OUTLINE_NAVY_BTN = `${FONT} inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-solid border-sky-600 bg-white px-4 text-[14px] font-semibold text-sky-700 transition-all duration-200 hover:bg-sky-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const OUTLINE_DANGER_BTN = `${FONT} inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-solid border-[#FCA5A5] bg-white px-3.5 text-[13px] font-medium text-[#B91C1C] transition-all duration-200 hover:bg-[#FEF2F2] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const SECONDARY_BTN = `${FONT} inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white px-4 text-[14px] font-medium text-[#1F2937] transition-all duration-200 hover:bg-[#F9FAFB] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const INPUT = `${FONT} h-10 w-full rounded-md border border-solid border-[#D1D5DB] bg-white px-3.5 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all duration-200 focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/15`;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'reconciliation' ? 'reconciliation' : 'emails';
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.hasPermission('candidate.identity.manage_own'));
  const syncCurrentUser = useAuthStore((state) => state.syncCurrentUser);
  const [pending, setPending] = useState<CandidateIdentityClaimState | null>(() => readPendingClaim());
  const [result, setResult] = useState<CandidateIdentityClaimVerification | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [clock, setClock] = useState(Date.now());
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const identities = useQuery({
    queryKey: candidateIdentityKeys.all,
    queryFn: candidateIdentityApi.listEmailIdentities,
    enabled: canManage,
  });

  const duplicateCasesQuery = useQuery({
    queryKey: candidateIdentityKeys.duplicateCases,
    queryFn: () =>
      typeof candidateIdentityApi.listDuplicateCases === 'function'
        ? candidateIdentityApi.listDuplicateCases({ page: 1, pageSize: 20 })
        : Promise.resolve({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }),
    enabled: canManage,
    retry: false,
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
      setEmailInput('');
      setEmailError(null);
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
        queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.duplicateCases }),
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

  const revoke = useMutation({
    mutationFn: (identity: { emailIdentityId: string; concurrencyToken: string }) =>
      candidateIdentityApi.revoke(identity.emailIdentityId, identity.concurrencyToken),
    onSuccess: async () => {
      message.success('Đã thu hồi email phụ khỏi hồ sơ của bạn.');
      await queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.all });
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Chưa thể thu hồi email liên kết.');
      message.error(apiError.message);
      if (apiError.status === 409) await queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.all });
    },
  });

  const makePrimary = useMutation({
    mutationFn: (identity: { emailIdentityId: string; concurrencyToken: string }) =>
      candidateIdentityApi.makePrimary(identity.emailIdentityId, identity.concurrencyToken),
    onSuccess: async (response) => {
      message.success(response.message || 'Đã đổi email đăng nhập chính thành công.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.all }),
        syncCurrentUser(),
      ]);
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Chưa thể đổi email đăng nhập chính.');
      message.error(apiError.message);
      if (apiError.status === 409) await queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.all });
    },
  });

  const dismissCase = useMutation({
    mutationFn: (item: { duplicateCaseId: string; concurrencyToken?: string }) =>
      candidateIdentityApi.dismissDuplicateCase(
        item.duplicateCaseId,
        'Đây không phải hồ sơ của tôi.',
        item.concurrencyToken
      ),
    onSuccess: async (response) => {
      message.success(response.message || 'Đã ghi nhận đây không phải hồ sơ của bạn.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.duplicateCases }),
        queryClient.invalidateQueries({ queryKey: ['candidate-applications'] }),
      ]);
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Chưa thể xử lý yêu cầu đối chiếu.');
      message.error(apiError.message);
      await queryClient.invalidateQueries({ queryKey: candidateIdentityKeys.duplicateCases });
    },
  });

  if (!canManage) return <Alert type="error" showIcon message="Bạn không có quyền quản lý email liên kết." />;

  const handleStartClaim = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError('Vui lòng nhập email cũ.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Email không đúng định dạng.');
      return;
    }
    setEmailError(null);
    start.mutate({ email: trimmed });
  };

  const aliasIdentities = (identities.data ?? []).filter((item) => item.kind !== 'PRIMARY');
  const duplicateCases: CandidateDuplicateCaseItem[] = duplicateCasesQuery.data?.items ?? [];
  const activeBackendDuplicateCount = duplicateCases.filter(
    (item) => item.actionRequired || item.status === 'AWAITING_CANDIDATE' || item.status === 'OPEN'
  ).length;
  const pendingReconciliationCount = Math.max(pending ? 1 : 0, activeBackendDuplicateCount);

  const switchTab = (nextTab: 'emails' | 'reconciliation') => {
    if (nextTab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'reconciliation') next.set('tab', 'reconciliation');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  return (
    <CandidateAccountFrame>
      <div className={`${FONT} candidate-page candidate-identity-page space-y-4`}>
        {/* Mode Switcher Tabs: Page 22 (Cài đặt email đăng nhập) vs Page 31 (Hồ sơ đang đối chiếu danh tính) */}
        <div className="min-h-[58px]">
          <div
            key={activeTab}
            className="animate-[admin-page-in_200ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
          >
            {activeTab === 'emails' ? (
              <>
                <h1 className="m-0 text-[22px] font-bold leading-7 text-[#1F2937]">Cài đặt email đăng nhập</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#4B5563]">
                  Chỉ email chính dùng để đăng nhập và khôi phục mật khẩu. Email phụ giúp hệ thống nhận ra bạn khi được giới thiệu bằng email khác.
                </p>
              </>
            ) : (
              <>
                <h1 className="m-0 text-[22px] font-bold leading-7 text-[#1F2937]">Hồ sơ đang đối chiếu danh tính</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#4B5563]">
                  Khi một hồ sơ nộp vào có thông tin trùng với hồ sơ khác, HR Connect đối chiếu để đảm bảo mỗi người chỉ có một hồ sơ và nguồn giới thiệu được ghi nhận đúng.
                </p>
              </>
            )}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Chế độ cài đặt email và đối chiếu danh tính"
          className="relative flex flex-wrap gap-6 border-0 border-b border-solid border-[#E5E7EB]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'emails'}
            onClick={() => switchTab('emails')}
            className={`${FONT} relative -mb-px inline-flex cursor-pointer items-center border-0 bg-transparent px-1 py-2.5 text-[14px] outline-none transition-colors duration-200 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#0369A1]/25 ${
              activeTab === 'emails' ? 'text-[#075985]' : 'text-[#4B5563] hover:text-[#075985]'
            }`}
          >
            <span className="relative inline-flex flex-col items-center">
              <span aria-hidden="true" className="invisible select-none font-semibold">
                Cài đặt email đăng nhập
              </span>
              <span className={`absolute inset-0 flex items-center ${activeTab === 'emails' ? 'font-semibold' : 'font-medium'}`}>
                Cài đặt email đăng nhập
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#0369A1] transition-all duration-200 ease-out ${
                activeTab === 'emails' ? 'scale-x-100 opacity-100' : 'scale-x-75 opacity-0'
              }`}
            />
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reconciliation'}
            onClick={() => switchTab('reconciliation')}
            className={`${FONT} relative -mb-px inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent px-1 py-2.5 text-[14px] outline-none transition-colors duration-200 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#0369A1]/25 ${
              activeTab === 'reconciliation' ? 'text-[#075985]' : 'text-[#4B5563] hover:text-[#075985]'
            }`}
          >
            <span className="relative inline-flex flex-col items-center">
              <span aria-hidden="true" className="invisible select-none font-semibold">
                Hồ sơ đang đối chiếu
              </span>
              <span className={`absolute inset-0 flex items-center ${activeTab === 'reconciliation' ? 'font-semibold' : 'font-medium'}`}>
                Hồ sơ đang đối chiếu
              </span>
            </span>
            {pendingReconciliationCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FEF3C7] px-1.5 text-[11px] font-bold text-[#92400E]">
                {pendingReconciliationCount}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#0369A1] transition-all duration-200 ease-out ${
                activeTab === 'reconciliation' ? 'scale-x-100 opacity-100' : 'scale-x-75 opacity-0'
              }`}
            />
          </button>
        </div>

        {result && (
          <Alert
            type={result.status === 'COMPLETED' ? 'success' : 'warning'}
            showIcon
            message={result.status === 'COMPLETED' ? 'Đã liên kết hồ sơ' : 'Đang chờ bộ phận hỗ trợ đối chiếu'}
            description={result.message}
            closable
            onClose={() => setResult(null)}
          />
        )}

        {activeTab === 'emails' ? (
          <div key="tab-emails" className="space-y-4 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            {/* Section 1: Email của bạn (PDF Page 22 top card) */}
            <section className={`${CARD} overflow-hidden`}>
              <div className="border-0 border-b border-solid border-[#F1F5F9] px-5 py-3.5">
                <h2 className="m-0 text-[15px] font-bold text-[#1F2937]">Email của bạn</h2>
              </div>

              {identities.isLoading ? (
                <div className="p-5">
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
              ) : identities.isError ? (
                <div className="p-5">
                  <Alert
                    type="error"
                    showIcon
                    message="Không tải được email liên kết"
                    description={getApiErrorMessage(identities.error)}
                  />
                </div>
              ) : (
                <ul className="m-0 list-none divide-y divide-[#F1F5F9] p-0">
                  {(identities.data ?? []).map((identity) => {
                    const isPrimary = identity.kind === 'PRIMARY';
                    const verifiedDate = identity.verifiedAt ? dayjs(identity.verifiedAt).format('DD/MM/YYYY') : null;
                    return (
                      <li
                        key={identity.emailIdentityId}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-[#F8FAFC]/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-bold text-[#1F2937]">{identity.email}</div>
                          <div className="mt-0.5 text-[13px] text-[#4B5563]">
                            {isPrimary ? 'Dùng để đăng nhập' : 'Email phụ'}
                            {' · '}
                            {verifiedDate ? `xác minh ${verifiedDate}` : 'Chưa xác minh'}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isPrimary ? (
                            <span className="inline-flex items-center rounded bg-[#E0F2FE] px-2.5 py-1 text-[12px] font-bold text-[#075985]">
                              Email chính
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded px-2.5 py-1 text-[12px] font-bold ${
                                identity.status === 'VERIFIED'
                                  ? 'bg-[#DCFCE7] text-[#166534]'
                                  : identity.status === 'REVOKED'
                                    ? 'bg-[#F3F4F6] text-[#4B5563]'
                                    : 'bg-[#FEF3C7] text-[#92400E]'
                              }`}
                            >
                              {identity.status === 'VERIFIED'
                                ? 'Đã xác minh'
                                : identity.status === 'REVOKED'
                                  ? 'Đã thu hồi'
                                  : 'Chờ xác minh'}
                            </span>
                          )}

                          {identity.canMakePrimary && identity.status === 'VERIFIED' && (
                            <Popconfirm
                              title="Đặt làm email đăng nhập chính?"
                              description={`Bạn sẽ dùng ${identity.email} để đăng nhập và khôi phục mật khẩu. Email chính hiện tại sẽ chuyển thành email phụ đã xác minh.`}
                              okText="Đặt làm email chính"
                              cancelText="Hủy"
                              onConfirm={() =>
                                makePrimary.mutate({
                                  emailIdentityId: identity.emailIdentityId,
                                  concurrencyToken: identity.concurrencyToken,
                                })
                              }
                            >
                              <button
                                type="button"
                                disabled={makePrimary.isPending && makePrimary.variables?.emailIdentityId === identity.emailIdentityId}
                                aria-label={`Đặt ${identity.email} làm email chính`}
                                className={`${FONT} inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-solid border-sky-600 bg-white px-3.5 text-[13px] font-semibold text-sky-700 transition-all duration-200 hover:bg-sky-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {makePrimary.isPending && makePrimary.variables?.emailIdentityId === identity.emailIdentityId
                                  ? 'Đang đổi…'
                                  : 'Đặt làm email chính'}
                              </button>
                            </Popconfirm>
                          )}

                          {identity.canRevoke && identity.status === 'VERIFIED' && (
                            <Popconfirm
                              title="Thu hồi email phụ?"
                              description="Email này sẽ không còn được dùng để nhận diện và khôi phục dữ liệu hồ sơ. CV và đơn ứng tuyển đã liên kết vẫn được giữ."
                              okText="Thu hồi"
                              okButtonProps={{ danger: true }}
                              cancelText="Giữ lại"
                              onConfirm={() =>
                                revoke.mutate({
                                  emailIdentityId: identity.emailIdentityId,
                                  concurrencyToken: identity.concurrencyToken,
                                })
                              }
                            >
                              <button
                                type="button"
                                disabled={revoke.isPending && revoke.variables?.emailIdentityId === identity.emailIdentityId}
                                aria-label={`Thu hồi email ${identity.email}`}
                                className={OUTLINE_DANGER_BTN}
                              >
                                {revoke.isPending && revoke.variables?.emailIdentityId === identity.emailIdentityId
                                  ? 'Đang gỡ…'
                                  : 'Gỡ email'}
                              </button>
                            </Popconfirm>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Inline Add Secondary Email row inside the Email của bạn card (PDF Page 22) */}
              <form
                onSubmit={handleStartClaim}
                className="border-0 border-t border-solid border-[#F1F5F9] px-5 py-3.5"
                noValidate
              >
                <label htmlFor="candidate-identity-email-input" className="sr-only">
                  Email cũ
                </label>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <input
                    ref={emailInputRef}
                    id="candidate-identity-email-input"
                    aria-label="Email cũ"
                    type="email"
                    maxLength={255}
                    autoComplete="email"
                    value={emailInput}
                    onChange={(event) => {
                      setEmailInput(event.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="Thêm email khác, ví dụ: ten@congty.vn"
                    className={INPUT}
                  />
                  <button type="submit" disabled={start.isPending} className={OUTLINE_NAVY_BTN}>
                    {start.isPending ? 'Đang gửi…' : 'Gửi mã xác minh'}
                  </button>
                </div>
                {emailError && <div className="mt-1.5 text-[12px] text-[#DC2626]">{emailError}</div>}
              </form>
            </section>

            {/* Section 2: Nhận lại hồ sơ cũ (PDF Page 22 bottom card) */}
            <section className={`${CARD} candidate-identity-claim p-5`}>
              <h2 className="m-0 text-[15px] font-bold text-[#1F2937]">Nhận lại hồ sơ cũ</h2>
              <p className="m-0 mt-1 text-[13.5px] leading-5 text-[#374151]">
                Hệ thống tìm thấy một hồ sơ ứng viên được tạo trước đây bằng email phụ (do Affiliate giới thiệu). Xác minh để gộp hồ sơ đó và lịch sử ứng tuyển vào tài khoản này.
              </p>

              {pending && expiresIn === 0 ? (
                <div className="mt-4">
                  <Alert
                    type="warning"
                    showIcon
                    message="Yêu cầu xác minh đã hết hạn"
                    description="Hãy tạo yêu cầu mới để nhận mã OTP mới."
                    action={
                      <button type="button" onClick={() => replacePending(null)} className={SECONDARY_BTN}>
                        Tạo yêu cầu mới
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="mt-3.5">
                  <label htmlFor="candidate-identity-otp" className="mb-1.5 block text-[12.5px] font-medium text-[#4B5563]">
                    {pending
                      ? `Mã đã gửi đến ${pending.maskedDestination} (còn hiệu lực ${duration(expiresIn)})`
                      : 'Mã OTP 6 chữ số'}
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      ref={otpInputRef}
                      id="candidate-identity-otp"
                      aria-label="Mã OTP"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6   c h ữ   s ố"
                      disabled={!pending}
                      className={`${INPUT} sm:w-[196px] tracking-[0.14em] disabled:bg-[#F9FAFB]`}
                    />
                    <button
                      type="button"
                      disabled={!pending || otp.length !== 6 || verify.isPending}
                      onClick={() => verify.mutate()}
                      aria-label="Xác minh và liên kết"
                      className={PRIMARY_BTN}
                    >
                      {verify.isPending ? 'Đang xác minh…' : 'Xác minh và gộp hồ sơ'}
                    </button>
                    <button
                      type="button"
                      disabled={!pending || resendIn > 0 || resend.isPending}
                      onClick={() => resend.mutate()}
                      className={`${FONT} cursor-pointer border-0 bg-transparent px-2 py-1.5 text-[13.5px] font-semibold text-[#0369A1] transition-colors duration-200 hover:text-[#075985] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline`}
                    >
                      {resend.isPending
                        ? 'Đang gửi…'
                        : resendIn > 0
                          ? `Gửi lại sau ${duration(resendIn)}`
                          : 'Gửi lại mã'}
                    </button>
                  </div>

                  {pending?.emailDeliveryStatus === 'FAILED' && (
                    <div className="mt-3">
                      <Alert
                        type="warning"
                        showIcon
                        message="Email trước chưa gửi được. Bạn có thể bấm Gửi lại mã khi hết thời gian chờ."
                      />
                    </div>
                  )}

                  <p className="m-0 mt-3 text-[12.5px] text-[#6B7280]">
                    Gộp xong, hồ sơ cũ được Platform Admin kiểm tra trước khi hoàn tất.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Section: Hồ sơ đang đối chiếu danh tính (PDF Page 31) */
          <div key="tab-reconciliation" className="space-y-3.5 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            {pending && (
              <article className="rounded-lg border border-solid border-[#FCD34D] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-[15px] font-bold text-[#1F2937]">
                      Hồ sơ trùng thông tin liên hệ với một hồ sơ khác
                    </h2>
                    <div className="mt-1 text-[13px] text-[#4B5563]">
                      Email đối chiếu: <strong className="font-semibold text-[#1F2937]">{pending.maskedDestination}</strong> · Đang chờ xác minh OTP
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded bg-[#FEF3C7] px-2.5 py-1 text-[12px] font-bold text-[#92400E]">
                    Cần bạn xác minh
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] font-medium text-[#334155]">
                    Trùng email
                  </span>
                  <span className="inline-flex items-center rounded bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] font-medium text-[#334155]">
                    Trùng số điện thoại
                  </span>
                </div>

                <p className="m-0 mt-3 text-[13.5px] text-[#374151]">
                  Một hồ sơ được tạo trước đây bằng email phụ của bạn. Xác minh email đó để gộp hồ sơ, tránh việc lời giới thiệu bị chặn vì trùng.
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      switchTab('emails');
                      window.setTimeout(() => otpInputRef.current?.focus(), 60);
                    }}
                    className={PRIMARY_BTN}
                  >
                    Xác minh để gộp hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      replacePending(null);
                      message.info('Đã đóng yêu cầu xác minh hồ sơ trùng.');
                    }}
                    className={SECONDARY_BTN}
                  >
                    Đây không phải tôi
                  </button>
                </div>
              </article>
            )}

            {duplicateCases.map((dupCase) => {
              const isResolved = dupCase.status === 'MERGED' || dupCase.status === 'DISMISSED';
              const isActionRequired = dupCase.actionRequired || dupCase.status === 'AWAITING_CANDIDATE';
              const badgeLabel =
                dupCase.status === 'MERGED' || dupCase.status === 'DISMISSED'
                  ? 'Đã xử lý'
                  : isActionRequired
                    ? 'Cần bạn xác minh'
                    : 'Đang đối chiếu';
              const badgeClass = isResolved
                ? 'bg-[#DCFCE7] text-[#166534]'
                : isActionRequired
                  ? 'bg-[#FEF3C7] text-[#92400E]'
                  : 'bg-[#E0F2FE] text-[#075985]';
              const evidenceBadges =
                dupCase.evidenceTypes && dupCase.evidenceTypes.length > 0
                  ? dupCase.evidenceTypes.map((ev) => EVIDENCE_LABEL[ev] || ev)
                  : ['Trùng email', 'Trùng số điện thoại'];

              return (
                <article
                  key={dupCase.duplicateCaseId}
                  className={
                    isActionRequired
                      ? 'rounded-lg border border-solid border-[#FCD34D] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200'
                      : `${CARD} p-5`
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="m-0 text-[15px] font-bold text-[#1F2937]">{dupCase.title}</h2>
                      <div className="mt-1 text-[13px] text-[#4B5563]">
                        {dupCase.job ? (
                          <>
                            Liên quan:{' '}
                            <Link to={`/jobs/${dupCase.job.jobId}`} className={`font-medium ${LINK}`}>
                              {dupCase.job.title} – {dupCase.job.companyName}
                            </Link>{' '}
                            ·{' '}
                          </>
                        ) : null}
                        {isResolved
                          ? `Đóng ngày ${dayjs(dupCase.updatedAt).format('DD/MM/YYYY')}`
                          : `Phát hiện ngày ${dayjs(dupCase.createdAt).format('DD/MM/YYYY')}`}
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded px-2.5 py-1 text-[12px] font-bold ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {evidenceBadges.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] font-medium text-[#334155]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="m-0 mt-3 text-[13.5px] text-[#374151]">
                    {isResolved ? (
                      <>
                        <strong className="font-semibold text-[#111827]">Kết quả:</strong> {dupCase.guidance}
                      </>
                    ) : (
                      dupCase.guidance
                    )}
                  </p>

                  {isActionRequired && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          switchTab('emails');
                          window.setTimeout(() => (pending ? otpInputRef.current : emailInputRef.current)?.focus(), 60);
                        }}
                        className={PRIMARY_BTN}
                      >
                        Xác minh để gộp hồ sơ
                      </button>
                      <button
                        type="button"
                        disabled={dismissCase.isPending && dismissCase.variables?.duplicateCaseId === dupCase.duplicateCaseId}
                        onClick={() =>
                          dismissCase.mutate({
                            duplicateCaseId: dupCase.duplicateCaseId,
                            concurrencyToken: dupCase.concurrencyToken,
                          })
                        }
                        className={SECONDARY_BTN}
                      >
                        {dismissCase.isPending && dismissCase.variables?.duplicateCaseId === dupCase.duplicateCaseId
                          ? 'Đang xử lý…'
                          : 'Đây không phải tôi'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {aliasIdentities.map((alias) => (
              <article key={alias.emailIdentityId} className={`${CARD} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-[15px] font-bold text-[#1F2937]">
                      Hồ sơ liên kết qua email {alias.email}
                    </h2>
                    <div className="mt-1 text-[13px] text-[#4B5563]">
                      Liên quan:{' '}
                      <Link to="/candidate/applications" className={`font-medium ${LINK}`}>
                        Đơn ứng tuyển và CV đối tác giới thiệu
                      </Link>{' '}
                      · {alias.verifiedAt ? `Đóng ngày ${dayjs(alias.verifiedAt).format('DD/MM/YYYY')}` : 'Đang đối chiếu'}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded px-2.5 py-1 text-[12px] font-bold ${
                      alias.status === 'VERIFIED'
                        ? 'bg-[#DCFCE7] text-[#166534]'
                        : 'bg-[#FEF3C7] text-[#92400E]'
                    }`}
                  >
                    {alias.status === 'VERIFIED' ? 'Đã xử lý' : 'Cần bạn xác minh'}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] font-medium text-[#334155]">
                    Trùng email
                  </span>
                  <span className="inline-flex items-center rounded bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] font-medium text-[#334155]">
                    Trùng file CV
                  </span>
                </div>

                <p className="m-0 mt-3 text-[13.5px] text-[#374151]">
                  <strong className="font-semibold text-[#111827]">Kết quả:</strong> giữ một hồ sơ duy nhất của bạn; đơn ứng tuyển vẫn tiếp tục bình thường.
                </p>
              </article>
            ))}

            {!pending && duplicateCases.length === 0 && aliasIdentities.length === 0 && (
              <div className={`${CARD} p-6 text-center`}>
                <div className="text-[15px] font-semibold text-[#1F2937]">Không có hồ sơ nào đang chờ đối chiếu</div>
                <p className="m-0 mt-1 text-[13.5px] text-[#4B5563]">
                  Nếu bạn từng được đối tác giới thiệu bằng một địa chỉ email khác, bạn có thể thêm email phụ để gộp hồ sơ.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      switchTab('emails');
                      window.setTimeout(() => emailInputRef.current?.focus(), 60);
                    }}
                    className={PRIMARY_BTN}
                  >
                    Thêm email phụ để đối chiếu
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CandidateAccountFrame>
  );
};

export default CandidateIdentityPage;
