import React from 'react';
import { ScoreTier, getScoreTier } from '@/types/candidate';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface ScoreTierTagProps {
  score?: number;
  tier?: ScoreTier;
  showScore?: boolean;
  className?: string;
  size?: 'small' | 'middle';
}

export const ScoreTierTag: React.FC<ScoreTierTagProps> = ({
  score,
  tier,
  showScore = true,
  className = '',
  size = 'middle',
}) => {
  const resolvedTier = tier ?? (score !== undefined ? getScoreTier(score) : ScoreTier.WEAK);

  // Exact 4 color-tier badges (Modern Light SaaS):
  // >= 80%: Ruby/rose (bg-rose-50 text-rose-600 border border-rose-200) + "Top Match"
  // 70 - 79%: Teal (bg-teal-50 text-teal-700 border border-teal-200)
  // 60 - 69%: Emerald (bg-emerald-50 text-emerald-700 border border-emerald-200)
  // < 60%: Slate (bg-slate-100 text-slate-600 border border-slate-200)

  let badgeStyle = {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    label: 'Chưa phù hợp',
    icon: null as React.ReactNode,
  };

  if (score !== undefined) {
    if (score >= 80) {
      badgeStyle = {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        border: 'border-rose-200',
        label: 'Top Match',
        icon: <ThunderboltOutlined style={{ fontSize: 11 }} />,
      };
    } else if (score >= 70) {
      badgeStyle = {
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        label: 'Phù hợp cao',
        icon: <RobotOutlined style={{ fontSize: 11 }} />,
      };
    } else if (score >= 60) {
      badgeStyle = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Phù hợp',
        icon: <RobotOutlined style={{ fontSize: 11 }} />,
      };
    } else {
      badgeStyle = {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        label: 'Cần cân nhắc',
        icon: null,
      };
    }
  } else {
    switch (resolvedTier) {
      case ScoreTier.TOP_FIT:
        badgeStyle = {
          bg: 'bg-rose-50',
          text: 'text-rose-600',
          border: 'border-rose-200',
          label: 'Top Match',
          icon: <ThunderboltOutlined style={{ fontSize: 11 }} />,
        };
        break;
      case ScoreTier.STRONG:
        badgeStyle = {
          bg: 'bg-teal-50',
          text: 'text-teal-700',
          border: 'border-teal-200',
          label: 'Phù hợp cao',
          icon: <RobotOutlined style={{ fontSize: 11 }} />,
        };
        break;
      case ScoreTier.MODERATE:
        badgeStyle = {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          label: 'Phù hợp',
          icon: <RobotOutlined style={{ fontSize: 11 }} />,
        };
        break;
      default:
        badgeStyle = {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          label: 'Cần cân nhắc',
          icon: null,
        };
        break;
    }
  }

  const isSmall = size === 'small';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} ${
        isSmall ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } ${className}`}
    >
      {badgeStyle.icon}
      <span>{badgeStyle.label}</span>
      {showScore && score !== undefined && (
        <span className="font-mono font-bold ml-0.5 opacity-90">
          {score}%
        </span>
      )}
    </span>
  );
};
