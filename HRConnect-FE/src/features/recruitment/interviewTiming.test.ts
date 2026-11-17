import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { hasInterviewStarted, isInterviewInProgress, isInterviewOverdue } from './interviewTiming';

describe('interviewTiming', () => {
  const now = dayjs('2026-11-13T14:00:00+07:00');

  it('detects when a scheduled interview has reached its start time', () => {
    expect(hasInterviewStarted({ status: 'SCHEDULED', scheduledAt: '2026-11-13T14:15:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(hasInterviewStarted({ status: 'SCHEDULED', scheduledAt: '2026-11-13T14:00:00+07:00', durationMinutes: 60 }, now)).toBe(true);
    expect(hasInterviewStarted({ status: 'SCHEDULED', scheduledAt: '2026-11-13T13:50:00+07:00', durationMinutes: 60 }, now)).toBe(true);
  });

  it('marks an interview as in-progress while within its reserved duration window', () => {
    expect(isInterviewInProgress({ status: 'SCHEDULED', scheduledAt: '2026-11-13T14:10:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewInProgress({ status: 'SCHEDULED', scheduledAt: '2026-11-13T13:50:00+07:00', durationMinutes: 60 }, now)).toBe(true);
    expect(isInterviewInProgress({ status: 'SCHEDULED', scheduledAt: '2026-11-13T13:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
  });

  it('waits until the scheduled interview window has ended before marking overdue', () => {
    expect(isInterviewOverdue({ status: 'SCHEDULED', scheduledAt: '2026-11-13T13:30:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewOverdue({ status: 'SCHEDULED', scheduledAt: '2026-11-13T12:30:00+07:00', durationMinutes: 60 }, now)).toBe(true);
  });

  it('does not derive active or overdue states for interviews already resolved', () => {
    expect(hasInterviewStarted({ status: 'COMPLETED', scheduledAt: '2026-11-12T09:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewInProgress({ status: 'NO_SHOW', scheduledAt: '2026-11-13T13:50:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewOverdue({ status: 'COMPLETED', scheduledAt: '2026-11-12T09:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewOverdue({ status: 'CANCELLED', scheduledAt: '2026-11-12T09:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
  });
});
