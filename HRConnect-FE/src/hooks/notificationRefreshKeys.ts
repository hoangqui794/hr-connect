/**
 * Which cached queries to refresh when a realtime notification arrives, by the entity it is about.
 * Invalidation only refetches queries that are mounted, so listing a key that the current page does
 * not use costs nothing. Keys are query-key roots (prefix match).
 */
const JOB = [
  ['mf01-jobs'], ['client-overview'], ['hr-overview'], ['admin-overview'], ['admin-dashboard-metrics'], ['aff-jobs'],
  ['mf05-posting-fees'], ['mf05-client-fees'], ['client-billing'],
];
const APPLICATION = [
  ['hr-screening'], ['hr-overview'], ['hr-pipeline'], ['hr-application'], ['hr-application-timeline'],
  ['client-candidates'], ['client-overview'], ['client-pipeline'], ['candidate-applications'], ['candidate-application-timeline'],
  ['aff-attributions'], ['aff-submissions'], ['sourcing-deliveries'],
];
const FINANCE = [
  ['mf01-jobs'], ['service-fees'],
  ['mf05-fees'], ['mf05-client-fees'], ['mf05-posting-fees'], ['mf05-commissions'], ['mf05-my-commissions'],
  ['mf05-payouts'], ['mf05-my-payouts'], ['mf05-warranties'], ['mf05-replacement-slots'],
  ['mf05-replacement-slots-summary'], ['mf05-replacement-refunds'], ['mf05-count'],
  ['client-billing'], ['placements'], ['admin-commission'], ['admin-overview'], ['admin-dashboard-metrics'], ['client-overview'],
];

const BY_ENTITY: Record<string, string[][]> = {
  JOB,
  SERVICE_AGREEMENT: JOB,
  COMPANY: [['client-company'], ['admin-approvals'], ['admin-overview'], ['admin-dashboard-metrics'], ['client-overview']],
  AFFILIATE: [['aff-profile'], ['aff-profile-detail'], ['admin-approvals'], ['admin-overview'], ['admin-dashboard-metrics']],
  APPLICATION,
  SUBMISSION: [
    ...APPLICATION,
    ['candidate-submission-consents'],
    ['candidate-submission-consent'],
    ['candidate-affiliate-cvs'],
    ['aff-submissions'],
    ['aff-attributions'],
  ],
  SUBMISSION_CONSENT: [
    ...APPLICATION,
    ['candidate-submission-consents'],
    ['candidate-submission-consent'],
    ['candidate-affiliate-cvs'],
    ['aff-submissions'],
    ['aff-attributions'],
  ],
  ATTRIBUTION: [...APPLICATION, ['aff-attributions'], ['aff-submissions']],
  SOURCING_DELIVERY: [...APPLICATION, ...FINANCE],
  INTERVIEW: [...APPLICATION, ['interview-history'], ['client-interview-detail'], ['candidate', 'interviews']],
  OFFER: [...APPLICATION, ['candidate-offer'], ['candidate-offer-versions'], ['candidate-offer-impact']],
  PLACEMENT: [...APPLICATION, ...FINANCE, ['mf04-placement-correction']],
  WARRANTY: [...FINANCE, ...APPLICATION],
  SERVICE_FEE: FINANCE,
  COMMISSION: [...FINANCE, ['affiliate-performance']],
  PAYOUT: FINANCE,
  ONLINE_PAYMENT: FINANCE,
  REPLACEMENT_SLOT: [...FINANCE, ...JOB],
  DISPUTE: [['affiliate-my-disputes'], ['admin-disputes'], ['admin-dispute-detail'], ['aff-attributions'], ...FINANCE],
  CONTACT_REQUEST: [['admin-contact-requests']],
  PLACEMENT_RECONCILIATION: [['placement-reconciliations'], ['mf04-placement-correction'], ...APPLICATION, ...FINANCE],
  CANDIDATE_IDENTITY_CLAIM: [
    ['admin-candidate-identity-claims'],
    ['admin-candidate-identity-claim'],
    ['candidate'],
    ['candidate-email-identities'],
    ['candidate-duplicate-cases'],
  ],
  CANDIDATE_DUPLICATE_CASE: [
    ['admin-candidate-identity-claims'],
    ['admin-candidate-identity-claim'],
    ['candidate-email-identities'],
    ['candidate-duplicate-cases'],
    ...APPLICATION,
  ],
};

export function refreshKeysFor(relatedEntityType: string | null | undefined): string[][] {
  return BY_ENTITY[(relatedEntityType ?? '').trim().toUpperCase()] ?? [];
}
