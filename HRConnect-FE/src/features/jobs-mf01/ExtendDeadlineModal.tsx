/**
 * @file ExtendDeadlineModal.tsx
 * @description Modal cho phép Doanh nghiệp gia hạn hạn nộp hồ sơ (ApplicationDeadline)
 * của tin tuyển dụng đang ở trạng thái PENDING_AGREEMENT hoặc PENDING_PAYMENT để mở khóa ký hợp đồng / thanh toán.
 */
import React, { useEffect, useState } from 'react';
import { DatePicker, Modal, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { formatDate } from './jobDisplay';

const { Text } = Typography;

export interface ExtendDeadlineModalProps {
  open: boolean;
  jobTitle: string;
  currentDeadline?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (newDeadlineIso: string) => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  open,
  jobTitle,
  currentDeadline,
  loading = false,
  onCancel,
  onConfirm,
}) => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedDate(dayjs().add(14, 'day'));
    }
  }, [open]);

  const disabledDate = (current: Dayjs) => current.isBefore(dayjs().startOf('day'));

  const handleOk = () => {
    if (!selectedDate) return;
    onConfirm(selectedDate.endOf('day').toISOString());
  };

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-[#0284C7]" />
          <span>Gia hạn hạn nộp hồ sơ</span>
        </div>
      }
      okText="Lưu hạn nộp mới"
      cancelText="Hủy"
      confirmLoading={loading}
      okButtonProps={{
        disabled: !selectedDate,
        className: '!bg-[#0284C7] hover:!bg-[#0369A1] !border-0 font-semibold',
      }}
      onCancel={onCancel}
      onOk={handleOk}
      width={460}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
          <div className="font-bold text-slate-900 text-sm line-clamp-2">{jobTitle}</div>
          <div className="text-slate-600">
            Hạn nộp hiện tại:{' '}
            <span className="font-semibold text-rose-600">
              {currentDeadline ? `${formatDate(currentDeadline)} (Đã hết hạn)` : 'Chưa thiết lập'}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Text strong className="text-xs text-slate-700 block">
            Chọn hạn nhận hồ sơ mới (từ hôm nay trở đi)
          </Text>
          <DatePicker
            value={selectedDate}
            onChange={(val) => setSelectedDate(val)}
            disabledDate={disabledDate}
            format="DD/MM/YYYY"
            placeholder="Chọn ngày hạn nộp mới"
            className="w-full !h-10 !rounded-xl"
          />
          <p className="text-xs text-slate-500 m-0">
            Sau khi cập nhật hạn nộp sang ngày ở tương lai, bạn có thể tiếp tục ký thỏa thuận dịch vụ ngay lập tức mà không cần duyệt lại nội dung tin.
          </p>
        </div>
      </div>
    </Modal>
  );
};
