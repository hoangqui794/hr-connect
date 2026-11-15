import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientBillingPage, feeBreakdown } from './ClientBillingPage';
import { financeApi, vnPayApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';

vi.mock('@/services/api/financeApi', () => ({
  financeApi: { serviceFees: vi.fn(), serviceFeesSummary: vi.fn() },
  vnPayApi: { enabled: vi.fn(), createPayment: vi.fn() },
}));
vi.mock('@/services/api/jobsApi', () => ({ jobsApi: { getMine: vi.fn(), getPostingFee: vi.fn() } }));

const fee = (over: Record<string, unknown>) => ({
  serviceFeeId: 'f', placementId: null, companyId: 'co', jobTitle: 'Tin', candidateName: null, baseSalary: 0,
  feeMultiplier: 0, amount: 0, currencyCode: 'VND', dueDate: '2026-11-01', status: 'PENDING', createdAt: '2026-10-01', ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AntApp>
          <ClientBillingPage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('ClientBillingPage', () => {
  beforeEach(() => {
    vi.mocked(financeApi.serviceFeesSummary).mockResolvedValue(null as never);
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({ serviceFeeId: 'hh', kind: 'PLACEMENT', jobTitle: 'Backend .NET', candidateName: 'qui3', amount: 42_000_000, status: 'OVERDUE' }),
        fee({ serviceFeeId: 'ss', kind: 'DEPOSIT', jobTitle: 'Kế toán tổng hợp', amount: 200_000, status: 'PAID', paidAt: '2026-10-20', paymentReference: 'HRC-1' }),
      ],
      totalCount: 2, page: 1, pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([
      { jobId: 'j-ap', title: 'Lập trình viên .NET', serviceTypeCode: 'CV_APPLICATION', postingFeeStatus: 'PENDING', postingPackageCode: 'STANDARD' },
      { jobId: 'j-free', title: 'Tin miễn phí', serviceTypeCode: 'CV_APPLICATION', postingFeeStatus: 'PAID', postingPackageCode: 'FREE' },
    ] as never);
    vi.mocked(jobsApi.getPostingFee).mockResolvedValue({
      postingFeeId: 'pf', jobId: 'j-ap', packageId: 'p', packageCode: 'STANDARD', packageName: 'Gói tiêu chuẩn',
      amount: 1_500_000, currencyCode: 'VND', status: 'PENDING', paidAt: null, paymentReference: null,
      activatedAt: null, expiresAt: null, createdAt: '2026-10-01',
    });
  });

  // HR feedback 28/10: one place for the fees of all three services.
  it('lists Headhunt, Sourcing and paid posting fees with totals', async () => {
    renderPage();

    expect(await screen.findByText('Backend .NET')).toBeTruthy();
    expect(await screen.findByText('Lập trình viên .NET')).toBeTruthy();
    expect(screen.getByText('Kế toán tổng hợp')).toBeTruthy();
    expect(screen.queryByText('Tin miễn phí')).toBeNull();
    expect(jobsApi.getPostingFee).toHaveBeenCalledTimes(1);

    // Cần thanh toán = 42.000.000 (overdue) + 1.500.000 (posting fee pending)
    expect(screen.getByText(/43\.500\.000/)).toBeTruthy();
    expect(screen.getByText('2 khoản chưa thanh toán')).toBeTruthy();
    expect(screen.getByText('1 khoản quá hạn')).toBeTruthy();
  });

  // C-07: GET /jobs/mine carries the posting fee, so no request per job.
  it('reads the posting fee from the job list without asking each job', async () => {
    vi.mocked(jobsApi.getMine).mockResolvedValue([
      {
        jobId: 'j-ap', title: 'Lập trình viên .NET', serviceTypeCode: 'CV_APPLICATION', postingFeeStatus: 'PAID', postingPackageCode: 'STANDARD',
        postingFee: { postingFeeId: 'pf', amount: 1_500_000, currencyCode: 'VND', status: 'PAID', paidAt: '2026-10-05', paymentReference: 'VNP-1', packageName: 'Gói tiêu chuẩn' },
      },
    ] as never);
    renderPage();

    expect(await screen.findByText('Lập trình viên .NET')).toBeTruthy();
    expect(jobsApi.getPostingFee).not.toHaveBeenCalled();
  });

  it('shows a replacement refund as money back, never as something to pay', async () => {
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [fee({ serviceFeeId: 'rf', kind: 'REPLACEMENT_REFUND', jobTitle: 'QA Lead', candidateName: 'Trương Hoàng Quí', baseSalary: 30_000_000, feeMultiplier: 0.3, amount: 9_000_000, status: 'PENDING', dueDate: '2026-11-13', replacementExpiredAt: '2026-11-11T00:00:00Z' })],
      totalCount: 1, page: 1, pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([] as never);
    renderPage();

    expect((await screen.findAllByText('Hoàn phí do không tìm được người thay')).length).toBeGreaterThan(0);
    // Says who left, why, and the real share from the row, and that the date is HR Connect's deadline.
    expect(screen.getByText('Trương Hoàng Quí')).toBeInTheDocument();
    expect(screen.getByText('Suất thay thế hết hạn ngày 11/11/2026 mà chưa có ứng viên nào. HR Connect hoàn 30% phí đã trả.')).toBeInTheDocument();
    expect(screen.getByText((t) => t.includes('trước 13/11/2026'))).toBeInTheDocument();
    expect(screen.getByText('Chờ hoàn tiền')).toBeInTheDocument();
    expect(screen.getByText('HR Connect cần hoàn')).toBeInTheDocument();
    expect(screen.getByText('1 khoản chờ hoàn tiền')).toBeInTheDocument();
    expect(screen.getByText('0 khoản chưa thanh toán')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Thanh toán/ })).not.toBeInTheDocument();
  });

  it('filters by service, named in Vietnamese instead of HH / SS / AP', async () => {
    renderPage();
    await screen.findByText('Lập trình viên .NET');

    const services = within(screen.getByRole('radiogroup', { name: 'Lọc theo dịch vụ' }));
    expect(services.queryByRole('radio', { name: /^(HH|SS|AP)\b/ })).toBeNull();
    expect(screen.queryByText('Tuyển qua Affiliate')).toBeNull();
    expect(screen.queryByText('Mua CV theo số lượng')).toBeNull();
    fireEvent.click(services.getByRole('radio', { name: /^Tìm hồ sơ phù hợp/ }));

    expect(screen.getByText('Kế toán tổng hợp')).toBeTruthy();
    expect(screen.queryByText('Backend .NET')).toBeNull();
    expect(screen.queryByText('Lập trình viên .NET')).toBeNull();
  });

  it('offers payment for an unpaid fee only, with transfer details as the fallback', async () => {
    vi.mocked(vnPayApi.enabled).mockResolvedValue(false);
    renderPage();
    await screen.findByText('Lập trình viên .NET');

    // HH overdue + AP posting fee are payable; the paid SS deposit is not.
    expect(screen.getAllByRole('button', { name: /^Thanh toán:/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Kế toán tổng hợp/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán: Gói đăng tin · Gói tiêu chuẩn · Lập trình viên .NET' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1\.500\.000/)).toBeTruthy();
    expect(within(dialog).getByText('0988776655')).toBeTruthy();
    expect(within(dialog).getByText('HRC J-AP')).toBeTruthy();
    // VNPay is off: no VNPay button, and never an "I have paid" button.
    expect(within(dialog).queryByRole('button', { name: /VNPay/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /đã thanh toán/i })).toBeNull();
  });

  it('explains a Sourcing deposit and settlement as CVs × price per CV', () => {
    const deposit = feeBreakdown(fee({ kind: 'DEPOSIT', baseSalary: 6_000_000, feeMultiplier: 0.2, amount: 1_200_000, sourcingTarget: 6, sourcingPricePerCv: 1_000_000 }) as never);
    expect(deposit.map((l) => l.label)).toEqual(['Số CV đặt mua', 'Đơn giá mỗi CV', 'Tổng giá trị gói', 'Tỷ lệ đặt cọc']);
    expect(deposit[0].value).toBe('6 CV');
    expect(deposit[3].value).toBe('20%');

    const settlement = feeBreakdown(fee({ kind: 'SETTLEMENT', baseSalary: 5_000_000, feeMultiplier: 1, amount: 3_800_000, sourcingPricePerCv: 1_000_000 }) as never);
    expect(settlement[0].value).toMatch(/^5 CV × 1\.000\.000/);
    expect(settlement[2].value).toMatch(/^− 1\.200\.000/);
  });

  it('shows counted vs target CV progress on CV_SOURCING billing rows and deposit breakdown', async () => {
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({
          serviceFeeId: 'ss-progress',
          kind: 'DEPOSIT',
          jobTitle: 'Kế toán kho',
          baseSalary: 50_000_000,
          feeMultiplier: 0.5,
          amount: 25_000_000,
          sourcingTarget: 50,
          sourcingPricePerCv: 1_000_000,
          sourcingCounted: 3,
          status: 'PAID',
        }),
      ],
      totalCount: 1, page: 1, pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([] as never);

    renderPage();

    expect(await screen.findByText('Kế toán kho')).toBeTruthy();
    expect(screen.getByText('3/50 CV')).toBeTruthy();

    const deposit = feeBreakdown(fee({
      kind: 'DEPOSIT',
      baseSalary: 50_000_000,
      feeMultiplier: 0.5,
      amount: 25_000_000,
      sourcingTarget: 50,
      sourcingPricePerCv: 1_000_000,
      sourcingCounted: 3,
    }) as never);
    expect(deposit.find((l) => l.label === 'Đã nhận CV')?.value).toBe('3/50 CV');
  });

  it('sends the Client to VNPay for the chosen fee', async () => {
    vi.mocked(vnPayApi.enabled).mockResolvedValue(true);
    vi.mocked(vnPayApi.createPayment).mockResolvedValue({ onlinePaymentId: 'op', paymentUrl: 'https://sandbox.vnpayment.vn/pay?x=1' });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderPage();
    await screen.findByText('Backend .NET');

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán: Phí tuyển thành công · Backend .NET' }));
    // The VNPay button waits for the "is VNPay on" query; CI runners are slow, so allow more than the 1s default.
    fireEvent.click(await screen.findByRole('button', { name: /Thanh toán qua VNPay/ }, { timeout: 5000 }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://sandbox.vnpayment.vn/pay?x=1'), { timeout: 5000 });
    expect(vnPayApi.createPayment).toHaveBeenCalledWith('SERVICE_FEE', 'hh');
    vi.unstubAllGlobals();
  }, 15000);

  it('orders billing columns as Tin tuyển dụng, Dịch vụ, Khoản phí, Số tiền, Hạn thanh toán, Trạng thái, Thao tác', async () => {
    renderPage();
    await screen.findByText('Backend .NET');

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual(['Tin tuyển dụng', 'Dịch vụ', 'Khoản phí', 'Số tiền', 'Hạn thanh toán', 'Trạng thái', 'Thao tác']);
  });

  it('explains HEADHUNT_COD multiplier as months of salary, shows createdAt/placementId and reconciliation reason', async () => {
    const placementBreakdown = feeBreakdown(
      fee({ kind: 'PLACEMENT', baseSalary: 30_000_000, feeMultiplier: 1.5, amount: 45_000_000 }) as never
    );
    expect(placementBreakdown).toEqual([
      { label: 'Lương gross tháng', value: '30.000.000 đ' },
      { label: 'Hệ số phí', value: '1.5 tháng lương' },
    ]);

    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({
          serviceFeeId: 'rec-pending',
          kind: 'PLACEMENT',
          placementId: 'abcd1234-5678-90ab-cdef-111122223333',
          jobTitle: 'Tech Lead',
          candidateName: 'Nguyễn Văn A',
          amount: 45_000_000,
          status: 'PENDING',
          reconciliationStatus: 'PENDING',
          createdAt: '2026-10-15T08:00:00Z',
        }),
        fee({
          serviceFeeId: 'rec-flagged',
          kind: 'PLACEMENT',
          jobTitle: 'Product Owner',
          amount: 35_000_000,
          status: 'DUE',
          reconciliationStatus: 'FLAGGED',
          createdAt: '2026-10-16T08:00:00Z',
        }),
      ],
      totalCount: 5,
      page: 1,
      pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([] as never);

    renderPage();

    expect(await screen.findByText('Tech Lead')).toBeInTheDocument();
    expect(screen.getByText('Lập 15/10/2026')).toBeInTheDocument();
    expect(screen.getByText('#ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận ngày đi làm thực tế')).toBeInTheDocument();
    expect(screen.getByText('Đang rà soát sai lệch đối soát')).toBeInTheDocument();
    expect(screen.getByText('Đang hiển thị 2/5 khoản phí dịch vụ gần nhất.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Thanh toán:/ })).toBeNull();
  });

  it('does not treat an already PAID fee with stale reconciliationStatus as reconciling', async () => {
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({
          serviceFeeId: 'paid-stale-rec',
          kind: 'PLACEMENT',
          jobTitle: 'Senior QA',
          amount: 25_000_000,
          status: 'PAID',
          paidAt: '2026-10-25T10:00:00Z',
          paymentReference: 'VNP-999',
          reconciliationStatus: 'PENDING',
        }),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([] as never);

    renderPage();

    expect(await screen.findByText('Senior QA')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Đã thanh toán')).toBeInTheDocument();
    expect(screen.queryByText('Đang đối soát')).toBeNull();
    expect(screen.queryByText('Chờ xác nhận ngày đi làm thực tế')).toBeNull();
  });

  it('renders serviceTypeCode, BE daysOverdue, links placementId, and blocks duplicate payment while transfer/VNPay is pending', async () => {
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({
          serviceFeeId: 'fee-transfer-submitted',
          kind: 'DEPOSIT',
          serviceTypeCode: 'CV_SOURCING',
          jobTitle: 'Frontend React',
          amount: 4_000_000,
          status: 'DUE',
          dueDate: '2026-10-20',
          paymentSubmittedAt: '2026-11-12T08:00:00Z',
        }),
        fee({
          serviceFeeId: 'fee-vnpay-pending',
          kind: 'PLACEMENT',
          placementId: 'bcdef123-0000-0000-0000-000000000001',
          serviceTypeCode: 'HEADHUNT_COD',
          jobTitle: 'DevOps Lead',
          amount: 28_000_000,
          status: 'OVERDUE',
          daysOverdue: 9,
          dueDate: '2026-11-01',
          pendingOnlinePayment: true,
        }),
      ],
      totalCount: 2,
      page: 1,
      pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([] as never);

    renderPage();

    expect(await screen.findByText('Frontend React')).toBeInTheDocument();
    expect(screen.getByText('Quá hạn 9 ngày')).toBeInTheDocument();
    expect(screen.getByText(/Đã báo chuyển khoản – chờ xác nhận \(12\/11\/2026\)/)).toBeInTheDocument();
    expect(screen.getByText('VNPay đang xử lý')).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('VNPay chờ XL')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Xem chi tiết nhận việc #BCDEF123' });
    expect(link).toHaveAttribute('href', '/client/placements/bcdef123-0000-0000-0000-000000000001');
    expect(screen.queryByRole('button', { name: /^Thanh toán:/ })).toBeNull();
  });

  it('uses full GET /service-fees/summary totals combined with posting fees when totalCount exceeds loaded page', async () => {
    vi.mocked(financeApi.serviceFeesSummary).mockResolvedValue({
      unpaidAmount: 150_000_000,
      unpaidCount: 12,
      overdueAmount: 60_000_000,
      overdueCount: 4,
      paidAmount: 420_000_000,
      paidCount: 110,
      pendingRefundAmount: 18_000_000,
      pendingRefundCount: 2,
      paidRefundAmount: 0,
      paidRefundCount: 0,
      totalCount: 124,
      currencyCode: 'VND',
    });
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [fee({ serviceFeeId: 'hh-1', kind: 'PLACEMENT', jobTitle: 'Architect', amount: 40_000_000, status: 'PENDING' })],
      totalCount: 124,
      page: 1,
      pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([
      {
        jobId: 'j-ap-1',
        title: 'AP Job',
        serviceTypeCode: 'CV_APPLICATION',
        postingFeeStatus: 'PENDING',
        postingPackageCode: 'PRO',
        postingFee: {
          postingFeeId: 'pf-1',
          amount: 1_000_000,
          currencyCode: 'VND',
          status: 'PENDING',
          paidAt: null,
          paymentReference: null,
          packageName: 'Pro',
        },
      },
    ] as never);

    renderPage();

    expect(await screen.findByText('Architect')).toBeInTheDocument();
    expect(screen.getByText('151.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('13 khoản chưa thanh toán')).toBeInTheDocument();
    expect(screen.getByText('60.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('4 khoản quá hạn')).toBeInTheDocument();
    expect(screen.getByText('420.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('110 khoản')).toBeInTheDocument();
    expect(screen.getByText('18.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('2 khoản chờ hoàn tiền')).toBeInTheDocument();
    expect(screen.getByText('125 khoản phí')).toBeInTheDocument();
    expect(screen.getByText(/Số liệu KPI đã tổng hợp toàn bộ hệ thống/)).toBeInTheDocument();
  });

  it('matches summary currency breakdown counts, filters posting counts by currency, and hides overdue days while reconciling', async () => {
    vi.mocked(financeApi.serviceFeesSummary).mockResolvedValue({
      unpaidAmount: 10_000_000,
      unpaidCount: 1,
      overdueAmount: 0,
      overdueCount: 0,
      paidAmount: 0,
      paidCount: 0,
      pendingRefundAmount: 0,
      pendingRefundCount: 0,
      paidRefundAmount: 0,
      paidRefundCount: 0,
      totalCount: 3,
      currencyCode: 'VND',
      currencyBreakdowns: [
        {
          currencyCode: 'VND',
          unpaidAmount: 10_000_000,
          unpaidCount: 1,
          overdueAmount: 0,
          overdueCount: 0,
          paidAmount: 0,
          paidCount: 0,
          pendingRefundAmount: 0,
          pendingRefundCount: 0,
          paidRefundAmount: 0,
          paidRefundCount: 0,
        },
        {
          currencyCode: 'USD',
          unpaidAmount: 500,
          unpaidCount: 2,
          overdueAmount: 0,
          overdueCount: 0,
          paidAmount: 0,
          paidCount: 0,
          pendingRefundAmount: 0,
          pendingRefundCount: 0,
          paidRefundAmount: 0,
          paidRefundCount: 0,
        },
      ],
    });
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({
          serviceFeeId: 'fee-reconcile-overdue',
          jobTitle: 'Solution Architect',
          amount: 10_000_000,
          status: 'OVERDUE',
          daysOverdue: 7,
          dueDate: '2026-10-01',
          reconciliationStatus: 'PENDING',
        }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([
      {
        jobId: 'j-ap-usd',
        title: 'AP USD Job',
        serviceTypeCode: 'CV_APPLICATION',
        postingFeeStatus: 'PENDING',
        postingPackageCode: 'PRO',
        postingFee: {
          postingFeeId: 'pf-usd',
          amount: 100,
          currencyCode: 'USD',
          status: 'PENDING',
          paidAt: null,
          paymentReference: null,
          packageName: 'Pro',
        },
      },
    ] as never);

    renderPage();

    expect(await screen.findByText('Solution Architect')).toBeInTheDocument();
    expect(screen.getByText('1 khoản chưa thanh toán')).toBeInTheDocument();
    expect(screen.getByText('4 khoản phí')).toBeInTheDocument();
    expect(screen.queryByText('Quá hạn 7 ngày')).toBeNull();
  });
});
