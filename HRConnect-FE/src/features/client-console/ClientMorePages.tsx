/**
 * @file ClientMorePages.tsx
 * @description Client Company pages around the hiring flow:
 *  - ClientInterviewsOffersPage: interviews, offers and placements (MF-04); a row opens the
 *    ApplicationWorkbench, where the Client reschedules, records results, sends offers, etc.
 *  - ClientCompanyPage: company profile (GET/PUT /companies/profile/me).
 *  - ClientWarrantyPlaceholder: MF-05 warranty has no backend endpoint yet.
 */
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Form, Input, Select, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { companyProfileApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { NoApiYet } from '@/features/admin-console/adminTheme';
import { Initials, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { HrPipelinePage } from '@/features/hr-console/HrPipelinePage';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';

export const ClientInterviewsOffersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open') ?? undefined;
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
        description="Lịch phỏng vấn, offer đã gửi và ứng viên đã đi làm. Bấm một dòng để dời lịch, ghi kết quả, gửi hoặc thu hồi offer."
        onOpenApplication={setOpen}
        emptyHints={{
          interviews: 'Chưa có lịch phỏng vấn. Vào “Hồ sơ ứng viên”, chọn một hồ sơ rồi bấm “Lên lịch phỏng vấn”.',
          offers: 'Chưa có offer. Offer được tạo khi ứng viên đạt phỏng vấn vòng cuối.',
        }}
      />
      <ApplicationWorkbench applicationId={openId} audience="client" onClose={() => setOpen(undefined)} />
    </>
  );
};

const SIZES = ['1-10', '11-50', '50-100', '101-200', '201-500', '500+'].map((v) => ({ value: v, label: `${v} nhân viên` }));
type CompanyForm = { companyName: string; taxCode?: string; industry?: string; companySize?: string; website?: string; address?: string; description?: string };

export const ClientCompanyPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
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
    onSuccess: (res) => {
      message.success(res.message || 'Đã lưu hồ sơ doanh nghiệp.');
      queryClient.invalidateQueries({ queryKey: ['client-company'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const c = company.data;
  const verified = c?.verificationStatus === 'VERIFIED';

  return (
    <div>
      <PageHero eyebrow="Doanh nghiệp" title="Hồ sơ doanh nghiệp" description="Thông tin hiển thị trên tin tuyển dụng và trong hồ sơ gửi tới ứng viên." />
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
              <Initials name={c.companyName} size={72} />
              <div className="mt-3 text-lg font-bold text-slate-900">{c.companyName}</div>
              <div className="text-sm text-slate-600">{c.industry || 'Chưa cập nhật ngành'}</div>
              <div className="mt-3">
                <StatusDot tone={verified ? 'success' : 'warning'}>{verified ? 'Đã xác thực' : 'Chưa xác thực'}</StatusDot>
              </div>
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

export const ClientWarrantyPlaceholder: React.FC = () => (
  <div>
    <PageHero eyebrow="Sau tuyển dụng" title="Bảo hành 60 ngày" description="Theo dõi các mốc 15, 30, 60 ngày sau khi ứng viên đi làm và báo khi ứng viên nghỉ việc." />
    <NoApiYet feature="Bảo hành" detail="Thuộc MF-05; backend chưa có endpoint theo dõi bảo hành. Ứng viên đã đi làm xem ở “Phỏng vấn & Offer” → Đi làm." />
  </div>
);
