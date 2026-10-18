import { describe, expect, it } from 'vitest';
import { CANDIDATE_STEPS, candidateDisplayStage, candidateStage } from './mf02Labels';

describe('candidate application offer progress', () => {
  it('keeps waiting for an offer separate from receiving one', () => {
    expect(CANDIDATE_STEPS).toEqual([
      'Đã nộp',
      'Đang được xem',
      'Được chọn',
      'Phỏng vấn',
      'Chờ offer',
      'Đã nhận offer',
      'Đi làm',
    ]);

    expect(candidateDisplayStage('OFFER', 'Đang chuẩn bị offer')).toMatchObject({
      step: 4,
      label: 'Đang chuẩn bị offer',
    });
    expect(candidateDisplayStage('OFFER', 'Đã nhận lời mời')).toMatchObject({
      step: 5,
      label: 'Đã nhận lời mời',
    });
  });

  it('uses sent offer data to advance the detail page to received offer', () => {
    expect(candidateStage('OFFER_PENDING')).toMatchObject({ step: 4, label: 'Đang chuẩn bị offer' });
    expect(candidateStage('OFFER_PENDING', ['SENT'])).toMatchObject({ step: 5, label: 'Đã nhận offer' });
    expect(candidateStage('PLACED')).toMatchObject({ step: 6, label: 'Đã đi làm' });
  });
});
