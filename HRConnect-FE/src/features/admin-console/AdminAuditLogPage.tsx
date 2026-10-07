/**
 * @file AdminAuditLogPage.tsx
 * @description Admin · audit trail (GET /admin/audit-logs, requires audit.view). Detail shows
 * old vs new values with changed keys marked. Filter values mirror the DB check constraints
 * on audit_log.actor_type and audit_log.source.
 */
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Descriptions, Drawer, Input, Select, Skeleton, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { adminAuditApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AuditLogItem } from '@/types/api/admin';
import { adminTokens, formatDateTime } from './adminTheme';
import { PageHero, PersonCell, Surface } from './ui';
import { describeAuditAction } from './auditLabels';

const PAGE_SIZE = 25;
const ACTOR_TYPES: Record<string, string> = {
  USER: 'Người dùng',
  ANONYMOUS: 'Khách',
  SYSTEM: 'Hệ thống',
  SERVICE: 'Dịch vụ',
  DATABASE_TRIGGER: 'Trigger CSDL',
};
const SOURCES: Record<string, string> = {
  API: 'API',
  APPLICATION: 'Ứng dụng',
  BACKGROUND_WORKER: 'Tác vụ nền',
  INTEGRATION: 'Tích hợp',
  DATABASE_TRIGGER: 'Trigger CSDL',
};

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{ fontFamily: adminTokens.mono }} className="break-all text-xs text-slate-700">
    {children}
  </code>
);

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v == null ? {} : { value: v };
const show = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

