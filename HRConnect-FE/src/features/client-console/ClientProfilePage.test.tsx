import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientProfilePage } from './ClientProfilePage';
import { authService } from '@/services/authService';
import { companyProfileApi } from '@/services/api/hrApi';
import { userApi } from '@/services/api/userApi';
import { App as AntApp } from 'antd';

vi.mock('@/services/api/hrApi', () => ({
  companyProfileApi: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/userApi', () => ({
  userApi: {
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/components/common/AvatarUpload', () => ({
  AvatarUpload: () => <div data-testid="avatar-upload">AvatarUploadMock</div>,
}));

vi.mock('@/components/common/ChangePasswordModal', () => ({
  ChangePasswordModal: ({ open }: { open: boolean }) => (
    open ? <div data-testid="change-password-modal">ChangePasswordModalOpen</div> : null
  ),
}));

const mockUser = {
  success: true,
  data: {
    userId: 'user-client-123',
    email: 'hr.manager@techcorp.vn',
    displayName: 'Nguyễn Văn Đại Diện',
    phone: '0987654321',
    avatarUrl: 'https://cdn.example.com/avatar.jpg',
    status: 'ACTIVE',
    emailVerified: true,
    roles: ['CLIENT'],
  },
};

const mockCompany = {
  companyId: 'comp-123',
  companyName: 'TechCorp Vietnam',
  roleInCompany: 'Trưởng phòng Nhân sự',
  isPrimaryContact: true,
  taxCode: '0101234567',
  verificationStatus: 'VERIFIED',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/client/profile']}>
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <ClientProfilePage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('ClientProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.mocked(companyProfileApi.get).mockResolvedValue(mockCompany as any);
  });

  it('renders user details and company information correctly', async () => {
    renderPage();

    // Verify identity overview loads
    expect(await screen.findByText('Nguyễn Văn Đại Diện')).toBeTruthy();
    expect(screen.getByText('Trưởng phòng Nhân sự')).toBeTruthy();
    expect(screen.getByText('★ Liên hệ chính')).toBeTruthy();
    expect(screen.getByText('hr.manager@techcorp.vn')).toBeTruthy();
    expect(screen.getAllByText('TechCorp Vietnam').length).toBeGreaterThan(0);
  });

  it('opens change password modal when clicking password button', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Nguyễn Văn Đại Diện');
    const changePasswordButtons = screen.getAllByRole('button', { name: /đổi mật khẩu/i });
    await user.click(changePasswordButtons[0]);

    expect(await screen.findByTestId('change-password-modal')).toBeTruthy();
  });

  it('submits updated profile when form is saved', async () => {
    vi.mocked(userApi.updateProfile).mockResolvedValue({
      success: true,
      message: 'Cập nhật thành công',
      data: {
        userId: 'user-client-123',
        email: 'hr.manager@techcorp.vn',
        displayName: 'Trần Thị Tuyển Dụng',
        phone: '0912345678',
        avatarUrl: null,
        roleInCompany: 'Giám đốc Nhân sự',
      },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Nguyễn Văn Đại Diện');

    const nameInput = screen.getByDisplayValue('Nguyễn Văn Đại Diện');
    await user.clear(nameInput);
    await user.type(nameInput, 'Trần Thị Tuyển Dụng');

    const submitBtn = screen.getByRole('button', { name: /lưu thay đổi/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(userApi.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Trần Thị Tuyển Dụng',
        })
      );
    });
  });
});
