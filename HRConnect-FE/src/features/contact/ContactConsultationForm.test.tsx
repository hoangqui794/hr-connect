import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App as AntApp } from 'antd';
import { ContactConsultationForm } from './ContactConsultationForm';
import { contactApi } from '@/services/api/contactApi';

vi.mock('@/services/api/contactApi', () => ({
  contactApi: {
    submit: vi.fn(),
  },
}));

const submitMock = vi.mocked(contactApi.submit);

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

const renderForm = () => {
  return render(
    <AntApp>
      <ContactConsultationForm />
    </AntApp>
  );
};

describe('ContactConsultationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields and consent checkbox', () => {
    renderForm();

    expect(screen.getByText('Đăng ký tư vấn tuyển dụng')).toBeInTheDocument();
    expect(screen.getByText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByText('Email công việc')).toBeInTheDocument();
    expect(screen.getByText('Dịch vụ quan tâm')).toBeInTheDocument();
    expect(screen.getByText('Nội dung yêu cầu tư vấn')).toBeInTheDocument();
    expect(
      screen.getByText(/Nghị định 13\/2023\/NĐ-CP/)
    ).toBeInTheDocument();
  });

  it('displays validation error if consent checkbox is not ticked on submit', async () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'vana@example.com' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Mô tả vị trí tuyển dụng/),
      { target: { value: 'Cần tư vấn tuyển dụng 3 Senior React Dev trọn gói.' } }
    );

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Vui lòng đồng ý với chính sách xử lý dữ liệu cá nhân/, {}, { timeout: 10000 })
    ).toBeInTheDocument();

    expect(submitMock).not.toHaveBeenCalled();
  });

  it('submits form successfully and displays receipt when valid', async () => {
    submitMock.mockResolvedValueOnce({
      contactRequestId: 'req-success-123',
      status: 'NEW',
      createdAt: '2026-10-19T10:00:00Z',
    });

    renderForm();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'vana@example.com' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Mô tả vị trí tuyển dụng/),
      { target: { value: 'Cần tư vấn tuyển dụng 3 Senior React Dev trọn gói.' } }
    );

    // Tick consent checkbox
    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Nguyễn Văn A',
          email: 'vana@example.com',
          message: 'Cần tư vấn tuyển dụng 3 Senior React Dev trọn gói.',
          consentAccepted: true,
        })
      );
      expect(screen.getByText('Gửi yêu cầu tư vấn thành công!')).toBeInTheDocument();
      expect(screen.getByText('req-success-123')).toBeInTheDocument();
    });
  });

  it('handles 429 rate limited error gracefully', async () => {
    const error: any = new Error('Too many requests');
    error.isAxiosError = true;
    error.response = {
      status: 429,
      data: {
        code: 'CONTACT_RATE_LIMITED',
        message: 'Bạn gửi quá nhiều, vui lòng thử lại sau',
        retryAfterSeconds: 60,
      },
    };
    submitMock.mockRejectedValueOnce(error);

    renderForm();

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'vana@example.com' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Mô tả vị trí tuyển dụng/),
      { target: { value: 'Cần tư vấn tuyển dụng 3 Senior React Dev trọn gói.' } }
    );

    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Bạn gửi quá nhiều, vui lòng thử lại sau/).length).toBeGreaterThan(0);
    });
  });
});
