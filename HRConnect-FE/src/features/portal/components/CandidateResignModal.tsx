/**
 * @file CandidateResignModal.tsx
 * @description Modal dành cho Ứng viên tự xác nhận đã nghỉ việc.
 * Giúp cập nhật lịch sử làm việc và mở lại trạng thái Sẵn sàng tìm việc.
 */
import React, { useState } from 'react';
import { DatePicker, Input, Select, App as AntApp } from 'antd';
import { InfoCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  CandidateDialog,
  DIALOG_CANCEL,
  DIALOG_PRIMARY,
  DIALOG_FONT,
} from '../candidate/CandidateDialog';
import { selfReportResignation } from '@/services/api/placementApi';
import { getApiErrorMessage } from '@/services/apiClient';

const { TextArea } = Input;

export interface CandidateResignModalProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  jobTitle: string;
  companyName?: string;
  startDate?: string | null;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  { value: 'Tìm kiếm cơ hội phát triển mới', label: 'Tìm kiếm cơ hội phát triển mới' },
  { value: 'Đã hoàn thành dự án/hợp đồng', label: 'Đã hoàn thành dự án / hợp đồng' },
  { value: 'Kế hoạch cá nhân / Gia đình', label: 'Kế hoạch cá nhân / Gia đình' },
  { value: 'Môi trường hoặc định hướng chưa phù hợp', label: 'Môi trường hoặc định hướng chưa phù hợp' },
  { value: 'Khác', label: 'Lý do khác' },
];

export const CandidateResignModal: React.FC<CandidateResignModalProps> = ({
  open,
  onClose,
  applicationId,
  jobTitle,
  companyName,
  startDate,
  onSuccess,
}) => {
  const { message } = AntApp.useApp();
  const [resignationDate, setResignationDate] = useState<Dayjs | null>(dayjs());
  const [reason, setReason] = useState<string>('Tìm kiếm cơ hội phát triển mới');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const parsedStartDate = startDate ? dayjs(startDate) : null;

  const handleConfirm = async () => {
    if (!resignationDate) {
      message.error('Vui lòng chọn ngày nghỉ việc.');
      return;
    }

    if (parsedStartDate && resignationDate.isBefore(parsedStartDate, 'day')) {
      message.error(`Ngày nghỉ việc không được nhỏ hơn ngày nhận việc (${parsedStartDate.format('DD/MM/YYYY')}).`);
      return;
    }

    setSubmitting(true);
    try {
      await selfReportResignation(applicationId, {
        resignationDate: resignationDate.format('YYYY-MM-DD'),
        reason,
        note: note.trim() || undefined,
      });

      message.success('Đã cập nhật trạng thái nghỉ việc. Bạn có thể bắt đầu tìm kiếm cơ hội mới!');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể cập nhật trạng thái nghỉ việc. Vui lòng thử lại!'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CandidateDialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Cập nhật đã nghỉ việc"
      subtitle={[jobTitle, companyName].filter(Boolean).join(' · ')}
      width={520}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className={DIALOG_CANCEL}
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={submitting || !resignationDate}
            onClick={handleConfirm}
            className={DIALOG_PRIMARY}
          >
            {submitting ? 'Đang cập nhật…' : 'Xác nhận kết thúc công việc'}
          </button>
        </>
      }
    >
      {/* Information Highlight Box */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/80 p-3.5 text-[13px] text-sky-950">
        <InfoCircleOutlined className="mt-0.5 text-sky-600 text-sm shrink-0" />
        <div className="leading-relaxed">
          Xác nhận kết thúc công việc này sẽ cập nhật lịch sử làm việc và mở lại trạng thái{' '}
          <strong className="font-semibold text-sky-900">Sẵn sàng tìm việc</strong> để bạn ứng tuyển hoặc nhận lời mời mới.
        </div>
      </div>

      {parsedStartDate && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600 border border-slate-200/80">
          <span>Ngày bắt đầu nhận việc:</span>
          <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
            <CalendarOutlined className="text-emerald-600" />
            {parsedStartDate.format('DD/MM/YYYY')}
          </span>
        </div>
      )}

      {/* Date Picker Input */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[#374151]">
          Ngày nghỉ việc <span className="text-rose-500">*</span>
        </span>
        <DatePicker
          value={resignationDate}
          onChange={(date) => setResignationDate(date)}
          format="DD/MM/YYYY"
          placeholder="Chọn ngày nghỉ việc"
          className="h-10 w-full rounded-md"
          disabledDate={(current) => (parsedStartDate ? current.isBefore(parsedStartDate, 'day') : false)}
        />
      </label>

      {/* Reason Selector */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[#374151]">
          Lý do nghỉ việc <span className="text-slate-400 font-normal">(tùy chọn)</span>
        </span>
        <Select
          value={reason}
          onChange={(val) => setReason(val)}
          options={COMMON_REASONS}
          className="h-10 w-full"
        />
      </label>

      {/* Note textarea */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[#374151]">
          Ghi chú thêm <span className="text-slate-400 font-normal">(tùy chọn)</span>
        </span>
        <TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Đã bàn giao đầy đủ công việc và tài sản cho công ty..."
          className={`${DIALOG_FONT} text-[13px] rounded-md`}
          maxLength={300}
          showCount
        />
      </label>
    </CandidateDialog>
  );
};

export default CandidateResignModal;

