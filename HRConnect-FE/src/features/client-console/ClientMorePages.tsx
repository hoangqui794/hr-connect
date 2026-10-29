/**
 * @file ClientMorePages.tsx
 * @description Client Company pages around the hiring flow:
 *  - ClientInterviewsOffersPage: interviews, offers and placements (MF-04); a row opens the
 *    ApplicationWorkbench, where the Client reschedules, records results, sends offers, etc.
 *  - ClientCompanyPage: company profile (GET/PUT /companies/profile/me).
 */
import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Select, Skeleton } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { companyProfileApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { HrPipelinePage } from '@/features/hr-console/HrPipelinePage';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { ClientInterviewDetailDrawer } from '@/features/client-console/ClientInterviewDetailDrawer';

export const ClientInterviewsOffersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open') ?? undefined;
  const [openInterviewId, setOpenInterviewId] = React.useState<string | null>(null);

  const setOpen = (id?: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('open', id);
    else next.delete('open');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <HrPipelinePage
        eyebrow="Tuyển dụng"
        tip
        description="Lịch phỏng vấn, offer đã gửi và ứng viên đã đi làm. Bấm một dòng để xem chi tiết, dời lịch, ghi kết quả hoặc xem lịch sử."
        onOpenApplication={setOpen}
        onOpenInterview={(iv) => setOpenInterviewId(iv.interviewId)}
        emptyHints={{
          interviews: 'Chưa có lịch phỏng vấn. Vào “Hồ sơ ứng viên”, chọn một hồ sơ rồi bấm “Lên lịch phỏng vấn”.',
          offers: 'Chưa có offer. Offer được tạo khi ứng viên đạt phỏng vấn vòng cuối.',
        }}
      />
      <ApplicationWorkbench applicationId={openId} audience="client" onClose={() => setOpen(undefined)} />
      <ClientInterviewDetailDrawer
        interviewId={openInterviewId}
        onClose={() => setOpenInterviewId(null)}
        onOpenApplication={(appId) => {
          setOpenInterviewId(null);
          setOpen(appId);
        }}
      />
    </>
  );
};

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
    if (file.size > 5 * 1024 * 1024) {
      message.error('Logo không được vượt quá 5MB.');
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

  return (
    <div>
      <PageHero
        eyebrow="Doanh nghiệp"
        title="Hồ sơ doanh nghiệp"
        tip
        description="Thông tin công ty hiển thị trên tin tuyển dụng và trang công ty mà ứng viên xem."
      />
      {company.isLoading ? (
        <Surface padded>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Surface>
      ) : company.isError || !c ? (
        <Alert type="error" showIcon message={getApiErrorMessage(company.error, 'Không tải được hồ sơ doanh nghiệp.')} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Surface padded className="self-start">
            <div className="flex flex-col items-center text-center">
              <div className="relative rounded-[22px] bg-gradient-to-br from-blue-50 to-cyan-50 p-1 ring-1 ring-blue-100">
                <CompanyLogo companyName={c.companyName} logoUrl={c.logoUrl ?? undefined} size="xl" className="!h-24 !w-24 !rounded-2xl !shadow-sm" />
                {uploadLogo.isPending && (
                  <div className="absolute inset-1 flex items-center justify-center rounded-2xl bg-white/80 text-sm font-semibold text-blue-700 backdrop-blur-sm">
                    Đang tải…
                  </div>
                )}
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">{c.companyName}</div>
              <div className="text-sm text-slate-600">{c.industry || 'Chưa cập nhật ngành'}</div>
              <div className="mt-3">
                <StatusDot tone={verified ? 'success' : 'warning'}>{verified ? 'Đã xác thực' : 'Chưa xác thực'}</StatusDot>
              </div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectLogo} aria-label="Chọn logo doanh nghiệp" />
              <div className="mt-4 flex w-full gap-2">
                <Button className="min-h-11 flex-1" icon={<CameraOutlined />} loading={uploadLogo.isPending} onClick={() => logoInputRef.current?.click()}>
                  {c.logoUrl ? 'Đổi logo' : 'Thêm logo'}
                </Button>
                {c.logoUrl && (
                  <Button danger className="min-h-11" icon={<DeleteOutlined />} loading={deleteLogo.isPending} onClick={confirmDeleteLogo} aria-label="Xóa logo doanh nghiệp" />
                )}
              </div>
              <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">JPG, PNG hoặc WebP · tối đa 5MB. Logo sẽ xuất hiện trên tin tuyển dụng.</p>
            </div>
            <div className="mt-5">
              {(
                [
                  ['Mã số thuế', c.taxCode || '—'],
                  ['Vai trò của bạn', String(c.roleInCompany ?? '—')],
                  ['Xác thực lúc', c.verifiedAt ? dayjs(String(c.verifiedAt)).format('DD/MM/YYYY') : '—'],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-0 border-t border-solid border-slate-100 py-2.5 text-sm first:border-t-0">
                  <span className="text-slate-600">{label}</span>
                  <span className="min-w-0 truncate text-right font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </Surface>
          <Surface padded>
            <h2 className="m-0 text-base font-semibold text-slate-900">Chỉnh sửa thông tin</h2>
            <p className="mb-5 mt-1 text-sm text-slate-600">Trạng thái xác thực do HR Connect quản lý.</p>
            <Form form={form} layout="vertical" requiredMark={false} validateTrigger="onBlur" onFinish={(v) => save.mutate(v)}>
              <Form.Item name="companyName" label="Tên doanh nghiệp" rules={[{ required: true, whitespace: true, message: 'Nhập tên doanh nghiệp.' }, { max: 255, message: 'Tối đa 255 ký tự.' }]}>
                <Input size="large" />
              </Form.Item>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="taxCode" label="Mã số thuế" rules={[{ max: 80, message: 'Tối đa 80 ký tự.' }]}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="industry" label="Ngành" rules={[{ max: 120, message: 'Tối đa 120 ký tự.' }]}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="companySize" label="Quy mô">
                  <Select size="large" allowClear options={SIZES} placeholder="Chọn quy mô" />
                </Form.Item>
                <Form.Item name="website" label="Website" rules={[{ type: 'url', message: 'Website không hợp lệ (cần https://…).' }]}>
                  <Input size="large" placeholder="https://" />
                </Form.Item>
              </div>
              <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
                <Input size="large" />
              </Form.Item>
              <Form.Item name="description" label="Giới thiệu" rules={[{ max: 4000, message: 'Tối đa 4000 ký tự.' }]}>
                <Input.TextArea rows={4} showCount maxLength={4000} />
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

