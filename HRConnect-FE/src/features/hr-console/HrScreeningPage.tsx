/**
 * @file HrScreeningPage.tsx
 * @description MF-03 screening for Internal HR (HEADHUNT_COD and CV_SOURCING jobs; the backend
 * scopes the list). Opening an application calls start-screening, which moves SUBMITTED to
 * SCREENING. Actions follow the detail's allowedActions: shortlist (send to Client), reject with
 * a reason code, and — when the backend offers it — backup. Filters live in the URL.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { screeningApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { RecruitmentApplicationItem } from '@/types/api/hr';
import { FilterPills, PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { statusOf } from './hrLabels';

const STATUS_FILTERS = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'all'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const FILTER_LABEL: Record<StatusFilter, string> = {
  SUBMITTED: 'Mới nộp',
  SCREENING: 'Đang sàng lọc',
  SHORTLISTED: 'Đã chọn',
  REJECTED: 'Đã loại',
  all: 'Tất cả',
};

const useStatusCount = (status: StatusFilter) =>
  useQuery({
    queryKey: ['hr-screening', 'count', status],
    queryFn: async () => (await screeningApi.list({ status: status === 'all' ? undefined : status, page: 1, pageSize: 1 })).total,
  });

const formatDateTime = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—');

const AiScore: React.FC<{ score: number | null; status: string | null }> = ({ score, status }) => {
  if (score == null) {
    const label = status === 'FAILED' ? 'Chấm lỗi' : status === 'PENDING' || status === 'PROCESSING' ? 'Đang chấm' : 'Chưa chấm';
    return <span className={`text-xs ${status === 'FAILED' ? 'font-semibold text-red-700' : 'text-slate-600'}`}>{label}</span>;
  }
  const rounded = Math.round(score);
  const tone = rounded >= 75 ? 'bg-emerald-50 text-emerald-800' : rounded >= 50 ? 'bg-sky-50 text-sky-900' : 'bg-amber-50 text-amber-800';
  return <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${tone}`}>{rounded}</span>;
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const HrScreeningPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (STATUS_FILTERS as readonly string[]).includes(searchParams.get('status') ?? '')
    ? (searchParams.get('status') as StatusFilter)
    : 'SUBMITTED';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const openId = searchParams.get('open') ?? undefined;

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'open') next.delete('page');
    setSearchParams(next, { replace: key === 'open' });
  };

  const counts = {
    SUBMITTED: useStatusCount('SUBMITTED'),
    SCREENING: useStatusCount('SCREENING'),
    SHORTLISTED: useStatusCount('SHORTLISTED'),
    REJECTED: useStatusCount('REJECTED'),
    all: useStatusCount('all'),
  };

  const list = useQuery({
    queryKey: ['hr-screening', 'list', status, q, page],
    queryFn: () => screeningApi.list({ status: status === 'all' ? undefined : status, candidateName: q || undefined, page, pageSize: 10 }),
    placeholderData: (prev) => prev,
  });

  const columns: ColumnsType<RecruitmentApplicationItem> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, r) => <PersonCell name={r.candidateName} secondary={r.candidateEmail} />,
    },
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      render: (_, r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{r.jobTitle}</div>
          <div className="truncate text-[12.5px] text-slate-600">{r.companyName}</div>
        </div>
      ),
    },
    { title: 'AI', key: 'ai', width: 110, render: (_, r) => <AiScore score={r.aiMatchScore} status={r.aiStatus} /> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 190,
      render: (v: string) => {
        const st = statusOf(v);
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
    { title: 'Nộp lúc', dataIndex: 'appliedAt', width: 150, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Sàng lọc hồ sơ"
        description="Hồ sơ ứng tuyển vào job Headhunt và Tìm nguồn CV. Mở hồ sơ để bắt đầu sàng lọc, rồi chọn gửi Client hoặc loại kèm lý do."
        actions={
          <Button icon={<ReloadOutlined />} size="large" onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <Surface>
        <div key={searchParams.get('q') ?? ''} className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
          <FilterPills
            label="Lọc theo trạng thái"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: FILTER_LABEL[s], count: counts[s].data }))}
          />
          <Input
            size="large"
            allowClear
            defaultValue={q}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm theo tên ứng viên, nhấn Enter"
            className="max-w-xs"
            onPressEnter={(e) => setParam('q', (e.target as HTMLInputElement).value.trim() || undefined)}
            onChange={(e) => !e.target.value && q && setParam('q', undefined)}
            aria-label="Tìm theo tên ứng viên"
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được hồ sơ" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<RecruitmentApplicationItem>
            className="admin-soft-table"
            scroll={{ x: 'max-content' }}
            rowKey="applicationId"
            columns={columns}
            dataSource={list.data?.items ?? []}
            loading={list.isFetching}
            onRow={(r) => ({
              onClick: () => setParam('open', r.applicationId),
              onKeyDown: (e) => e.key === 'Enter' && setParam('open', r.applicationId),
              tabIndex: 0,
              className: 'cursor-pointer',
            })}
            pagination={{
              current: page,
              pageSize: 10,
              total: list.data?.total ?? 0,
              showSizeChanger: false,
              onChange: (p) => setParam('page', String(p)),
            }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {status === 'SUBMITTED' ? 'Không có hồ sơ mới. Mọi hồ sơ đã được mở sàng lọc.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>

      <ApplicationWorkbench applicationId={openId} audience="hr" onClose={() => setParam('open', undefined)} />
    </div>
  );
};

export default HrScreeningPage;
