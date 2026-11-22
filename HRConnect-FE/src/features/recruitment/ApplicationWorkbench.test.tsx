import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationWorkbench } from './ApplicationWorkbench';
import { clientActionsApi, interviewHistoryApi, screeningApi } from '@/services/api/hrApi';
import { sourcingApi } from '@/services/api/sourcingApi';
import { AxiosError } from 'axios';

vi.mock('@/services/api/hrApi', () => ({
  clientActionsApi: {
    scheduleInterview: vi.fn(),
    rescheduleInterview: vi.fn(),
    updateInterview: vi.fn(),
    cancelInterview: vi.fn(),
    recordResult: vi.fn(),
    recordNoShow: vi.fn(),
    decideBackup: vi.fn(),
    createOffer: vi.fn(),
    updateOffer: vi.fn(),
    sendOffer: vi.fn(),
    withdrawOffer: vi.fn(),
    setPlannedStart: vi.fn(),
    confirmStartWork: vi.fn(),
    markNotStarted: vi.fn(),
  },
  interviewHistoryApi: { get: vi.fn() },
  screeningApi: {
    get: vi.fn(),
    timeline: vi.fn(),
    startScreening: vi.fn(),
    updateStatus: vi.fn(),
    retryAiScoring: vi.fn(),
    cvDownloadUrl: vi.fn(),
  },
}));

vi.mock('@/services/api/sourcingApi', () => ({
  sourcingApi: {
    getDeliveries: vi.fn(),
    deliverCvs: vi.fn(),
    decideDelivery: vi.fn(),
  },
}));

const baseApplication = {
  applicationId: 'app-1',
  jobId: 'job-1',
  jobTitle: 'Senior Backend Engineer',
  companyId: 'company-1',
  companyName: 'HR Connect',
  candidateId: 'candidate-1',
  candidateFullName: 'Nguyễn Văn A',
  candidateEmail: 'candidate@example.com',
  candidatePhone: '0900000000',
  dateOfBirth: null,
  gender: null,
  currentAddress: null,
  yearsOfExperience: 5,
  highestEducation: 'Đại học',
  status: 'OFFER_PENDING',
  currentStage: 'OFFER',
  statusReason: null,
  statusReasonCode: null,
  appliedAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-02T08:00:00Z',
  plannedStartDate: null,
  concurrencyToken: 'application-token',
  isReplacement: false,
  replacementSlotId: null,
  replacementForPlacementId: null,
  cv: null,
  aiMatch: null,
  interviews: [],
  offers: [],
  placement: null,
  serviceTypeCode: 'CV_APPLICATION',
  contactOwner: 'ClientCompany',
  isContactMasked: false,
};

const renderWorkbench = (
  data: Record<string, unknown>,
  audience: 'client' | 'hr' = 'client',
  timeline: Record<string, unknown>[] = []
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(screeningApi.get).mockResolvedValue(data as any);
  vi.mocked(screeningApi.timeline).mockResolvedValue(timeline as any);

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <ApplicationWorkbench applicationId="app-1" audience={audience} onClose={vi.fn()} />
      </AntApp>
    </QueryClientProvider>
  );
};

