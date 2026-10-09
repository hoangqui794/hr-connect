/**
 * Admin › Cài đặt — business numbers Platform Admin can change without a deploy
 * (GET/PUT /admin/settings). Defaults come from the business-model documents; a new value
 * applies to records created afterwards, existing fees and warranties keep their numbers.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, InputNumber, Modal, Skeleton, Tooltip } from 'antd';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { businessSettingsApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { BusinessSetting } from '@/types/api/finance';
import { PageHero, StatusDot, Surface } from './ui';

const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

export const AdminSettingsPage: React.FC = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-business-settings'], queryFn: () => businessSettingsApi.list() });
  const [editing, setEditing] = useState<BusinessSetting | null>(null);
  const [draft, setDraft] = useState<number | null>(null);

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

  const groups = (settings.data ?? []).reduce<Record<string, BusinessSetting[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHero
        eyebrow="Cấu hình nghiệp vụ"
        title="Cài đặt"
        description="Các con số tính phí và hoa hồng. Giá trị mặc định lấy theo tài liệu mô hình kinh doanh; thay đổi áp dụng cho các khoản phát sinh sau đó."
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
        <div className="space-y-6">
          {Object.entries(groups).map(([group, items]) => (
            <Surface key={group}>
              <div className="border-b border-slate-200 px-6 py-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">{group}</div>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                {items.map((s) => (
                  <li key={s.key} className="flex flex-wrap items-center gap-4 px-6 py-4">
                    <div className="min-w-[240px] flex-1">
                      <div className="text-[15px] font-semibold text-slate-900">{s.label}</div>
                      <div className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{s.description}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Mặc định {formatNumber(s.defaultValue)} {s.unit} · Nguồn: {s.source}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-bold tabular-nums text-slate-900">
                        {formatNumber(s.value)} <span className="text-sm font-medium text-slate-500">{s.unit}</span>
                      </div>
                      {s.isOverridden ? (
                        <Tooltip title={s.updatedAt ? `Sửa lúc ${dayjs(s.updatedAt).format('HH:mm DD/MM/YYYY')}` : undefined}>
                          <span>
                            <StatusDot tone="info">Đã chỉnh</StatusDot>
                          </span>
                        </Tooltip>
                      ) : (
                        <StatusDot tone="neutral">Mặc định</StatusDot>
                      )}
                    </div>
                    <Button icon={<EditOutlined />} onClick={() => open(s)} aria-label={`Sửa ${s.label}`}>
                      Sửa
                    </Button>
                  </li>
                ))}
              </ul>
            </Surface>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing ? `Sửa: ${editing.label}` : ''}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: draft === null }}
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
              Cho phép từ {formatNumber(editing.min)} đến {formatNumber(editing.max)} {editing.unit}. Mặc định {formatNumber(editing.defaultValue)}.
            </div>
            <Alert type="info" showIcon message="Khoản phí, bảo hành và hoa hồng đã tạo giữ nguyên con số cũ." />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
