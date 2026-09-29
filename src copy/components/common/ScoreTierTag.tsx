import React from 'react';
import { Tag } from 'antd';
import { ScoreTier, SCORE_TIER_CONFIG, getScoreTier } from '@/types/candidate';

interface ScoreTierTagProps {
  score?: number;
  tier?: ScoreTier;
  showScore?: boolean;
}

export const ScoreTierTag: React.FC<ScoreTierTagProps> = ({ score, tier, showScore = true }) => {
  const resolvedTier = tier ?? (score !== undefined ? getScoreTier(score) : ScoreTier.WEAK);
  const config = SCORE_TIER_CONFIG[resolvedTier];

  return (
    <Tag
      style={{
        color: config.color,
        background: config.bgColor,
        border: `1px solid ${config.color}40`,
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 12,
        padding: '2px 8px',
      }}
    >
      {config.label}
      {showScore && score !== undefined && ` — ${score}%`}
    </Tag>
  );
};
