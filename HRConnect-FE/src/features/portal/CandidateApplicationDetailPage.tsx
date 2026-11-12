/**
 * @file CandidateApplicationDetailPage.tsx
 * @description One application (mockup 03/11): progress, history and what the candidate must do next,
 * on the MF-04 detail (MF-02 as fallback). Withdrawing happens here, answering an offer on its own page.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Modal, Skeleton } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { CompanyMark } from '@/features/landing/components/SiteParts';
import { CandidateInterviewDetailModal } from '@/features/candidates/CandidateInterviewDetailModal';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { isCandidateOfferRespondable, mf04Api } from '@/services/api/mf04Api';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import type { CandidateOfferSummaryDto } from '@/types/api/mf04';
import { useCandidateInterviewDetail } from '@/hooks/useCandidateInterviewDetail';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';
import { CandidateDialog, DIALOG_CANCEL, DIALOG_DANGER, DIALOG_FONT } from './candidate/CandidateDialog';
import { candidateInterviewType, candidateOfferStatus, candidateStage, candidateTimelineEventCopy } from './mf02Labels';
import { candidateKeys, useOpenSignedUrl } from './CandidatePages';
import { CandidateResignModal } from './components/CandidateResignModal';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white';
const PRIMARY = `${FONT} block h-[42px] w-full cursor-pointer rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-3 text-center text-[14px] font-bold leading-[42px] text-white no-underline shadow-sm shadow-blue-500/20 hover:from-sky-400 hover:to-blue-500 hover:text-white active:scale-[0.98]`;

/** Steps shown to the candidate, and which one each internal stage (0–6) reaches. */
const STEPS = ['Đã nộp', 'Sàng lọc', 'Phỏng vấn', 'Offer', 'Nhận việc'];
const STEP_OF_STAGE = [1, 2, 2, 3, 4, 4, 5];

const TONE_COLOR: Record<string, { text: string; background: string }> = {
  success: { text: '#166534', background: '#DCFCE7' },
  warning: { text: '#9A3412', background: '#FFEDD5' },
  info: { text: '#075985', background: '#E0F2FE' },
  neutral: { text: '#374151', background: '#F3F4F6' },
};

const UPCOMING_INTERVIEW = ['SCHEDULED', 'RESCHEDULED'];
const INTERVIEW_STATUS: Record<string, string> = {
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Đã ghi nhận vắng mặt',
  RESCHEDULED: 'Đã dời lịch',
  SCHEDULED: 'Đã lên lịch',
};

const statusOf = (interview: { status?: string | null }) => String(interview.status || '').toUpperCase();
const webLink = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);
const money = (amount?: number | null, currency?: string | null) => (amount != null ? `${amount.toLocaleString('vi-VN')} ${currency || 'VND'}` : 'Thương lượng');
const offerDeadline = (offer: CandidateOfferSummaryDto) => offer.expiryDate || offer.validUntil || offer.expiresAt;

const interviewTime = (interview: { scheduledAt?: string | null; durationMinutes?: number | null; interviewType?: string | null }) => {
  const type = candidateInterviewType(interview.interviewType);
  if (!interview.scheduledAt) return type;
  const start = dayjs(interview.scheduledAt).locale('vi');
  const hours = interview.durationMinutes ? `${start.format('HH:mm')} – ${start.add(interview.durationMinutes, 'minute').format('HH:mm')}` : start.format('HH:mm');
  return `${hours}, ${start.format('dddd DD/MM/YYYY')} · ${type}`;
};

