import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { isInterviewOverdue } from './interviewTiming';

describe('isInterviewOverdue', () => {
  const now = dayjs('2026-11-13T14:00:00+07:00');

  it('waits until the scheduled interview window has ended', () => {
    expect(isInterviewOverdue({ status: 'SCHEDULED', scheduledAt: '2026-11-13T13:30:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewOverdue({ status: 'SCHEDULED', scheduledAt: '2026-11-13T12:30:00+07:00', durationMinutes: 60 }, now)).toBe(true);
  });

  it('does not derive overdue for interviews already resolved', () => {
    expect(isInterviewOverdue({ status: 'COMPLETED', scheduledAt: '2026-11-12T09:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
    expect(isInterviewOverdue({ status: 'CANCELLED', scheduledAt: '2026-11-12T09:00:00+07:00', durationMinutes: 60 }, now)).toBe(false);
  });
});
