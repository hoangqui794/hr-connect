import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import dayjs from 'dayjs';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientServiceAgreementsPage } from './ClientServiceAgreementsPage';
import type { Job, ServiceAgreementDto } from '@/types/api/jobs';

const useMyJobsMock = vi.fn();
const useCurrentServiceAgreementMock = vi.fn();
const useServiceAgreementHistoryMock = vi.fn();

vi.mock('@/features/jobs-mf01/useJobQueries', async () => {
  const actual = await vi.importActual<typeof import('@/features/jobs-mf01/useJobQueries')>(
    '@/features/jobs-mf01/useJobQueries'
  );
  return {
    ...actual,
    useMyJobs: () => useMyJobsMock(),
    useCurrentServiceAgreement: (...args: unknown[]) => useCurrentServiceAgreementMock(...args),
    useServiceAgreementHistory: (...args: unknown[]) => useServiceAgreementHistoryMock(...args),
  };
});

vi.mock('@/features/jobs-mf01/PaymentDemoModal', () => ({ PaymentDemoModal: () => null }));

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

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const makeJob = (over: Partial<Job>): Job => ({
  jobId: 'job-1',
  companyId: 'comp-1',
  companyName: 'Công ty Công nghệ ABC',
  serviceTypeId: 'svc-1',
  serviceTypeCode: 'HEADHUNT_COD',
  title: 'Senior .NET Engineer',
  description: null,
  benefits: null,
  location: 'TP.HCM',
  workingTime: null,
  employmentType: 'FULL_TIME',
  salaryMin: 20_000_000,
  salaryMax: 30_000_000,
  salaryNegotiable: false,
  salaryNote: null,
  minExperienceYears: 3,
  maxExperienceYears: 6,
  currencyCode: 'VND',
  quantity: 1,
  status: 'ACTIVE',
  statusReason: null,
  postedAt: null,
  closedAt: null,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-10T08:00:00Z',
  concurrencyToken: 'tok-job',
  requirements: [],
  skills: [],
  statusHistories: [],
  ...over,
});