const NextInterview: React.FC<{
  interview: { interviewId: string; interviewRound: number; interviewType?: string | null; scheduledAt?: string | null; durationMinutes?: number | null; meetingLink?: string | null };
  onOpen: () => void;
}> = ({ interview, onOpen }) => {
  const { interview: detail } = useCandidateInterviewDetail(interview.interviewId);
  const canConfirm = detail?.status === 'SCHEDULED' && detail.candidateAttendanceStatus !== 'CONFIRMED';
  return (
    <>
      <div className="font-semibold">Phỏng vấn vòng {interview.interviewRound}</div>
      <div className="mt-0.5 text-[13px] text-[#4B5563]">{interviewTime(interview)}</div>
      {canConfirm && <div className="mt-1.5 text-[13px] text-[#9A3412]">Bạn chưa xác nhận tham gia</div>}
      {detail?.candidateAttendanceStatus === 'CONFIRMED' && <div className="mt-1.5 text-[13px] text-[#166534]">Bạn đã xác nhận tham gia</div>}
      <button type="button" onClick={onOpen} className={`${PRIMARY} mt-3`}>{canConfirm ? 'Xem và xác nhận lịch' : 'Xem lịch phỏng vấn'}</button>
      {webLink(interview.meetingLink) && <a href={webLink(interview.meetingLink)} target="_blank" rel="noopener noreferrer" className={`mt-2.5 block text-center text-[13px] font-semibold ${LINK}`}>Vào phòng họp</a>}
    </>
  );
};

