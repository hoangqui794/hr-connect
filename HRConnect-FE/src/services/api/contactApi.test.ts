import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contactApi } from './contactApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('contactApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submit', () => {
    it('calls POST /public/contact-requests with correct payload', async () => {
      const mockInput = {
        fullName: 'Nguyễn Văn A',
        email: 'vana@example.com',
        phone: '0901234567',
        companyName: 'Công ty ABC',
        serviceInterest: 'HEADHUNT_COD' as const,
        message: 'Cần tư vấn tuyển dụng 5 Senior Dev',
        consentAccepted: true,
      };

      const mockReceipt = {
        contactRequestId: 'req-123',
        status: 'NEW',
        createdAt: '2026-10-19T10:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockReceipt,
        },
      } as any);

      const result = await contactApi.submit(mockInput);
      expect(apiClient.post).toHaveBeenCalledWith('/public/contact-requests', mockInput);
      expect(result).toEqual(mockReceipt);
    });

    it('handles direct response without envelope', async () => {
      const mockInput = {
        fullName: 'Trần Thị B',
        email: 'thib@example.com',
        serviceInterest: 'CV_SOURCING' as const,
        message: 'Cần nguồn CV Designer',
        consentAccepted: true,
      };

      const mockReceipt = {
        contactRequestId: 'req-456',
        status: 'NEW',
        createdAt: '2026-10-19T11:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: mockReceipt,
      } as any);

      const result = await contactApi.submit(mockInput);
      expect(result).toEqual(mockReceipt);
    });
  });

  describe('list', () => {
    it('calls GET /admin/contact-requests with cleaned params', async () => {
      const mockPage = {
        items: [
          {
            contactRequestId: 'req-1',
            fullName: 'Lê Văn C',
            email: 'vanc@example.com',
            phone: '0912345678',
            companyName: 'Tập đoàn XYZ',
            serviceInterest: 'CV_APPLICATION' as const,
            message: 'Tư vấn gói đăng tin',
            status: 'NEW' as const,
            createdAt: '2026-10-19T09:00:00Z',
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockPage,
        },
      } as any);

      const result = await contactApi.list({ status: 'NEW', page: 1, pageSize: 20 });
      expect(apiClient.get).toHaveBeenCalledWith('/admin/contact-requests', {
        params: { status: 'NEW', page: 1, pageSize: 20 },
      });
      expect(result).toEqual(mockPage);
    });

    it('cleans empty status from params', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 20 },
      } as any);

      await contactApi.list({ status: '', page: 1, pageSize: 20 });
      expect(apiClient.get).toHaveBeenCalledWith('/admin/contact-requests', {
        params: { page: 1, pageSize: 20 },
      });
    });
  });

  describe('updateStatus', () => {
    it('calls PATCH /admin/contact-requests/{id} with status and note', async () => {
      const mockUpdated = {
        contactRequestId: 'req-1',
        fullName: 'Lê Văn C',
        email: 'vanc@example.com',
        phone: '0912345678',
        companyName: 'Tập đoàn XYZ',
        serviceInterest: 'CV_APPLICATION' as const,
        message: 'Tư vấn gói đăng tin',
        status: 'CONTACTED' as const,
        note: 'Đã gọi điện trao đổi',
        createdAt: '2026-10-19T09:00:00Z',
        updatedAt: '2026-10-19T10:30:00Z',
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockUpdated,
        },
      } as any);

      const result = await contactApi.updateStatus('req-1', {
        status: 'CONTACTED',
        note: 'Đã gọi điện trao đổi',
      });

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/contact-requests/req-1', {
        status: 'CONTACTED',
        note: 'Đã gọi điện trao đổi',
      });
      expect(result).toEqual(mockUpdated);
    });
  });
});
