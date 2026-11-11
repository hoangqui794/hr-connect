/**
 * @file CandidateWorkspaceMenu.tsx
 * @description Candidate account menu in the site header (mockup 03/11): name and email, then the
 * Candidate's own pages with their counts, then sign out.
 */
import React, { useState } from 'react';
import { Dropdown } from 'antd';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { getAvatarImageUrl, getInitials, useAuthStore } from '@/stores/authStore';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { candidateApplicationsApi } from '@/services/api/mf02Api';

interface CandidateWorkspaceMenuProps {
  showWorkspaceButton?: boolean;
  className?: string;
}

export const CandidateWorkspaceMenu: React.FC<CandidateWorkspaceMenuProps> = ({ className = '' }) => {
  const { user, logout } = useAuthStore();
  const { savedJobsCount } = useSavedJobs();
  const [open, setOpen] = useState(false);
  const applications = useQuery({
    queryKey: ['candidate-menu', 'applications-count'],
    queryFn: async () => (await candidateApplicationsApi.list({ page: 1, pageSize: 1 })).total,
    enabled: open,
  });

  const name = user?.name || 'Ứng viên';

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      window.location.replace('/login');
    }
  };

  const items: { to: string; label: string; count?: number }[] = [
    { to: '/candidate/profile', label: 'Hồ sơ của tôi' },
    { to: '/candidate/applications', label: 'Đơn ứng tuyển', count: applications.data },
    { to: '/candidate/saved-jobs', label: 'Việc đã lưu', count: savedJobsCount },
    { to: '/candidate/cvs', label: 'Kho CV' },
    { to: '/candidate/settings/email-identities', label: 'Cài đặt email đăng nhập' },
  ];

  const itemClass =
    'flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3.5 py-[9px] text-left text-[14px] text-gray-800 no-underline transition-colors duration-150 hover:bg-slate-50 hover:text-gray-900';

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => (
        <div role="menu" aria-label="Tài khoản" className="w-[242px] rounded-lg border border-solid border-gray-200 bg-white py-1.5 text-[14px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] [line-height:normal]">
          <div className="border-0 border-b border-solid border-slate-100 px-3.5 pb-2.5 pt-2">
            <div className="truncate font-semibold text-gray-800">{name}</div>
            <div className="truncate text-[12px] text-gray-500">{user?.email}</div>
          </div>
          {items.map((item) => (
            <Link key={item.to} role="menuitem" to={item.to} onClick={() => setOpen(false)} className={itemClass}>
              {item.label}
              {Boolean(item.count) && <span className="text-gray-500">{item.count}</span>}
            </Link>
          ))}
          <button type="button" role="menuitem" onClick={() => void signOut()} className={`${itemClass} !border-t !border-solid !border-slate-100 !text-red-700`}>Đăng xuất</button>
        </div>
      )}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13.5px] font-medium text-white transition-all hover:bg-white/20 hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${className}`}
      >
        {getAvatarImageUrl(user?.avatar) ? (
          <AccountAvatar name={name} avatar={user?.avatar} size={28} />
        ) : (
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#0369A1] shadow-xs">{getInitials(name)}</span>
        )}
        <span className="hidden max-w-[170px] truncate sm:block">{name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="hidden text-sky-200 sm:block"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </Dropdown>
  );
};

export default CandidateWorkspaceMenu;
