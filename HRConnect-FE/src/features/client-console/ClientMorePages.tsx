/**
 * @file ClientMorePages.tsx
 * @description Client Company pages around the hiring flow:
 *  - ClientInterviewsOffersPage: interviews, offers and placements (MF-04); a row opens the
 *    ApplicationWorkbench, where the Client reschedules, records results, sends offers, etc.
 *  - ClientCompanyPage: company profile (GET/PUT /companies/profile/me).
 */
import React, { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Select, Skeleton } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { companyProfileApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { StatusDot, Surface } from '@/features/admin-console/ui';
import { CompanyLogo } from '@/components/common/CompanyLogo';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

export { ClientInterviewsOffersPage } from './ClientInterviewsOffersPage';
export { ClientProfilePage } from './ClientProfilePage';

// Same limit as the backend (R2Settings.MaxCompanyLogoFileSizeMb).
const MAX_LOGO_MB = 10;
const SIZES = ['1-10', '11-50', '50-100', '101-200', '201-500', '500+'].map((v) => ({ value: v, label: `${v} nhân viên` }));
type CompanyForm = { companyName: string; taxCode?: string; industry?: string; companySize?: string; website?: string; address?: string; description?: string };

export const ClientCompanyPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form] = Form.useForm<CompanyForm>();
  const company = useQuery({ queryKey: ['client-company'], queryFn: () => companyProfileApi.get() });

  useEffect(() => {
    const c = company.data;
    if (c)
      form.setFieldsValue({
        companyName: c.companyName,
        taxCode: c.taxCode ?? '',
        industry: c.industry ?? '',
        companySize: c.companySize ?? undefined,
        website: c.website ?? '',
        address: c.address ?? '',
        description: c.description ?? '',
      });
  }, [company.data, form]);

  const save = useMutation({
    mutationFn: (v: CompanyForm) =>
      companyProfileApi.update({
        companyName: v.companyName.trim(),
        taxCode: v.taxCode?.trim() || null,
        industry: v.industry?.trim() || null,
        companySize: v.companySize || null,
        website: v.website?.trim() || null,
        address: v.address?.trim() || null,
        description: v.description?.trim() || null,
      }),
    onSuccess: (res: any) => {
      message.success(res?.message || 'Đã lưu hồ sơ doanh nghiệp.');
      queryClient.invalidateQueries({ queryKey: ['client-company'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => companyProfileApi.uploadLogo(file),
    onSuccess: async (res) => {
      message.success(res?.message || 'Đã cập nhật logo doanh nghiệp.');
      await queryClient.invalidateQueries({ queryKey: ['client-company'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể tải logo lên.')),
  });

  const deleteLogo = useMutation({
    mutationFn: () => companyProfileApi.deleteLogo(),
    onSuccess: async (res) => {
      message.success(res?.message || 'Đã xóa logo doanh nghiệp.');
      await queryClient.invalidateQueries({ queryKey: ['client-company'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể xóa logo.')),
  });

  const selectLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Logo phải là ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      message.error(`Logo không được vượt quá ${MAX_LOGO_MB}MB.`);
      return;
    }
    uploadLogo.mutate(file);
  };

  const confirmDeleteLogo = () => modal.confirm({
    title: 'Xóa logo doanh nghiệp?',
    content: 'Logo sẽ được gỡ khỏi hồ sơ công ty và tất cả tin tuyển dụng đang hiển thị.',
    okText: 'Xóa logo',
    cancelText: 'Giữ lại',
    okButtonProps: { danger: true, loading: deleteLogo.isPending },
    onOk: () => deleteLogo.mutateAsync(),
  });

  const c = company.data;
  const verified = c?.verificationStatus === 'VERIFIED';
  const rejected = c?.verificationStatus === 'REJECTED';
  const underReview = c?.verificationStatus === 'UNDER_REVIEW';
  const verificationBadgeClass = verified
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
    : rejected
    ? 'bg-rose-50 text-rose-700 border-rose-200/80'
    : underReview
    ? 'bg-sky-50 text-sky-700 border-sky-200/80'
    : 'bg-amber-50 text-amber-700 border-amber-200/80';
  const verificationHeadline = verified
    ? '✓ Doanh nghiệp đã xác thực'
    : rejected
    ? '✕ Hồ sơ xác thực bị từ chối'
    : underReview
    ? 'Đang xét duyệt xác thực'
    : 'Đang chờ xác thực';
  const verificationTone = verified ? 'success' : rejected ? 'danger' : underReview ? 'info' : 'warning';
  const verificationShortLabel = verified
    ? 'Đã xác thực'
    : rejected
    ? 'Bị từ chối xác thực'
    : underReview
    ? 'Đang xét duyệt'
    : 'Chưa xác thực';

  return (
    <div className={`${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Compact header: the top bar already shows the page title ── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sr-only">
              Hồ sơ doanh nghiệp
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${verificationBadgeClass}`}>
              {verificationHeadline}
            </span>
          </div>
        </div>
      </div>
      {rejected && (
        <Alert
          type="error"
          showIcon
          className="mb-4 rounded-xl"
          message="Hồ sơ xác thực doanh nghiệp bị từ chối"
          description={
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-semibold">Lý do: </span>
                {c?.verificationRejectedReason || 'Thông tin xác thực doanh nghiệp chưa đáp ứng yêu cầu.'}
              </div>
              <div className="text-xs text-slate-600">
                Vui lòng kiểm tra lại Tên doanh nghiệp, Mã số thuế bên dưới và liên hệ đội ngũ HR Connect để gửi lại yêu cầu xác thực.
              </div>
            </div>
          }
        />
      )}
      {company.isLoading ? (
        <Surface padded>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Surface>
      ) : company.isError || !c ? (
        <Alert type="error" showIcon message={getApiErrorMessage(company.error, 'Không tải được hồ sơ doanh nghiệp.')} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Surface padded className="self-start rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex flex-col items-center text-center">
              <div className="relative rounded-[22px] bg-gradient-to-br from-blue-50 to-cyan-50 p-1 ring-1 ring-blue-100">
                <CompanyLogo companyName={c.companyName} logoUrl={c.logoUrl ?? undefined} size="xl" className="!h-24 !w-24 !rounded-2xl !shadow-sm" />
                {uploadLogo.isPending && (
                  <div className="absolute inset-1 flex items-center justify-center rounded-2xl bg-white/80 text-sm font-semibold text-[#0284C7] backdrop-blur-sm">
                    Đang tải…
                  </div>
                )}
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">{c.companyName}</div>
              <div className="text-sm text-slate-600">{c.industry || 'Chưa cập nhật ngành'}</div>
              <div className="mt-3">
                <StatusDot tone={verificationTone}>{verificationShortLabel}</StatusDot>
              </div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectLogo} aria-label="Chọn logo doanh nghiệp" />
              <div className="mt-4 flex w-full gap-2">
                <Button className="!h-10 flex-1 rounded-xl font-medium border-slate-200 hover:!border-slate-300 text-slate-700" icon={<CameraOutlined />} loading={uploadLogo.isPending} onClick={() => logoInputRef.current?.click()}>
                  {c.logoUrl ? 'Đổi logo' : 'Thêm logo'}
                </Button>
                {c.logoUrl && (
                  <Button danger className="!h-10 rounded-xl" icon={<DeleteOutlined />} loading={deleteLogo.isPending} onClick={confirmDeleteLogo} aria-label="Xóa logo doanh nghiệp" />
                )}
              </div>
              <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">JPG, PNG hoặc WebP · tối đa {MAX_LOGO_MB}MB. Logo sẽ xuất hiện trên tin tuyển dụng.</p>
            </div>
            <div className="mt-5">
              {(
                [
                  ['Mã số thuế', c.taxCode || '—'],
                  ['Vai trò của bạn', String(c.roleInCompany ?? '—')],
                  ...(c.verificationRequestedAt && dayjs(String(c.verificationRequestedAt)).isValid()
                    ? ([['Yêu cầu xác thực', dayjs(String(c.verificationRequestedAt)).format('DD/MM/YYYY')]] as [string, string][])
                    : []),
                  ...(c.verificationReviewedAt && dayjs(String(c.verificationReviewedAt)).isValid()
                    ? ([['Xét duyệt lúc', dayjs(String(c.verificationReviewedAt)).format('DD/MM/YYYY')]] as [string, string][])
                    : []),
                  ['Xác thực lúc', c.verifiedAt && dayjs(String(c.verifiedAt)).isValid() ? dayjs(String(c.verifiedAt)).format('DD/MM/YYYY') : '—'],
                  ...(c.createdAt && dayjs(String(c.createdAt)).isValid()
                    ? ([['Ngày tạo', dayjs(String(c.createdAt)).format('DD/MM/YYYY')]] as [string, string][])
                    : []),
                  ...(c.updatedAt && dayjs(String(c.updatedAt)).isValid()
                    ? ([['Cập nhật', dayjs(String(c.updatedAt)).format('DD/MM/YYYY')]] as [string, string][])
                    : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-0 border-t border-solid border-slate-100 py-2.5 text-sm first:border-t-0">
                  <span className="text-slate-600">{label}</span>
                  <span className="min-w-0 truncate text-right font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </Surface>
          <Surface padded className="rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <h2 className="m-0 text-base font-semibold text-slate-900">Chỉnh sửa thông tin</h2>
            <p className="mb-5 mt-1 text-sm text-slate-600">
              Trạng thái xác thực do HR Connect quản lý · Cập nhật giới thiệu hoặc địa chỉ không làm mất trạng thái xác thực.
            </p>
            <Form form={form} layout="vertical" requiredMark={false} validateTrigger="onBlur" onFinish={(v) => save.mutate(v)}>
              <Form.Item name="companyName" label="Tên doanh nghiệp" rules={[{ required: true, whitespace: true, message: 'Nhập tên doanh nghiệp.' }, { max: 255, message: 'Tối đa 255 ký tự.' }]}>
                <Input size="large" className="rounded-xl" />
              </Form.Item>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="taxCode" label="Mã số thuế" rules={[{ max: 80, message: 'Tối đa 80 ký tự.' }]}>
                  <Input size="large" className="rounded-xl" />
                </Form.Item>
                <Form.Item name="industry" label="Ngành" rules={[{ max: 120, message: 'Tối đa 120 ký tự.' }]}>
                  <Input size="large" className="rounded-xl" />
                </Form.Item>
                <Form.Item name="companySize" label="Quy mô">
                  <Select size="large" allowClear options={SIZES} placeholder="Chọn quy mô" className="rounded-xl" />
                </Form.Item>
                <Form.Item name="website" label="Website" rules={[{ type: 'url', message: 'Website không hợp lệ (cần https://…).' }]}>
                  <Input size="large" placeholder="https://" className="rounded-xl" />
                </Form.Item>
              </div>
              <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
                <Input size="large" className="rounded-xl" />
              </Form.Item>
              <Form.Item name="description" label="Giới thiệu" rules={[{ max: 4000, message: 'Tối đa 4000 ký tự.' }]}>
                <Input.TextArea rows={4} showCount maxLength={4000} className="rounded-xl" />
              </Form.Item>
              <div className="flex justify-end pt-2">
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={save.isPending}
                  className="!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white font-bold !h-11 px-6 rounded-xl shadow-sm transition-all active:scale-[0.98]"
                >
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

