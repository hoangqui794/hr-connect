import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSettingsPage } from './AdminSettingsPage';
import { businessSettingsApi } from '@/services/api/financeApi';
import type { BusinessSetting } from '@/types/api/finance';

vi.mock('@/services/api/financeApi', () => ({
  businessSettingsApi: { list: vi.fn(), update: vi.fn() },
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

  it('shows each business number with its default and source', async () => {
    listMock.mockResolvedValue([dueDays]);

    renderPage();

    expect(await screen.findByText('Hạn thanh toán phí')).toBeTruthy();
    expect(screen.getByText(/Mặc định 20 ngày/)).toBeTruthy();
    expect(screen.getByText('Mặc định')).toBeTruthy();
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
