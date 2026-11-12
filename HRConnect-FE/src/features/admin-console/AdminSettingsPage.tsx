/**
 * Admin › Cài đặt — business numbers Platform Admin can change without a deploy
 * (GET/PUT /admin/settings). Defaults come from the business-model documents; a new value
 * applies to records created afterwards, existing fees and warranties keep their numbers.
 *
 * Clean Minimalist SaaS Design:
 * - Removed noisy colored icons for sleek typography & clear category hierarchy
 * - Independent Card-based layout for each setting item with clear visual separation
 * - Side-by-side layout: Information & policy on the left, Highlighted value box & actions on the right
 * - Tab/Category navigation mode (Zero layout jump / Zero jarring auto-scroll)
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  DownOutlined,
  EditOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { businessSettingsApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { BusinessSetting } from '@/types/api/finance';
import { PageHero, Surface } from './ui';
import { PostingPackagesSection } from './PostingPackagesSection';

const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Groups in the order Admin thinks about them, with clean tags and descriptions */
interface GroupMeta {
  code: string;
  title: string;
  tag: string;
  color?: string;
  description: string;
}

const GROUPS: GroupMeta[] = [
  {
    code: 'MF02',
    title: 'Giới thiệu ứng viên',
    tag: 'MF-02',
    description: 'Thời hạn sở hữu, xác nhận giới thiệu và hạn mức gửi email',
  },
  {
    code: 'HEADHUNT_COD',
    title: 'Tuyển dụng theo kết quả',
    tag: 'HH',
    color: 'gold',
    description: 'Chính sách bảo hành, hạn thanh toán và tỷ lệ hoa hồng tuyển dụng',
  },
  {
    code: 'CV_SOURCING',
    title: 'Tìm hồ sơ phù hợp',
    tag: 'SS',
    color: 'purple',
    description: 'Thời hạn tiếp nhận và đối soát hồ sơ nguồn cung ứng',
  },
  {
    code: 'CV_APPLICATION',
    title: 'Nhận hồ sơ ứng tuyển',
    tag: 'AP',
    color: 'blue',
    description: 'Hạn hiển thị tin đăng và cấu hình gói dịch vụ tuyển dụng',
  },
  {
    code: 'SERVICE_FEE',
    title: 'Phí dịch vụ',
    tag: 'Phí',
    description: 'Biểu phí nền tảng và thời hạn nhắc nhở thanh toán',
  },
  {
    code: 'AFFILIATE_RATING',
    title: 'Đánh giá Affiliate',
    tag: 'Affiliate',
    description: 'Trọng số đánh giá chất lượng hồ sơ và điểm uy tín cộng tác viên',
  },
  {
    code: 'DISPUTE',
    title: 'Khiếu nại',
    tag: 'SF-04',
    description: 'Thời hạn phản hồi, giải quyết tranh chấp và hoàn tiền',
  },
  {
    code: 'JOB_MATCH',
    title: 'Gợi ý việc làm (AI)',
    tag: 'AI',
    description: 'Ngưỡng điểm khớp CV và tần suất phân tích tự động',
  },
  {
    code: 'JOB_TEMPLATE',
    title: 'Mẫu tuyển dụng',
    tag: 'MF-01',
    description: 'Thời gian lưu trữ và giới hạn áp dụng mẫu tin',
  },
  {
    code: 'CONTACT',
    title: 'Yêu cầu tư vấn',
    tag: 'Liên hệ',
    description: 'Thời gian chuẩn phản hồi khách hàng và đối tác tiềm năng',
  },
];

const POSTING_PACKAGES_ID = 'settings-posting-packages';
const anchorId = (code: string) => `settings-${code.toLowerCase()}`;
const LONG_DESCRIPTION = 110;

