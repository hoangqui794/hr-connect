import dayjs, { type Dayjs } from 'dayjs';

export interface InterviewTimingInput {
  status?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
}

/**
 * An interview remains active while its scheduled time window is still open.
 * After that window, the UI asks the Client to record the real outcome; the
 * persisted status is deliberately left unchanged until an explicit action.
 */
export const isInterviewOverdue = (
  interview?: InterviewTimingInput | null,
  now: Dayjs = dayjs()
) => {
  if (String(interview?.status ?? '').toUpperCase() !== 'SCHEDULED' || !interview?.scheduledAt) {
    return false;
  }

  const scheduledAt = dayjs(interview.scheduledAt);
  if (!scheduledAt.isValid()) return false;

  const duration = Math.max(interview.durationMinutes ?? 60, 0);
  const scheduledEnd = scheduledAt.add(duration, 'minute');
  return scheduledEnd.isBefore(now) || scheduledEnd.isSame(now);
};
