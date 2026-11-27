/**
 * @file HrPipelinePage.tsx
 * @description MF-04 progress: interviews, offers and placements.
 * In Client mode (onOpenApplication / onOpenInterview provided), rows feature a direct "Chi tiết"
 * action button and hide redundant company branding. In Internal HR mode, rows remain read-only.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { pipelineApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { InterviewItem, OfferItem, PagedItems, PlacementItem } from '@/types/api/hr';
import { PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { isInterviewInProgress, isInterviewOverdue } from '@/features/recruitment/interviewTiming';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { INTERVIEW_RESULT, INTERVIEW_STATUS, OFFER_STATUS, PLACEMENT_STATUS, pick } from './hrLabels';

type Tab = 'interviews' | 'offers' | 'placements';
const TABS: Tab[] = ['interviews', 'offers', 'placements'];
const PAGE_SIZE = 10;

const TAB_STATUS_OPTIONS: Record<Tab, { value: string; label: string }[]> = {
  interviews: [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'SCHEDULED', label: 'Đã lên lịch' },
    { value: 'COMPLETED', label: 'Đã phỏng vấn' },
    { value: 'NO_SHOW', label: 'Vắng mặt' },
    { value: 'CANCELLED', label: 'Đã hủy' },
  ],
  offers: [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'DRAFT', label: 'Bản nháp' },
    { value: 'SENT', label: 'Đã gửi' },
    { value: 'ACCEPTED', label: 'Đã nhận' },
    { value: 'DECLINED', label: 'Từ chối' },
    { value: 'WITHDRAWN', label: 'Đã thu hồi' },
    { value: 'EXPIRED', label: 'Hết hạn' },
  ],
  placements: [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'STARTED', label: 'Đã đi làm' },
    { value: 'LEFT_DURING_WARRANTY', label: 'Nghỉ trong bảo hành' },
  ],
};

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
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
        width: 220,
        align: 'left',
        render: (_, r) => {
          const st = pick(INTERVIEW_STATUS, r.status);
          const inProgress = isInterviewInProgress(r);
          const overdue = isInterviewOverdue(r);
          const phaseLabel = inProgress ? 'Đang trong giờ hẹn' : overdue ? 'Quá giờ · Chờ cập nhật' : st.label;
          const phaseTone = inProgress ? 'success' : overdue ? 'warning' : st.tone;
          const attendance = r.candidateAttendanceStatus?.toUpperCase();
          return (
            <div className="py-1 space-y-1 text-left">
              <StatusDot tone={phaseTone}>{phaseLabel}</StatusDot>
              {r.status === 'SCHEDULED' && (
                <div className="pl-3.5 text-[11px]">
                  {attendance === 'CONFIRMED' ? (
                    <span className="font-medium text-emerald-700">Ứng viên đã xác nhận tham gia</span>
                  ) : !overdue ? (
                    <span className="text-slate-500">Chờ ứng viên xác nhận</span>
                  ) : null}
                </div>
              )}
              {r.result && (
                <div className="text-[11.5px] text-slate-500 pl-3.5 flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Kết quả:</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[11px] border ${
                      r.result === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : r.result === 'FAIL'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {INTERVIEW_RESULT[r.result] ?? r.result}
                  </span>
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
        : [
            {
              title: 'Thao tác',
              key: 'hr-actions',
              width: 195,
              align: 'right' as const,
              render: (_: unknown, r: PlacementItem) => (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="small"
                    className="text-xs font-medium rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/hr/placement-review?highlight=${r.placementId}`);
                    }}
                  >
                    Sửa ngày
                  </Button>
                  {/* Reconciliation records only exist for HEADHUNT_COD (UC-41). */}
                  {r.serviceTypeCode === 'HEADHUNT_COD' && (
                    <Button
                      type="primary"
                      ghost
                      size="small"
                      className="text-xs font-medium rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hr/placement-reconciliations?highlight=${r.placementId}`);
                      }}
                    >
                      Đối soát
                    </Button>
                  )}
                </div>
              ),
            },
          ]),
    ],
    [isClient, navigate, onOpenApplication]
  );

  const trimmedKeyword = useDebouncedValue(searchText.trim(), 300);
  const list = useQuery({
    queryKey: ['hr-pipeline', tab, statusFilter, trimmedKeyword, page],
    queryFn: (): Promise<PagedItems<unknown>> =>
      pipelineApi[tab]({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        keyword: trimmedKeyword || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === tab ? prev : undefined),
  });

  const go = (next: Partial<{ tab: Tab; page: number }>) => {
    const p = new URLSearchParams(searchParams);
    if (next.tab) {
      p.set('tab', next.tab);
      p.delete('page');
      setStatusFilter('ALL');
      setSearchText('');
    }
    if (next.page) p.set('page', String(next.page));
    setSearchParams(p);
  };

  const hasFilters = trimmedKeyword.length > 0 || statusFilter !== 'ALL';
  const items = (list.data?.items ?? []) as never[];

  const pagination = {
    current: page,
    pageSize: PAGE_SIZE,
    total: list.data?.total ?? 0,
    showSizeChanger: false,
    onChange: (p: number) => go({ page: p }),
  };
  const empty = {
    emptyText: hasFilters ? (
      <div className="py-10 text-slate-600">
        <div>Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.</div>
        <Button
          className="mt-3"
          onClick={() => {
            setSearchText('');
            setStatusFilter('ALL');
            if (page !== 1) go({ page: 1 });
          }}
        >
          Xóa bộ lọc
        </Button>
      </div>
    ) : (
      <div className="py-10 text-slate-600">{emptyHints?.[tab] ?? EMPTY[tab]}</div>
    ),
  };
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

  return (
    <div>
      {onOpenApplication ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
                Phỏng Vấn & Đề Nghị Làm Việc
              </h1>
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0C4A6E] border border-sky-100">
                Tiến độ tuyển dụng
              </span>
            </div>
            <p className="m-0 mt-1 text-sm text-slate-500">
              {description ?? 'Quản lý lịch phỏng vấn, tạo và gửi offer trực tuyến, đồng thời xác nhận kết quả tiếp nhận ứng viên.'}
            </p>
          </div>
        </div>
      ) : (
        <PageHero
          eyebrow={eyebrow}
          title="Tiến độ tuyển dụng"
          tip={tip}
          description={
            description ??
            'Client là bên phỏng vấn, gửi offer và xác nhận ứng viên đi làm. Internal HR theo dõi để hỗ trợ, trang này chỉ để xem.'
          }
        />
      )}
      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div
            role="radiogroup"
            aria-label="Chọn giai đoạn"
            className="grid grid-cols-3 w-full max-w-[480px] overflow-hidden rounded-xl border border-solid border-slate-200 bg-white shadow-xs"
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
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                if (page !== 1) go({ page: 1 });
              }}
              options={TAB_STATUS_OPTIONS[tab]}
              className="w-full sm:w-[190px]"
            />
            <Input
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder={
                tab === 'placements'
                  ? 'Tìm theo tên ứng viên hoặc vị trí...'
                  : 'Tìm theo tên ứng viên hoặc tin tuyển dụng...'
              }
              aria-label="Tìm kiếm tiến độ tuyển dụng"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (page !== 1) go({ page: 1 });
              }}
              className="w-full sm:w-[280px]"
            />
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