/** Individual Setting Card with clear boundary and separated value block */
const SettingRow: React.FC<{
  setting: BusinessSetting;
  onEdit: () => void;
  onRestore: () => void;
}> = ({ setting: s, onEdit, onRestore }) => {
  const [expanded, setExpanded] = useState(false);
  const long = s.description.length > LONG_DESCRIPTION;

  return (
    <li className="rounded-xl border border-solid border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
        {/* Left: Thông tin & Quy định chi tiết */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] font-bold text-slate-900 tracking-tight">{s.label}</span>
            {s.isOverridden ? (
              <span className="inline-flex items-center rounded-full border border-solid border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Đã đổi · mặc định {formatNumber(s.defaultValue)} {s.unit}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-solid border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Mặc định
              </span>
            )}
          </div>

          <p
            className={`m-0 text-[13.5px] leading-relaxed text-slate-600 ${
              long && !expanded ? 'line-clamp-2' : ''
            }`}
          >
            {s.description}
          </p>

          {long && (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-sky-600 hover:text-sky-800 hover:underline"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}

          {/* Quy định kỹ thuật & căn cứ */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 pt-1">
            <span className="inline-flex items-center rounded-md bg-slate-100/80 px-2.5 py-1 text-slate-700 font-medium">
              Giới hạn:&nbsp;<strong className="text-slate-900 font-bold">{formatNumber(s.min)} – {formatNumber(s.max)} {s.unit}</strong>
            </span>
            {s.source && (
              <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-slate-500 border border-solid border-slate-200/70">
                Căn cứ:&nbsp;<span className="italic text-slate-600">{s.source}</span>
              </span>
            )}
          </div>

          {s.isOverridden && s.updatedAt && (
            <div className="text-xs text-slate-500 pt-1 border-0 border-t border-solid border-slate-100">
              Sửa {s.updatedByName ? `bởi ${s.updatedByName} ` : ''}lúc{' '}
              <strong className="text-slate-700 font-medium">
                {dayjs(s.updatedAt).format('HH:mm DD/MM/YYYY')}
              </strong>
            </div>
          )}
        </div>

        {/* Right: Hộp Giá trị áp dụng & Nút hành động riêng biệt */}
        <div className="flex lg:flex-col items-center justify-between lg:justify-center gap-3 shrink-0 rounded-xl border border-solid border-slate-200/90 bg-slate-50/80 px-5 py-3.5 min-w-[180px] text-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Giá trị hiện tại
            </div>
            <div className="mt-0.5 text-2xl font-black text-slate-900 tabular-nums tracking-tight">
              {formatNumber(s.value)}{' '}
              <span className="text-sm font-semibold text-slate-500">{s.unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full justify-center pt-1 border-0 lg:border-t border-solid border-slate-200/80">
            {s.isOverridden && (
              <Tooltip title="Khôi phục về giá trị mặc định ban đầu theo tài liệu mô hình kinh doanh">
                <button
                  type="button"
                  onClick={onRestore}
                  aria-label={`Khôi phục mặc định ${s.label}`}
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-solid border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  Khôi phục
                </button>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Sửa ${s.label}`}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg border border-solid border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-sky-700 text-xs font-semibold cursor-pointer transition-all shadow-2xs"
            >
              <EditOutlined className="text-xs text-slate-400" />
              <span>Sửa</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

export const AdminSettingsPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin-business-settings'],
    queryFn: () => businessSettingsApi.list(),
  });

  const [activeGroupKey, setActiveGroupKey] = useState<string>('ALL');
  const [editing, setEditing] = useState<BusinessSetting | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) =>
      businessSettingsApi.update(key, value),
    onSuccess: (updated) => {
      message.success(`Đã lưu "${updated.label}". Áp dụng cho các bản ghi tạo từ bây giờ.`);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-business-settings'] });
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

  const allSettings = useMemo(() => settings.data ?? [], [settings.data]);
  const totalCount = allSettings.length;
  const changedCount = allSettings.filter((s) => s.isOverridden).length;
  const defaultCount = totalCount - changedCount;

  const groups = useMemo(() => {
    const visible = allSettings.filter(
      (s) =>
        (!onlyChanged || s.isOverridden) &&
        (!query || `${s.label} ${s.description} ${s.unit}`.toLowerCase().includes(query))
    );

    const known = GROUPS.filter((g) => allSettings.some((s) => s.group === g.code));
    const unknown = [...new Set(allSettings.map((s) => s.group))]
      .filter((code) => !GROUPS.some((g) => g.code === code))
      .map(
        (code) =>
          ({
            code,
            title: code,
            tag: code,
            description: 'Các cài đặt cấu hình bổ sung của hệ thống',
          } as GroupMeta)
      );

    return [...known, ...unknown].map((g) => ({
      ...g,
      total: allSettings.filter((s) => s.group === g.code).length,
      changed: allSettings.filter((s) => s.group === g.code && s.isOverridden).length,
      items: visible.filter((s) => s.group === g.code),
    }));
  }, [allSettings, onlyChanged, query]);

  const filtering = Boolean(query) || onlyChanged;

  // Filter shown groups based on selected tab without any layout jumping
  const shown = useMemo(() => {
    let list = groups.filter((g) => !filtering || g.items.length > 0);
    if (activeGroupKey !== 'ALL' && activeGroupKey !== POSTING_PACKAGES_ID) {
      list = list.filter((g) => g.code === activeGroupKey);
    }
    return list;
  }, [groups, filtering, activeGroupKey]);

  return (
    <div className="space-y-6">
      {/* ── Page Hero ──────────────────────────────────────────────────────── */}
      <PageHero
        eyebrow="Cấu hình nghiệp vụ"
        title="Cài đặt hệ thống"
        description="Các thông số tính phí, hạn mức hoa hồng và thời hạn vận hành. Thay đổi có hiệu lực ngay cho các giao dịch và hồ sơ phát sinh sau đó."
        actions={
          <Button
            icon={<ReloadOutlined spin={settings.isFetching} />}
            onClick={() => settings.refetch()}
            loading={settings.isFetching}
            className="rounded-lg font-medium"
          >
            Làm mới
          </Button>
        }
      />

      {/* ── KPI Overview Cards (Sleek Typography, No distracting icons) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-solid border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tổng thông số
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
            {totalCount}
          </div>
          <div className="mt-1 text-[11.5px] text-slate-400">10 phân hệ cấu hình</div>
        </div>

        <div className="rounded-xl border border-solid border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Chuẩn mặc định
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700 tabular-nums">
            {defaultCount}
          </div>
          <div className="mt-1 text-[11.5px] text-emerald-600">Theo mô hình kinh doanh</div>
        </div>

        <div className="rounded-xl border border-solid border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Đã tùy chỉnh
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 tabular-nums">
            {changedCount}
          </div>
          <div className="mt-1 text-[11.5px] text-amber-600">Admin đã tối ưu</div>
        </div>

        <div className="rounded-xl border border-solid border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-800">
            Gói tin AP
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-700 tabular-nums">
            Hoạt động
          </div>
          <div className="mt-1 text-[11.5px] text-blue-600">Đăng tin & Hạn mức CV</div>
        </div>
      </div>

      {settings.isLoading ? (
        <Surface padded>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Surface>
      ) : settings.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải cấu hình hệ thống"
          description={getApiErrorMessage(settings.error)}
        />
      ) : !settings.data?.length ? (
        <Surface padded>
          <Empty description="Chưa có cấu hình nào." />
        </Surface>
      ) : (
        /* ── Main Layout: Clean Sidebar Tabs (No icon clutter) + Content Area ── */
        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)] items-start">
          {/* ── Left Sidebar Navigation (Clean Typography - zero icon clutter) ── */}
          <nav
            aria-label="Nhóm cài đặt"
            className="sticky top-4 rounded-2xl border border-solid border-slate-200/90 bg-white p-2.5 shadow-2xs"
          >
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Danh mục cấu hình
            </div>

            <div className="space-y-1">
              {/* All Settings Tab */}
              <button
                type="button"
                onClick={() => setActiveGroupKey('ALL')}
                className={`flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border-0 px-3.5 py-2.5 text-left text-[13.5px] transition-all ${
                  activeGroupKey === 'ALL'
                    ? 'bg-sky-50 font-bold text-sky-700 border-l-4 border-solid border-sky-600 shadow-2xs'
                    : 'bg-transparent font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="truncate">Tất cả cài đặt</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                  {totalCount}
                </span>
              </button>

              {/* Group Tabs without icons */}
              {groups.map((g) => {
                const isActive = activeGroupKey === g.code;
                return (
                  <div key={g.code} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveGroupKey(g.code)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-0 px-3.5 py-2 text-left text-[13px] transition-all ${
                        isActive
                          ? 'bg-sky-50 font-bold text-sky-700 border-l-4 border-solid border-sky-600 shadow-2xs'
                          : 'bg-transparent font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{g.title}</span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500 shrink-0">
                        {g.changed > 0 && (
                          <span
                            className="h-2 w-2 rounded-full bg-amber-500 shadow-xs"
                            title={`${g.changed} mục đã thay đổi`}
                          />
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-600">
                          {g.total}
                        </span>
                      </span>
                    </button>

                    {/* Sub-item for AP Posting Packages */}
                    {g.code === 'CV_APPLICATION' && (
                      <button
                        type="button"
                        onClick={() => setActiveGroupKey(POSTING_PACKAGES_ID)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border-0 py-1.5 pl-7 pr-3 text-left text-[12.5px] transition-all ${
                          activeGroupKey === POSTING_PACKAGES_ID
                            ? 'bg-blue-50 font-bold text-blue-700'
                            : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">Gói đăng tin AP</span>
                        <span className="text-[10.5px] font-semibold text-blue-600">Cấu hình</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* ── Right Content Area ────────────────────────────────────────── */}
          <div className="min-w-0 space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="rounded-2xl border border-solid border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  allowClear
                  prefix={<SearchOutlined className="text-slate-400" />}
                  placeholder="Tìm cài đặt, ví dụ: bảo hành, thanh toán, hoa hồng..."
                  aria-label="Tìm cài đặt"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-md h-9 rounded-xl"
                />

                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700 select-none">
                    <Switch
                      size="small"
                      checked={onlyChanged}
                      onChange={setOnlyChanged}
                      aria-label="Chỉ mục đã đổi"
                    />
                    <span>Chỉ mục đã đổi</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[11px] font-bold text-amber-800 tabular-nums">
                      {changedCount}
                    </span>
                  </label>

                  {activeGroupKey !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setActiveGroupKey('ALL')}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 border-0 bg-transparent p-0 cursor-pointer"
                    >
                      Xem tất cả nhóm
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Empty Search State */}
            {shown.length === 0 && activeGroupKey !== POSTING_PACKAGES_ID && (
              <Surface padded className="py-12 text-center">
                <Empty description="Không có cài đặt nào khớp với bộ lọc." />
                <Button
                  onClick={() => {
                    setSearch('');
                    setOnlyChanged(false);
                    setActiveGroupKey('ALL');
                  }}
                  className="mt-3 font-medium"
                >
                  Xóa bộ lọc
                </Button>
              </Surface>
            )}

            {/* Render Groups with Isolated Card-based Items */}
            {activeGroupKey !== POSTING_PACKAGES_ID &&
              shown.map((g) => {
                const isCollapsed = !filtering && collapsed[g.code];
                return (
                  <React.Fragment key={g.code}>
                    <div id={anchorId(g.code)} className="rounded-2xl border border-solid border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                      <section aria-label={g.title}>
                        <div
                          onClick={() => setCollapsed((c) => ({ ...c, [g.code]: !c[g.code] }))}
                          aria-expanded={!isCollapsed}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setCollapsed((c) => ({ ...c, [g.code]: !c[g.code] }));
                            }
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-slate-50/80 px-5 py-3.5 text-left transition-colors hover:bg-slate-100/70"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Tag color={g.color} className="!m-0 font-bold px-2 py-0.5 rounded text-xs">
                              {g.tag}
                            </Tag>
                            <span className="text-[15px] font-bold text-slate-900 truncate">
                              {g.title}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              · {g.total} cài đặt{g.changed ? `, ${g.changed} đã đổi` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                              {isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                            </span>
                            <span className="text-slate-400 text-xs" aria-hidden>
                              {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                            </span>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="p-4 bg-slate-50/40">
                            <ul className="m-0 list-none space-y-3 p-0">
                              {g.items.map((s) => (
                                <SettingRow
                                  key={s.key}
                                  setting={s}
                                  onEdit={() => open(s)}
                                  onRestore={() => restore(s)}
                                />
                              ))}
                            </ul>
                          </div>
                        )}
                      </section>
                    </div>

                    {/* The AP posting packages belong to the AP service, so they sit right under its settings */}
                    {g.code === 'CV_APPLICATION' && !filtering && (
                      <div id={POSTING_PACKAGES_ID} className="mt-4">
                        <PostingPackagesSection />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

            {/* Posting Packages Only View */}
            {activeGroupKey === POSTING_PACKAGES_ID && (
              <div id={POSTING_PACKAGES_ID}>
                <PostingPackagesSection />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Setting Modal ──────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <EditOutlined className="text-sky-600" />
            <span>Sửa: {editing?.label}</span>
          </div>
        }
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: draft === null || draft === editing?.value }}
        onOk={() => editing && draft !== null && save.mutate({ key: editing.key, value: draft })}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        centered
      >
        {editing && (
          <div className="space-y-4 pt-2">
            <p className="m-0 text-[13.5px] leading-relaxed text-slate-600">
              {editing.description}
            </p>

            <div className="rounded-xl border border-solid border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Nhập giá trị mới:</span>
                <span>
                  Khoảng cho phép:{' '}
                  <strong className="text-slate-700">
                    {formatNumber(editing.min)} – {formatNumber(editing.max)} {editing.unit}
                  </strong>
                </span>
              </div>

              <InputNumber
                className="w-full text-base font-bold"
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
            </div>

            {draft !== null && draft !== editing.value ? (
              <Alert
                type="info"
                showIcon
                message={
                  <div className="font-semibold text-slate-900">
                    Thay đổi: {formatNumber(editing.value)} {editing.unit} →{' '}
                    <span className="text-sky-600 font-bold">
                      {formatNumber(draft)} {editing.unit}
                    </span>
                  </div>
                }
                description="Áp dụng cho các hồ sơ, giao dịch và sự kiện phát sinh sau khi lưu. Khoản phí, bảo hành và hoa hồng đã tạo trước đó vẫn giữ nguyên số liệu cũ."
                className="rounded-xl border-sky-200 bg-sky-50"
              />
            ) : (
              <Alert
                type="info"
                showIcon
                message="Khoản phí, bảo hành và hoa hồng đã tạo giữ nguyên con số cũ."
                className="rounded-xl border-slate-200 bg-slate-50"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;