import dayjs, { type Dayjs } from 'dayjs';

export interface InterviewTimingInput {
  status?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
}

/**
 * Checks whether a scheduled interview has reached or passed its start time.
 * Once started, the Client may immediately record the result or mark no-show
 * (matching backend validation ScheduledAt <= UtcNow), even if the interview
 * finishes earlier than its reserved duration slot.
 */
export const hasInterviewStarted = (
  interview?: InterviewTimingInput | null,
  now: Dayjs = dayjs()
) => {
  if (String(interview?.status ?? '').toUpperCase() !== 'SCHEDULED' || !interview?.scheduledAt) {
    return false;
  }

  const scheduledAt = dayjs(interview.scheduledAt);
  if (!scheduledAt.isValid()) return false;

  return scheduledAt.isBefore(now) || scheduledAt.isSame(now);
};

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

/**
 * Returns true while the current time falls inside the reserved interview slot
 * [scheduledAt, scheduledAt + durationMinutes). During this window the UI shows
 * an active "in progress" indicator instead of a premature overdue warning.
 */
export const isInterviewInProgress = (
  interview?: InterviewTimingInput | null,
  now: Dayjs = dayjs()
) => hasInterviewStarted(interview, now) && !isInterviewOverdue(interview, now);
