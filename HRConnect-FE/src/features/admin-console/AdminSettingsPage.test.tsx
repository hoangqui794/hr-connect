import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSettingsPage } from './AdminSettingsPage';
import { businessSettingsApi } from '@/services/api/financeApi';
import type { BusinessSetting } from '@/types/api/finance';

vi.mock('@/services/api/financeApi', () => ({
  businessSettingsApi: { list: vi.fn(), update: vi.fn() },
  postingPackagesAdminApi: { list: vi.fn().mockResolvedValue([]), update: vi.fn() },
}));

const listMock = vi.mocked(businessSettingsApi.list);
const updateMock = vi.mocked(businessSettingsApi.update);

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

const dueDays: BusinessSetting = {
  key: 'mf05.headhunt.payment_due_days',
  group: 'HEADHUNT_COD',
  label: 'Hạn thanh toán phí',
  description: 'Số ngày Client phải trả phí.',
  type: 'INTEGER',
  value: 20,
  defaultValue: 20,
  min: 1,
  max: 120,
  unit: 'ngày',
  source: 'HEADHUNT_COD model, mục 8',
  isOverridden: false,
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App>
        <AdminSettingsPage />
      </App>
    </QueryClientProvider>
  );

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    updateMock.mockReset();
  });

  it('names groups by service and marks values still at their default', async () => {
    listMock.mockResolvedValue([dueDays]);

    renderPage();

    expect(await screen.findByText('Hạn thanh toán phí')).toBeTruthy();
    expect(screen.getAllByText('Tuyển dụng theo kết quả').length).toBeGreaterThan(0);
    expect(screen.getByText('Mặc định')).toBeTruthy();
  });

  it('shows who changed a value and restores the default in one click', async () => {
    listMock.mockResolvedValue([
      { ...dueDays, value: 30, isOverridden: true, updatedAt: '2026-10-30T07:20:00Z', updatedByName: 'admin@gmail.com' },
    ]);
    updateMock.mockResolvedValue(dueDays);

    renderPage();

    expect(await screen.findByText(/Đã đổi · mặc định 20 ngày/)).toBeTruthy();
    expect(screen.getByText(/Sửa bởi admin@gmail.com lúc/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục mặc định Hạn thanh toán phí' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('mf05.headhunt.payment_due_days', 20));
  });

  it('filters settings by search text and by "only changed"', async () => {
    const reminder: BusinessSetting = { ...dueDays, key: 'mf05.fee.reminder_days', group: 'SERVICE_FEE', label: 'Số ngày nhắc trước hạn', isOverridden: true, value: 5, defaultValue: 3 };
    listMock.mockResolvedValue([dueDays, reminder]);

    renderPage();
    await screen.findByText('Hạn thanh toán phí');

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm cài đặt' }), { target: { value: 'nhắc' } });
    expect(screen.queryByText('Hạn thanh toán phí')).toBeNull();
    expect(screen.getByText('Số ngày nhắc trước hạn')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm cài đặt' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Chỉ mục đã đổi' }));
    expect(screen.queryByText('Hạn thanh toán phí')).toBeNull();
    expect(screen.getByText('Số ngày nhắc trước hạn')).toBeTruthy();
  });

  it('saves a new value through the API', async () => {
    listMock.mockResolvedValue([dueDays]);
    updateMock.mockResolvedValue({ ...dueDays, value: 30, isOverridden: true });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa Hạn thanh toán phí' }));
    const input = await screen.findByRole('spinbutton', { name: 'Hạn thanh toán phí' });
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('mf05.headhunt.payment_due_days', 30));
  });
});
