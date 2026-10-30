import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacementDetailPage } from './PlacementDetailPage';
import { PlacementDetailView } from './PlacementDetailView';
import { placementApi } from '@/services/api/placementApi';

vi.mock('@/services/api/placementApi', () => ({
  placementApi: {
    getPlacementDetail: vi.fn(),
    reportResignation: vi.fn(),
    resolveResignation: vi.fn(),
  },
}));

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/client/placements/plc-1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/client/placements/:placementId" element={ui} />
          <Route path="/hr/placements/:placementId" element={ui} />
          <Route path="/placements/:placementId" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockPlacement = {
  placementId: 'plc-1',
  applicationId: 'app-1',
  offerId: 'off-1',
  actualStartDate: '2026-10-15',
  position: 'Senior Fullstack Engineer',
  department: 'Core Banking',
  status: 'STARTED',
  confirmedAt: '2026-10-15T09:00:00Z',
  confirmedByName: 'Admin HR',
  confirmationNote: 'Đã hoàn tất thủ tục onboarding',
  candidate: {
    candidateId: 'cand-1',
    fullName: 'Hoàng Minh Tuấn',
    email: 'tuan.hoang@example.com',
    phone: '0912345678',
    summary: 'Chuyên gia React/NodeJS với 6 năm kinh nghiệm',
  },
  job: {
    jobId: 'job-1',
    title: 'Senior Fullstack Engineer',
    companyId: 'comp-1',
    companyName: 'MB Bank Digital',
  },
  offer: {
    offerId: 'off-1',
    salary: 45000000,
    currencyCode: 'VND',
    startDate: '2026-10-15',
    status: 'ACCEPTED',
    offerDocumentUrl: 'https://cdn.hrconnect.vn/offers/mb-off-1.pdf',
  },
  probation: {
    probationId: 'prb-1',
    startDate: '2026-10-15',
    endDate: '2026-12-15',
    result: 'IN_PROGRESS',
    notes: 'Thử việc 2 tháng',
  },
  warranty: {
    warrantyId: 'war-1',
    startDate: '2026-10-15',
    endDate: '2027-01-15',
    status: 'ACTIVE',
    resultNote: null,
  },
  financial: {
    serviceFeeAmount: 36000000,
    serviceFeeStatus: 'PAID',
    commissionAmount: 10800000,
    commissionStatus: 'IN_WARRANTY',
  },
  allowedActions: ['VIEW_PLACEMENT', 'VIEW_PROBATION', 'VIEW_WARRANTY'],
  createdAt: '2026-10-15T09:00:00Z',
  updatedAt: '2026-10-15T09:00:00Z',
};

