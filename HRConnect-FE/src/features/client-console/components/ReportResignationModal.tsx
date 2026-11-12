/**
 * @file ReportResignationModal.tsx
 * @description Modal cho Doanh nghiệp (Client Company) báo ứng viên nghỉ việc.
 * Cho phép chọn ngày nghỉ việc, lý do, ghi chú và hiển thị lưu ý chính sách bảo hành.
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, DatePicker, Select, Input, Button, App as AntApp } from 'antd';
import { InfoCircleOutlined, ExclamationCircleOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { PlacementItem } from '@/types/api/hr';
import { reportCandidateResignation } from '@/services/api/placementApi';
import { getApiErrorMessage } from '@/services/apiClient';

const { TextArea } = Input;

export interface ReportResignationModalProps {
  open: boolean;
  onClose: () => void;
  placement: PlacementItem | null;
  onSuccess?: () => void;
}

interface FormValues {
  resignationDate: Dayjs;
  reason: string;
  note?: string;
}

const RESIGNATION_REASONS = [
  { value: 'Ứng viên tự xin nghỉ', label: 'Ứng viên tự xin nghỉ' },
  { value: 'Không đạt thử việc', label: 'Không đạt thử việc' },
  { value: 'Doanh nghiệp cắt giảm', label: 'Doanh nghiệp cắt giảm nhân sự' },
  { value: 'Khác', label: 'Lý do khác' },
];

export const ReportResignationModal: React.FC<ReportResignationModalProps> = ({
  open,
  onClose,
  placement,
  onSuccess,
}) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const startDate = placement?.actualStartDate ? dayjs(placement.actualStartDate) : null;

  useEffect(() => {
    if (open && placement) {
      form.setFieldsValue({
        resignationDate: dayjs(),
        reason: 'Ứng viên tự xin nghỉ',
        note: '',
      });
    }
  }, [open, placement, form]);

  const handleSubmit = async (values: FormValues) => {
    if (!placement) return;

    const formattedDate = values.resignationDate.format('YYYY-MM-DD');

    // Extra validation check
    if (startDate && values.resignationDate.isBefore(startDate, 'day')) {
      message.error(`Ngày nghỉ việc không được nhỏ hơn ngày đi làm (${startDate.format('DD/MM/YYYY')}).`);
      return;
    }

    setSubmitting(true);
    try {
      // Prioritize applicationId, fallback to placementId
      const targetId = placement.applicationId || placement.placementId;
      await reportCandidateResignation(targetId, {
        resignationDate: formattedDate,
        reason: values.reason,
        note: values.note?.trim() || undefined,
      });

      message.success(`Đã ghi nhận báo nghỉ việc cho ứng viên ${placement.candidate?.fullName || ''}.`);
      onClose();
      form.resetFields();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể ghi nhận báo nghỉ việc. Vui lòng thử lại!'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={submitting ? undefined : onClose}
      footer={null}
      width={540}
      destroyOnHidden
      centered
      title={
        <div className="flex items-center gap-2.5 pb-2 text-slate-900 border-0 border-b border-solid border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80">
            <ExclamationCircleOutlined className="text-base" />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold text-slate-900">Báo nhân sự nghỉ việc</h3>
            <p className="m-0 text-xs text-slate-500 font-normal">
              Ghi nhận kết thúc công việc và cập nhật hồ sơ tiếp nhận
            </p>
          </div>
        </div>
      }
    >
      {placement && (
        <div className="py-3 space-y-4">
          {/* Candidate Snapshot Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 font-bold border border-slate-200 text-sm shadow-2xs">
                {placement.candidate?.fullName ? placement.candidate.fullName.charAt(0).toUpperCase() : <UserOutlined />}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{placement.candidate?.fullName}</div>
                <div className="text-xs text-slate-500">{placement.job?.title || 'Vị trí tuyển dụng'}</div>
              </div>
            </div>
            {startDate && (
              <div className="text-right">
                <span className="block text-[11px] text-slate-500 font-medium">Ngày bắt đầu làm:</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                  <CalendarOutlined className="text-emerald-600" />
                  {startDate.format('DD/MM/YYYY')}
                </span>
              </div>
            )}
          </div>

          {/* Warranty Warning Callout (UX Highlight) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
            <InfoCircleOutlined className="mt-0.5 text-amber-600 text-sm shrink-0" />
            <div className="leading-relaxed">
              <strong className="font-semibold block mb-0.5 text-amber-950">Chính sách bảo hành ứng viên:</strong>
              Nếu ứng viên nghỉ trong thời hạn bảo hành, hệ thống sẽ hỗ trợ tạo yêu cầu đổi/bù ứng viên sau khi xác nhận.
            </div>
          </div>

          {/* Form Content */}
          <Form<FormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            className="space-y-4 pt-1"
          >
            <Form.Item
              name="resignationDate"
              label={<span className="text-xs font-bold text-slate-700">Ngày nghỉ việc <span className="text-rose-500">*</span></span>}
              rules={[
                { required: true, message: 'Vui lòng chọn ngày nghỉ việc.' },
                () => ({
                  validator(_, value: Dayjs | null) {
                    if (!value || !startDate) return Promise.resolve();
                    if (value.isBefore(startDate, 'day')) {
                      return Promise.reject(new Error(`Ngày nghỉ việc không được nhỏ hơn ngày đi làm (${startDate.format('DD/MM/YYYY')}).`));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
              className="mb-3"
            >
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="Chọn ngày nghỉ việc"
                className="w-full h-10 rounded-xl"
                disabledDate={(current) => (startDate ? current.isBefore(startDate, 'day') : false)}
              />
            </Form.Item>

            <Form.Item
              name="reason"
              label={<span className="text-xs font-bold text-slate-700">Lý do nghỉ việc <span className="text-rose-500">*</span></span>}
              rules={[{ required: true, message: 'Vui lòng chọn lý do nghỉ việc.' }]}
              className="mb-3"
            >
              <Select
                options={RESIGNATION_REASONS}
                placeholder="Chọn lý do nghỉ việc"
                className="w-full h-10"
              />
            </Form.Item>

            <Form.Item
              name="note"
              label={<span className="text-xs font-bold text-slate-700">Ghi chú chi tiết <span className="text-slate-400 font-normal">(tùy chọn)</span></span>}
              rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}
              className="mb-4"
            >
              <TextArea
                rows={3}
                placeholder="Ghi chú thêm về hoàn cảnh nghỉ việc hoặc thỏa thuận bàn giao công việc..."
                className="rounded-xl text-xs"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-0 border-t border-solid border-slate-100">
              <Button
                type="default"
                disabled={submitting}
                onClick={onClose}
                className="h-9 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
              >
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={submitting}
                className="h-9 px-5 rounded-xl !bg-rose-600 hover:!bg-rose-700 !border-0 text-white font-semibold shadow-xs active:scale-[0.98]"
              >
                Xác nhận báo nghỉ
              </Button>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};

export default ReportResignationModal;
