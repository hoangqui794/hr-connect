/**
 * @file ClientProfilePage.tsx
 * @description Personal profile management page for Client Company users.
 * Allows viewing/updating display name, phone, role in company, and avatar.
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Skeleton, Tooltip } from 'antd';
import {
  BankOutlined,
  CheckCircleFilled,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { userApi, type UpdateUserProfileInput } from '@/services/api/userApi';
import { companyProfileApi } from '@/services/api/hrApi';
import { authService } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { Surface } from '@/features/admin-console/ui';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

interface ProfileFormValues {
  displayName: string;
  phone?: string;
  roleInCompany?: string;
}

export const ClientProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { updateUser, syncCurrentUser } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [form] = Form.useForm<ProfileFormValues>();

  // Fetch current user details via GET /api/v1/auth/me
  const currentUserQuery = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: () => authService.getCurrentUser(),
  });

  // Fetch company info via GET /api/v1/companies/profile/me
  const companyQuery = useQuery({
    queryKey: ['client-company-profile'],
    queryFn: () => companyProfileApi.get(),
  });

  const userData = currentUserQuery.data?.data;
  const companyData = companyQuery.data;

  // Initialize form fields when data loads
  useEffect(() => {
    if (userData) {
      form.setFieldsValue({
        displayName: userData.displayName ?? '',
        phone: userData.phone ?? '',
        roleInCompany: typeof companyData?.roleInCompany === 'string' ? companyData.roleInCompany : '',
      });
    }
  }, [userData, companyData, form]);

  // Mutation to update profile via PUT /api/v1/users/me
  const saveMutation = useMutation({
    mutationFn: (values: UpdateUserProfileInput) => userApi.updateProfile(values),
    onSuccess: async (res) => {
      message.success(res.message || 'Đã cập nhật hồ sơ cá nhân thành công.');
      // Update local zustand auth store
      updateUser({
        name: res.data.displayName,
        phone: res.data.phone ?? undefined,
      });
      // Invalidate queries to refresh server state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['current-user-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['client-company-profile'] }),
        syncCurrentUser(),
      ]);
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err, 'Không thể cập nhật hồ sơ cá nhân.'));
    },
  });

  const handleSubmit = (values: ProfileFormValues) => {
    saveMutation.mutate({
      displayName: values.displayName.trim(),
      phone: values.phone?.trim() || null,
      roleInCompany: values.roleInCompany?.trim() || null,
    });
  };

  const isLoading = currentUserQuery.isLoading || companyQuery.isLoading;

  return (
    <div className={`${FONT} space-y-6 max-w-6xl mx-auto pb-12 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── 1. Compact header: the top bar already shows the page title ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <h1 className="sr-only">
            Hồ sơ cá nhân
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            icon={<BankOutlined />}
            onClick={() => navigate('/client/company')}
            className="!h-10 !rounded-xl font-semibold border-slate-200 text-slate-700 hover:!border-slate-300"
          >
            Hồ sơ doanh nghiệp
          </Button>
          <Button
            icon={<KeyOutlined />}
            onClick={() => setShowPasswordModal(true)}
            className="!h-10 !rounded-xl font-semibold border-slate-200 text-slate-700 hover:!border-slate-300"
          >
            Đổi mật khẩu
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Surface className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        </Surface>
      ) : currentUserQuery.isError || !userData ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải thông tin hồ sơ"
          description={getApiErrorMessage(currentUserQuery.error, 'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
          {/* ── Left Column: Identity Overview Card ── */}
          <Surface className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex flex-col items-center text-center">
              <AvatarUpload size={88} />
              <h2 className="mt-3.5 text-lg font-bold text-slate-900 leading-snug">
                {userData.displayName || 'Người đại diện'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-[#0C4A6E] border border-sky-200/80">
                  {typeof companyData?.roleInCompany === 'string' && companyData.roleInCompany
                    ? companyData.roleInCompany
                    : 'Đại diện tuyển dụng'}
                </span>
                {Boolean(companyData?.isPrimaryContact) && (
                  <Tooltip title="Người liên hệ chính của doanh nghiệp">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                      ★ Liên hệ chính
                    </span>
                  </Tooltip>
                )}
              </div>

              <div className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang hoạt động
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Email:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={userData.email ?? ''}>
                  {userData.email}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Xác thực email:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircleFilled className="text-xs" /> Đã xác thực
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Điện thoại:</span>
                <span className="font-semibold text-slate-900">
                  {userData.phone || 'Chưa cập nhật'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Công ty:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[190px]" title={companyData?.companyName ?? ''}>
                  {companyData?.companyName || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Vai trò hệ thống:</span>
                <span className="font-semibold text-slate-900">Doanh nghiệp (Client)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Button
                type="dashed"
                block
                icon={<KeyOutlined />}
                onClick={() => setShowPasswordModal(true)}
                className="!rounded-xl font-semibold !h-10 text-slate-700 hover:!text-[#0C4A6E] hover:!border-[#0C4A6E]"
              >
                Đổi mật khẩu tài khoản
              </Button>
            </div>
          </Surface>

          {/* ── Right Column: Edit Form & Security Panel ── */}
          <div className="space-y-6">
            {/* Card Form */}
            <Surface className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Thông tin tài khoản</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cập nhật các thông tin cá nhân hiển thị trong hệ thống và giao tiếp với ứng viên.
                </p>
              </div>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                requiredMark="optional"
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Form.Item
                    name="displayName"
                    label={<span className="text-xs font-bold text-slate-800">Họ và tên đại diện</span>}
                    rules={[
                      { required: true, message: 'Vui lòng nhập họ và tên' },
                      { min: 2, message: 'Họ và tên tối thiểu 2 ký tự' },
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined className="text-slate-400" />}
                      placeholder="Nguyễn Văn A"
                      className="!h-10 !rounded-xl"
                    />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label={<span className="text-xs font-bold text-slate-800">Số điện thoại liên hệ</span>}
                    rules={[
                      {
                        pattern: /^(0|\+84)[3|5|7|8|9][0-9]{8}$/,
                        message: 'Số điện thoại không đúng định dạng',
                      },
                    ]}
                  >
                    <Input
                      prefix={<PhoneOutlined className="text-slate-400" />}
                      placeholder="0912 345 678"
                      className="!h-10 !rounded-xl"
                    />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Form.Item
                    name="roleInCompany"
                    label={<span className="text-xs font-bold text-slate-800">Chức vụ tại doanh nghiệp</span>}
                  >
                    <Input
                      prefix={<IdcardOutlined className="text-slate-400" />}
                      placeholder="Ví dụ: Trưởng phòng Tuyển dụng / HR Manager"
                      className="!h-10 !rounded-xl"
                    />
                  </Form.Item>

                  <div>
                    <label htmlFor="client-profile-email" className="block text-xs font-bold text-slate-800 mb-2">
                      Địa chỉ email đăng nhập
                    </label>
                    <Input
                      id="client-profile-email"
                      prefix={<MailOutlined className="text-slate-400" />}
                      value={userData.email ?? ''}
                      disabled
                      suffix={
                        <Tooltip title="Email định danh bảo mật, không thể thay đổi trực tiếp">
                          <LockOutlined className="text-slate-400" />
                        </Tooltip>
                      }
                      className="!h-10 !rounded-xl !bg-slate-50 !text-slate-600"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-[#0C4A6E]">
                      <BankOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Doanh nghiệp trực thuộc</div>
                      <div className="text-sm font-bold text-slate-900 line-clamp-1">
                        {companyData?.companyName || 'Chưa liên kết công ty'}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate('/client/company')}
                    className="!rounded-xl font-semibold !h-9 text-xs border-slate-200"
                  >
                    Xem hồ sơ công ty
                  </Button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    onClick={() => form.resetFields()}
                    disabled={saveMutation.isPending}
                    className="!h-10 !rounded-xl font-semibold border-slate-200 text-slate-700"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saveMutation.isPending}
                    icon={<SaveOutlined />}
                    className="!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-2xs font-bold !h-10 px-5 transition-all active:scale-[0.98]"
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </Form>
            </Surface>

            {/* Security Info Card */}
            <Surface className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0C4A6E] flex items-center justify-center shrink-0">
                    <KeyOutlined className="text-lg" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Mật khẩu & Bảo mật</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nên đổi mật khẩu định kỳ 6 tháng một lần để bảo vệ tài khoản doanh nghiệp.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowPasswordModal(true)}
                  className="!rounded-xl font-semibold !h-9 text-xs border-slate-200 hover:!border-slate-300 shrink-0"
                >
                  Đổi mật khẩu
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {/* Password Modal */}
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default ClientProfilePage;
