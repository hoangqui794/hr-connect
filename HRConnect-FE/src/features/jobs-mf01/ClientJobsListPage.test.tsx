/**
 * @file ClientJobsListPage.test.tsx
 * @description Client job cards say what is really going on: change-requested agreements, the posting
 * fee to pay, why a job is paused or closed, and no invented application progress.
 */
import { fireEvent, render, screen } from '@testing-library/react';
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
  JobStatusTag: ({ status, isChangeRequested }: { status: string; isChangeRequested?: boolean }) => (
    <span>{status === 'PENDING_AGREEMENT' && isChangeRequested ? 'DN yêu cầu sửa' : status}</span>
  ),
}));
vi.mock('./PaymentDemoModal', () => ({
  PaymentDemoModal: (props: any) =>
    props.visible ? (
      <div
        data-testid="payment-modal"
        data-job-id={props.jobId}
        data-job-title={props.jobTitle}
        data-is-deposit={String(props.isDeposit)}
        data-deposit-amount={String(props.depositAmount)}
        data-service-type={props.serviceTypeCode}
      >
        Modal: {props.jobTitle}
      </div>
    ) : null,
}));

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

const renderPage = (initialEntries = ['/client/jobs']) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={initialEntries}>
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

  it('shows when a job was sent for review, and the issued deposit with its due date', async () => {
    jobs.data = [
      job({ title: 'Chờ duyệt', status: 'PENDING_REVIEW', submittedAt: '2026-11-12T03:30:00Z' }),
      job({ title: 'Chờ cọc', status: 'PENDING_PAYMENT', serviceTypeCode: 'CV_SOURCING', depositAmount: 3_000_000,
        paymentDueAt: '2026-11-20', commercialTerms: { sourcingTarget: 10, pricePerCv: 500_000, depositPercent: 30 } }),
    ];
    renderPage();

    expect(await screen.findByText(/^Gửi duyệt lúc /)).toBeInTheDocument();
    // The deposit BE issued (3.000.000) wins over the estimate from the terms (1.500.000).
    expect(screen.getByText(/3\.000\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/1\.500\.000/)).toBeNull();
    expect(screen.getByText('Hạn nộp cọc 20/11/2026')).toBeInTheDocument();
  });

  it('passes isChangeRequested to JobStatusTag and displays applicationDeadline and expiresAt', async () => {
    jobs.data = [
      job({
        title: 'Senior Go',
        status: 'PENDING_AGREEMENT',
        agreementStatus: 'CHANGE_REQUESTED',
        applicationDeadline: '2026-11-25T00:00:00Z',
        expiresAt: '2026-12-15T00:00:00Z',
      }),
    ];
    renderPage();

    expect(await screen.findByText('DN yêu cầu sửa')).toBeInTheDocument();
    expect(screen.getByText('Hạn nộp: 25/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Hết hạn tin: 15/12/2026')).toBeInTheDocument();
  });

  it('opens payment modal with isDeposit=true and depositAmount when deep-linked with openPayment for CV_SOURCING', async () => {
    jobs.data = [
      job({
        jobId: 'job-sourcing-deposit',
        title: 'Tuyển ReactJS gấp',
        status: 'PENDING_PAYMENT',
        serviceTypeCode: 'CV_SOURCING',
        depositAmount: 5_000_000,
      }),
    ];

    renderPage(['/client/jobs?highlight=job-sourcing-deposit&openPayment=true']);

    const modal = await screen.findByTestId('payment-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-job-id')).toBe('job-sourcing-deposit');
    expect(modal.getAttribute('data-is-deposit')).toBe('true');
    expect(modal.getAttribute('data-deposit-amount')).toBe('5000000');
    expect(modal.getAttribute('data-service-type')).toBe('CV_SOURCING');
  });

  it('opens payment modal with isDeposit=false when deep-linked with openPayment for CV_APPLICATION', async () => {
    jobs.data = [
      job({
        jobId: 'job-posting-fee',
        title: 'Tuyển Golang',
        status: 'PENDING_PAYMENT',
        serviceTypeCode: 'CV_APPLICATION',
        postingFee: {
          postingFeeId: 'f1',
          amount: 1_500_000,
          currencyCode: 'VND',
          status: 'PENDING',
          paidAt: null,
          paymentReference: null,
          packageName: 'Tiêu chuẩn',
        },
      }),
    ];

    renderPage(['/client/jobs?highlight=job-posting-fee&openPayment=true']);

    const modal = await screen.findByTestId('payment-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-job-id')).toBe('job-posting-fee');
    expect(modal.getAttribute('data-is-deposit')).toBe('false');
    expect(modal.getAttribute('data-service-type')).toBe('CV_APPLICATION');
  });
it('opens close modal with tailored description and filtered reasons for PENDING_PAYMENT job', async () => {
    jobs.data = [
      job({
        jobId: 'job-pending-pay',
        title: 'Tin chờ thanh toán',
        status: 'PENDING_PAYMENT',
      }),
    ];

    renderPage();

    const moreBtn = await screen.findByRole('button', { name: 'Thao tác khác cho Tin chờ thanh toán' });
    fireEvent.click(moreBtn);

    const closeMenuItem = await screen.findByText('Đóng tin');
    fireEvent.click(closeMenuItem);

    expect(
      await screen.findByText('Tin chưa thanh toán sẽ được hủy và các khoản phí/cọc chờ thanh toán đi kèm sẽ được hủy tự động.')
    ).toBeInTheDocument();
    expect(screen.getByText('Doanh nghiệp dừng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Lý do khác')).toBeInTheDocument();
    expect(screen.queryByText('Đã tuyển đủ người')).toBeNull();
    expect(screen.queryByText('Hết hạn đăng tin')).toBeNull();
  });

  it('filters jobs in real-time when searching by title or keyword', async () => {
    jobs.data = [
      job({ jobId: 'j-1', title: 'Lập trình viên React Frontend' }),
      job({ jobId: 'j-2', title: 'Kỹ sư Backend Golang' }),
    ];

    renderPage();

    expect(await screen.findByText('Lập trình viên React Frontend')).toBeInTheDocument();
    expect(screen.getByText('Kỹ sư Backend Golang')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Tìm theo tiêu đề, địa điểm, gói dịch vụ...');
    fireEvent.change(searchInput, { target: { value: 'React' } });

    expect(screen.getByText('Lập trình viên React Frontend')).toBeInTheDocument();
    expect(screen.queryByText('Kỹ sư Backend Golang')).toBeNull();
    expect(screen.getByText(/Tìm thấy/)).toBeInTheDocument();
  });

  it('paginates jobs in grid view when total count exceeds 9 items', async () => {
    jobs.data = Array.from({ length: 11 }, (_, i) =>
      job({ jobId: `job-${i + 1}`, title: `Vị trí tuyển dụng số ${i + 1}` })
    );

    renderPage();

    expect(await screen.findByText('Vị trí tuyển dụng số 1')).toBeInTheDocument();
    expect(screen.getByText('Vị trí tuyển dụng số 9')).toBeInTheDocument();
    // 10th item is on page 2
    expect(screen.queryByText('Vị trí tuyển dụng số 10')).toBeNull();

    expect(screen.getByText('Hiển thị 1 - 9 trong tổng số 11 tin')).toBeInTheDocument();
  });
});
