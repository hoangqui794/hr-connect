/**
 * @file ContactConsultationForm.tsx
 * @description Consultation request form (mockup 03/11, Page 27: "Liên hệ với HR Connect").
 */
import React, { useState } from 'react';
import { Form, Input, Select, Checkbox, Alert } from 'antd';
import { CheckCircleFilled, RedoOutlined } from '@ant-design/icons';
import { contactApi } from '@/services/api/contactApi';
import { getApiError } from '@/services/apiClient';
import type {
  ContactRequestReceipt,
  ContactServiceInterest,
  SubmitContactRequestInput,
} from '@/types/api/contact';

const { TextArea } = Input;
const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const SERVICE_INTEREST_OPTIONS: { value: ContactServiceInterest; label: string; desc: string }[] = [
  {
    value: 'HEADHUNT_COD',
    label: 'Tuyển qua Affiliate – trả phí khi tuyển được',
    desc: 'Phí thành công, bảo hành và đồng hành trọn quy trình',
  },
  {
    value: 'CV_SOURCING',
    label: 'Mua CV theo số lượng',
    desc: 'Bàn giao danh sách hồ sơ đã qua sàng lọc chuyên sâu',
  },
  {
    value: 'CV_APPLICATION',
    label: 'Đăng tin tuyển dụng',
    desc: 'Tiếp cận hàng nghìn ứng viên chủ động trên nền tảng',
  },
  {
    value: 'OTHER',
    label: 'Tư vấn giải pháp khác',
    desc: 'Trao đổi nhu cầu tuyển dụng riêng biệt theo yêu cầu',
  },
];

interface FormValues {
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  serviceInterest: ContactServiceInterest;
  message: string;
  consentAccepted: boolean;
}

interface ContactConsultationFormProps {
  initialServiceInterest?: ContactServiceInterest;
  onSuccess?: (receipt: ContactRequestReceipt) => void;
  className?: string;
}

