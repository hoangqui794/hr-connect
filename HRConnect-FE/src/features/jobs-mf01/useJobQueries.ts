/**
 * @file useJobQueries.ts
 * @description React Query hooks for MF-01. Every mutation invalidates the job caches
 * so lists and details re-read the backend (new status + new concurrencyToken).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi, serviceAgreementsApi, serviceTypesApi } from '@/services/api/jobsApi';
import type {
  ApproveJobInput,
  CreateServiceAgreementProposalInput,
  Job,
  JobCloseReasonCode,
  JobRejectReasonCode,
  JobSearchParams,
  JobStatus,
  JobTemplateUpsertInput,
  JobUpsertInput,
  RespondServiceAgreementInput,
  SignServiceAgreementInput,
} from '@/types/api/jobs';

export const jobQueryKeys = {
  all: ['mf01-jobs'] as const,
  mine: (status?: JobStatus) => [...jobQueryKeys.all, 'mine', status ?? 'ALL'] as const,
  search: (params: JobSearchParams) => [...jobQueryKeys.all, 'search', params] as const,
  publicSearch: (params: JobSearchParams) => [...jobQueryKeys.all, 'public-search', params] as const,
  detail: (jobId: string) => [...jobQueryKeys.all, 'detail', jobId] as const,
  review: (status?: string) => [...jobQueryKeys.all, 'review', status ?? 'ALL'] as const,
  serviceAgreementCurrent: (jobId: string) => [...jobQueryKeys.all, 'service-agreement-current', jobId] as const,
  serviceAgreementHistory: (jobId: string) => [...jobQueryKeys.all, 'service-agreement-history', jobId] as const,
  serviceTypes: ['mf01-service-types'] as const,
  postingPackages: ['mf01-posting-packages'] as const,
  postingEligibility: ['mf01-posting-eligibility'] as const,
  templates: (keyword?: string, industry?: string) =>
    [...jobQueryKeys.all, 'templates', keyword ?? '', industry ?? ''] as const,
  templateDetail: (templateId: string) => [...jobQueryKeys.all, 'template-detail', templateId] as const,
  internalTemplates: (params: { keyword?: string; industry?: string; isActive?: boolean; page?: number; pageSize?: number }) =>
    [...jobQueryKeys.all, 'internal-templates', params] as const,
  internalTemplateDetail: (templateId: string) => [...jobQueryKeys.all, 'internal-template-detail', templateId] as const,
};

export const useMyJobs = (status?: JobStatus) =>
  useQuery({ queryKey: jobQueryKeys.mine(status), queryFn: () => jobsApi.getMine(status) });

export const useJobSearch = (params: JobSearchParams, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.search(params),
    queryFn: () => jobsApi.search(params),
    enabled,
    placeholderData: (previous) => previous,
  });

export const usePublicJobSearch = (params: JobSearchParams, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.publicSearch(params),
    queryFn: () => jobsApi.searchPublic(params),
    enabled,
    placeholderData: (previous) => previous,
  });

export const useJobDetail = (jobId: string | undefined) =>
  useQuery({
    queryKey: jobQueryKeys.detail(jobId ?? ''),
    queryFn: () => jobsApi.getById(jobId as string),
    enabled: Boolean(jobId),
  });

export const useJobReviewQueue = (status?: string) =>
  useQuery({ queryKey: jobQueryKeys.review(status), queryFn: () => jobsApi.getReviewQueue(status) });

export const useServiceTypes = () =>
  useQuery({
    queryKey: jobQueryKeys.serviceTypes,
    queryFn: () => serviceTypesApi.getActive(),
    staleTime: 10 * 60 * 1000,
  });

export const useCommercialTermsDefaults = (jobId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: [...jobQueryKeys.all, 'commercial-terms-defaults', jobId ?? ''] as const,
    queryFn: () => jobsApi.getCommercialTermsDefaults(jobId as string),
    enabled: Boolean(jobId) && enabled,
  });

export const usePostingPackages = () =>
  useQuery({
    queryKey: jobQueryKeys.postingPackages,
    queryFn: () => jobsApi.getPostingPackages(),
    staleTime: 10 * 60 * 1000,
  });

export const usePostingFee = (jobId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: [...jobQueryKeys.all, 'posting-fee', jobId ?? ''] as const,
    queryFn: () => jobsApi.getPostingFee(jobId as string),
    enabled: Boolean(jobId) && enabled,
  });

export interface JobFeeInfo {
  /** Amount the Client pays: the fee record once approved, otherwise the chosen package price. */
  amount: number | null;
  currencyCode: string;
  packageName: string | null;
  durationDays: number | null;
  maxApplications: number | null;
  isLoading: boolean;
}