/** Old/new values side by side; rows whose value changed are highlighted (with a text marker too). */
const ValueDiff: React.FC<{ oldValues: unknown; newValues: unknown }> = ({ oldValues, newValues }) => {
  const rows = useMemo(() => {
    const o = asRecord(oldValues);
    const n = asRecord(newValues);
    return [...new Set([...Object.keys(o), ...Object.keys(n)])].map((key) => ({
      key,
      before: o[key],
      after: n[key],
      changed: JSON.stringify(o[key]) !== JSON.stringify(n[key]),
    }));
  }, [oldValues, newValues]);

  if (rows.length === 0) return <Typography.Text type="secondary">Sự kiện này không ghi lại dữ liệu thay đổi.</Typography.Text>;

  return (
    <div className="overflow-x-auto rounded-lg border border-solid border-slate-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 text-left text-slate-600">
            <th className="px-3 py-2 font-semibold">Trường</th>
            <th className="px-3 py-2 font-semibold">Trước</th>
            <th className="px-3 py-2 font-semibold">Sau</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-0 border-t border-solid border-slate-100 ${r.changed ? 'bg-amber-50' : ''}`}>
              <td className="px-3 py-2 align-top font-medium text-slate-900">
                {r.key}
                {r.changed && <span className="ml-1 text-[11px] font-semibold text-amber-800">· đã đổi</span>}
              </td>
              <td className="px-3 py-2 align-top"><Mono>{show(r.before)}</Mono></td>
              <td className="px-3 py-2 align-top"><Mono>{show(r.after)}</Mono></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AdminAuditLogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number>();

  const params = {
    actorType: searchParams.get('actorType') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    entityType: searchParams.get('entityType') ?? undefined,
    fromUtc: searchParams.get('from') ?? undefined,
    toUtc: searchParams.get('to') ?? undefined,
    page: Number(searchParams.get('page')) || 1,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({
    queryKey: ['admin-audit', params],
    queryFn: () => adminAuditApi.list(params),
    placeholderData: (prev) => prev,
  });
  const detail = useQuery({
    queryKey: ['admin-audit-detail', selectedId],
    queryFn: () => adminAuditApi.get(selectedId as number),
    enabled: selectedId !== undefined,
  });

  const setParams = (entries: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(entries).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in entries)) next.delete('page');
    setSearchParams(next);
  };

  const columns: ColumnsType<AuditLogItem> = [
    { title: 'Thời điểm', dataIndex: 'createdAt', width: 160, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
    {
      title: 'Người thao tác',
      key: 'actor',
      width: 230,
      render: (_, r) => {
        const kind = ACTOR_TYPES[r.actorType] ?? r.actorType;
        const name = r.actorDisplayName || r.actorEmail;
        // Second line only when it adds information (email, or the actor kind under a name).
        const sub = name ? (r.actorDisplayName && r.actorEmail ? r.actorEmail : kind) : null;
        return (
          <PersonCell name={name || kind} secondary={sub ?? undefined} size={32} />
        );
      },
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      render: (v: string) => (
        <div className="min-w-0">
          <div className="text-slate-900">{describeAuditAction(v)}</div>
          <Mono>{v}</Mono>
        </div>
      ),
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 200,
      render: (_, r) => (r.entityType ? <span className="text-slate-700">{r.entityType}</span> : <span className="text-slate-500">—</span>),
    },
    { title: 'Nguồn', dataIndex: 'source', width: 130, render: (v: string) => <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{SOURCES[v] ?? v}</span> },
  ];

  const log = detail.data;
  const page = list.data;

  return (
    <div>
      <PageHero
        eyebrow="Giám sát"
        title="Nhật ký hệ thống"
        description="Mọi thao tác quan trọng trên nền tảng: ai làm, làm gì, lúc nào và dữ liệu thay đổi ra sao."
        actions={
          <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <Surface>
        <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
          <Input.Search
            allowClear
            defaultValue={params.action}
            placeholder="Mã hành động, ví dụ USER_SUSPENDED"
            className="w-72"
            onSearch={(v) => setParams({ action: v.trim().toUpperCase() || undefined })}
            aria-label="Lọc theo hành động"
          />
          <Input
            allowClear
            defaultValue={params.entityType}
            placeholder="Loại đối tượng, ví dụ JOB"
            className="w-56"
            onPressEnter={(e) => setParams({ entityType: e.currentTarget.value.trim().toUpperCase() || undefined })}
            onBlur={(e) => setParams({ entityType: e.currentTarget.value.trim().toUpperCase() || undefined })}
            aria-label="Lọc theo loại đối tượng"
          />
          <Select
            allowClear
            value={params.actorType}
            placeholder="Người thao tác"
            className="w-44"
            onChange={(v) => setParams({ actorType: v })}
            options={Object.entries(ACTOR_TYPES).map(([value, label]) => ({ value, label }))}
            aria-label="Lọc theo loại người thao tác"
          />
          <Select
            allowClear
            value={params.source}
            placeholder="Nguồn"
            className="w-40"
            onChange={(v) => setParams({ source: v })}
            options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))}
            aria-label="Lọc theo nguồn"
          />
          <DatePicker.RangePicker
            value={params.fromUtc && params.toUtc ? [dayjs(params.fromUtc), dayjs(params.toUtc)] : null}
            format="DD/MM/YYYY"
            onChange={(range) =>
              setParams({
                from: range?.[0]?.startOf('day').toISOString(),
                to: range?.[1]?.endOf('day').toISOString(),
              })
            }
            aria-label="Khoảng thời gian"
          />
          {page && <span className="ml-auto text-sm text-slate-600 tabular-nums">{page.total} sự kiện</span>}
        </div>

        {list.isError ? (
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được nhật ký" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AuditLogItem>
            className="admin-soft-table"
            rowKey="auditLogId"
            size="small"
            loading={list.isLoading}
            columns={columns}
            dataSource={page?.items ?? []}
            scroll={{ x: 980 }}
            locale={{ emptyText: 'Không có sự kiện nào phù hợp bộ lọc.' }}
            onRow={(r) => ({
              onClick: () => setSelectedId(r.auditLogId),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setSelectedId(r.auditLogId);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Mở sự kiện ${r.action}`,
            })}
            pagination={{
              current: page?.page ?? params.page,
              pageSize: PAGE_SIZE,
              total: page?.total ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => setParams({ page: String(p) }),
            }}
          />
        )}
      </Surface>

      <Drawer open={selectedId !== undefined} width="min(640px, 100vw)" onClose={() => setSelectedId(undefined)} title="Chi tiết sự kiện" destroyOnClose>
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detail.isError || !log ? (
          <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được sự kiện.')} />
        ) : (
          <div className="space-y-5">
            <Descriptions size="small" column={1} labelStyle={{ width: 150, color: adminTokens.textMuted }}>
              <Descriptions.Item label="Hành động"><Mono>{log.action}</Mono></Descriptions.Item>
              <Descriptions.Item label="Thời điểm">{formatDateTime(log.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Người thao tác">
                {log.actorDisplayName ?? '—'} {log.actorEmail ? `· ${log.actorEmail}` : ''} ({ACTOR_TYPES[log.actorType] ?? log.actorType})
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn">
                {SOURCES[log.source] ?? log.source}
                {log.serviceName ? ` · ${log.serviceName}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng">
                <div>
                  <div>{log.entityType ?? '—'}</div>
                  {log.entityId && <Mono>{log.entityId}</Mono>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Mã tương quan">{log.correlationId ? <Mono>{log.correlationId}</Mono> : '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ IP">{log.ipAddress ? <Mono>{log.ipAddress}</Mono> : '—'}</Descriptions.Item>
              <Descriptions.Item label="Trình duyệt">
                <span className="break-all text-xs text-slate-600">{log.userAgent ?? '—'}</span>
              </Descriptions.Item>
            </Descriptions>
            <section>
              <Typography.Text strong className="mb-2 block">Dữ liệu thay đổi</Typography.Text>
              <ValueDiff oldValues={log.oldValues} newValues={log.newValues} />
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminAuditLogPage;
