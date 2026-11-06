import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobsApi } from '@/services/api/jobsApi';
import { JobReviewPage } from './JobReviewPage';

const mockPendingJobs = [
  {
    jobId: '3d0f8b11-fe82-4409-9585-e00df7cf41d8',
    title: 'Kế Toán Kho',
    companyName: 'Thủ Đức Company',
    companyId: 'comp-1',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_REVIEW',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T11:39:00Z',
    concurrencyToken: 'token-1',
    requirements: [],
    skills: [],
    statusHistories: [],
  },
  {
    jobId: 'job-2',
    title: 'AI Content Creator',
    companyName: 'Thủ Đức Company',
    companyId: 'comp-1',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_REVIEW',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T11:23:00Z',
    concurrencyToken: 'token-2',
    requirements: [],
    skills: [],
    statusHistories: [],
  },
];

const mockAgreementJobs = [
  {
    jobId: 'job-agreement-1',
    title: 'Senior Developer',
    companyName: 'Tech Corp',
    companyId: 'comp-3',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_AGREEMENT',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
    concurrencyToken: 'token-3',
    requirements: [],
    skills: [],
    statusHistories: [],
  },
];

const mockAllJobs = [...mockPendingJobs, ...mockAgreementJobs];

describe('JobReviewPage tab switching with highlight query param', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_REVIEW') return mockPendingJobs as any;
      if (status === 'PENDING_AGREEMENT') return mockAgreementJobs as any;
      if (status === 'ALL') return mockAllJobs as any;
      return [];
    });

    vi.spyOn(jobsApi, 'getById').mockImplementation(async (id) => {
      const found = mockAllJobs.find((j) => j.jobId === id);
      return found as any;
    });
  });

  it('allows user to switch tab cleanly when arriving with a highlight param matching a pending review job', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=3d0f8b11-fe82-4409-9585-e00df7cf41d8']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });

    // Switch tab to "Thỏa thuận dịch vụ"
    const agreementTab = screen.getByText('Thỏa thuận dịch vụ');
    fireEvent.click(agreementTab);

    // Verify it cleanly switches to the new tab
    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });
  });

  it('auto-redirects to the correct tab when highlight param belongs to another status, and still allows subsequent tab switches', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=job-agreement-1']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Should redirect to "Thỏa thuận dịch vụ" and show Senior Developer
    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });

    // Then user manually clicks "Chờ duyệt" tab
    const pendingTab = screen.getByText('Chờ duyệt');
    fireEvent.click(pendingTab);

    // Should successfully switch back to Chờ duyệt without being hijacked
    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });
  });

  it('cleans up highlight param gracefully when job is not found in any queue', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=non-existent-guid']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Default to first job in list
    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });

    // Clicking another tab must switch cleanly
    const agreementTab = screen.getByText('Thỏa thuận dịch vụ');
    fireEvent.click(agreementTab);

    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });
  });
});
