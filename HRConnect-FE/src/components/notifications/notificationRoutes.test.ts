import { describe, expect, it } from 'vitest';
import { UserRole } from '@/types/roles';
import { portalRoute } from './notificationRoutes';

const JOB = '1b2c3d4e-0000-4000-8000-000000000001';

describe('portalRoute', () => {
  it('keeps a signed-in client inside the client portal', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.CLIENT)).toBe(`/client/jobs?highlight=${JOB}&openDetail=true`);
  });

  it('sends candidates and affiliates to their own job detail pages', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.CANDIDATE)).toBe(`/candidate/jobs/${JOB}`);
    expect(portalRoute(`/jobs/${JOB}`, UserRole.AFFILIATE)).toBe(`/affiliate/jobs/${JOB}`);
  });

  it('sends Internal HR and Admin to their job review pages', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.INTERNAL_HR)).toBe('/hr/jobs');
    expect(portalRoute(`/jobs/${JOB}`, UserRole.ADMIN)).toBe('/admin/jobs');
  });

  it('keeps the public page for guests and leaves other routes unchanged', () => {
    expect(portalRoute(`/jobs/${JOB}`, UserRole.GUEST)).toBe(`/jobs/${JOB}`);
    expect(portalRoute('/client/candidates', UserRole.CLIENT)).toBe('/client/candidates');
    expect(portalRoute('/candidate/jobs?tab=matches', UserRole.CANDIDATE)).toBe('/candidate/jobs?tab=matches');
  });
});
