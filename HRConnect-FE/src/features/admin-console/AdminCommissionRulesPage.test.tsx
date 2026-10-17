import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCommissionRulesPage } from './AdminCommissionRulesPage';
import { adminCommissionApi, adminServiceTypesApi } from '@/services/api/adminApi';
import type { CommissionRule } from '@/types/api/admin';

vi.mock('@/services/api/adminApi', () => ({
  adminCommissionApi: {
    list: vi.fn(),
    setActive: vi.fn(),
    toggleActive: vi.fn(),
    updateStatus: vi.fn(),
    milestones: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
  adminServiceTypesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

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

const mockRules: CommissionRule[] = [
  {
    commissionRuleId: 'rule-active-1',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    serviceTypeName: 'Tuyển dụng trọn gói',
    name: 'Hoa hồng tuyển dụng tiêu chuẩn',
    milestoneType: 'ONBOARDED',
    milestoneName: 'Ứng viên nhận việc',
    rateType: 'PERCENT',
    rateValue: 18,
    warrantyRequired: true,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    commissionRuleId: 'rule-inactive-2',
    serviceTypeId: 'srv-2',
    serviceTypeCode: 'HEADHUNT',
    serviceTypeName: 'Headhunt cấp cao',
    name: 'Hoa hồng Headhunt cố định',
    milestoneType: 'PASSED_WARRANTY',
    milestoneName: 'Qua thời gian bảo hành',
    rateType: 'FIXED',
    rateValue: 15000000,
    warrantyRequired: true,
    effectiveFrom: '2026-02-01T00:00:00Z',
    effectiveTo: '2026-12-31T23:59:59Z',
    isActive: false,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const renderPage = (initialEntries = ['/admin/commission-rules']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App>
          <AdminCommissionRulesPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AdminCommissionRulesPage & Toggle Commission Rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially when query is in progress', () => {
    vi.mocked(adminCommissionApi.list).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('commission-rules-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(adminCommissionApi.list).mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('commission-rules-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Không tải được quy tắc hoa hồng')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối máy chủ')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(adminCommissionApi.list).mockResolvedValueOnce({
      items: mockRules,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Tuyển dụng trọn gói')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no commission rules matching filter', async () => {
    vi.mocked(adminCommissionApi.list).mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('commission-rules-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('Chưa có quy tắc hoa hồng nào phù hợp bộ lọc.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm quy tắc mới/i })).toBeInTheDocument();
  });

  it('renders commission rules list with switches reflecting active state', async () => {
    vi.mocked(adminCommissionApi.list).mockResolvedValueOnce({
      items: mockRules,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Tuyển dụng trọn gói')).toBeInTheDocument();
    });

    expect(screen.getByText('Headhunt cấp cao')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();

    // Check switches
    const switchActive = screen.getByTestId('commission-rule-switch-rule-active-1');
    const switchInactive = screen.getByTestId('commission-rule-switch-rule-inactive-2');

    expect(switchActive).toBeInTheDocument();
    expect(switchActive).toHaveAttribute('aria-checked', 'true');

    expect(switchInactive).toBeInTheDocument();
    expect(switchInactive).toHaveAttribute('aria-checked', 'false');
  });

  it('activates an inactive commission rule when switch is clicked', async () => {
    vi.mocked(adminCommissionApi.list).mockResolvedValue({
      items: mockRules,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
    vi.mocked(adminCommissionApi.setActive).mockResolvedValueOnce({
      success: true,
      message: 'Đã kích hoạt quy tắc hoa hồng.',
      data: {
        commissionRuleId: 'rule-inactive-2',
        isActive: true,
        updatedAt: '2026-10-17T00:00:00Z',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('commission-rule-switch-rule-inactive-2')).toBeInTheDocument();
    });

    const inactiveSwitch = screen.getByTestId('commission-rule-switch-rule-inactive-2');
    fireEvent.click(inactiveSwitch);

    await waitFor(() => {
      expect(adminCommissionApi.setActive).toHaveBeenCalledWith('rule-inactive-2', true);
    });
  });

  it('shows confirmation modal before deactivating an active rule', async () => {
    vi.mocked(adminCommissionApi.list).mockResolvedValue({
      items: mockRules,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
    vi.mocked(adminCommissionApi.setActive).mockResolvedValueOnce({
      success: true,
      message: 'Đã ngừng hiệu lực quy tắc hoa hồng.',
      data: {
        commissionRuleId: 'rule-active-1',
        isActive: false,
        updatedAt: '2026-10-17T00:00:00Z',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('commission-rule-switch-rule-active-1')).toBeInTheDocument();
    });

    const activeSwitch = screen.getByTestId('commission-rule-switch-rule-active-1');
    fireEvent.click(activeSwitch);

    // Modal confirmation should appear
    await waitFor(() => {
      expect(screen.getAllByText('Ngừng áp dụng quy tắc hoa hồng?')[0]).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Các tin tuyển dụng hoặc placement mới thuộc loại dịch vụ này sẽ không còn được tự động tính hoa hồng/i)
    ).toBeInTheDocument();

    // Confirm button in modal
    const confirmBtn = screen.getByRole('button', { name: 'Ngừng hiệu lực' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminCommissionApi.setActive).toHaveBeenCalledWith('rule-active-1', false);
    });
  });
});
