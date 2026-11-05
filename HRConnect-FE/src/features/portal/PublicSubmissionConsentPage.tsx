/**
 * @file PublicSubmissionConsentPage.tsx
 * @description Referral confirmation for a candidate without an account (mockup 03/11, Consent), opened from the
 * emailed link. The token lives in the URL fragment and is removed from the address bar as soon as it is read.
 * The review API has no location, salary, experience or job link, so those mockup lines are not shown.
 */
import React, { useLayoutEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App as AntApp, Popconfirm, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';
import { CompanyMark } from '@/features/landing/components/SiteParts';
import { candidateConsentApi } from '@/services/api/mf02Api';
import { getApiError } from '@/services/apiClient';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white';
const BUTTON = `${FONT} box-border flex h-12 cursor-pointer items-center justify-center rounded-md px-4 text-[15px] no-underline disabled:cursor-not-allowed disabled:opacity-60`;
const PRIMARY = `${BUTTON} border-0 bg-[#0C4A6E] font-semibold text-white hover:bg-[#075985] hover:text-white`;
const SECONDARY = `${BUTTON} border border-solid border-[#D1D5DB] bg-white text-[#1F2937] hover:bg-[#F9FAFB] hover:text-[#1F2937]`;

const timeLeft = (expiresAt: string) => {
  const minutes = dayjs(expiresAt).diff(dayjs(), 'minute');
  return minutes < 60 ? `còn ${Math.max(minutes, 1)} phút` : `còn ${Math.floor(minutes / 60)} giờ`;
};
const webLink = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={`${FONT} min-h-screen bg-[#F7F8FA] text-[14px] text-[#1F2937] [line-height:normal]`}>
    <header className="bg-[#0C4A6E] text-white">
      <div className="mx-auto flex h-16 max-w-[1248px] items-center px-6">
        <Link to="/" className="flex items-center gap-2 text-[18px] font-bold text-white no-underline hover:text-white hover:no-underline">
          <BrandMark size={32} tone="light" className="block" /> HR Connect
        </Link>
        <Link to="/login" className="ml-auto rounded-md border border-solid border-[#7FA6C2] px-[14px] py-2 font-medium text-white no-underline hover:bg-[#075985] hover:text-white">Đăng nhập</Link>
      </div>
    </header>
    <main className="mx-auto flex max-w-[768px] flex-col gap-4 px-4 pb-14 pt-8 sm:px-6">{children}</main>
  </div>
);

const Notice: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <Frame>
    <section className={`${CARD} p-7 text-center`}>
      <h1 className="m-0 text-[22px] font-bold">{title}</h1>
      <p className="m-0 mt-2 text-[#4B5563]">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        {action}
        <Link to="/" className={action ? `${SECONDARY} min-w-[160px]` : `${PRIMARY} min-w-[160px]`}>Về trang chủ</Link>
      </div>
    </section>
  </Frame>
);

