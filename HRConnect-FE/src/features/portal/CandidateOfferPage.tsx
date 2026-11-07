/**
 * @file CandidateOfferPage.tsx
 * @description One offer for the Candidate (mockup 03/11) on GET /offers/{id}: its terms and the answer.
 * The answer section shows only while the offer can still be answered. Before accepting, it asks the backend
 * how this offer affects the Candidate's other full-time offers and placement (GET /offers/{id}/acceptance-impact).
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { CompanyMark } from '@/features/landing/components/SiteParts';
import { isCandidateOfferRespondable, mf04Api } from '@/services/api/mf04Api';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import type { OfferAcceptanceAction } from '@/types/api/mf04';
import { candidateOfferStatus } from './mf02Labels';
import { candidateKeys } from './candidate/candidateKeys';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white p-6';
const PAGE = `${FONT} mx-auto flex max-w-[880px] flex-col gap-4 text-[14px] text-[#1F2937] [line-height:normal]`;

const STATUS_COLOR: Record<string, { text: string; background: string }> = {
  SENT: { text: '#9A3412', background: '#FFEDD5' },
  ACCEPTED: { text: '#166534', background: '#DCFCE7' },
  DECLINED: { text: '#374151', background: '#F3F4F6' },
  WITHDRAWN: { text: '#374151', background: '#F3F4F6' },
  EXPIRED: { text: '#374151', background: '#F3F4F6' },
};

const money = (amount?: number | null, currency?: string | null) => (amount != null ? `${amount.toLocaleString('vi-VN')} ${currency || 'VND'}` : 'Thương lượng');
const webLink = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);
const fileNameOf = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'Xem thư mời';
  } catch {
    return 'Xem thư mời';
  }
};

const FULL_TIME_CONFLICT_CODES = ['ACCEPTED_FULL_TIME_OFFER_EXISTS', 'ACTIVE_FULL_TIME_PLACEMENT_EXISTS', 'ACTIVE_FULL_TIME_PLACEMENT_CONFLICT'];

const salaryTerms = (basis?: string | null, period?: string | null) =>
  [
    { GROSS: 'Gross', NET: 'Net' }[String(basis).toUpperCase()],
    { MONTHLY: 'theo tháng', MONTH: 'theo tháng', YEARLY: 'theo năm', ANNUAL: 'theo năm', YEAR: 'theo năm' }[String(period).toUpperCase()],
  ].filter(Boolean).join(', ');

export const CandidateOfferPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const { applicationId = '', offerId = '' } = useParams();
  const [choice, setChoice] = useState<'ACCEPTED' | 'DECLINED'>('ACCEPTED');
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const [pendingOffersAction, setPendingOffersAction] = useState<OfferAcceptanceAction>('KEEP_OTHER_PENDING_OFFERS');

  const detail = useQuery({
    queryKey: ['candidate-offer', offerId],
    queryFn: () => mf04Api.getOfferDetail(offerId),
    enabled: Boolean(offerId),
  });
  const versions = useQuery({
    queryKey: ['candidate-offer-versions', applicationId],
    queryFn: () => mf04Api.getOffers({ applicationId }),
    enabled: Boolean(applicationId),
  });

  const impact = useQuery({
    queryKey: ['candidate-offer-impact', offerId],
    queryFn: () => mf04Api.getOfferAcceptanceImpact(offerId),
    enabled: Boolean(detail.data && isCandidateOfferRespondable(detail.data)),
  });
  const conflict = impact.data;
  // Switching away from an accepted full-time offer is the only way to accept this one, so nothing to choose.
  const replacesAccepted = Boolean(conflict?.isFullTime && conflict.acceptedFullTimeOffer && !conflict.activeFullTimePlacement);
  const acceptanceAction: OfferAcceptanceAction = replacesAccepted ? 'REPLACE_ACCEPTED_FULL_TIME_OFFER' : pendingOffersAction;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['candidate-offer', offerId] });
    void queryClient.invalidateQueries({ queryKey: ['candidate-offer-versions', applicationId] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
  };

  const respond = useMutation({
    mutationFn: () => mf04Api.respondOffer(offerId, {
      response: choice,
      declineReason: choice === 'DECLINED' ? reason.trim() : undefined,
      concurrencyToken: detail.data!.concurrencyToken,
      acceptanceAction: choice === 'ACCEPTED' ? acceptanceAction : undefined,
    }),
    onSuccess: (result) => {
      message.success(result?.message || 'Đã gửi trả lời.');
      refresh();
    },
    onError: (error) => {
      const failure = getApiError(error, '');
      if (failure.status === 409 && FULL_TIME_CONFLICT_CODES.includes(failure.code ?? '')) {
        message.error(failure.message || 'Không thể chấp nhận thư mời do trùng công việc toàn thời gian.');
        void impact.refetch();
        return;
      }
      if (failure.status === 409) {
        message.warning('Offer vừa thay đổi. Đang tải lại dữ liệu.');
        refresh();
        return;
      }
      message.error(getApiErrorMessage(error, 'Không gửi được trả lời.'));
    },
  });

  const back = <Link to={`/candidate/applications/${applicationId}`} className={`self-start text-[13px] ${LINK}`}>‹ Quay lại đơn ứng tuyển</Link>;

  if (detail.isLoading) return <div className={PAGE}><div className={CARD}><Skeleton active paragraph={{ rows: 7 }} /></div></div>;
  if (detail.isError || !detail.data) {
    return (
      <div className={PAGE}>
        {back}
        <div className={`${CARD} text-center`}>
          <h1 className="m-0 text-[18px] font-bold">Không mở được thư mời nhận việc</h1>
          <p className="m-0 mt-2 text-[#4B5563]">{getApiErrorMessage(detail.error)}</p>
          <button type="button" onClick={() => detail.refetch()} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Thử lại</button>
        </div>
      </div>
    );
  }

  const offer = detail.data;
  const canAnswer = isCandidateOfferRespondable(offer);
  const status = String(offer.status).toUpperCase();
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.DECLINED;
  const terms = salaryTerms(offer.salaryBasis, offer.salaryPeriod);
  const documentUrl = webLink(offer.offerDocumentUrl);
  const daysLeft = offer.expiryDate ? dayjs(offer.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
  const previous = (versions.data ?? []).filter((item) => item.offerVersion < offer.offerVersion).sort((a, b) => b.offerVersion - a.offerVersion)[0];
  const declining = choice === 'DECLINED';
  const acceptBlocked = !declining && (impact.isLoading || impact.isError || Boolean(conflict?.activeFullTimePlacement));
  const pendingFullTime = conflict?.isFullTime && !conflict.activeFullTimePlacement && !conflict.acceptedFullTimeOffer ? conflict.otherPendingFullTimeOffers : [];

  const submit = () => {
    if (declining && !reason.trim()) {
      setReasonMissing(true);
      return;
    }
    respond.mutate();
  };

  return (
    <div className={PAGE}>
      {back}

      <section aria-labelledby="offer" className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyMark name={offer.job?.companyName} size={58} />
            <div className="min-w-0">
              <h1 id="offer" className="m-0 text-[20px] font-bold text-[#1F2937]">Thư mời nhận việc – {offer.job?.title}</h1>
              <div className="mt-0.5 text-[#4B5563]">
                {[offer.job?.companyName, `Phiên bản ${offer.offerVersion}`, offer.sentAt && `Gửi ngày ${dayjs(offer.sentAt).format('DD/MM/YYYY')}`].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <span role="status" className="rounded px-2.5 py-1 text-[13px] font-semibold" style={{ color: color.text, background: color.background }}>
            {canAnswer ? 'Chờ bạn trả lời' : candidateOfferStatus(offer.status)}
          </span>
        </div>

        <dl className="m-0 mt-[22px] grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border border-solid border-[#E2E8F0] bg-[#F8FAFC] p-[18px] sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[#6B7280]">Mức lương</dt>
            <dd className="m-0 mt-0.5 text-[20px] font-bold text-[#C2410C]">{money(offer.salary, offer.currencyCode)}</dd>
            {terms && <dd className="m-0 text-[13px] text-[#4B5563]">{terms}</dd>}
          </div>
          <div>
            <dt className="text-[12px] text-[#6B7280]">Ngày bắt đầu dự kiến</dt>
            <dd className="m-0 mt-0.5 text-[16px] font-semibold">{offer.startDate ? dayjs(offer.startDate).format('DD/MM/YYYY') : 'Chưa xác định'}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[#6B7280]">Hạn trả lời</dt>
            <dd className="m-0 mt-0.5 text-[16px] font-semibold">{offer.expiryDate ? `23:59, ${dayjs(offer.expiryDate).format('DD/MM/YYYY')}` : 'Không đặt hạn'}</dd>
            {canAnswer && daysLeft !== null && <dd className="m-0 text-[13px] text-[#9A3412]">{daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Hết hạn hôm nay'}</dd>}
          </div>
          <div className="min-w-0">
            <dt className="text-[12px] text-[#6B7280]">Thư mời chi tiết</dt>
            <dd className="m-0 mt-1 break-words">
              {documentUrl ? <a href={documentUrl} target="_blank" rel="noopener noreferrer" className={`font-semibold ${LINK}`}>{fileNameOf(documentUrl)}</a> : <span className="text-[#4B5563]">Không có tệp đính kèm</span>}
            </dd>
          </div>
        </dl>
        {previous && (
          <p className="m-0 mt-[14px] text-[13px] text-[#4B5563]">
            Phiên bản {offer.offerVersion} thay thế phiên bản {previous.offerVersion} (lương {money(previous.salary, previous.currencyCode)}). Chỉ phiên bản mới nhất có hiệu lực.
          </p>
        )}
        {offer.declineReason && <p className="m-0 mt-[14px] text-[13px] text-[#4B5563]">Lý do từ chối: {offer.declineReason}</p>}
      </section>

      {canAnswer && (
        <section aria-labelledby="answer" className={CARD}>
          <h2 id="answer" className="m-0 mb-1.5 text-[16px] font-bold text-[#1F2937]">Trả lời thư mời</h2>
          <p className="m-0 mb-4 text-[#4B5563]">Sau khi chấp nhận, nhà tuyển dụng sẽ liên hệ để xác nhận ngày bắt đầu đi làm.</p>
          <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
            <legend className="absolute left-[-9999px]">Lựa chọn</legend>
            <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-solid p-[14px] ${!declining ? 'border-2 border-[#0369A1] bg-[#F0F9FF]' : 'border border-[#E5E7EB]'}`}>
              <input type="radio" name="answer" checked={!declining} onChange={() => setChoice('ACCEPTED')} className="ml-[5px] mr-[3px] mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0369A1]" />
              <span><b>Chấp nhận offer</b><span className="block text-[13px] text-[#4B5563]">Đồng ý mức lương và ngày bắt đầu dự kiến ở trên.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-solid p-[14px] ${declining ? 'border-2 border-[#0369A1] bg-[#F0F9FF]' : 'border border-[#E5E7EB]'}`}>
              <input type="radio" name="answer" checked={declining} onChange={() => setChoice('DECLINED')} className="ml-[5px] mr-[3px] mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0369A1]" />
              <span className="min-w-0 flex-1">
                <b>Từ chối offer</b>
                <span className="block text-[13px] text-[#4B5563]">Cho nhà tuyển dụng biết lý do để họ phản hồi phù hợp.</span>
                <textarea
                  rows={3}
                  aria-label="Lý do từ chối"
                  aria-invalid={reasonMissing}
                  placeholder="Ví dụ: đã nhận một offer khác phù hợp hơn"
                  value={reason}
                  onFocus={() => setChoice('DECLINED')}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonMissing(false);
                  }}
                  className={`${FONT} mt-2.5 w-full resize-y rounded-md border border-solid px-3 py-2.5 text-[14px] text-[#1F2937] outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1] ${reasonMissing ? 'border-[#B91C1C]' : 'border-[#D1D5DB]'}`}
                />
                {reasonMissing && <span role="alert" className="mt-1 block text-[12px] text-[#B91C1C]">Vui lòng nhập lý do từ chối.</span>}
              </span>
            </label>
          </fieldset>
          {!declining && impact.isError && (
            <p role="alert" className="m-0 mt-3 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2] p-3 text-[13px] text-[#991B1B]">
              Chưa kiểm tra được các thư mời khác của bạn nên chưa thể chấp nhận.{' '}
              <button type="button" onClick={() => impact.refetch()} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold ${LINK}`}>Thử lại</button>
            </p>
          )}
          {!declining && conflict?.activeFullTimePlacement && (
            <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2] p-3.5 text-[13px] text-[#991B1B]">
              <div className="min-w-0 flex-1 leading-relaxed">
                Bạn đang có công việc toàn thời gian: <b>{conflict.activeFullTimePlacement.jobTitle}</b> tại <b>{conflict.activeFullTimePlacement.companyName}</b>. Vui lòng liên hệ bộ phận hỗ trợ nếu thông tin này không còn chính xác.
              </div>
              <Link
                to="/contact?service=OTHER"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-solid border-[#DC2626] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#DC2626] no-underline shadow-xs transition-colors hover:bg-[#FEF2F2]"
              >
                Liên hệ hỗ trợ
              </Link>
            </div>
          )}
          {!declining && replacesAccepted && conflict?.acceptedFullTimeOffer && (
            <p className="m-0 mt-3 rounded-md border border-solid border-[#FED7AA] bg-[#FFF7ED] p-3 text-[13px] text-[#9A3412]">
              <b>Bạn đã chấp nhận một thư mời toàn thời gian khác</b>: {conflict.acceptedFullTimeOffer.jobTitle} tại {conflict.acceptedFullTimeOffer.companyName}. Gửi trả lời này sẽ chuyển sang thư mời mới: hồ sơ cũ được rút và nhà tuyển dụng cũ nhận thông báo, nhưng không được biết tên công ty mới.
            </p>
          )}
          {!declining && pendingFullTime.length > 0 && (
            <fieldset className="m-0 mt-3 min-w-0 rounded-md border border-solid border-[#BAE6FD] bg-[#F0F9FF] p-3 text-[13px]">
              <legend className="float-left mb-1 w-full p-0 font-semibold text-[#075985]">Bạn còn {pendingFullTime.length} thư mời toàn thời gian đang chờ trả lời</legend>
              <ul className="m-0 mb-2 clear-both list-disc pl-5 text-[#4B5563]">
                {pendingFullTime.map((item) => <li key={item.offerId}>{item.jobTitle} – {item.companyName}</li>)}
              </ul>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input type="radio" name="pendingOffers" checked={pendingOffersAction === 'KEEP_OTHER_PENDING_OFFERS'} onChange={() => setPendingOffersAction('KEEP_OTHER_PENDING_OFFERS')} className="h-4 w-4 shrink-0 cursor-pointer accent-[#0369A1]" />
                Chấp nhận và vẫn giữ các thư mời đang chờ
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input type="radio" name="pendingOffers" checked={pendingOffersAction === 'WITHDRAW_OTHER_PENDING_FULL_TIME_OFFERS'} onChange={() => setPendingOffersAction('WITHDRAW_OTHER_PENDING_FULL_TIME_OFFERS')} className="h-4 w-4 shrink-0 cursor-pointer accent-[#0369A1]" />
                Chấp nhận và rút các thư mời toàn thời gian đang chờ
              </label>
            </fieldset>
          )}
          <div className="mt-[18px] flex justify-end">
            <button type="button" disabled={respond.isPending || acceptBlocked} onClick={submit} className={`${FONT} h-11 cursor-pointer rounded-md border-0 bg-[#C2410C] px-[22px] text-[14px] font-semibold text-white hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]`}>
              {respond.isPending ? 'Đang gửi…' : 'Gửi trả lời'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
