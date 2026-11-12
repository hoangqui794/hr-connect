/**
 * @file components/common/ChangePasswordModal.tsx
 * @description Modal dialog for authenticated users to change their password (PUT /api/v1/auth/change-password).
 * Designed following Vercel & Anthropic guidelines: real-time strength meter, accessible inputs, clean fintech palette.
 */
import React, { useMemo, useState } from 'react';
import { Form, Input, Modal, App as AntApp } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, KeyOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
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
  const [newPassword, setNewPassword] = useState('');

  // Password strength calculation
  const strength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Yếu', color: 'bg-rose-500', textColor: 'text-rose-600' };
      case 2:
        return { score: 2, label: 'Trung bình', color: 'bg-amber-500', textColor: 'text-amber-600' };
      case 3:
        return { score: 3, label: 'Khá', color: 'bg-sky-500', textColor: 'text-sky-600' };
      case 4:
        return { score: 4, label: 'Rất mạnh', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
      default:
        return { score: 1, label: 'Rất ngắn', color: 'bg-rose-400', textColor: 'text-rose-500' };
    }
  }, [newPassword]);

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
      setNewPassword('');
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
      setNewPassword('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
      centered
      width={480}
      className="change-password-modal [&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!p-6 [&_.ant-modal-content]:!shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-start gap-3.5 pb-4 border-0 border-b border-solid border-slate-100">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shadow-xs">
          <KeyOutlined className="text-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[17px] font-bold text-slate-900 leading-tight">Đổi mật khẩu tài khoản</h3>
          <p className="mt-1 m-0 text-[13px] text-slate-500 leading-relaxed">
            Nhập mật khẩu hiện tại và tạo mật khẩu mới an toàn để bảo vệ tài khoản của bạn.
          </p>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        disabled={loading}
        className="pt-4"
      >
        <Form.Item
          name="currentPassword"
          label={<span className="text-[13px] font-semibold text-slate-700">Mật khẩu hiện tại</span>}
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại!' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400 mr-1" />}
            placeholder="Nhập mật khẩu đang sử dụng"
            className="!h-10 !rounded-lg !border-slate-300 hover:!border-sky-500 focus:!border-sky-500 focus:!ring-2 focus:!ring-sky-100 text-[14px]"
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label={<span className="text-[13px] font-semibold text-slate-700">Mật khẩu mới</span>}
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
            { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự!' },
          ]}
          className="!mb-2"
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400 mr-1" />}
            placeholder="Tối thiểu 8 ký tự"
            onChange={(e) => setNewPassword(e.target.value)}
            className="!h-10 !rounded-lg !border-slate-300 hover:!border-sky-500 focus:!border-sky-500 focus:!ring-2 focus:!ring-sky-100 text-[14px]"
          />
        </Form.Item>

        {/* Live Password Strength Meter */}
        {newPassword && (
          <div className="mb-4 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-medium">Độ bảo mật:</span>
              <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 h-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-full rounded-full transition-all duration-300 ${
                    step <= strength.score ? strength.color : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-slate-500 flex items-center gap-1.5">
              {newPassword.length >= 8 ? (
                <CheckCircleFilled className="text-emerald-500" />
              ) : (
                <CloseCircleFilled className="text-slate-300" />
              )}
              <span>Tối thiểu 8 ký tự, nên kèm cả chữ hoa, chữ số hoặc ký tự đặc biệt</span>
            </div>
          </div>
        )}

        <Form.Item
          name="confirmPassword"
          label={<span className="text-[13px] font-semibold text-slate-700">Xác nhận mật khẩu mới</span>}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Vui lòng xác nhận mật khẩu mới!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Mật khẩu xác nhận không trùng khớp!'));
              },
            }),
          ]}
          className="!mb-5"
        >
          <Input.Password
            prefix={<SafetyCertificateOutlined className="text-slate-400 mr-1" />}
            placeholder="Nhập lại mật khẩu mới"
            className="!h-10 !rounded-lg !border-slate-300 hover:!border-sky-500 focus:!border-sky-500 focus:!ring-2 focus:!ring-sky-100 text-[14px]"
          />
        </Form.Item>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="h-10 px-4 rounded-lg border border-solid border-slate-300 bg-white text-[13.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 rounded-lg border-0 bg-gradient-to-r from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#075985] text-white text-[13.5px] font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
          </button>
        </div>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
