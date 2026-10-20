import { describe, expect, it } from 'vitest';
import { appendCandidateReturnPath, getSafeCandidateReturnPath } from './authReturnPath';

describe('candidate authentication return path', () => {
  it('keeps an allowed Candidate route', () => {
    expect(getSafeCandidateReturnPath('/candidate/offers?tab=sent')).toBe('/candidate/offers?tab=sent');
  });

  it('rejects external, protocol-relative and other-role paths', () => {
    expect(getSafeCandidateReturnPath('https://evil.example')).toBeUndefined();
    expect(getSafeCandidateReturnPath('//evil.example')).toBeUndefined();
    expect(getSafeCandidateReturnPath('/client/dashboard')).toBeUndefined();
  });

  it('encodes the selected return path into an existing auth query string', () => {
    expect(appendCandidateReturnPath('/register?role=CANDIDATE', '/candidate/dashboard'))
      .toBe('/register?role=CANDIDATE&returnTo=%2Fcandidate%2Fdashboard');
  });
});
