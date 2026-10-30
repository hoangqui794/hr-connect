/**
 * Admin › Cài đặt — business numbers Platform Admin can change without a deploy
 * (GET/PUT /admin/settings). Defaults come from the business-model documents; a new value
 * applies to records created afterwards, existing fees and warranties keep their numbers.
 *
 * Layout: a sticky table of contents (groups named by service, not by code), search and an
 * "only changed" switch, one compact row per setting with Default / Changed state, who changed it,
 * and a one-click restore. The AP posting packages sit inside the AP group.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Input, InputNumber, Modal, Skeleton, Switch, Tag } from 'antd';
import { ClockCircleOutlined, DownOutlined, EditOutlined, ReloadOutlined, RightOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { businessSettingsApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { BusinessSetting } from '@/types/api/finance';
import { PageHero, Surface } from './ui';
import { PostingPackagesSection } from './PostingPackagesSection';

const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Groups in the order Admin thinks about them; unknown groups follow, named by their code. */
const GROUPS: { code: string; title: string; tag: string; color?: string }[] = [
  { code: 'MF02', title: 'Giới thiệu ứng viên', tag: 'MF-02' },
  { code: 'HEADHUNT_COD', title: 'Tuyển dụng theo kết quả', tag: 'HH', color: 'gold' },
  { code: 'CV_SOURCING', title: 'Tìm hồ sơ phù hợp', tag: 'SS', color: 'purple' },
  { code: 'CV_APPLICATION', title: 'Nhận hồ sơ ứng tuyển', tag: 'AP', color: 'blue' },
  { code: 'SERVICE_FEE', title: 'Phí dịch vụ', tag: 'Phí' },
  { code: 'AFFILIATE_RATING', title: 'Đánh giá Affiliate', tag: 'Affiliate' },
  { code: 'DISPUTE', title: 'Khiếu nại', tag: 'SF-04' },
  { code: 'JOB_MATCH', title: 'Gợi ý việc làm (AI)', tag: 'AI' },
  { code: 'JOB_TEMPLATE', title: 'Mẫu tuyển dụng', tag: 'MF-01' },
  { code: 'CONTACT', title: 'Yêu cầu tư vấn', tag: 'Liên hệ' },
];
const POSTING_PACKAGES_ID = 'settings-posting-packages';
const anchorId = (code: string) => `settings-${code.toLowerCase()}`;
const LONG_DESCRIPTION = 110;

