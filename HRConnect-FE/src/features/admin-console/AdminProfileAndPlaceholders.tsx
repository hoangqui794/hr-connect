/**
 * @file AdminProfileAndPlaceholders.tsx
 * @description Admin profile (GET/PUT /admin/profile/me) and the pages whose backend API
 * does not exist yet (disputes, payouts, settings) — those show an explicit empty state.
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Skeleton } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { apiClient, getApiErrorMessage } from '@/services/apiClient';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { NoApiYet, formatDateTime } from './adminTheme';
import { Initials, PageHero, StatusDot, Surface } from './ui';

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

  const p = profile.data;
  const infoRows: [string, React.ReactNode][] = p
    ? [
        ['Email', p.email ?? '—'],
        ['Mã nhân viên', p.employeeCode ?? '—'],
        ['Điện thoại', p.phone || '—'],
        ['Cập nhật', formatDateTime(p.updatedAt)],
      ]
    : [];

  return (
    <div>
      <PageHero eyebrow="Tài khoản" title="Hồ sơ quản trị viên" description="Thông tin hiển thị khi bạn duyệt hồ sơ và trong nhật ký hệ thống." />
      {profile.isLoading ? (
        <Surface padded>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Surface>
      ) : profile.isError || !p ? (
        <Alert type="error" showIcon message={getApiErrorMessage(profile.error, 'Không tải được hồ sơ.')} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <Surface padded className="self-start">
            <div className="flex flex-col items-center text-center">
              <AvatarUpload size={72} />
              <div className="mt-3 text-lg font-bold text-slate-900">{p.displayName || '—'}</div>
              <div className="text-sm text-slate-600">{p.jobTitle || 'Quản trị viên nền tảng'}</div>
              <div className="mt-3">
                <StatusDot tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status === 'ACTIVE' ? 'Đang hoạt động' : p.status}</StatusDot>
              </div>
              <Button
                type="default"
                icon={<KeyOutlined />}
                className="mt-4 !rounded-lg text-xs"
                onClick={() => setShowPasswordModal(true)}
              >
                Đổi mật khẩu
              </Button>
            </div>
            <div className="mt-5">
              {infoRows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-0 border-t border-solid border-slate-100 py-2.5 text-sm first:border-t-0">
                  <span className="text-slate-600">{label}</span>
                  <span className="min-w-0 truncate text-right font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </Surface>
          <Surface padded>
            <h2 className="m-0 text-base font-semibold text-slate-900">Chỉnh sửa thông tin</h2>
            <p className="mb-5 mt-1 text-sm text-slate-600">Email và mã nhân viên do hệ thống quản lý, không sửa ở đây.</p>
            <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} validateTrigger="onBlur" requiredMark={false}>
              <Form.Item
                name="displayName"
                label="Họ và tên"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập họ và tên.' },
                  { min: 2, message: 'Tối thiểu 2 ký tự.' },
                  { max: 180, message: 'Tối đa 180 ký tự.' },
                ]}
              >
                <Input size="large" />
              </Form.Item>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="phone" label="Điện thoại" rules={[{ pattern: /^[0-9+() \-.]{8,20}$/, message: 'Số điện thoại không đúng định dạng.' }]}>
                  <Input size="large" placeholder="Ví dụ 0901 234 567" />
                </Form.Item>
                <Form.Item name="jobTitle" label="Chức danh" rules={[{ max: 120, message: 'Tối đa 120 ký tự.' }]}>
                  <Input size="large" />
                </Form.Item>
              </div>
              <div className="flex justify-end">
                <Button type="primary" size="large" htmlType="submit" loading={save.isPending}>
                  Lưu thay đổi
                </Button>
              </div>
            </Form>
          </Surface>
        </div>
      )}

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export const AdminDisputesPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Chưa có API" title="Tranh chấp" description="Khiếu nại về ghi nhận nguồn ứng viên và hoa hồng." />
    <NoApiYet feature="Xử lý tranh chấp" detail="Quyền dispute.view / dispute.resolve đã có, nhưng chưa có endpoint." />
  </div>
);

export const AdminPayoutsPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Chưa có API" title="Chi trả hoa hồng" description="Duyệt và theo dõi các khoản hoa hồng trả cho Cộng tác viên." />
    <NoApiYet feature="Chi trả hoa hồng" detail="Thuộc MF-05; quyền payout.manage đã có, nhưng chưa có endpoint." />
  </div>
);

export const AdminSettingsPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Chưa có API" title="Cài đặt hệ thống" description="Tham số vận hành chung của nền tảng." />
    <NoApiYet feature="Cài đặt hệ thống" detail="Quyền system_config.manage đã có, nhưng chưa có endpoint. Loại dịch vụ và hoa hồng đã có trang riêng." />
  </div>
);