describe('PlacementDetailPage & PlacementDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    vi.mocked(placementApi.getPlacementDetail).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PlacementDetailPage />, '/client/placements/plc-1');

    expect(screen.getByTestId('placement-detail-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(placementApi.getPlacementDetail).mockRejectedValueOnce(
      new Error('Không thể tải thông tin tiếp nhận việc')
    );

    renderWithProviders(<PlacementDetailPage />, '/client/placements/plc-err');

    await waitFor(() => {
      expect(screen.getByTestId('placement-detail-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Không thể tải thông tin tiếp nhận việc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();

    // Verify retry button triggers refetch
    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(mockPlacement as any);
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(screen.getByTestId('placement-detail-content')).toBeInTheDocument();
    });
  });

  it('renders empty state when placement is null', async () => {
    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(null as any);

    renderWithProviders(<PlacementDetailPage />, '/client/placements/plc-empty');

    await waitFor(() => {
      expect(screen.getByTestId('placement-detail-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/Không tìm thấy thông tin tiếp nhận việc/i)).toBeInTheDocument();
  });

  it('renders full placement details (candidate, job, company, salary, warranty, progress bar)', async () => {
    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(mockPlacement as any);

    renderWithProviders(<PlacementDetailPage />, '/client/placements/plc-1');

    await waitFor(() => {
      expect(screen.getByTestId('placement-detail-content')).toBeInTheDocument();
    });

    // Candidate & Job Info
    expect(screen.getAllByText('Hoàng Minh Tuấn')[0]).toBeInTheDocument();
    expect(screen.getAllByText('MB Bank Digital')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Senior Fullstack Engineer')[0]).toBeInTheDocument();
    expect(screen.getByText('tuan.hoang@example.com')).toBeInTheDocument();
    expect(screen.getByText('0912345678')).toBeInTheDocument();

    // Progress: warranty only, probation is out of scope (team decision 17/10)
    expect(screen.queryByText(/thử việc/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Tiến độ bảo hành/i)).toBeInTheDocument();

    // HR feedback 29/10: status codes are shown as Vietnamese labels, never raw codes
    expect(screen.getByText('Bảo hành: Đang bảo hành')).toBeInTheDocument();
    expect(screen.getByText('Đã thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đang trong thời gian bảo hành')).toBeInTheDocument();
    expect(screen.queryByText(/IN_WARRANTY|^ACTIVE$|^PAID$/)).not.toBeInTheDocument();

    // Financial link
    expect(screen.getByText(/Phí dịch vụ và hoa hồng/i)).toBeInTheDocument();
    expect(screen.getByText(/36\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/10\.800\.000/)).toBeInTheDocument();

    // Offer contract link
    const offerDocBtn = screen.getByRole('link', { name: /Hợp đồng Offer/i });
    expect(offerDocBtn).toBeInTheDocument();
    expect(offerDocBtn).toHaveAttribute('href', 'https://cdn.hrconnect.vn/offers/mb-off-1.pdf');
  });

  it('allows client to report resignation when warranty is active', async () => {
    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(mockPlacement as any);
    vi.mocked(placementApi.reportResignation).mockResolvedValueOnce({
      success: true,
      message: 'Đã gửi báo nghỉ việc thành công.',
    });

    renderWithProviders(
      <PlacementDetailView placementId="plc-1" mode="client" />,
      '/client/placements/plc-1'
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Báo nghỉ việc/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Báo nghỉ việc/i }));

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Báo ứng viên nghỉ việc trong thời gian bảo hành/i)).toBeInTheDocument();
    });

    const reasonInput = screen.getByPlaceholderText(/Ứng viên xin nghỉ vì lý do cá nhân/i);
    fireEvent.change(reasonInput, { target: { value: 'Ứng viên tìm được cơ hội mới' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi báo nghỉ việc/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(placementApi.reportResignation).toHaveBeenCalledWith('plc-1', expect.objectContaining({
        reason: 'Ứng viên tìm được cơ hội mới',
      }));
    });
  });

  it('allows internal HR to resolve resignation when warranty is claimed', async () => {
    const claimedPlacement = {
      ...mockPlacement,
      status: 'CLAIMED',
      warranty: {
        ...mockPlacement.warranty,
        status: 'CLAIMED',
      },
    };

    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(claimedPlacement as any);
    vi.mocked(placementApi.resolveResignation).mockResolvedValueOnce({
      placementId: 'plc-1',
      warrantyStatus: 'VOIDED',
      placementStatus: 'RESIGNED',
    });

    renderWithProviders(
      <PlacementDetailView placementId="plc-1" mode="hr" />,
      '/hr/placements/plc-1'
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xác minh báo nghỉ/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Xác minh báo nghỉ/i }));

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Xác minh báo nghỉ việc của Doanh nghiệp/i)).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText(/Ghi chú đối soát/i);
    fireEvent.change(noteInput, { target: { value: 'Đã đối soát xong với HR MB Bank' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu kết quả xác minh/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(placementApi.resolveResignation).toHaveBeenCalledWith('plc-1', {
        confirmed: true,
        note: 'Đã đối soát xong với HR MB Bank',
      });
    });
  });
  // HR feedback 28/10: each party only sees its own side of the money.
  it.each([
    ['client', true, false],
    ['affiliate', false, true],
    ['hr', true, true],
  ] as const)('in %s mode shows service fee=%s and commission=%s', async (mode, fee, commission) => {
    vi.mocked(placementApi.getPlacementDetail).mockResolvedValueOnce(mockPlacement as any);

    renderWithProviders(<PlacementDetailView placementId="plc-1" mode={mode} />);

    await waitFor(() => expect(screen.getByTestId('placement-detail-content')).toBeInTheDocument());
    expect(screen.queryByText('Phí dịch vụ tuyển dụng (Doanh nghiệp)') !== null).toBe(fee);
    expect(screen.queryByText('Hoa hồng Affiliate') !== null).toBe(commission);
    expect(screen.queryByText(/10\.800\.000/) !== null).toBe(commission);
  });
});
