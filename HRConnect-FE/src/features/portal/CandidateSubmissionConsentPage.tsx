/**
 * @file CandidateSubmissionConsentPage.tsx
 * @description Authenticated Candidate's referral confirmation screen (mockup 03/11, Page 14)
 * on /candidate/submission-consents/:submissionId.
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Popconfirm, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CompanyMark } from '@/features/landing/components/SiteParts';
import { candidateConsentApi } from '@/services/api/mf02Api';
import { getApiError } from '@/services/apiClient';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline transition-colors duration-200 hover:text-[#075985] hover:underline';
const CARD = 'rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm';
const BUTTON = `${FONT} box-border inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-5 text-[14px] font-semibold no-underline transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const PRIMARY = `${BUTTON} border-0 bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-md shadow-sky-500/20 hover:opacity-95 hover:text-white`;
const SECONDARY = `${BUTTON} border border-solid border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900`;

const consentKey = (submissionId: string) => ['candidate-submission-consent', submissionId] as const;

const timeLeft = (expiresAt: string, now: number) => {
  const minutes = dayjs(expiresAt).diff(dayjs(now), 'minute');
  if (minutes <= 0) return 'đã hết hạn';
  return minutes < 60 ? `còn ${Math.max(minutes, 1)} phút` : `còn ${Math.floor(minutes / 60)} giờ`;
};

const webLink = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);

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
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [review.data?.status]);

  const respond = useMutation({
    mutationFn: (decision: 'CONFIRM' | 'DECLINE') =>
      candidateConsentApi.respond(submissionId, decision, allowFutureReuse),
    onSuccess: async (result) => {
      message.success(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: consentKey(submissionId) }),
        queryClient.invalidateQueries({ queryKey: ['candidate-submission-consents'] }),
        queryClient.invalidateQueries({ queryKey: ['candidate-applications'] }),
      ]);
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

  if (review.isLoading) {
    return (
      <div className={`${FONT} mx-auto flex max-w-[768px] flex-col gap-4 py-2`}>
        <section className={`${CARD} p-7`}>
          <Skeleton active paragraph={{ rows: 7 }} />
        </section>
      </div>
    );
  }

  if (review.isError || !review.data) {
    const error = getApiError(review.error, 'Không tải được yêu cầu xác nhận hồ sơ.');
    return (
      <div className={`${FONT} mx-auto flex max-w-[768px] flex-col gap-4 py-2 text-[14px] text-[#1F2937]`}>
        <section className={`${CARD} p-7 text-center`}>
          <h1 className="m-0 text-[22px] font-bold text-[#1F2937]">Không thể mở yêu cầu xác nhận</h1>
          <p className="m-0 mt-2 text-[#4B5563]">{error.message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => navigate('/candidate/applications')} className={`${PRIMARY} min-w-[160px]`}>
              Về đơn ứng tuyển
            </button>
          </div>
        </section>
      </div>
    );
  }

  const consent = review.data;
  const isPending = consent.status === 'PENDING' && dayjs(consent.expiresAt).isAfter(now);

  if (!isPending) {
    const confirmed = consent.status === 'CONFIRMED';
    return (
      <div className={`${FONT} mx-auto flex max-w-[768px] flex-col gap-4 py-2 text-[14px] text-[#1F2937]`}>
        <section className={`${CARD} p-7 text-center`}>
          <h1 className="m-0 text-[22px] font-bold text-[#1F2937]">
            {confirmed ? 'Bạn đã đồng ý nộp hồ sơ' : consent.status === 'DECLINED' ? 'Bạn đã từ chối hồ sơ' : 'Yêu cầu xác nhận đã kết thúc'}
          </h1>
          <p className="m-0 mt-2 text-[#4B5563]">
            {confirmed
              ? 'HR Connect đã tạo đơn ứng tuyển và chuyển hồ sơ của bạn sang bước đánh giá tiếp theo.'
              : 'Yêu cầu này đã được đóng và không thể phản hồi thêm.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => navigate('/candidate/applications')} className={`${PRIMARY} min-w-[180px]`}>
              Xem đơn ứng tuyển
            </button>
          </div>
        </section>
      </div>
    );
  }

  const cvUrl = webLink(consent.cvDownloadUrl);

  return (
    <div className={`${FONT} candidate-page candidate-consent-page mx-auto flex max-w-[768px] flex-col gap-4 py-2 text-[14px] text-[#1F2937] [line-height:normal] animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      <div>
        <Link to="/candidate/applications" className={`inline-flex items-center text-[13.5px] font-medium ${LINK}`}>
          ‹ Quay lại đơn ứng tuyển
        </Link>
      </div>

      <section aria-labelledby="consent-heading" className={`${CARD} p-5 sm:p-7`}>
        <p className="m-0 text-[#4B5563]">
          Xin chào <b className="font-semibold text-[#111827]">{consent.candidateName}</b>,
        </p>
        <h1 id="consent-heading" className="m-0 mb-2 mt-1.5 text-[22px] font-bold text-[#1F2937]">
          Bạn được giới thiệu ứng tuyển vào một vị trí
        </h1>
        <p className="m-0 text-[#4B5563]">
          Một Affiliate của HR Connect muốn gửi hồ sơ của bạn đến nhà tuyển dụng dưới đây. Hồ sơ <b className="font-semibold text-[#111827]">chỉ được gửi khi bạn đồng ý</b>.
        </p>

        <div className="mt-5 flex items-start gap-[14px] rounded-lg border border-solid border-[#E5E7EB] p-4">
          <CompanyMark name={consent.companyName} size={58} />
          <div className="min-w-0 flex-1">
            <div className="break-words text-[16px] font-bold text-[#1F2937]">{consent.jobTitle}</div>
            <div className="mt-0.5 break-words text-[#4B5563]">{consent.companyName}</div>
            {(consent.jobLocation || consent.workMode) && (
              <div className="mt-0.5 break-words text-[13px] text-[#4B5563]">
                {[
                  consent.jobLocation,
                  consent.workMode === 'ONSITE'
                    ? 'Làm tại văn phòng'
                    : consent.workMode === 'HYBRID'
                      ? 'Linh hoạt (Hybrid)'
                      : consent.workMode === 'REMOTE'
                        ? 'Làm từ xa (Remote)'
                        : consent.workMode,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            {(consent.salaryMin != null || consent.salaryMax != null || consent.salaryNegotiable || consent.experienceRequirement) && (
              <div className="mt-0.5 break-words text-[13px] text-[#4B5563]">
                {[
                  consent.salaryMin != null && consent.salaryMax != null
                    ? `${Math.round(consent.salaryMin / 1_000_000)} – ${Math.round(consent.salaryMax / 1_000_000)} triệu ${consent.currencyCode || 'VND'}${consent.salaryNegotiable ? ' (Thương lượng)' : ''}`
                    : consent.salaryNegotiable
                      ? 'Thỏa thuận'
                      : null,
                  consent.experienceRequirement,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
          </div>
        </div>

        <dl className="m-0 mt-4 grid grid-cols-1 gap-x-5 gap-y-3 text-[13px] sm:grid-cols-2">
          {consent.affiliateDisplayName && (
            <div className="min-w-0">
              <dt className="text-[#6B7280]">Người giới thiệu</dt>
              <dd className="m-0 mt-0.5 break-words font-semibold text-[#1F2937]">
                {consent.affiliateDisplayName} (Affiliate đối tác của HR Connect)
              </dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-[#6B7280]">CV được gửi kèm</dt>
            <dd className="m-0 mt-0.5 break-words">
              {cvUrl ? (
                <a href={cvUrl} target="_blank" rel="noopener noreferrer" className={`font-semibold ${LINK}`}>
                  {consent.cvFileName}
                </a>
              ) : (
                <span className="font-semibold text-[#1F2937]">{consent.cvFileName}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[#6B7280]">Hạn xác nhận</dt>
            <dd className="m-0 mt-0.5 font-semibold text-[#9A3412]">
              {dayjs(consent.expiresAt).format('HH:mm, DD/MM/YYYY')} ({timeLeft(consent.expiresAt, now)})
            </dd>
          </div>
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] text-[#4B5563]">
          <input
            type="checkbox"
            checked={allowFutureReuse}
            disabled={respond.isPending}
            onChange={(event) => setAllowFutureReuse(event.target.checked)}
            className="mt-px h-4 w-4 shrink-0 cursor-pointer accent-[#0369A1]"
          />
          <span>
            Cho phép đối tác tuyển dụng này dùng lại CV để gửi yêu cầu xác nhận cho công việc khác. Mỗi công việc mới vẫn cần tôi đồng ý riêng.
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            aria-label="Đồng ý nộp hồ sơ"
            disabled={respond.isPending}
            onClick={() => respond.mutate('CONFIRM')}
            className={`${PRIMARY} flex-[1_1_200px]`}
          >
            {respond.isPending ? 'Đang xử lý…' : 'Đồng ý ứng tuyển'}
          </button>
          <Popconfirm
            title="Từ chối lời giới thiệu này?"
            description="Hồ sơ sẽ không được gửi đến doanh nghiệp."
            okText="Từ chối"
            okButtonProps={{ danger: true }}
            cancelText="Quay lại"
            disabled={respond.isPending}
            onConfirm={() => respond.mutate('DECLINE')}
          >
            <button type="button" disabled={respond.isPending} className={`${SECONDARY} flex-[1_1_160px]`}>
              Từ chối
            </button>
          </Popconfirm>
        </div>
        <p className="m-0 mt-[14px] text-[13px] text-[#6B7280]">
          Quá hạn mà bạn chưa trả lời, lời giới thiệu sẽ tự hủy. Sau khi đồng ý, bạn có thể theo dõi tiến trình trực tiếp tại mục Đơn ứng tuyển.
        </p>
      </section>

      <section aria-labelledby="consent-privacy" className={`${CARD} px-[22px] py-[18px]`}>
        <h2 id="consent-privacy" className="m-0 mb-1.5 text-[15px] font-bold text-[#1F2937]">
          Dữ liệu của bạn được dùng thế nào?
        </h2>
        <ul className="m-0 pl-5 text-[13px] leading-[1.7] text-[#4B5563]">
          <li>Chỉ nhà tuyển dụng của vị trí này nhận được CV của bạn.</li>
          <li>Thông tin liên hệ được che khi nhà tuyển dụng xem hồ sơ ở vòng đầu.</li>
          <li>
            Không phải bạn? <Link to="/contact" className={LINK}>Báo cho HR Connect</Link> để chúng tôi xử lý.
          </li>
        </ul>
      </section>
    </div>
  );
};

export default CandidateSubmissionConsentPage;
