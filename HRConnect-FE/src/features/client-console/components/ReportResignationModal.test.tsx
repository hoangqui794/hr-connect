import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import dayjs from 'dayjs';
import { ReportResignationModal } from './ReportResignationModal';
import * as placementApiModule from '@/services/api/placementApi';
import type { PlacementItem } from '@/types/api/hr';

vi.mock('@/services/api/placementApi', () => ({
  reportCandidateResignation: vi.fn(),
  placementApi: {
    reportCandidateResignation: vi.fn(),
  },
}));

const mockPlacement: PlacementItem = {
  placementId: 'placement-123',
  applicationId: 'app-456',
  actualStartDate: '2026-11-01',
  position: 'Frontend Engineer',
  department: 'Product Development',
  status: 'STARTED',
  confirmedAt: '2026-11-01T08:00:00Z',
  confirmedByName: 'HR Admin',
  candidate: {
    candidateId: 'cand-789',
    fullName: 'Nguyễn Văn Test',
    email: 'nguyen.van.test@example.com',
    phoneNumber: '0987654321',
  },
  job: {
    jobId: 'job-101',
    title: 'Senior Frontend Developer',
    companyId: 'company-202',
    companyName: 'HR Connect Tech',
  },
};

describe('ReportResignationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open with candidate and warranty details', () => {
    render(
      <App>
        <ReportResignationModal
          open={true}
          onClose={vi.fn()}
          placement={mockPlacement}
        />
      </App>
    );

    expect(screen.getByText('Báo nhân sự nghỉ việc')).toBeDefined();
    expect(screen.getByText('Nguyễn Văn Test')).toBeDefined();
    expect(screen.getByText('Senior Frontend Developer')).toBeDefined();
    expect(screen.getByText('Chính sách bảo hành ứng viên:')).toBeDefined();
    expect(screen.getByText(/Nếu ứng viên nghỉ trong thời hạn bảo hành/)).toBeDefined();
  });

  it('submits resignation successfully with valid inputs', async () => {
    vi.mocked(placementApiModule.reportCandidateResignation).mockResolvedValueOnce({
      success: true,
      message: 'Đã báo nghỉ việc thành công.',
    });

    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <App>
        <ReportResignationModal
          open={true}
          onClose={onCloseMock}
          placement={mockPlacement}
          onSuccess={onSuccessMock}
        />
      </App>
    );

    const submitBtn = screen.getByRole('button', { name: /Xác nhận báo nghỉ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(placementApiModule.reportCandidateResignation).toHaveBeenCalledWith(
        'app-456',
        expect.objectContaining({
          reason: 'Ứng viên tự xin nghỉ',
          resignationDate: dayjs().format('YYYY-MM-DD'),
        })
      );
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});

