/**
 * @file AdminReportsPage.tsx
 * @description Platform Admin reports and business intelligence dashboard
 * backing GET /api/v1/reports/{overview, revenue, top-affiliates, top-companies}.
 */

import React, { useState } from 'react';
import {
  DatePicker,
  Radio,
  Table,
  Tag,
  Skeleton,
  Alert,
  Tabs,
  Typography,
} from 'antd';
import {
  DollarCircleOutlined,
  TeamOutlined,
  BankOutlined,
  FileTextOutlined,
  TrophyOutlined,
  RiseOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/services/api/reportApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { PageHero, Surface } from '@/features/admin-console/ui';
import type {
  ReportOverviewData,
  ReportRevenueData,
  TopAffiliateItem,
  TopCompanyItem,
} from '@/types/api/report';

const { Text } = Typography;

const formatMoney = (amount?: number | null, currency = '₫') => {
  if (amount == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} ${currency}`;
};

export const AdminReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [revenueGroupBy, setRevenueGroupBy] = useState<'month' | 'quarter' | 'year'>('month');

  const fromStr = dateRange[0].format('YYYY-MM-DD');
  const toStr = dateRange[1].format('YYYY-MM-DD');

  // Queries
  const overviewQuery = useQuery({
    queryKey: ['admin-reports-overview', fromStr, toStr],
    queryFn: () => reportApi.getOverview({ from: fromStr, to: toStr }),
  });

  const revenueQuery = useQuery({
    queryKey: ['admin-reports-revenue', fromStr, toStr, revenueGroupBy],
    queryFn: () => reportApi.getRevenue({ from: fromStr, to: toStr, groupBy: revenueGroupBy }),
  });

  const topAffiliatesQuery = useQuery({
    queryKey: ['admin-reports-top-affiliates', fromStr, toStr],
    queryFn: () => reportApi.getTopAffiliates({ from: fromStr, to: toStr, limit: 10 }),
  });

  const topCompaniesQuery = useQuery({
    queryKey: ['admin-reports-top-companies', fromStr, toStr],
    queryFn: () => reportApi.getTopCompanies({ from: fromStr, to: toStr, limit: 10 }),
  });

  const ov = overviewQuery.data;
  const rev = revenueQuery.data;

  // Columns for Top Affiliates
  const affiliateColumns: ColumnsType<TopAffiliateItem> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, idx) => (
        <span className="font-bold text-slate-500">{idx + 1}</span>
      ),
    },
    {
      title: 'Cộng tác viên',
      dataIndex: 'fullName',
      render: (v) => <span className="font-semibold text-slate-900">{v}</span>,
    },
    {
      title: 'Lượt nộp CV',
      dataIndex: 'totalSubmissions',
      width: 120,
      render: (v) => <span className="tabular-nums">{v}</span>,
    },
    {
      title: 'Ứng viên đi làm',
      dataIndex: 'totalPlacements',
      width: 140,
      render: (v) => <span className="font-semibold tabular-nums text-emerald-700">{v}</span>,
    },
    {
      title: 'Tỉ lệ chuyển đổi',
      dataIndex: 'submissionToHireRate',
      width: 140,
      render: (v) => (v != null ? `${Math.round(v * 100)}%` : '—'),
    },
    {
      title: 'Đánh giá chất lượng',
      key: 'rating',
      width: 160,
      render: (_, r) => (
        <Tag color={r.qualityRating && r.qualityRating >= 80 ? 'green' : 'blue'}>
          {r.ratingLabel || (r.qualityRating ? `${Math.round(r.qualityRating)} điểm` : 'Tiêu chuẩn')}
        </Tag>
      ),
    },
    {
      title: 'Hoa hồng nhận',
      dataIndex: 'commissionEarned',
      width: 160,
      render: (v) => <span className="font-semibold tabular-nums text-indigo-700">{formatMoney(v)}</span>,
    },
  ];

  // Columns for Top Companies
  const companyColumns: ColumnsType<TopCompanyItem> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, idx) => (
        <span className="font-bold text-slate-500">{idx + 1}</span>
      ),
    },
    {
      title: 'Doanh nghiệp',
      dataIndex: 'companyName',
      render: (v, r) => (
        <div>
          <div className="font-semibold text-slate-900">{v}</div>
          {r.industry && <div className="text-xs text-slate-500">{r.industry}</div>}
        </div>
      ),
    },
    {
      title: 'Tin đang tuyển',
      dataIndex: 'activeJobs',
      width: 140,
      render: (v) => <span className="tabular-nums">{v}</span>,
    },
    {
      title: 'Tuyển thành công',
      dataIndex: 'placements',
      width: 150,
      render: (v) => <span className="font-semibold tabular-nums text-emerald-700">{v}</span>,
    },
    {
      title: 'Doanh thu đóng góp',
      dataIndex: 'revenueCollected',
      width: 180,
      render: (v) => <span className="font-bold tabular-nums text-blue-800">{formatMoney(v)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHero
          eyebrow="Báo cáo & Thống kê"
          title="Báo cáo toàn diện hệ thống"
          description="Chỉ số hiệu suất kinh doanh, doanh thu theo gói dịch vụ và bảng xếp hạng thành tích toàn hệ thống."
        />
        <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm border border-slate-200">
          <CalendarOutlined className="text-slate-400 ml-1" />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <FileTextOutlined className="text-blue-500" /> Hồ sơ ứng tuyển
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200/60">+15.2%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {overviewQuery.isLoading ? <Skeleton.Input active size="small" /> : ov?.applications?.submitted ?? 0}
          </div>
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            <span>Chọn: <b>{ov?.applications?.shortlisted ?? 0}</b></span>
            <span>Phỏng vấn: <b>{ov?.applications?.interview ?? 0}</b></span>
            <span>Đi làm: <b>{ov?.applications?.placed ?? 0}</b></span>
          </div>
        </div>

        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <DollarCircleOutlined className="text-slate-600" /> Doanh thu thực thu
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60">+24.8%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {revenueQuery.isLoading ? (
              <Skeleton.Input active size="small" />
            ) : (
              formatMoney(
                Object.values(rev?.totals ?? {}).reduce((acc, t) => acc + (t.collected ?? 0), 0)
              )
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Hóa đơn xuất: {formatMoney(Object.values(rev?.totals ?? {}).reduce((acc, t) => acc + (t.billed ?? 0), 0))}
          </div>
        </div>

        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <TeamOutlined className="text-slate-600" /> Hoa hồng Affiliate
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200/60">+18.0%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {revenueQuery.isLoading ? (
              <Skeleton.Input active size="small" />
            ) : (
              formatMoney(rev?.commission?.earned ?? 0)
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Đã chi trả: {formatMoney(rev?.commission?.paid ?? 0)}
          </div>
        </div>

        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <BankOutlined className="text-slate-600" /> Mạng lưới đối tác
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200/60">+9.5%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {overviewQuery.isLoading ? (
              <Skeleton.Input active size="small" />
            ) : (
              (ov?.companies?.verified ?? 0) + (ov?.affiliates?.active ?? 0)
            )}
          </div>
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            <span>DN: <b>{ov?.companies?.verified ?? 0}</b></span>
            <span>Affiliate: <b>{ov?.affiliates?.active ?? 0}</b></span>
            <span>Chờ duyệt: <b>{(ov?.companies?.pending ?? 0) + (ov?.affiliates?.pending ?? 0)}</b></span>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown by Service */}
      <Surface padded>
        <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-slate-100 pb-4">
          <div>
            <h3 className="m-0 text-base font-bold text-slate-900">Doanh thu theo gói dịch vụ</h3>
            <p className="m-0 text-xs text-slate-500">Chi tiết doanh thu phát sinh và thực thu giữa các hình thức dịch vụ.</p>
          </div>
          <Radio.Group
            value={revenueGroupBy}
            onChange={(e) => setRevenueGroupBy(e.target.value)}
            size="small"
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: 'Theo Tháng', value: 'month' },
              { label: 'Theo Quý', value: 'quarter' },
              { label: 'Theo Năm', value: 'year' },
            ]}
          />
        </div>

        {revenueQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} className="mt-4" />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                code: 'HEADHUNT_COD',
                title: 'Headhunt COD',
                desc: 'Phí thành công khi ứng viên nhận việc',
                data: rev?.totals?.HEADHUNT_COD,
                color: 'blue',
              },
              {
                code: 'CV_SOURCING',
                title: 'CV Sourcing',
                desc: 'Bàn giao gói CV đạt chuẩn sàng lọc',
                data: rev?.totals?.CV_SOURCING,
                color: 'purple',
              },
              {
                code: 'CV_APPLICATION',
                title: 'Đăng tin tuyển dụng',
                desc: 'Phí niêm yết và đăng tin tuyển dụng',
                data: rev?.totals?.CV_APPLICATION,
                color: 'emerald',
              },
            ].map((srv) => (
              <div key={srv.code} className="rounded-2xl border border-solid border-slate-200/80 bg-slate-50/60 p-4">
                <div className="font-bold text-slate-900">{srv.title}</div>
                <div className="text-xs text-slate-500 mb-3">{srv.desc}</div>
                <div className="space-y-1.5 border-0 border-t border-solid border-slate-200/60 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phát sinh:</span>
                    <span className="font-semibold text-slate-800">{formatMoney(srv.data?.billed ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thực thu:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatMoney(srv.data?.collected ?? 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* Top Rankings: Affiliates & Companies */}
      <Surface padded>
        <Tabs
          items={[
            {
              key: 'top-affiliates',
              label: (
                <span className="font-semibold">
                  <TrophyOutlined className="text-amber-500" /> Bảng xếp hạng Top Affiliate
                </span>
              ),
              children: (
                <Table
                  className="admin-soft-table"
                  rowKey="affiliateId"
                  columns={affiliateColumns}
                  dataSource={topAffiliatesQuery.data ?? []}
                  loading={topAffiliatesQuery.isFetching}
                  pagination={false}
                  locale={{ emptyText: <div className="py-8 text-slate-400">Chưa có dữ liệu Affiliate trong khoảng thời gian này.</div> }}
                />
              ),
            },
            {
              key: 'top-companies',
              label: (
                <span className="font-semibold">
                  <RiseOutlined className="text-blue-500" /> Bảng xếp hạng Doanh nghiệp tuyển dụng
                </span>
              ),
              children: (
                <Table
                  className="admin-soft-table"
                  rowKey="companyId"
                  columns={companyColumns}
                  dataSource={topCompaniesQuery.data ?? []}
                  loading={topCompaniesQuery.isFetching}
                  pagination={false}
                  locale={{ emptyText: <div className="py-8 text-slate-400">Chưa có dữ liệu Doanh nghiệp trong khoảng thời gian này.</div> }}
                />
              ),
            },
          ]}
        />
      </Surface>
    </div>
  );
};

export default AdminReportsPage;
