import React from 'react';
import { Tag } from 'antd';
import { UserRole, ROLE_LABELS, ROLE_COLORS } from '@/types/roles';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'small' | 'medium';
}

const ROLE_ICONS: Record<UserRole, string> = {
  [UserRole.GUEST]: '👤',
  [UserRole.CLIENT]: '🏢',
  [UserRole.CANDIDATE]: '🎯',
  [UserRole.AFFILIATE]: '🤝',
  [UserRole.INTERNAL_HR]: '🔍',
  [UserRole.ADMIN]: '⚙️',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'medium' }) => {
  const color = ROLE_COLORS[role];
  const label = ROLE_LABELS[role];
  const icon = ROLE_ICONS[role];

  return (
    <Tag
      color={color}
      style={{
        fontSize: size === 'small' ? 11 : 12,
        fontWeight: 600,
        padding: size === 'small' ? '1px 6px' : '2px 8px',
        borderRadius: 6,
        border: 'none',
        background: `${color}18`,
        color,
        lineHeight: '20px',
      }}
    >
      {icon} {label}
    </Tag>
  );
};
