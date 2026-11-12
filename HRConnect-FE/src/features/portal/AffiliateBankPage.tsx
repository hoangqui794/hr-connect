/**
 * @file AffiliateBankPage.tsx
 * @description Payout Bank Account Hub for Affiliates.
 * Features:
 *  - Real-time interactive 3D Virtual Bank Card preview
 *  - Ergonomic payout bank form with live card sync
 *  - Security & compliance assurance guarantee notes
 *  - Smooth sub-navigation linking profile and payout settings
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Select, Skeleton } from 'antd';
import {
  BankOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CreditCardOutlined,
  InfoCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { affiliateApi, UpdateAffiliateBankAccountInput } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

export const VIETNAM_BANKS = [
  { label: 'Vietcombank (Ngoại thương Việt Nam)', value: 'Vietcombank', code: 'VCB' },
  { label: 'Techcombank (Kỹ thương Việt Nam)', value: 'Techcombank', code: 'TCB' },
  { label: 'MB Bank (Quân đội)', value: 'MB Bank', code: 'MB' },
  { label: 'ACB (Á Châu)', value: 'ACB', code: 'ACB' },
  { label: 'VPBank (Việt Nam Thịnh Vượng)', value: 'VPBank', code: 'VPB' },
  { label: 'BIDV (Đầu tư và Phát triển)', value: 'BIDV', code: 'BIDV' },
  { label: 'VietinBank (Công thương Việt Nam)', value: 'VietinBank', code: 'CTG' },
  { label: 'TPBank (Tiên Phong)', value: 'TPBank', code: 'TPB' },
  { label: 'VIB (Quốc tế)', value: 'VIB', code: 'VIB' },
  { label: 'Sacombank (Sài Gòn Thương Tín)', value: 'Sacombank', code: 'STB' },
  { label: 'HDBank (Phát triển TP.HCM)', value: 'HDBank', code: 'HDB' },
  { label: 'OCB (Phương Đông)', value: 'OCB', code: 'OCB' },
  { label: 'MSB (Hàng Hải)', value: 'MSB', code: 'MSB' },
  { label: 'SHB (Sài Gòn - Hà Nội)', value: 'SHB', code: 'SHB' },
  { label: 'SeABank (Đông Nam Á)', value: 'SeABank', code: 'SSB' },
];

/** Required label with consistent red asterisk */
const requiredAfterLabel = (label: React.ReactNode, { required }: { required: boolean }) => (
  <>
    {label}
    {required && <span className="ml-1 text-red-600">*</span>}
  </>
);

/** Format bank account number into clean grouped chunks */
const formatCardNumber = (num?: string) => {
  if (!num) return '•••• •••• •••• ••••';
  const clean = num.replace(/\s+/g, '');
  return clean.replace(/(\d{4})/g, '$1 ').trim();
};

