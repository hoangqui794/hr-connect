import { App as AntApp } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '@/types/api/jobs';
import { JobFormPage } from './JobFormPage';
import {
  useJobDetail,
  useJobMutations,
  usePostingEligibility,
  usePostingPackages,
  useServiceTypes,
} from './useJobQueries';

vi.mock('./useJobQueries', () => ({
  useServiceTypes: vi.fn(),
  useJobDetail: vi.fn(),
  useJobMutations: vi.fn(),
  usePostingPackages: vi.fn(),
  usePostingEligibility: vi.fn(),
}));

vi.mock('./JobTemplatePicker', () => ({
  JobTemplatePicker: () => <div data-testid="job-template-picker" />,
}));

const completeDraftJob = (overrides: Partial<Job> = {}): Job => ({
  jobId: 'job-edit-1',
  companyId: 'comp-1',
  companyName: 'Tech Corp',
  serviceTypeId: 'svc-app',
  serviceTypeCode: 'CV_APPLICATION',
  title: 'Backend .NET Engineer',
  description: 'Xây dựng hệ thống backend .NET Core và PostgreSQL.',
  benefits: 'Thưởng tháng 13, bảo hiểm sức khỏe cao cấp.',
  location: 'TP. Hồ Chí Minh',
  workingTime: 'Thứ 2 - Thứ 6',
  employmentType: 'FULL_TIME',
  workMode: 'ONSITE',
  salaryMin: 20_000_000,
  salaryMax: 35_000_000,
  salaryNegotiable: false,
  salaryNote: null,
  minExperienceYears: 2,
  maxExperienceYears: null,
  currencyCode: 'VND',
  quantity: 2,
  status: 'DRAFT',
  statusReason: null,
  applicationDeadline: '2027-12-31T16:59:59Z',
  postingPackageCode: 'STANDARD',
  postedAt: null,
  closedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  concurrencyToken: 'tok-draft-1',
  requirements: [
    {
      requirementId: 'req-1',
      requirementType: 'MUST_HAVE',
      content: 'Tối thiểu 2 năm kinh nghiệm ASP.NET Core',
      category: 'EXPERIENCE',
      weight: null,
    },
  ],
  skills: [],
  statusHistories: [],
  ...overrides,
});

const renderEditJobForm = (job: Job) => {
  vi.mocked(useJobDetail).mockReturnValue({
    data: job,
    isLoading: false,
    isError: false,
  } as never);

  return render(
    <AntApp>
      <MemoryRouter initialEntries={[`/client/jobs/${job.jobId}/edit`]}>
        <Routes>
          <Route path="/client/jobs/:jobId/edit" element={<JobFormPage />} />
        </Routes>
      </MemoryRouter>
    </AntApp>
  );
};

const getVisibleNextButton = () => {
  const buttons = screen.getAllByRole('button', { name: 'Tiếp tục' });
  const visible = buttons.find((btn) => !btn.closest('.hidden'));
  if (!visible) throw new Error('Expected a visible "Tiếp tục" button');
  return visible;
};

const advanceToStep2 = async () => {
  await waitFor(() => {
    expect(getVisibleNextButton()).not.toBeDisabled();
  });
  // Step 1 -> Step 2 (Mô tả công việc)
  fireEvent.click(getVisibleNextButton());
  await waitFor(() => {
    expect(document.getElementById('form-title-item')?.closest('.hidden')).toBeNull();
  });
};

const expectStayedOnStep2 = () => {
  expect(document.getElementById('form-title-item')?.closest('.hidden')).toBeNull();
  const step3Heading = screen.getByRole('heading', { name: /Chọn gói đăng tin tuyển dụng/i });
  expect(step3Heading.closest('.hidden')).not.toBeNull();
};

const expectReachedStep3 = () => {
  expect(document.getElementById('form-title-item')?.closest('.hidden')).not.toBeNull();
  const step3Heading = screen.getByRole('heading', { name: /Chọn gói đăng tin tuyển dụng/i });
  expect(step3Heading.closest('.hidden')).toBeNull();
};