describe('ApplicationWorkbench MF-04', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewHistoryApi.get).mockResolvedValue([]);
    vi.mocked(clientActionsApi.updateOffer).mockResolvedValue({ message: 'Đã lưu offer.' });
    vi.mocked(clientActionsApi.recordResult).mockResolvedValue({ message: 'Đã ghi kết quả.' });
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({ items: [], totalCount: 0 } as any);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('[FE-C01] decouples SHORTLISTED status update from deliverCvs when CV sourcing delivery fails', async () => {
    vi.mocked(screeningApi.updateStatus).mockResolvedValue({ success: true, data: null, message: 'Đã duyệt hồ sơ.' } as any);
    vi.mocked(sourcingApi.deliverCvs).mockRejectedValue({
      response: { data: { code: 'CONSENT_NOT_CONFIRMED', message: 'Ứng viên chưa xác nhận consent' } },
    });

    renderWorkbench(
      {
        ...baseApplication,
        serviceTypeCode: 'CV_SOURCING',
        status: 'SCREENING',
        currentStage: 'SCREENING',
        allowedActions: ['SHORTLIST'],
      },
      'hr'
    );

    await screen.findByText('Đang sàng lọc');

    const shortlistBtn = await screen.findByRole('button', { name: /Chọn gửi Client/i }, { timeout: 10000 });
    fireEvent.click(shortlistBtn);

    const confirmBtn = await screen.findByRole('button', { name: /Chọn & giao Client/i }, { timeout: 10000 });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screeningApi.updateStatus).toHaveBeenCalledWith('job-1', 'app-1', {
        targetStatus: 'SHORTLISTED',
        concurrencyToken: 'application-token',
      });
      expect(sourcingApi.deliverCvs).toHaveBeenCalledWith('job-1', ['app-1']);
    });
  });

  it('[FE-CLEANUP] shows only a single error message when shortlist fails in confirmShortlist', async () => {
    const errorSpy = vi.fn();
    let onOkPromise: Promise<unknown> | undefined;
    const useAppSpy = vi.spyOn(AntApp, 'useApp').mockReturnValue({
      message: {
        success: vi.fn(),
        error: errorSpy,
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
      } as any,
      modal: {
        confirm: vi.fn((config: any) => {
          onOkPromise = config.onOk?.();
        }),
      } as any,
      notification: {} as any,
    });

    try {
      vi.mocked(screeningApi.updateStatus).mockRejectedValue(
        new AxiosError('Conflict', undefined, undefined, undefined, {
          status: 409,
          data: { message: 'Hồ sơ đã bị thay đổi bởi người khác.' },
        } as any)
      );

      renderWorkbench(
        {
          ...baseApplication,
          serviceTypeCode: 'CV_SOURCING',
          status: 'SCREENING',
          currentStage: 'SCREENING',
          allowedActions: ['SHORTLIST'],
        },
        'hr'
      );

      const shortlistBtn = await screen.findByRole('button', { name: /Chọn gửi Client/i }, { timeout: 10000 });
      fireEvent.click(shortlistBtn);
      await onOkPromise;

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('Hồ sơ đã bị thay đổi bởi người khác.');
    } finally {
      useAppSpy.mockRestore();
    }
  });

  it('loads the existing offer document link and sends its edited value when Client updates a draft', async () => {
    renderWorkbench({
      ...baseApplication,
      allowedActions: ['UPDATE_OFFER'],
      offers: [
        {
          offerId: 'offer-1',
          offerVersion: 1,
          salary: 40000000,
          currencyCode: 'VND',
          salaryBasis: 'GROSS',
          salaryPeriod: 'MONTHLY',
          monthlyGrossSalary: 40000000,
          startDate: '2026-12-01',
          expiryDate: '2026-11-20',
          status: 'DRAFT',
          offerDocumentUrl: 'https://files.example.com/offer-v1.pdf',
          sentAt: null,
          respondedAt: null,
          declineReason: null,
          concurrencyToken: 'offer-token',
        },
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa offer' }));

    const documentUrl = screen.getByLabelText('Đính kèm link thư mời / hợp đồng (không bắt buộc)');
    expect(documentUrl).toHaveValue('https://files.example.com/offer-v1.pdf');

    fireEvent.change(documentUrl, { target: { value: 'https://files.example.com/offer-v2.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu offer' }));

    await waitFor(() => {
      expect(clientActionsApi.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          offerDocumentUrl: 'https://files.example.com/offer-v2.pdf',
          concurrencyToken: 'offer-token',
        })
      );
    });
  });

  it('explains offer terms and fixes Gross monthly salary for a Headhunt job', async () => {
    renderWorkbench({
      ...baseApplication,
      serviceTypeCode: 'HEADHUNT_COD',
      allowedActions: ['CREATE_OFFER'],
      offers: [],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Tạo offer' }));

    expect(screen.getByLabelText('Mức lương Gross mỗi tháng')).toBeInTheDocument();
    expect(screen.getByText(/Lương trước thuế mỗi tháng theo quy định tin tuyển dụng/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Lương Net/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hạn phản hồi Offer')).toBeInTheDocument();
    expect(screen.getByText(/Hạn cuối để ứng viên đồng ý hoặc từ chối/)).toBeInTheDocument();
    expect(screen.getByLabelText('Đính kèm link thư mời / hợp đồng (không bắt buộc)')).toBeInTheDocument();
  });

  it('does not render Client MF-04 mutation controls for Internal HR when the backend does not allow them', async () => {
    renderWorkbench({ ...baseApplication, allowedActions: [], offers: [] }, 'hr');

    await screen.findByText('Nguyễn Văn A');

    expect(screen.queryByRole('button', { name: 'Lên lịch phỏng vấn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận đã đi làm' })).not.toBeInTheDocument();
  });

  it('defaults actual start to the eligible planned date when Client confirms start work', async () => {
    const plannedStart = dayjs().subtract(1, 'day');
    renderWorkbench({
      ...baseApplication,
      status: 'OFFER_ACCEPTED',
      currentStage: 'OFFER',
      plannedStartDate: plannedStart.format('YYYY-MM-DD'),
      allowedActions: ['CONFIRM_PLACEMENT'],
      offers: [
        {
          offerId: 'offer-accepted',
          offerVersion: 1,
          status: 'ACCEPTED',
          respondedAt: plannedStart.subtract(1, 'day').toISOString(),
          concurrencyToken: 'offer-token',
        },
      ],
    });

    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đã đi làm' }));

    expect(screen.getByLabelText('Ngày thực tế đi làm')).toHaveValue(plannedStart.format('DD/MM/YYYY'));
    expect(screen.getByText('Bảo hành và hạn thanh toán sẽ được tính từ ngày thực tế đi làm.')).toBeInTheDocument();
    expect(screen.getByLabelText('Ghi chú (không bắt buộc)')).toBeInTheDocument();
  });

  it('requires a reason when the actual start date differs from the planned date', async () => {
    renderWorkbench({
      ...baseApplication,
      status: 'OFFER_ACCEPTED',
      currentStage: 'OFFER',
      plannedStartDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      allowedActions: ['CONFIRM_PLACEMENT'],
      offers: [
        {
          offerId: 'offer-accepted',
          offerVersion: 1,
          status: 'ACCEPTED',
          respondedAt: dayjs().subtract(1, 'day').toISOString(),
          concurrencyToken: 'offer-token',
        },
      ],
    });

    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đã đi làm' }));

    expect(screen.getByText('Ngày thực tế khác ngày dự kiến — cần ghi rõ lý do.')).toBeInTheDocument();
    expect(screen.getByLabelText('Lý do ngày thực tế khác ngày dự kiến')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Nhập lý do ngày thực tế khác ngày dự kiến.')).toBeInTheDocument();
    expect(clientActionsApi.confirmStartWork).not.toHaveBeenCalled();
  });

  it('shows the planned start change count and the 60-day offer limit', async () => {
    const offerStartDate = dayjs().add(10, 'day').startOf('day');
    renderWorkbench(
      {
        ...baseApplication,
        status: 'OFFER_ACCEPTED',
        currentStage: 'OFFER',
        plannedStartDate: offerStartDate.format('YYYY-MM-DD'),
        allowedActions: ['CONFIRM_PLANNED_START_DATE'],
        offers: [
          {
            offerId: 'offer-accepted',
            offerVersion: 1,
            status: 'ACCEPTED',
            startDate: offerStartDate.format('YYYY-MM-DD'),
            respondedAt: dayjs().subtract(1, 'day').toISOString(),
            concurrencyToken: 'offer-token',
          },
        ],
      },
      'client',
      [
        { eventType: 'PLANNED_START_DATE_CHANGED' },
        { eventType: 'PLANNED_START_DATE_CHANGED' },
      ]
    );

    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(await screen.findByRole('button', { name: 'Dời ngày nhận việc' }));

    expect(await screen.findByText('Đã dời 2/3 lần')).toBeInTheDocument();
    expect(screen.getByText(`Ngày mới không được muộn hơn ${offerStartDate.add(60, 'day').format('DD/MM/YYYY')} (60 ngày từ ngày trong offer).`)).toBeInTheDocument();
  });

  it('treats a failed interview as rejection without offering another interview round', async () => {
    renderWorkbench({
      ...baseApplication,
      status: 'INTERVIEW',
      currentStage: 'INTERVIEW',
      allowedActions: ['RECORD_INTERVIEW_RESULT'],
      offers: [],
      interviews: [
        {
          interviewId: 'interview-1',
          interviewRound: 1,
          scheduledAt: '2026-10-01T08:00:00Z',
          status: 'SCHEDULED',
          result: null,
          concurrencyToken: 'interview-token',
        },
      ],
    });

    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi kết quả' }, { timeout: 10000 }));
    fireEvent.click(screen.getByRole('radio', { name: 'Đạt' }));
    expect(screen.getByRole('radio', { name: 'Phỏng vấn thêm vòng nữa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Không đạt' }));

    expect(screen.getByText(/“Không đạt” sẽ kết thúc quy trình tuyển dụng/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Phỏng vấn thêm vòng nữa' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Nhập nhận xét phỏng vấn.')).toBeInTheDocument();
    expect(clientActionsApi.recordResult).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nhận xét / Đánh giá chi tiết'), {
      target: { value: 'Không đáp ứng yêu cầu chuyên môn.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => {
      expect(clientActionsApi.recordResult).toHaveBeenCalledWith('interview-1', {
        result: 'FAIL',
        feedback: 'Không đáp ứng yêu cầu chuyên môn.',
        nextAction: undefined,
        concurrencyToken: 'interview-token',
      });
    });
  }, 60000);

  it('switches scheduled interview controls to result, no-show or reschedule after the interview window', async () => {
    renderWorkbench({
      ...baseApplication,
      status: 'INTERVIEW',
      currentStage: 'INTERVIEW',
      allowedActions: ['CANCEL_INTERVIEW', 'UPDATE_INTERVIEW', 'RESCHEDULE_INTERVIEW', 'RECORD_NO_SHOW', 'RECORD_INTERVIEW_RESULT'],
      offers: [],
      interviews: [
        {
          interviewId: 'interview-overdue',
          interviewRound: 1,
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 60,
          status: 'SCHEDULED',
          result: null,
          concurrencyToken: 'interview-token',
        },
      ],
    });

    expect(await screen.findByText('Quá giờ · Chờ cập nhật')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vắng mặt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dời lịch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi kết quả' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy lịch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa thông tin lịch/i })).not.toBeInTheDocument();
  });

  it('renders polished send offer confirmation modal with offer summary and sends offer on confirm', async () => {
    vi.mocked(clientActionsApi.sendOffer).mockResolvedValue({ message: 'Đã gửi offer cho ứng viên.' });

    renderWorkbench({
      ...baseApplication,
      allowedActions: ['SEND_OFFER'],
      offers: [
        {
          offerId: 'offer-1',
          offerVersion: 1,
          salary: 40000000,
          currencyCode: 'VND',
          salaryBasis: 'GROSS',
          salaryPeriod: 'MONTHLY',
          monthlyGrossSalary: 40000000,
          startDate: '2026-12-01',
          expiryDate: '2026-11-20',
          status: 'DRAFT',
          offerDocumentUrl: null,
          sentAt: null,
          respondedAt: null,
          declineReason: null,
          concurrencyToken: 'offer-token',
        },
      ],
    });

    await screen.findByText('Nguyễn Văn A');
    const sendBtn = await screen.findByRole('button', { name: 'Gửi offer' });
    fireEvent.click(sendBtn);

    const titles = await screen.findAllByText('Xác nhận gửi thư mời nhận việc (Offer)');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Vui lòng kiểm tra lại thông tin trước khi gửi thư mời chính thức đến ứng viên/)).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Vị trí tuyển dụng:')).toBeInTheDocument();
    expect(screen.getByText('Mức lương đề xuất:')).toBeInTheDocument();
    expect(screen.getByText(/40\.000\.000 VNĐ/)).toBeInTheDocument();
    expect(screen.getByText('Ngày nhận việc dự kiến:')).toBeInTheDocument();
    expect(screen.getByText('01/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Hạn phản hồi:')).toBeInTheDocument();
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();

    expect(
      screen.getByText('Lưu ý: Sau khi gửi, thông tin Offer sẽ được gửi trực tiếp cho ứng viên và không thể chỉnh sửa (chỉ có thể thu hồi).')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Quay lại chỉnh sửa' })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận & Gửi Offer' });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clientActionsApi.sendOffer).toHaveBeenCalledWith('offer-1', 'offer-token');
    });
  }, 60000);
});

