import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { CandidateApplicationDetailPage } from './CandidatePages';

describe('CandidateApplicationDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(candidateApplicationsApi, 'detail').mockResolvedValue({
      applicationId: 'application-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      jobTitle: 'Senior .NET Developer',
      companyId: 'company-1',
      companyName: 'HR Connect',
      cvId: 'cv-1',
      cvTitle: 'CV Backend',
      cvFileName: 'backend.pdf',
      status: 'APPLIED',
      currentStage: 'SCREENING',
      statusReason: null,
      submissionSource: 'CANDIDATE',
      appliedAt: '2026-10-08T10:00:00Z',
      updatedAt: '2026-10-08T10:05:00Z',
      aiStatus: 'PENDING',
      aiMatchScore: null,
      aiMatchTier: null,
    });
  });

  it('loads the owned application and displays its real status', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/candidate/applications/application-1']}>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <Routes>
              <Route path="/candidate/applications/:applicationId" element={<CandidateApplicationDetailPage />} />
            </Routes>
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Senior .NET Developer' })).toBeInTheDocument();
    expect(screen.getByText('CV Backend')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(candidateApplicationsApi.detail).toHaveBeenCalledWith('application-1');
  });
});
