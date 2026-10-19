import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateCvsPage } from './CandidatePages';
import { candidateCvApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02Api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/mf02Api')>('@/services/api/mf02Api');
  return {
    ...actual,
    candidateCvApi: {
      list: vi.fn(),
      downloadUrl: vi.fn(),
      upload: vi.fn(),
      updateTitle: vi.fn(),
      setPrimary: vi.fn(),
      remove: vi.fn(),
    },
  };
});

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp><MemoryRouter><CandidateCvsPage /></MemoryRouter></AntApp>
    </QueryClientProvider>
  );
};

describe('CandidateCvsPage', () => {
  beforeEach(() => {
    vi.mocked(candidateCvApi.list).mockResolvedValue([{
      cvId: 'cv-1',
      title: 'CV cũ',
      fileName: 'cv.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      isPrimary: false,
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      submissionUsageCount: 2,
      applicationUsageCount: 1,
      isReferenced: true,
      deleteBehavior: 'ARCHIVE_HISTORY',
    }]);
    vi.mocked(candidateCvApi.updateTitle).mockResolvedValue({ success: true, message: 'Đã cập nhật.' });
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'candidate-user',
        name: 'Candidate',
        email: 'candidate@example.com',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
        permissions: ['cv.view_own', 'cv.create', 'cv.update_own', 'cv.delete_own'],
      },
    });
  });

  it('renames an owned CV and refreshes the vault', async () => {
    renderPage();
    await screen.findByText('CV cũ');
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên CV cũ' }));
    const input = screen.getByRole('textbox', { name: 'Tiêu đề CV' });
    fireEvent.change(input, { target: { value: 'CV Backend 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(candidateCvApi.updateTitle).toHaveBeenCalledWith('cv-1', 'CV Backend 2026'));
    await waitFor(() => expect(candidateCvApi.list).toHaveBeenCalledTimes(2));
  }, 10_000);

  it('hides mutating controls when backend permissions are absent', async () => {
    useAuthStore.setState((state) => ({
      user: state.user ? { ...state.user, permissions: ['cv.view_own'] } : null,
    }));
    renderPage();
    await screen.findByText('CV cũ');

    expect(screen.queryByRole('button', { name: 'Đổi tên CV cũ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đặt làm CV chính' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gỡ CV cũ khỏi kho' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Kéo thả CV/)).not.toBeInTheDocument();
  });

  it('explains referenced CV retention before deletion', async () => {
    renderPage();
    expect(await screen.findByText(/Đang được lưu trong 1 đơn ứng tuyển/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ CV cũ khỏi kho' }));
    expect(await screen.findByText(/bản đã gắn với lượt nộp và đơn ứng tuyển vẫn được giữ/)).toBeInTheDocument();
  });

  it('shows "Sửa nội dung" only for structured CVs (TEMPLATE_FORM, PLATFORM_BUILDER) and hides for UPLOAD', async () => {
    vi.mocked(candidateCvApi.list).mockResolvedValue([
      {
        cvId: 'cv-structured-1',
        title: 'CV Theo Mẫu',
        fileName: 'cv-1.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        isPrimary: false,
        status: 'ACTIVE',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        submissionUsageCount: 0,
        applicationUsageCount: 0,
        isReferenced: false,
        deleteBehavior: 'HARD_DELETE',
        creationMethod: 'TEMPLATE_FORM',
      },
      {
        cvId: 'cv-upload-1',
        title: 'CV File PDF',
        fileName: 'upload.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 4096,
        isPrimary: false,
        status: 'ACTIVE',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        submissionUsageCount: 0,
        applicationUsageCount: 0,
        isReferenced: false,
        deleteBehavior: 'HARD_DELETE',
        creationMethod: 'UPLOAD',
      },
    ]);

    renderPage();

    expect(await screen.findByText('CV Theo Mẫu')).toBeInTheDocument();
    expect(screen.getByText('CV File PDF')).toBeInTheDocument();

    // CV Theo Mẫu has "Sửa nội dung"
    expect(screen.getByRole('button', { name: 'Sửa nội dung CV Theo Mẫu' })).toBeInTheDocument();

    // CV File PDF does NOT have "Sửa nội dung"
    expect(screen.queryByRole('button', { name: 'Sửa nội dung CV File PDF' })).not.toBeInTheDocument();
  });

  it('opens CV builder modal when clicking "Tạo CV mới"', async () => {
    renderPage();
    await screen.findByText('CV cũ');

    const createButtons = screen.getAllByRole('button', { name: /Tạo CV mới/i });
    expect(createButtons.length).toBeGreaterThan(0);
    fireEvent.click(createButtons[0]);

    expect(await screen.findByText('Tạo CV mới cho ứng viên')).toBeInTheDocument();
    expect(screen.getAllByText('Dựng CV theo mẫu đẹp').length).toBeGreaterThanOrEqual(1);
  });
});
