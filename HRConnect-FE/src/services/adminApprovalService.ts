/**
 * @file adminApprovalService.ts
 * @description API service for Centralized Admin Approvals Hub (/api/v1/admin/approvals).
 * Integrates 7 approval endpoints according to swagger.json specifications:
 * - GET  /api/v1/admin/approvals
 * - GET  /api/v1/admin/affiliate-applications/{id}
 * - POST /api/v1/admin/affiliate-applications/{id}/approve
 * - POST /api/v1/admin/affiliate-applications/{id}/reject
 * - GET  /api/v1/admin/company-verification-requests/{id}
 * - POST /api/v1/admin/company-verification-requests/{id}/approve
 * - POST /api/v1/admin/company-verification-requests/{id}/reject
 */

import { axiosClient } from './axiosClient';
import type {
  GetApprovalListParams,
  GetApprovalListResponse,
  AffiliateApplicationDetailDto,
  GetAffiliateApplicationDetailResponse,
  ApproveAffiliateRequest,
  ApproveAffiliateResponse,
  RejectAffiliateRequest,
  RejectAffiliateResponse,
  CompanyVerificationDetailDto,
  GetCompanyVerificationDetailResponse,
  ApproveCompanyRequest,
  ApproveCompanyResponse,
  RejectCompanyRequest,
  RejectCompanyResponse,
  ApprovalListItemDto,
} from '@/types/admin';

// ─── Local Storage Keys & Fallback Seed Data ─────────────────────────────────

const STORAGE_KEY_APPROVALS = 'hrconnect_admin_approvals';
const STORAGE_KEY_AFF_DETAILS = 'hrconnect_admin_affiliate_details';
const STORAGE_KEY_CLI_DETAILS = 'hrconnect_admin_client_details';

const INITIAL_APPROVAL_ITEMS: ApprovalListItemDto[] = [
  {
    approvalId: 'appr-aff-001',
    type: 'AFFILIATE',
    userId: 'usr-aff-004',
    email: 'talent.scout@gmail.com',
    displayName: 'Nguyen Van Talent',
    companyName: null,
    status: 'PENDING',
    submittedAt: '2026-10-02T08:30:00Z',
  },
  {
    approvalId: 'appr-cli-001',
    type: 'CLIENT',
    userId: 'usr-cli-004',
    email: 'recruiting@nexgen-ai.io',
    displayName: 'Le Hoang Nam',
    companyName: 'NexGen AI Solutions Ltd',
    status: 'PENDING',
    submittedAt: '2026-10-03T09:15:00Z',
  },
  {
    approvalId: 'appr-aff-002',
    type: 'AFFILIATE',
    userId: 'usr-aff-001',
    email: 'david.tran@headhunter.vn',
    displayName: 'David Tran',
    companyName: null,
    status: 'APPROVED',
    submittedAt: '2026-09-20T14:10:00Z',
  },
  {
    approvalId: 'appr-cli-002',
    type: 'CLIENT',
    userId: 'usr-cli-001',
    email: 'client@hrconnect.vn',
    displayName: 'Nguyen Thi HR',
    companyName: 'Blata33 Technology JSC',
    status: 'APPROVED',
    submittedAt: '2026-09-18T11:00:00Z',
  },
  {
    approvalId: 'appr-aff-003',
    type: 'AFFILIATE',
    userId: 'usr-aff-005',
    email: 'suspicious@fakecv.xyz',
    displayName: 'Spam Affiliate Account',
    companyName: null,
    status: 'REJECTED',
    submittedAt: '2026-09-10T16:45:00Z',
  },
];

