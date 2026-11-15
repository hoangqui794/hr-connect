import { describe, expect, it } from 'vitest';
import { refreshKeysFor } from './notificationRefreshKeys';

describe('refreshKeysFor', () => {
  it('maps an entity type to the lists that show it, case-insensitively', () => {
    expect(refreshKeysFor('job')).toContainEqual(['mf01-jobs']);
    expect(refreshKeysFor('SOURCING_DELIVERY')).toContainEqual(['sourcing-deliveries']);
    expect(refreshKeysFor('COMMISSION')).toContainEqual(['mf05-my-commissions']);
    expect(refreshKeysFor('WARRANTY')).toContainEqual(['mf05-warranties']);
    expect(refreshKeysFor('CONTACT_REQUEST')).toContainEqual(['admin-contact-requests']);
    expect(refreshKeysFor('PLACEMENT_RECONCILIATION')).toContainEqual(['placement-reconciliations']);
    expect(refreshKeysFor('APPLICATION')).toContainEqual(['client-pipeline']);
    expect(refreshKeysFor('INTERVIEW')).toContainEqual(['candidate', 'interviews']);
    expect(refreshKeysFor('OFFER')).toEqual(expect.arrayContaining([
      ['candidate-offer'],
      ['candidate-offer-versions'],
      ['candidate-offer-impact'],
    ]));
  });

  it('includes client billing key for JOB and SERVICE_AGREEMENT notifications', () => {
    expect(refreshKeysFor('JOB')).toContainEqual(['client-billing']);
    expect(refreshKeysFor('SERVICE_AGREEMENT')).toContainEqual(['client-billing']);
  });

  it('maps ONLINE_PAYMENT and finance entities to all active finance query keys', () => {
    const financeKeys = [
      ['client-billing'],
      ['mf05-count'],
      ['mf05-replacement-refunds'],
      ['mf05-replacement-slots-summary'],
      ['placements'],
    ];

    for (const entityType of ['ONLINE_PAYMENT', 'online_payment', 'SERVICE_FEE', 'WARRANTY', 'PLACEMENT']) {
      const keys = refreshKeysFor(entityType);
      for (const expectedKey of financeKeys) {
        expect(keys).toContainEqual(expectedKey);
      }
    }
  });

  it('includes both domain keys and finance keys for DISPUTE and SOURCING_DELIVERY', () => {
    const disputeKeys = refreshKeysFor('DISPUTE');
    expect(disputeKeys).toContainEqual(['admin-disputes']);
    expect(disputeKeys).toContainEqual(['affiliate-my-disputes']);
    expect(disputeKeys).toContainEqual(['mf05-commissions']);
    expect(disputeKeys).toContainEqual(['client-billing']);
    expect(disputeKeys).toContainEqual(['mf05-count']);
    expect(disputeKeys).toContainEqual(['placements']);

    const sourcingKeys = refreshKeysFor('SOURCING_DELIVERY');
    expect(sourcingKeys).toContainEqual(['sourcing-deliveries']);
    expect(sourcingKeys).toContainEqual(['mf05-fees']);
    expect(sourcingKeys).toContainEqual(['client-billing']);
    expect(sourcingKeys).toContainEqual(['mf05-count']);
  });

  it('returns nothing for unknown or missing types', () => {
    expect(refreshKeysFor('UNKNOWN')).toEqual([]);
    expect(refreshKeysFor(null)).toEqual([]);
  });
});
