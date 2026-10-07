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
  Form,
  InputNumber,
  Radio,
  Segmented,
  Select,
  Switch,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminCommissionApi, adminServiceTypesApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { CommissionRateType, CommissionRule } from '@/types/api/admin';
import { AdminPageHeader, StatusBadge, adminTokens } from './adminTheme';

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

  const toggleActive = (rule: CommissionRule) =>
    modal.confirm({
      title: rule.isActive ? 'Ngừng hiệu lực quy tắc này?' : 'Kích hoạt lại quy tắc này?',
      content: rule.isActive
        ? 'Các placement mới sẽ không còn tính hoa hồng theo quy tắc này.'
        : 'Quy tắc sẽ được dùng để tính hoa hồng cho các placement phù hợp.',
      okText: rule.isActive ? 'Ngừng hiệu lực' : 'Kích hoạt',
      okButtonProps: { danger: rule.isActive },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const res = await adminCommissionApi.setActive(rule.commissionRuleId, !rule.isActive);
          message.success(res.message || 'Đã cập nhật.');
          refresh();
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
    });

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
    { title: 'Cần qua bảo hành', dataIndex: 'warrantyRequired', width: 140, render: (v: boolean) => (v ? 'Có' : 'Không') },
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
      render: (_, r) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <StatusBadge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Đang áp dụng' : 'Ngừng'}</StatusBadge>
          <Button size="small" type="link" danger={r.isActive} onClick={() => toggleActive(r)}>
            {r.isActive ? 'Ngừng' : 'Kích hoạt'}
          </Button>
        </div>
      ),
    },
  ];

  const isNew = editing === 'new';
  const page = list.data;

  return (
    <div>
      <AdminPageHeader
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

      <section className="rounded-xl border border-solid border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-solid border-slate-100 p-3">
          <Segmented
            value={activeParam ?? 'all'}
            onChange={(v) => setParam('active', v === 'all' ? undefined : String(v))}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'true', label: 'Đang áp dụng' },
              { value: 'false', label: 'Ngừng' },
            ]}
            aria-label="Lọc theo trạng thái"
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
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được quy tắc hoa hồng" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<CommissionRule>
            rowKey="commissionRuleId"
            loading={list.isLoading}
            columns={columns}
            dataSource={page?.items ?? []}
            scroll={{ x: 1080 }}
            locale={{ emptyText: 'Chưa có quy tắc hoa hồng nào phù hợp.' }}
            onRow={(r) => ({
              onClick: () => setEditing(r),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setEditing(r);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Sửa quy tắc ${r.name}`,
            })}
            pagination={{
              current: page?.page ?? params.page,
              pageSize: PAGE_SIZE,
              total: page?.total ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => setParam('page', String(p)),
            }}
          />
        )}
      </section>

      <Drawer
        open={Boolean(editing)}
        width={520}
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
