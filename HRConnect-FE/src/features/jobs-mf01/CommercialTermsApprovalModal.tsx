/**
 * @file CommercialTermsApprovalModal.tsx
 * @description MF-01 F2 · Internal HR approves a HEADHUNT_COD / CV_SOURCING job and finalizes the
 * commercial terms. Each row shows what the Client proposed next to the number HR agrees on.
 * Data: GET /internal/jobs/{id}/commercial-terms/defaults → POST /internal/jobs/{id}/approve.
 * Every number, default and allowed range comes from the backend; nothing is hard-coded here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Form, Input, InputNumber, Modal, Skeleton, Tag } from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { CommercialTermsInput, ApproveJobInput, Job } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useCommercialTermsDefaults } from './useJobQueries';

type TermKey = keyof CommercialTermsInput;

interface TermField {
  key: TermKey;
  label: string;
  unit: string;
  step: number;
  help?: string;
}

const HEADHUNT_FIELDS: TermField[] = [
  { key: 'feeMultiplier', label: 'Hệ số phí', unit: '× lương tháng', step: 0.1, help: 'Phí = hệ số × lương tháng của ứng viên' },
  { key: 'warrantyDays', label: 'Thời hạn bảo hành', unit: 'ngày', step: 1 },
  { key: 'paymentDueDays', label: 'Hạn thanh toán', unit: 'ngày', step: 1, help: 'Tính từ ngày đến hạn thu phí' },
];

const SOURCING_FIELDS: TermField[] = [
  { key: 'sourcingTarget', label: 'Số hồ sơ cần giao', unit: 'hồ sơ', step: 1 },
  { key: 'pricePerCv', label: 'Phí mỗi hồ sơ đạt yêu cầu', unit: 'đ', step: 10000 },
  { key: 'depositPercent', label: 'Tiền cọc', unit: '%', step: 5 },
  { key: 'reviewDays', label: 'Thời gian doanh nghiệp duyệt hồ sơ', unit: 'ngày', step: 1 },
  { key: 'paymentDueDays', label: 'Hạn thanh toán', unit: 'ngày', step: 1 },
];

const fmt = (value: number | null | undefined, unit: string) => {
  if (value == null) return null;
  const text = unit === 'đ' ? value.toLocaleString('vi-VN') : String(value);
  return `${text} ${unit}`;
};

interface Props {
  job: Job;
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onApprove: (input: ApproveJobInput) => Promise<unknown>;
}

export const CommercialTermsApprovalModal: React.FC<Props> = ({ job, open, loading, onCancel, onApprove }) => {
  const [form] = Form.useForm<CommercialTermsInput & { agreementReference?: string; note?: string }>();
  const defaults = useCommercialTermsDefaults(job.jobId, open);
  const [serverError, setServerError] = useState<string>();
  const isSourcing = job.serviceTypeCode === 'CV_SOURCING';
  const fields = isSourcing ? SOURCING_FIELDS : HEADHUNT_FIELDS;
  const data = defaults.data;

  useEffect(() => {
    if (open && data?.prefill) {
      form.setFieldsValue({ ...data.prefill, agreementReference: undefined, note: undefined });
      setServerError(undefined);
    }
  }, [open, data, form]);

  const watchedValues = Form.useWatch([], form);
  const values = useMemo(() => watchedValues ?? {}, [watchedValues]);

  // Rows whose agreed number differs from what the Client proposed (only where the Client proposed one).
  const changed = useMemo(
    () =>
      fields.filter((f) => {
        const proposed = data?.proposed?.[f.key];
        const agreed = values[f.key];
        return proposed != null && agreed != null && Number(agreed) !== Number(proposed);
      }),
    [fields, data, values]
  );
  const needsReference = changed.length > 0;
  const proposedTarget = data?.proposed?.sourcingTarget;
  const targetLowered =
    isSourcing && proposedTarget != null && values.sourcingTarget != null && values.sourcingTarget < proposedTarget;

  const estimatedTotal =
    isSourcing && values.sourcingTarget != null && values.pricePerCv != null
      ? values.sourcingTarget * values.pricePerCv
      : null;
  const estimatedDeposit =
    estimatedTotal != null && values.depositPercent != null ? Math.round((estimatedTotal * values.depositPercent) / 100) : null;

  const submit = async () => {
    let v: Awaited<ReturnType<typeof form.validateFields>>;
    try {
      v = await form.validateFields();
    } catch {
      return; // field errors are already shown next to each field
    }
    const commercialTerms: CommercialTermsInput = {};
    fields.forEach((f) => {
      commercialTerms[f.key] = v[f.key] ?? null;
    });
    setServerError(undefined);
    try {
      await onApprove({
        commercialTerms,
        agreementReference: v.agreementReference?.trim() || null,
        note: v.note?.trim() || null,
      });
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      width={760}
      title={isSourcing ? 'Duyệt dịch vụ tìm kiếm hồ sơ' : 'Duyệt dịch vụ tuyển dụng theo kết quả'}
      okText="Chốt điều khoản và duyệt tin"
      cancelText="Hủy"
      confirmLoading={loading}
      okButtonProps={{ disabled: !data || defaults.isError }}
      onCancel={onCancel}
      onOk={submit}
      destroyOnClose
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{job.title}</div>
          <div className="text-xs text-slate-600">{job.companyName ?? '—'}</div>
        </div>

        {defaults.isError ? (
          <Alert type="error" showIcon message="Không tải được điều khoản đề xuất" description={getApiErrorMessage(defaults.error)} />
        ) : defaults.isLoading || !data ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            <div role="table" aria-label="So sánh điều khoản" className="overflow-hidden rounded-xl border border-solid border-slate-200">
              <div role="row" className="grid grid-cols-[1.1fr_1fr_1.2fr] gap-3 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                <span role="columnheader">Khoản mục</span>
                <span role="columnheader">Doanh nghiệp đề xuất</span>
                <span role="columnheader">Điều khoản được duyệt</span>
              </div>
              {fields.map((f) => {
                const proposed = data.proposed?.[f.key];
                const adminDefault = data.adminDefaults?.[f.key];
                const range = data.ranges?.[f.key];
                const isChanged = changed.some((c) => c.key === f.key);
                return (
                  <div
                    role="row"
                    key={f.key}
                    className={`grid grid-cols-[1.1fr_1fr_1.2fr] items-start gap-3 border-0 border-t border-solid border-slate-200 px-4 py-3 ${
                      isChanged ? 'bg-amber-50/70' : 'bg-white'
                    }`}
                  >
                    <div role="cell">
                      <label htmlFor={`term-${f.key}`} className="text-sm font-medium text-slate-900">
                        {f.label}
                      </label>
                      {f.help && <div className="text-xs text-slate-500">{f.help}</div>}
                    </div>
                    <div role="cell" className="text-sm">
                      {proposed != null ? (
                        <span className="font-semibold text-slate-900">{fmt(proposed, f.unit)}</span>
                      ) : (
                        <span className="text-slate-500">Không đề xuất</span>
                      )}
                      {adminDefault != null && (
                        <div className="text-xs text-slate-500">Mặc định: {fmt(adminDefault, f.unit)}</div>
                      )}
                    </div>
                    <div role="cell">
                      <Form.Item
                        name={f.key}
                        className="mb-0"
                        rules={[
                          { required: true, message: `Nhập ${f.label.toLowerCase()}` },
                          ...(range
                            ? [{ type: 'number' as const, min: range.min, max: range.max, message: `Từ ${fmt(range.min, f.unit)} đến ${fmt(range.max, f.unit)}` }]
                            : []),
                        ]}
                      >
                        <InputNumber
                          id={`term-${f.key}`}
                          className="w-full"
                          min={range?.min}
                          max={range?.max}
                          step={f.step}
                          addonAfter={f.unit}
                          formatter={f.unit === 'đ' ? (v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : undefined}
                          parser={f.unit === 'đ' ? (v) => Number((v ?? '').replace(/\./g, '')) : undefined}
                        />
                      </Form.Item>
                      {isChanged && (
                        <Tag color="warning" icon={<EditOutlined />} className="m-0 mt-1 text-[11px]">
                          Khác đề xuất
                        </Tag>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {data.proposed?.note && (
              <div className="mt-3 rounded-lg border border-solid border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Ghi chú của doanh nghiệp: </span>
                {data.proposed.note}
              </div>
            )}

            {isSourcing && estimatedTotal != null && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-600">Tổng giá trị ước tính</div>
                  <div className="text-base font-semibold text-slate-900">{estimatedTotal.toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-600">Tiền cọc doanh nghiệp trả trước</div>
                  <div className="text-base font-semibold text-slate-900">
                    {estimatedDeposit != null ? `${estimatedDeposit.toLocaleString('vi-VN')} đ` : '—'}
                  </div>
                </div>
              </div>
            )}

            <Form.Item
              className="mt-4"
              name="agreementReference"
              label="Căn cứ thỏa thuận với doanh nghiệp"
              extra={
                needsReference
                  ? `Bắt buộc vì đang chốt khác đề xuất ở: ${changed.map((c) => c.label.toLowerCase()).join(', ')}.`
                  : 'Ví dụ: số hợp đồng hoặc email xác nhận ngày 15/10. Bắt buộc khi chốt khác đề xuất của doanh nghiệp.'
              }
              rules={[{ required: needsReference, whitespace: true, message: 'Nhập căn cứ thỏa thuận (số hợp đồng, email...)' }]}
            >
              <Input maxLength={200} placeholder="Số hợp đồng / email / biên bản thỏa thuận" />
            </Form.Item>

            <Form.Item
              name="note"
              label="Ghi chú nội bộ"
              rules={[{ required: targetLowered, whitespace: true, message: 'Nhập lý do giảm số hồ sơ so với yêu cầu của doanh nghiệp.' }]}
              extra={targetLowered ? 'Bắt buộc vì số hồ sơ được duyệt thấp hơn số doanh nghiệp yêu cầu.' : undefined}
            >
              <Input.TextArea rows={2} maxLength={1000} />
            </Form.Item>

            <div className="flex items-start gap-2 text-xs text-slate-600">
              <InfoCircleOutlined className="mt-0.5 text-sky-600" aria-hidden />
              <span>Sau khi duyệt, các điều khoản được dùng để tính phí và hiển thị trong chi tiết tin tuyển dụng của doanh nghiệp.</span>
            </div>
          </Form>
        )}

        {serverError && <Alert type="error" showIcon message={serverError} role="alert" />}
      </div>
    </Modal>
  );
};

export default CommercialTermsApprovalModal;
