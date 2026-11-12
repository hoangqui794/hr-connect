import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import dayjs from 'dayjs';
import { CandidateResignModal } from './CandidateResignModal';
import * as placementApiModule from '@/services/api/placementApi';

vi.mock('@/services/api/placementApi', () => ({
  selfReportResignation: vi.fn(),
}));

describe('CandidateResignModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with guidance text and default resignation reason', () => {
    render(
      <App>
        <CandidateResignModal
          open={true}
          onClose={vi.fn()}
          applicationId="app-123"
          jobTitle="Digital Marketing Specialist"
          companyName="Thủ Đức Company"
          startDate="2026-11-01"
        />
      </App>
    );

    expect(screen.getByText('Cập nhật đã nghỉ việc')).toBeDefined();
    expect(screen.getByText(/Digital Marketing Specialist · Thủ Đức Company/)).toBeDefined();
    expect(screen.getByText(/Xác nhận kết thúc công việc này sẽ cập nhật lịch sử làm việc/)).toBeDefined();
    expect(screen.getByText('Sẵn sàng tìm việc')).toBeDefined();
    expect(screen.getByText('01/11/2026')).toBeDefined();
  });

  it('calls selfReportResignation when confirmed', async () => {
    vi.mocked(placementApiModule.selfReportResignation).mockResolvedValueOnce({
      success: true,
      message: 'Đã cập nhật trạng thái nghỉ việc.',
    });

    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <App>
        <CandidateResignModal
          open={true}
          onClose={onCloseMock}
          applicationId="app-123"
          jobTitle="Digital Marketing Specialist"
          companyName="Thủ Đức Company"
          startDate="2026-11-01"
          onSuccess={onSuccessMock}
        />
      </App>
    );

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận kết thúc công việc/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(placementApiModule.selfReportResignation).toHaveBeenCalledWith(
        'app-123',
        expect.objectContaining({
          resignationDate: dayjs().format('YYYY-MM-DD'),
          reason: 'Tìm kiếm cơ hội phát triển mới',
        })
      );
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});