describe('ApplicationWorkbench MF-03 CV Sourcing shortlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewHistoryApi.get).mockResolvedValue([]);
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: { sourcingTarget: 5, delivered: 0, accepted: 0, autoAccepted: 0, rejected: 0, pendingReview: 0, counted: 0, reviewDays: 5 },
      items: [],
    } as any);
  });

  it('keeps the shortlist and warns when the hand-over to the Client is rejected with 409', async () => {
    vi.mocked(screeningApi.updateStatus).mockResolvedValue({} as any);
    vi.mocked(sourcingApi.deliverCvs).mockRejectedValue(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: { success: false, code: 'CONSENT_NOT_CONFIRMED', message: 'Ứng viên chưa xác nhận đồng ý chia sẻ CV.' },
      })
    );

    renderWorkbench(
      {
        ...baseApplication,
        status: 'SCREENING',
        currentStage: 'SCREENING',
        serviceTypeCode: 'CV_SOURCING',
        allowedActions: ['SHORTLIST'],
        offers: [],
      },
      'hr'
    );

    await screen.findByText('Nguyễn Văn A');
    const shortlistButton = await screen.findByRole('button', { name: /Chọn gửi Client/ });
    await waitFor(() => expect(sourcingApi.getDeliveries).toHaveBeenCalledWith('job-1'));
    await act(async () => {});
    fireEvent.click(shortlistButton);
    expect(await screen.findByText(/Doanh nghiệp sẽ chấp nhận hoặc từ chối CV trong 5 ngày\./)).toBeInTheDocument();
    const fetchesBefore = vi.mocked(screeningApi.get).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Chọn & giao Client/ }));

    expect(
      await screen.findByText(
        'Đã chuyển hồ sơ sang danh sách Đạt, nhưng chưa bàn giao được cho Doanh nghiệp: Ứng viên chưa xác nhận đồng ý chia sẻ CV.'
      )
    ).toBeInTheDocument();
    expect(screeningApi.updateStatus).toHaveBeenCalledWith('job-1', 'app-1', {
      targetStatus: 'SHORTLISTED',
      concurrencyToken: 'application-token',
    });
    expect(sourcingApi.deliverCvs).toHaveBeenCalledWith('job-1', ['app-1']);
    expect(screen.queryByText('Ứng viên chưa xác nhận đồng ý chia sẻ CV.')).not.toBeInTheDocument();
    expect(screen.queryByText('Không thực hiện được thao tác.')).not.toBeInTheDocument();
    expect(vi.mocked(screeningApi.get).mock.calls.length).toBeGreaterThan(fetchesBefore);
    await waitFor(() => expect(vi.mocked(sourcingApi.getDeliveries).mock.calls.length).toBeGreaterThanOrEqual(2));
  }, 60000);
});

