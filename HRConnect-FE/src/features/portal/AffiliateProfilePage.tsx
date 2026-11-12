/**
 * @file AffiliateProfilePage.tsx
 * @description Affiliate profile and payout bank account, side by side (mockup 03/11). Changing the
 * password stays in the account menu of the shell.
 */
import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Select, Skeleton } from 'antd';
import {
  affiliateApi,
  UpdateAffiliateBankAccountInput,
  UpdateAffiliateProfileInput,
} from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { AvatarUpload } from '@/components/common/AvatarUpload';

const VIETNAM_BANKS = [
  { label: 'Vietcombank (Ngoại thương Việt Nam)', value: 'Vietcombank' },
  { label: 'Techcombank (Kỹ thương Việt Nam)', value: 'Techcombank' },
  { label: 'MB Bank (Quân đội)', value: 'MB Bank' },
  { label: 'ACB (Á Châu)', value: 'ACB' },
  { label: 'VPBank (Việt Nam Thịnh Vượng)', value: 'VPBank' },
  { label: 'BIDV (Đầu tư và Phát triển)', value: 'BIDV' },
  { label: 'VietinBank (Công thương Việt Nam)', value: 'VietinBank' },
  { label: 'TPBank (Tiên Phong)', value: 'TPBank' },
  { label: 'VIB (Quốc tế)', value: 'VIB' },
  { label: 'Sacombank (Sài Gòn Thương Tín)', value: 'Sacombank' },
  { label: 'HDBank (Phát triển TP.HCM)', value: 'HDBank' },
  { label: 'OCB (Phương Đông)', value: 'OCB' },
  { label: 'MSB (Hàng Hải)', value: 'MSB' },
  { label: 'SHB (Sài Gòn - Hà Nội)', value: 'SHB' },
];

const STATUS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đã được duyệt', className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' },
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-800 border border-amber-200/60' },
  REJECTED: { label: 'Chưa được duyệt', className: 'bg-rose-50 text-rose-800 border border-rose-200/60' },
  SUSPENDED: { label: 'Bị khóa', className: 'bg-slate-100 text-slate-700 border border-slate-200/60' },
};

/** The red star goes after the label, as in the mockup. */
const requiredAfterLabel = (label: React.ReactNode, { required }: { required: boolean }) => (
  <>
    {label}
    {required && <span className="ml-1 text-red-700">*</span>}
  </>
);

