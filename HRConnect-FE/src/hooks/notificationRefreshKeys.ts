/**
 * Which cached queries to refresh when a realtime notification arrives, by the entity it is about.
 * Invalidation only refetches queries that are mounted, so listing a key that the current page does
 * not use costs nothing. Keys are query-key roots (prefix match).
 */
const JOB = [['mf01-jobs'], ['client-overview'], ['hr-overview'], ['admin-overview'], ['aff-jobs'], ['mf05-posting-fees'], ['mf05-client-fees']];
const APPLICATION = [
  ['hr-screening'], ['hr-overview'], ['hr-pipeline'], ['hr-application'], ['hr-application-timeline'],
  ['client-candidates'], ['client-overview'], ['candidate-applications'], ['candidate-application-timeline'],
  ['aff-attributions'], ['aff-submissions'], ['sourcing-deliveries'],
];
const FINANCE = [
  ['mf05-fees'], ['mf05-client-fees'], ['mf05-posting-fees'], ['mf05-commissions'], ['mf05-my-commissions'],
  ['mf05-payouts'], ['mf05-my-payouts'], ['mf05-warranties'], ['mf05-replacement-slots'], ['admin-commission'],
  ['admin-overview'], ['client-overview'],
];

const BY_ENTITY: Record<string, string[][]> = {
  JOB,
  SERVICE_AGREEMENT: JOB,
  COMPANY: [['client-company'], ['admin-approvals'], ['admin-overview'], ['client-overview']],
  AFFILIATE: [['aff-profile'], ['aff-profile-detail'], ['admin-approvals'], ['admin-overview']],
  APPLICATION,
  SUBMISSION: [...APPLICATION, ['candidate-submission-consents'], ['aff-submissions']],
  SOURCING_DELIVERY: APPLICATION,
  INTERVIEW: [...APPLICATION, ['interview-history'], ['client-interview-detail']],
  OFFER: APPLICATION,
  PLACEMENT: [...APPLICATION, ...FINANCE, ['mf04-placement-correction']],
  WARRANTY: FINANCE,
  SERVICE_FEE: FINANCE,
  COMMISSION: [...FINANCE, ['affiliate-performance']],
  PAYOUT: FINANCE,
  REPLACEMENT_SLOT: [...FINANCE, ...JOB],
  DISPUTE: [['affiliate-my-disputes'], ['admin-disputes'], ['admin-dispute-detail'], ['aff-attributions']],
  CANDIDATE_IDENTITY_CLAIM: [['admin-candidate-identity-claims'], ['candidate']],
  CANDIDATE_DUPLICATE_CASE: [['admin-candidate-identity-claims'], ...APPLICATION],
};

export function refreshKeysFor(relatedEntityType: string | null | undefined): string[][] {
  return BY_ENTITY[(relatedEntityType ?? '').trim().toUpperCase()] ?? [];
}
