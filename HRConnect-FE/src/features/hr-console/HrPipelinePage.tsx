/**
 * @file HrPipelinePage.tsx
 * @description Read-only MF-04 progress for Internal HR: interviews, offers and placements.
 * Per main-flows MF-04 the Client schedules, sends offers and confirms start; Internal HR only
 * follows along, so this page has no action buttons.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { pipelineApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { InterviewItem, OfferItem, PagedItems, PlacementItem } from '@/types/api/hr';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { INTERVIEW_RESULT, INTERVIEW_STATUS, OFFER_STATUS, PLACEMENT_STATUS, pick } from './hrLabels';

type Tab = 'interviews' | 'offers' | 'placements';
const TABS: Tab[] = ['interviews', 'offers', 'placements'];
const PAGE_SIZE = 10;

const fmt = (v?: string | null, f = 'HH:mm DD/MM/YYYY') => (v ? dayjs(v).format(f) : '—');
const money = (v: number | null, currency: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(v)} ${currency === 'VND' ? '₫' : currency}`;

const JobCell: React.FC<{ title: string; company: string }> = ({ title, company }) => (
  <div className="min-w-0">
    <div className="truncate font-medium text-slate-900">{title}</div>
    <div className="truncate text-[12.5px] text-slate-600">{company}</div>
  </div>
);

const useTabCount = (tab: Tab) =>
  useQuery({
    queryKey: ['hr-pipeline', 'count', tab],
    queryFn: async () => (await pipelineApi[tab]({ page: 1, pageSize: 1 })).total,
  });

const interviewColumns: ColumnsType<InterviewItem> = [
  { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidateName} secondary={r.candidateEmail} /> },
  { title: 'Tin tuyển dụng', key: 'j', render: (_, r) => <JobCell title={r.jobTitle} company={r.companyName} /> },
  { title: 'Vòng', dataIndex: 'interviewRound', width: 70 },
  { title: 'Thời gian', dataIndex: 'scheduledAt', width: 150, render: (v) => <span className="tabular-nums">{fmt(v)}</span> },
  {
    title: 'Trạng thái',
    key: 's',
    width: 190,
    render: (_, r) => {
      const st = pick(INTERVIEW_STATUS, r.status);
      return (
        <div>
          <StatusDot tone={st.tone}>{st.label}</StatusDot>
          {r.result && <div className="mt-0.5 text-xs text-slate-600">Kết quả: {INTERVIEW_RESULT[r.result] ?? r.result}</div>}
        </div>
      );
    },
  },
];

const offerColumns: ColumnsType<OfferItem> = [
  { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidateName} secondary={r.candidateEmail} /> },
  { title: 'Tin tuyển dụng', key: 'j', render: (_, r) => <JobCell title={r.jobTitle} company={r.companyName} /> },
  { title: 'Lương', key: 'm', width: 150, render: (_, r) => <span className="tabular-nums">{money(r.salary, r.currencyCode)}</span> },
  { title: 'Ngày bắt đầu', dataIndex: 'startDate', width: 120, render: (v) => <span className="tabular-nums">{fmt(v, 'DD/MM/YYYY')}</span> },
  {
    title: 'Trạng thái',
    key: 's',
    width: 170,
    render: (_, r) => {
      const st = pick(OFFER_STATUS, r.status);
      return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
    },
  },
];

const placementColumns: ColumnsType<PlacementItem> = [
  { title: 'Ứng viên', key: 'c', render: (_, r) => <PersonCell name={r.candidate.fullName} secondary={r.candidate.email} /> },
  { title: 'Tin tuyển dụng', key: 'j', render: (_, r) => <JobCell title={r.job.title} company={r.job.companyName} /> },
  { title: 'Vị trí', key: 'p', render: (_, r) => r.position ?? '—' },
  { title: 'Ngày đi làm', dataIndex: 'actualStartDate', width: 120, render: (v) => <span className="tabular-nums">{fmt(v, 'DD/MM/YYYY')}</span> },
  {
    title: 'Trạng thái',
    key: 's',
    width: 150,
    render: (_, r) => {
      const st = pick(PLACEMENT_STATUS, r.status);
      return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
    },
  },
];

const EMPTY: Record<Tab, string> = {
  interviews: 'Chưa có lịch phỏng vấn. Client lên lịch sau khi hồ sơ được chọn gửi đi.',
  offers: 'Chưa có offer nào. Client tạo và gửi offer sau khi ứng viên đạt phỏng vấn.',
  placements: 'Chưa có ứng viên nào đi làm.',
};

export const HrPipelinePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS as string[]).includes(searchParams.get('tab') ?? '') ? (searchParams.get('tab') as Tab) : 'interviews';
  const page = Number(searchParams.get('page')) || 1;
  const counts = { interviews: useTabCount('interviews'), offers: useTabCount('offers'), placements: useTabCount('placements') };

  const list = useQuery({
    queryKey: ['hr-pipeline', tab, page],
    queryFn: (): Promise<PagedItems<unknown>> => pipelineApi[tab]({ page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const go = (next: Partial<{ tab: Tab; page: number }>) => {
    const p = new URLSearchParams(searchParams);
    if (next.tab) {
      p.set('tab', next.tab);
      p.delete('page');
    }
    if (next.page) p.set('page', String(next.page));
    setSearchParams(p);
  };

  const pagination = {
    current: page,
    pageSize: PAGE_SIZE,
    total: list.data?.total ?? 0,
    showSizeChanger: false,
    onChange: (p: number) => go({ page: p }),
  };
  const empty = { emptyText: <div className="py-10 text-slate-600">{EMPTY[tab]}</div> };
  const items = (list.data?.items ?? []) as never[];

  return (
    <div>
      <PageHero
        eyebrow="Theo dõi"
        title="Tiến độ tuyển dụng"
        description="Client là bên phỏng vấn, gửi offer và xác nhận ứng viên đi làm. Internal HR theo dõi để hỗ trợ, trang này chỉ để xem."
      />
      <Surface>
        <div className="px-5 pb-3 pt-5">
          <FilterPills
            label="Chọn giai đoạn"
            value={tab}
            onChange={(v) => go({ tab: v })}
            options={[
              { value: 'interviews', label: 'Phỏng vấn', count: counts.interviews.data },
              { value: 'offers', label: 'Offer', count: counts.offers.data },
              { value: 'placements', label: 'Đi làm', count: counts.placements.data },
            ]}
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được dữ liệu" description={getApiErrorMessage(list.error)} />
          </div>
        ) : tab === 'interviews' ? (
          <Table<InterviewItem> className="admin-soft-table"
            scroll={{ x: 'max-content' }} rowKey="interviewId" columns={interviewColumns} dataSource={items} loading={list.isFetching} pagination={pagination} locale={empty} />
        ) : tab === 'offers' ? (
          <Table<OfferItem> className="admin-soft-table"
            scroll={{ x: 'max-content' }} rowKey="offerId" columns={offerColumns} dataSource={items} loading={list.isFetching} pagination={pagination} locale={empty} />
        ) : (
          <Table<PlacementItem> className="admin-soft-table"
            scroll={{ x: 'max-content' }} rowKey="placementId" columns={placementColumns} dataSource={items} loading={list.isFetching} pagination={pagination} locale={empty} />
        )}
      </Surface>
    </div>
  );
};

export default HrPipelinePage;
