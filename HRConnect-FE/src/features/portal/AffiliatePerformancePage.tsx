/**
 * @file AffiliatePerformancePage.tsx
 * @description Affiliate "Hiệu suất" (mockup 03/11): quality rating and referral funnel for a chosen
 * period, plus a table of earlier periods.
 */
import React, { useState } from 'react';
import { Alert, Button, Select, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi } from '@/services/api/mf02/affiliateApi';
import { getApiErrorMessage } from '@/services/apiClient';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');
const periodLabel = (start?: string | null, end?: string | null) => (start && end ? `${fmtDate(start)} – ${fmtDate(end)}` : 'Kỳ hiện tại');
const qualityLabel = (value?: string | null) => {
  const labels: Record<string, string> = {
    EXCELLENT: 'Xuất sắc',
    GOOD: 'Tốt',
    AVERAGE: 'Đạt yêu cầu',
    FAIR: 'Cần cải thiện',
    POOR: 'Chưa đạt',
  };
  return value ? labels[value.toUpperCase()] ?? value : 'Chưa đủ dữ liệu đánh giá';
};

const CURRENT = 'current';

export const AffiliatePerformancePage: React.FC = () => {
  const performance = useQuery({ queryKey: ['affiliate-performance'], queryFn: () => affiliateApi.performance() });
  const [periodId, setPeriodId] = useState(CURRENT);
  const data = performance.data;
  const history = data?.history ?? [];
  const period = history.find((h) => h.affiliatePerformanceId === periodId) ?? data;
  const top = Math.max(1, period?.totalSubmissions ?? 0);
  const funnel = [
    { label: 'Đã giới thiệu', n: period?.totalSubmissions ?? 0 },
    { label: 'Được chọn', n: period?.totalShortlisted ?? 0 },
    { label: 'Phỏng vấn', n: period?.totalInterviews ?? 0 },
    { label: 'Đi làm', n: period?.totalPlacements ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Hiệu suất</h1>
      {performance.isError && (
        <Alert type="error" showIcon message="Không tải được hiệu suất" description={getApiErrorMessage(performance.error)} action={<Button onClick={() => performance.refetch()}>Thử lại</Button>} />
      )}

      {data && history.length > 0 && (
        <Select
          aria-label="Kỳ"
          className="w-[320px] max-w-full"
          value={periodId}
          onChange={setPeriodId}
          options={[
            { value: CURRENT, label: `Kỳ này: ${periodLabel(data.periodStart, data.periodEnd)}` },
            ...history.map((h) => ({ value: h.affiliatePerformanceId, label: `Kỳ ${periodLabel(h.periodStart, h.periodEnd)}` })),
          ]}
        />
      )}

      <div className="flex flex-wrap items-stretch gap-5">
        <section aria-labelledby="aff-rating" className="min-w-0 flex-[1_1_300px] rounded-xl border border-solid border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 id="aff-rating" className="m-0 text-[15px] font-bold text-gray-900">Đánh giá chất lượng</h2>
          {performance.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
            <>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
                <span className="text-4xl font-bold tabular-nums text-[#0369A1]">{Math.round(period?.qualityRating ?? 0)}</span>
                <span className="text-gray-500">/ 100</span>
                <span className="rounded-md bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{qualityLabel(period?.ratingLabel)}</span>
              </div>
              <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-gray-600">Điểm được tổng hợp từ kết quả xử lý thực tế của các hồ sơ bạn giới thiệu.</p>
            </>
          )}
        </section>

        <section aria-labelledby="aff-funnel" className="min-w-0 flex-[2_1_480px] rounded-xl border border-solid border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 id="aff-funnel" className="m-0 mb-3.5 text-[15px] font-bold text-gray-900">Từ giới thiệu đến đi làm</h2>
          {performance.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
            <>
              <div className="flex flex-col gap-2.5">
                {funnel.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="w-[100px] shrink-0 text-[13px] text-gray-700">{f.label}</span>
                    <span className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-slate-100"><span className="block h-full bg-gradient-to-r from-[#0284C7] to-[#2563EB]" style={{ width: `${Math.round((f.n / top) * 100)}%` }} /></span>
                    <b className="w-9 text-right tabular-nums">{f.n}</b>
                  </div>
                ))}
              </div>
              <p className="m-0 mt-3.5 text-[13px] text-gray-600">Tỉ lệ giới thiệu → đi làm: <b className="text-[#0369A1]">{Math.round((period?.submissionToHireRate ?? 0) * 100)}%</b></p>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="aff-history" className="rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <h2 id="aff-history" className="m-0 border-0 border-b border-solid border-slate-100 px-4 py-3.5 text-[15px] font-bold text-gray-900">Các kỳ trước</h2>
        {performance.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 2 }} /></div>
        ) : history.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-gray-600">Chưa có dữ liệu của kỳ trước.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Kỳ</th>
                  <th className="px-4 py-2.5 text-right font-medium">Giới thiệu</th>
                  <th className="px-4 py-2.5 text-right font-medium">Được chọn</th>
                  <th className="px-4 py-2.5 text-right font-medium">Phỏng vấn</th>
                  <th className="px-4 py-2.5 text-right font-medium">Đi làm</th>
                  <th className="px-4 py-2.5 font-medium">Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.affiliatePerformanceId} className="border-0 border-t border-solid border-slate-100">
                    <td className="px-4 py-3 font-semibold text-gray-900">{periodLabel(h.periodStart, h.periodEnd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{h.totalSubmissions}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{h.totalShortlisted}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{h.totalInterviews}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{h.totalPlacements}</td>
                    <td className="px-4 py-3 text-[13px]">{Math.round(h.qualityRating)} · {qualityLabel(h.ratingLabel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AffiliatePerformancePage;