const SettingRow: React.FC<{ setting: BusinessSetting; onEdit: () => void; onRestore: () => void }> = ({ setting: s, onEdit, onRestore }) => {
  const [expanded, setExpanded] = useState(false);
  const long = s.description.length > LONG_DESCRIPTION;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-[220px] flex-1">
          <div className="text-[15px] font-semibold text-slate-900">{s.label}</div>
          <div className={`mt-0.5 text-[13.5px] leading-relaxed text-slate-600 ${long && !expanded ? 'line-clamp-1' : ''}`}>{s.description}</div>
          {long && (
            <button
              type="button"
              className="mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-[color:var(--console-accent-strong)] hover:underline"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}
        </div>
        <div className="min-w-[150px] text-right">
          <div className="text-[22px] font-bold tabular-nums leading-tight text-slate-900">
            {formatNumber(s.value)} <span className="text-sm font-medium text-slate-500">{s.unit}</span>
          </div>
          {s.isOverridden ? (
            <Tag color="blue" className="m-0 mt-1">
              Đã đổi · mặc định {formatNumber(s.defaultValue)} {s.unit}
            </Tag>
          ) : (
            <Tag className="m-0 mt-1">Mặc định</Tag>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button icon={<EditOutlined />} onClick={onEdit} aria-label={`Sửa ${s.label}`}>
            Sửa
          </Button>
          {s.isOverridden && (
            <Button type="text" size="small" icon={<UndoOutlined />} onClick={onRestore} aria-label={`Khôi phục mặc định ${s.label}`}>
              Khôi phục
            </Button>
          )}
        </div>
      </div>
      {s.isOverridden && s.updatedAt && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <ClockCircleOutlined aria-hidden />
          Sửa {s.updatedByName ? `bởi ${s.updatedByName} ` : ''}lúc {dayjs(s.updatedAt).format('HH:mm DD/MM/YYYY')}
        </div>
      )}
    </li>
  );
};

export const AdminSettingsPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-business-settings'], queryFn: () => businessSettingsApi.list() });
  const [editing, setEditing] = useState<BusinessSetting | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) => businessSettingsApi.update(key, value),
    onSuccess: (updated) => {
      message.success(`Đã lưu "${updated.label}". Áp dụng cho các bản ghi tạo từ bây giờ.`);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-business-settings'] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const open = (setting: BusinessSetting) => {
    setEditing(setting);
    setDraft(setting.value);
  };

  const restore = (s: BusinessSetting) =>
    modal.confirm({
      title: `Khôi phục mặc định "${s.label}"?`,
      content: `${formatNumber(s.value)} → ${formatNumber(s.defaultValue)} ${s.unit}. Áp dụng cho các bản ghi tạo từ bây giờ.`,
      okText: 'Khôi phục',
      cancelText: 'Hủy',
      onOk: () => save.mutateAsync({ key: s.key, value: s.defaultValue }),
    });

  const query = search.trim().toLowerCase();
  const groups = useMemo(() => {
    const all = settings.data ?? [];
    const visible = all.filter(
      (s) =>
        (!onlyChanged || s.isOverridden) &&
        (!query || `${s.label} ${s.description} ${s.unit}`.toLowerCase().includes(query))
    );
    const known = GROUPS.filter((g) => all.some((s) => s.group === g.code));
    const unknown = [...new Set(all.map((s) => s.group))]
      .filter((code) => !GROUPS.some((g) => g.code === code))
      .map((code) => ({ code, title: code, tag: code } as (typeof GROUPS)[number]));
    return [...known, ...unknown].map((g) => ({
      ...g,
      total: all.filter((s) => s.group === g.code).length,
      changed: all.filter((s) => s.group === g.code && s.isOverridden).length,
      items: visible.filter((s) => s.group === g.code),
    }));
  }, [settings.data, onlyChanged, query]);
  const filtering = Boolean(query) || onlyChanged;
  const shown = groups.filter((g) => !filtering || g.items.length > 0);
  const changedCount = (settings.data ?? []).filter((s) => s.isOverridden).length;

  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      <PageHero
        eyebrow="Cấu hình nghiệp vụ"
        title="Cài đặt hệ thống"
        tip
        description="Các con số tính phí, hoa hồng và thời hạn. Giá trị mặc định lấy theo tài liệu mô hình kinh doanh; thay đổi áp dụng cho các khoản phát sinh sau đó."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => settings.refetch()} loading={settings.isFetching}>
            Làm mới
          </Button>
        }
      />

      {settings.isLoading ? (
        <Surface padded>
          <Skeleton active />
        </Surface>
      ) : settings.isError ? (
        <Alert type="error" showIcon message={getApiErrorMessage(settings.error)} />
      ) : !settings.data?.length ? (
        <Surface padded>
          <Empty description="Chưa có cấu hình nào." />
        </Surface>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Nhóm cài đặt" className="hidden lg:block">
            <ul className="sticky top-4 m-0 list-none space-y-0.5 p-0">
              {groups.map((g) => (
                <li key={g.code}>
                  <button
                    type="button"
                    onClick={() => jumpTo(anchorId(g.code))}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-[13.5px] text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                  >
                    <span className="truncate">{g.title}</span>
                    <span className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                      {g.changed > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label={`${g.changed} mục đã đổi`} />}
                      {g.total}
                    </span>
                  </button>
                  {g.code === 'CV_APPLICATION' && (
                    <button
                      type="button"
                      onClick={() => jumpTo(POSTING_PACKAGES_ID)}
                      className="flex w-full cursor-pointer items-center rounded-lg border-0 bg-transparent py-1.5 pl-6 pr-3 text-left text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                    >
                      Gói đăng tin AP
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm cài đặt, ví dụ: bảo hành"
                aria-label="Tìm cài đặt"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-slate-700">
                <Switch size="small" checked={onlyChanged} onChange={setOnlyChanged} aria-label="Chỉ mục đã đổi" />
                Chỉ mục đã đổi <span className="tabular-nums text-slate-500">({changedCount})</span>
              </label>
            </div>

            {shown.length === 0 && (
              <Surface padded>
                <Empty description="Không có cài đặt nào khớp." />
              </Surface>
            )}

            {shown.map((g) => {
              const isCollapsed = !filtering && collapsed[g.code];
              return (
                <React.Fragment key={g.code}>
                <Surface>
                  <section id={anchorId(g.code)} className="scroll-mt-4" aria-label={g.title}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [g.code]: !c[g.code] }))}
                      aria-expanded={!isCollapsed}
                      className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--console-accent)]"
                    >
                      <Tag color={g.color} className="m-0 font-semibold">{g.tag}</Tag>
                      <span className="text-[15px] font-semibold text-slate-900">{g.title}</span>
                      <span className="text-[13px] text-slate-500">
                        · {g.total} cài đặt{g.changed ? `, ${g.changed} đã đổi` : ''}
                      </span>
                      <span className="ml-auto text-slate-400" aria-hidden>
                        {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="m-0 list-none divide-y divide-slate-100 border-t border-solid border-slate-100 p-0">
                        {g.items.map((s) => (
                          <SettingRow key={s.key} setting={s} onEdit={() => open(s)} onRestore={() => restore(s)} />
                        ))}
                      </ul>
                    )}
                  </section>
                </Surface>
                {/* The AP posting packages belong to the AP service, so they sit right under its settings. */}
                {g.code === 'CV_APPLICATION' && !filtering && (
                  <div id={POSTING_PACKAGES_ID} className="scroll-mt-4">
                    <PostingPackagesSection />
                  </div>
                )}
                </React.Fragment>
              );
            })}
            {!filtering && !shown.some((g) => g.code === 'CV_APPLICATION') && (
              <div id={POSTING_PACKAGES_ID} className="scroll-mt-4">
                <PostingPackagesSection />
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing ? `Sửa: ${editing.label}` : ''}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: draft === null || draft === editing?.value }}
        onOk={() => editing && draft !== null && save.mutate({ key: editing.key, value: draft })}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        {editing && (
          <div className="space-y-3">
            <p className="m-0 text-[14px] text-slate-600">{editing.description}</p>
            <InputNumber
              className="w-full"
              size="large"
              min={editing.min}
              max={editing.max}
              step={editing.type === 'INTEGER' ? 1 : 0.1}
              precision={editing.type === 'INTEGER' ? 0 : undefined}
              value={draft}
              onChange={(v) => setDraft(typeof v === 'number' ? v : null)}
              addonAfter={editing.unit}
              aria-label={editing.label}
            />
            <div className="text-xs text-slate-500">
              Cho phép từ {formatNumber(editing.min)} đến {formatNumber(editing.max)} {editing.unit} · mặc định {formatNumber(editing.defaultValue)}
            </div>
            {draft !== null && draft !== editing.value ? (
              <Alert
                type="info"
                showIcon
                message={`${formatNumber(editing.value)} → ${formatNumber(draft)} ${editing.unit}`}
                description="Áp dụng cho các bản ghi tạo sau khi lưu. Khoản phí, bảo hành và hoa hồng đã tạo giữ nguyên con số cũ."
              />
            ) : (
              <Alert type="info" showIcon message="Khoản phí, bảo hành và hoa hồng đã tạo giữ nguyên con số cũ." />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