/** Posting fee of a CV_APPLICATION job, read from the backend (never a hard-coded price). */
export const useJobFeeInfo = (job: Job | undefined | null): JobFeeInfo => {
  const applies = job?.serviceTypeCode === 'CV_APPLICATION';
  const fee = usePostingFee(job?.jobId, applies);
  const packages = usePostingPackages();
  const pkg = packages.data?.find(
    (p) => p.packageId === job?.postingPackageId || (job?.postingPackageCode && p.code === job.postingPackageCode)
  );
  return {
    amount: fee.data?.amount ?? pkg?.price ?? null,
    currencyCode: fee.data?.currencyCode ?? job?.currencyCode ?? 'VND',
    packageName: fee.data?.packageName ?? pkg?.name ?? job?.postingPackageName ?? null,
    durationDays: pkg?.durationDays ?? null,
    maxApplications: job?.maxApplications ?? pkg?.maxApplications ?? null,
    isLoading: (applies && fee.isLoading) || packages.isLoading,
  };
};

export const formatMoney = (amount: number | null | undefined, currency = 'VND'): string =>
  amount == null ? '—' : amount === 0 ? 'Miễn phí' : `${amount.toLocaleString('vi-VN')} ${currency === 'VND' ? 'VNĐ' : currency}`;

export const usePostingEligibility = () =>
  useQuery({
    queryKey: jobQueryKeys.postingEligibility,
    queryFn: () => jobsApi.getPostingEligibility(),
    staleTime: 60 * 1000,
  });

export const useJobTemplates = (keyword?: string, industry?: string, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.templates(keyword, industry),
    queryFn: () => jobsApi.searchTemplates({ keyword, industry, pageSize: 100 }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

export const useJobTemplate = (templateId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.templateDetail(templateId ?? ''),
    queryFn: () => jobsApi.getTemplate(templateId as string),
    enabled: Boolean(templateId) && enabled,
    staleTime: 10 * 60 * 1000,
  });

export const useInternalJobTemplates = (
  params: { keyword?: string; industry?: string; isActive?: boolean; page?: number; pageSize?: number },
  enabled = true
) =>
  useQuery({
    queryKey: jobQueryKeys.internalTemplates(params),
    queryFn: () => jobsApi.getInternalTemplates(params),
    enabled,
    placeholderData: (previous) => previous,
  });

export const useInternalJobTemplate = (templateId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.internalTemplateDetail(templateId ?? ''),
    queryFn: () => jobsApi.getInternalTemplate(templateId as string),
    enabled: Boolean(templateId) && enabled,
  });

export const useJobTemplateMutations = () => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [...jobQueryKeys.all, 'templates'] });
    queryClient.invalidateQueries({ queryKey: [...jobQueryKeys.all, 'internal-templates'] });
    queryClient.invalidateQueries({ queryKey: [...jobQueryKeys.all, 'template-detail'] });
    queryClient.invalidateQueries({ queryKey: [...jobQueryKeys.all, 'internal-template-detail'] });
  };

  return {
    create: useMutation({
      mutationFn: (data: JobTemplateUpsertInput) => jobsApi.createInternalTemplate(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; concurrencyToken: string; template: JobTemplateUpsertInput }) =>
        jobsApi.updateInternalTemplate(v.id, { concurrencyToken: v.concurrencyToken, template: v.template }),
      onSuccess: refresh,
    }),
    toggleActive: useMutation({
      mutationFn: (v: { id: string; activate: boolean }) => jobsApi.toggleTemplateActive(v.id, v.activate),
      onSuccess: refresh,
    }),
  };
};


