/**
 * @file CommercialTermsApprovalModal.tsx
 * @description MF-01 F2 · Internal HR approves a HEADHUNT_COD / CV_SOURCING job and finalizes the
 * commercial terms. Each row shows what the Client proposed next to the number HR agrees on.
 * Data: GET /internal/jobs/{id}/commercial-terms/defaults → POST /internal/jobs/{id}/approve.
 * Every number, default and allowed range comes from the backend; nothing is hard-coded here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Skeleton, Tag, Tooltip, Upload, message } from 'antd';
import { CheckCircleFilled, EditOutlined, FilePdfOutlined, InfoCircleOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { CommercialTermsInput, ApproveJobInput, Job, ServiceAgreementDto } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useCommercialTermsDefaults } from './useJobQueries';

type TermKey = keyof CommercialTermsInput;

interface TermField {
  key: TermKey;
  label: string;
  unit: string;
  step: number;
  help?: string;
  /** Plain-language explanation shown when hovering the (i) icon next to the label. */
  tip: string;
}

const HEADHUNT_FIELDS: TermField[] = [
  {
    key: 'feeMultiplier', label: 'Hệ số phí', unit: '× lương tháng', step: 0.1, help: 'Hệ số tính trên lương tháng',
    tip: 'Phí dịch vụ = hệ số × lương gross 1 tháng của ứng viên. Chỉ phát sinh khi ứng viên thực sự đi làm.'
  },
  {
    key: 'warrantyDays', label: 'Bảo hành', unit: 'ngày', step: 1,
    tip: 'Số ngày tính từ ngày ứng viên đi làm. Nếu ứng viên nghỉ trong thời gian này, doanh nghiệp được tuyển người thay thế miễn phí. Hết bảo hành thì hoa hồng của Affiliate mới được tính.'
  },
  {
    key: 'paymentDueDays', label: 'Hạn thanh toán', unit: 'ngày', step: 1,
    tip: 'Số ngày doanh nghiệp có để thanh toán phí dịch vụ, tính từ ngày ứng viên đi làm. Quá hạn, khoản phí chuyển sang "Quá hạn".'
  },
];

const SOURCING_FIELDS: TermField[] = [
  {
    key: 'sourcingTarget', label: 'Số hồ sơ', unit: 'hồ sơ', step: 1,
    tip: 'Số CV đã sàng lọc doanh nghiệp mua. HR giao đủ số này thì gói hoàn thành; hệ thống không cho giao vượt.'
  },
  {
    key: 'pricePerCv', label: 'Phí / hồ sơ', unit: 'đ', step: 10000,
    tip: 'Giá cho mỗi CV doanh nghiệp chấp nhận. Doanh nghiệp chỉ trả cho CV được chấp nhận; hoa hồng của Affiliate cũng tính từ giá này.'
  },
  {
    key: 'depositPercent', label: 'Tỷ lệ cọc', unit: '%', step: 5,
    tip: 'Phần trăm trên tổng giá trị doanh nghiệp trả trước. Tin chỉ bắt đầu chạy khi đã ghi nhận tiền cọc; khi kết thúc sẽ quyết toán và trừ phần đã cọc.'
  },
  {
    key: 'reviewDays', label: 'Thời gian duyệt', unit: 'ngày', step: 1,
    tip: 'Số ngày doanh nghiệp có để xem và chấp nhận hoặc từ chối mỗi CV được giao. Hết hạn mà chưa trả lời, CV được tự động chấp nhận.'
  },
  {
    key: 'paymentDueDays', label: 'Hạn thanh toán', unit: 'ngày', step: 1,
    tip: 'Số ngày doanh nghiệp có để thanh toán mỗi khoản phí (tiền cọc, quyết toán). Quá hạn, khoản phí chuyển sang "Quá hạn".'
  },
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
  changeRequestReason?: string | null;
  currentAgreement?: ServiceAgreementDto | null;
  isRevision?: boolean;
  onCancel: () => void;
  onApprove: (input: ApproveJobInput) => Promise<unknown>;
}