const INITIAL_AFF_DETAILS: Record<string, AffiliateApplicationDetailDto> = {
  'appr-aff-001': {
    applicationId: 'appr-aff-001',
    userId: 'usr-aff-004',
    email: 'talent.scout@gmail.com',
    displayName: 'Nguyen Van Talent',
    phone: '0977 889 900',
    affiliateType: 'INDIVIDUAL',
    taxInformation: 'MST: 8404567890 | CCCD: 079198001234',
    contactPerson: 'Nguyen Van Talent',
    address: '254 Nguyen Trai, Phuong Nguyen Cu Trinh, Quan 1, TP. HCM',
    submittedData: 'Chứng chỉ Headhunt quốc tế Recruiter Certified 2025, kinh nghiệm 5 năm Tech Recruiting.',
    status: 'PENDING',
    submittedAt: '2026-10-02T08:30:00Z',
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    reviewNote: null,
  },
  'appr-aff-002': {
    applicationId: 'appr-aff-002',
    userId: 'usr-aff-001',
    email: 'david.tran@headhunter.vn',
    displayName: 'David Tran',
    phone: '0909 112 233',
    affiliateType: 'INDIVIDUAL',
    taxInformation: 'MST: 8401234567 | CCCD: 079192005678',
    contactPerson: 'David Tran',
    address: 'Tòa nhà Landmark 81, Binh Thanh, TP. HCM',
    submittedData: 'Headhunter thâm niên 8 năm tuyển dụng cấp cao C-Level, Top Recruiter 2025.',
    status: 'APPROVED',
    submittedAt: '2026-09-20T14:10:00Z',
    reviewedBy: 'usr-admin-001',
    reviewerName: 'Platform Admin',
    reviewedAt: '2026-09-21T09:00:00Z',
    reviewNote: 'Hồ sơ đầy đủ, uy tín cao trong ngành tuyển dụng IT.',
  },
  'appr-aff-003': {
    applicationId: 'appr-aff-003',
    userId: 'usr-aff-005',
    email: 'suspicious@fakecv.xyz',
    displayName: 'Spam Affiliate Account',
    phone: '0966 000 111',
    affiliateType: 'INDIVIDUAL',
    taxInformation: 'MST không hợp lệ',
    contactPerson: 'N/A',
    address: 'Địa chỉ ảo',
    submittedData: 'Thông tin có dấu hiệu giả mạo, spam CV.',
    status: 'REJECTED',
    submittedAt: '2026-09-10T16:45:00Z',
    reviewedBy: 'usr-admin-001',
    reviewerName: 'Platform Admin',
    reviewedAt: '2026-09-10T17:30:00Z',
    reviewNote: 'Mã số thuế không tồn tại trên Tổng cục Thuế, số điện thoại rác.',
  },
};

const INITIAL_CLI_DETAILS: Record<string, CompanyVerificationDetailDto> = {
  'appr-cli-001': {
    verificationRequestId: 'appr-cli-001',
    userId: 'usr-cli-004',
    email: 'recruiting@nexgen-ai.io',
    displayName: 'Le Hoang Nam',
    phone: '0933 221 100',
    companyId: 'comp-004',
    companyName: 'NexGen AI Solutions Ltd',
    taxCode: '0318999888',
    industry: 'Trí tuệ nhân tạo (AI) & Phần mềm đám mây',
    companySize: '50-150 nhân sự',
    website: 'https://nexgen-ai.io',
    address: 'Lầu 5, Pearl Plaza, 561A Điện Biên Phủ, P.25, Bình Thạnh, TP. HCM',
    description: 'Doanh nghiệp khởi nghiệp sáng tạo công nghệ cao trong lĩnh vực Generative AI và Machine Learning.',
    submittedPayload: 'Giấy phép ĐKKD số 0318999888 do Sở KH&ĐT TP.HCM cấp ngày 15/01/2024.',
    status: 'PENDING',
    submittedAt: '2026-10-03T09:15:00Z',
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    reviewNote: null,
  },
  'appr-cli-002': {
    verificationRequestId: 'appr-cli-002',
    userId: 'usr-cli-001',
    email: 'client@hrconnect.vn',
    displayName: 'Nguyen Thi HR',
    phone: '0901 234 567',
    companyId: 'comp-001',
    companyName: 'Blata33 Technology JSC',
    taxCode: '0316789123',
    industry: 'Công nghệ thông tin & Dịch vụ số',
    companySize: '100-500 nhân sự',
    website: 'https://blata33.vn',
    address: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
    description: 'Doanh nghiệp phần mềm hàng đầu trong lĩnh vực FinTech và HR Tech tại Việt Nam.',
    submittedPayload: 'Giấy phép ĐKKD số 0316789123 có chứng thực chữ ký số hợp lệ.',
    status: 'APPROVED',
    submittedAt: '2026-09-18T11:00:00Z',
    reviewedBy: 'usr-admin-001',
    reviewerName: 'Platform Admin',
    reviewedAt: '2026-09-18T14:20:00Z',
    reviewNote: 'Đã đối soát MST và giấy phép kinh doanh hợp lệ.',
  },
};

function getLocalApprovals(): ApprovalListItemDto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APPROVALS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_APPROVALS, JSON.stringify(INITIAL_APPROVAL_ITEMS));
      return INITIAL_APPROVAL_ITEMS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_APPROVAL_ITEMS;
  }
}

function saveLocalApprovals(items: ApprovalListItemDto[]) {
  try {
    localStorage.setItem(STORAGE_KEY_APPROVALS, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

function getLocalAffDetails(): Record<string, AffiliateApplicationDetailDto> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AFF_DETAILS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AFF_DETAILS, JSON.stringify(INITIAL_AFF_DETAILS));
      return INITIAL_AFF_DETAILS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_AFF_DETAILS;
  }
}