export const AffiliateProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['aff-profile-detail'], queryFn: () => affiliateApi.profile() });
  const bankQuery = useQuery({ queryKey: ['aff-bank-account'], queryFn: () => affiliateApi.getBankAccount() });
  const [profileForm] = Form.useForm<UpdateAffiliateProfileInput>();
  const [bankForm] = Form.useForm<UpdateAffiliateBankAccountInput>();

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

  useEffect(() => {
    const b = bankQuery.data;
    if (b) {
      bankForm.setFieldsValue({
        bankName: b.bankName ?? '',
        bankAccountNumber: b.bankAccountNumber ?? '',
        bankAccountHolder: b.bankAccountHolder ?? '',
        bankBranch: b.bankBranch ?? '',
      });
    }
  }, [bankQuery.data, bankForm]);

  const updateProfile = useMutation({
    mutationFn: (values: UpdateAffiliateProfileInput) => affiliateApi.updateProfile(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Đã lưu hồ sơ.');
      queryClient.invalidateQueries({ queryKey: ['aff-profile-detail'] });
      queryClient.invalidateQueries({ queryKey: ['aff-profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không lưu được hồ sơ.')),
  });

  const updateBank = useMutation({
    mutationFn: (values: UpdateAffiliateBankAccountInput) => affiliateApi.updateBankAccount(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Đã lưu tài khoản ngân hàng.');
      queryClient.invalidateQueries({ queryKey: ['aff-bank-account'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không lưu được tài khoản ngân hàng.')),
  });

  const p = profileQuery.data;
  const status = STATUS[p?.status ?? ''] ?? { label: 'Đang cập nhật', className: 'bg-gray-100 text-gray-700' };

  return (
    <div>
      <h1 className="sr-only">Hồ sơ và ngân hàng</h1>
      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="aff-profile-form" className="min-w-0 flex-[1_1_440px] rounded-lg border border-solid border-gray-200 bg-white p-5">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 id="aff-profile-form" className="m-0 text-[15px] font-bold text-gray-900">Hồ sơ Affiliate</h2>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
          </div>
          {profileQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : profileQuery.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(profileQuery.error)} action={<Button onClick={() => profileQuery.refetch()}>Thử lại</Button>} />
          ) : (
            <>
              <AvatarUpload size={64} className="affiliate-avatar mb-4" />
              <Form form={profileForm} layout="vertical" requiredMark={requiredAfterLabel} onFinish={(v) => updateProfile.mutate(v)} disabled={updateProfile.isPending}>
                <Form.Item name="displayName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }]}>
                  <Input size="large" />
                </Form.Item>
                <div className="grid gap-x-3.5 sm:grid-cols-2">
                  <Form.Item label="Email">
                    <Input size="large" value={p?.email} disabled />
                  </Form.Item>
                  <Form.Item name="phone" label="Số điện thoại" rules={[{ pattern: /^[0-9+-\s]{8,15}$/, message: 'Số điện thoại không hợp lệ.' }]}>
                    <Input size="large" type="tel" />
                  </Form.Item>
                  <Form.Item name="contactPerson" label="Người liên hệ chính">
                    <Input size="large" />
                  </Form.Item>
                  <Form.Item name="taxInformation" label="Mã số thuế (không bắt buộc)">
                    <Input size="large" />
                  </Form.Item>
                </div>
                <Form.Item name="address" label="Địa chỉ liên lạc">
                  <Input size="large" />
                </Form.Item>
                <div className="flex justify-end">
                  <Button type="primary" size="large" htmlType="submit" loading={updateProfile.isPending} className="!bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] !border-0 text-white font-semibold shadow-md shadow-sky-500/20">Lưu hồ sơ</Button>
                </div>
              </Form>
            </>
          )}
        </section>

        <section aria-labelledby="aff-bank-form" className="min-w-0 flex-[1_1_380px] rounded-xl border border-solid border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 id="aff-bank-form" className="m-0 text-[15px] font-bold text-gray-900">Tài khoản nhận hoa hồng</h2>
          <p className="m-0 mb-3.5 mt-1 text-[13px] text-gray-600">Hoa hồng được chuyển vào tài khoản này. Tài khoản phải thuộc tên của bạn hoặc đơn vị đã đăng ký với HR Connect.</p>
          {bankQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <Form form={bankForm} layout="vertical" requiredMark={requiredAfterLabel} onFinish={(v) => updateBank.mutate(v)} disabled={updateBank.isPending}>
              <Form.Item name="bankName" label="Ngân hàng" rules={[{ required: true, message: 'Chọn ngân hàng.' }]}>
                <Select
                  size="large"
                  showSearch
                  allowClear
                  placeholder="Chọn ngân hàng"
                  options={VIETNAM_BANKS}
                  labelRender={({ value }) => value}
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
              <Form.Item
                name="bankAccountNumber"
                label="Số tài khoản"
                rules={[{ required: true, message: 'Nhập số tài khoản.' }, { pattern: /^[0-9A-Za-z-]{6,25}$/, message: 'Số tài khoản không hợp lệ.' }]}
              >
                <Input size="large" inputMode="numeric" />
              </Form.Item>
              <Form.Item name="bankAccountHolder" label="Tên chủ tài khoản" rules={[{ required: true, message: 'Nhập tên chủ tài khoản.' }]}>
                <Input size="large" placeholder="IN HOA KHÔNG DẤU" onChange={(e) => bankForm.setFieldsValue({ bankAccountHolder: e.target.value.toUpperCase() })} />
              </Form.Item>
              <Form.Item name="bankBranch" label="Chi nhánh">
                <Input size="large" />
              </Form.Item>
              <p className="m-0 mb-3.5 rounded-lg border border-solid border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-[13px] text-amber-900">Đổi tài khoản khi đang có khoản chờ chi: khoản đó sẽ chuyển vào tài khoản mới.</p>
              <Button type="primary" size="large" block htmlType="submit" loading={updateBank.isPending} className="affiliate-cta">Lưu tài khoản</Button>
            </Form>
          )}
        </section>
      </div>
    </div>
  );
};

export default AffiliateProfilePage;
