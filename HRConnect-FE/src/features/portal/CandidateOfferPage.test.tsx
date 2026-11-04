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

describe('CandidateOfferPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mf04Api, 'getOfferDetail').mockResolvedValue(offer as never);
    vi.spyOn(mf04Api, 'getOffers').mockResolvedValue([
      { offerId: 'off-1', offerVersion: 1, salary: 30_000_000, currencyCode: 'VND', status: 'WITHDRAWN', concurrencyToken: 'x', canRespond: false },
      { offerId: 'off-2', offerVersion: 2, salary: 32_000_000, currencyCode: 'VND', status: 'SENT', concurrencyToken: 'y', canRespond: true },
    ]);
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

    fireEvent.click(await screen.findByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('off-2', { response: 'ACCEPTED', declineReason: undefined, concurrencyToken: 'tok-2' }));
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

    fireEvent.click(await screen.findByRole('button', { name: 'Gửi trả lời' }));

    expect(await screen.findByText(/Offer vừa thay đổi/)).toBeInTheDocument();
    await waitFor(() => expect(mf04Api.getOfferDetail).toHaveBeenCalledTimes(2));
  });
});
