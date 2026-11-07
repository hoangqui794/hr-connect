/**
 * N12 (chốt 19/10): Affiliate sees the estimated commission before referring a candidate.
 * GET /affiliates/jobs/{jobId}/commission-estimate — the numbers come from the agreed job terms and the
 * active commission rule; nothing is hard-coded here.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { apiClient } from '@/services/apiClient';

export interface JobCommissionEstimate {
  jobId: string;
  serviceTypeCode: string;
  hasCommission: boolean;
  rateType: string | null;
  rateValue: number | null;
  feeMultiplier: number | null;
  warrantyDays: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
  amountPerCv: number | null;
  currencyCode: string;
  explanation: string;
}

export const commissionEstimateApi = {
  async get(jobId: string): Promise<JobCommissionEstimate> {
    const res = await apiClient.get<{ success: boolean; data: JobCommissionEstimate }>(`/affiliates/jobs/${jobId}/commission-estimate`);
    return res.data.data;
  },
};

const money = (value: number, currency: string) =>
  `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${!currency || currency === 'VND' ? 'đ' : currency}`;

const friendlyExplanation = (value: string) => value
  .replace(/\bClient\b/gi, 'doanh nghiệp')
  .replace(/\bgross\b/gi, 'trước thuế')
  .replace(/\boffer\b/gi, 'đề nghị nhận việc');

export const formatEstimate = (e: JobCommissionEstimate): string | null => {
  if (!e.hasCommission) return null;
  if (e.amountPerCv != null) return `${money(e.amountPerCv, e.currencyCode)} / CV được chấp nhận`;
  if (e.estimatedMin != null && e.estimatedMax != null)
    return e.estimatedMin === e.estimatedMax
      ? money(e.estimatedMin, e.currencyCode)
      : `${money(e.estimatedMin, e.currencyCode)} – ${money(e.estimatedMax, e.currencyCode)}`;
  if (e.rateType === 'PERCENT' && e.rateValue != null) return `${e.rateValue}% phí dịch vụ`;
  return null;
};

export const CommissionEstimateCard: React.FC<{ jobId: string }> = ({ jobId }) => {
  const estimate = useQuery({
    queryKey: ['affiliate-commission-estimate', jobId],
    queryFn: () => commissionEstimateApi.get(jobId),
    staleTime: 5 * 60_000,
  });

  if (estimate.isLoading) return <Skeleton active paragraph={{ rows: 1 }} />;
  if (estimate.isError || !estimate.data) return null;
  const headline = formatEstimate(estimate.data);

  return (
    <section aria-label="Hoa hồng ước tính" className="w-full max-w-full min-w-0 overflow-hidden break-words rounded-lg border border-solid border-gray-200 bg-white p-4">
      <h2 className="m-0 text-[15px] font-bold text-gray-900">Hoa hồng ước tính</h2>
      <div className="mt-1.5 text-xl font-bold leading-snug tabular-nums break-words text-[color:var(--affiliate-cta,#C2410C)]">{headline ?? 'Không áp dụng'}</div>
      <dl className="m-0 mt-3 space-y-2 text-[13px] break-words">
        {estimate.data.feeMultiplier != null && (
          <div className="flex justify-between gap-2"><dt className="text-gray-600">Phí dịch vụ của doanh nghiệp</dt><dd className="m-0 text-right">{estimate.data.feeMultiplier} × lương tháng</dd></div>
        )}
        {estimate.data.rateType === 'PERCENT' && estimate.data.rateValue != null && (
          <div className="flex justify-between gap-2"><dt className="text-gray-600">Tỉ lệ hoa hồng</dt><dd className="m-0">{estimate.data.rateValue}% phí dịch vụ</dd></div>
        )}
        {estimate.data.warrantyDays != null && (
          <div className="flex justify-between gap-2"><dt className="text-gray-600">Bảo hành</dt><dd className="m-0">{estimate.data.warrantyDays} ngày</dd></div>
        )}
      </dl>
      <p className="m-0 mt-3 text-xs leading-relaxed text-gray-500 break-words">{friendlyExplanation(estimate.data.explanation)}</p>
    </section>
  );
};
