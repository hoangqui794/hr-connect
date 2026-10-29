/**
 * Admin › Cài đặt › AP posting packages (GET/PUT /admin/posting-packages). Admin changes the name,
 * description, price, display days, max CVs and on/off of each CV_APPLICATION package without a deploy.
 * New numbers apply to jobs submitted afterwards; posting fees already created keep their amount.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Checkbox, Form, Input, InputNumber, Modal, Skeleton, Switch } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { postingPackagesAdminApi, type PostingPackageUpdate } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { JobPostingPackage } from '@/types/api/jobs';
import { StatusDot, Surface } from './ui';

const vnd = (value: number) => (value === 0 ? 'Miễn phí' : `${value.toLocaleString('vi-VN')} ₫`);

const isFree = (p: JobPostingPackage) => p.code === 'FREE';

interface FormValues {
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  unlimited: boolean;
  maxApplications?: number | null;
  isActive: boolean;
}

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-[96px]">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-[15px] font-semibold tabular-nums text-slate-900">{value}</div>
  </div>
);

export const PostingPackagesSection: React.FC = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const packages = useQuery({ queryKey: ['admin-posting-packages'], queryFn: () => postingPackagesAdminApi.list() });
  const [editing, setEditing] = useState<JobPostingPackage | null>(null);
  const [form] = Form.useForm<FormValues>();
  const unlimited = Form.useWatch('unlimited', form);

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PostingPackageUpdate }) => postingPackagesAdminApi.update(id, body),
    onSuccess: (updated) => {
      message.success(`Đã lưu "${updated.name}". Áp dụng cho các tin gửi duyệt từ bây giờ.`);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-posting-packages'] });
      queryClient.invalidateQueries({ queryKey: ['mf01-posting-packages'] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const open = (p: JobPostingPackage) => {
    setEditing(p);
    form.setFieldsValue({
      name: p.name,
      description: p.description ?? '',
      price: p.price,
      durationDays: p.durationDays,
      unlimited: p.maxApplications == null,
      maxApplications: p.maxApplications ?? null,
      isActive: p.isActive,
    });
  };

  const submit = (values: FormValues) => {
    if (!editing) return;
    save.mutate({
      id: editing.packageId,
      body: {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        price: isFree(editing) ? 0 : values.price,
        durationDays: values.durationDays,
        maxApplications: values.unlimited ? null : values.maxApplications ?? null,
        isActive: values.isActive,
      },
    });
  };

  return (
    <Surface>
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">AP · Gói đăng tin</div>
        <div className="mt-0.5 text-[13.5px] text-slate-600">
          Gói Client chọn khi đăng tin dịch vụ Nhận hồ sơ ứng tuyển. Thay đổi áp dụng cho tin gửi duyệt sau đó.
        </div>
      </div>

      {packages.isLoading ? (
        <div className="px-6 py-5">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ) : packages.isError ? (
        <div className="px-6 py-5">
          <Alert type="error" showIcon message={getApiErrorMessage(packages.error)} />
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-slate-100 p-0">
          {(packages.data ?? []).map((p) => (
            <li key={p.packageId} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-slate-900">{p.name}</span>
                  {p.isActive ? <StatusDot tone="success">Đang bán</StatusDot> : <StatusDot tone="neutral">Đã tắt</StatusDot>}
                </div>
                {p.description && <div className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{p.description}</div>}
              </div>
              <Stat label="Giá" value={vnd(p.price)} />
              <Stat label="Hiển thị" value={`${p.durationDays} ngày`} />
              <Stat label="Hồ sơ tối đa" value={p.maxApplications == null ? 'Không giới hạn' : `${p.maxApplications} hồ sơ`} />
              <Button icon={<EditOutlined />} onClick={() => open(p)} aria-label={`Sửa ${p.name}`}>
                Sửa
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing ? `Sửa gói: ${editing.name}` : ''}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={save.isPending}
        onOk={() => form.submit()}
        onCancel={() => setEditing(null)}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional" className="pt-2">
          <Form.Item name="name" label="Tên gói" rules={[{ required: true, whitespace: true, message: 'Nhập tên gói.' }, { max: 200 }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="Quyền lợi / mô tả" extra="Client thấy dòng này khi chọn gói.">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} showCount />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="price"
              label="Giá"
              rules={[{ required: true, message: 'Nhập giá.' }]}
              extra={editing && isFree(editing) ? 'Gói miễn phí luôn là 0 ₫.' : undefined}
            >
              <InputNumber<number>
                className="w-full"
                min={0}
                max={1_000_000_000}
                step={100_000}
                disabled={Boolean(editing && isFree(editing))}
                formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                addonAfter="₫"
              />
            </Form.Item>
            <Form.Item name="durationDays" label="Số ngày hiển thị tin" rules={[{ required: true, message: 'Nhập số ngày.' }]}>
              <InputNumber className="w-full" min={1} max={365} precision={0} addonAfter="ngày" />
            </Form.Item>
          </div>
          <Form.Item label="Hồ sơ tối đa mỗi tin" required>
            <div className="flex flex-wrap items-center gap-4">
              <Form.Item
                name="maxApplications"
                noStyle
                rules={[{ required: !unlimited, message: 'Nhập số hồ sơ hoặc chọn Không giới hạn.' }]}
              >
                <InputNumber className="w-40" min={1} max={100_000} precision={0} disabled={unlimited} addonAfter="hồ sơ" aria-label="Hồ sơ tối đa" />
              </Form.Item>
              <Form.Item name="unlimited" valuePropName="checked" noStyle>
                <Checkbox>Không giới hạn số hồ sơ</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="isActive" label="Đang bán" valuePropName="checked" extra="Tắt gói thì Client không chọn được gói này cho tin mới.">
            <Switch />
          </Form.Item>
          <Alert type="info" showIcon message="Tin đã gửi duyệt và phí đăng tin đã tạo giữ nguyên con số cũ." />
        </Form>
      </Modal>
    </Surface>
  );
};
