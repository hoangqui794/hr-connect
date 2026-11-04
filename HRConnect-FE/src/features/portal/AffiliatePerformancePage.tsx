import React from 'react';
import { Alert, Button, Skeleton, Table } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SendOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi } from '@/services/api/mf02/affiliateApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';
import type { AffiliatePerformanceHistoryItem } from '@/types/api/mf02/affiliate';
import { AffiliatePageHeader, AffiliateSectionHeading } from './affiliate/AffiliateUi';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');
const fmtDateTime = (value?: string | null) => (value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—');
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

export const AffiliatePerformancePage: React.FC = () => {
  const performance = useQuery({ queryKey: ['affiliate-performance'], queryFn: () => affiliateApi.performance() });
  const data = performance.data;
  const successRate = Math.round((data?.submissionToHireRate ?? 0) * 100);
  const qualityScore = Math.round(data?.qualityRating ?? 0);

  const historyColumns: ColumnsType<AffiliatePerformanceHistoryItem> = [
    { title: 'Kỳ đánh giá', key: 'period', render: (_, item) => <span className="font-semibold text-slate-900">{fmtDate(item.periodStart)} – {fmtDate(item.periodEnd)}</span> },
    { title: 'Đã giới thiệu', dataIndex: 'totalSubmissions', width: 120, render: (value) => <span className="tabular-nums">{value}</span> },
    { title: 'Được chọn', dataIndex: 'totalShortlisted', width: 110, render: (value) => <span className="tabular-nums">{value}</span> },
    { title: 'Phỏng vấn', dataIndex: 'totalInterviews', width: 110, render: (value) => <span className="tabular-nums">{value}</span> },
    { title: 'Đi làm', dataIndex: 'totalPlacements', width: 90, render: (value) => <span className="font-semibold tabular-nums text-emerald-700">{value}</span> },
    { title: 'Tỉ lệ thành công', dataIndex: 'submissionToHireRate', width: 140, render: (value) => (value != null ? `${Math.round(value * 100)}%` : '—') },
    {
      title: 'Đánh giá', key: 'rating', width: 150,
      render: (_, item) => (
        <StatusDot tone={item.qualityRating != null && item.qualityRating >= 80 ? 'success' : 'info'}>
          {item.ratingLabel ? qualityLabel(item.ratingLabel) : (item.qualityRating != null ? `${Math.round(item.qualityRating)} điểm` : 'Chưa đánh giá')}
        </StatusDot>
      ),
    },
  ];

  const stats = [
    { label: 'Lượt giới thiệu', value: data?.totalSubmissions, hint: 'Tổng hồ sơ đã gửi', icon: <SendOutlined />, color: '#0369A1', soft: '#eff6ff' },
    { label: 'Được doanh nghiệp chọn', value: data?.totalShortlisted, hint: 'Hồ sơ qua sàng lọc', icon: <CheckCircleOutlined />, color: '#087a55', soft: '#eafaf3' },
    { label: 'Đã vào phỏng vấn', value: data?.totalInterviews, hint: 'Ứng viên có lịch phỏng vấn', icon: <TeamOutlined />, color: '#0369A1', soft: '#eef4ff' },
    { label: 'Tuyển dụng thành công', value: data?.totalPlacements, hint: `${successRate}% trên tổng lượt gửi`, icon: <TrophyOutlined />, color: '#a9550a', soft: '#fff6e8' },
  ];

  return (
    <div className="space-y-6">
      <AffiliatePageHeader
        title="Hiệu suất"
        description="Chất lượng hồ sơ và tỉ lệ ứng viên đi làm theo từng kỳ."
        actions={<Button icon={<ReloadOutlined />} loading={performance.isFetching} onClick={() => performance.refetch()}>Làm mới</Button>}
      />
      {performance.isError ? <Alert type="error" showIcon message="Không tải được báo cáo" description={getApiErrorMessage(performance.error)} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-labelledby="aff-rating" className="rounded-lg border border-solid border-gray-200 bg-white p-5">
          <h2 id="aff-rating" className="m-0 text-[15px] font-bold text-gray-900">Đánh giá chất lượng</h2>
          {performance.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
            <>
              <div className="mt-2.5 flex items-baseline gap-2.5">
                <span className="text-4xl font-bold tabular-nums text-[color:var(--affiliate-brand)]">{qualityScore}</span>
                <span className="text-gray-500">/ 100</span>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">{qualityLabel(data?.ratingLabel)}</span>
              </div>
              <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-gray-600">Tính từ tỉ lệ hồ sơ được chọn, vào phỏng vấn và đi làm trong kỳ.</p>
              <dl className="m-0 mt-4 space-y-2 border-0 border-t border-solid border-slate-100 pt-3 text-[13px]">
                <div className="flex justify-between gap-2"><dt className="text-gray-500">Kỳ</dt><dd className="m-0 font-semibold">{data?.periodStart && data?.periodEnd ? `${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}` : 'Kỳ hiện tại'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-500">Cập nhật</dt><dd className="m-0">{fmtDateTime(data?.calculatedAt)}</dd></div>
              </dl>
            </>
          )}
        </section>
        <section aria-labelledby="aff-funnel" className="rounded-lg border border-solid border-gray-200 bg-white p-5">
          <h2 id="aff-funnel" className="m-0 mb-3.5 text-[15px] font-bold text-gray-900">Từ giới thiệu đến đi làm</h2>
          {performance.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
            <>
              <div className="space-y-2.5">
                {stats.map((item) => {
                  const top = Math.max(1, data?.totalSubmissions ?? 0);
                  const n = item.value ?? 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-[170px] shrink-0 text-[13px] text-gray-700 max-sm:w-[120px]">{item.label}</span>
                      <span className="h-6 flex-1 overflow-hidden rounded bg-slate-100"><span className="block h-full bg-sky-700" style={{ width: `${Math.round((n / top) * 100)}%` }} /></span>
                      <b className="w-9 text-right tabular-nums">{n}</b>
                    </div>
                  );
                })}
              </div>
              <p className="m-0 mt-3.5 text-[13px] text-gray-600">Tỉ lệ giới thiệu → đi làm: <b className="text-[color:var(--affiliate-brand)]">{successRate}%</b></p>
            </>
          )}
        </section>
      </div>

      <Surface className="p-6">
        <AffiliateSectionHeading title="Lịch sử các kỳ đánh giá" description="So sánh kết quả theo thời gian để nhận biết xu hướng chất lượng hồ sơ." />
        <Table className="admin-soft-table w-full table-auto" scroll={{ x: 720 }} rowKey="affiliatePerformanceId" columns={historyColumns} dataSource={data?.history ?? []} loading={performance.isLoading} pagination={false} locale={{ emptyText: <div className="py-8 text-slate-500">Chưa có dữ liệu của kỳ đánh giá trước.</div> }} />
      </Surface>
    </div>
  );
};

export default AffiliatePerformancePage;
