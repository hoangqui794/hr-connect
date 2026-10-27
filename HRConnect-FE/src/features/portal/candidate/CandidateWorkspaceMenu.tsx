/**
 * @file CandidateWorkspaceMenu.tsx
 * @description Candidate Account Dropdown Menu styled identically to TopCV:
 * - Profile summary (Avatar, Full Name, Verified Badge, User ID & Email)
 * - Accordion Group 1: Quản lý tìm việc (Việc làm đã lưu, Việc đã ứng tuyển, Việc làm phù hợp, Cài đặt tìm việc)
 * - Accordion Group 2: Quản lý CV & Cover letter (CV của tôi, Tạo CV Online mới, Kết nối NTD, Hồ sơ cá nhân)
 * - Accordion Group 3: Cài đặt & Tiện ích (Cài đặt email & thông báo, Đăng xuất)
 */

import React, { useState } from 'react';
import { Dropdown } from 'antd';
import {
  CheckCircleFilled,
  DownOutlined,
  LogoutOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { useSavedJobs } from '@/hooks/useSavedJobs';

interface CandidateWorkspaceMenuProps {
  showWorkspaceButton?: boolean;
  className?: string;
}

export const CandidateWorkspaceMenu: React.FC<CandidateWorkspaceMenuProps> = ({
  className = '',
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { savedJobsCount } = useSavedJobs();
  const [open, setOpen] = useState(false);

  // Accordion section states (matching TopCV layout)
  const [isJobSearchOpen, setIsJobSearchOpen] = useState(true);
  const [isCvOpen, setIsCvOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const name = user?.name || 'Ứng viên';
  const email = user?.email || '';
  const nameParts = name.trim().split(/\s+/);
  const shortName = nameParts[nameParts.length - 1] || 'Ứng viên';

  const displayId = React.useMemo(() => {
    if (!user?.id) return '11273860';
    const numeric = user.id.replace(/[^0-9]/g, '');
    if (numeric.length >= 6) return numeric.slice(0, 8);
    return user.id.slice(0, 8);
  }, [user?.id]);

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      window.location.replace('/');
    }
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const menuDropdownContent = (
    <div className="w-[330px] sm:w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
      {/* ── 1. User Profile Header ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleNavigate('/candidate/dashboard')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleNavigate('/candidate/dashboard');
          }
        }}
        className="p-4 bg-gradient-to-b from-slate-50/80 to-white flex items-center gap-3 cursor-pointer hover:bg-slate-50/90 transition-colors"
      >
        <AccountAvatar name={name} avatar={user?.avatar} size={50} className="shrink-0 ring-2 ring-emerald-100" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 text-sm truncate hover:text-emerald-600 transition-colors">{name}</div>
          <div className="mt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <CheckCircleFilled className="text-[10px]" /> Tài khoản đã xác thực
            </span>
          </div>
          <div className="text-[11.5px] text-slate-400 truncate mt-1">
            ID {displayId} | {email}
          </div>
        </div>
      </div>

      {/* ── 2. Group 1: Quản lý tìm việc (TopCV Style) ── */}
      <div className="p-2.5">
        <button
          type="button"
          onClick={() => setIsJobSearchOpen(!isJobSearchOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors bg-transparent border-0 cursor-pointer rounded-lg hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <span className="font-bold text-[13px] text-slate-800">Quản lý tìm việc</span>
          </span>
          {isJobSearchOpen ? <UpOutlined className="text-[10px] text-slate-400" /> : <DownOutlined className="text-[10px] text-slate-400" />}
        </button>

        {isJobSearchOpen && (
          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => handleNavigate('/candidate/dashboard')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Trang tổng quan cá nhân</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/candidate/saved-jobs')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Việc làm đã lưu</span>
              {savedJobsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                  {savedJobsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/candidate/applications')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Việc làm đã ứng tuyển</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 3. Group 2: Quản lý CV & Cover letter (TopCV Style) ── */}
      <div className="p-2.5">
        <button
          type="button"
          onClick={() => setIsCvOpen(!isCvOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors bg-transparent border-0 cursor-pointer rounded-lg hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span className="font-bold text-[13px] text-slate-800">Quản lý CV & Cover letter</span>
          </span>
          {isCvOpen ? <UpOutlined className="text-[10px] text-slate-400" /> : <DownOutlined className="text-[10px] text-slate-400" />}
        </button>

        {isCvOpen && (
          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => handleNavigate('/candidate/cvs')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>CV của tôi</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/candidate/cv-builder')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Cover Letter của tôi</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/candidate/profile')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Nhà tuyển dụng xem hồ sơ</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Group 3: Cài đặt email & thông báo (TopCV Style) ── */}
      <div className="p-2.5">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors bg-transparent border-0 cursor-pointer rounded-lg hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span className="font-bold text-[13px] text-slate-800">Cài đặt email & thông báo</span>
          </span>
          {isSettingsOpen ? <UpOutlined className="text-[10px] text-slate-400" /> : <DownOutlined className="text-[10px] text-slate-400" />}
        </button>

        {isSettingsOpen && (
          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => handleNavigate('/candidate/settings/email-identities')}
              className="w-full flex items-center justify-between py-2 px-3 pl-9 text-[13px] text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer"
            >
              <span>Email liên kết & bảo mật</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 5. Actions Footer ── */}
      <div className="p-2.5 bg-slate-50/70 border-t border-slate-100">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors bg-transparent border-0 cursor-pointer"
        >
          <LogoutOutlined className="text-rose-500 text-sm" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => menuDropdownContent}
      placement="bottomRight"
      trigger={['click']}
    >
      <button
        type="button"
        aria-label="Tài khoản ứng viên"
        className={`flex h-[38px] cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1.5 pr-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-2xs focus-visible:outline-none ${className}`}
      >
        <AccountAvatar name={name} avatar={user?.avatar} size={28} />
        <span className="hidden sm:inline-block max-w-[120px] truncate text-xs font-semibold text-slate-800">
          {shortName}
        </span>
        <DownOutlined className={`text-[10px] text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
    </Dropdown>
  );
};

export default CandidateWorkspaceMenu;