export const PublicSubmissionConsentPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [{ token, submissionId }] = useState(() => {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    return {
      token: fragment.get('token')?.trim() || null,
      submissionId: fragment.get('submissionId')?.trim() || null,
    };
  });
  const [allowFutureReuse, setAllowFutureReuse] = useState(false);
  const [completed, setCompleted] = useState<string>();
  // UI-03: lỗi không thể làm lại (job đóng, yêu cầu hết hạn, đã xử lý) thì đóng form thay vì giữ nút.
  const [closedReason, setClosedReason] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!submissionId && location.hash) {
      window.history.replaceState(
        window.history.state,
        document.title,
        `${window.location.pathname}${window.location.search}`
      );
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate, submissionId]);

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
    onSuccess: (result) => setCompleted(result.submissionStatus),
    onError: (error) => {
      const apiError = getApiError(error, 'Không thể ghi nhận lựa chọn của bạn.');
      if (apiError.status === 409 || apiError.status === 410) setClosedReason(apiError.message);
      message.error(
        apiError.status === 429 && apiError.retryAfterSeconds
          ? `${apiError.message} Vui lòng thử lại sau ${apiError.retryAfterSeconds} giây.`
          : apiError.message
      );
    },
  });

  if (submissionId) {
    return <Navigate to={`/candidate/submission-consents/${encodeURIComponent(submissionId)}`} replace />;
  }

  if (!token) return <Notice title="Liên kết xác nhận không hợp lệ" text="Vui lòng mở lại liên kết mới nhất được HR Connect gửi qua email." />;
  if (closedReason) return <Notice title="Yêu cầu này không còn xử lý được" text={closedReason} />;

  if (review.isLoading) return <Frame><section className={`${CARD} p-7`}><Skeleton active paragraph={{ rows: 7 }} /></section></Frame>;

  if (review.isError || !review.data) {
    return <Notice title="Không thể mở yêu cầu xác nhận" text={getApiError(review.error, 'Không tải được yêu cầu xác nhận hồ sơ.').message} />;
  }

  const consent = review.data;
  if (completed || consent.status !== 'PENDING' || dayjs(consent.expiresAt).isBefore(dayjs())) {
    // PENDING_IDENTITY_REVIEW: the candidate did agree; HR Connect holds the submission until identities are checked.
    const accepted = completed === 'ACCEPTED' || completed === 'PENDING_IDENTITY_REVIEW' || consent.status === 'CONFIRMED';
    if (accepted) {
      const progress = completed === 'ACCEPTED'
        ? 'HR Connect đã tạo đơn ứng tuyển và chuyển hồ sơ sang bước đánh giá tiếp theo.'
        : completed === 'PENDING_IDENTITY_REVIEW'
          ? 'Hồ sơ đang được đối chiếu danh tính trước khi chuyển sang bước tuyển dụng tiếp theo.'
          : 'HR Connect đã ghi nhận sự đồng ý của bạn với lời giới thiệu này.';
      return (
        <Notice
          title="Đã đồng ý nộp hồ sơ"
          text={`${progress} Để theo dõi kết quả, hãy đăng ký tài khoản bằng đúng email đã nhận lời giới thiệu này.`}
          action={<Link to="/register" className={`${PRIMARY} min-w-[160px]`}>Đăng ký tài khoản</Link>}
        />
      );
    }
    return (
      <Notice
        title={completed === 'CONSENT_REJECTED' || consent.status === 'DECLINED' ? 'Đã từ chối hồ sơ' : 'Yêu cầu xác nhận đã kết thúc'}
        text="Hồ sơ sẽ không được gửi đến doanh nghiệp."
      />
    );
  }

  const cvUrl = webLink(consent.cvDownloadUrl);

  return (
    <Frame>
      <section aria-labelledby="ct" className={`${CARD} p-5 sm:p-7`}>
        <p className="m-0 text-[#4B5563]">Xin chào <b className="text-[#111827]">{consent.candidateName}</b>,</p>
        <h1 id="ct" className="m-0 mb-2 mt-1.5 text-[22px] font-bold">Bạn được giới thiệu ứng tuyển vào một vị trí</h1>
        <p className="m-0 text-[#4B5563]">Một Affiliate của HR Connect muốn gửi hồ sơ của bạn đến nhà tuyển dụng dưới đây. Hồ sơ <b>chỉ được gửi khi bạn đồng ý</b>.</p>

        <div className="mt-5 flex items-start gap-[14px] rounded-lg border border-solid border-[#E5E7EB] p-4">
          <CompanyMark name={consent.companyName} size={58} />
          <div className="min-w-0 flex-1">
            <div className="break-words text-[16px] font-bold">{consent.jobTitle}</div>
            <div className="break-words text-[#4B5563]">{consent.companyName}</div>
          </div>
        </div>

        <dl className="m-0 mt-4 grid grid-cols-1 gap-x-5 gap-y-3 text-[13px] sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[#6B7280]">CV được gửi kèm</dt>
            <dd className="m-0 mt-0.5 break-words">
              {cvUrl ? <a href={cvUrl} target="_blank" rel="noopener noreferrer" className={`font-semibold ${LINK}`}>{consent.cvFileName}</a> : <span className="font-semibold">{consent.cvFileName}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[#6B7280]">Hạn xác nhận</dt>
            <dd className="m-0 mt-0.5 font-semibold text-[#9A3412]">{dayjs(consent.expiresAt).format('HH:mm, DD/MM/YYYY')} ({timeLeft(consent.expiresAt)})</dd>
          </div>
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] text-[#4B5563]">
          <input type="checkbox" checked={allowFutureReuse} disabled={respond.isPending} onChange={(event) => setAllowFutureReuse(event.target.checked)} className="mt-px h-4 w-4 shrink-0 cursor-pointer accent-[#0369A1]" />
          <span>Cho phép đối tác tuyển dụng này dùng lại CV để gửi yêu cầu xác nhận cho công việc khác. Mỗi công việc mới vẫn cần tôi đồng ý riêng.</span>
        </label>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button type="button" disabled={respond.isPending} onClick={() => respond.mutate('CONFIRM')} className={`${PRIMARY} flex-[1_1_200px]`}>Đồng ý ứng tuyển</button>
          <Popconfirm
            title="Từ chối lời giới thiệu này?"
            description="Hồ sơ sẽ không được gửi đến doanh nghiệp."
            okText="Từ chối"
            okButtonProps={{ danger: true }}
            cancelText="Quay lại"
            disabled={respond.isPending}
            onConfirm={() => respond.mutate('DECLINE')}
          >
            <button type="button" disabled={respond.isPending} className={`${SECONDARY} flex-[1_1_160px]`}>Từ chối</button>
          </Popconfirm>
        </div>
        <p className="m-0 mt-[14px] text-[13px] text-[#6B7280]">Quá hạn mà bạn chưa trả lời, lời giới thiệu sẽ tự hủy. Bạn có thể đăng ký tài khoản sau khi đồng ý để theo dõi kết quả ứng tuyển.</p>
      </section>

      <section aria-labelledby="privacy" className={`${CARD} px-[22px] py-[18px]`}>
        <h2 id="privacy" className="m-0 mb-1.5 text-[15px] font-bold">Dữ liệu của bạn được dùng thế nào?</h2>
        <ul className="m-0 pl-5 text-[13px] leading-[1.7] text-[#4B5563]">
          <li>Chỉ nhà tuyển dụng của vị trí này nhận được CV của bạn.</li>
          <li>Với một số vị trí, nhà tuyển dụng chỉ thấy CV đã che thông tin liên hệ cho đến khi bạn đi làm.</li>
          <li>Không phải bạn? <Link to="/contact" className={LINK}>Báo cho HR Connect</Link> để chúng tôi xử lý.</li>
        </ul>
      </section>
    </Frame>
  );
};
