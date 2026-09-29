import React from 'react';
import { SafetyCertificateOutlined, LockOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';

interface AntiDuplicationBadgeProps {
  timestamp?: string | Date;
  affiliateName?: string;
  isDuplicate?: boolean;
  className?: string;
}

export const AntiDuplicationBadge: React.FC<AntiDuplicationBadgeProps> = ({
  timestamp,
  affiliateName,
  isDuplicate = false,
  className = '',
}) => {
  const formattedTime = React.useMemo(() => {
    if (!timestamp) return dayjs().format('HH:mm:ss DD/MM');
    const d = dayjs(timestamp);
    return d.isValid() ? d.format('HH:mm:ss DD/MM') : dayjs().format('HH:mm:ss DD/MM');
  }, [timestamp]);

  if (isDuplicate) {
    return (
      <Tooltip title="Cảnh báo: Hồ sơ trùng lặp với lượt nộp trước đó. Hệ thống giải quyết dựa trên First-Submission Timestamp.">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-50 text-rose-600 border border-rose-200 ${className}`}
        >
          <LockOutlined className="text-[11px]" />
          <span>Trùng lặp • {formattedTime}</span>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        <div className="text-xs p-1">
          <div className="font-bold text-sky-600 mb-0.5">🛡️ Bảo chứng First-Submission bất biến</div>
          <div className="text-slate-600">
            Hồ sơ được ghi nhận mốc nộp lúc <span className="font-mono font-semibold text-slate-800">{formattedTime}</span>.
            {affiliateName ? ` Thuộc quyền CTV: ${affiliateName}.` : ''}
          </div>
          <div className="text-slate-500 text-[11px] mt-1 border-t border-slate-200 pt-1">
            Chống tranh chấp hoa hồng & bảo vệ quyền lợi Headhunter 100%.
          </div>
        </div>
      }
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:border-sky-300 transition-colors cursor-help ${className}`}
      >
        <SafetyCertificateOutlined className="text-sky-600 text-xs" />
        <span className="text-[11px] tracking-tight font-medium">First-Submission: {formattedTime}</span>
      </span>
    </Tooltip>
  );
};
