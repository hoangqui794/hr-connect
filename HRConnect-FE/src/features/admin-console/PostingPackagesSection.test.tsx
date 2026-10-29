import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostingPackagesSection } from './PostingPackagesSection';
import { postingPackagesAdminApi } from '@/services/api/financeApi';

vi.mock('@/services/api/financeApi', () => ({ postingPackagesAdminApi: { list: vi.fn(), update: vi.fn() } }));

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AntApp>
        <PostingPackagesSection />
      </AntApp>
    </QueryClientProvider>
  );

describe('PostingPackagesSection', () => {
  beforeEach(() => {
    vi.mocked(postingPackagesAdminApi.list).mockResolvedValue([
      { packageId: 'free', code: 'FREE', name: 'Gói Miễn Phí', description: null, price: 0, durationDays: 30, maxApplications: 50, isActive: true },
      { packageId: 'std', code: 'STANDARD', name: 'Gói Tiêu Chuẩn', description: 'AI chấm điểm', price: 1_500_000, durationDays: 30, maxApplications: null, isActive: false },
    ]);
    vi.mocked(postingPackagesAdminApi.update).mockImplementation(async (id, body) => ({ packageId: id, code: 'STANDARD', ...body }));
  });

  it('lists the AP packages with price, days, max CVs and status', async () => {
    renderSection();

    expect(await screen.findByText('Gói Tiêu Chuẩn')).toBeTruthy();
    expect(screen.getByText('Miễn phí')).toBeTruthy();
    expect(screen.getByText('1.500.000 ₫')).toBeTruthy();
    expect(screen.getByText('50 hồ sơ')).toBeTruthy();
    expect(screen.getByText('Không giới hạn')).toBeTruthy();
    expect(screen.getByText('Đã tắt')).toBeTruthy();
  });

  it('saves an edit with unlimited CVs as null', async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText('Sửa Gói Tiêu Chuẩn'));

    fireEvent.change(await screen.findByLabelText('Tên gói'), { target: { value: 'Gói Tiêu Chuẩn 90 ngày' } });
    fireEvent.click(screen.getByText('Lưu'));

    await waitFor(() => expect(postingPackagesAdminApi.update).toHaveBeenCalled(), { timeout: 5000 });
    expect(vi.mocked(postingPackagesAdminApi.update).mock.calls[0]).toEqual([
      'std',
      { name: 'Gói Tiêu Chuẩn 90 ngày', description: 'AI chấm điểm', price: 1_500_000, durationDays: 30, maxApplications: null, isActive: false },
    ]);
  });
});