/** All write operations, each refreshing every MF-01 cache on success. */
export const useJobMutations = () => {
  const queryClient = useQueryClient();
  // N10: dashboards keep their own job counters (HR overview, admin finance), refresh them too.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: jobQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['hr-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['mf05-posting-fees'] }),
    ]);

  return {
    create: useMutation({ mutationFn: (input: JobUpsertInput) => jobsApi.create(input), onSuccess: refresh }),
    update: useMutation({
      mutationFn: (v: { jobId: string; input: JobUpsertInput; token: string }) =>
        jobsApi.update(v.jobId, v.input, v.token),
      onSuccess: refresh,
    }),
    submit: useMutation({
      mutationFn: (v: { jobId: string; token: string }) => jobsApi.submit(v.jobId, v.token),
      onSuccess: refresh,
    }),
    pause: useMutation({
      mutationFn: (v: { jobId: string; token: string; reasonText?: string }) =>
        jobsApi.pause(v.jobId, v.token, v.reasonText),
      onSuccess: refresh,
    }),
    resume: useMutation({
      mutationFn: (v: { jobId: string; token: string }) => jobsApi.resume(v.jobId, v.token),
      onSuccess: refresh,
    }),
    close: useMutation({
      mutationFn: (v: { jobId: string; token: string; reasonCode: JobCloseReasonCode; reasonText: string }) =>
        jobsApi.close(v.jobId, v.token, v.reasonCode, v.reasonText),
      onSuccess: refresh,
    }),
    approve: useMutation({
      mutationFn: (v: { jobId: string; token: string; input?: ApproveJobInput }) =>
        jobsApi.approve(v.jobId, v.token, v.input),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: (v: {
        jobId: string;
        token: string;
        reasonCode: JobRejectReasonCode;
        reasonText: string;
        reason?: string;
      }) => jobsApi.reject(v.jobId, v.token, v.reasonCode, v.reasonText, v.reason),
      onSuccess: refresh,
    }),
  };
};

export const useCurrentServiceAgreement = (jobId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.serviceAgreementCurrent(jobId ?? ''),
    queryFn: () => serviceAgreementsApi.getCurrent(jobId as string),
    enabled: Boolean(jobId) && enabled,
  });

export const useServiceAgreementHistory = (jobId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.serviceAgreementHistory(jobId ?? ''),
    queryFn: () => serviceAgreementsApi.getHistory(jobId as string),
    enabled: Boolean(jobId) && enabled,
  });

export const useServiceAgreementMutations = (jobId?: string) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: jobQueryKeys.all }),
      jobId
        ? Promise.all([
            queryClient.invalidateQueries({ queryKey: jobQueryKeys.serviceAgreementCurrent(jobId) }),
            queryClient.invalidateQueries({ queryKey: jobQueryKeys.serviceAgreementHistory(jobId) }),
            queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(jobId) }),
          ])
        : Promise.resolve(),
    ]);

  return {
    createProposal: useMutation({
      mutationFn: (v: { jobId: string; input: CreateServiceAgreementProposalInput }) =>
        serviceAgreementsApi.createProposal(v.jobId, v.input),
      onSuccess: refresh,
    }),
    respond: useMutation({
      mutationFn: (v: { jobId: string; agreementId: string; input: RespondServiceAgreementInput }) =>
        serviceAgreementsApi.respond(v.jobId, v.agreementId, v.input),
      onSuccess: refresh,
    }),
    createSignatureChallenge: useMutation({
      mutationFn: (v: { jobId: string; agreementId: string }) =>
        serviceAgreementsApi.createSignatureChallenge(v.jobId, v.agreementId),
    }),
    sign: useMutation({
      mutationFn: (v: { jobId: string; agreementId: string; input: SignServiceAgreementInput }) =>
        serviceAgreementsApi.sign(v.jobId, v.agreementId, v.input),
      onSuccess: refresh,
    }),
    voidAgreement: useMutation({
      mutationFn: (v: { jobId: string; agreementId: string; reason: string }) =>
        serviceAgreementsApi.void(v.jobId, v.agreementId, v.reason),
      onSuccess: refresh,
    }),
  };
};
