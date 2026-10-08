/**
 * @file ReasonModal.tsx
 * @description Confirmation dialog for job actions that need a reason (reject, close, pause).
 * Field rules match the backend validators: reasonCode from a fixed list, reasonText
 * required for reject/close (max 2000), optional for pause.
 */
import React, { useEffect } from 'react';
import { Form, Input, Modal, Radio, Space, Typography } from 'antd';

export interface ReasonModalValues {
  reasonCode?: string;
  reasonText: string;
  reason?: string;
}

interface ReasonModalProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  /** Omit for actions without a reason code (pause). */
  reasonOptions?: { value: string; label: string }[];
  textRequired: boolean;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (values: ReasonModalValues) => void;
}

export const ReasonModal: React.FC<ReasonModalProps> = ({
  open,
  title,
  description,
  confirmText,
  reasonOptions,
  textRequired,
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}) => {
  const [form] = Form.useForm<ReasonModalValues>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText="Hủy"
      okButtonProps={{ danger, loading }}
      cancelButtonProps={{ disabled: loading }}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={onConfirm} requiredMark="optional">
        {reasonOptions && (
          <Form.Item
            name="reasonCode"
            label="Lý do"
            rules={[{ required: true, message: 'Chọn một lý do.' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {reasonOptions.map((o) => (
                  <Radio key={o.value} value={o.value}>
                    {o.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>
        )}
        <Form.Item
          name="reasonText"
          label={reasonOptions ? 'Giải thích chi tiết' : 'Ghi chú'}
          rules={[
            ...(textRequired ? [{ required: true, whitespace: true, message: 'Nhập nội dung giải thích.' }] : []),
            { max: 2000, message: 'Tối đa 2000 ký tự.' },
          ]}
          validateTrigger="onBlur"
        >
          <Input.TextArea rows={4} showCount maxLength={2000} placeholder="Viết rõ để người nhận biết cần làm gì tiếp theo." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReasonModal;
