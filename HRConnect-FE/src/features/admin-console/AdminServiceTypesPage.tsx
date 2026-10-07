/**
 * @file AdminServiceTypesPage.tsx
 * @description Admin · service types (/admin/service-types) and their role permissions.
 * Role permissions are enforced by JobRepository: CanView filters who sees jobs of the type,
 * CanSubmit gates who may submit — so saving them asks for confirmation.
 * Only roles already mapped can be toggled: the backend has no role catalog endpoint.
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Divider, Drawer, Form, Input, Skeleton, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminServiceTypesApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AdminServiceType, ServiceTypeAllowedRole, ServiceTypeInput } from '@/types/api/admin';
import { adminTokens, formatDateTime } from './adminTheme';
import { PageHero, StatusDot, Surface } from './ui';
import { ROLE_LABEL } from './AdminUsersPage';

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{ fontFamily: adminTokens.mono }} className="text-xs text-slate-800">{children}</code>
);

const RolePermissions: React.FC<{ serviceType: AdminServiceType }> = ({ serviceType }) => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ['admin-st-roles', serviceType.id],
    queryFn: () => adminServiceTypesApi.getAllowedRoles(serviceType.id),
  });
  const [draft, setDraft] = useState<ServiceTypeAllowedRole[]>([]);
  useEffect(() => setDraft(roles.data ?? []), [roles.data]);

  const save = useMutation({
    mutationFn: () =>
      adminServiceTypesApi.replaceAllowedRoles(
        serviceType.id,
        draft.map(({ roleId, canView, canSubmit }) => ({ roleId, canView, canSubmit }))
      ),
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu phân quyền.');
      queryClient.invalidateQueries({ queryKey: ['admin-st-roles', serviceType.id] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(roles.data ?? []);
  const toggle = (roleId: string, field: 'canView' | 'canSubmit', value: boolean) =>
    setDraft((rows) => rows.map((r) => (r.roleId === roleId ? { ...r, [field]: value } : r)));

  if (roles.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (roles.isError) return <Alert type="error" showIcon message={getApiErrorMessage(roles.error)} />;

  return (
    <div className="space-y-3">
      <Typography.Paragraph className="!mb-0" style={{ color: adminTokens.textMuted }}>
        <b>Được xem</b> quyết định vai trò nào thấy tin thuộc loại dịch vụ này. <b>Được nộp</b> quyết định vai trò nào
        được nộp hồ sơ vào tin. Thay đổi có hiệu lực ngay.
      </Typography.Paragraph>
      {draft.length === 0 ? (
        <Alert type="info" showIcon message="Loại dịch vụ này chưa gán vai trò nào." description="Backend chưa có API liệt kê vai trò, nên chưa thể thêm vai trò mới từ giao diện." />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 font-semibold">Vai trò</th>
              <th className="w-28 py-2 text-center font-semibold">Được xem</th>
              <th className="w-28 py-2 text-center font-semibold">Được nộp</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => {
              const label = ROLE_LABEL[r.roleCode as keyof typeof ROLE_LABEL] ?? r.roleName;
              return (
                <tr key={r.roleId} className="border-0 border-t border-solid border-slate-100">
                  <td className="py-2">
                    {label}
                    {!r.isRoleActive && <span className="ml-1 text-xs text-slate-500">(vai trò đang tắt)</span>}
                  </td>
                  <td className="py-2 text-center">
                    <Switch size="small" checked={r.canView} onChange={(v) => toggle(r.roleId, 'canView', v)} aria-label={`${label} được xem`} />
                  </td>
                  <td className="py-2 text-center">
                    <Switch size="small" checked={r.canSubmit} onChange={(v) => toggle(r.roleId, 'canSubmit', v)} aria-label={`${label} được nộp`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {draft.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button disabled={!dirty || save.isPending} onClick={() => setDraft(roles.data ?? [])}>
            Hoàn tác
          </Button>
          <Button
            type="primary"
            disabled={!dirty}
            loading={save.isPending}
            onClick={() =>
              modal.confirm({
                title: 'Lưu phân quyền theo vai trò?',
                content: `Ai thấy và ai được nộp hồ sơ vào các tin "${serviceType.name}" sẽ thay đổi ngay.`,
                okText: 'Lưu',
                cancelText: 'Hủy',
                onOk: () => save.mutateAsync(),
              })
            }
          >
            Lưu phân quyền
          </Button>
        </div>
      )}
    </div>
  );
};

export const AdminServiceTypesPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminServiceType | 'new' | null>(null);
  const [form] = Form.useForm<ServiceTypeInput>();
  const list = useQuery({ queryKey: ['admin-service-types'], queryFn: () => adminServiceTypesApi.list() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-service-types'] });
    queryClient.invalidateQueries({ queryKey: ['mf01-service-types'] });
  };

  useEffect(() => {
    if (editing === 'new') form.setFieldsValue({ code: '', name: '', description: '', isActive: true });
    else if (editing) form.setFieldsValue({ code: editing.code, name: editing.name, description: editing.description ?? '', isActive: editing.isActive });
  }, [editing, form]);

  const save = useMutation({
    mutationFn: (v: ServiceTypeInput) => {
      const input = { ...v, code: v.code.trim().toUpperCase(), name: v.name.trim(), description: v.description?.trim() || null };
      return editing === 'new' ? adminServiceTypesApi.create(input) : adminServiceTypesApi.update((editing as AdminServiceType).id, input);
    },
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu loại dịch vụ.');
      setEditing(null);
      refresh();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const remove = (st: AdminServiceType) =>
    modal.confirm({
      title: `Xóa loại dịch vụ "${st.name}"?`,
      content: 'Nếu loại dịch vụ đã có tin tuyển dụng, hệ thống sẽ chuyển sang ngừng hoạt động thay vì xóa hẳn.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const res = await adminServiceTypesApi.remove(st.id);
          message.success(res.isDeactivated ? 'Loại dịch vụ đang được dùng nên đã chuyển sang ngừng hoạt động.' : res.message || 'Đã xóa.');
          setEditing(null);
          refresh();
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
    });

  const columns: ColumnsType<AdminServiceType> = [
    { title: 'Mã', dataIndex: 'code', width: 190, render: (v: string) => <Mono>{v}</Mono> },
    { title: 'Tên', dataIndex: 'name', render: (v: string) => <span className="font-semibold text-slate-900">{v}</span> },
    { title: 'Mô tả', dataIndex: 'description', render: (v: string | null) => <span className="line-clamp-2 text-slate-700">{v ?? '—'}</span> },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      width: 140,
      render: (v: boolean) => <StatusDot tone={v ? 'success' : 'neutral'}>{v ? 'Đang dùng' : 'Ngừng hoạt động'}</StatusDot>,
    },
    { title: 'Tạo lúc', dataIndex: 'createdAt', width: 150, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  const current = editing && editing !== 'new' ? editing : null;

  return (
    <div>
      <PageHero
        eyebrow="Cấu hình"
        title="Loại dịch vụ"
        description="Các gói dịch vụ tuyển dụng doanh nghiệp chọn khi đăng tin, và vai trò nào được xem hoặc nộp hồ sơ."
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              Thêm loại dịch vụ
            </Button>
          </>
        }
      />

      <Surface>
        {list.isError ? (
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được loại dịch vụ" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AdminServiceType>
            className="admin-soft-table"
            rowKey="id"
            loading={list.isLoading}
            columns={columns}
            dataSource={list.data ?? []}
            pagination={false}
            scroll={{ x: 860 }}
            locale={{ emptyText: 'Chưa có loại dịch vụ nào.' }}
            onRow={(r) => ({
              onClick: () => setEditing(r),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setEditing(r);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Sửa loại dịch vụ ${r.name}`,
            })}
          />
        )}
      </Surface>

      <Drawer
        open={Boolean(editing)}
        width="min(560px, 100vw)"
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Thêm loại dịch vụ' : `Sửa: ${current?.name ?? ''}`}
        destroyOnClose
        extra={
          current && (
            <Button danger icon={<DeleteOutlined />} onClick={() => remove(current)}>
              Xóa
            </Button>
          )
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>Hủy</Button>
            <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
              Lưu
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} validateTrigger="onBlur">
          <Form.Item
            name="code"
            label="Mã"
            extra="Chữ, số và dấu gạch dưới. Ví dụ HEADHUNT_COD. Đổi mã có thể ảnh hưởng quy tắc nghiệp vụ đang dựa vào mã."
            rules={[
              { required: true, whitespace: true, message: 'Nhập mã.' },
              { max: 50, message: 'Tối đa 50 ký tự.' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: 'Chỉ dùng chữ, số và dấu gạch dưới (_).' },
            ]}
          >
            <Input style={{ fontFamily: adminTokens.mono }} />
          </Form.Item>
          <Form.Item name="name" label="Tên hiển thị" rules={[{ required: true, whitespace: true, message: 'Nhập tên.' }, { max: 120, message: 'Tối đa 120 ký tự.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
            <Input.TextArea rows={3} showCount maxLength={500} />
          </Form.Item>
          <Form.Item name="isActive" label="Đang dùng" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        {current && (
          <>
            <Divider orientation="left" orientationMargin={0}>
              Phân quyền theo vai trò
            </Divider>
            <RolePermissions serviceType={current} />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default AdminServiceTypesPage;
