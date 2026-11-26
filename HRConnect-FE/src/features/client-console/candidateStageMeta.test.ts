import { describe, expect, it } from 'vitest';
import { groupApplicationsByStage, stageMetaOf } from './candidateStageMeta';

describe('candidateStageMeta', () => {
  it('maps every active status to its canonical 5-step hiring stage', () => {
    expect(stageMetaOf('SUBMITTED')).toMatchObject({ key: 'review', step: 1, stageLabel: 'Bước 1 · Mới nộp' });
    expect(stageMetaOf('SCREENING')).toMatchObject({ key: 'review', step: 1, stageLabel: 'Bước 1 · Sàng lọc CV' });
    expect(stageMetaOf('SHORTLISTED')).toMatchObject({ key: 'shortlisted', step: 2, stageLabel: 'Bước 2 · Đã chọn CV' });
    expect(stageMetaOf('INTERVIEW')).toMatchObject({ key: 'interview', step: 3, stageLabel: 'Bước 3 · Phỏng vấn' });
    expect(stageMetaOf('BACKUP')).toMatchObject({ key: 'interview', step: 3, stageLabel: 'Bước 3 · Dự phòng' });
    expect(stageMetaOf('OFFER_PENDING')).toMatchObject({ key: 'offer', step: 4, stageLabel: 'Bước 4 · Chờ Offer' });
    expect(stageMetaOf('OFFER_ACCEPTED')).toMatchObject({ key: 'offer', step: 4, stageLabel: 'Bước 4 · Đã nhận Offer' });
    expect(stageMetaOf('PLACED')).toMatchObject({ key: 'placed', step: 5, stageLabel: 'Bước 5 · Đã đi làm' });
  });

  it('maps terminal and stopped statuses to Dừng tuyển (step 0)', () => {
    for (const status of [
      'REJECTED',
      'BACKUP_NOT_SELECTED',
      'INTERVIEW_FAILED',
      'OFFER_DECLINED',
      'NOT_STARTED',
      'WITHDRAWN',
      'RESIGNED',
      'LEFT_DURING_WARRANTY',
      'CLOSED',
    ]) {
      expect(stageMetaOf(status)).toMatchObject({ key: 'closed', step: 0, stageLabel: 'Dừng tuyển' });
    }
  });

  it('groups applications in funnel order (review -> placed -> closed) and omits empty groups', () => {
    const groups = groupApplicationsByStage([
      { id: 'p1', status: 'PLACED' },
      { id: 'c1', status: 'REJECTED' },
      { id: 'r1', status: 'SUBMITTED' },
      { id: 'i1', status: 'INTERVIEW' },
      { id: 'r2', status: 'SCREENING' },
      { id: 'c2', status: 'WITHDRAWN' },
    ]);

    expect(groups.map((g) => g.key)).toEqual(['review', 'interview', 'placed', 'closed']);
    expect(groups[0].items.map((x) => x.id)).toEqual(['r1', 'r2']);
    expect(groups[1].items.map((x) => x.id)).toEqual(['i1']);
    expect(groups[2].items.map((x) => x.id)).toEqual(['p1']);
    expect(groups[3].items.map((x) => x.id)).toEqual(['c1', 'c2']);
  });
});
