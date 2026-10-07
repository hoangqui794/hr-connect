/**
 * @file AdminProfileAndPlaceholders.tsx
 * @description Admin profile (GET/PUT /admin/profile/me) and the pages whose backend API
 * does not exist yet (disputes, payouts, settings) — those show an explicit empty state.
 */
import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Card, Descriptions, Form, Input, Skeleton } from 'antd';
import { apiClient, getApiErrorMessage } from '@/services/apiClient';
import { AdminPageHeader, NoApiYet, StatusBadge, adminTokens, formatDateTime } from './adminTheme';

interface AdminProfile {
  adminProfileId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const AdminProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{ displayName: string; phone?: string; jobTitle?: string }>();
  const profile = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => (await apiClient.get<{ data: AdminProfile }>('/admin/profile/me')).data.data,
  });

  useEffect(() => {
    if (profile.data)
      form.setFieldsValue({
        displayName: profile.data.displayName ?? '',
        phone: profile.data.phone ?? '',
        jobTitle: profile.data.jobTitle ?? '',
      });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: async (v: { displayName: string; phone?: string; jobTitle?: string }) =>
      (
        await apiClient.put<{ message: string }>('/admin/profile/me', {
          displayName: v.displayName.trim(),
          phone: v.phone?.trim() || null,
          jobTitle: v.jobTitle?.trim() || null,
        })
      ).data,
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu hồ sơ.');
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  return (
    <div className="max-w-3xl">
      <AdminPageHeader title="Hồ sơ quản trị viên" description="Thông tin hiển thị khi bạn duyệt hồ sơ và trong nhật ký hệ thống." />
      {profile.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : profile.isError || !profile.data ? (
        <Alert type="error" showIcon message={getApiErrorMessage(profile.error, 'Không tải được hồ sơ.')} />
      ) : (
        <div className="space-y-5">
          <Card size="small">
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} labelStyle={{ color: adminTokens.textMuted }}>
              <Descriptions.Item label="Email">{profile.data.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Mã nhân viên">{profile.data.employeeCode ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <StatusBadge tone={profile.data.status === 'ACTIVE' ? 'success' : 'neutral'}>{profile.data.status}</StatusBadge>
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật">{formatDateTime(profile.data.updatedAt)}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title="Chỉnh sửa">
            <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} validateTrigger="onBlur">
              <Form.Item
                name="displayName"
                label="Họ và tên"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập họ và tên.' },
                  { min: 2, message: 'Tối thiểu 2 ký tự.' },
                  { max: 180, message: 'Tối đa 180 ký tự.' },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Điện thoại" rules={[{ pattern: /^[0-9+() \-.]{8,20}$/, message: 'Số điện thoại không đúng định dạng.' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="jobTitle" label="Chức danh" rules={[{ max: 120, message: 'Tối đa 120 ký tự.' }]}>
                <Input />
              </Form.Item>
              <div className="flex justify-end">
                <Button type="primary" htmlType="submit" loading={save.isPending}>
                  Lưu thay đổi
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      )}
    </div>
  );
};

export const AdminDisputesPlaceholder: React.FC = () => (
  <div>
    <AdminPageHeader title="Tranh chấp" description="Khiếu nại về ghi nhận nguồn ứng viên và hoa hồng." />
    <NoApiYet feature="Xử lý tranh chấp" detail="Quyền dispute.view / dispute.resolve đã có, nhưng chưa có endpoint." />
  </div>
);

export const AdminPayoutsPlaceholder: React.FC = () => (
  <div>
    <AdminPageHeader title="Chi trả hoa hồng" description="Duyệt và theo dõi các khoản hoa hồng trả cho Cộng tác viên." />
    <NoApiYet feature="Chi trả hoa hồng" detail="Thuộc MF-05; quyền payout.manage đã có, nhưng chưa có endpoint." />
  </div>
);

export const AdminSettingsPlaceholder: React.FC = () => (
  <div>
    <AdminPageHeader title="Cài đặt hệ thống" description="Tham số vận hành chung của nền tảng." />
    <NoApiYet feature="Cài đặt hệ thống" detail="Quyền system_config.manage đã có, nhưng chưa có endpoint. Loại dịch vụ và hoa hồng đã có trang riêng." />
  </div>
);
