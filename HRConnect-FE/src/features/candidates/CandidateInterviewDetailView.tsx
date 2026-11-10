/**
 * @file CandidateInterviewDetailView.tsx
 * @description One interview for the Candidate (mockup 03/11): schedule, how to join, attendance
 * confirmation and schedule history. Used by the dialog (with onClose) and by the full page.
 */

import React from 'react';
import { App, Alert, Skeleton, message as staticMessage } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/vi';
import { useMutation, useQueryClient } from '@tanstack/react-query';

dayjs.extend(utc);

import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import { candidateInterviewKeys, useCandidateInterviewDetail } from '@/hooks/useCandidateInterviewDetail';
import type { CandidateInterviewDetailDto } from '@/types/api/candidateInterview';
import { candidateInterviewStatus } from '@/features/portal/mf02Labels';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const SECONDARY = `${FONT} flex h-11 cursor-pointer items-center rounded-md border border-solid border-[#D1D5DB] bg-white px-4 text-[14px] text-[#1F2937] no-underline hover:bg-[#F9FAFB] hover:text-[#1F2937]`;
const PRIMARY = `${FONT} flex h-11 cursor-pointer items-center rounded-md border-0 bg-[#0C4A6E] px-[18px] text-[14px] font-semibold text-white no-underline hover:bg-[#075985] hover:text-white disabled:cursor-not-allowed disabled:bg-[#9CA3AF]`;

const STATUS_STYLE: Record<string, { label: string; text: string; background: string }> = {
  SCHEDULED: { label: 'Đã lên lịch', text: '#075985', background: '#E0F2FE' },
  RESCHEDULED: { label: 'Đã dời lịch', text: '#9A3412', background: '#FFEDD5' },
  COMPLETED: { label: 'Đã hoàn thành', text: '#166534', background: '#DCFCE7' },
  CANCELLED: { label: 'Đã hủy', text: '#B91C1C', background: '#FEE2E2' },
  NO_SHOW: { label: 'Vắng mặt', text: '#374151', background: '#F3F4F6' },
};

const webLink = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);
const shortDate = (iso: string) => dayjs(iso).locale('vi').format('HH:mm dddd DD/MM');

