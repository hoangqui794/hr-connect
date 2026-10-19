import React, { useEffect, useState } from 'react';
import { Avatar } from 'antd';
import { getAvatarImageUrl, getInitials } from '@/stores/authStore';

interface AccountAvatarProps {
  name: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}

/** Shared account avatar for every workspace shell, with an initials fallback. */
export const AccountAvatar: React.FC<AccountAvatarProps> = ({
  name,
  avatar,
  size = 36,
  className = '',
}) => {
  const avatarUrl = getAvatarImageUrl(avatar);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Avatar
        src={avatarUrl && !imageFailed ? avatarUrl : undefined}
        alt={name}
        size={size}
        onError={() => {
          setImageFailed(true);
          return false;
        }}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #DBEAFE, #DCFCE7)',
          color: '#14532D',
          fontWeight: 700,
          fontSize: Math.round(size * 0.36),
          border: '1px solid rgba(148, 163, 184, 0.28)',
        }}
      >
        {getInitials(name)}
      </Avatar>
    </span>
  );
};

export default AccountAvatar;
