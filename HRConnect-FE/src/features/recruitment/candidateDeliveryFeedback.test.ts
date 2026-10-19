import { describe, expect, it } from 'vitest';
import { deliveryChannelFromResult, deliveryFeedback } from './candidateDeliveryFeedback';

describe('candidate delivery feedback', () => {
  it('reads ScheduleInterview delivery channel from nested data', () => {
    expect(deliveryChannelFromResult({ data: { deliveryChannel: 'EMAIL' } })).toBe('EMAIL');
  });

  it('does not claim email was already delivered', () => {
    expect(deliveryFeedback({ deliveryChannel: 'EMAIL' }, 'Đã gửi Offer.'))
      .toContain('đưa email thông báo vào hàng đợi gửi');
  });

  it('explains the in-app channel', () => {
    expect(deliveryFeedback({ deliveryChannel: 'IN_APP' }, 'Đã lên lịch.'))
      .toContain('thông báo trên HR Connect');
  });
});
