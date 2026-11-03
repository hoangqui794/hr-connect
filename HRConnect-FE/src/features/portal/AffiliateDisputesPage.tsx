/**
 * @file AffiliateDisputesPage.tsx
 * @description Page for Affiliate to view own disputes and create new dispute requests
 * (backing GET /api/v1/disputes/mine and POST /api/v1/disputes). Mockup 03/11: list on the left,
 * the new-dispute form on the right; the referral is picked from the Affiliate's own submissions.
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Form, Input, Radio, Select, Alert, Skeleton, App as AntApp } from 'antd';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disputeApi } from '@/services/api/disputeApi';
import { affiliateApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import type { CreateDisputeRequest } from '@/types/api/dispute';
import { AffiliatePageHeader } from './affiliate/AffiliateUi';
import { submissionStatus } from './mf02Labels';

const fmtDate = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—');

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Đã gửi', className: 'bg-orange-50 text-orange-800' },
  UNDER_REVIEW: { label: 'Đang xem xét', className: 'bg-sky-100 text-sky-800' },
  UPHELD: { label: 'Được chấp nhận', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Không chấp nhận', className: 'bg-red-50 text-red-800' },
  WITHDRAWN: { label: 'Đã rút', className: 'bg-gray-100 text-gray-700' },
};

const TYPE_LABEL: Record<string, string> = {
  DUPLICATE_SUBMISSION: 'Hồ sơ bị chặn vì trùng',
  ATTRIBUTION: 'Ghi nhận sai nguồn',
};

export const AffiliateDisputesPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<CreateDisputeRequest>();

  const { data: disputes = [], isLoading, isError, error } = useQuery({
    queryKey: ['affiliate-my-disputes'],
    queryFn: () => disputeApi.getMyDisputes(),
  });
  // Disputes are about the Affiliate's own referrals, so offer those instead of asking for an id.
  const submissions = useQuery({
    queryKey: ['aff-submissions', 'dispute-picker'],
    queryFn: () => affiliateApi.submissions({ page: 1, pageSize: 100 }),
  });

  useEffect(() => {
    const preset = searchParams.get('submissionId');
    if (preset) form.setFieldsValue({ submissionId: preset, disputeType: 'DUPLICATE_SUBMISSION' });
  }, [searchParams, form]);

  const createMutation = useMutation({
    mutationFn: (values: CreateDisputeRequest) => disputeApi.createDispute(values),
    onSuccess: () => {
      message.success('Đã gửi khiếu nại tới bộ phận vận hành HR Connect.');
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['affiliate-my-disputes'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể gửi khiếu nại.')),
  });

  const submissionOptions = (submissions.data?.items ?? [])
    .filter((s) => ['BLOCKED_DUPLICATE', 'ACCEPTED'].includes(s.status))
    .map((s) => ({ value: s.submissionId, label: `${s.candidateName} – ${s.jobTitle} – ${submissionStatus(s.status).label}` }));

  return (
    <div>
      <AffiliatePageHeader
        title="Khiếu nại"
        description="Yêu cầu HR Connect kiểm tra lại khi lượt giới thiệu bị chặn vì trùng hoặc ghi nhận sai nguồn."
      />
      {isError ? <Alert className="mb-4" type="error" showIcon message="Không tải được danh sách khiếu nại" description={getApiErrorMessage(error)} /> : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="aff-disputes-mine" className="rounded-lg border border-solid border-gray-200 bg-white">
          <h2 id="aff-disputes-mine" className="m-0 border-0 border-b border-solid border-slate-100 px-4 py-3.5 text-[15px] font-bold text-gray-900">Khiếu nại của tôi</h2>
          {isLoading ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 3 }} /></div>
          ) : disputes.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-600">Bạn chưa có khiếu nại nào.</div>
          ) : (
            <ul className="m-0 list-none p-0">
              {disputes.map((d) => {
                const st = STATUS_CONFIG[d.status] ?? { label: d.status, className: 'bg-gray-100 text-gray-700' };
                return (
                  <li key={d.disputeId} className="flex flex-wrap gap-3 border-0 border-b border-solid border-slate-100 px-4 py-3.5 last:border-b-0">
                    <div className="min-w-0 flex-[1_1_300px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-gray-900">{TYPE_LABEL[d.disputeType] ?? d.disputeType}</b>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${st.className}`}>{st.label}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-gray-600">{[d.candidateName, d.jobTitle].filter(Boolean).join(' – ')}</div>
                      <div className="mt-1.5 text-[13px] text-gray-800">{d.resolution || d.description}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      Gửi {fmtDate(d.createdAt)}
                      {d.resolvedAt && <div>Xử lý {fmtDate(d.resolvedAt)}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="aff-dispute-new" className="rounded-lg border border-solid border-gray-200 bg-white p-5">
          <h2 id="aff-dispute-new" className="m-0 mb-3.5 text-[15px] font-bold text-gray-900">Gửi khiếu nại mới</h2>
          <Form<CreateDisputeRequest>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ disputeType: 'DUPLICATE_SUBMISSION' }}
            onFinish={(v) => createMutation.mutate(v)}
            disabled={createMutation.isPending}
          >
            <Form.Item name="submissionId" label="Lượt giới thiệu" rules={[{ required: true, message: 'Chọn lượt giới thiệu cần kiểm tra.' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={submissions.isLoading}
                placeholder="Chọn lượt giới thiệu"
                options={submissionOptions}
                notFoundContent="Không có lượt nào bị chặn hoặc đã được ghi nhận."
              />
            </Form.Item>
            <Form.Item name="disputeType" label="Loại khiếu nại" rules={[{ required: true }]}>
              <Radio.Group className="flex flex-col gap-2">
                <Radio value="DUPLICATE_SUBMISSION">Hồ sơ bị chặn vì trùng</Radio>
                <Radio value="ATTRIBUTION">Ghi nhận sai nguồn giới thiệu</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="description" label="Mô tả" rules={[{ required: true, whitespace: true, message: 'Nêu rõ lý do khiếu nại.' }]}>
              <Input.TextArea rows={4} placeholder="Ví dụ: tôi đã liên hệ và gửi CV của ứng viên cho job này từ ngày..." />
            </Form.Item>
            <Form.Item name="evidenceNote" label="Bằng chứng">
              <Input.TextArea rows={2} placeholder="Ví dụ: email trao đổi với ứng viên ngày..." />
            </Form.Item>
            <p className="m-0 mb-3.5 text-xs leading-relaxed text-gray-500">Admin xem xét và thông báo kết quả. Bạn không thấy thông tin của Affiliate bên kia. Hoa hồng liên quan được giữ đến khi có kết quả.</p>
            <Button type="primary" htmlType="submit" block size="large" loading={createMutation.isPending} className="!bg-[color:var(--affiliate-brand)]">
              Gửi khiếu nại
            </Button>
          </Form>
        </section>
      </div>
    </div>
  );
};

export default AffiliateDisputesPage;
