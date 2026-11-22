import React from 'react';
import { HeartFilled } from '@ant-design/icons';
import { MATCH_TIER_STYLE, matchTierOf } from './matchTierStyle';

export interface AiScoreProps {
  score: number | null | undefined;
  tier?: string | null;
  status?: string | null;
  compact?: boolean;
}

export const AiScore: React.FC<AiScoreProps> = ({ score, tier, status, compact }) => {
  if (score == null) {
    const st = status?.toUpperCase();
    if (st === 'PENDING' || st === 'PROCESSING') {
      return <span className="text-xs text-[#0284C7] font-medium">Đang chấm…</span>;
    }
    if (st === 'FAILED') {
      return <span className="text-xs text-red-600 font-semibold">Chấm lỗi</span>;
    }
    return <span className="text-xs text-slate-400 font-medium">Chưa có điểm</span>;
  }

  const rounded = Math.round(score);
  const tierKey = matchTierOf(score, tier);
  const t = tierKey ? MATCH_TIER_STYLE[tierKey] : null;
  const barColor = t?.bar ?? 'bg-slate-400';
  const textColor = t?.text ?? 'text-slate-600';

  return (
    <div
      className="inline-flex flex-col gap-1"
      title={t?.label ? `Điểm AI: ${rounded}% (${t.label})` : `Điểm AI: ${rounded}%`}
    >
      <div className="inline-flex items-center gap-2 whitespace-nowrap">
        <div className={`${compact ? 'w-10' : 'w-16'} h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 ring-1 ring-black/5`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }}
          />
        </div>
        <span className={`text-xs font-bold tabular-nums min-w-[32px] ${textColor}`}>{rounded}%</span>
      </div>
      {t && (
        <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded border leading-none w-fit ${t.badge}`}>
          {t.heart && <HeartFilled aria-hidden="true" />}
          {t.label}
        </span>
      )}
    </div>
  );
};

