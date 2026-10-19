import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { CandidateCvBuilderModal } from './CandidateCvBuilderModal';
import { cvBuilderApi } from '@/services/api/cvBuilderApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/cvBuilderApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/cvBuilderApi')>(
    '@/services/api/cvBuilderApi'
  );
  return {
    ...actual,
    cvBuilderApi: {
      getTemplates: vi.fn(),
      createStructuredCv: vi.fn(),
      getStructuredCv: vi.fn(),
      updateStructuredCv: vi.fn(),
    },
  };
});

describe('CandidateCvBuilderModal', () => {
  let queryClient: QueryClient;

  const mockTemplates = [
    {
      cvTemplateId: 'tpl-1',
      code: 'MODERN_TECH',
      name: 'Modern Tech',
      templateConfig: { accentColor: '#2563eb', density: 'normal' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    vi.mocked(cvBuilderApi.getTemplates).mockResolvedValue(mockTemplates);

    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-1',
        name: 'Nguyễn Văn Tester',
        email: 'tester@example.com',
        phone: '0987654321',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
      } as any,
    });
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof CandidateCvBuilderModal>> = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <MemoryRouter>
            <CandidateCvBuilderModal
              open={true}
              onClose={vi.fn()}
              onSuccess={vi.fn()}
              mode="create"
              {...props}
            />
          </MemoryRouter>
        </AntApp>
      </QueryClientProvider>
    );

  it('renders creation method choices in create mode', async () => {
    renderModal({ mode: 'create' });

    expect(screen.getByText('Tạo CV mới cho ứng viên')).toBeInTheDocument();
    expect(screen.getByText('Dựng CV theo mẫu đẹp')).toBeInTheDocument();
    expect(screen.getByText('Tự dựng CV nhanh')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Modern Tech')).toBeInTheDocument();
    });
  });

  it('proceeds to form editor when clicking "Tự dựng ngay"', async () => {
    renderModal({ mode: 'create' });

    fireEvent.click(screen.getByRole('button', { name: 'Tự dựng ngay' }));

    await waitFor(() => {
      expect(screen.getByText('Dựng nội dung CV chuyên nghiệp')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Nguyễn Văn Tester')).toBeInTheDocument();
    expect(screen.getByDisplayValue('tester@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0987654321')).toBeInTheDocument();
  });

  it('submits createStructuredCv successfully and calls onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.mocked(cvBuilderApi.createStructuredCv).mockResolvedValueOnce({
      cvId: 'cv-new-1',
      title: 'CV - Nguyễn Văn Tester',
      cvTemplateId: null,
      isPrimary: false,
      creationMethod: 'PLATFORM_BUILDER',
      structuredContent: {
        fullName: 'Nguyễn Văn Tester',
        experiences: [],
        educations: [],
        skills: ['React'],
        languages: [],
        certificates: [],
      },
    });

    renderModal({ mode: 'create', onSuccess: handleSuccess, onClose: handleClose });

    // Step 1: Choose custom builder
    fireEvent.click(screen.getByRole('button', { name: 'Tự dựng ngay' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo và xuất bản CV' })).toBeInTheDocument();
    });

    // Step 2: Submit
    fireEvent.click(screen.getByRole('button', { name: 'Tạo và xuất bản CV' }));

    await waitFor(() => {
      expect(cvBuilderApi.createStructuredCv).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'CV - Nguyễn Văn Tester',
          cvTemplateId: null,
          structuredContent: expect.objectContaining({
            fullName: 'Nguyễn Văn Tester',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('loads existing structured CV and updates in edit mode', async () => {
    const existingCv = {
      cvId: 'cv-edit-1',
      title: 'CV Chuyên Gia React',
      cvTemplateId: 'tpl-1',
      isPrimary: true,
      creationMethod: 'TEMPLATE_FORM',
      structuredContent: {
        fullName: 'Trần Văn Coder',
        headline: 'Lead React Developer',
        email: 'coder@example.com',
        phone: '0909090909',
        summary: '5 năm chuyên sâu frontend',
        experiences: [
          {
            title: 'Frontend Lead',
            company: 'Tech Corp',
            startDate: '2021',
            endDate: 'Hiện tại',
            description: 'Dẫn dắt team 8 người',
          },
        ],
        educations: [],
        skills: ['React', 'Next.js'],
        languages: ['Tiếng Anh'],
        certificates: [],
      },
    };

    vi.mocked(cvBuilderApi.getStructuredCv).mockResolvedValueOnce(existingCv);
    vi.mocked(cvBuilderApi.updateStructuredCv).mockResolvedValueOnce({
      ...existingCv,
      title: 'CV Chuyên Gia React - Đã sửa',
    });

    const handleSuccess = vi.fn();
    renderModal({ mode: 'edit', editCvId: 'cv-edit-1', onSuccess: handleSuccess });

    await waitFor(() => {
      expect(cvBuilderApi.getStructuredCv).toHaveBeenCalledWith('cv-edit-1');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Trần Văn Coder')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Lead React Developer')).toBeInTheDocument();
    });

    // Submit edit
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(cvBuilderApi.updateStructuredCv).toHaveBeenCalledWith(
        'cv-edit-1',
        expect.objectContaining({
          title: 'CV Chuyên Gia React',
          cvTemplateId: 'tpl-1',
          structuredContent: expect.objectContaining({
            fullName: 'Trần Văn Coder',
            headline: 'Lead React Developer',
          }),
        })
      );
    });
  });

  it('displays user-friendly error when backend rejects empty content with CV_CONTENT_EMPTY', async () => {
    vi.mocked(cvBuilderApi.createStructuredCv).mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'CV_CONTENT_EMPTY' },
      },
      message: 'CV_CONTENT_EMPTY',
    });

    renderModal({ mode: 'create' });

    // Choose custom builder
    fireEvent.click(screen.getByRole('button', { name: 'Tự dựng ngay' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo và xuất bản CV' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo và xuất bản CV' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Nội dung CV chưa đủ thông tin. Vui lòng nhập ít nhất 1 trong các mục/i)
      ).toBeInTheDocument();
    });
  });
});