describe('ApplicationWorkbench withdrawn application (Client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewHistoryApi.get).mockResolvedValue([]);
  });

  it('opens a withdrawn application from a notification with its status and no actions', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'WITHDRAWN',
        currentStage: 'CLOSED',
        statusReason: 'Đã nhận công việc khác.',
        allowedActions: [],
        offers: [],
        interviews: [],
      },
      'client'
    );

    expect(await screen.findByText('Nguyễn Văn A', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText('Đã rút hồ sơ').length).toBeGreaterThan(0);
    for (const action of [/Chọn ứng viên/, /Loại hồ sơ/, /Lên lịch phỏng vấn/, /Gửi offer/, /dự phòng/]) {
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    }
    expect(screeningApi.startScreening).not.toHaveBeenCalled();
  }, 60000);
});

describe('ApplicationWorkbench AI evidence (FE-M04)', () => {
  const aiMatch = (overrides: Record<string, unknown>) => ({
    matchScore: 78,
    matchTier: 'MEDIUM_HIGH',
    candidateHighlight: null,
    status: 'COMPLETED',
    parseConfidence: null,
    requiresManualReview: false,
    semanticScore: null,
    warnings: [],
    missingRequirements: [],
    matchingReasons: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewHistoryApi.get).mockResolvedValue([]);
  });

  it('shows the matching reasons when the highlight list is empty', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SHORTLISTED',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({ candidateHighlight: '[]', matchingReasons: ['5 năm .NET đáp ứng yêu cầu 3 năm', 'Đã làm Azure'] }),
      },
      'hr'
    );

    expect(await screen.findByText('5 năm .NET đáp ứng yêu cầu 3 năm', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Đã làm Azure')).toBeInTheDocument();
    expect(screen.queryByText('AI chưa trả về giải thích chi tiết.')).not.toBeInTheDocument();
  }, 60000);

  it('merges highlights and matching reasons without repeating the same line', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SHORTLISTED',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({ candidateHighlight: JSON.stringify(['Đã làm Azure']), matchingReasons: ['đã làm  azure', 'Có chứng chỉ AWS'] }),
      },
      'hr'
    );

    expect(await screen.findByText('Có chứng chỉ AWS', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText(/azure/i)).toHaveLength(1);
  }, 60000);

  it('still says no explanation only when highlights, reasons and missing items are all empty', async () => {
    renderWorkbench(
      { ...baseApplication, status: 'SHORTLISTED', allowedActions: [], offers: [], aiMatch: aiMatch({}) },
      'hr'
    );

    expect(await screen.findByText('AI chưa trả về giải thích chi tiết.', {}, { timeout: 5000 })).toBeInTheDocument();
  }, 60000);

  it('explains a FAILED scoring to Internal HR with the reason, code and detail', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SCREENING',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({
          status: 'FAILED',
          matchScore: null,
          failureCode: 'AI_TIMEOUT',
          errorMessage: 'AI chấm quá 600 giây. Hồ sơ cần HR xem thủ công.',
        }),
      },
      'hr'
    );

    expect(await screen.findByText('AI chấm quá thời gian cho phép.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('AI_TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText('AI chấm quá 600 giây. Hồ sơ cần HR xem thủ công.')).toBeInTheDocument();
  }, 60000);

  it('shows the Client a readable reason but no technical code or detail', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SUBMITTED',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({ status: 'FAILED', matchScore: null, failureCode: 'UNSUPPORTED_CV_FORMAT', errorMessage: null }),
      },
      'client'
    );

    expect(
      await screen.findByText('Định dạng CV không được hỗ trợ hoặc không đọc được nội dung CV.', {}, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(screen.queryByText('UNSUPPORTED_CV_FORMAT')).not.toBeInTheDocument();
    expect(screen.queryByText('Mã lỗi:')).not.toBeInTheDocument();
  }, 60000);

  it('falls back to the code for a failure code it does not know', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SCREENING',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({ status: 'FAILED', matchScore: null, failureCode: 'SOMETHING_NEW' }),
      },
      'hr'
    );

    expect(await screen.findByText('Lỗi chấm điểm (mã SOMETHING_NEW).', {}, { timeout: 5000 })).toBeInTheDocument();
  }, 60000);

  it('[FE-m02] disables re-scoring button when AI status is PENDING or PROCESSING', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SCREENING',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({ status: 'PROCESSING', matchScore: null }),
      },
      'hr'
    );

    const btn = await screen.findByRole('button', { name: /Đang chấm điểm…/ }, { timeout: 5000 });
    expect(btn).toBeDisabled();
  }, 60000);

  it('[FE-m03] displays Nghỉ trong bảo hành when placement status is LEFT_DURING_WARRANTY', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'PLACED',
        allowedActions: [],
        offers: [],
        placement: {
          placementId: 'pl-1',
          actualStartDate: '2026-10-01',
          endDate: '2026-10-20',
          status: 'LEFT_DURING_WARRANTY',
          guaranteeEndDate: '2026-11-01',
          resignationReason: 'Không phù hợp văn hóa',
        },
      },
      'hr'
    );

    expect(await screen.findByText(/Nghỉ trong bảo hành/)).toBeInTheDocument();
    expect(screen.getByText(/20\/10\/2026/)).toBeInTheDocument();
  }, 60000);

  it('[BE-M04/FE] displays matching and missing requirements parsed from mustHaveResult and shouldHaveResult', async () => {
    renderWorkbench(
      {
        ...baseApplication,
        status: 'SHORTLISTED',
        allowedActions: [],
        offers: [],
        aiMatch: aiMatch({
          candidateHighlight: '[]',
          matchingReasons: [],
          missingRequirements: [],
          mustHaveResult: JSON.stringify([
            { requirement: '3 năm kinh nghiệm .NET', type: 'MUST_HAVE', matched: true, matchStatus: 'MATCHED' },
            { requirement: 'Tiếng Anh giao tiếp tốt', type: 'MUST_HAVE', matched: false, matchStatus: 'MISSING' },
          ]),
          shouldHaveResult: JSON.stringify([
            { requirement: 'Có kiến thức Docker/K8s', type: 'SHOULD_HAVE', matched: true, matchStatus: 'MATCHED' },
          ]),
        }),
      },
      'hr'
    );

    expect(await screen.findByText('3 năm kinh nghiệm .NET', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Có kiến thức Docker/K8s')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Anh giao tiếp tốt')).toBeInTheDocument();
  }, 60000);
});
