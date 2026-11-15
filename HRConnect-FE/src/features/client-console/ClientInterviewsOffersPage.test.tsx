import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import dayjs from 'dayjs';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientInterviewsOffersPage } from './ClientInterviewsOffersPage';
import { pipelineApi } from '@/services/api/hrApi';
import type { InterviewItem, OfferItem, PlacementItem } from '@/types/api/hr';

vi.mock('@/services/api/hrApi', () => ({
  pipelineApi: {
    interviews: vi.fn(),
    offers: vi.fn(),
    placements: vi.fn(),
  },
}));
vi.mock('@/features/jobs-mf01/useJobQueries', () => ({
  useMyJobs: () => ({
    isLoading: false,
    data: [{ jobId: 'job-backend', title: 'Backend .NET' }],
  }),
}));
vi.mock('@/features/recruitment/ApplicationWorkbench', () => ({ ApplicationWorkbench: () => null }));
vi.mock('@/features/client-console/ClientInterviewDetailDrawer', () => ({ ClientInterviewDetailDrawer: () => null }));
vi.mock('./components/ReportResignationModal', () => ({ ReportResignationModal: () => null }));

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

const interviewsMock = vi.mocked(pipelineApi.interviews);
const offersMock = vi.mocked(pipelineApi.offers);
const placementsMock = vi.mocked(pipelineApi.placements);

const renderPage = (url = '/client/interviews-offers') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <App>
          <ClientInterviewsOffersPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );

const makeInterview = (over: Partial<InterviewItem>): InterviewItem => ({
  interviewId: Math.random().toString(36),
  applicationId: 'app-1',
  jobTitle: 'Backend .NET',
  companyName: 'ACME',
  candidateName: 'Nguyễn Văn A',
  candidateEmail: null,
  interviewRound: 1,
  interviewType: 'ONLINE',
  scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  durationMinutes: 60,
  location: null,
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  status: 'SCHEDULED',
  result: null,
  candidateAttendanceStatus: 'CONFIRMED',
  ...over,
});

const makeOffer = (over: Partial<OfferItem>): OfferItem => ({
  offerId: Math.random().toString(36),
  applicationId: 'app-offer',
  jobTitle: 'Senior QA',
  companyName: 'ACME',
  candidateName: 'Trần Thị B',
  candidateEmail: null,
  offerVersion: 2,
  salary: 35_000_000,
  currencyCode: 'VND',
  salaryBasis: 'GROSS',
  salaryPeriod: 'MONTHLY',
  monthlyGrossSalary: 35_000_000,
  startDate: '2026-12-01',
  expiryDate: '2026-12-10',
  status: 'DRAFT',
  sentAt: null,
  respondedAt: null,
  declineReason: null,
  canRespond: true,
  ...over,
});

const makePlacement = (over: Partial<PlacementItem>): PlacementItem => ({
  placementId: 'pl-1',
  applicationId: 'app-pl',
  actualStartDate: '2026-11-01',
  endDate: null,
  resignationReason: null,
  resignedBy: null,
  position: 'Software Engineer',
  department: 'Engineering',
  status: 'STARTED',
  confirmedAt: '2026-11-01T08:00:00Z',
  confirmedByName: 'HR',
  candidate: { candidateId: 'c1', fullName: 'Lê Văn C', email: 'c@example.com', phoneNumber: null },
  job: { jobId: 'j1', title: 'Frontend React', companyId: 'co1', companyName: 'ACME' },
  ...over,
});

