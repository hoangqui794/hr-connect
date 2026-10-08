/**
 * @file components/common/ChangePasswordModal.tsx
 * @description Modal dialog for authenticated users to change their password (PUT /api/v1/auth/change-password).
 */
import React, { useState } from 'react';
import { Form, Input, Modal, App as AntApp } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authService, ChangePasswordCommand } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<ChangePasswordCommand>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: ChangePasswordCommand) => {
    try {
      setLoading(true);
      const res = await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      message.success(res.message || 'Đổi mật khẩu thành công!');
      form.resetFields();
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại!'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      form.resetFields();
      onClose();
    }
  };

  return (
    <Modal
      title="Đổi mật khẩu tài khoản"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Lưu mật khẩu mới"
      cancelText="Hủy"
      destroyOnClose
    >
      <div className="mb-4 text-xs text-slate-500">
        Để bảo vệ tài khoản của bạn, vui lòng nhập mật khẩu hiện tại và tạo mật khẩu mới có ít nhất 8 ký tự.
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
        disabled={loading}
      >
        <Form.Item
          name="currentPassword"
          label="Mật khẩu hiện tại"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại!' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400" />}
            placeholder="Nhập mật khẩu hiện tại"
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
            { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự!' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400" />}
            placeholder="Tối thiểu 8 ký tự"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Xác nhận mật khẩu mới"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Vui lòng xác nhận mật khẩu mới!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400" />}
            placeholder="Nhập lại mật khẩu mới"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
