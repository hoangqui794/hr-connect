/**
 * @file AffiliateProfilePage.tsx
 * @description Affiliate personal profile management.
 * Payout bank settings have been dedicated to /affiliate/bank-account for optimal UX.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Skeleton } from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  affiliateApi,
  UpdateAffiliateProfileInput,
} from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { AvatarUpload } from '@/components/common/AvatarUpload';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const STATUS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đã được duyệt', className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' },
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-800 border border-amber-200/60' },
  REJECTED: { label: 'Chưa được duyệt', className: 'bg-rose-50 text-rose-800 border border-rose-200/60' },
  SUSPENDED: { label: 'Bị khóa', className: 'bg-slate-100 text-slate-700 border border-slate-200/60' },
};

/** Consistent required label styling */
const requiredAfterLabel = (label: React.ReactNode, { required }: { required: boolean }) => (
  <>
    {label}
    {required && <span className="ml-1 text-red-600">*</span>}
  </>
);

export const AffiliateProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['aff-profile-detail'],
    queryFn: () => affiliateApi.profile(),
  });
  const [profileForm] = Form.useForm<UpdateAffiliateProfileInput>();

  useEffect(() => {
    const p = profileQuery.data;
    if (p) {
      profileForm.setFieldsValue({
        displayName: p.displayName ?? '',
        contactPerson: p.contactPerson ?? '',
        phone: p.phone ?? '',
        address: p.address ?? '',
        taxInformation: p.taxInformation ?? '',
      });
    }
  }, [profileQuery.data, profileForm]);

  const updateProfile = useMutation({
    mutationFn: (values: UpdateAffiliateProfileInput) => affiliateApi.updateProfile(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Đã lưu hồ sơ thành công.');
      queryClient.invalidateQueries({ queryKey: ['aff-profile-detail'] });
      queryClient.invalidateQueries({ queryKey: ['aff-profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không lưu được hồ sơ.')),
  });

  const p = profileQuery.data;
  const status = STATUS[p?.status ?? ''] ?? { label: 'Đang cập nhật', className: 'bg-slate-100 text-slate-700' };

  return (
    <div className={`${FONT} max-w-5xl space-y-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Sub-navigation Header Tabs ───────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-0 border-b border-solid border-slate-200/80 pb-4">
        <div>
          <h1 className="m-0 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Hồ sơ cá nhân
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Thông tin định danh và liên hệ của bạn trên mạng lưới đối tác HR Connect.
          </p>
        </div>

        {/* Tab switch pills */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-2xs">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#0284C7] shadow-xs border-0 cursor-default"
          >
            <UserOutlined />
            <span>Hồ sơ cá nhân</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/affiliate/bank-account')}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:text-slate-900 border-0 bg-transparent cursor-pointer"
          >
            <BankOutlined />
            <span>Tài khoản nhận tiền</span>
          </button>
        </div>
      </div>

      {profileQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được hồ sơ"
          description={getApiErrorMessage(profileQuery.error)}
          action={<Button onClick={() => profileQuery.refetch()}>Thử lại</Button>}
        />
      ) : profileQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <Skeleton active avatar paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-6">
          {/* Header Status & Avatar Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-0 border-b border-solid border-slate-100">
            <div className="flex items-center gap-4">
              <AvatarUpload size={72} className="affiliate-avatar shrink-0 shadow-sm" />
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="m-0 text-lg font-bold text-slate-900">
                    {p?.displayName || 'Đối tác Affiliate'}
                  </h2>
                  <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  {p?.email} · Mã đối tác: <span className="font-mono font-medium text-slate-700">{p?.affiliateId?.slice(0, 8)}...</span>
                </p>
              </div>
            </div>

            <Button
              type="default"
              icon={<BankOutlined className="text-[#0284C7]" />}
              onClick={() => navigate('/affiliate/bank-account')}
              className="!h-10 !rounded-xl !border-slate-200 text-xs font-semibold text-slate-700 hover:!border-[#0284C7] hover:!text-[#0284C7]"
            >
              Cài đặt tài khoản nhận hoa hồng →
            </Button>
          </div>

          {/* Form Content */}
          <Form
            form={profileForm}
            layout="vertical"
            requiredMark={requiredAfterLabel}
            onFinish={(v) => updateProfile.mutate(v)}
            disabled={updateProfile.isPending}
            className="space-y-5"
          >
            <div>
              <h3 className="m-0 mb-3 text-sm font-bold text-slate-900 uppercase tracking-wider text-xs text-[#0284C7]">
                1. Thông tin định danh cơ bản
              </h3>
              <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                <Form.Item
                  name="displayName"
                  label={<span className="text-xs font-bold text-slate-700">Họ và tên / Tên tổ chức</span>}
                  rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ và tên.' }]}
                >
                  <Input size="large" placeholder="Ví dụ: Nguyễn Văn A" />
                </Form.Item>

                <Form.Item label={<span className="text-xs font-bold text-slate-700">Email đăng nhập (Cố định)</span>}>
                  <Input
                    size="large"
                    value={p?.email}
                    disabled
                    prefix={<MailOutlined className="text-slate-400" />}
                    className="bg-slate-50 text-slate-500"
                  />
                </Form.Item>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="m-0 mb-3 text-sm font-bold text-slate-900 uppercase tracking-wider text-xs text-[#0284C7]">
                2. Thông tin liên lạc & Người phụ trách
              </h3>
              <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-3">
                <Form.Item
                  name="phone"
                  label={<span className="text-xs font-bold text-slate-700">Số điện thoại</span>}
                  rules={[{ pattern: /^[0-9+-\s]{8,15}$/, message: 'Số điện thoại không hợp lệ.' }]}
                >
                  <Input
                    size="large"
                    type="tel"
                    placeholder="Ví dụ: 0912345678"
                    prefix={<PhoneOutlined className="text-slate-400" />}
                  />
                </Form.Item>

                <Form.Item
                  name="contactPerson"
                  label={<span className="text-xs font-bold text-slate-700">Người liên hệ chính</span>}
                >
                  <Input size="large" placeholder="Người đại diện / liên hệ" />
                </Form.Item>

                <Form.Item
                  name="taxInformation"
                  label={<span className="text-xs font-bold text-slate-700">Mã số thuế (Tùy chọn)</span>}
                >
                  <Input
                    size="large"
                    placeholder="Mã số thuế cá nhân / DN"
                    prefix={<IdcardOutlined className="text-slate-400" />}
                  />
                </Form.Item>
              </div>

              <Form.Item
                name="address"
                label={<span className="text-xs font-bold text-slate-700">Địa chỉ liên lạc</span>}
              >
                <Input size="large" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
              </Form.Item>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-0 border-t border-solid border-slate-100">
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={updateProfile.isPending}
                icon={<CheckCircleOutlined />}
                className="!h-11 !rounded-xl !border-0 !bg-[#0284C7] hover:!bg-[#0369A1] px-7 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-all active:scale-[0.98]"
              >
                Lưu thay đổi hồ sơ
              </Button>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
};

export default AffiliateProfilePage;
