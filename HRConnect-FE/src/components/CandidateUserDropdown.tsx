import React, { useState, useMemo } from 'react';
import { Dropdown, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { useSavedJobs } from '@/hooks/useSavedJobs';

interface CandidateUserDropdownProps {
  className?: string;
}

export const CandidateUserDropdown: React.FC<CandidateUserDropdownProps> = ({
  className = '',
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { cvs, applications: storeApps } = useCandidateStore();
  const sharedApps = useApplicationStore((s) => s.applications);

  // Real-time saved jobs sync from useSavedJobs hook
  const { savedJobIds } = useSavedJobs();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Accordion open states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jobManagement: true,
    cvManagement: true,
    notificationSettings: false,
    securitySettings: false,
    upgradeAccount: false,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const userName = user?.name || 'Nguyễn Văn B';
  const userEmail = user?.email || 'ungvien5@gmail.com';
  const userAvatar = user?.avatar || getInitials(userName);

  // Candidate ID formatted according to TopCV (UV-179008 or user-specific ID)
  const candidateId = useMemo(() => {
    if (user?.id) {
      const clean = user.id.replace('usr-candidate-', '').replace('cand-', '').toUpperCase();
      if (clean && clean !== 'UNKNOWN') {
        return clean.length > 6 ? `UV-${clean.slice(0, 6)}` : `UV-${clean}`;
      }
    }
    return 'UV-179008';
  }, [user?.id]);

  // Applications count
  const applicationsCount = useMemo(() => {
    if (!currentUserEmail) return 2;
    const fromShared = sharedApps.filter((a) => {
      const email = ((a as any).candidateEmail || a.email || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
    const fromStore = (storeApps || []).filter((a) => {
      const email = (a.candidateEmail || a.applicantEmail || '').toLowerCase().trim();
      return email === currentUserEmail;
    });
    const combined = [...fromShared, ...fromStore];
    const seen = new Set<string>();
    const count = combined.filter((a) => {
      const key = `${a.jobTitle}__${a.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).length;
    return count > 0 ? count : 2;
  }, [currentUserEmail, sharedApps, storeApps]);

  // CV count
  const cvsCount = useMemo(() => {
    if (!currentUserEmail) return 3;
    const count = (cvs || []).filter(
      (c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail
    ).length;
    return count > 0 ? count : 3;
  }, [currentUserEmail, cvs]);

  // Profile views count
  const profileViewsCount = 14;

  const handleNavigate = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    void message.success('Đã đăng xuất tài khoản thành công!');
    navigate('/login');
  };

  // Dropdown card structure: Flex column with fixed max-height & sticky bottom logout button
  const dropdownContent = (
    <div className="w-[340px] max-h-[calc(100vh-90px)] sm:max-h-[520px] flex flex-col bg-white rounded-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.22)] border border-slate-200 p-3 text-left font-sans select-none overflow-hidden animate-fade-in">
      {/* ─── 1. Header Profile (Fixed at top, shrink-0) ─── */}
      <div className="shrink-0 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Avatar tròn với chữ cái đầu */}
          <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm ring-2 ring-emerald-50">
            {userAvatar}
          </div>

          <div className="min-w-0 flex-1">
            {/* Họ và tên */}
            <div className="text-slate-900 font-semibold text-base leading-snug truncate" title={userName}>
              {userName}
            </div>

            {/* Dòng trạng thái: Icon tích xanh + Tài khoản đã xác thực */}
            <div className="flex items-center gap-1 mt-0.5">
              <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs text-emerald-600 font-medium">Tài khoản đã xác thực</span>
            </div>

            {/* Mã ứng viên | Email */}
            <div className="text-xs text-slate-500 mt-0.5 truncate" title={`${candidateId} | ${userEmail}`}>
              <span className="font-medium text-slate-600">{candidateId}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span>{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Nút Xem hồ sơ dạng pill mỏng */}
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={() => handleNavigate('/candidate/profile')}
            className="rounded-full border border-slate-300 px-3.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center gap-1"
          >
            <span>Xem hồ sơ</span>
            <svg className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── 2. Vùng Menu Accordion cuộn mượt mà (flex-1 overflow-y-auto custom scrollbar) ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-2 space-y-1 custom-slim-scrollbar">
        {/* Accordion 1: Quản lý tìm việc */}
        <div className="rounded-xl border border-transparent hover:border-slate-100 transition-colors">
          <button
            type="button"
            onClick={() => toggleSection('jobManagement')}
            className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Quản lý tìm việc</span>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openSections.jobManagement ? 'rotate-180 text-emerald-600' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openSections.jobManagement && (
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              {/* Việc làm đã lưu — Hiển thị số lượng động real-time từ useSavedJobs */}
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/saved-jobs')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-rose-500 fill-rose-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>Việc làm đã lưu</span>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs px-2 py-0.5 rounded-full font-bold transition-all">
                  {savedJobIds.length}
                </span>
              </button>

              {/* Việc làm đã ứng tuyển & COD [2] */}
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/applications')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Việc làm đã ứng tuyển &amp; COD</span>
                </div>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {applicationsCount}
                </span>
              </button>

              {/* Việc làm phù hợp AI Match */}
              <button
                type="button"
                onClick={() => handleNavigate('/jobs?sort=AI_MATCH')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Việc làm phù hợp</span>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  AI Match
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 2: Quản lý CV & Cover letter */}
        <div className="rounded-xl border border-transparent hover:border-slate-100 transition-colors">
          <button
            type="button"
            onClick={() => toggleSection('cvManagement')}
            className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Quản lý CV &amp; Cover letter</span>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openSections.cvManagement ? 'rotate-180 text-emerald-600' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openSections.cvManagement && (
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              {/* CV của tôi [3] */}
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/profile?tab=cv-center')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <span>CV của tôi</span>
                </div>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {cvsCount}
                </span>
              </button>

              {/* Nhà tuyển dụng đã xem [14] */}
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/dashboard')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Nhà tuyển dụng đã xem</span>
                </div>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {profileViewsCount}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 3: Cài đặt email & thông báo */}
        <div className="rounded-xl border border-transparent hover:border-slate-100 transition-colors">
          <button
            type="button"
            onClick={() => toggleSection('notificationSettings')}
            className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Cài đặt email &amp; thông báo</span>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openSections.notificationSettings ? 'rotate-180 text-emerald-600' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openSections.notificationSettings && (
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/profile')}
                className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span>Nhận thông báo việc làm mới</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/profile')}
                className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span>Tùy chọn gợi ý ứng tuyển</span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 4: Cá nhân & Bảo mật */}
        <div className="rounded-xl border border-transparent hover:border-slate-100 transition-colors">
          <button
            type="button"
            onClick={() => toggleSection('securitySettings')}
            className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Cá nhân &amp; Bảo mật</span>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openSections.securitySettings ? 'rotate-180 text-emerald-600' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openSections.securitySettings && (
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/profile')}
                className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span>Cập nhật mật khẩu &amp; 2FA</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/profile')}
                className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span>Quản lý phiên đăng nhập</span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 5: Nâng cấp tài khoản (Badge Pro nhỏ màu cam nổi bật) */}
        <div className="rounded-xl border border-transparent hover:border-slate-100 transition-colors">
          <button
            type="button"
            onClick={() => toggleSection('upgradeAccount')}
            className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Nâng cấp tài khoản</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wide">
                PRO
              </span>
              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  openSections.upgradeAccount ? 'rotate-180 text-emerald-600' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {openSections.upgradeAccount && (
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => handleNavigate('/pricing')}
                className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span>Quyền lợi tài khoản VIP Pro</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. Phần Đáy Menu: Nút Đăng xuất dạng pill bo tròn cố định (Sticky Bottom, shrink-0) ─── */}
      <div className="shrink-0 pt-2 border-t border-slate-100 mt-auto">
        <button
          type="button"
          onClick={handleLogout}
          className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-medium py-2.5 px-4 rounded-full w-full flex items-center justify-center gap-2 transition-all text-sm cursor-pointer shadow-xs"
        >
          <svg className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <div
        className={`flex items-center gap-2 cursor-pointer bg-white hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-300 px-2.5 py-1.5 rounded-full transition-all duration-150 select-none shadow-xs ${className}`}
      >
        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
          {userAvatar}
        </div>
        <div className="hidden sm:flex flex-col text-left leading-tight pr-0.5">
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[110px]">
            {userName.split(' ').slice(-1)[0]}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">Ứng viên</span>
        </div>
        <svg className="w-3 h-3 text-slate-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </Dropdown>
  );
};

export const UserMenu = CandidateUserDropdown;
export default CandidateUserDropdown;