export const CommercialTermsApprovalModal: React.FC<Props> = ({
  job,
  open,
  loading,
  changeRequestReason,
  currentAgreement,
  isRevision,
  onCancel,
  onApprove,
}) => {
  const [form] = Form.useForm<CommercialTermsInput & { agreementReference?: string; note?: string }>();
  const defaults = useCommercialTermsDefaults(job.jobId, open);
  const [serverError, setServerError] = useState<string>();
  const isSourcing = job.serviceTypeCode === 'CV_SOURCING';
  const fields = isSourcing ? SOURCING_FIELDS : HEADHUNT_FIELDS;
  const data = defaults.data;
  const [contractFileName, setContractFileName] = useState<string>(
    `Hop_dong_dich_vu_${job.serviceTypeCode === 'HEADHUNT_COD' ? 'Headhunt' : 'CV_Sourcing'}_${job.title.replace(/\s+/g, '_')}_signed.pdf`
  );

  const generateContractCode = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `HRC-HD-${year}${month}-${rand}`;
  };

  useEffect(() => {
    if (open) {
      const baseValues = data?.prefill ? { ...data.prefill } : {};
      if (currentAgreement) {
        if (currentAgreement.feeMultiplier != null) baseValues.feeMultiplier = currentAgreement.feeMultiplier;
        if (currentAgreement.warrantyDays != null) baseValues.warrantyDays = currentAgreement.warrantyDays;
        if (currentAgreement.paymentDueDays != null) baseValues.paymentDueDays = currentAgreement.paymentDueDays;
        if (currentAgreement.sourcingTarget != null) baseValues.sourcingTarget = currentAgreement.sourcingTarget;
        if (currentAgreement.pricePerQualifiedCv != null) baseValues.pricePerCv = currentAgreement.pricePerQualifiedCv;
        if (currentAgreement.reviewDays != null) baseValues.reviewDays = currentAgreement.reviewDays;
      }
      const initialReference =
        currentAgreement?.verificationCode || job.commercialTerms?.agreementReference || generateContractCode();

      form.setFieldsValue({
        ...baseValues,
        agreementReference: initialReference,
        note: currentAgreement?.agreementNote ?? undefined,
      });
      setServerError(undefined);
    }
  }, [open, data, currentAgreement, job.commercialTerms?.agreementReference, form]);

  const submit = async () => {
    let v: Awaited<ReturnType<typeof form.validateFields>>;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    const commercialTerms: CommercialTermsInput = {};
    fields.forEach((f) => {
      commercialTerms[f.key] = data?.prefill?.[f.key] ?? data?.adminDefaults?.[f.key] ?? null;
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
      width={720}
      title={
        isRevision
          ? 'Chỉnh sửa hợp đồng dịch vụ'
          : 'Soạn & Gửi hợp đồng dịch vụ'
      }
      okText={isRevision ? 'Cập nhật & Gửi hợp đồng' : 'Gửi hợp đồng cho Doanh nghiệp'}
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

        {changeRequestReason && (
          <div className="rounded-xl border border-solid border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
            <div className="font-semibold text-amber-950 flex items-center gap-1.5">
              <InfoCircleOutlined className="text-amber-600" /> Ghi chú / Ý kiến điều chỉnh từ Doanh nghiệp:
            </div>
            <div className="italic bg-white/90 p-2.5 rounded-lg border border-solid border-amber-200 text-slate-800 leading-relaxed">
              "{changeRequestReason}"
            </div>
          </div>
        )}

        {defaults.isError ? (
          <Alert type="error" showIcon message="Không tải được thông tin hợp đồng" description={getApiErrorMessage(defaults.error)} />
        ) : defaults.isLoading || !data ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            {/* Tệp hợp đồng có sẵn chữ ký - Đã sửa lỗi tràn khung */}
            <div className="rounded-xl border border-solid border-indigo-200 bg-indigo-50/50 p-4 space-y-3 mb-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100/80 border border-indigo-200 flex items-center justify-center text-indigo-700 text-xl shrink-0">
                    <FilePdfOutlined />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 truncate" title={contractFileName}>
                      {contractFileName}
                    </div>
                    <div className="text-xs text-emerald-700 flex items-center gap-1.5 mt-0.5 font-medium truncate">
                      <CheckCircleFilled className="text-emerald-600 shrink-0" />
                      <span className="truncate">Đã đính kèm văn bản hợp đồng có sẵn chữ ký HR Connect</span>
                    </div>
                  </div>
                </div>

                <Upload
                  maxCount={1}
                  accept=".pdf,.doc,.docx"
                  showUploadList={false}
                  className="shrink-0"
                  beforeUpload={(file) => {
                    setContractFileName(file.name);
                    message.success(`Đã đính kèm tệp hợp đồng mới: ${file.name}`);
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />} className="text-xs shrink-0 whitespace-nowrap">
                    Tải lên file khác
                  </Button>
                </Upload>
              </div>

              <div className="text-xs text-slate-500 bg-white/90 p-2.5 rounded-lg border border-solid border-indigo-100 leading-relaxed">
                Hợp đồng tạo và upload lên đã có sẵn chữ ký từ HR Connect. Doanh nghiệp sẽ tải file này xuống để xem xét và thực hiện ký kết bên ngoài hệ thống nền tảng.
              </div>
            </div>

            <Form.Item
              name="agreementReference"
              label={
                <span className="font-semibold text-slate-900">
                  Số hợp đồng / Căn cứ thỏa thuận
                </span>
              }
              rules={[{ required: true, message: 'Vui lòng cung cấp mã số hợp đồng' }]}
              extra="Mã số hợp đồng được tự động tạo và sẽ hiển thị trực tiếp trên văn bản hợp đồng dịch vụ."
            >
              <Input
                maxLength={200}
                placeholder="Ví dụ: HRC-HD-202610-8A2F"
                addonAfter={
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    className="text-xs text-indigo-600 font-medium p-0 h-auto hover:text-indigo-500 flex items-center gap-1"
                    onClick={() => {
                      const newCode = generateContractCode();
                      form.setFieldValue('agreementReference', newCode);
                      message.info(`Đã tạo mã hợp đồng mới: ${newCode}`);
                    }}
                  >
                    Tạo mã mới
                  </Button>
                }
              />
            </Form.Item>

            <Form.Item
              name="note"
              label={
                <span className="font-semibold text-slate-900">
                  Ghi chú hợp đồng gửi Doanh nghiệp
                </span>
              }
              extra="Nội dung ghi chú này sẽ hiển thị trực tiếp cho Doanh nghiệp xem khi nhận được hợp đồng."
            >
              <Input.TextArea
                rows={3}
                maxLength={1000}
                placeholder="Ghi chú về các điểm quan trọng trong hợp đồng hoặc hướng dẫn ký kết cho Doanh nghiệp..."
              />
            </Form.Item>

            <div className="flex items-start gap-2 text-xs text-slate-600 pt-1">
              <InfoCircleOutlined className="mt-0.5 text-sky-600" aria-hidden />
              <span>
                Hệ thống sẽ gửi thông báo đã soạn xong hợp đồng. Doanh nghiệp sẽ tải hợp đồng về để ký và có thể gửi yêu cầu điều chỉnh.
              </span>
            </div>
          </Form>
        )}

        {serverError && <Alert type="error" showIcon message={serverError} role="alert" />}
      </div>
    </Modal>
  );
};

export default CommercialTermsApprovalModal;