describe('JobFormPage validateStep(1) before advancing to Step 3', () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    scrollIntoViewSpy = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

    vi.mocked(useServiceTypes).mockReturnValue({
      data: [
        {
          id: 'svc-app',
          code: 'CV_APPLICATION',
          name: 'Nhận hồ sơ trực tiếp',
          description: 'Đăng tin nhận CV',
        },
      ],
      isLoading: false,
      isError: false,
    } as never);

    vi.mocked(usePostingPackages).mockReturnValue({
      data: [
        {
          packageId: 'pkg-std',
          code: 'STANDARD',
          name: 'Standard',
          price: 1_000_000,
          durationDays: 30,
          maxApplications: 50,
          isActive: true,
        },
      ],
      isLoading: false,
    } as never);

    vi.mocked(usePostingEligibility).mockReturnValue({
      data: { canUseFreePackage: true, activeJobsCount: 0, freeActiveLimit: 1 },
      isLoading: false,
    } as never);

    vi.mocked(useJobMutations).mockReturnValue({
      create: { mutateAsync: vi.fn(), isPending: false },
      update: { mutateAsync: vi.fn(), isPending: false },
      submit: { mutateAsync: vi.fn(), isPending: false },
    } as never);
  });

  it('advances to Step 3 when all required Step 2 fields are present', async () => {
    renderEditJobForm(completeDraftJob());
    await advanceToStep2();

    fireEvent.click(getVisibleNextButton());

    await waitFor(() => {
      expectReachedStep3();
    });
  });

  it.each([
    {
      label: 'title',
      job: () => completeDraftJob({ title: '' }),
      expectedError: 'Nhập tên vị trí tuyển dụng.',
      anchorId: 'form-title-item',
    },
    {
      label: 'employmentType',
      job: () => completeDraftJob({ employmentType: null }),
      expectedError: 'Chọn loại hình làm việc.',
      anchorId: 'form-employment-item',
    },
    {
      label: 'location (ONSITE)',
      job: () => completeDraftJob({ workMode: 'ONSITE', location: null }),
      expectedError: 'Nhập địa điểm làm việc.',
      anchorId: 'form-location-item',
    },
    {
      label: 'location (REMOTE still required by BE)',
      job: () => completeDraftJob({ workMode: 'REMOTE', location: null }),
      expectedError: 'Nhập địa điểm làm việc.',
      anchorId: 'form-location-item',
    },
    {
      label: 'description',
      job: () => completeDraftJob({ description: null }),
      expectedError: 'Nhập mô tả công việc.',
      anchorId: 'form-desc-item',
    },
    {
      label: 'benefits',
      job: () => completeDraftJob({ benefits: null }),
      expectedError: 'Nhập quyền lợi cho ứng viên.',
      anchorId: 'form-benefits-item',
    },
    {
      label: 'requirements (empty requirements & skills)',
      job: () => completeDraftJob({ requirements: [], skills: [] }),
      expectedError: 'Thêm ít nhất một yêu cầu bắt buộc hoặc nhập kỹ năng.',
      anchorId: 'form-requirements-item',
    },
    {
      label: 'deadline',
      job: () => completeDraftJob({ applicationDeadline: null }),
      expectedError: 'Chọn hạn nhận hồ sơ.',
      anchorId: 'form-deadline-item',
    },
  ])(
    'blocks advancing to Step 3, shows inline error, and scrolls when $label is missing',
    async ({ job, expectedError, anchorId }) => {
      renderEditJobForm(job());
      await advanceToStep2();

      fireEvent.click(getVisibleNextButton());

      const anchorEl = document.getElementById(anchorId)!;
      const errorNode = await within(anchorEl).findByText(expectedError);
      expect(errorNode).toBeInTheDocument();
      expect(scrollIntoViewSpy).toHaveBeenCalled();
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(anchorEl);
      expectStayedOnStep2();
    }
  );

  it('blocks advancing to Step 3, shows inline error, and scrolls when workMode is cleared', async () => {
    renderEditJobForm(completeDraftJob());
    await advanceToStep2();

    const workModeSection = document.getElementById('form-work-mode-item')!;
    const clearIcon = workModeSection.querySelector('.ant-select-clear') as HTMLElement;
    expect(clearIcon).not.toBeNull();
    fireEvent.mouseDown(clearIcon);

    fireEvent.click(getVisibleNextButton());

    const errorNode = await within(workModeSection).findByText('Chọn hình thức làm việc.');
    expect(errorNode).toBeInTheDocument();
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(workModeSection);
    expectStayedOnStep2();
  });

  it('blocks advancing to Step 3, shows inline error, and scrolls when quantity is empty or < 1', async () => {
    renderEditJobForm(completeDraftJob());
    await advanceToStep2();

    const quantitySection = document.getElementById('form-quantity-item')!;
    const qtyInput = quantitySection.querySelector('input') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: '' } });

    fireEvent.click(getVisibleNextButton());

    const errorNode = await within(quantitySection).findByText('Nhập số lượng cần tuyển (tối thiểu 1).');
    expect(errorNode).toBeInTheDocument();
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(quantitySection);
    expectStayedOnStep2();
  });
});
