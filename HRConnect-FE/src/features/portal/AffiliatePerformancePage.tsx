/**
 * @file AffiliatePerformancePage.tsx
 * @description Dedicated page for Affiliate to view recruitment performance metrics,
 * quality ratings, conversion rates, and period history (GET /api/v1/affiliates/profile/me/performance).
 */

import React, { useState } from 'react';
import {
  Table,
  Tag,
  Radio,
  Progress,
  Skeleton,
  Alert,
  Breadcrumb,
  Button,
} from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  CalendarOutlined,
  HomeOutlined,
  ArrowLeftOutlined,
  StarFilled,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi } from '@/services/api/mf02/affiliateApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { Surface } from '@/features/admin-console/ui';
import type { AffiliatePerformance, AffiliatePerformanceHistoryItem } from '@/types/api/mf02/affiliate';

const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const fmtDateTime = (d?: string | null) => (d ? dayjs(d).format('HH:mm DD/MM/YYYY') : '—');

export const AffiliatePerformancePage: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');

  const { data: perf, isLoading, isError, error } = useQuery({
    queryKey: ['affiliate-performance', period],
    queryFn: () => affiliateApi.performance(),
  });

  const p = perf;

  const historyColumns: ColumnsType<AffiliatePerformanceHistoryItem> = [
    {
      title: 'Kỳ đánh giá',
      key: 'period',
      render: (_, r) => (
        <span className="font-medium text-slate-900">
          {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
        </span>
      ),
    },
    {
      title: 'Lượt nộp',
      dataIndex: 'totalSubmissions',
      width: 100,
      render: (v) => <span className="tabular-nums">{v}</span>,
    },
    {
      title: 'Qua sàng lọc',
      dataIndex: 'totalShortlisted',
      width: 110,
      render: (v) => <span className="tabular-nums text-slate-700">{v}</span>,
    },
    {
      title: 'Phỏng vấn',
      dataIndex: 'totalInterviews',
      width: 110,
      render: (v) => <span className="tabular-nums text-blue-700">{v}</span>,
    },
    {
      title: 'Đi làm',
      dataIndex: 'totalPlacements',
      width: 100,
      render: (v) => <span className="font-bold tabular-nums text-emerald-700">{v}</span>,
    },
    {
      title: 'Tỉ lệ tuyển',
      dataIndex: 'submissionToHireRate',
      width: 120,
      render: (v) => (v != null ? `${Math.round(v * 100)}%` : '—'),
    },
    {
      title: 'Xếp hạng',
      key: 'rating',
      width: 140,
      render: (_, r) => (
        <Tag color={r.qualityRating && r.qualityRating >= 80 ? 'green' : 'blue'}>
          {r.ratingLabel || (r.qualityRating ? `${Math.round(r.qualityRating)} điểm` : 'Tiêu chuẩn')}
        </Tag>
      ),
    },
    {
      title: 'Tính lúc',
      dataIndex: 'calculatedAt',
      width: 140,
      render: (v) => <span className="text-xs text-slate-500">{fmtDateTime(v)}</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={() => navigate('/affiliate/dashboard')}
                >
                  <HomeOutlined /> Trang chủ
                </span>
              ),
            },
            {
              title: (
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <TrophyOutlined className="text-amber-500" /> Hiệu suất tuyển dụng của tôi
                </span>
              ),
            },
          ]}
        />
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/affiliate/dashboard')}>
          Quay lại tổng quan
        </Button>
      </div>

      {/* Hero Banner with Period selector */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
              <StarFilled className="text-amber-400" /> Báo cáo chất lượng CTV
            </span>
            <h1 className="m-0 mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hiệu suất tuyển dụng {p?.displayName ? `· ${p.displayName}` : ''}
            </h1>
            <p className="m-0 mt-2 max-w-xl text-sm leading-relaxed text-indigo-100/80">
              Đánh giá chất lượng hồ sơ giới thiệu, tỷ lệ ứng viên đi làm và lịch sử duy trì chất lượng qua các kỳ tuyển dụng.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-1.5 backdrop-blur-md border border-white/10">
            <Radio.Group
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              size="middle"
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Tháng này', value: 'MONTH' },
                { label: 'Quý này', value: 'QUARTER' },
                { label: 'Năm nay', value: 'YEAR' },
              ]}
            />
          </div>
        </div>

        {/* Current Period Highlights */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 border-0 border-t border-solid border-white/10 pt-6">
          <div>
            <span className="text-xs font-medium text-indigo-200">Xếp hạng chất lượng</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-300">
                {isLoading ? '...' : p?.ratingLabel || 'Tiêu chuẩn'}
              </span>
              {p?.qualityRating != null && (
                <span className="text-sm text-indigo-200">({Math.round(p.qualityRating)}/100)</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-indigo-200">Tỉ lệ ứng viên đi làm</span>
            <div className="mt-1 text-2xl font-bold text-white">
              {isLoading ? '...' : `${Math.round((p?.submissionToHireRate ?? 0) * 100)}%`}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-indigo-200">Kỳ đánh giá hiện tại</span>
            <div className="mt-1 text-sm font-semibold text-indigo-100">
              {p?.periodStart && p?.periodEnd ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : 'Kỳ hiện tại'}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-indigo-200">Cập nhật lần cuối</span>
            <div className="mt-1 text-sm text-indigo-200">
              {fmtDateTime(p?.calculatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Tổng lượt giới thiệu', val: p?.totalSubmissions, hint: 'Hồ sơ đã nộp', color: 'text-slate-900' },
          { label: 'Được chọn sàng lọc', val: p?.totalShortlisted, hint: 'Doanh nghiệp quan tâm', color: 'text-indigo-600' },
          { label: 'Tham gia phỏng vấn', val: p?.totalInterviews, hint: 'Có lịch phỏng vấn', color: 'text-blue-600' },
          { label: 'Đi làm thành công', val: p?.totalPlacements, hint: 'Đã nhận việc', color: 'text-emerald-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {item.label}
            </span>
            <div className={`mt-2 text-3xl font-extrabold tabular-nums ${item.color}`}>
              {isLoading ? <Skeleton.Input active size="small" /> : item.val ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-400">{item.hint}</div>
          </div>
        ))}
      </div>

      {/* History Table */}
      <Surface padded>
        <div className="mb-4">
          <h3 className="m-0 text-base font-bold text-slate-900">Lịch sử hiệu suất các kỳ trước</h3>
          <p className="m-0 text-xs text-slate-500 mt-0.5">
            Dữ liệu tổng hợp theo chu kỳ giúp theo dõi tiến trình cộng tác và duy trì xếp hạng thưởng hoa hồng.
          </p>
        </div>

        <Table
          className="admin-soft-table"
          rowKey="affiliatePerformanceId"
          columns={historyColumns}
          dataSource={p?.history ?? []}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: <div className="py-8 text-slate-400">Chưa có bản ghi lịch sử hiệu suất nào.</div> }}
        />
      </Surface>
    </div>
  );
};

export default AffiliatePerformancePage;
