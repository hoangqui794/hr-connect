/**
 * @file HrPipelinePage.tsx
 * @description MF-04 progress: interviews, offers and placements.
 * In Client mode (onOpenApplication / onOpenInterview provided), rows feature a direct "Chi tiết"
 * action button and hide redundant company branding. In Internal HR mode, rows remain read-only.
 */
import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { pipelineApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { InterviewItem, OfferItem, PagedItems, PlacementItem } from '@/types/api/hr';
import { PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { INTERVIEW_RESULT, INTERVIEW_STATUS, OFFER_STATUS, PLACEMENT_STATUS, pick } from './hrLabels';

type Tab = 'interviews' | 'offers' | 'placements';
const TABS: Tab[] = ['interviews', 'offers', 'placements'];
const PAGE_SIZE = 10;

const fmt = (v?: string | null, f = 'HH:mm DD/MM/YYYY') => (v ? dayjs(v).format(f) : '—');
const money = (v: number | null, currency: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(v)} ${currency === 'VND' ? '₫' : currency}`;

const JobCell: React.FC<{ title: string; company?: string | null; hideCompany?: boolean }> = ({
  title,
  company,
  hideCompany,
}) => (
  <div className="min-w-0 py-1">
    <div className="truncate font-semibold text-[13.5px] text-slate-900" title={title}>
      {title}
    </div>
    {!hideCompany && company && <div className="truncate text-xs text-slate-500 mt-0.5">{company}</div>}
  </div>
);

const useTabCount = (tab: Tab) =>
  useQuery({
    queryKey: ['hr-pipeline', 'count', tab],
    queryFn: async () => (await pipelineApi[tab]({ page: 1, pageSize: 1 })).total,
  });

const EMPTY: Record<Tab, string> = {
  interviews: 'Chưa có lịch phỏng vấn. Client lên lịch sau khi hồ sơ được chọn gửi đi.',
  offers: 'Chưa có offer nào. Client tạo và gửi offer sau khi ứng viên đạt phỏng vấn.',
  placements: 'Chưa có ứng viên nào đi làm.',
};

/** Shared by Internal HR (read-only) and the Client, which opens an application to act on it. */
export const HrPipelinePage: React.FC<{
  eyebrow?: string;
  description?: string;
  tip?: boolean;
  onOpenApplication?: (applicationId: string) => void;
  onOpenInterview?: (interview: InterviewItem) => void;
  emptyHints?: Partial<Record<Tab, string>>;
}> = ({ eyebrow = 'Theo dõi', description, tip, onOpenApplication, onOpenInterview, emptyHints }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS as string[]).includes(searchParams.get('tab') ?? '') ? (searchParams.get('tab') as Tab) : 'interviews';
  const page = Number(searchParams.get('page')) || 1;
  const counts = { interviews: useTabCount('interviews'), offers: useTabCount('offers'), placements: useTabCount('placements') };

  const isClient = Boolean(onOpenApplication || onOpenInterview);

  const interviewColumns: ColumnsType<InterviewItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 270,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <PersonCell name={r.candidateName} secondary={r.candidateEmail} />
          </div>
        ),
      },
      {
        title: 'Tin tuyển dụng',
        key: 'j',
        width: 280,
        render: (_, r) => <JobCell title={r.jobTitle} company={r.companyName} hideCompany={isClient} />,
      },
      {
        title: 'Vòng',
        dataIndex: 'interviewRound',
        width: 90,
        align: 'center',
        render: (v) => (
          <Tag className="m-0 font-semibold rounded-md border-0 bg-slate-100 text-slate-700 px-2 py-0.5 text-xs">
            Vòng {v}
          </Tag>
        ),
      },
      {
        title: 'Thời gian',
        dataIndex: 'scheduledAt',
        width: 140,
        align: 'center',
        render: (v) => (
          <div className="tabular-nums space-y-0.5">
            <div className="text-[13.5px] font-semibold text-slate-800">{v ? dayjs(v).format('HH:mm') : '—'}</div>
            <div className="text-[11.5px] text-slate-500">{v ? dayjs(v).format('DD/MM/YYYY') : ''}</div>
          </div>
        ),
      },
      {
        title: 'Trạng thái',
        key: 's',
        width: 190,
        align: 'left',
        render: (_, r) => {
          const st = pick(INTERVIEW_STATUS, r.status);
          return (
            <div className="py-1 space-y-1 text-left">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
              {r.result && (
                <div className="text-[11.5px] text-slate-500 pl-3.5">
                  Kết quả: <span className="font-semibold text-slate-700">{INTERVIEW_RESULT[r.result] ?? r.result}</span>
                </div>
              )}
            </div>
          );
        },
      },
      ...(isClient
        ? [
            {
              title: 'Thao tác',
              key: 'actions',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, r: InterviewItem) => (
                <Button
                  type="primary"
                  ghost
                  size="small"
                  className="w-[90px] text-xs font-semibold rounded-lg shadow-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInterview?.(r);
                  }}
                >
                  Chi tiết
                </Button>
              ),
            },
          ]
        : []),
    ],
    [isClient, onOpenInterview]
  );

  const offerColumns: ColumnsType<OfferItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 270,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <PersonCell name={r.candidateName} secondary={r.candidateEmail} />
          </div>
        ),
      },
      {
        title: 'Tin tuyển dụng',
        key: 'j',
        width: 280,
        render: (_, r) => <JobCell title={r.jobTitle} company={r.companyName} hideCompany={isClient} />,
      },
      {
        title: 'Lương',
        key: 'm',
        width: 160,
        render: (_, r) => (
          <span className="tabular-nums font-semibold text-emerald-700 text-[13.5px]">
            {money(r.salary, r.currencyCode)}
          </span>
        ),
      },
      {
        title: 'Ngày bắt đầu',
        dataIndex: 'startDate',
        width: 130,
        align: 'center',
        render: (v) => <span className="tabular-nums text-[13px] text-slate-700">{fmt(v, 'DD/MM/YYYY')}</span>,
      },
      {
        title: 'Trạng thái',
        key: 's',
        width: 180,
        align: 'left',
        render: (_, r) => {
          const st = pick(OFFER_STATUS, r.status);
          return (
            <div className="py-1 text-left">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
          );
        },
      },
      ...(isClient
        ? [
            {
              title: 'Thao tác',
              key: 'actions',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, r: OfferItem) => (
                <Button
                  type="primary"
                  ghost
                  size="small"
                  className="w-[90px] text-xs font-semibold rounded-lg shadow-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApplication?.(r.applicationId);
                  }}
                >
                  Chi tiết
                </Button>
              ),
            },
          ]
        : []),
    ],
    [isClient, onOpenApplication]
  );

  const placementColumns: ColumnsType<PlacementItem> = useMemo(
    () => [
      {
        title: 'Ứng viên',
        key: 'c',
        width: 270,
        render: (_, r) => (
          <div className="flex items-center gap-3 py-1">
            <PersonCell name={r.candidate.fullName} secondary={r.candidate.email} />
          </div>
        ),
      },
      {
        title: 'Tin tuyển dụng',
        key: 'j',
        width: 280,
        render: (_, r) => <JobCell title={r.job.title} company={r.job.companyName} hideCompany={isClient} />,
      },
      {
        title: 'Vị trí',
        key: 'p',
        render: (_, r) => <span className="text-[13.5px] font-medium text-slate-800">{r.position ?? '—'}</span>,
      },
      {
        title: 'Ngày đi làm',
        dataIndex: 'actualStartDate',
        width: 130,
        align: 'center',
        render: (v) => <span className="tabular-nums text-[13px] text-slate-700">{fmt(v, 'DD/MM/YYYY')}</span>,
      },
      {
        title: 'Trạng thái',
        key: 's',
        width: 180,
        align: 'left',
        render: (_, r) => {
          const st = pick(PLACEMENT_STATUS, r.status);
          return (
            <div className="py-1 text-left">
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
          );
        },
      },
      ...(isClient
        ? [
            {
              title: 'Thao tác',
              key: 'actions',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, r: PlacementItem) => (
                <Button
                  type="primary"
                  ghost
                  size="small"
                  className="w-[90px] text-xs font-semibold rounded-lg shadow-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApplication?.(r.applicationId);
                  }}
                >
                  Chi tiết
                </Button>
              ),
            },
          ]
        : []),
    ],
    [isClient, onOpenApplication]
  );

  const list = useQuery({
    queryKey: ['hr-pipeline', tab, page],
    queryFn: (): Promise<PagedItems<unknown>> => pipelineApi[tab]({ page, pageSize: PAGE_SIZE }),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === tab ? prev : undefined),
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
  const empty = { emptyText: <div className="py-10 text-slate-600">{emptyHints?.[tab] ?? EMPTY[tab]}</div> };
  const rowProps = (r: { applicationId: string; interviewId?: string }) => {
    if (tab === 'interviews' && onOpenInterview) {
      return {
        onClick: () => onOpenInterview(r as unknown as InterviewItem),
        onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onOpenInterview(r as unknown as InterviewItem),
        tabIndex: 0,
        className: 'cursor-pointer',
      };
    }
    if (onOpenApplication) {
      return {
        onClick: () => onOpenApplication(r.applicationId),
        onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onOpenApplication(r.applicationId),
        tabIndex: 0,
        className: 'cursor-pointer',
      };
    }
    return {};
  };
  const items = (list.data?.items ?? []) as never[];

  return (
    <div>
      <PageHero
        eyebrow={eyebrow}
        title={onOpenApplication ? 'Phỏng vấn & Offer' : 'Tiến độ tuyển dụng'}
        tip={tip}
        description={
          description ??
          'Client là bên phỏng vấn, gửi offer và xác nhận ứng viên đi làm. Internal HR theo dõi để hỗ trợ, trang này chỉ để xem.'
        }
      />
      <Surface>
        <div className="px-5 pb-4 pt-5">
          <div
            role="radiogroup"
            aria-label="Chọn giai đoạn"
            className="grid grid-cols-3 max-w-[480px] overflow-hidden rounded-xl border border-solid border-slate-200 bg-white shadow-xs"
          >
            {(
              [
                ['interviews', 'Phỏng vấn', counts.interviews.data],
                ['offers', 'Offer', counts.offers.data],
                ['placements', 'Đi làm', counts.placements.data],
              ] as const
            ).map(([key, label, count]) => {
              const selected = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => go({ tab: key })}
                  className={`cursor-pointer border-0 border-r border-solid border-slate-200 p-3 text-left transition-all duration-150 last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--console-accent)] ${
                    selected
                      ? 'bg-blue-50/70 shadow-[inset_0_-3px_0_#2563eb]'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-[12px] font-medium ${selected ? 'text-blue-700 font-semibold' : 'text-slate-600'}`}>
                    {label}
                  </div>
                  <div className={`mt-1 text-xl font-bold tabular-nums ${selected ? 'text-blue-900' : 'text-slate-900'}`}>
                    {count ?? 0}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được dữ liệu" description={getApiErrorMessage(list.error)} />
          </div>
        ) : tab === 'interviews' ? (
          <Table<InterviewItem>
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
            rowKey="interviewId"
            columns={interviewColumns}
            dataSource={items}
            loading={list.isFetching}
            pagination={pagination}
            locale={empty}
            onRow={rowProps}
          />
        ) : tab === 'offers' ? (
          <Table<OfferItem>
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
            rowKey="offerId"
            columns={offerColumns}
            dataSource={items}
            loading={list.isFetching}
            pagination={pagination}
            locale={empty}
            onRow={rowProps}
          />
        ) : (
          <Table<PlacementItem>
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
            rowKey="placementId"
            columns={placementColumns}
            dataSource={items}
            loading={list.isFetching}
            pagination={pagination}
            locale={empty}
            onRow={rowProps}
          />
        )}
      </Surface>
    </div>
  );
};

export default HrPipelinePage;