export const ContactConsultationForm: React.FC<ContactConsultationFormProps> = ({
  initialServiceInterest = 'HEADHUNT_COD',
  onSuccess,
  className = '',
}) => {
  const [form] = Form.useForm<FormValues>();
  const serviceInterest = Form.useWatch('serviceInterest', form);
  const currentServiceInfo = SERVICE_INTEREST_OPTIONS.find(
    (item) => item.value === (serviceInterest || initialServiceInterest)
  );
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ContactRequestReceipt | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    if (!values.consentAccepted) {
      form.setFields([
        {
          name: 'consentAccepted',
          errors: [
            'Vui lòng đồng ý với chính sách xử lý dữ liệu cá nhân (Nghị định 13/2023) để gửi yêu cầu.',
          ],
        },
      ]);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setIsRateLimited(false);

    try {
      const payload: SubmitContactRequestInput = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        companyName: values.companyName?.trim() || undefined,
        serviceInterest: values.serviceInterest,
        message: values.message.trim(),
        consentAccepted: Boolean(values.consentAccepted),
      };

      const result = await contactApi.submit(payload);
      setSubmittedEmail(payload.email);
      setReceipt(result);
      form.resetFields();
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      const apiError = getApiError(err);

      if (apiError.status === 429 || apiError.code === 'CONTACT_RATE_LIMITED') {
        setIsRateLimited(true);
        const retryText = apiError.retryAfterSeconds
          ? ` Vui lòng thử lại sau ${apiError.retryAfterSeconds} giây.`
          : '';
        setErrorMessage(`Bạn gửi quá nhiều, vui lòng thử lại sau.${retryText}`);
        return;
      }

      if (apiError.code === 'CONSENT_REQUIRED' || apiError.fieldErrors?.consentAccepted) {
        form.setFields([
          {
            name: 'consentAccepted',
            errors: [
              apiError.message ||
                'Vui lòng đồng ý với chính sách xử lý dữ liệu cá nhân theo Nghị định 13/2023.',
            ],
          },
        ]);
        setErrorMessage('Yêu cầu đồng ý xử lý dữ liệu cá nhân (Nghị định 13/2023) để tiếp tục.');
        return;
      }

      setErrorMessage(apiError.message || 'Không thể gửi yêu cầu liên hệ. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setReceipt(null);
    setErrorMessage(null);
    setIsRateLimited(false);
    form.resetFields();
  };

  if (receipt) {
    return (
      <div
        className={`${FONT} rounded-lg border border-solid border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-7 ${className}`}
      >
        <div className="rounded-lg border border-solid border-[#BBF7D0] bg-[#F0FDF4] p-5">
          <div className="flex items-start gap-3">
            <CheckCircleFilled className="mt-0.5 text-lg text-[#16A34A]" />
            <div>
              <h2 className="m-0 text-[16px] font-bold text-[#166534]">
                Gửi yêu cầu tư vấn thành công!
              </h2>
              <p className="m-0 mt-1 text-[13.5px] leading-5 text-[#166534]">
                Đã nhận yêu cầu của bạn. Chúng tôi sẽ phản hồi qua email{' '}
                {submittedEmail ? <strong className="font-semibold">{submittedEmail}</strong> : 'của bạn'}.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-solid border-[#E5E7EB] bg-[#F9FAFB] p-4 text-[13px] text-[#4B5563]">
          <div>
            <strong className="font-semibold text-[#1F2937]">Mã yêu cầu:</strong>{' '}
            <span className="font-mono text-[#111827]">{receipt.contactRequestId}</span>
          </div>
          <div className="mt-1">
            <strong className="font-semibold text-[#1F2937]">Thời gian gửi:</strong>{' '}
            {new Date(receipt.createdAt).toLocaleString('vi-VN')}
          </div>
          <div className="mt-1">
            <strong className="font-semibold text-[#1F2937]">Trạng thái:</strong>{' '}
            <span className="inline-block rounded bg-[#E0F2FE] px-2 py-0.5 text-[12px] font-bold text-[#075985]">
              {receipt.status === 'NEW'
                ? 'Đã tiếp nhận'
                : receipt.status === 'IN_PROGRESS'
                  ? 'Đang xử lý'
                  : receipt.status === 'CONTACTED'
                    ? 'Đã liên hệ'
                    : receipt.status === 'RESOLVED'
                      ? 'Đã giải quyết'
                      : receipt.status === 'CLOSED'
                        ? 'Đã đóng'
                        : receipt.status}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={handleResetForm}
            className={`${FONT} inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-solid border-[#D1D5DB] bg-white px-4 text-[14px] font-semibold text-[#1F2937] transition-all duration-200 hover:bg-[#F9FAFB] active:scale-[0.98]`}
          >
            <RedoOutlined />
            <span>Gửi thêm yêu cầu tư vấn khác</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${FONT} rounded-lg border border-solid border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-7 ${className}`}
    >
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-bold text-[#1F2937]">Liên hệ với HR Connect</h1>
        <p className="m-0 mt-1 text-[14px] text-[#4B5563]">
          Để lại thông tin, đội ngũ tư vấn sẽ liên hệ trong giờ làm việc.
        </p>
        <span className="sr-only">Đăng ký tư vấn tuyển dụng</span>
      </div>

      {isRateLimited && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-solid border-[#FED7AA] bg-[#FFF7ED] p-4 text-[13.5px] text-[#7C2D12]"
        >
          <div className="font-bold">Khi gửi quá nhiều lần</div>
          <div className="mt-0.5">
            Bạn gửi quá nhiều, vui lòng thử lại sau. Bạn đã gửi nhiều yêu cầu trong một giờ. Thử lại sau ít phút.
          </div>
        </div>
      )}

      {errorMessage && !isRateLimited && (
        <Alert
          type="error"
          showIcon
          className="mb-5 rounded-md border border-solid border-[#FECACA] bg-[#FEF2F2]"
          message="Không thể gửi yêu cầu"
          description={errorMessage}
          closable
          onClose={() => setErrorMessage(null)}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          serviceInterest: initialServiceInterest,
          consentAccepted: false,
        }}
        onFinish={handleSubmit}
        className="space-y-1"
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {/* Full Name */}
          <Form.Item
            label={
              <span className="text-[13.5px] font-medium text-[#1F2937]">
                Họ và tên <span className="text-[#DC2626]">*</span>
              </span>
            }
            name="fullName"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên của bạn' },
              { min: 2, message: 'Họ tên tối thiểu 2 ký tự' },
              { max: 100, message: 'Họ tên tối đa 100 ký tự' },
            ]}
          >
            <Input
              placeholder="Ví dụ: Nguyễn Văn A"
              size="large"
              className="h-[44px] rounded-md border-[#D1D5DB] text-[14px] hover:border-[#94A3B8] focus:border-[#0369A1]"
            />
          </Form.Item>

          {/* Email */}
          <Form.Item
            label={
              <span className="text-[13.5px] font-medium text-[#1F2937]">
                Email công việc <span className="text-[#DC2626]">*</span>
              </span>
            }
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ email' },
              { type: 'email', message: 'Địa chỉ email không hợp lệ' },
            ]}
          >
            <Input
              placeholder="name@company.com"
              size="large"
              className="h-[44px] rounded-md border-[#D1D5DB] text-[14px] hover:border-[#94A3B8] focus:border-[#0369A1]"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {/* Phone */}
          <Form.Item
            label={<span className="text-[13.5px] font-medium text-[#1F2937]">Số điện thoại</span>}
            name="phone"
            rules={[
              {
                pattern: /^[0-9+() -]{7,20}$/,
                message: 'Số điện thoại không đúng định dạng',
              },
            ]}
          >
            <Input
              placeholder="0912 345 678"
              size="large"
              className="h-[44px] rounded-md border-[#D1D5DB] text-[14px] hover:border-[#94A3B8] focus:border-[#0369A1]"
            />
          </Form.Item>

          {/* Company Name */}
          <Form.Item
            label={<span className="text-[13.5px] font-medium text-[#1F2937]">Tên công ty</span>}
            name="companyName"
            rules={[{ max: 150, message: 'Tên công ty tối đa 150 ký tự' }]}
          >
            <Input
              placeholder="Công ty TNHH An Phát"
              size="large"
              className="h-[44px] rounded-md border-[#D1D5DB] text-[14px] hover:border-[#94A3B8] focus:border-[#0369A1]"
            />
          </Form.Item>
        </div>

        {/* Service Interest */}
        <Form.Item
          label={
            <span className="text-[13.5px] font-medium text-[#1F2937]">
              Dịch vụ quan tâm <span className="text-[#DC2626]">*</span>
            </span>
          }
          name="serviceInterest"
          rules={[{ required: true, message: 'Vui lòng chọn dịch vụ bạn cần tư vấn' }]}
          extra={
            currentServiceInfo?.desc ? (
              <span className="mt-1 block text-[12px] text-[#6B7280]">{currentServiceInfo.desc}</span>
            ) : null
          }
        >
          <Select
            size="large"
            className="w-full"
            placeholder="Chọn mô hình dịch vụ"
            options={SERVICE_INTEREST_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label,
              desc: item.desc,
            }))}
            optionRender={(option) => {
              const desc = (option.data as { desc?: string })?.desc;
              return (
                <div className="py-1">
                  <div className="font-semibold text-[#1F2937]">{option.label}</div>
                  {desc && <div className="text-xs text-[#6B7280]">{desc}</div>}
                </div>
              );
            }}
          />
        </Form.Item>

        {/* Message */}
        <Form.Item
          label={
            <span className="text-[13.5px] font-medium text-[#1F2937]">
              Nội dung yêu cầu tư vấn <span className="text-[#DC2626]">*</span>
            </span>
          }
          name="message"
          rules={[
            { required: true, message: 'Vui lòng cung cấp thông tin nhu cầu tuyển dụng của bạn' },
            { min: 10, message: 'Nội dung tối thiểu 10 ký tự để chuyên viên hỗ trợ tốt nhất' },
            { max: 2000, message: 'Nội dung tối đa 2000 ký tự' },
          ]}
        >
          <TextArea
            rows={4}
            maxLength={2000}
            placeholder="Mô tả vị trí tuyển dụng, số lượng, yêu cầu kinh nghiệm hoặc các câu hỏi cần giải đáp..."
            className="rounded-md border-[#D1D5DB] text-[14px] text-[#1F2937] hover:border-[#94A3B8] focus:border-[#0369A1]"
          />
        </Form.Item>

        {/* Decree 13/2023 Consent Checkbox */}
        <Form.Item
          name="consentAccepted"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        'Vui lòng đồng ý với chính sách xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.'
                      )
                    ),
            },
          ]}
          className="mb-3"
        >
          <Checkbox className="items-start text-[13.5px] leading-5 text-[#1F2937]">
            <span>
              Tôi đồng ý để HR Connect dùng thông tin này để liên hệ tư vấn (theo{' '}
              <span className="font-medium text-[#0369A1]">Nghị định 13/2023/NĐ-CP</span>).
            </span>
          </Checkbox>
        </Form.Item>

        {/* Submit Button */}
        <Form.Item className="mb-0 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className={`${FONT} flex h-[44px] w-full cursor-pointer items-center justify-center rounded-md border-0 bg-[#0C4A6E] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-[#075985] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {submitting ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu tư vấn'}
          </button>
        </Form.Item>
      </Form>
    </div>
  );
};
