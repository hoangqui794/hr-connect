import { App as AntApp, message } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mf04Api } from '@/services/api/mf04Api';
import { CandidateProfilePage } from './CandidateProfilePage';

// Mock matchMedia for Ant Design responsive Grid
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', name: 'Nguyễn Văn A', email: 'candidate@example.com' },
    updateUser: vi.fn(),
  }),
  getInitials: (name?: string) => (name ? name.charAt(0).toUpperCase() : 'U'),
}));

describe('CandidateProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, 'error').mockImplementation((() => undefined) as any);
    vi.spyOn(message, 'success').mockImplementation((() => undefined) as any);
  });

  const mockProfileData = {
    candidateId: 'cand-1',
    fullName: 'Nguyễn Văn A',
    email: 'candidate@example.com',
    phone: '0987654321',
    currentAddress: 'Hà Nội',
    highestEducation: 'Đại học',
    yearsOfExperience: 4,
    summary: 'Kỹ sư phần mềm chuyên môn sâu',
    profileVisibility: 'PUBLIC',
    currentJobTitle: 'Senior React Developer',
    currentLevel: 'Senior',
    targetRole: 'Frontend Lead',
    expectedSalaryMin: 35000000,
    expectedSalaryMax: 50000000,
    expectedSalaryCurrency: 'VND',
    availableFrom: '2026-11-01',
    preferredLocations: ['Hà Nội', 'Remote'],
    preferredWorkModes: ['HYBRID', 'REMOTE'],
    skills: [{ skillName: 'React' }, { skillName: 'TypeScript' }],
    primaryCv: {
      cvId: 'cv-1',
      title: 'CV Fullstack 2026',
      fileName: 'cv_nguyen_van_a.pdf',
    },
  };

  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <CandidateProfilePage />
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('loads candidate profile from DB and renders career details', async () => {
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValueOnce(mockProfileData);

    renderComponent();

    // Check header
    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('4 năm kinh nghiệm')).toBeInTheDocument();

    // Check email is disabled
    const emailInput = await screen.findByDisplayValue('candidate@example.com');
    expect(emailInput).toBeDisabled();

    // Check primary CV card
    expect(screen.getByText('CV Fullstack 2026')).toBeInTheDocument();
  });

  it('submits form and calls mf04Api.updateProfile with 9 career fields', async () => {
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValueOnce(mockProfileData);
    const updateSpy = vi.spyOn(mf04Api, 'updateProfile').mockResolvedValueOnce({
      ...mockProfileData,
      targetRole: 'Staff Frontend Engineer',
    });

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Lưu thông tin hồ sơ vào Database/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Nguyễn Văn A',
          currentJobTitle: 'Senior React Developer',
          targetRole: 'Frontend Lead',
          currentLevel: 'Senior',
          expectedSalaryMin: 35000000,
          expectedSalaryMax: 50000000,
          expectedSalaryCurrency: 'VND',
        })
      );
    });
  });

  it('displays error message when DB updateProfile fails', async () => {
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValueOnce(mockProfileData);
    const errorSpy = vi.spyOn(message, 'error');
    vi.spyOn(mf04Api, 'updateProfile').mockRejectedValueOnce(
      new Error('Lỗi kết nối cơ sở dữ liệu')
    );

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Lưu thông tin hồ sơ vào Database/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Lỗi kết nối cơ sở dữ liệu');
    });
  });
});
