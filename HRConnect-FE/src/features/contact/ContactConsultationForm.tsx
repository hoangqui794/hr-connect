import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  Checkbox,
  Button,
  Alert,
  Result,
  Typography,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  SendOutlined,
  CheckCircleFilled,
  RedoOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { contactApi } from '@/services/api/contactApi';
import { getApiError } from '@/services/apiClient';
import type {
  ContactRequestReceipt,
  ContactServiceInterest,
  SubmitContactRequestInput,
} from '@/types/api/contact';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const SERVICE_INTEREST_OPTIONS: { value: ContactServiceInterest; label: string; desc: string }[] = [
  {
    value: 'HEADHUNT_COD',
    label: 'Tuyển trọn gói (Headhunt COD)',
    desc: 'Phí thành công, bảo hành và đồng hành trọn quy trình',
  },
  {
    value: 'CV_SOURCING',
    label: 'Cung cấp hồ sơ (CV Sourcing)',
    desc: 'Bàn giao danh sách CV đã qua sàng lọc chuyên sâu',
  },
  {
    value: 'CV_APPLICATION',
    label: 'Đăng tin tuyển dụng (Job Posting)',
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
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ContactRequestReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    // Client-side guard for Decree 13/2023 consent
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
      <div className={`rounded-2xl border border-solid border-slate-200 bg-white p-8 shadow-sm ${className}`}>
        <Result
          status="success"
          icon={<CheckCircleFilled className="text-emerald-500 text-5xl" />}
          title={
            <span className="text-2xl font-extrabold text-slate-900">
              Gửi yêu cầu tư vấn thành công!
            </span>
          }
          subTitle={
            <div className="mx-auto max-w-lg space-y-3 text-slate-600">
              <Paragraph className="mb-0 text-base">
                Cảm ơn bạn đã quan tâm đến dịch vụ tuyển dụng của HRConnect. Đội ngũ chuyên viên tư vấn
                sẽ liên hệ lại với bạn trong vòng <strong>24 giờ làm việc</strong>.
              </Paragraph>
              <div className="rounded-xl border border-solid border-slate-100 bg-slate-50 p-4 text-left text-xs text-slate-600">
                <div>
                  <strong>Mã yêu cầu:</strong>{' '}
                  <span className="font-mono text-slate-900">{receipt.contactRequestId}</span>
                </div>
                <div className="mt-1">
                  <strong>Thời gian gửi:</strong>{' '}
                  {new Date(receipt.createdAt).toLocaleString('vi-VN')}
                </div>
                <div className="mt-1">
                  <strong>Trạng thái:</strong>{' '}
                  <span className="inline-block rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-700">
                    {receipt.status === 'NEW' ? 'Đã tiếp nhận' : receipt.status === 'IN_PROGRESS' ? 'Đang xử lý' : receipt.status === 'CONTACTED' ? 'Đã liên hệ' : receipt.status === 'RESOLVED' ? 'Đã giải quyết' : receipt.status === 'CLOSED' ? 'Đã đóng' : receipt.status}
                  </span>
                </div>
              </div>
            </div>
          }
          extra={[
            <Button
              key="new-request"
              type="primary"
              icon={<RedoOutlined />}
              onClick={handleResetForm}
              className="h-11 rounded-xl bg-blue-600 px-6 font-bold"
            >
              Gửi thêm yêu cầu tư vấn khác
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-solid border-slate-200 bg-white p-6 sm:p-8 shadow-sm ${className}`}>
      <div className="mb-6">
        <h3 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
          Đăng ký tư vấn tuyển dụng
        </h3>
        <p className="mb-0 text-sm text-slate-500">
          Điền thông tin bên dưới để chuyên viên giải pháp nhân sự liên hệ tư vấn trực tiếp.
        </p>
      </div>

      {isRateLimited && (
        <Alert
          type="warning"
          showIcon
          className="mb-5 rounded-xl border border-solid border-amber-200 bg-amber-50"
          message="Bạn gửi quá nhiều, vui lòng thử lại sau"
          description="Hệ thống đã nhận nhiều yêu cầu từ bạn trong thời gian ngắn. Vui lòng đợi ít phút trước khi thử lại."
        />
      )}

      {errorMessage && !isRateLimited && (
        <Alert
          type="error"
          showIcon
          className="mb-5 rounded-xl border border-solid border-rose-200 bg-rose-50"
          message="Không thể gửi yêu cầu"
          description={errorMessage}
          closable
          onClose={() => setErrorMessage(null)}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          serviceInterest: initialServiceInterest,
          consentAccepted: false,
        }}
        onFinish={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {/* Full Name */}
          <Form.Item
            label={<span className="font-semibold text-slate-800">Họ và tên</span>}
            name="fullName"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên của bạn' },
              { min: 2, message: 'Họ tên tối thiểu 2 ký tự' },
              { max: 100, message: 'Họ tên tối đa 100 ký tự' },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-slate-400" />}
              placeholder="Ví dụ: Nguyễn Văn A"
              size="large"
              className="rounded-xl border-slate-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>

          {/* Email */}
          <Form.Item
            label={<span className="font-semibold text-slate-800">Email công việc</span>}
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ email' },
              { type: 'email', message: 'Địa chỉ email không hợp lệ' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-400" />}
              placeholder="name@company.com"
              size="large"
              className="rounded-xl border-slate-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {/* Phone */}
          <Form.Item
            label={<span className="font-semibold text-slate-800">Số điện thoại (tùy chọn)</span>}
            name="phone"
            rules={[
              {
                pattern: /^[0-9+() -]{7,20}$/,
                message: 'Số điện thoại không đúng định dạng',
              },
            ]}
          >
            <Input
              prefix={<PhoneOutlined className="text-slate-400" />}
              placeholder="0912 345 678"
              size="large"
              className="rounded-xl border-slate-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>

          {/* Company Name */}
          <Form.Item
            label={<span className="font-semibold text-slate-800">Tên doanh nghiệp (tùy chọn)</span>}
            name="companyName"
            rules={[{ max: 150, message: 'Tên công ty tối đa 150 ký tự' }]}
          >
            <Input
              prefix={<BankOutlined className="text-slate-400" />}
              placeholder="Công ty Cổ phần ABC"
              size="large"
              className="rounded-xl border-slate-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>
        </div>

        {/* Service Interest */}
        <Form.Item
          label={<span className="font-semibold text-slate-800">Dịch vụ quan tâm</span>}
          name="serviceInterest"
          rules={[{ required: true, message: 'Vui lòng chọn dịch vụ bạn cần tư vấn' }]}
        >
          <Select
            size="large"
            className="w-full"
            placeholder="Chọn mô hình dịch vụ"
            options={SERVICE_INTEREST_OPTIONS.map((item) => ({
              value: item.value,
              label: (
                <div className="py-1">
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              ),
            }))}
          />
        </Form.Item>

        {/* Message */}
        <Form.Item
          label={<span className="font-semibold text-slate-800">Nội dung yêu cầu tư vấn</span>}
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
            showCount
            placeholder="Mô tả vị trí tuyển dụng, số lượng, yêu cầu kinh nghiệm hoặc các câu hỏi cần giải đáp..."
            className="rounded-xl border-slate-300 text-slate-900"
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
          className="mb-4"
        >
          <Checkbox className="items-start text-xs text-slate-700 leading-5">
            <span>
              Tôi đồng ý cho phép <strong>HRConnect</strong> thu thập và xử lý dữ liệu cá nhân được cung
              cấp ở trên cho mục đích tư vấn dịch vụ tuyển dụng, theo quy định của{' '}
              <span className="font-semibold text-blue-700 underline underline-offset-2">
                Nghị định 13/2023/NĐ-CP
              </span>{' '}
              về bảo vệ dữ liệu cá nhân.
            </span>
          </Checkbox>
        </Form.Item>

        {/* Submit Button */}
        <Form.Item className="mb-0 pt-2">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={submitting}
            icon={<SendOutlined />}
            className="h-12 rounded-xl bg-blue-600 text-base font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
          >
            {submitting ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu tư vấn miễn phí'}
          </Button>
        </Form.Item>

        <div className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-slate-400">
          <SafetyCertificateOutlined className="text-emerald-500" />
          <span>Thông tin của bạn được cam kết bảo mật và không chia sẻ cho bên thứ ba.</span>
        </div>
      </Form>
    </div>
  );
};