describe('Client › Phỏng vấn & Offer', () => {
  beforeEach(() => {
    interviewsMock.mockReset();
    offersMock.mockReset();
    placementsMock.mockReset();
    interviewsMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 } as never);
    offersMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 } as never);
    placementsMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 } as never);
  });

  it('sends the selected job to the server and resets pagination', async () => {
    renderPage('/client/interviews-offers?tab=interviews&page=3');

    const jobFilter = await screen.findByRole('combobox');
    fireEvent.mouseDown(jobFilter);
    fireEvent.click(await screen.findByText('Backend .NET'));

    await waitFor(() => {
      expect(interviewsMock).toHaveBeenCalledWith(expect.objectContaining({
        jobId: 'job-backend',
        page: 1,
        pageSize: 10,
      }));
    });
  });

  it('shows interview format, duration, candidate attendance badge, and overdue warning', async () => {
    const past = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    interviewsMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 2, page: 1, pageSize: 1 } as never;
      return {
        items: [
          makeInterview({
            interviewId: 'iv-1',
            candidateName: 'Ứng Viên Xác Nhận',
            interviewType: 'ONLINE',
            durationMinutes: 45,
            scheduledAt: future,
            candidateAttendanceStatus: 'CONFIRMED',
            meetingLink: 'https://meet.google.com/ok',
          }),
          makeInterview({
            interviewId: 'iv-2',
            candidateName: 'Ứng Viên Quá Giờ',
            interviewType: 'OFFLINE',
            durationMinutes: 60,
            location: 'Tầng 5, Q.1',
            scheduledAt: past,
            candidateAttendanceStatus: null,
            meetingLink: null,
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      } as never;
    });

    renderPage('/client/interviews-offers?tab=interviews');

    const row1 = (await screen.findByText('Ứng Viên Xác Nhận')).closest('tr')!;
    expect(within(row1).getByText('Trực tuyến · 45 phút')).toBeInTheDocument();
    expect(within(row1).getByRole('link', { name: /Link họp/i })).toHaveAttribute('href', 'https://meet.google.com/ok');
    expect(within(row1).getByText('Đã xác nhận tham gia')).toBeInTheDocument();
    expect(within(row1).queryByText(/Quá giờ/)).toBeNull();

    const row2 = screen.getByText('Ứng Viên Quá Giờ').closest('tr')!;
    expect(within(row2).getByText('Trực tiếp · 60 phút')).toBeInTheDocument();
    expect(within(row2).getByText(/Tầng 5, Q\.1/)).toBeInTheDocument();
    expect(within(row2).getByText('Chưa xác nhận')).toBeInTheDocument();
    expect(within(row2).getByText('Quá giờ · Chờ ghi kết quả')).toBeInTheDocument();
  });

  it('distinguishes Offer action labels by status and shows basis, start date, expiry alerts and decline reason', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    offersMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 5, page: 1, pageSize: 1 } as never;
      return {
        items: [
          makeOffer({ offerId: 'o1', candidateName: 'Offer Nháp', status: 'DRAFT', salaryBasis: 'GROSS', startDate: '2026-12-01' }),
          makeOffer({ offerId: 'o2', candidateName: 'Offer Đã Gửi', status: 'SENT', salaryBasis: 'NET', expiryDate: tomorrow, canRespond: true }),
          makeOffer({ offerId: 'o3', candidateName: 'Offer Quá Hạn Phản Hồi', status: 'SENT', expiryDate: yesterday, canRespond: false }),
          makeOffer({ offerId: 'o4', candidateName: 'Offer Đã Nhận', status: 'ACCEPTED' }),
          makeOffer({ offerId: 'o5', candidateName: 'Offer Từ Chối', status: 'DECLINED', declineReason: 'Đã nhận đề nghị khác', respondedAt: '2026-11-12T10:00:00Z' }),
        ],
        total: 5,
        page: 1,
        pageSize: 10,
      } as never;
    });

    renderPage('/client/interviews-offers?tab=offers&status=all');

    const draftRow = (await screen.findByText('Offer Nháp')).closest('tr')!;
    expect(within(draftRow).getByRole('button', { name: 'Xem & gửi Offer' })).toBeInTheDocument();
    expect(within(draftRow).getByText('Trước thuế (Gross) (Tháng)')).toBeInTheDocument();
    expect(within(draftRow).getByText('Nhận việc 01/12/2026')).toBeInTheDocument();
    expect(within(draftRow).getByText('Phiên bản v2')).toBeInTheDocument();

    const sentRow = screen.getByText('Offer Đã Gửi').closest('tr')!;
    expect(within(sentRow).getByRole('button', { name: 'Xem Offer' })).toBeInTheDocument();
    expect(within(sentRow).getByText('Thực nhận (Net) (Tháng)')).toBeInTheDocument();
    expect(within(sentRow).getByText(/Còn 1 ngày|Hết hạn hôm nay/)).toBeInTheDocument();

    const expiredSentRow = screen.getByText('Offer Quá Hạn Phản Hồi').closest('tr')!;
    expect(within(expiredSentRow).getByRole('button', { name: 'Xem Offer' })).toBeInTheDocument();
    expect(within(expiredSentRow).getByText('Đã quá hạn phản hồi')).toBeInTheDocument();

    const acceptedRow = screen.getByText('Offer Đã Nhận').closest('tr')!;
    expect(within(acceptedRow).getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();

    const declinedRow = screen.getByText('Offer Từ Chối').closest('tr')!;
    expect(within(declinedRow).getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();
    expect(within(declinedRow).getByText('Đã nhận đề nghị khác')).toBeInTheDocument();
  });

  it('links placements to warranty detail and shows resignation details when RESIGNED', async () => {
    placementsMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 2, page: 1, pageSize: 1 } as never;
      return {
        items: [
          makePlacement({ placementId: 'pl-active', status: 'STARTED', candidate: { candidateId: 'c1', fullName: 'Nhân Sự Active', email: 'a@x.com', phoneNumber: null } }),
          makePlacement({
            placementId: 'pl-resigned',
            status: 'RESIGNED',
            endDate: '2026-11-10',
            resignationReason: 'Chuyển nơi ở',
            candidate: { candidateId: 'c2', fullName: 'Nhân Sự Đã Nghỉ', email: 'b@x.com', phoneNumber: null },
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      } as never;
    });

    renderPage('/client/interviews-offers?tab=placements&status=all');

    const activeRow = (await screen.findByText('Nhân Sự Active')).closest('tr')!;
    expect(within(activeRow).getByRole('link', { name: 'Chi tiết bảo hành' })).toHaveAttribute('href', '/client/placements/pl-active');
    expect(within(activeRow).getByRole('button', { name: 'Báo nghỉ việc' })).toBeInTheDocument();

    const resignedRow = screen.getByText('Nhân Sự Đã Nghỉ').closest('tr')!;
    expect(within(resignedRow).getByRole('link', { name: 'Chi tiết bảo hành' })).toHaveAttribute('href', '/client/placements/pl-resigned');
    expect(within(resignedRow).getByText(/Nghỉ 10\/11\/2026 · Chuyển nơi ở/)).toBeInTheDocument();
  });

  it('shows lastStatusReason on cancelled/rescheduled interviews and warranty, fee, replacement and service details on placements', async () => {
    interviewsMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 2, page: 1, pageSize: 1 } as never;
      return {
        items: [
          makeInterview({
            interviewId: 'iv-cancel',
            candidateName: 'Ứng Viên Đã Hủy',
            status: 'CANCELLED',
            lastStatusReason: 'Ứng viên bận đột xuất',
          }),
          makeInterview({
            interviewId: 'iv-null',
            candidateName: 'Ứng Viên Bình Thường',
            status: 'SCHEDULED',
            lastStatusReason: null,
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      } as never;
    });

    renderPage('/client/interviews-offers?tab=interviews&status=all');
    const cancelledRow = (await screen.findByText('Ứng Viên Đã Hủy')).closest('tr')!;
    expect(within(cancelledRow).getByText('Lý do: Ứng viên bận đột xuất')).toBeInTheDocument();
    const normalIvRow = screen.getByText('Ứng Viên Bình Thường').closest('tr')!;
    expect(within(normalIvRow).queryByText(/Lý do:|undefined/)).toBeNull();

    const futureWarrantyDate = dayjs().add(5, 'day').format('YYYY-MM-DD');
    placementsMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 3, page: 1, pageSize: 1 } as never;
      return {
        items: [
          makePlacement({
            placementId: 'pl-enriched',
            status: 'STARTED',
            warrantyStatus: 'ACTIVE',
            warrantyEndDate: futureWarrantyDate,
            serviceFeeStatus: 'PAID',
            isReplacement: true,
            serviceTypeCode: 'HEADHUNT_COD',
            candidate: { candidateId: 'c3', fullName: 'Nhân Sự Bảo Hành', email: 'c3@x.com', phoneNumber: null },
          }),
          makePlacement({
            placementId: 'pl-claimed',
            status: 'STARTED',
            warrantyStatus: 'CLAIMED',
            warrantyEndDate: futureWarrantyDate,
            serviceFeeStatus: 'PAID',
            serviceTypeCode: 'HEADHUNT_COD',
            endDate: '2026-11-12',
            resignationReason: 'Chờ HR xác nhận',
            candidate: { candidateId: 'c3b', fullName: 'Nhân Sự Đang Claim', email: 'c3b@x.com', phoneNumber: null },
          }),
          makePlacement({
            placementId: 'pl-plain',
            status: 'STARTED',
            warrantyStatus: null,
            warrantyEndDate: null,
            serviceFeeStatus: null,
            isReplacement: false,
            serviceTypeCode: null,
            candidate: { candidateId: 'c4', fullName: 'Nhân Sự Null', email: 'c4@x.com', phoneNumber: null },
          }),
        ],
        total: 3,
        page: 1,
        pageSize: 10,
      } as never;
    });

    renderPage('/client/interviews-offers?tab=placements&status=all');
    const enrichedRow = (await screen.findByText('Nhân Sự Bảo Hành')).closest('tr')!;
    expect(within(enrichedRow).getByText('Tuyển dụng theo kết quả')).toBeInTheDocument();
    expect(within(enrichedRow).getByText('Thay thế')).toBeInTheDocument();
    expect(within(enrichedRow).getByText('Đang bảo hành')).toBeInTheDocument();
    expect(within(enrichedRow).getByText(/Hết BH .*còn 5 ngày/)).toBeInTheDocument();
    expect(within(enrichedRow).getByText('Đã thanh toán')).toBeInTheDocument();
    expect(within(enrichedRow).getByRole('button', { name: 'Báo nghỉ việc' })).toBeInTheDocument();

    const claimedRow = screen.getByText('Nhân Sự Đang Claim').closest('tr')!;
    expect(within(claimedRow).getByText('Báo nghỉ — chờ xác minh')).toBeInTheDocument();
    expect(within(claimedRow).queryByRole('button', { name: 'Báo nghỉ việc' })).toBeNull();

    const plainRow = screen.getByText('Nhân Sự Null').closest('tr')!;
    expect(within(plainRow).queryByText(/Invalid Date|undefined|Thay thế/)).toBeNull();
  });
});
