import React, { useState, useMemo } from 'react';
import { Avatar, Dropdown, message } from 'antd';
import {
  HeartOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  SlidersOutlined,
  IdcardOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  CheckCircleFilled,
  DownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { useApplicationStore } from '@/stores/applicationStore';

interface CandidateUserDropdownProps {
  className?: string;
}

export const CandidateUserDropdown: React.FC<CandidateUserDropdownProps> = ({
  className = '',
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { cvs, applications: storeApps, savedJobs } = useCandidateStore();
  const sharedApps = useApplicationStore((s) => s.applications);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const userName = user?.name || 'Ứng viên';
  const userEmail = user?.email || 'ungvien@example.com';
  const userAvatar = user?.avatar || getInitials(userName);

  // Formatted Candidate ID (e.g. UV-892401)
  const candidateId = useMemo(() => {
    if (user?.id) {
      const clean = user.id.replace('usr-candidate-', '').replace('cand-', '').toUpperCase();
      return clean.length > 8 ? `UV-${clean.slice(0, 6)}` : `UV-${clean}`;
    }
    return 'UV-892401';
  }, [user?.id]);

  // Saved jobs count for this specific candidate
  const savedJobsCount = useMemo(() => {
    if (!currentUserEmail) return 0;
    try {
      const userKey = `hrconnect_saved_jobs_${currentUserEmail}`;
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    const list = savedJobs || [];
    return list.filter((j) => (j.userEmail || '').toLowerCase().trim() === currentUserEmail).length;
  }, [currentUserEmail, savedJobs]);

  // Applications count for this specific candidate
  const applicationsCount = useMemo(() => {
    if (!currentUserEmail) return 0;
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
    return combined.filter((a) => {
      const key = `${a.jobTitle}__${a.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).length;
  }, [currentUserEmail, sharedApps, storeApps]);

  // CV count for this specific candidate
  const cvsCount = useMemo(() => {
    if (!currentUserEmail) return cvs?.length || 1;
    const count = (cvs || []).filter(
      (c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail
    ).length;
    return count > 0 ? count : cvs?.length || 1;
  }, [currentUserEmail, cvs]);

  // Profile views counter (mock persisted or default 14)
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

  const dropdownContent = (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] p-2 w-72 divide-y divide-slate-100 text-left">
      {/* ─── 1. Header Profile: Avatar + Name + ID + Email + Verified Badge + View Profile Pill ─── */}
      <div className="p-2.5 pb-3">
        <div className="flex items-start gap-3">
          <Avatar
            size={40}
            className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-sm ring-1 ring-emerald-100 shrink-0 flex items-center justify-center"
          >
            {userAvatar}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 text-sm truncate leading-snug">
              {userName}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5 tracking-tight">
              Mã ứng viên: <span className="font-semibold text-slate-600">{candidateId}</span>
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5" title={userEmail}>
              {userEmail}
            </div>
          </div>
        </div>

        {/* Verification Status Badge & View Profile Pill */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 shrink-0">
            <CheckCircleFilled className="text-emerald-500 text-xs" />
            Tài khoản đã xác thực
          </span>
          <button
            type="button"
            onClick={() => handleNavigate('/candidate/profile')}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
          >
            Xem hồ sơ
          </button>
        </div>
      </div>

      {/* ─── 2. Nhóm 1: "QUẢN LÝ TÌM VIỆC" ─── */}
      <div className="py-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
          Quản lý tìm việc
        </div>

        {/* Việc làm đã lưu */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/saved-jobs')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <HeartOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Việc làm đã lưu</span>
          </div>
          <span className="bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors">
            {savedJobsCount}
          </span>
        </button>

        {/* Việc làm đã ứng tuyển & Giới thiệu COD */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/applications')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <CheckCircleOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Việc làm đã ứng tuyển &amp; COD</span>
          </div>
          <span className="bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors">
            {applicationsCount}
          </span>
        </button>

        {/* Việc làm phù hợp với bạn (AI Match) */}
        <button
          type="button"
          onClick={() => handleNavigate('/jobs?sort=AI_MATCH')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <ThunderboltOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Việc làm phù hợp với bạn</span>
          </div>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 group-hover:bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors">
            AI Match
          </span>
        </button>

        {/* Cài đặt tiêu chí gợi ý việc làm */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/profile')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <SlidersOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Cài đặt tiêu chí gợi ý việc làm</span>
          </div>
        </button>
      </div>

      {/* ─── 3. Nhóm 2: "QUẢN LÝ CV & HỒ SƠ" ─── */}
      <div className="py-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
          Quản lý CV &amp; Hồ sơ
        </div>

        {/* CV của tôi */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/profile')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <IdcardOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">CV của tôi</span>
          </div>
          <span className="bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors">
            {cvsCount}
          </span>
        </button>

        {/* Nhà tuyển dụng đã xem hồ sơ */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/dashboard')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <EyeOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Nhà tuyển dụng đã xem</span>
          </div>
          <span className="bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors">
            {profileViewsCount}
          </span>
        </button>
      </div>

      {/* ─── 4. Nhóm 3: "CÀI ĐẶT & TÀI KHOẢN" ─── */}
      <div className="py-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
          Cài đặt &amp; Tài khoản
        </div>

        {/* Cài đặt thông báo & bảo mật */}
        <button
          type="button"
          onClick={() => handleNavigate('/candidate/profile')}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50/60 hover:text-emerald-600 transition-all duration-150 text-sm cursor-pointer"
        >
          <div className="flex items-center">
            <SafetyCertificateOutlined className="text-slate-400 group-hover:text-emerald-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="transition-colors">Cài đặt thông báo &amp; bảo mật</span>
          </div>
        </button>

        {/* Đăng xuất */}
        <button
          type="button"
          onClick={handleLogout}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50/80 hover:text-rose-700 transition-all duration-150 text-sm cursor-pointer mt-0.5"
        >
          <div className="flex items-center">
            <LogoutOutlined className="text-rose-400 group-hover:text-rose-600 mr-2.5 shrink-0 text-sm transition-colors" />
            <span className="font-medium transition-colors">Đăng xuất</span>
          </div>
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
        className={`flex items-center gap-2 cursor-pointer bg-white hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-200/80 px-2.5 py-1.5 rounded-full transition-all duration-150 select-none shadow-xs ${className}`}
      >
        <Avatar
          size={28}
          className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-xs shrink-0"
        >
          {userAvatar}
        </Avatar>
        <div className="hidden sm:flex flex-col text-left leading-tight pr-0.5">
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[110px]">
            {userName.split(' ').slice(-1)[0]}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">Ứng viên</span>
        </div>
        <DownOutlined className="text-[10px] text-slate-400 ml-0.5" />
      </div>
    </Dropdown>
  );
};

export const UserMenu = CandidateUserDropdown;
export default CandidateUserDropdown;