export const AffiliateBankPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const bankQuery = useQuery({
    queryKey: ['aff-bank-account'],
    queryFn: () => affiliateApi.getBankAccount(),
  });
  const [bankForm] = Form.useForm<UpdateAffiliateBankAccountInput>();

  // Watch form values for real-time card preview
  const watchedBankName = Form.useWatch('bankName', bankForm);
  const watchedAccountNo = Form.useWatch('bankAccountNumber', bankForm);
  const watchedHolder = Form.useWatch('bankAccountHolder', bankForm);
  const watchedBranch = Form.useWatch('bankBranch', bankForm);

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

  const updateBank = useMutation({
    mutationFn: (values: UpdateAffiliateBankAccountInput) => affiliateApi.updateBankAccount(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Đã lưu tài khoản ngân hàng thành công.');
      queryClient.invalidateQueries({ queryKey: ['aff-bank-account'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không lưu được tài khoản ngân hàng.')),
  });

  const selectedBank = VIETNAM_BANKS.find((b) => b.value === watchedBankName);
  const bankDisplayName = selectedBank ? selectedBank.value : (watchedBankName || 'NGÂN HÀNG');
  const accountHolderDisplay = (watchedHolder || bankQuery.data?.bankAccountHolder || 'HỌ VÀ TÊN CHỦ TÀI KHOẢN').toUpperCase();
  const accountNumberDisplay = formatCardNumber(watchedAccountNo || bankQuery.data?.bankAccountNumber || undefined);
  const branchDisplay = watchedBranch || bankQuery.data?.bankBranch || '';

  return (
    <div className={`${FONT} max-w-6xl space-y-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Sub-navigation Header Tabs ───────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-0 border-b border-solid border-slate-200/80 pb-4">
        <div>
          <h1 className="m-0 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Tài khoản ngân hàng
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Quản lý tài khoản thụ hưởng để nhận thanh toán hoa hồng tuyển dụng tự động.
          </p>
        </div>

        {/* Tab switch pills */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-2xs">
          <button
            type="button"
            onClick={() => navigate('/affiliate/profile')}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:text-slate-900 border-0 bg-transparent cursor-pointer"
          >
            <UserOutlined />
            <span>Hồ sơ cá nhân</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#0284C7] shadow-xs border-0 cursor-default"
          >
            <BankOutlined />
            <span>Tài khoản nhận tiền</span>
          </button>
        </div>
      </div>

      {bankQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được thông tin tài khoản ngân hàng"
          description={getApiErrorMessage(bankQuery.error)}
          action={<Button onClick={() => bankQuery.refetch()}>Thử lại</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
          {/* ── Left Column: Virtual Bank Card & Security Info (5 cols) ── */}
          <div className="space-y-5 lg:col-span-5">
            {/* Virtual Bank Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B192C] via-[#034C75] to-[#0284C7] p-6 text-white shadow-xl shadow-sky-950/20 aspect-[1.586/1] flex flex-col justify-between border border-white/20 select-none">
              {/* Card glossy subtle wave background */}
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />

              {/* Top Row: Bank Name and EMV Chip */}
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-sky-200">
                    Tài khoản thụ hưởng
                  </span>
                  <span className="block text-base font-black tracking-tight text-white mt-0.5">
                    {bankDisplayName}
                  </span>
                </div>

                {/* Metallic Gold EMV Chip */}
                <div className="h-8 w-11 rounded-md bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 p-1 shadow-inner border border-amber-300/80 flex flex-col justify-between">
                  <div className="h-1.5 w-full rounded-xs bg-amber-600/30" />
                  <div className="h-1.5 w-full rounded-xs bg-amber-600/30" />
                </div>
              </div>

              {/* Middle Row: Bank Account Number */}
              <div className="relative z-10 my-auto py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">
                  Số tài khoản
                </span>
                <span className="block text-xl sm:text-[22px] font-mono font-bold tracking-wider text-white tabular-nums drop-shadow-sm">
                  {accountNumberDisplay}
                </span>
              </div>

              {/* Bottom Row: Account Holder Name & Active Status */}
              <div className="relative z-10 flex items-end justify-between border-0 border-t border-solid border-white/15 pt-3">
                <div className="min-w-0 flex-1 pr-2">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-200/80">
                    Chủ tài khoản
                  </span>
                  <span className="block truncate text-sm font-extrabold tracking-wide text-white">
                    {accountHolderDisplay}
                  </span>
                  {branchDisplay && (
                    <span className="block truncate text-[11px] text-sky-200/70 font-medium mt-0.5">
                      Chi nhánh: {branchDisplay}
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2.5 py-1 text-[11px] font-bold text-emerald-200 border border-emerald-300/40 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    <span>Nhận tiền</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Security Guarantee & Notice Box */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <SafetyCertificateOutlined className="text-emerald-600 text-base" />
                <span>Quy định thanh toán hoa hồng</span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-[#0284C7] mt-0.5 font-bold">✓</span>
                  <span>
                    <b>Tự động chi trả:</b> Hoa hồng được tự động quyết toán và chuyển khoản trực tiếp vào tài khoản này sau 30 ngày bảo hành ứng viên.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#0284C7] mt-0.5 font-bold">✓</span>
                  <span>
                    <b>Đồng bộ khoản chờ chi:</b> Nếu bạn đổi tài khoản khi đang có khoản hoa hồng chờ chi, khoản tiền đó sẽ tự động chuyển vào tài khoản mới.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#0284C7] mt-0.5 font-bold">✓</span>
                  <span>
                    <b>Bảo mật thông tin:</b> Tên chủ tài khoản phải thuộc họ tên của bạn hoặc pháp nhân đã đăng ký trên hệ thống HR Connect.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Bank Setup Form (7 cols) ──────────────── */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
              <div className="mb-5 flex items-center justify-between pb-3 border-0 border-b border-solid border-slate-100">
                <div>
                  <h2 className="m-0 text-base font-bold text-slate-900">
                    Cập nhật thông tin ngân hàng
                  </h2>
                  <p className="m-0 mt-0.5 text-xs text-slate-500">
                    Vui lòng nhập chính xác số tài khoản và tên chủ tài khoản để tránh gián đoạn nhận hoa hồng.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#0284C7] text-base">
                  <CreditCardOutlined />
                </span>
              </div>

              {bankQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <Form
                  form={bankForm}
                  layout="vertical"
                  requiredMark={requiredAfterLabel}
                  onFinish={(v) => updateBank.mutate(v)}
                  disabled={updateBank.isPending}
                  className="space-y-4"
                >
                  <Form.Item
                    name="bankName"
                    label={<span className="text-xs font-bold text-slate-700">Ngân hàng thụ hưởng</span>}
                    rules={[{ required: true, message: 'Vui lòng chọn ngân hàng thụ hưởng.' }]}
                  >
                    <Select
                      size="large"
                      showSearch
                      allowClear
                      placeholder="Chọn ngân hàng của bạn"
                      options={VIETNAM_BANKS}
                      labelRender={({ value }) => value}
                      filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      className="!w-full"
                    />
                  </Form.Item>

                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    <Form.Item
                      name="bankAccountNumber"
                      label={<span className="text-xs font-bold text-slate-700">Số tài khoản</span>}
                      rules={[
                        { required: true, message: 'Vui lòng nhập số tài khoản.' },
                        { pattern: /^[0-9A-Za-z-]{6,25}$/, message: 'Số tài khoản phải từ 6 đến 25 ký tự hợp lệ.' },
                      ]}
                    >
                      <Input
                        size="large"
                        inputMode="numeric"
                        placeholder="Ví dụ: 1030501093"
                        className="font-mono"
                      />
                    </Form.Item>

                    <Form.Item
                      name="bankAccountHolder"
                      label={<span className="text-xs font-bold text-slate-700">Tên chủ tài khoản</span>}
                      rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản.' }]}
                    >
                      <Input
                        size="large"
                        placeholder="IN HOA KHÔNG DẤU (Ví dụ: NGUYEN VAN A)"
                        onChange={(e) => bankForm.setFieldsValue({ bankAccountHolder: e.target.value.toUpperCase() })}
                        className="font-semibold uppercase"
                      />
                    </Form.Item>
                  </div>

                  <Form.Item
                    name="bankBranch"
                    label={<span className="text-xs font-bold text-slate-700">Chi nhánh ngân hàng (Không bắt buộc)</span>}
                  >
                    <Input
                      size="large"
                      placeholder="Ví dụ: Chi nhánh TP. Hồ Chí Minh"
                    />
                  </Form.Item>

                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                    <InfoCircleOutlined className="text-amber-600 mt-0.5 text-sm shrink-0" />
                    <span>
                      <b>Lưu ý quan trọng:</b> Hãy kiểm tra kỹ tên chủ tài khoản và số tài khoản. Mọi sai sót có thể dẫn đến việc giao dịch chuyển khoản hoa hồng bị ngân hàng từ chối.
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      loading={updateBank.isPending}
                      icon={<CheckCircleOutlined />}
                      className="!h-11 !rounded-xl !border-0 !bg-[#0284C7] hover:!bg-[#0369A1] px-6 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-all active:scale-[0.98]"
                    >
                      Lưu tài khoản nhận hoa hồng
                    </Button>
                  </div>
                </Form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateBankPage;
