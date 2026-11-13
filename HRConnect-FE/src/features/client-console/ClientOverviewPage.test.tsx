/**
 * @file ClientOverviewPage.test.tsx
 * @description Client dashboard: real numbers only (no invented progress), upcoming interviews only,
 * and shortcuts that land on the page they name.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientOverviewPage } from './ClientOverviewPage';
import { pipelineApi, screeningApi } from '@/services/api/hrApi';
import { financeApi } from '@/services/api/financeApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/services/api/financeApi', () => ({ financeApi: { clientDashboardSummary: vi.fn() } }));

vi.mock('@/services/api/hrApi', () => ({
  screeningApi: { counts: vi.fn() },
  pipelineApi: { interviews: vi.fn() },
}));

const jobs = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('@/features/jobs-mf01/useJobQueries', () => ({
  useMyJobs: () => ({ isLoading: false, data: jobs.data }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (select: (s: { user: { name: string } }) => unknown) => select({ user: { name: 'Demo Client' } }),
}));

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const interview = (over: Record<string, unknown>) => ({
  interviewId: Math.random().toString(36),
  candidateName: 'Ứng viên',
  jobTitle: 'Backend .NET',
  interviewRound: 1,
  interviewType: 'ONLINE',
  location: null,
  meetingLink: null,
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <App>
          <ClientOverviewPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('ClientOverviewPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(financeApi.clientDashboardSummary).mockResolvedValue({
      pendingFeesAmount: 7_000_000, pendingFeesCount: 2, overdueFeesAmount: 6_000_000, overdueFeesCount: 1,
      nextFeeDueDate: '2026-11-20', refundsOwedAmount: 500_000, refundsOwedCount: 1,
      sourcingPendingReviewCount: 2, sourcingNearestReviewDueAt: null,
      warrantiesEndingSoonCount: 1, warrantyWithinDays: 7, openReplacementSlotsCount: 3, currencyCode: 'VND',
    });
    jobs.data = [
      { jobId: 'j-cap', title: 'Tin có hạn mức', status: 'ACTIVE', quantity: 2, maxApplications: 40, serviceTypeCode: 'CV_APPLICATION' },
      { jobId: 'j-nocap', title: 'Tin không hạn mức', status: 'ACTIVE', quantity: 2, maxApplications: null, serviceTypeCode: 'HEADHUNT_COD' },
      { jobId: 'j-draft', title: 'Nháp', status: 'DRAFT', quantity: 1 },
      { jobId: 'j-rej', title: 'Bị từ chối', status: 'REJECTED', quantity: 1 },
    ];
    vi.mocked(screeningApi.counts).mockImplementation(async (by: string) =>
      by === 'job'
        ? ({ 'j-cap': 10, 'j-nocap': 7 } as never)
        : ({ SUBMITTED: 3, SCREENING: 1, SHORTLISTED: 2, INTERVIEW: 1, OFFER_PENDING: 1, OFFER_ACCEPTED: 2, PLACED: 1 } as never)
    );
    vi.mocked(pipelineApi.interviews).mockResolvedValue({
      items: [
        interview({ candidateName: 'Trực tiếp', scheduledAt: hoursFromNow(2), interviewType: 'OFFLINE', location: 'Tầng 5, 12 Lê Lợi' }),
        interview({ candidateName: 'Trực tuyến', scheduledAt: hoursFromNow(5), meetingLink: 'https://meet.example/abc' }),
        interview({ candidateName: 'Gọi điện', scheduledAt: hoursFromNow(8), interviewType: 'PHONE', meetingLink: 'https://khong-hien.example' }),
        interview({ candidateName: 'Chưa có ngày', scheduledAt: null }),
      ],
      totalCount: 4,
    } as never);
  });

  it('asks BE for upcoming interviews only, nearest first, and shows their type and place', async () => {
    renderPage();

    await waitFor(() =>
      expect(pipelineApi.interviews).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SCHEDULED', sortDirection: 'ASC', pageSize: 4, fromDate: expect.any(String) })
      )
    );
    const from = new Date(vi.mocked(pipelineApi.interviews).mock.calls[0][0].fromDate!).getTime();
    expect(Math.abs(from - Date.now())).toBeLessThan(60_000);

    const offline = await screen.findByText('Trực tiếp');
    expect(screen.queryByText('Chưa có ngày')).toBeNull();
    expect(screen.getByText('Trực tiếp · Tầng 5, 12 Lê Lợi')).toBeInTheDocument();
    expect(screen.getByText('Trực tuyến · https://meet.example/abc')).toBeInTheDocument();
    expect(screen.getByText('3 buổi')).toBeInTheDocument();
    // A meeting link is only shown for an online interview.
    expect(within(screen.getByText('Gọi điện').closest('div[class*="cursor-pointer"]') as HTMLElement).getByText('Điện thoại')).toBeInTheDocument();
    expect(screen.queryByText(/khong-hien\.example/)).toBeNull();
    // nearest (2h) before 5h
    const online = screen.getByText('Trực tuyến');
    expect(offline.compareDocumentPosition(online) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws a progress bar only for a job with a real application cap', async () => {
    renderPage();

    const capped = (await screen.findByText('Tin có hạn mức')).closest('[class*="rounded-2xl"]') as HTMLElement;
    await waitFor(() => expect((capped.querySelector('[style*="width"]') as HTMLElement).style.width).toBe('25%'));

    const uncapped = screen.getByText('Tin không hạn mức').closest('[class*="rounded-2xl"]') as HTMLElement;
    expect(uncapped.querySelector('[style*="width"]')).toBeNull();
  });

  it('names the pending work clearly and sends each shortcut to the page it names', async () => {
    renderPage();

    expect(await screen.findByText('CV chờ duyệt')).toBeInTheDocument();
    expect(screen.getByText('Phân bổ hồ sơ theo giai đoạn')).toBeInTheDocument();
    expect(await screen.findByText(/1 offer chờ ứng viên trả lời · 2 ứng viên đã nhận offer cần bạn xác nhận ngày đi làm/)).toBeInTheDocument();
    expect(screen.getByText('1 tin bị từ chối cần sửa · 1 tin nháp chưa gửi duyệt.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tin nháp & hoàn thiện'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/client/jobs?status=REJECTED');

    fireEvent.click(within(screen.getByText('Tuyển thành công').closest('div[class*="cursor-pointer"]') as HTMLElement).getByText('Bảo hành →'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/client/warranty');
  });

  it('shows the company money and commitments from the summary API and links each to its page', async () => {
    renderPage();

    expect(await screen.findByText('7.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('1 khoản quá hạn · 6.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('500.000 đ')).toBeInTheDocument();
    expect(screen.getByText('1 khoản đang chờ chuyển')).toBeInTheDocument();
    expect(screen.getByText('Không có CV chờ phản hồi')).toBeInTheDocument();
    expect(screen.getByText('bảo hành kết thúc trong 7 ngày · 3 suất thay thế đang mở')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Phí cần thanh toán/ }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/client/billing');
    fireEvent.click(screen.getByRole('button', { name: /CV Sourcing chờ phản hồi/ }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/client/candidates?service=CV_SOURCING');
    fireEvent.click(screen.getByRole('button', { name: /Bảo hành & suất thay thế/ }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/client/warranty');
  });
});
