import React from 'react';
import { Badge, Tag } from 'antd';
import { PayoutStatus, PAYOUT_STATUS_CONFIG } from '@/types/affiliate';
import { ApplicationStatus } from '@/types/candidate';

// ─── Payout Status Badge ──────────────────────────────────

interface PayoutStatusBadgeProps {
  status: PayoutStatus;
}

export const PayoutStatusBadge: React.FC<PayoutStatusBadgeProps> = ({ status }) => {
  const config = PAYOUT_STATUS_CONFIG[status];
  return (
    <Badge
      status={config.antdStatus}
      text={
        <span style={{ color: config.color, fontWeight: 600, fontSize: 12 }}>
          {config.label}
        </span>
      }
    />
  );
};

// ─── Application Status Badge ─────────────────────────────

const APP_STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  [ApplicationStatus.APPLIED]: { label: 'Applied', color: '#64748b' },
  [ApplicationStatus.SCREENING]: { label: 'Screening', color: '#8b5cf6' },
  [ApplicationStatus.SHORTLISTED]: { label: 'Shortlisted', color: '#0284c7' },
  [ApplicationStatus.INTERVIEW_SCHEDULED]: { label: 'Interview Scheduled', color: '#0369a1' },
  [ApplicationStatus.INTERVIEWED]: { label: 'Interviewed', color: '#0d9488' },
  [ApplicationStatus.OFFER_SENT]: { label: 'Offer Sent', color: '#f59e0b' },
  [ApplicationStatus.OFFER_ACCEPTED]: { label: 'Offer Accepted', color: '#10b981' },
  [ApplicationStatus.OFFER_DECLINED]: { label: 'Offer Declined', color: '#ef4444' },
  [ApplicationStatus.HIRED]: { label: 'Hired ✓', color: '#059669' },
  [ApplicationStatus.REJECTED]: { label: 'Rejected', color: '#dc2626' },
  [ApplicationStatus.WITHDRAWN]: { label: 'Withdrawn', color: '#94a3b8' },
};

interface AppStatusBadgeProps {
  status: ApplicationStatus;
}

export const AppStatusBadge: React.FC<AppStatusBadgeProps> = ({ status }) => {
  const config = APP_STATUS_CONFIG[status];
  return (
    <Tag
      style={{
        color: config.color,
        background: `${config.color}15`,
        border: 'none',
        borderRadius: 6,
        fontWeight: 500,
        fontSize: 12,
      }}
    >
      {config.label}
    </Tag>
  );
};
