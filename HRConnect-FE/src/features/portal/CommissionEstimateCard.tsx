/**
 * N12 (chốt 19/10): Affiliate sees the estimated commission before referring a candidate.
 * GET /affiliates/jobs/{jobId}/commission-estimate — the numbers come from the agreed job terms and the
 * active commission rule; nothing is hard-coded here.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
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
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND', maximumFractionDigits: 0 }).format(value);

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
    <section
      aria-label="Hoa hồng ước tính"
      className="rounded-2xl border border-solid border-violet-200 bg-violet-50/70 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white" aria-hidden>
          <DollarOutlined />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-violet-700">Hoa hồng ước tính</div>
          <div className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
            {headline ?? 'Không áp dụng'}
          </div>
          {estimate.data.warrantyDays != null && (
            <div className="text-[13px] text-slate-700">Bảo hành {estimate.data.warrantyDays} ngày</div>
          )}
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-slate-600">{friendlyExplanation(estimate.data.explanation)}</p>
        </div>
      </div>
    </section>
  );
};
