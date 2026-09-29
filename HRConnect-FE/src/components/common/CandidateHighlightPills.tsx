import React from 'react';
import {
  CalendarOutlined,
  DollarOutlined,
  GlobalOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';

export interface CandidateHighlightPillsProps {
  yearsOfExperience?: number;
  currentSalary?: number;
  expectedSalary?: number;
  language?: string;
  languageLevel?: string;
  availabilityDate?: string;
  noticePeriodDays?: number;
  className?: string;
}

export const formatCurrencyShort = (amount?: number): string => {
  if (!amount || amount === 0) return 'Thoả thuận';
  if (amount >= 1000000) {
    const millions = (amount / 1000000).toFixed(0);
    return `${millions}M`;
  }
  return `${amount.toLocaleString('vi-VN')} đ`;
};

export const CandidateHighlightPills: React.FC<CandidateHighlightPillsProps> = ({
  yearsOfExperience,
  currentSalary,
  expectedSalary,
  language = 'Tiếng Anh',
  languageLevel,
  availabilityDate,
  noticePeriodDays,
  className = '',
}) => {
  // Salary formatted: current -> expected
  const salaryDisplay = React.useMemo(() => {
    if (!expectedSalary && !currentSalary) return 'Lương: Thoả thuận';
    if (currentSalary && expectedSalary) {
      return `${formatCurrencyShort(currentSalary)} → ${formatCurrencyShort(expectedSalary)}/tháng`;
    }
    if (expectedSalary) {
      return `Kỳ vọng: ${formatCurrencyShort(expectedSalary)}/tháng`;
    }
    return `Hiện tại: ${formatCurrencyShort(currentSalary)}/tháng`;
  }, [currentSalary, expectedSalary]);

  // Availability display
  const availabilityDisplay = React.useMemo(() => {
    if (!availabilityDate && (noticePeriodDays === undefined || noticePeriodDays === 0)) {
      return 'Sẵn sàng ngay';
    }
    if (noticePeriodDays && noticePeriodDays > 0) {
      return `Báo trước ${noticePeriodDays} ngày`;
    }
    if (availabilityDate) {
      const d = new Date(availabilityDate);
      if (!isNaN(d.getTime())) {
        return `Từ ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
      }
    }
    return 'Sẵn sàng làm việc';
  }, [availabilityDate, noticePeriodDays]);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* 1. Experience Pill */}
      {yearsOfExperience !== undefined && (
        <Tooltip title="Tổng số năm kinh nghiệm làm việc tích lũy">
          <span className="b2b-data-pill hover:border-slate-300 transition-colors">
            <HistoryOutlined className="text-blue-500 text-xs" />
            <span className="text-slate-700 font-semibold">{yearsOfExperience} năm EXP</span>
          </span>
        </Tooltip>
      )}

      {/* 2. Salary Pill (Current -> Expected) */}
      <Tooltip title="Mức lương hiện tại → Mức lương mong muốn đề xuất">
        <span className="b2b-data-pill hover:border-slate-300 transition-colors">
          <DollarOutlined className="text-emerald-600 text-xs" />
          <span className="text-slate-800 font-mono font-medium">{salaryDisplay}</span>
        </span>
      </Tooltip>

      {/* 3. Language Pill */}
      <Tooltip title="Trình độ ngoại ngữ chuyên môn">
        <span className="b2b-data-pill hover:border-slate-300 transition-colors">
          <GlobalOutlined className="text-indigo-600 text-xs" />
          <span className="text-slate-700">
            {language}
            {languageLevel ? ` (${languageLevel})` : ''}
          </span>
        </span>
      </Tooltip>

      {/* 4. Availability Pill */}
      <Tooltip title="Thời gian sẵn sàng Onboarding nhận việc">
        <span className="b2b-data-pill hover:border-slate-300 transition-colors">
          <CalendarOutlined className="text-amber-600 text-xs" />
          <span className="text-slate-700">{availabilityDisplay}</span>
        </span>
      </Tooltip>
    </div>
  );
};
