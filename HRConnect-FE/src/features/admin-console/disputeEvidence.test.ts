import { describe, expect, it } from 'vitest';
import { parseDisputeEvidence } from './AdminDisputesPage';

describe('parseDisputeEvidence', () => {
  it('hides empty evidence instead of printing "[]"', () => {
    expect(parseDisputeEvidence('[]')).toEqual([]);
    expect(parseDisputeEvidence('')).toEqual([]);
    expect(parseDisputeEvidence(null)).toEqual([]);
  });

  it('reads the JSON items the backend stores', () => {
    const raw = JSON.stringify([
      { type: 'NOTE', value: 'Ứng viên đã gửi CV cho tôi trước', addedAt: '2026-11-20T03:00:00Z' },
      { type: 'LINK', value: 'https://drive.example.com/cv.pdf' },
    ]);

    expect(parseDisputeEvidence(raw)).toEqual([
      { type: 'NOTE', value: 'Ứng viên đã gửi CV cho tôi trước', addedAt: '2026-11-20T03:00:00Z' },
      { type: 'LINK', value: 'https://drive.example.com/cv.pdf', addedAt: null },
    ]);
  });

  it('never turns a non-http value into a clickable link', () => {
    const raw = JSON.stringify([{ type: 'LINK', value: 'javascript:alert(1)' }]);

    expect(parseDisputeEvidence(raw)).toEqual([{ type: 'NOTE', value: 'javascript:alert(1)', addedAt: null }]);
  });

  it('keeps old plain-text evidence as a note', () => {
    expect(parseDisputeEvidence('Ghi chú cũ')).toEqual([{ type: 'NOTE', value: 'Ghi chú cũ' }]);
  });
});
