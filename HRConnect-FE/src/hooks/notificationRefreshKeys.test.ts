import { describe, expect, it } from 'vitest';
import { refreshKeysFor } from './notificationRefreshKeys';

describe('refreshKeysFor', () => {
  it('maps an entity type to the lists that show it, case-insensitively', () => {
    expect(refreshKeysFor('job')).toContainEqual(['mf01-jobs']);
    expect(refreshKeysFor('SOURCING_DELIVERY')).toContainEqual(['sourcing-deliveries']);
    expect(refreshKeysFor('COMMISSION')).toContainEqual(['mf05-my-commissions']);
    expect(refreshKeysFor('WARRANTY')).toContainEqual(['mf05-warranties']);
  });

  it('returns nothing for unknown or missing types', () => {
    expect(refreshKeysFor('UNKNOWN')).toEqual([]);
    expect(refreshKeysFor(null)).toEqual([]);
  });
});
