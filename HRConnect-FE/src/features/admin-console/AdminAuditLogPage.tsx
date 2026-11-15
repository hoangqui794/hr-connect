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
import { Alert, Button, DatePicker, Drawer, Input, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloseOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { adminAuditApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AuditLogItem } from '@/types/api/admin';
import { adminTokens, formatDateTime } from './adminTheme';
import { MotionTableRow, PageHero, PersonCell, Surface } from './ui';
import { describeAuditAction, describeEntityType } from './auditLabels';

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

  if (rows.length === 0) {
    return <p className="m-0 text-xs text-slate-400">Sự kiện này không ghi lại dữ liệu thay đổi.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-solid border-slate-200/80">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-left text-[11.5px] font-semibold text-slate-500">
            <th className="px-3 py-2">Trường</th>
            <th className="px-3 py-2">Trước</th>
            <th className="px-3 py-2">Sau</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((r) => (
            <tr key={r.key} className={`border-0 border-t border-solid border-slate-100 ${r.changed ? 'bg-amber-50/60' : ''}`}>
              <td className="px-3 py-2 align-top font-medium text-slate-900">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11.5px]">{r.key}</span>
                  {r.changed && (
                    <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Đã đổi
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 align-top">
                <span className={r.changed ? 'text-rose-700/90' : 'text-slate-600'}>
                  <Mono>{show(r.before)}</Mono>
                </span>
              </td>
              <td className="px-3 py-2 align-top">
                <span className={r.changed ? 'font-medium text-emerald-700' : 'text-slate-700'}>
                  <Mono>{show(r.after)}</Mono>
                </span>
              </td>
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

  const hasFilters = Boolean(
    params.action || params.entityType || params.actorType || params.source || params.fromUtc || params.toUtc,
  );

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: 'Thời điểm',
      dataIndex: 'createdAt',
      width: 155,
      render: (v: string) => <span className="font-mono text-xs text-slate-600 tabular-nums">{formatDateTime(v)}</span>,
    },
    {
      title: 'Người thao tác',
      key: 'actor',
      width: 220,
      render: (_, r) => {
        const kind = ACTOR_TYPES[r.actorType] ?? r.actorType;
        const name = r.actorDisplayName || r.actorEmail;
        const sub = name ? (r.actorDisplayName && r.actorEmail ? r.actorEmail : kind) : null;
        return <PersonCell name={name || kind} secondary={sub ?? undefined} size={32} />;
      },
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      render: (v: string) => (
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-slate-900 leading-snug">
            {describeAuditAction(v)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400 tracking-tight truncate">
            {v}
          </div>
        </div>
      ),
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 175,
      render: (_, r) => {
        if (!r.entityType) return <span className="text-slate-400">—</span>;
        const conf = describeEntityType(r.entityType);
        return (
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11.5px] font-medium text-slate-700">
              {conf.label}
            </span>
            {r.entityId && (
              <div className="mt-0.5 font-mono text-[10.5px] text-slate-400 truncate">
                {r.entityId.slice(0, 12)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Nguồn',
      dataIndex: 'source',
      width: 135,
      render: (v: string) => {
        const label = SOURCES[v] ?? v;
        const isApi = v === 'API';
        return (
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                isApi
                  ? 'bg-slate-100 text-slate-600'
                  : 'border border-sky-200/80 bg-sky-50 text-sky-700'
              }`}
            >
              {label}
            </span>
            <RightOutlined className="text-[10px] text-slate-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </div>
        );
      },
    },
  ];

  const log = detail.data;
  const page = list.data;

  return (
    <div className="admin-stagger space-y-5">
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
        <div
          key={searchParams.toString()}
          className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/40 px-5 py-3.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input.Search
              allowClear
              defaultValue={params.action}
              placeholder="Mã hành động (VD: USER_SUSPENDED)"
              className="w-60"
              onSearch={(v) => setParams({ action: v.trim().toUpperCase() || undefined })}
              aria-label="Lọc theo hành động"
            />
            <Input
              allowClear
              defaultValue={params.entityType}
              placeholder="Loại đối tượng (VD: JOB)"
              className="w-44"
              onPressEnter={(e) => setParams({ entityType: e.currentTarget.value.trim().toUpperCase() || undefined })}
              onBlur={(e) => setParams({ entityType: e.currentTarget.value.trim().toUpperCase() || undefined })}
              aria-label="Lọc theo loại đối tượng"
            />
            <Select
              allowClear
              value={params.actorType}
              placeholder="Người thao tác"
              className="w-36"
              onChange={(v) => setParams({ actorType: v })}
              options={Object.entries(ACTOR_TYPES).map(([value, label]) => ({ value, label }))}
              aria-label="Lọc theo loại người thao tác"
            />
            <Select
              allowClear
              value={params.source}
              placeholder="Nguồn"
              className="w-36"
              onChange={(v) => setParams({ source: v })}
              options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))}
              aria-label="Lọc theo nguồn"
            />
            <DatePicker.RangePicker
              value={params.fromUtc && params.toUtc ? [dayjs(params.fromUtc), dayjs(params.toUtc)] : null}
              format="DD/MM/YYYY"
              className="w-56"
              onChange={(range) =>
                setParams({
                  from: range?.[0]?.startOf('day').toISOString(),
                  to: range?.[1]?.endOf('day').toISOString(),
                })
              }
              aria-label="Khoảng thời gian"
            />
            {hasFilters && (
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined className="text-[11px]" />}
                onClick={() => setSearchParams({})}
                className="text-slate-500 hover:!text-slate-900"
              >
                Xóa lọc
              </Button>
            )}
          </div>
          {page && (
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
              {page.total} sự kiện
            </span>
          )}
        </div>

        {list.isError ? (
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được nhật ký" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AuditLogItem>
            className="admin-soft-table w-full table-auto"
            rowKey="auditLogId"
            size="small"
            loading={list.isLoading}
            columns={columns}
            dataSource={page?.items ?? []}
            components={{ body: { row: MotionTableRow } }}
            locale={{ emptyText: 'Không có sự kiện nào phù hợp bộ lọc.' }}
            onRow={(r) => ({
              onClick: () => setSelectedId(r.auditLogId),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setSelectedId(r.auditLogId);
              },
              tabIndex: 0,
              className: 'group cursor-pointer',
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

      <Drawer
        open={selectedId !== undefined}
        width="min(620px, 100vw)"
        onClose={() => setSelectedId(undefined)}
        title="Chi tiết sự kiện"
        styles={{ body: { background: '#F5F7FA', padding: '16px 20px' } }}
        destroyOnHidden
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detail.isError || !log ? (
          <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được sự kiện.')} />
        ) : (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-slate-200/80 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-900">{describeAuditAction(log.action)}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500 break-all">{log.action}</div>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {SOURCES[log.source] ?? log.source}
                </span>
              </div>
              <div className="mt-3 font-mono text-xs text-slate-400 tabular-nums">
                {formatDateTime(log.createdAt)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-slate-200/80 bg-white p-4"
            >
              <h4 className="mb-3 text-xs font-semibold text-slate-500">Thông tin truy vết</h4>
              <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 gap-x-3 text-[13px]">
                <dt className="text-slate-500">Người thao tác</dt>
                <dd className="m-0 text-slate-900">
                  <span className="font-medium">{log.actorDisplayName ?? '—'}</span>
                  {log.actorEmail ? <span className="text-slate-500"> · {log.actorEmail}</span> : null}
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {ACTOR_TYPES[log.actorType] ?? log.actorType}
                  </span>
                </dd>
                <dt className="text-slate-500">Nguồn / Dịch vụ</dt>
                <dd className="m-0 text-slate-800">
                  {SOURCES[log.source] ?? log.source}
                  {log.serviceName ? <span className="text-slate-500"> · {log.serviceName}</span> : null}
                </dd>
                <dt className="text-slate-500">Đối tượng</dt>
                <dd className="m-0">
                  <div className="font-medium text-slate-900">
                    {log.entityType ? describeEntityType(log.entityType).label : '—'}
                    {log.entityType ? <span className="ml-1.5 font-mono text-[11px] text-slate-400">({log.entityType})</span> : null}
                  </div>
                  {log.entityId && <div className="mt-0.5"><Mono>{log.entityId}</Mono></div>}
                </dd>
                <dt className="text-slate-500">Mã tương quan</dt>
                <dd className="m-0">{log.correlationId ? <Mono>{log.correlationId}</Mono> : '—'}</dd>
                <dt className="text-slate-500">Địa chỉ IP</dt>
                <dd className="m-0">{log.ipAddress ? <Mono>{log.ipAddress}</Mono> : '—'}</dd>
                <dt className="text-slate-500">Trình duyệt</dt>
                <dd className="m-0 break-all text-xs text-slate-600">{log.userAgent ?? '—'}</dd>
              </dl>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-slate-200/80 bg-white p-4"
            >
              <h4 className="mb-3 text-xs font-semibold text-slate-500">Dữ liệu thay đổi</h4>
              <ValueDiff oldValues={log.oldValues} newValues={log.newValues} />
            </motion.div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminAuditLogPage;
