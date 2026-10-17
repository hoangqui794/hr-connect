/**
 * @file AdminCommissionRulesPage.tsx
 * @description Admin · commission rules (/admin/commission-rules). Create picks service type +
 * milestone (GET /admin/commission-milestones); update may only change rate and dates, matching
 * UpdateCommissionRuleCommand. PERCENT is capped at 100 like the backend validator.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  App as AntApp,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Form,
  InputNumber,
  Radio,
  Select,
  Skeleton,
  Switch,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminCommissionApi, adminServiceTypesApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { CommissionRateType, CommissionRule } from '@/types/api/admin';
import { adminTokens } from './adminTheme';
import { FilterPills, PageHero, StatusDot, Surface } from './ui';

const PAGE_SIZE = 20;
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const formatRate = (r: Pick<CommissionRule, 'rateType' | 'rateValue'>) =>
  r.rateType === 'PERCENT' ? `${r.rateValue}%` : vnd.format(r.rateValue);
const formatDate = (iso: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY') : null);

interface RuleFormValues {
  serviceTypeId: string;
  milestoneType: string;
  rateType: CommissionRateType;
  rateValue: number;
  warrantyRequired: boolean;
  period?: [Dayjs | null, Dayjs | null];
  isActive: boolean;
}

export const AdminCommissionRulesPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<CommissionRule | 'new' | null>(null);
  const [form] = Form.useForm<RuleFormValues>();
  const rateType = Form.useWatch('rateType', form);

  const activeParam = searchParams.get('active');
  const params = {
    serviceTypeId: searchParams.get('service') ?? undefined,
    isActive: activeParam === 'true' ? true : activeParam === 'false' ? false : undefined,
    page: Number(searchParams.get('page')) || 1,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({ queryKey: ['admin-commission', params], queryFn: () => adminCommissionApi.list(params), placeholderData: (p) => p });
  const serviceTypes = useQuery({ queryKey: ['admin-service-types'], queryFn: () => adminServiceTypesApi.list() });
  const milestones = useQuery({ queryKey: ['admin-milestones'], queryFn: () => adminCommissionApi.milestones() });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    if (editing === 'new') {
      form.setFieldsValue({ rateType: 'PERCENT', warrantyRequired: true, isActive: true, period: [dayjs(), null] } as Partial<RuleFormValues>);
    } else if (editing) {
      form.setFieldsValue({
        serviceTypeId: editing.serviceTypeId,
        milestoneType: editing.milestoneType,
        rateType: editing.rateType,
        rateValue: editing.rateValue,
        warrantyRequired: editing.warrantyRequired,
        period: [editing.effectiveFrom ? dayjs(editing.effectiveFrom) : null, editing.effectiveTo ? dayjs(editing.effectiveTo) : null],
      });
    }
  }, [editing, form]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-commission'] });

  const save = useMutation({
    mutationFn: (v: RuleFormValues) => {
      const from = v.period?.[0]?.startOf('day').toISOString() ?? null;
      const to = v.period?.[1]?.endOf('day').toISOString() ?? null;
      if (editing === 'new') {
        return adminCommissionApi.create({
          serviceTypeId: v.serviceTypeId,
          milestoneType: v.milestoneType,
          rateType: v.rateType,
          rateValue: v.rateValue,
          warrantyRequired: v.warrantyRequired,
          effectiveFrom: from,
          effectiveTo: to,
          isActive: v.isActive,
        });
      }
      return adminCommissionApi.update((editing as CommissionRule).commissionRuleId, {
        rateType: v.rateType,
        rateValue: v.rateValue,
        warrantyRequired: v.warrantyRequired,
        effectiveFrom: from ?? dayjs().toISOString(),
        effectiveTo: to,
      });
    },
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu quy tắc hoa hồng.');
      setEditing(null);
      refresh();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, nextActive }: { id: string; nextActive: boolean }) => {
      setTogglingRuleId(id);
      return adminCommissionApi.setActive(id, nextActive);
    },
    onMutate: async ({ id, nextActive }) => {
      // Cancel queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['admin-commission'] });
      const previousData = queryClient.getQueryData(['admin-commission', params]);

      // Optimistic update in table cache
      queryClient.setQueryData(['admin-commission', params], (old: any) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          items: old.items.map((item: CommissionRule) =>
            item.commissionRuleId === id ? { ...item, isActive: nextActive } : item
          ),
        };
      });

      return { previousData };
    },
    onError: (err, _vars, context) => {
      // Rollback on failure
      if (context?.previousData) {
        queryClient.setQueryData(['admin-commission', params], context.previousData);
      }
      message.error(getApiErrorMessage(err, 'Không thể cập nhật trạng thái quy tắc hoa hồng.'));
    },
    onSuccess: (res, vars) => {
      message.success(
        res.message || (vars.nextActive ? 'Đã kích hoạt quy tắc hoa hồng.' : 'Đã ngừng áp dụng quy tắc hoa hồng.')
      );
    },
    onSettled: () => {
      setTogglingRuleId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-commission'] });
    },
  });

  const handleToggle = (rule: CommissionRule) => {
    if (rule.isActive) {
      modal.confirm({
        title: 'Ngừng áp dụng quy tắc hoa hồng?',
        content: (
          <div className="space-y-2 text-sm text-slate-600">
            <p className="m-0">
              Quy tắc cho{' '}
              <strong className="text-slate-900">
                {rule.serviceTypeName ?? rule.serviceTypeCode} - {rule.milestoneName ?? rule.milestoneType}
              </strong>{' '}
              (Mức: <span className="font-semibold text-slate-900">{formatRate(rule)}</span>) sẽ bị vô hiệu hóa.
            </p>
            <p className="m-0 text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
              ⚠️ Cảnh báo: Các tin tuyển dụng hoặc placement mới thuộc loại dịch vụ này sẽ không còn được tự động tính hoa hồng theo mức này.
            </p>
          </div>
        ),
        okText: 'Ngừng hiệu lực',
        okButtonProps: { danger: true },
        cancelText: 'Hủy',
        onOk: () => {
          toggleMutation.mutate({ id: rule.commissionRuleId, nextActive: false });
        },
      });
    } else {
      toggleMutation.mutate({ id: rule.commissionRuleId, nextActive: true });
    }
  };

  const columns: ColumnsType<CommissionRule> = [
    {
      title: 'Loại dịch vụ',
      key: 'st',
      width: 210,
      render: (_, r) => <span className="font-semibold text-slate-900">{r.serviceTypeName ?? r.serviceTypeCode}</span>,
    },
    {
      title: 'Mốc hoa hồng',
      key: 'ms',
      render: (_, r) => (
        <div>
          <div className="text-slate-900">{r.milestoneName ?? r.milestoneType}</div>
          <code style={{ fontFamily: adminTokens.mono }} className="text-[11px] text-slate-600">{r.milestoneType}</code>
        </div>
      ),
    },
    { title: 'Mức hoa hồng', key: 'rate', width: 150, align: 'right', render: (_, r) => <span className="font-semibold tabular-nums">{formatRate(r)}</span> },
    { title: 'Qua bảo hành', dataIndex: 'warrantyRequired', width: 140, render: (v: boolean) => (v ? 'Có' : 'Không') },
    {
      title: 'Hiệu lực',
      key: 'period',
      width: 210,
      render: (_, r) => (
        <span className="tabular-nums">
          {formatDate(r.effectiveFrom) ?? '—'} → {formatDate(r.effectiveTo) ?? 'không thời hạn'}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'active',
      width: 210,
      render: (_, r) => {
        const isToggling = togglingRuleId === r.commissionRuleId;
        return (
          <div
            className="flex items-center gap-2.5"
            onClick={(e) => e.stopPropagation()}
            data-testid={`commission-rule-status-${r.commissionRuleId}`}
          >
            <Switch
              size="small"
              checked={r.isActive}
              loading={isToggling}
              disabled={isToggling}
              onChange={() => handleToggle(r)}
              aria-label={`Bật tắt quy tắc ${r.name || r.milestoneType}`}
              data-testid={`commission-rule-switch-${r.commissionRuleId}`}
            />
            <StatusDot tone={r.isActive ? 'success' : 'neutral'}>
              {r.isActive ? 'Đang áp dụng' : 'Ngừng'}
            </StatusDot>
          </div>
        );
      },
    },
  ];

  const isNew = editing === 'new';
  const page = list.data;

  return (
    <div>
      <PageHero
        eyebrow="Cấu hình"
        title="Quy tắc hoa hồng"
        description="Mức hoa hồng Affiliate nhận theo từng loại dịch vụ và mốc (ví dụ ứng viên đi làm, qua bảo hành)."
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              Thêm quy tắc
            </Button>
          </>
        }
      />

      <Surface>
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
          <FilterPills
            label="Lọc theo trạng thái"
            value={activeParam ?? 'all'}
            onChange={(v) => setParam('active', v === 'all' ? undefined : v)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'true', label: 'Đang áp dụng' },
              { value: 'false', label: 'Ngừng' },
            ]}
          />
          <Select
            allowClear
            value={params.serviceTypeId}
            placeholder="Mọi loại dịch vụ"
            className="w-60"
            loading={serviceTypes.isLoading}
            onChange={(v) => setParam('service', v)}
            options={(serviceTypes.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            aria-label="Lọc theo loại dịch vụ"
          />
        </div>
        {list.isError ? (
          <div className="p-6" data-testid="commission-rules-error">
            <Alert
              type="error"
              showIcon
              message="Không tải được quy tắc hoa hồng"
              description={
                <div className="space-y-3 mt-1">
                  <p className="m-0 text-slate-700">{getApiErrorMessage(list.error)}</p>
                  <Button icon={<ReloadOutlined />} onClick={() => list.refetch()}>
                    Thử lại
                  </Button>
                </div>
              }
            />
          </div>
        ) : list.isLoading && !page ? (
          <div className="p-6 space-y-4" data-testid="commission-rules-loading">
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : !page || page.items.length === 0 ? (
          <div className="p-12 text-center" data-testid="commission-rules-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có quy tắc hoa hồng nào phù hợp bộ lọc."
            >
              <div className="flex items-center justify-center gap-2 mt-2">
                {params.serviceTypeId || params.isActive !== undefined ? (
                  <Button onClick={() => setSearchParams(new URLSearchParams())}>
                    Xóa bộ lọc
                  </Button>
                ) : null}
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
                  Thêm quy tắc mới
                </Button>
              </div>
            </Empty>
          </div>
        ) : (
          <Table<CommissionRule>
            className="admin-soft-table"
            rowKey="commissionRuleId"
            loading={list.isFetching && !list.isLoading}
            columns={columns}
            dataSource={page.items}
            scroll={{ x: 1080 }}
            pagination={{
              current: page.page ?? params.page,
              pageSize: PAGE_SIZE,
              total: page.total ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => setParam('page', String(p)),
            }}
            onRow={(r) => ({
              onClick: () => setEditing(r),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setEditing(r);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Sửa quy tắc ${r.name}`,
            })}
          />
        )}
      </Surface>

      <Drawer
        open={Boolean(editing)}
        width="min(520px, 100vw)"
        onClose={() => setEditing(null)}
        title={isNew ? 'Thêm quy tắc hoa hồng' : 'Sửa quy tắc hoa hồng'}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>Hủy</Button>
            <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
              Lưu
            </Button>
          </div>
        }
      >
        {!isNew && (
          <Alert
            className="mb-4"
            type="info"
            showIcon
            message="Chỉ đổi được mức hoa hồng và thời gian hiệu lực. Muốn đổi loại dịch vụ hoặc mốc, hãy tạo quy tắc mới."
          />
        )}
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} validateTrigger="onBlur">
          <Form.Item name="serviceTypeId" label="Loại dịch vụ" rules={[{ required: true, message: 'Chọn loại dịch vụ.' }]}>
            <Select
              disabled={!isNew}
              loading={serviceTypes.isLoading}
              options={(serviceTypes.data ?? []).filter((s) => s.isActive || !isNew).map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="milestoneType" label="Mốc hoa hồng" rules={[{ required: true, message: 'Chọn mốc.' }]}>
            <Select
              disabled={!isNew}
              loading={milestones.isLoading}
              options={(milestones.data ?? []).map((m) => ({ value: m.code, label: m.name }))}
            />
          </Form.Item>
          <Form.Item name="rateType" label="Cách tính" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="PERCENT">Phần trăm (%)</Radio>
              <Radio value="FIXED">Số tiền cố định</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="rateValue"
            label={rateType === 'FIXED' ? 'Số tiền (VND)' : 'Tỷ lệ (%)'}
            dependencies={['rateType']}
            rules={[
              { required: true, message: 'Nhập mức hoa hồng.' },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  v == null || v <= 0
                    ? Promise.reject(new Error('Phải lớn hơn 0.'))
                    : getFieldValue('rateType') === 'PERCENT' && v > 100
                      ? Promise.reject(new Error('Tỷ lệ không vượt quá 100%.'))
                      : Promise.resolve(),
              }),
            ]}
          >
            <InputNumber<number>
              className="w-full"
              min={0}
              step={rateType === 'FIXED' ? 100000 : 0.5}
              formatter={(v) => (v == null ? '' : rateType === 'FIXED' ? Number(v).toLocaleString('vi-VN') : String(v))}
              parser={(v) => Number((v ?? '').replace(rateType === 'FIXED' ? /\D/g : /[^\d.]/g, ''))}
            />
          </Form.Item>
          <Form.Item name="warrantyRequired" label="Chỉ trả khi ứng viên qua thời gian bảo hành" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="period" label="Thời gian hiệu lực" extra="Để trống ngày kết thúc nếu áp dụng không thời hạn.">
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" allowEmpty={[false, true]} />
          </Form.Item>
          {isNew && (
            <Form.Item name="isActive" label="Áp dụng ngay" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
        <Typography.Paragraph className="!mb-0 text-xs" style={{ color: adminTokens.textMuted }}>
          Hệ thống không cho tạo hai quy tắc đang áp dụng trùng loại dịch vụ, mốc và thời gian.
        </Typography.Paragraph>
      </Drawer>
    </div>
  );
};

export default AdminCommissionRulesPage;
