import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mf04Api } from '@/services/api/mf04Api';
import { CandidateOfferPage } from './CandidateOfferPage';

const offer = {
  offerId: 'off-2',
  applicationId: 'app-1',
  offerVersion: 2,
  salary: 32_000_000,
  currencyCode: 'VND',
  salaryBasis: 'GROSS',
  salaryPeriod: 'MONTHLY',
  startDate: '2099-12-01',
  expiryDate: '2099-11-07',
  status: 'SENT',
  sentAt: '2026-10-31T03:00:00Z',
  concurrencyToken: 'tok-2',
  canRespond: true,
  job: { jobId: 'j1', title: 'Software Engineer', companyId: 'c1', companyName: 'MoMo' },
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter initialEntries={['/candidate/applications/app-1/offers/off-2']}>
          <Routes>
            <Route path="/candidate/applications/:applicationId/offers/:offerId" element={<CandidateOfferPage />} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

const noConflict = {
  targetOfferId: 'off-2',
  employmentType: 'FULL_TIME',
  isFullTime: true,
  acceptedFullTimeOffer: null,
  otherPendingFullTimeOffers: [],
  activeFullTimePlacement: null,
  allowedActions: ['KEEP_OTHER_PENDING_OFFERS'],
};
const otherOffer = (jobTitle: string, companyName: string, status = 'ACCEPTED') => ({
  offerId: `other-${jobTitle}`,
  applicationId: 'old-app',
  jobTitle,
  companyName,
  employmentType: 'FULL_TIME',
  status,
});

describe('CandidateOfferPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mf04Api, 'getOfferDetail').mockResolvedValue(offer as never);
    vi.spyOn(mf04Api, 'getOffers').mockResolvedValue([
      { offerId: 'off-1', offerVersion: 1, salary: 30_000_000, currencyCode: 'VND', status: 'WITHDRAWN', concurrencyToken: 'x', canRespond: false },
      { offerId: 'off-2', offerVersion: 2, salary: 32_000_000, currencyCode: 'VND', status: 'SENT', concurrencyToken: 'y', canRespond: true },
    ]);
    vi.spyOn(mf04Api, 'getOfferAcceptanceImpact').mockResolvedValue(noConflict as never);
  });

  it('shows the terms and which version this one replaces', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Thư mời nhận việc – Software Engineer' })).toBeInTheDocument();
    expect(screen.getByText('32.000.000 VND')).toBeInTheDocument();
    expect(screen.getByText('Gross, theo tháng')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chờ bạn trả lời');
    expect(await screen.findByText(/thay thế phiên bản 1 \(lương 30\.000\.000 VND\)/)).toBeInTheDocument();
  });

  it('sends an acceptance with the offer token', async () => {
    const respond = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({ success: true, message: 'Đã chấp nhận' });
    renderPage();

    const send = await screen.findByRole('button', { name: 'Gửi trả lời' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(respond).toHaveBeenCalledWith('off-2', { response: 'ACCEPTED', declineReason: undefined, concurrencyToken: 'tok-2', acceptanceAction: 'KEEP_OTHER_PENDING_OFFERS' }));
  });

  it('switches from an offer already accepted, after saying so', async () => {
    vi.mocked(mf04Api.getOfferAcceptanceImpact).mockResolvedValue({ ...noConflict, acceptedFullTimeOffer: otherOffer('Backend Engineer', 'Công ty cũ') } as never);
    const respond = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({ success: true, message: 'Đã chuyển' });
    renderPage();

    expect(await screen.findByText(/Backend Engineer tại Công ty cũ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('off-2', expect.objectContaining({ acceptanceAction: 'REPLACE_ACCEPTED_FULL_TIME_OFFER' })));
  });

  it('lets the candidate withdraw other pending full-time offers', async () => {
    vi.mocked(mf04Api.getOfferAcceptanceImpact).mockResolvedValue({ ...noConflict, otherPendingFullTimeOffers: [otherOffer('QA', 'VNG', 'SENT')] } as never);
    const respond = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({ success: true, message: 'ok' });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /rút các thư mời toàn thời gian/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('off-2', expect.objectContaining({ acceptanceAction: 'WITHDRAW_OTHER_PENDING_FULL_TIME_OFFERS' })));
  });

  it('blocks accepting during an active full-time placement until confirming transition, but not refusing', async () => {
    vi.mocked(mf04Api.getOfferAcceptanceImpact).mockResolvedValue({ ...noConflict, isFullTime: true, activeFullTimePlacement: otherOffer('Tester', 'Công ty hiện tại', 'PLACED') } as never);
    const respond = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({ success: true, message: 'ok' });
    renderPage();

    expect(await screen.findByRole('region', { name: 'Xác nhận chuyển việc' })).toHaveTextContent('Công ty hiện tại');
    expect(screen.queryByRole('link', { name: 'Liên hệ hỗ trợ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeDisabled();

    // Refusing is not blocked
    fireEvent.click(screen.getByRole('radio', { name: /Từ chối offer/ }));
    expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeEnabled();

    // Switching back to accept without checkbox is blocked
    fireEvent.click(screen.getByRole('radio', { name: /Chấp nhận offer/ }));
    expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeDisabled();

    // Confirming transition unlocks accept button and sends TRANSITION_FROM_ACTIVE_PLACEMENT
    const checkbox = screen.getByRole('checkbox', { name: /Tôi xác nhận đã nghỉ việc hoặc sẽ hoàn tất bàn giao/i });
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));
    await waitFor(() =>
      expect(respond).toHaveBeenCalledWith('off-2', expect.objectContaining({ acceptanceAction: 'TRANSITION_FROM_ACTIVE_PLACEMENT' }))
    );
  });

  it('does not allow accepting when the check fails, and can retry', async () => {
    vi.mocked(mf04Api.getOfferAcceptanceImpact).mockRejectedValueOnce(new Error('Lỗi'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa kiểm tra được');
    expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi trả lời' })).toBeEnabled());
  });

  it('rechecks instead of reloading when a full-time conflict appears on sending', async () => {
    const conflict = Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { message: 'Đã có offer toàn thời gian', errorCode: 'ACCEPTED_FULL_TIME_OFFER_EXISTS' } } });
    vi.spyOn(mf04Api, 'respondOffer').mockRejectedValue(conflict);
    renderPage();

    const send = await screen.findByRole('button', { name: 'Gửi trả lời' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    expect(await screen.findByText('Đã có offer toàn thời gian')).toBeInTheDocument();
    await waitFor(() => expect(mf04Api.getOfferAcceptanceImpact).toHaveBeenCalledTimes(2));
    expect(mf04Api.getOfferDetail).toHaveBeenCalledTimes(1);
  });

  it('asks for a reason before sending a refusal', async () => {
    const respond = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({ success: true, message: 'Đã từ chối' });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /Từ chối offer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng nhập lý do từ chối.');
    expect(respond).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do từ chối' }), { target: { value: 'Đã nhận nơi khác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('off-2', { response: 'DECLINED', declineReason: 'Đã nhận nơi khác', concurrencyToken: 'tok-2' }));
  });

  it.each([
    ['already answered', { status: 'DECLINED', declineReason: 'Lương thấp' }],
    ['past its deadline', { status: 'SENT', expiryDate: '2020-01-01' }],
  ])('hides the answer when the offer is %s', async (_, change) => {
    vi.mocked(mf04Api.getOfferDetail).mockResolvedValue({ ...offer, ...change } as never);
    renderPage();

    await screen.findByRole('heading', { name: 'Thư mời nhận việc – Software Engineer' });
    expect(screen.queryByRole('button', { name: 'Gửi trả lời' })).not.toBeInTheDocument();
  });

  it('reloads instead of failing when the offer changed meanwhile', async () => {
    const conflict = Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { message: 'x' } } });
    vi.spyOn(mf04Api, 'respondOffer').mockRejectedValue(conflict);
    renderPage();

    const send = await screen.findByRole('button', { name: 'Gửi trả lời' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    expect(await screen.findByText(/Offer vừa thay đổi/)).toBeInTheDocument();
    await waitFor(() => expect(mf04Api.getOfferDetail).toHaveBeenCalledTimes(2));
  });
});