export const CandidateApplicationDetailPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const { applicationId = '' } = useParams();
  const openSigned = useOpenSignedUrl();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [resignOpen, setResignOpen] = useState(false);

  const detail = useQuery({
    queryKey: candidateKeys.applicationDetail(applicationId),
    queryFn: async () => {
      try {
        return await mf04Api.getApplicationDetail(applicationId);
      } catch {
        return await candidateApplicationsApi.detail(applicationId);
      }
    },
    enabled: Boolean(applicationId),
  });
  const timeline = useQuery({
    queryKey: candidateKeys.applicationTimeline(applicationId),
    queryFn: () => mf04Api.getApplicationTimeline(applicationId),
    enabled: Boolean(applicationId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applicationDetail(applicationId) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applicationTimeline(applicationId) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
  };

  const withdraw = useMutation({
    mutationFn: () => mf04Api.withdrawApplication(applicationId, {
      reason: withdrawReason.trim() || undefined,
      concurrencyToken: (detail.data as { concurrencyToken?: string } | undefined)?.concurrencyToken as string,
    }),
    onSuccess: (result) => {
      message.success(result?.message || 'Đã rút hồ sơ.');
      setWithdrawOpen(false);
      setWithdrawReason('');
      refresh();
    },
    onError: (error) => {
      if (getApiError(error, '').status === 409) {
        message.warning('Đơn ứng tuyển vừa được cập nhật. Đang tải lại dữ liệu.');
        setWithdrawOpen(false);
        refresh();
        return;
      }
      message.error(getApiErrorMessage(error, 'Không thể rút hồ sơ.'));
    },
  });

  const back = <Link to="/candidate/applications" className={`self-start text-[13px] ${LINK}`}>‹ Quay lại Đơn ứng tuyển</Link>;

  if (detail.isLoading) {
    return <CandidateAccountFrame><div className={`${CARD} p-5`}><Skeleton active paragraph={{ rows: 8 }} /></div></CandidateAccountFrame>;
  }
  if (detail.isError || !detail.data) {
    return (
      <CandidateAccountFrame>
        <div className="flex flex-col gap-4">
          {back}
          <div className={`${CARD} px-6 py-10 text-center`}>
            <h1 className="m-0 text-[18px] font-bold">Không tải được chi tiết đơn ứng tuyển</h1>
            <p className="m-0 mt-2 text-[#4B5563]">{getApiErrorMessage(detail.error)}</p>
            <button type="button" onClick={() => detail.refetch()} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Thử lại</button>
          </div>
        </div>
      </CandidateAccountFrame>
    );
  }

  // The MF-04 and MF-02 responses share these fields but not one type.
  const application = detail.data as any;
  const overview = application.jobOverview;
  const interviews: { interviewId: string; interviewRound: number; interviewType?: string | null; scheduledAt?: string | null; durationMinutes?: number | null; meetingLink?: string | null; status: string }[] = application.interviews || [];
  const offers: CandidateOfferSummaryDto[] = application.offers || [];
  const canWithdraw = (application.allowedActions || []).includes('WITHDRAW_APPLICATION');
  const stage = candidateStage(
    application.status,
    offers.map((offer) => String(offer.status || '')),
    application.placement?.status
  );
  const color = application.status === 'INTERVIEW' ? TONE_COLOR.warning : TONE_COLOR[stage.tone] ?? TONE_COLOR.neutral;
  const isResigned = stage.label === 'Đã nghỉ việc' || application.status === 'RESIGNED' || application.placement?.status === 'RESIGNED' || application.placement?.status === 'LEFT_DURING_WARRANTY';
  const isPlaced = (application.status === 'PLACED' || stage.label === 'Đã đi làm') && !isResigned;
  const stepsToShow = isResigned ? ['Đã nộp', 'Sàng lọc', 'Phỏng vấn', 'Offer', 'Nhận việc', 'Đã nghỉ việc'] : STEPS;
  const gridColsClass = isResigned ? 'grid-cols-6' : 'grid-cols-5';
  const reached = STEP_OF_STAGE[stage.step] ?? 1;
  const ended = Boolean(stage.closed) && stage.tone !== 'success';
  const cvName = application.submittedCv?.title || application.submittedCv?.fileName || application.cvTitle || application.cvFileName;

  const offerToAnswer = offers.find((offer) => isCandidateOfferRespondable(offer));
  const nextInterview = [...interviews]
    .filter((interview) => UPCOMING_INTERVIEW.includes(statusOf(interview)) && (!interview.scheduledAt || dayjs(interview.scheduledAt).isAfter(dayjs())))
    .sort((a, b) => dayjs(a.scheduledAt).valueOf() - dayjs(b.scheduledAt).valueOf())[0];
  const otherInterviews = interviews.filter((interview) => interview !== nextInterview);
  const otherOffers = offers.filter((offer) => offer !== offerToAnswer);

  const events = [...(timeline.data?.events ?? [])].sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
  const placement = application.placement;

  return (
    <CandidateAccountFrame>
      <div className="flex flex-col gap-4">
        {back}

        <section aria-labelledby="job" className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-start gap-[14px]">
            <CompanyMark name={application.companyName} size={62} />
            <div className="min-w-0 flex-[1_1_320px]">
              <h1 id="job" className="m-0 text-[20px] font-bold">
                {overview ? (
                  <button type="button" onClick={() => setOverviewOpen(true)} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-left text-[20px] font-bold text-[#111827] hover:text-[#075985] hover:underline`}>{application.jobTitle}</button>
                ) : (
                  <Link to={`/jobs/${application.jobId}`} className="text-[#111827] no-underline hover:text-[#075985] hover:underline">{application.jobTitle}</Link>
                )}
              </h1>
              <div className="mt-0.5 text-[#4B5563]">{[application.companyName, overview?.location].filter(Boolean).join(' · ')}</div>
              <div className="mt-2 flex flex-wrap gap-[18px] text-[13px] text-[#4B5563]">
                <span>Nộp ngày {dayjs(application.appliedAt).format('DD/MM/YYYY')}</span>
                {application.submissionSource && <span>Nguồn: {application.submissionSource === 'AFFILIATE' ? 'Affiliate giới thiệu' : 'Tự ứng tuyển'}</span>}
                {application.plannedStartDate && <span>Ngày nhận việc: {dayjs(application.plannedStartDate).format('DD/MM/YYYY')}</span>}
                {cvName && (
                  <span>
                    CV:{' '}
                    <button type="button" onClick={() => void openSigned(() => mf04Api.getApplicationCvDownloadUrl(applicationId))} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}>{cvName}</button>
                  </span>
                )}
              </div>
            </div>
            {application.status === 'OFFER_ACCEPTED' && application.plannedStartDate && (
              <Alert
                className="mt-4"
                type="info"
                showIcon
                message="Muốn thay đổi ngày nhận việc?"
                description="Vui lòng liên hệ trực tiếp doanh nghiệp để thỏa thuận. Ngày mới sẽ được cập nhật và thông báo trên HR Connect."
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span role="status" className="rounded px-2.5 py-1 text-[13px] font-semibold" style={{ color: color.text, background: color.background }}>{stage.label}</span>
              {isPlaced && (
                <button
                  type="button"
                  onClick={() => setResignOpen(true)}
                  className={`${FONT} inline-flex items-center gap-1.5 rounded-lg border border-solid border-slate-300 bg-white px-3 py-1 text-[13px] font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer`}
                >
                  Cập nhật đã nghỉ việc
                </button>
              )}
              {isResigned && (
                <Link
                  to="/jobs"
                  className={`${FONT} inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1 text-[13px] font-bold text-white hover:bg-sky-500 hover:text-white active:scale-[0.98] no-underline shadow-xs transition-all`}
                >
                  Tìm việc làm mới →
                </Link>
              )}
            </div>
          </div>
          <ol aria-label={`Tiến trình: ${stage.label}`} className={`m-0 mt-5 grid list-none ${gridColsClass} gap-1.5 p-0`}>
            {stepsToShow.map((step, index) => {
              const isLastResignedStep = isResigned && index === 5;
              const done = isResigned ? index <= 5 : index < reached;
              const current = isResigned ? index === 5 : index === reached - 1;
              const barBg = isLastResignedStep
                ? '#64748B'
                : done
                ? (ended && !isResigned ? '#9CA3AF' : '#0369A1')
                : '#E5E7EB';
              return (
                <li
                  key={step}
                  className={`text-[12px] ${
                    isLastResignedStep
                      ? 'font-semibold text-slate-700'
                      : current && !ended
                      ? 'font-semibold text-[#075985]'
                      : done
                      ? 'text-[#374151]'
                      : 'text-[#6B7280]'
                  }`}
                >
                  <div className="mb-1.5 h-1.5 rounded-[3px]" style={{ background: barBg }} />
                  {step}
                </li>
              );
            })}
          </ol>
          {application.statusReason && <p className="m-0 mt-3 text-[13px] text-[#4B5563]">{application.statusReason}</p>}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-4">
            <section aria-labelledby="history" className={`${CARD} p-5`}>
              <h2 id="history" className="m-0 mb-[14px] text-[16px] font-bold text-[#1F2937]">Lịch sử hồ sơ</h2>
              {timeline.isLoading ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : timeline.isError ? (
                <Alert type="warning" showIcon message="Không tải được lịch sử hồ sơ" description={getApiErrorMessage(timeline.error)} />
              ) : events.length === 0 ? (
                <p className="m-0 text-[#4B5563]">Chưa có cập nhật nào.</p>
              ) : (
                <ol className="m-0 list-none p-0">
                  {events.map((event, index) => {
                    const copy = candidateTimelineEventCopy(event);
                    const dot = index === 0 && events.length > 1 ? '#0284C7' : index === events.length - 1 ? '#9CA3AF' : '#0369A1';
                    return (
                      <li key={`${event.eventType}-${event.timestamp}-${index}`} className="flex gap-3 pb-4">
                        <span aria-hidden className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
                        <div className="min-w-0">
                          <div className="font-semibold">{copy.title}</div>
                          {copy.description && <div className="text-[13px] text-[#4B5563]">{copy.description}</div>}
                          <div className="mt-0.5 text-[12px] text-[#6B7280]">{dayjs(event.timestamp).format('DD/MM/YYYY, HH:mm')}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {(otherInterviews.length > 0 || otherOffers.length > 0) && (
              <section aria-labelledby="others" className={`${CARD} p-5`}>
                <h2 id="others" className="m-0 mb-1.5 text-[16px] font-bold text-[#1F2937]">Phỏng vấn và offer khác</h2>
                {otherInterviews.map((interview) => (
                  <div key={interview.interviewId} className="flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-[#F1F5F9] py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold">Phỏng vấn vòng {interview.interviewRound} · {INTERVIEW_STATUS[statusOf(interview)] ?? interview.status}</div>
                      <div className="text-[13px] text-[#4B5563]">{interviewTime(interview)}</div>
                    </div>
                    <button type="button" aria-label={`Chi tiết phỏng vấn vòng ${interview.interviewRound}`} onClick={() => setInterviewId(interview.interviewId)} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold ${LINK}`}>Chi tiết</button>
                  </div>
                ))}
                {otherOffers.map((offer) => (
                  <div key={offer.offerId} className="flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-[#F1F5F9] py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold">Offer phiên bản {offer.offerVersion} · {candidateOfferStatus(offer.status)}</div>
                      <div className="text-[13px] text-[#4B5563]">{money(offer.salary, offer.currencyCode)}{offer.startDate ? ` · Bắt đầu ${dayjs(offer.startDate).format('DD/MM/YYYY')}` : ''}</div>
                      {offer.declineReason && <div className="text-[13px] text-[#B91C1C]">Lý do từ chối: {offer.declineReason}</div>}
                    </div>
                    <Link to={`/candidate/applications/${applicationId}/offers/${offer.offerId}`} aria-label={`Chi tiết offer phiên bản ${offer.offerVersion}`} className={`text-[13px] font-semibold ${LINK}`}>Chi tiết</Link>
                  </div>
                ))}
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
            <section aria-labelledby="next" className={`${CARD} p-[18px]`}>
              <h2 id="next" className="m-0 mb-2 text-[15px] font-bold text-[#1F2937]">Việc cần làm</h2>
              {offerToAnswer ? (
                <>
                  <div className="font-semibold">Trả lời offer phiên bản {offerToAnswer.offerVersion}</div>
                  <div className="mt-0.5 text-[13px] text-[#4B5563]">
                    {money(offerToAnswer.salary, offerToAnswer.currencyCode)}{offerToAnswer.startDate ? ` · Bắt đầu ${dayjs(offerToAnswer.startDate).format('DD/MM/YYYY')}` : ''}
                  </div>
                  {offerDeadline(offerToAnswer) && <div className="mt-1.5 text-[13px] text-[#9A3412]">Trả lời trước {dayjs(offerDeadline(offerToAnswer)).format('DD/MM/YYYY')}</div>}
                  <Link to={`/candidate/applications/${applicationId}/offers/${offerToAnswer.offerId}`} className={`${PRIMARY} mt-3`}>Xem và trả lời offer</Link>
                </>
              ) : nextInterview ? (
                <NextInterview interview={nextInterview} onOpen={() => setInterviewId(nextInterview.interviewId)} />
              ) : isResigned ? (
                <div className="space-y-3">
                  <p className="m-0 text-[13px] text-[#4B5563]">
                    Bạn đã kết thúc công việc này. Hồ sơ của bạn đã được mở lại ở trạng thái sẵn sàng tìm việc để bạn ứng tuyển hoặc nhận lời mời mới.
                  </p>
                  <Link to="/jobs" className={PRIMARY}>
                    Tìm việc làm mới
                  </Link>
                </div>
              ) : (
                <p className="m-0 text-[13px] text-[#4B5563]">Hiện chưa có việc nào cần bạn làm. Bạn sẽ nhận thông báo khi có cập nhật.</p>
              )}
            </section>

            {placement && (
              <section aria-labelledby="placement" className={`${CARD} p-[18px]`}>
                <h2 id="placement" className="m-0 mb-2 text-[15px] font-bold text-[#1F2937]">Thông tin nhận việc</h2>
                <div className="font-semibold">{placement.position || application.jobTitle}</div>
                {placement.department && <div className="mt-0.5 text-[13px] text-[#4B5563]">{placement.department}</div>}
                <div className="mt-0.5 text-[13px] text-[#4B5563]">Bắt đầu {dayjs(placement.actualStartDate).format('DD/MM/YYYY')}</div>
                {placement.endDate && (
                  <div className="mt-0.5 text-[13px] text-slate-500">Nghỉ việc {dayjs(placement.endDate).format('DD/MM/YYYY')}</div>
                )}
                {isPlaced && (
                  <div className="mt-3 pt-2.5 border-0 border-t border-solid border-slate-100">
                    <button
                      type="button"
                      onClick={() => setResignOpen(true)}
                      className={`${FONT} w-full py-2 px-3 rounded-lg border border-solid border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer`}
                    >
                      Cập nhật đã nghỉ việc
                    </button>
                  </div>
                )}
              </section>
            )}

            {canWithdraw && (
              <section aria-labelledby="withdraw" className={`${CARD} p-[18px]`}>
                <h2 id="withdraw" className="m-0 mb-1.5 text-[15px] font-bold text-[#1F2937]">Không muốn tiếp tục?</h2>
                <p className="m-0 mb-3 text-[13px] text-[#4B5563]">Rút hồ sơ sẽ dừng quy trình với nhà tuyển dụng này và không thể hoàn tác.</p>
                <button type="button" onClick={() => setWithdrawOpen(true)} className={`${FONT} h-[42px] w-full cursor-pointer rounded-md border border-solid border-[#FCA5A5] bg-white text-[14px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]`}>Rút hồ sơ</button>
              </section>
            )}
          </aside>
        </div>
      </div>

      <Modal title={`Thông tin vị trí · ${application.jobTitle}`} open={overviewOpen} onCancel={() => setOverviewOpen(false)} footer={null} width={760}>
        {overview && (
          <div className="flex flex-col gap-4 text-[14px] text-[#374151]">
            <dl className="m-0 grid gap-3 sm:grid-cols-2">
              {[
                ['Địa điểm', overview.location],
                ['Hình thức', overview.employmentType],
                ['Thời gian làm việc', overview.workingTime],
                ['Mức lương', overview.salaryMin != null || overview.salaryMax != null
                  ? `${overview.salaryMin?.toLocaleString('vi-VN') ?? '0'} – ${overview.salaryMax?.toLocaleString('vi-VN') ?? 'Không giới hạn'} ${overview.currencyCode || 'VND'}${overview.salaryNegotiable ? ' (Thương lượng)' : ''}`
                  : overview.salaryNegotiable ? 'Thương lượng' : null],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label}><dt className="text-[12px] text-[#6B7280]">{label}</dt><dd className="m-0 font-medium">{value}</dd></div>
              ))}
            </dl>
            {overview.description && <section><h3 className="m-0 mb-1.5 text-[15px] font-bold">Mô tả công việc</h3><div className="whitespace-pre-line">{overview.description}</div></section>}
            {overview.requirements?.length > 0 && <section><h3 className="m-0 mb-1.5 text-[15px] font-bold">Yêu cầu</h3><ul className="m-0 list-disc pl-5">{overview.requirements.map((item: string, index: number) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
            {overview.skills?.length > 0 && <section><h3 className="m-0 mb-1.5 text-[15px] font-bold">Kỹ năng</h3><div className="flex flex-wrap gap-1.5">{overview.skills.map((skill: string) => <span key={skill} className="rounded bg-[#F3F4F6] px-2.5 py-[3px] text-[13px]">{skill}</span>)}</div></section>}
            {overview.benefits && <section><h3 className="m-0 mb-1.5 text-[15px] font-bold">Quyền lợi</h3><div className="whitespace-pre-line">{overview.benefits}</div></section>}
          </div>
        )}
      </Modal>

      <CandidateDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Rút hồ sơ"
        subtitle={[application.jobTitle, application.companyName].filter(Boolean).join(' · ')}
        footer={(
          <>
            <button type="button" onClick={() => setWithdrawOpen(false)} className={DIALOG_CANCEL}>Đóng</button>
            <button type="button" disabled={withdraw.isPending} onClick={() => withdraw.mutate()} className={DIALOG_DANGER}>{withdraw.isPending ? 'Đang rút…' : 'Xác nhận rút hồ sơ'}</button>
          </>
        )}
      >
        <p className="m-0 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#991B1B]">
          Rút hồ sơ sẽ dừng quy trình với nhà tuyển dụng này và không thể hoàn tác.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-[#374151]">Lý do <span className="text-[#6B7280]">(không bắt buộc)</span></span>
          <textarea rows={3} value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} placeholder="Ví dụ: Đã nhận việc ở nơi khác" className={`${DIALOG_FONT} w-full resize-y rounded-md border border-solid border-[#D1D5DB] px-3 py-2.5 text-[14px] text-[#1F2937] outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]`} />
        </label>
      </CandidateDialog>

      <CandidateInterviewDetailModal open={Boolean(interviewId)} interviewId={interviewId || undefined} onClose={() => setInterviewId(null)} />

      <CandidateResignModal
        open={resignOpen}
        onClose={() => setResignOpen(false)}
        applicationId={applicationId}
        jobTitle={application.jobTitle}
        companyName={application.companyName}
        startDate={placement?.actualStartDate || application.plannedStartDate}
        onSuccess={refresh}
      />
    </CandidateAccountFrame>
  );
};
