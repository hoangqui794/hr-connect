/**
 * @file services/api/contactApi.ts
 * @description API client for public consultation contact requests and admin management (SF-05).
 * Endpoints:
 *   - POST /public/contact-requests (Guest / Public)
 *   - GET /admin/contact-requests (Admin / Internal HR)
 *   - PATCH /admin/contact-requests/{id} (Admin / Internal HR)
 */

import { apiClient } from '../apiClient';
import type {
  ContactRequestDto,
  ContactRequestListParams,
  ContactRequestPageDto,
  ContactRequestReceipt,
  SubmitContactRequestInput,
  UpdateContactRequestInput,
} from '@/types/api/contact';

const cleanParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;

interface Envelope<T> {
  success?: boolean;
  data: T;
  message?: string;
}

export const contactApi = {
  /**
   * POST /public/contact-requests
   * Public consultation request submission (Guest - no auth required).
   */
  async submit(input: SubmitContactRequestInput): Promise<ContactRequestReceipt> {
    const res = await apiClient.post<Envelope<ContactRequestReceipt> | ContactRequestReceipt>(
      '/public/contact-requests',
      input
    );
    const body = res.data as any;
    return (body && typeof body === 'object' && 'data' in body ? body.data : body) as ContactRequestReceipt;
  },

  /**
   * GET /admin/contact-requests
   * List contact requests with pagination and status filter.
   */
  async list(params: ContactRequestListParams = {}): Promise<ContactRequestPageDto> {
    const res = await apiClient.get<Envelope<ContactRequestPageDto> | ContactRequestPageDto>(
      '/admin/contact-requests',
      {
        params: cleanParams(params),
      }
    );
    const body = res.data as any;
    return (body && typeof body === 'object' && 'data' in body ? body.data : body) as ContactRequestPageDto;
  },

  /**
   * PATCH /admin/contact-requests/{id}
   * Update the status and/or internal note for a contact request.
   */
  async updateStatus(
    id: string,
    input: UpdateContactRequestInput
  ): Promise<ContactRequestDto> {
    const res = await apiClient.patch<Envelope<ContactRequestDto> | ContactRequestDto>(
      `/admin/contact-requests/${id}`,
      input
    );
    const body = res.data as any;
    return (body && typeof body === 'object' && 'data' in body ? body.data : body) as ContactRequestDto;
  },
};
