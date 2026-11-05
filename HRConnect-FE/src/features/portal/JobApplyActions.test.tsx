import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
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
        roles: ['AFFILIATE', 'CANDIDATE'],
        permissions: ['application.create'],
      },
    });
  });

  it('uses backend role and permission claims instead of job visibility', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /Ứng tuyển/i })).toBeEnabled();
  });

  it('applies with the CV the candidate picks and shows contact details read-only', async () => {
    const cv = (cvId: string, title: string, isPrimary: boolean) => ({ cvId, title, fileName: `${cvId}.pdf`, fileSizeBytes: 1024, isPrimary, updatedAt: '2026-11-01T00:00:00Z' });
    vi.spyOn(candidateCvApi, 'list').mockResolvedValue([cv('cv-1', 'CV chính thức', true), cv('cv-2', 'CV khác', false)] as never);
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValue({ fullName: 'Nguyễn An', email: 'an@example.com', phone: '0900000000' } as never);
    const apply = vi.spyOn(applyApi, 'apply').mockResolvedValue({ data: { applicationId: 'app-1' } } as never);
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: /Ứng tuyển/i }));
    expect(await screen.findByRole('radio', { name: /CV chính thức/ })).toBeChecked();
    expect(await screen.findByDisplayValue('0900000000')).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('radio', { name: /CV khác/ }));
    fireEvent.click(screen.getByRole('button', { name: /nộp hồ sơ/i }));

    await waitFor(() => expect(apply).toHaveBeenCalledWith('job-1', { cvId: 'cv-2' }));
    expect(await screen.findByText('Đã nộp đơn ứng tuyển')).toBeInTheDocument();
  });

  it('guides candidates who have no CV to create one online or upload directly', async () => {
    vi.spyOn(candidateCvApi, 'list').mockResolvedValue([] as never);
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValue({ fullName: 'Nguyễn An', email: 'an@example.com' } as never);
    const apply = vi.spyOn(applyApi, 'apply').mockResolvedValue({ data: { applicationId: 'app-new' } } as never);
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: /Ứng tuyển/i }));
    expect(await screen.findByText('Bạn chưa có bản CV nào trong hệ thống')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo CV online ngay/i })).toBeInTheDocument();
    expect(screen.getByText('Tải lên CV (PDF)')).toBeInTheDocument();

    // Upload a new PDF file directly
    const testFile = new File(['%PDF-1.4 test cv'], 'my-cv.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(await screen.findByText('my-cv.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Đã chọn để nộp hồ sơ/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /nộp hồ sơ/i }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith('job-1', { file: testFile }));
    expect(await screen.findByText('Đã nộp đơn ứng tuyển')).toBeInTheDocument();
  });

  it('disables self-apply when application.create is missing', () => {
    useAuthStore.setState((state) => ({
      user: state.user ? { ...state.user, permissions: [] } : null,
    }));
    renderActions();
    expect(screen.getByRole('button', { name: /Ứng tuyển/i })).toBeDisabled();
    expect(screen.getByText('Tài khoản chưa có quyền tự ứng tuyển.')).toBeInTheDocument();
  });

  it('disables self-apply when the backend marks the job as no longer accepting applications', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <JobApplyActions job={{ ...job, isAcceptingApplications: false }} />
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Đã hết hạn nhận hồ sơ/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Ứng tuyển$/i })).not.toBeInTheDocument();
  });
});
