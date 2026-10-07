/**
 * @file HrProfileAndPlaceholders.tsx
 * @description Internal HR profile (GET/PUT /internal/profile/me) and the MF-04/MF-05 steps that
 * have no backend yet (placement reconciliation, warranty & probation): explicit empty states.
 */
import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { hrProfileApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { NoApiYet } from '@/features/admin-console/adminTheme';
import { Initials, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';

type ProfileForm = { displayName: string; phone?: string; department?: string; jobTitle?: string };

export const HrProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ProfileForm>();
  const profile = useQuery({ queryKey: ['hr-profile'], queryFn: () => hrProfileApi.get() });

  useEffect(() => {
    if (profile.data)
      form.setFieldsValue({
        displayName: profile.data.displayName ?? '',
        phone: profile.data.phone ?? '',
        department: profile.data.department ?? '',
        jobTitle: profile.data.jobTitle ?? '',
      });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: (v: ProfileForm) =>
      hrProfileApi.update({
        displayName: v.displayName.trim(),
        phone: v.phone?.trim() || null,
        department: v.department?.trim() || null,
        jobTitle: v.jobTitle?.trim() || null,
      }),
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu hồ sơ.');
      queryClient.invalidateQueries({ queryKey: ['hr-profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const p = profile.data;
  const rows: [string, React.ReactNode][] = p
    ? [
        ['Email', p.email],
        ['Mã nhân viên', p.employeeCode ?? '—'],
        ['Phòng ban', p.department || '—'],
        ['Cập nhật', dayjs(p.updatedAt).format('HH:mm DD/MM/YYYY')],
      ]
    : [];

  return (
    <div>
      <PageHero eyebrow="Tài khoản" title="Hồ sơ của tôi" description="Tên và chức danh hiển thị trong lịch sử hồ sơ khi bạn sàng lọc." />
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
              <Initials name={p.displayName || p.email} size={72} />
              <div className="mt-3 text-lg font-bold text-slate-900">{p.displayName}</div>
              <div className="text-sm text-slate-600">{p.jobTitle || 'Chuyên viên Internal HR'}</div>
              <div className="mt-3">
                <StatusDot tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status === 'ACTIVE' ? 'Đang hoạt động' : p.status}</StatusDot>
              </div>
            </div>
            <div className="mt-5">
              {rows.map(([label, value]) => (
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
            <Form form={form} layout="vertical" requiredMark={false} validateTrigger="onBlur" onFinish={(v) => save.mutate(v)}>
              <Form.Item
                name="displayName"
                label="Họ và tên"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập họ và tên.' },
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
              <Form.Item name="department" label="Phòng ban" rules={[{ max: 120, message: 'Tối đa 120 ký tự.' }]}>
                <Input size="large" />
              </Form.Item>
              <div className="flex justify-end">
                <Button type="primary" size="large" htmlType="submit" loading={save.isPending}>
                  Lưu thay đổi
                </Button>
              </div>
            </Form>
          </Surface>
        </div>
      )}
    </div>
  );
};

export const HrPlacementReviewPlaceholder: React.FC = () => (
  <div>
    <PageHero
      eyebrow="Chưa có API"
      title="Đối soát nhận việc"
      description="Xác minh ứng viên thực sự đi làm trước khi tính phí job Headhunt, và kiểm tra hồ sơ bị đánh dấu không nhận việc."
    />
    <NoApiYet feature="Đối soát nhận việc" detail="Tài liệu MF-04 ghi bước này [CHƯA CÓ CODE]; backend chưa có endpoint." />
  </div>
);

export const HrWarrantyPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Chưa có API" title="Bảo hành & thử việc" description="Theo dõi các mốc 15, 30, 60 ngày và xác minh khi ứng viên nghỉ việc trong thời hạn bảo hành." />
    <NoApiYet feature="Bảo hành & thử việc" detail="Thuộc MF-05; quyền probation.manage / warranty.manage đã có, nhưng chưa có endpoint." />
  </div>
);
