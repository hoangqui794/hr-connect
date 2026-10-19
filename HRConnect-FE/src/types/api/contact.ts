/**
 * @file types/api/contact.ts
 * @description Types for public consultation contact requests and admin management (SF-05).
 */

export type ContactServiceInterest =
  | 'HEADHUNT_COD'
  | 'CV_SOURCING'
  | 'CV_APPLICATION'
  | 'OTHER';

export type ContactRequestStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

export interface SubmitContactRequestInput {
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  serviceInterest: ContactServiceInterest;
  message: string;
  consentAccepted: boolean;
}

export interface ContactRequestReceipt {
  contactRequestId: string;
  status: string;
  createdAt: string;
}

export interface ContactRequestDto {
  contactRequestId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  serviceInterest: ContactServiceInterest;
  message: string;
  status: ContactRequestStatus;
  handledBy?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ContactRequestPageDto {
  items: ContactRequestDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ContactRequestListParams {
  status?: ContactRequestStatus | '';
  page?: number;
  pageSize?: number;
}

export interface UpdateContactRequestInput {
  status: ContactRequestStatus;
  note?: string | null;
}