const calendarUrl = (item: CandidateInterviewDetailDto) => {
  const start = dayjs(item.scheduledAt);
  const end = start.add(item.durationMinutes || 45, 'minute');
  const format = (time: dayjs.Dayjs) => time.utc().format('YYYYMMDDTHHmmss[Z]');
  const details = [`Buổi phỏng vấn vị trí ${item.jobTitle}.`, item.meetingLink && `Link họp: ${item.meetingLink}`, item.location && `Địa điểm: ${item.location}`].filter(Boolean).join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Phỏng vấn vòng ${item.interviewRound} - ${item.jobTitle} tại ${item.companyName}`,
    dates: `${format(start)}/${format(end)}`,
    details,
    location: item.meetingLink || item.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export interface CandidateInterviewDetailViewProps {
  interviewId: string;
  initialData?: CandidateInterviewDetailDto;
  onBack?: () => void;
  showBackAction?: boolean;
  /** Set when shown in a dialog: drops the outer cards and adds a close button. */
  onClose?: () => void;
}

export const CandidateInterviewDetailView: React.FC<CandidateInterviewDetailViewProps> = ({
  interviewId,
  initialData,
  onBack,
  showBackAction = false,
  onClose,
}) => {
  const antdApp = App.useApp();
  const message = 'error' in antdApp.message ? antdApp.message : staticMessage;
  const { interview: fetchedInterview, isLoading, isError, error, refetch, isRefetching } = useCandidateInterviewDetail(interviewId);
  const queryClient = useQueryClient();
  const interview = fetchedInterview || initialData;
  const inDialog = Boolean(onClose);
  const frame = inDialog ? 'px-[22px] py-[18px]' : 'rounded-lg border border-solid border-[#E5E7EB] bg-white p-6';
  const wrapper = `${FONT} text-[14px] text-[#1F2937] [line-height:normal]`;

  const confirmAttendance = useMutation({
    mutationFn: () => candidateInterviewApi.confirmAttendance(interviewId),
    onSuccess: (result) => {
      queryClient.setQueryData<CandidateInterviewDetailDto>(candidateInterviewKeys.detail(interviewId), (current) =>
        current ? { ...current, candidateAttendanceStatus: result.attendanceStatus, candidateRespondedAt: result.respondedAt } : current,
      );
      message.success(result.alreadyConfirmed ? 'Bạn đã xác nhận lịch phỏng vấn này.' : 'Đã xác nhận tham gia phỏng vấn.');
    },
    onError: (mutationError: Error) => {
      message.error(mutationError.message || 'Không thể xác nhận tham gia phỏng vấn.');
    },
  });

  const copy = (text: string, label: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${label}.`);
    } else {
      message.info(text);
    }
  };

  const closeButton = onClose && (
    <button type="button" aria-label="Đóng" onClick={onClose} className={`${FONT} -mr-2 -mt-2 h-11 w-11 shrink-0 cursor-pointer border-0 bg-transparent text-[20px] text-[#4B5563]`}>×</button>
  );

  if (isLoading && !interview) {
    return <div className={`${wrapper} ${frame}`} data-testid="interview-detail-loading"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }

  if (isError && !interview) {
    return (
      <div className={`${wrapper} ${frame}`} data-testid="interview-detail-error">
        <div className="flex items-start justify-between gap-3">
          <h2 id="interview-title" className="m-0 text-[18px] font-bold">Không thể tải lịch phỏng vấn</h2>
          {closeButton}
        </div>
        <p className="m-0 mt-2 text-[#4B5563]">{error?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'}</p>
        <button type="button" disabled={isRefetching} onClick={() => refetch()} className={`${SECONDARY} mt-3`}>Thử lại</button>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className={`${wrapper} ${frame}`} data-testid="interview-detail-empty">
        <div className="flex items-start justify-between gap-3">
          <p id="interview-title" className="m-0 text-[#4B5563]">Không tìm thấy thông tin lịch phỏng vấn hoặc bạn không có quyền xem.</p>
          {closeButton}
        </div>
        {showBackAction && onBack && <button type="button" onClick={onBack} className={`${SECONDARY} mt-3`}>Quay lại</button>}
      </div>
    );
  }

  const status = STATUS_STYLE[String(interview.status).toUpperCase()] ?? { label: candidateInterviewStatus(interview.status), text: '#374151', background: '#F3F4F6' };
  const isOnline = (interview.interviewType || '').toUpperCase() === 'ONLINE' || Boolean(interview.meetingLink);
  const start = interview.scheduledAt ? dayjs(interview.scheduledAt).locale('vi') : null;
  const duration = interview.durationMinutes || 45;
  const isConfirmed = interview.candidateAttendanceStatus === 'CONFIRMED';
  const canConfirm = interview.status === 'SCHEDULED' && Boolean(start?.isAfter(dayjs())) && !isConfirmed;
  const meetingLink = webLink(interview.meetingLink);
  const histories = [...(interview.statusHistories ?? [])].sort((a, b) => dayjs(b.changedAt).valueOf() - dayjs(a.changedAt).valueOf());

  return (
    <div className={wrapper} data-testid="interview-detail-content">
      <section aria-labelledby="interview-title" className={frame}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 id="interview-title" className="m-0 text-[20px] font-bold text-[#1F2937]">Phỏng vấn vòng {interview.interviewRound}</h1>
            <div className="mt-0.5 text-[#4B5563]"><span>{interview.jobTitle}</span> · <span>{interview.companyName}</span></div>
          </div>
          <span className="rounded px-2.5 py-1 text-[13px] font-semibold" style={{ color: status.text, background: status.background }}>{status.label}</span>
          {closeButton}
        </div>

        <dl className="m-0 mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[#6B7280]">Thời gian</dt>
            <dd className="m-0 mt-0.5 font-semibold">{start ? `${start.format('HH:mm')} – ${start.add(duration, 'minute').format('HH:mm')}, ${start.format('dddd DD/MM/YYYY')}` : 'Chưa có lịch cụ thể'}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[#6B7280]">Thời lượng</dt>
            <dd className="m-0 mt-0.5 font-semibold">{duration} phút</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[#6B7280]">Hình thức</dt>
            <dd className="m-0 mt-0.5 font-semibold">{isOnline ? 'Trực tuyến' : 'Trực tiếp tại văn phòng'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[12px] text-[#6B7280]">{isOnline ? 'Link phòng họp' : 'Địa điểm'}</dt>
            <dd className="m-0 mt-0.5 flex items-start gap-2 font-semibold">
              {isOnline ? (
                meetingLink ? <a href={meetingLink} target="_blank" rel="noopener noreferrer" className={`min-w-0 break-all ${LINK}`}>{interview.meetingLink}</a> : <span className="font-normal text-[#4B5563]">Link sẽ được cập nhật trước giờ phỏng vấn</span>
              ) : (
                <span className="min-w-0 break-words">{interview.location || 'Chưa cập nhật địa chỉ'}</span>
              )}
              {(isOnline ? meetingLink : interview.location) && (
                <button
                  type="button"
                  aria-label={isOnline ? 'Sao chép link phòng họp' : 'Sao chép địa chỉ'}
                  title="Sao chép"
                  onClick={() => (isOnline ? copy(interview.meetingLink!, 'link phòng họp') : copy(interview.location!, 'địa chỉ'))}
                  className="-my-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
                </button>
              )}
            </dd>
          </div>
        </dl>

        {canConfirm && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-solid border-[#FED7AA] bg-[#FFF7ED] px-4 py-[14px]">
            <div className="flex-[1_1_300px] text-[#7C2D12]">
              <b>Bạn sẽ tham gia buổi phỏng vấn này chứ?</b>
              <div className="text-[13px]">Xác nhận giúp nhà tuyển dụng chuẩn bị. Nếu không tham gia được, hãy báo sớm cho nhà tuyển dụng.</div>
            </div>
            <button type="button" disabled={confirmAttendance.isPending} onClick={() => confirmAttendance.mutate()} className={PRIMARY}>
              {confirmAttendance.isPending ? 'Đang gửi…' : 'Xác nhận tham gia'}
            </button>
          </div>
        )}
        {isConfirmed && (
          <div className="mt-5 rounded-md border border-solid border-[#BBF7D0] bg-[#F0FDF4] px-4 py-[14px] font-semibold text-[#166534]">Đã xác nhận tham gia</div>
        )}

        {(start || meetingLink || (!isOnline && interview.location)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {meetingLink && <a href={meetingLink} target="_blank" rel="noopener noreferrer" className={PRIMARY}>Vào phòng họp ngay</a>}
            {!isOnline && interview.location && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(interview.location)}`} target="_blank" rel="noopener noreferrer" className={SECONDARY}>Xem trên Google Maps</a>
            )}
            {start && <a href={calendarUrl(interview)} target="_blank" rel="noopener noreferrer" className={SECONDARY}>Thêm vào Google Calendar</a>}
            {showBackAction && onBack && <button type="button" onClick={onBack} className={SECONDARY}>Quay lại</button>}
          </div>
        )}
      </section>

      {isError && <div className="px-[22px]"><Alert type="warning" showIcon message="Chưa tải được dữ liệu mới nhất." /></div>}

      {histories.length > 0 && (
        <section aria-labelledby="interview-history" className={inDialog ? 'border-0 border-t border-solid border-[#E5E7EB] px-[22px] py-[18px]' : 'mt-4 rounded-lg border border-solid border-[#E5E7EB] bg-white p-5'}>
          <h2 id="interview-history" className="m-0 mb-3 text-[16px] font-bold text-[#1F2937]">Lịch sử thay đổi lịch</h2>
          <ul className="m-0 list-none p-0">
            {histories.map((history, index) => {
              const moved = history.oldScheduledAt && history.newScheduledAt && history.oldScheduledAt !== history.newScheduledAt;
              return (
                <li key={history.interviewStatusHistoryId || index} className="border-0 border-t border-solid border-[#F1F5F9] py-2.5">
                  {moved ? (
                    <><b>Dời lịch</b> từ {shortDate(history.oldScheduledAt!)} sang {shortDate(history.newScheduledAt!)}</>
                  ) : (
                    <b>{history.oldStatus ? candidateInterviewStatus(history.newStatus) : 'Tạo lịch phỏng vấn'}</b>
                  )}
                  <div className="text-[12px] text-[#6B7280]">{dayjs(history.changedAt).format('DD/MM/YYYY, HH:mm')}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

export default CandidateInterviewDetailView;