const makeAgreement = (over: Partial<ServiceAgreementDto>): ServiceAgreementDto => ({
  serviceAgreementId: 'sa-1',
  jobId: 'job-1',
  companyId: 'comp-1',
  version: 1,
  serviceTypeCode: 'HEADHUNT_COD',
  status: 'SIGNED',
  concurrencyToken: 'tok-sa',
  isCurrent: true,
  feeMultiplier: 2,
  warrantyDays: 60,
  paymentDueDays: 15,
  pricePerQualifiedCv: null,
  sourcingTarget: null,
  reviewDays: null,
  depositPercent: null,
  agreementNote: null,
  changeRequestReason: null,
  companyName: 'Công ty Công nghệ ABC',
  companyTaxCode: '0312345678',
  companyAddress: '123 Nguyễn Huệ, Quận 1, TP.HCM',
  signerUserId: 'user-1',
  signerName: 'Nguyễn Minh Quân',
  signerEmail: 'quan.nguyen@abc.vn',
  signerRole: 'Giám đốc Nhân sự',
  consentTextVersion: 'v1.0',
  consentAcceptedAt: '2026-10-05T09:30:00Z',
  verificationCode: 'SA-2026-001',
  hasUnsignedDocument: true,
  hasSignedDocument: true,
  documentSha256Hash: 'hash',
  createdByUserId: 'hr-1',
  createdAt: '2026-10-01T08:00:00Z',
  sentToClientAt: '2026-10-02T10:15:00Z',
  respondedAt: '2026-10-04T14:20:00Z',
  signedAt: '2026-10-05T09:35:00Z',
  voidedAt: null,
  voidReason: null,
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/client/agreements']}>
        <App>
          <ClientServiceAgreementsPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('ClientServiceAgreementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays version, timeline milestones, signer consent, legal info, and Headhunt fee estimate', () => {
    const job = makeJob({
      serviceTypeCode: 'HEADHUNT_COD',
      salaryMin: 20_000_000,
      salaryMax: 30_000_000,
      salaryNegotiable: false,
      currencyCode: 'VND',
    });
    const agreement = makeAgreement({
      version: 2,
      feeMultiplier: 2,
    });

    useMyJobsMock.mockReturnValue({ isLoading: false, isFetching: false, data: [job], refetch: vi.fn() });
    useCurrentServiceAgreementMock.mockReturnValue({ isLoading: false, data: agreement, refetch: vi.fn() });
    useServiceAgreementHistoryMock.mockReturnValue({ isLoading: false, data: [agreement], refetch: vi.fn() });

    renderPage();

    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText(`Gửi DN lúc: ${dayjs(agreement.sentToClientAt!).format('DD/MM/YYYY HH:mm')}`)).toBeInTheDocument();
    expect(screen.getByText(`DN phản hồi lúc: ${dayjs(agreement.respondedAt!).format('DD/MM/YYYY HH:mm')}`)).toBeInTheDocument();
    expect(screen.getByText(`Ký ngày: ${dayjs(agreement.signedAt!).format('DD/MM/YYYY HH:mm')}`)).toBeInTheDocument();

    expect(screen.getByText('0312345678')).toBeInTheDocument();
    expect(screen.getByText(/123 Nguyễn Huệ, Quận 1, TP\.HCM/)).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Minh Quân/)).toBeInTheDocument();
    expect(screen.getByText(/Giám đốc Nhân sự/)).toBeInTheDocument();
    expect(screen.getByText('quan.nguyen@abc.vn')).toBeInTheDocument();
    expect(
      screen.getByText(`Đồng ý điều khoản lúc ${dayjs(agreement.consentAcceptedAt!).format('DD/MM/YYYY HH:mm')}`)
    ).toBeInTheDocument();

    expect(screen.getByText('2 tháng lương')).toBeInTheDocument();
    expect(screen.getByText('~16.7% tổng thu nhập năm')).toBeInTheDocument();
    expect(screen.getByText(/40\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/60\.000\.000/)).toBeInTheDocument();
    expect(
      screen.getByText(`Ký lúc ${dayjs(agreement.signedAt!).format('DD/MM/YYYY HH:mm')} · Đã xác nhận hiệu lực`)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Đang chờ HR Connect duyệt/)).not.toBeInTheDocument();
  });

  it('does not fall back to createdAt in SIGNED banner when signedAt is null, and shows VOID banner details', () => {
    const job = makeJob({ status: 'ACTIVE' });
    const createdAt = '2026-10-01T08:00:00Z';
    const signedWithoutTimestamp = makeAgreement({
      status: 'SIGNED',
      signedAt: null,
      createdAt,
      signerName: null,
      signerRole: null,
      signerEmail: null,
      consentAcceptedAt: null,
      hasSignedDocument: true,
    });

    useMyJobsMock.mockReturnValue({ isLoading: false, isFetching: false, data: [job], refetch: vi.fn() });
    useCurrentServiceAgreementMock.mockReturnValue({
      isLoading: false,
      data: signedWithoutTimestamp,
      refetch: vi.fn(),
    });
    useServiceAgreementHistoryMock.mockReturnValue({
      isLoading: false,
      data: [signedWithoutTimestamp],
      refetch: vi.fn(),
    });

    const { unmount } = renderPage();
    expect(screen.getByText('Hợp đồng đã hoàn tất thủ tục ký kết giữa hai bên.')).toBeInTheDocument();
    expect(
      screen.queryByText(`Hợp đồng đã hoàn tất thủ tục ký kết giữa hai bên vào ngày ${dayjs(createdAt).format('DD/MM/YYYY HH:mm')}.`)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Đã tải lên bản ký')).toBeInTheDocument();
    unmount();

    const uploadedWithSigner = makeAgreement({
      status: 'SIGNED',
      signedAt: '2026-10-05T15:00:00Z',
      signerName: 'Lê Hoàng Nam',
      signerEmail: 'nam.le@abc.vn',
      signerRole: null,
      consentAcceptedAt: null,
      hasSignedDocument: true,
    });
    useCurrentServiceAgreementMock.mockReturnValue({
      isLoading: false,
      data: uploadedWithSigner,
      refetch: vi.fn(),
    });
    useServiceAgreementHistoryMock.mockReturnValue({
      isLoading: false,
      data: [uploadedWithSigner],
      refetch: vi.fn(),
    });
    const { unmount: unmountUploaded } = renderPage();
    expect(screen.getByText('Lê Hoàng Nam')).toBeInTheDocument();
    expect(screen.getByText('nam.le@abc.vn')).toBeInTheDocument();
    expect(
      screen.getByText(`Đã tải lên bản ký · Ngày ký ${dayjs(uploadedWithSigner.signedAt!).format('DD/MM/YYYY HH:mm')}`)
    ).toBeInTheDocument();
    unmountUploaded();

    const pendingVoidJob = makeJob({ status: 'PENDING_AGREEMENT' });
    const voided = makeAgreement({
      status: 'VOID',
      signedAt: null,
      hasSignedDocument: true,
      voidedAt: '2026-10-08T11:45:00Z',
      voidReason: 'Thay thế do thay đổi điều khoản bảo hành',
    });
    useMyJobsMock.mockReturnValue({ isLoading: false, isFetching: false, data: [pendingVoidJob], refetch: vi.fn() });
    useCurrentServiceAgreementMock.mockReturnValue({ isLoading: false, data: voided, refetch: vi.fn() });
    useServiceAgreementHistoryMock.mockReturnValue({ isLoading: false, data: [voided], refetch: vi.fn() });

    renderPage();
    expect(screen.getByText('Thỏa thuận phiên bản này đã bị hủy')).toBeInTheDocument();
    expect(screen.getByText('Thay thế do thay đổi điều khoản bảo hành')).toBeInTheDocument();
    expect(screen.getByText(`Hủy lúc: ${dayjs(voided.voidedAt!).format('DD/MM/YYYY HH:mm')}`)).toBeInTheDocument();
    expect(screen.queryByText('Chờ HR duyệt bản ký')).not.toBeInTheDocument();
  });

  it('shows reviewDays for CV_SOURCING and renders version diff plus voidReason in history table', () => {
    const job = makeJob({
      serviceTypeCode: 'CV_SOURCING',
      status: 'PENDING_AGREEMENT',
      title: 'Frontend React',
    });
    const v1 = makeAgreement({
      serviceAgreementId: 'sa-v1',
      version: 1,
      serviceTypeCode: 'CV_SOURCING',
      status: 'VOID',
      isCurrent: false,
      feeMultiplier: undefined,
      sourcingTarget: 20,
      pricePerQualifiedCv: 500_000,
      reviewDays: 3,
      depositPercent: 30,
      signedAt: null,
      voidedAt: '2026-10-06T10:00:00Z',
      voidReason: 'Doanh nghiệp đề nghị tăng thời hạn xem xét CV',
      changeRequestReason: 'Xin tăng thời hạn review lên 5 ngày',
      createdAt: '2026-10-01T08:00:00Z',
    });
    const v2 = makeAgreement({
      serviceAgreementId: 'sa-v2',
      version: 2,
      serviceTypeCode: 'CV_SOURCING',
      status: 'SENT_TO_CLIENT',
      isCurrent: true,
      feeMultiplier: null,
      sourcingTarget: 25,
      pricePerQualifiedCv: 500_000,
      reviewDays: 5,
      depositPercent: 40,
      agreementNote: 'Đã tăng thời hạn review theo đề xuất',
      signedAt: null,
      createdAt: '2026-10-06T10:05:00Z',
      sentToClientAt: '2026-10-06T10:10:00Z',
      respondedAt: null,
    });

    useMyJobsMock.mockReturnValue({ isLoading: false, isFetching: false, data: [job], refetch: vi.fn() });
    useCurrentServiceAgreementMock.mockReturnValue({ isLoading: false, data: v2, refetch: vi.fn() });
    useServiceAgreementHistoryMock.mockReturnValue({ isLoading: false, data: [v2, v1], refetch: vi.fn() });

    renderPage();

    expect(screen.getByText('Thời hạn xem xét CV')).toBeInTheDocument();
    expect(screen.getByText('5 ngày')).toBeInTheDocument();

    const historyTable = screen.getByRole('table');
    expect(within(historyTable).getByText('Bản khởi tạo')).toBeInTheDocument();
    expect(within(historyTable).queryByText(/— → —/)).not.toBeInTheDocument();
    expect(within(historyTable).getByText('CV mục tiêu: 20 hồ sơ → 25 hồ sơ')).toBeInTheDocument();
    expect(within(historyTable).getByText('Xem xét CV: 3 ngày → 5 ngày')).toBeInTheDocument();
    expect(within(historyTable).getByText('Tỷ lệ cọc: 30% → 40%')).toBeInTheDocument();
    expect(within(historyTable).getByText('Cập nhật ghi chú bổ sung')).toBeInTheDocument();
    expect(within(historyTable).getByText('Doanh nghiệp đề nghị tăng thời hạn xem xét CV')).toBeInTheDocument();
  });
});
