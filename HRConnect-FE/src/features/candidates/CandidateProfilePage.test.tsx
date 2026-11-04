import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mf04Api } from '@/services/api/mf04Api';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { CandidateProfilePage } from './CandidateProfilePage';

vi.mock('@/hooks/useSavedJobs', () => ({ useSavedJobs: () => ({ savedJobsCount: 0 }) }));

const profile = {
  candidateId: 'cand-1',
  fullName: 'Nguyễn Văn A',
  email: 'candidate@example.com',
  phone: '0987654321',
  dateOfBirth: '1999-01-02',
  gender: 'MALE',
  currentAddress: 'Hà Nội',
  highestEducation: 'Đại học',
  yearsOfExperience: 4,
  summary: 'Kỹ sư phần mềm',
  profileVisibility: 'PUBLIC',
  currentJobTitle: 'Senior React Developer',
  currentLevel: 'Senior',
  targetRole: 'Frontend Lead',
  expectedSalaryMin: 35_000_000,
  expectedSalaryMax: 50_000_000,
  expectedSalaryCurrency: 'VND',
  availableFrom: '2099-11-01',
  preferredLocations: ['Hà Nội'],
  preferredWorkModes: ['HYBRID', 'Giờ giấc linh hoạt'],
  skills: [{ skillId: 's1', skillName: 'React', proficiencyLevel: 'ADVANCED', yearsOfExperience: 3 }],
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AntApp><CandidateProfilePage /></AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('CandidateProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValue(profile);
    vi.spyOn(candidateApplicationsApi, 'list').mockResolvedValue({ items: [], page: 1, pageSize: 1, total: 0, totalPages: 0 });
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.CANDIDATE,
      user: { id: 'u1', name: 'Nguyễn Văn A', email: 'candidate@example.com', role: UserRole.CANDIDATE, roles: [UserRole.CANDIDATE], permissions: [] },
    });
  });

  it('shows the saved profile with a read-only email and skills', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
    expect(screen.getByText('Senior React Developer · 4 năm kinh nghiệm · Hà Nội')).toBeInTheDocument();
    expect(screen.getByDisplayValue('candidate@example.com')).toHaveAttribute('readonly');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Thành thạo')).toBeInTheDocument();
    expect(screen.getByLabelText('Công khai hồ sơ', { exact: false })).toBeChecked();
  });

  it('saves in full VND and keeps fields it has no control for', async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(mf04Api, 'updateProfile').mockResolvedValue(profile);
    renderPage();

    const min = await screen.findByLabelText('Tối thiểu');
    expect(min).toHaveValue(35);
    await user.clear(min);
    await user.type(min, '40');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Nguyễn Văn A',
      expectedSalaryMin: 40_000_000,
      expectedSalaryMax: 50_000_000,
      expectedSalaryCurrency: 'VND',
      dateOfBirth: '1999-01-02',
      gender: 'MALE',
      preferredWorkModes: 'HYBRID, Giờ giấc linh hoạt',
    })));
  });

  it('stops before saving when a field is invalid', async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(mf04Api, 'updateProfile').mockResolvedValue(profile);
    renderPage();

    const max = await screen.findByLabelText('Tối đa');
    await user.clear(max);
    await user.type(max, '10');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    expect(await screen.findByText('Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('shows the reason when the backend refuses to save', async () => {
    const user = userEvent.setup();
    vi.spyOn(mf04Api, 'updateProfile').mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    renderPage();

    await screen.findByRole('heading', { name: 'Nguyễn Văn A' });
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    expect(await screen.findByText(/Lỗi kết nối cơ sở dữ liệu|Không lưu được hồ sơ/)).toBeInTheDocument();
  });

  it('puts back the saved values when changes are cancelled', async () => {
    const user = userEvent.setup();
    renderPage();

    const address = await screen.findByLabelText('Địa chỉ hiện tại');
    await user.clear(address);
    await user.type(address, 'Đà Nẵng');
    await user.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));

    expect(address).toHaveValue('Hà Nội');
  });
});
