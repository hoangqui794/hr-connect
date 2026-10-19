/**
 * @file report.ts
 * @description Types for Admin Reports (Overview, Revenue, Top Affiliates, Top Companies).
 */

export interface ReportOverviewJobs {
  byStatus: Record<string, number>;
  byServiceType: Record<string, number>;
}

export interface ReportOverviewApplications {
  submitted: number;
  shortlisted: number;
  interview: number;
  placed: number;
}

export interface ReportOverviewPlacements {
  started: number;
  warrantyPassed: number;
  warrantyVoided: number;
}

export interface ReportOverviewCompanies {
  verified: number;
  pending: number;
}

export interface ReportOverviewAffiliates {
  active: number;
  pending: number;
}

export interface ReportOverviewData {
  jobs: ReportOverviewJobs;
  applications: ReportOverviewApplications;
  placements: ReportOverviewPlacements;
  companies: ReportOverviewCompanies;
  affiliates: ReportOverviewAffiliates;
}

export interface RevenueServiceTotal {
  billed: number;
  collected: number;
}

export interface RevenueSeriesItem {
  period: string;
  headhunT_COD?: number;
  HEADHUNT_COD?: number;
  cV_SOURCING?: number;
  CV_SOURCING?: number;
  cV_APPLICATION?: number;
  CV_APPLICATION?: number;
}

export interface RevenueCommission {
  earned: number;
  paid: number;
}

export interface ReportRevenueData {
  currency: string;
  totals: Record<string, RevenueServiceTotal>;
  series: RevenueSeriesItem[];
  commission: RevenueCommission;
}

export interface TopAffiliateItem {
  affiliateId: string;
  fullName: string;
  totalSubmissions: number;
  totalPlacements: number;
  submissionToHireRate?: number | null;
  qualityRating?: number | null;
  ratingLabel?: string;
  commissionEarned: number;
}

export interface TopCompanyItem {
  companyId: string;
  companyName: string;
  industry?: string | null;
  activeJobs: number;
  placements: number;
  revenueCollected: number;
}
