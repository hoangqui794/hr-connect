import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateCvApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { Job } from '@/types/api/jobs';
import { JobApplyActions } from './JobApplyActions';

const job = {
  jobId: 'job-1',
  companyId: 'company-1',
  title: 'Backend Developer',
  companyName: 'HR Connect',
  serviceTypeId: 'service-1',
  serviceTypeCode: 'HEADHUNT_COD',
  description: null,
  benefits: null,
  location: null,
  workingTime: null,
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryNegotiable: true,
  salaryNote: null,
  minExperienceYears: null,
  maxExperienceYears: null,
  currencyCode: 'VND',
  quantity: 1,
  status: 'ACTIVE',
  visibility: 'PARTNER_ONLY',
  statusReason: null,
  postedAt: null,
  closedAt: null,
  createdAt: '2026-10-08T00:00:00Z',
  updatedAt: '2026-10-08T00:00:00Z',
  concurrencyToken: 'token',
  requirements: [],
  skills: [],
  statusHistories: [],
} satisfies Job;

const renderActions = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <JobApplyActions job={job} />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('JobApplyActions', () => {
  beforeEach(() => {
    vi.spyOn(candidateCvApi, 'list').mockResolvedValue([]);
    useAuthStore.setState({
      role: UserRole.AFFILIATE,
      isAuthenticated: true,
      user: {
        id: 'multi-role',
        name: 'Candidate Affiliate',
        email: 'candidate@example.com',
        role: UserRole.AFFILIATE,
        roles: ['AFFILIATE_RECRUITER', 'CANDIDATE'],
        permissions: ['application.create'],
      },
    });
  });

  it('uses backend role and permission claims instead of job visibility', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /Ứng tuyển/i })).toBeEnabled();
  });

  it('disables self-apply when application.create is missing', () => {
    useAuthStore.setState((state) => ({
      user: state.user ? { ...state.user, permissions: [] } : null,
    }));
    renderActions();
    expect(screen.getByRole('button', { name: /Ứng tuyển/i })).toBeDisabled();
    expect(screen.getByText('Tài khoản chưa có quyền tự ứng tuyển.')).toBeInTheDocument();
  });
});
