import React from 'react';
import { Alert, Button, Progress, Skeleton, Table } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SendOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi } from '@/services/api/mf02/affiliateApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';
import type { AffiliatePerformanceHistoryItem } from '@/types/api/mf02/affiliate';
import { AffiliatePageHeader, AffiliateSectionHeading, AffiliateStatCard } from './affiliate/AffiliateUi';

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
    { label: 'Lượt giới thiệu', value: data?.totalSubmissions, hint: 'Tổng hồ sơ đã gửi', icon: <SendOutlined />, color: '#5b3fd6', soft: '#f1efff' },
    { label: 'Được doanh nghiệp chọn', value: data?.totalShortlisted, hint: 'Hồ sơ qua sàng lọc', icon: <CheckCircleOutlined />, color: '#087a55', soft: '#eafaf3' },
    { label: 'Đã vào phỏng vấn', value: data?.totalInterviews, hint: 'Ứng viên có lịch phỏng vấn', icon: <TeamOutlined />, color: '#2563eb', soft: '#eef4ff' },
    { label: 'Tuyển dụng thành công', value: data?.totalPlacements, hint: `${successRate}% trên tổng lượt gửi`, icon: <TrophyOutlined />, color: '#a9550a', soft: '#fff6e8' },
  ];

  return (
    <div className="space-y-6">
      <AffiliatePageHeader
        title="Kết quả giới thiệu"
        description="Theo dõi chất lượng hồ sơ, tỉ lệ chuyển đổi và kết quả tuyển dụng để biết nhóm ứng viên nào đang mang lại hiệu quả tốt nhất."
        actions={<Button icon={<ReloadOutlined />} loading={performance.isFetching} onClick={() => performance.refetch()}>Cập nhật dữ liệu</Button>}
      />
      {performance.isError ? <Alert type="error" showIcon message="Không tải được báo cáo" description={getApiErrorMessage(performance.error)} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <AffiliateStatCard key={item.label} label={item.label} value={performance.isLoading ? <Skeleton.Input active size="small" /> : item.value ?? 0} hint={item.hint} icon={item.icon} color={item.color} softColor={item.soft} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Surface className="p-6">
          <AffiliateSectionHeading title="Chất lượng hồ sơ" description="Điểm được tổng hợp từ kết quả xử lý thực tế của các hồ sơ bạn giới thiệu." />
          {performance.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-end justify-between gap-3"><span className="text-sm font-semibold text-slate-700">Điểm chất lượng</span><span className="text-2xl font-bold text-slate-900">{qualityScore}<small className="text-sm font-medium text-slate-500">/100</small></span></div>
                <Progress percent={qualityScore} showInfo={false} strokeColor="#5b3fd6" trailColor="#e8eaf1" />
                <p className="mb-0 mt-3 text-[13px] leading-relaxed text-slate-600">Mức hiện tại: <strong className="text-slate-900">{qualityLabel(data?.ratingLabel)}</strong>.</p>
              </div>
              <div>
                <div className="mb-2 flex items-end justify-between gap-3"><span className="text-sm font-semibold text-slate-700">Tỉ lệ tuyển thành công</span><span className="text-2xl font-bold text-slate-900">{successRate}%</span></div>
                <Progress percent={successRate} showInfo={false} strokeColor="#087a55" trailColor="#e8eaf1" />
                <p className="mb-0 mt-3 text-[13px] leading-relaxed text-slate-600">Tính từ số ứng viên đi làm trên tổng lượt giới thiệu.</p>
              </div>
            </div>
          )}
        </Surface>
        <Surface className="p-6">
          <AffiliateSectionHeading title="Kỳ đánh giá hiện tại" />
          <dl className="m-0 space-y-4 text-sm">
            <div><dt className="text-slate-500">Thời gian</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{data?.periodStart && data?.periodEnd ? `${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}` : 'Kỳ hiện tại'}</dd></div>
            <div><dt className="text-slate-500">Cập nhật gần nhất</dt><dd className="m-0 mt-1 font-semibold text-slate-900">{fmtDateTime(data?.calculatedAt)}</dd></div>
            <div><dt className="text-slate-500">Cách cải thiện</dt><dd className="m-0 mt-1 leading-relaxed text-slate-700">Ưu tiên ứng viên phù hợp yêu cầu, thông tin liên hệ chính xác và CV còn cập nhật.</dd></div>
          </dl>
        </Surface>
      </div>

      <Surface className="p-6">
        <AffiliateSectionHeading title="Lịch sử các kỳ đánh giá" description="So sánh kết quả theo thời gian để nhận biết xu hướng chất lượng hồ sơ." />
        <Table className="admin-soft-table" rowKey="affiliatePerformanceId" columns={historyColumns} dataSource={data?.history ?? []} loading={performance.isLoading} pagination={false} scroll={{ x: 820 }} locale={{ emptyText: <div className="py-8 text-slate-500">Chưa có dữ liệu của kỳ đánh giá trước.</div> }} />
      </Surface>
    </div>
  );
};

export default AffiliatePerformancePage;
