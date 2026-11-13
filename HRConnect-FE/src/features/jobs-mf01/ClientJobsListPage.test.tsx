/**
 * @file ClientJobsListPage.test.tsx
 * @description Client job cards say what is really going on: change-requested agreements, the posting
 * fee to pay, why a job is paused or closed, and no invented application progress.
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientJobsListPage } from './ClientJobsListPage';
import { screeningApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({ screeningApi: { counts: vi.fn() } }));
vi.mock('@/services/api/jobsApi', () => ({ jobsApi: { getById: vi.fn() } }));
vi.mock('./JobDetailPanel', () => ({
  JobDetailPanel: () => null,
  JobStatusTag: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('./PaymentDemoModal', () => ({ PaymentDemoModal: () => null }));

const jobs = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('./useJobQueries', async () => ({
  ...(await vi.importActual<typeof import('./useJobQueries')>('./useJobQueries')),
  useMyJobs: () => ({ isLoading: false, isFetching: false, isError: false, data: jobs.data, refetch: vi.fn() }),
  useJobDetail: () => ({ data: undefined, isLoading: false }),
  useJobMutations: () => {
    const m = { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() };
    return { close: m, pause: m, resume: m, submit: m };
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});

const job = (over: Record<string, unknown>) => ({
  jobId: Math.random().toString(36),
  title: 'Tin',
  status: 'ACTIVE',
  serviceTypeCode: 'CV_APPLICATION',
  quantity: 2,
  maxApplications: null,
  location: 'Hà Nội',
  updatedAt: new Date().toISOString(),
  concurrencyToken: 't',
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/client/jobs']}>
        <App>
          <ClientJobsListPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('ClientJobsListPage', () => {
  beforeEach(() => {
    vi.mocked(screeningApi.counts).mockResolvedValue({} as never);
  });

  it('shows a change-requested agreement with its reason instead of "ready to sign"', async () => {
    jobs.data = [
      job({ title: 'Đang chờ điều chỉnh', status: 'PENDING_AGREEMENT', serviceTypeCode: 'HEADHUNT_COD',
        agreementStatus: 'CHANGE_REQUESTED', agreementChangeRequestReason: 'Giảm hệ số phí xuống 1.5' }),
    ];
    renderPage();

    expect(await screen.findByText('Đã yêu cầu điều chỉnh · chờ HR Connect gửi lại hợp đồng')).toBeInTheDocument();
    expect(screen.getByText('Lý do: Giảm hệ số phí xuống 1.5')).toBeInTheDocument();
    expect(screen.queryByText('Hợp đồng dịch vụ sẵn sàng ký kết')).toBeNull();
  });

  it('states the posting fee to pay and why a job is paused or closed', async () => {
    jobs.data = [
      job({ title: 'Chờ phí', status: 'PENDING_PAYMENT', postingFee: { postingFeeId: 'f', amount: 1500000, currencyCode: 'VND', status: 'PENDING', paidAt: null, paymentReference: null, packageName: 'Tiêu chuẩn' } }),
      job({ title: 'Tạm dừng', status: 'PAUSED', statusReason: 'Đủ ứng viên vòng 1' }),
      job({ title: 'Đã đóng', status: 'CLOSED', statusReason: 'Đã tuyển đủ' }),
    ];
    renderPage();

    expect(await screen.findByText(/Chờ thanh toán phí đăng tin \(1\.500\.000/)).toBeInTheDocument();
    expect(screen.getByText('Lý do tạm dừng:')).toBeInTheDocument();
    expect(screen.getByText('Đủ ứng viên vòng 1')).toBeInTheDocument();
    expect(screen.getByText('Lý do đóng tin:')).toBeInTheDocument();
  });

  it('draws the application progress bar only when the job has a real cap', async () => {
    jobs.data = [
      job({ title: 'Có hạn mức', maxApplications: 20 }),
      job({ title: 'Không hạn mức', maxApplications: null }),
    ];
    vi.mocked(screeningApi.counts).mockResolvedValue({} as never);
    renderPage();

    const capped = (await screen.findByText('Có hạn mức')).closest('article') as HTMLElement;
    expect(capped.querySelector('[style*="width"]')).not.toBeNull();
    const uncapped = screen.getByText('Không hạn mức').closest('article') as HTMLElement;
    expect(uncapped.querySelector('[style*="width"]')).toBeNull();
  });

  it('only warns about jobs that expired recently', async () => {
    const day = 24 * 3_600_000;
    jobs.data = [
      job({ title: 'Hết hạn hôm qua', status: 'CLOSED', expiresAt: new Date(Date.now() - day).toISOString() }),
      job({ title: 'Hết hạn năm ngoái', status: 'CLOSED', expiresAt: new Date(Date.now() - 400 * day).toISOString() }),
    ];
    renderPage();

    expect(await screen.findByText('Bạn có 1 tin tuyển dụng đã hết hạn hiển thị')).toBeInTheDocument();
  });
});
