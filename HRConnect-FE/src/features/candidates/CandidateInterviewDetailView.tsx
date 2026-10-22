/**
 * @file CandidateInterviewDetailView.tsx
 * @description Core component for viewing Candidate Interview Detail with complete state handling,
 * quick actions (Copy link, Join room, Confirm attendance, Request reschedule, Add to Calendar),
 * and status timeline.
 */

import React from 'react';
import {
  Card,
  Tag,
  Button,
  Alert,
  Skeleton,
  Empty,
  Tooltip,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  GoogleOutlined,
  BankOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);

import { useCandidateInterviewDetail } from '@/hooks/useCandidateInterviewDetail';
import type { CandidateInterviewDetailDto } from '@/types/api/candidateInterview';
import { candidateInterviewStatus, candidateInterviewType } from '@/features/portal/mf02Labels';

const { Text, Paragraph, Title } = Typography;

export interface CandidateInterviewDetailViewProps {
  interviewId: string;
  initialData?: CandidateInterviewDetailDto;
  onBack?: () => void;
  showBackAction?: boolean;
}

export const CandidateInterviewDetailView: React.FC<CandidateInterviewDetailViewProps> = ({
  interviewId,
  initialData,
  onBack,
  showBackAction = false,
}) => {
  const { interview: fetchedInterview, isLoading, isError, error, refetch, isRefetching } = useCandidateInterviewDetail(interviewId);

  const interview = fetchedInterview || initialData;

  // Helper copy to clipboard
  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${label} vào bộ nhớ tạm!`);
    } else {
      message.info(`Nội dung: ${text}`);
    }
  };

  // Google Calendar URL generator
  const getGoogleCalendarUrl = (item: CandidateInterviewDetailDto) => {
    if (!item.scheduledAt) return '#';
    const start = dayjs(item.scheduledAt);
    const end = start.add(item.durationMinutes || 45, 'minute');
    const startStr = start.utc?.() ? start.utc().format('YYYYMMDDTHHmmss[Z]') : start.format('YYYYMMDDTHHmmss');
    const endStr = end.utc?.() ? end.utc().format('YYYYMMDDTHHmmss[Z]') : end.format('YYYYMMDDTHHmmss');

    const title = `Phỏng vấn Vòng ${item.interviewRound} - ${item.jobTitle} tại ${item.companyName}`;
    const details = `Buổi phỏng vấn vị trí ${item.jobTitle}.\nHình thức: ${candidateInterviewType(item.interviewType)}.\n${
      item.meetingLink ? `Link họp: ${item.meetingLink}\n` : ''
    }${item.location ? `Địa điểm: ${item.location}\n` : ''}`;
    const location = item.meetingLink || item.location || '';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
      location
    )}`;
  };

  // 1. Loading State
  if (isLoading && !interview) {
    return (
      <div className="p-4 space-y-4" data-testid="interview-detail-loading">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card size="small" className="rounded-xl border border-slate-200">
            <Skeleton active avatar paragraph={{ rows: 3 }} />
          </Card>
          <Card size="small" className="rounded-xl border border-slate-200">
            <Skeleton active avatar paragraph={{ rows: 3 }} />
          </Card>
        </div>
        <Card size="small" className="rounded-xl border border-slate-200">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }

  // 2. Error State
  if (isError && !interview) {
    return (
      <div className="p-6" data-testid="interview-detail-error">
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Không thể tải chi tiết lịch phỏng vấn"
          description={
            <div className="space-y-3 mt-1">
              <p className="m-0 text-slate-700">
                {error?.message || 'Đã có lỗi xảy ra khi truy vấn dữ liệu từ hệ thống. Vui lòng thử lại.'}
              </p>
              <Button
                type="primary"
                danger
                icon={<ReloadOutlined spin={isRefetching} />}
                onClick={() => refetch()}
              >
                Thử lại
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // 3. Empty State
  if (!interview) {
    return (
      <div className="p-12 text-center" data-testid="interview-detail-empty">
        <Empty
          description="Không tìm thấy thông tin lịch phỏng vấn hoặc bạn không có quyền xem."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {showBackAction && onBack && (
            <Button type="primary" onClick={onBack}>
              Quay lại
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  // Status mapping
  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      SCHEDULED: { color: 'processing', label: 'Đã lên lịch', icon: <ClockCircleOutlined /> },
      CONFIRMED: { color: 'success', label: 'Đã xác nhận tham gia', icon: <CheckCircleOutlined /> },
      COMPLETED: { color: 'green', label: 'Đã hoàn thành', icon: <CheckCircleOutlined /> },
      RESCHEDULED: { color: 'warning', label: 'Đã dời lịch', icon: <HistoryOutlined /> },
      CANCELLED: { color: 'error', label: 'Đã hủy', icon: <ExclamationCircleOutlined /> },
      NO_SHOW: { color: 'default', label: 'Vắng mặt', icon: <ExclamationCircleOutlined /> },
    };
    const s = map[status.toUpperCase()] || { color: 'default', label: candidateInterviewStatus(status), icon: null };
    return (
      <Tag color={s.color} className="px-2.5 py-1 text-sm font-semibold rounded-md flex items-center gap-1.5 inline-flex">
        {s.icon}
        {s.label}
      </Tag>
    );
  };

  const isOnline = (interview.interviewType || '').toUpperCase() === 'ONLINE' || Boolean(interview.meetingLink);
  const scheduledTime = interview.scheduledAt ? dayjs(interview.scheduledAt) : null;
  const isUpcoming = scheduledTime && scheduledTime.isAfter(dayjs());
  const duration = interview.durationMinutes || 45;
  const endTime = scheduledTime ? scheduledTime.add(duration, 'minute') : null;

  return (
    <div className="candidate-interview-detail-content space-y-6" data-testid="interview-detail-content">
      {/* Header Info */}
      <div className="candidate-interview-detail-hero bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Tag color="blue" className="font-bold uppercase tracking-wide">
              Vòng {interview.interviewRound}
            </Tag>
            <Tag color={isOnline ? 'cyan' : 'gold'} className="font-medium">
              {isOnline ? 'Trực tuyến' : 'Trực tiếp tại văn phòng'}
            </Tag>
            {getStatusBadge(interview.status)}
          </div>
          <Title level={4} className="!m-0 text-slate-900 font-extrabold">
            {interview.jobTitle || 'Buổi phỏng vấn tuyển dụng'}
          </Title>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-600">
            <BankOutlined className="text-blue-600" />
            <span className="font-medium text-slate-800">{interview.companyName || 'Công ty tuyển dụng'}</span>
          </div>
        </div>

        {/* Quick Action in Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {showBackAction && onBack && (
            <Button onClick={onBack}>
              Quay lại
            </Button>
          )}
          {scheduledTime && (
            <Button
              icon={<GoogleOutlined />}
              href={getGoogleCalendarUrl(interview)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-700"
            >
              Thêm vào Google Calendar
            </Button>
          )}
        </div>
      </div>

      {/* Grid: Time & Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <CalendarOutlined className="text-blue-600" />
              <span>Thời gian phỏng vấn</span>
            </div>
          }
        >
          {scheduledTime ? (
            <div className="space-y-3 py-1">
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-center min-w-[70px] border border-blue-200/60">
                  <div className="text-xs uppercase font-bold tracking-wider">{scheduledTime.format('MMM')}</div>
                  <div className="text-2xl font-black">{scheduledTime.format('DD')}</div>
                  <div className="text-xs">{scheduledTime.format('YYYY')}</div>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {scheduledTime.format('HH:mm')} - {endTime ? endTime.format('HH:mm') : ''}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Thứ {scheduledTime.day() === 0 ? 'Chủ nhật' : scheduledTime.day() + 1}, ngày {scheduledTime.format('DD/MM/YYYY')}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50/70 inline-block px-2 py-0.5 rounded">
                    Thời lượng dự kiến: {duration} phút
                  </div>
                </div>
              </div>

              {isUpcoming && (
                <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <InfoCircleOutlined />
                  <span>Buổi phỏng vấn sắp diễn ra ({scheduledTime.fromNow()}). Hãy sẵn sàng trước 10 phút!</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 py-3 text-sm">Chưa có thông tin lịch cụ thể.</div>
          )}
        </Card>

        {/* Location / Meeting Room Card */}
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              {isOnline ? (
                <>
                  <VideoCameraOutlined className="text-cyan-600" />
                  <span>Phòng họp trực tuyến</span>
                </>
              ) : (
                <>
                  <EnvironmentOutlined className="text-amber-600" />
                  <span>Địa điểm phỏng vấn</span>
                </>
              )}
            </div>
          }
        >
          {isOnline ? (
            <div className="space-y-3 py-1">
              <div>
                <span className="text-xs text-slate-500">Đường dẫn tham gia:</span>
                {interview.meetingLink ? (
                  <div className="mt-1 flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono break-all">
                    <span className="flex-1 text-blue-700 font-medium">{interview.meetingLink}</span>
                    <Tooltip title="Sao chép link">
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(interview.meetingLink!, 'đường dẫn phòng họp')}
                      />
                    </Tooltip>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-1 italic">
                    Link phòng họp sẽ được cập nhật trước giờ phỏng vấn.
                  </div>
                )}
              </div>

              {interview.meetingLink && (
                <Button
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  href={interview.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 w-full font-semibold shadow-sm"
                >
                  Vào phòng họp ngay
                </Button>
              )}

              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1">
                <div className="font-semibold text-slate-700">Lưu ý khi phỏng vấn trực tuyến:</div>
                <ul className="list-disc list-inside m-0 space-y-0.5 text-[11px]">
                  <li>Kiểm tra camera, micro và đường truyền mạng ổn định.</li>
                  <li>Chọn không gian yên tĩnh, đủ ánh sáng và trang phục lịch sự.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <div>
                <span className="text-xs text-slate-500">Địa chỉ cụ thể:</span>
                <div className="mt-1 text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-start gap-2">
                  <EnvironmentOutlined className="text-red-500 mt-1" />
                  <span className="flex-1">{interview.location || 'Chưa cập nhật địa chỉ cụ thể.'}</span>
                  {interview.location && (
                    <Tooltip title="Sao chép địa chỉ">
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(interview.location!, 'địa chỉ')}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>

              {interview.location && (
                <Button
                  icon={<EnvironmentOutlined />}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(interview.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-slate-700"
                >
                  Xem trên Google Maps
                </Button>
              )}

              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1">
                <div className="font-semibold text-slate-700">Lưu ý cho phỏng vấn trực tiếp:</div>
                <ul className="list-disc list-inside m-0 space-y-0.5 text-[11px]">
                  <li>Đến sớm trước 10-15 phút để làm thủ tục đón tiếp tại lễ tân.</li>
                  <li>Mang theo giấy tờ tùy thân, bản in CV và hồ sơ năng lực (nếu có).</li>
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Status History / Timeline */}
      {interview.statusHistories && interview.statusHistories.length > 0 && (
        <Card
          size="small"
          className="rounded-xl border border-slate-200 shadow-sm"
          title={
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <HistoryOutlined className="text-slate-600" />
              <span>Lịch sử cập nhật phỏng vấn</span>
            </div>
          }
        >
          <Timeline
            className="mt-3 ml-2"
            items={interview.statusHistories.map((h, i) => {
              const changedTime = dayjs(h.changedAt).format('HH:mm - DD/MM/YYYY');
              const isReschedule = h.newStatus === 'RESCHEDULED' || (h.oldScheduledAt && h.newScheduledAt);
              return {
                key: h.interviewStatusHistoryId || i,
                color: h.newStatus === 'CANCELLED' ? 'red' : h.newStatus === 'COMPLETED' ? 'green' : 'blue',
                children: (
                  <div className="text-xs text-slate-700">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>Trạng thái: {candidateInterviewStatus(h.newStatus)}</span>
                      <span className="text-slate-400 font-normal">({changedTime})</span>
                    </div>
                    {isReschedule && h.newScheduledAt && (
                      <div className="mt-1 text-slate-600">
                        Giờ mới: <strong className="text-blue-700">{dayjs(h.newScheduledAt).format('HH:mm - DD/MM/YYYY')}</strong>
                        {h.oldScheduledAt && (
                          <span className="text-slate-400 line-through ml-2">
                            {dayjs(h.oldScheduledAt).format('HH:mm - DD/MM/YYYY')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}

    </div>
  );
};

export default CandidateInterviewDetailView;