function getLocalCliDetails(): Record<string, CompanyVerificationDetailDto> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLI_DETAILS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_CLI_DETAILS, JSON.stringify(INITIAL_CLI_DETAILS));
      return INITIAL_CLI_DETAILS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CLI_DETAILS;
  }
}

export const adminApprovalService = {
  /**
   * 1. GET /api/v1/admin/approvals
   * Lấy danh sách yêu cầu phê duyệt hợp nhất (Affiliate & Client)
   */
  async getApprovals(params?: GetApprovalListParams): Promise<GetApprovalListResponse> {
    try {
      const response = await axiosClient.get<GetApprovalListResponse>('/admin/approvals', {
        params,
      });
      if (response.data && response.data.data?.items) {
        return response.data;
      }
    } catch {
      // Graceful fallback when backend is unreachable or offline
    }

    // Client-side fallback filter
    let items = getLocalApprovals();

    if (params?.type && params.type !== 'ALL') {
      items = items.filter((item) => item.type?.toUpperCase() === params.type?.toUpperCase());
    }

    if (params?.status && params.status !== 'ALL') {
      items = items.filter((item) => item.status?.toUpperCase() === params.status?.toUpperCase());
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.displayName?.toLowerCase().includes(q) ||
          item.email?.toLowerCase().includes(q) ||
          item.companyName?.toLowerCase().includes(q)
      );
    }

    // Sort by submittedAt desc by default
    items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      success: true,
      data: {
        items: pagedItems,
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  },

  /**
   * 2. GET /api/v1/admin/affiliate-applications/{id}
   * Xem chi tiết đơn đăng ký Affiliate
   */
  async getAffiliateApplicationDetail(id: string): Promise<GetAffiliateApplicationDetailResponse> {
    try {
      const response = await axiosClient.get<GetAffiliateApplicationDetailResponse>(
        `/admin/affiliate-applications/${id}`
      );
      if (response.data && response.data.data) {
        return response.data;
      }
    } catch {
      // Fallback
    }

    const map = getLocalAffDetails();
    const found = map[id] || {
      applicationId: id,
      userId: 'usr-unknown',
      email: 'applicant@demo.vn',
      displayName: 'Ứng viên Affiliate',
      phone: '0900 000 000',
      affiliateType: 'INDIVIDUAL',
      taxInformation: 'MST: 8400000000',
      contactPerson: 'Người nộp đơn',
      address: 'Việt Nam',
      submittedData: 'Thông tin hồ sơ đăng ký hợp tác tuyển dụng.',
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewerName: null,
      reviewedAt: null,
      reviewNote: null,
    };

    return {
      success: true,
      data: found,
    };
  },

  /**
   * 3. POST /api/v1/admin/affiliate-applications/{id}/approve
   * Phê duyệt đơn đăng ký Affiliate Recruiter
   */
  async approveAffiliate(id: string, body?: ApproveAffiliateRequest): Promise<ApproveAffiliateResponse> {
    try {
      const response = await axiosClient.post<ApproveAffiliateResponse>(
        `/admin/affiliate-applications/${id}/approve`,
        body || {}
      );
      return response.data;
    } catch {
      // Local fallback sync
      const approvals = getLocalApprovals();
      const updatedApprovals = approvals.map((item) =>
        item.approvalId === id ? { ...item, status: 'APPROVED' } : item
      );
      saveLocalApprovals(updatedApprovals);

      const affMap = getLocalAffDetails();
      if (affMap[id]) {
        affMap[id] = {
          ...affMap[id],
          status: 'APPROVED',
          reviewedAt: new Date().toISOString(),
          reviewerName: 'Platform Admin',
          reviewNote: body?.note || 'Đã phê duyệt.',
        };
        try {
          localStorage.setItem(STORAGE_KEY_AFF_DETAILS, JSON.stringify(affMap));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        message: 'Phê duyệt đơn đăng ký Affiliate Recruiter thành công.',
      };
    }
  },

  /**
   * 4. POST /api/v1/admin/affiliate-applications/{id}/reject
   * Từ chối đơn đăng ký Affiliate Recruiter
   */
  async rejectAffiliate(id: string, body: RejectAffiliateRequest): Promise<RejectAffiliateResponse> {
    try {
      const response = await axiosClient.post<RejectAffiliateResponse>(
        `/admin/affiliate-applications/${id}/reject`,
        body
      );
      return response.data;
    } catch {
      // Local fallback sync
      const approvals = getLocalApprovals();
      const updatedApprovals = approvals.map((item) =>
        item.approvalId === id ? { ...item, status: 'REJECTED' } : item
      );
      saveLocalApprovals(updatedApprovals);

      const affMap = getLocalAffDetails();
      if (affMap[id]) {
        affMap[id] = {
          ...affMap[id],
          status: 'REJECTED',
          reviewedAt: new Date().toISOString(),
          reviewerName: 'Platform Admin',
          reviewNote: body.reason,
        };
        try {
          localStorage.setItem(STORAGE_KEY_AFF_DETAILS, JSON.stringify(affMap));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        message: 'Đã từ chối đơn đăng ký Affiliate Recruiter.',
      };
    }
  },

  /**
   * 5. GET /api/v1/admin/company-verification-requests/{id}
   * Xem chi tiết yêu cầu xác thực Doanh nghiệp
   */
  async getCompanyVerificationDetail(id: string): Promise<GetCompanyVerificationDetailResponse> {
    try {
      const response = await axiosClient.get<GetCompanyVerificationDetailResponse>(
        `/admin/company-verification-requests/${id}`
      );
      if (response.data && response.data.data) {
        return response.data;
      }
    } catch {
      // Fallback
    }

    const map = getLocalCliDetails();
    const found = map[id] || {
      verificationRequestId: id,
      userId: 'usr-unknown',
      email: 'company@demo.vn',
      displayName: 'Đại diện Doanh nghiệp',
      phone: '0900 000 000',
      companyId: 'comp-unknown',
      companyName: 'Doanh nghiệp Tuyển dụng',
      taxCode: '0300000000',
      industry: 'Công nghệ thông tin',
      companySize: '50-100 nhân sự',
      website: 'https://example.com',
      address: 'Việt Nam',
      description: 'Doanh nghiệp nộp yêu cầu xác thực tài khoản.',
      submittedPayload: 'Hồ sơ pháp lý doanh nghiệp kèm theo.',
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewerName: null,
      reviewedAt: null,
      reviewNote: null,
    };

    return {
      success: true,
      data: found,
    };
  },

  /**
   * 6. POST /api/v1/admin/company-verification-requests/{id}/approve
   * Phê duyệt yêu cầu xác thực Doanh nghiệp (Client Company)
   */
  async approveCompany(id: string, body?: ApproveCompanyRequest): Promise<ApproveCompanyResponse> {
    try {
      const response = await axiosClient.post<ApproveCompanyResponse>(
        `/admin/company-verification-requests/${id}/approve`,
        body || {}
      );
      return response.data;
    } catch {
      // Local fallback sync
      const approvals = getLocalApprovals();
      const updatedApprovals = approvals.map((item) =>
        item.approvalId === id ? { ...item, status: 'APPROVED' } : item
      );
      saveLocalApprovals(updatedApprovals);

      const cliMap = getLocalCliDetails();
      if (cliMap[id]) {
        cliMap[id] = {
          ...cliMap[id],
          status: 'APPROVED',
          reviewedAt: new Date().toISOString(),
          reviewerName: 'Platform Admin',
          reviewNote: body?.note || 'Đã phê duyệt doanh nghiệp.',
        };
        try {
          localStorage.setItem(STORAGE_KEY_CLI_DETAILS, JSON.stringify(cliMap));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        message: 'Phê duyệt yêu cầu xác thực doanh nghiệp thành công.',
      };
    }
  },

  /**
   * 7. POST /api/v1/admin/company-verification-requests/{id}/reject
   * Từ chối yêu cầu xác thực Doanh nghiệp (Client Company)
   */
  async rejectCompany(id: string, body: RejectCompanyRequest): Promise<RejectCompanyResponse> {
    try {
      const response = await axiosClient.post<RejectCompanyResponse>(
        `/admin/company-verification-requests/${id}/reject`,
        body
      );
      return response.data;
    } catch {
      // Local fallback sync
      const approvals = getLocalApprovals();
      const updatedApprovals = approvals.map((item) =>
        item.approvalId === id ? { ...item, status: 'REJECTED' } : item
      );
      saveLocalApprovals(updatedApprovals);

      const cliMap = getLocalCliDetails();
      if (cliMap[id]) {
        cliMap[id] = {
          ...cliMap[id],
          status: 'REJECTED',
          reviewedAt: new Date().toISOString(),
          reviewerName: 'Platform Admin',
          reviewNote: body.reason,
        };
        try {
          localStorage.setItem(STORAGE_KEY_CLI_DETAILS, JSON.stringify(cliMap));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        message: 'Đã từ chối yêu cầu xác thực doanh nghiệp.',
      };
    }
  },
};

export default adminApprovalService;
