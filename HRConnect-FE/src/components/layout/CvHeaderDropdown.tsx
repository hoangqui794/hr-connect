import React, { useState } from 'react';
import { Dropdown } from 'antd';
import {
  DownOutlined,
  UpOutlined,
  RightOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  StarOutlined,
  BookOutlined,
  ShopOutlined,
  CodeOutlined,
  AuditOutlined,
  RocketOutlined,
  FileTextOutlined,
  UploadOutlined,
  ReadOutlined,
  MailOutlined,
  EditOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { CvGuideModal } from '@/components/common/CvGuideModal';
import { CoverLetterModal } from '@/components/common/CoverLetterModal';

interface CvHeaderDropdownProps {
  className?: string;
  theme?: 'light' | 'transparent';
}

export const CvHeaderDropdown: React.FC<CvHeaderDropdownProps> = ({
  className = '',
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetterInitialType, setCoverLetterInitialType] = useState<
    'standard' | 'fresher' | 'switch' | 'lead'
  >('standard');

  const isCvActive =
    location.pathname.startsWith('/candidate/cv-builder') ||
    location.pathname === '/candidate/cvs';

  const handleNavigate = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const handleOpenGuide = () => {
    setDropdownOpen(false);
    setGuideOpen(true);
  };

  const handleOpenCoverLetter = (type: 'standard' | 'fresher' | 'switch' | 'lead' = 'standard') => {
    setDropdownOpen(false);
    setCoverLetterInitialType(type);
    setCoverLetterOpen(true);
  };

  const menuContent = (
    <div
      role="dialog"
      aria-label="Menu tạo CV"
      className="w-[520px] sm:w-[580px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800 p-4 sm:p-5 select-none"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* ── CỘT TRÁI: Mẫu CV theo Style & Theo Vị trí ── */}
        <div className="space-y-4">
          {/* 1. Mẫu CV theo style */}
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleNavigate('/candidate/cv-builder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/candidate/cv-builder');
                }
              }}
              className="flex items-center justify-between text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors cursor-pointer group mb-2"
            >
              <span className="flex items-center gap-1.5 font-bold text-[13px] text-slate-900 group-hover:text-emerald-600">
                Mẫu CV theo style
              </span>
              <RightOutlined className="text-[10px] text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?style=simple')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <AppstoreOutlined className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-[12.5px]">Mẫu CV Đơn giản</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?style=impressive')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ThunderboltOutlined className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-[12.5px]">Mẫu CV Ấn tượng</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?style=professional')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <StarOutlined className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-[12.5px]">Mẫu CV Chuyên nghiệp</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?style=harvard')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <BookOutlined className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-[12.5px]">Mẫu CV Harvard</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Mẫu CV theo vị trí ứng tuyển */}
          <div className="pt-2 border-t border-slate-100">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleNavigate('/candidate/cv-builder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/candidate/cv-builder');
                }
              }}
              className="flex items-center justify-between text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors cursor-pointer group mb-2"
            >
              <span className="flex items-center gap-1.5 font-bold text-[13px] text-slate-900 group-hover:text-emerald-600">
                Mẫu CV theo vị trí ứng tuyển
              </span>
              <RightOutlined className="text-[10px] text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?role=sales')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShopOutlined className="text-xs" />
                </div>
                <div className="font-medium text-slate-800 text-[12.5px]">Nhân viên kinh doanh</div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?role=developer')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CodeOutlined className="text-xs" />
                </div>
                <div className="font-medium text-slate-800 text-[12.5px]">Lập trình viên</div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?role=accountant')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <AuditOutlined className="text-xs" />
                </div>
                <div className="font-medium text-slate-800 text-[12.5px]">Nhân viên kế toán</div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/candidate/cv-builder?role=marketing')}
                className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <RocketOutlined className="text-xs" />
                </div>
                <div className="font-medium text-slate-800 text-[12.5px]">Chuyên viên marketing</div>
              </button>
            </div>
          </div>
        </div>

        {/* ── CỘT PHẢI: Quản lý CV & Tiện ích (TopCV layout) ── */}
        <div className="pt-4 sm:pt-0 sm:pl-5 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
            Quản lý & Tiện ích
          </div>

          <button
            type="button"
            onClick={() => handleNavigate('/candidate/cvs')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileTextOutlined className="text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-[13px] group-hover:text-emerald-600">Quản lý CV</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">Xem lại các bản CV đã lưu & tải lên</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('/candidate/cvs?action=upload')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <UploadOutlined className="text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-[13px] group-hover:text-blue-600">Tải CV lên</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">Tải file PDF có sẵn để ứng tuyển</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleOpenGuide}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ReadOutlined className="text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-[13px] group-hover:text-indigo-600">Hướng dẫn viết CV</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">Bí quyết đạt 98% chuẩn ATS</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCoverLetter('standard')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MailOutlined className="text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-[13px] group-hover:text-teal-600">Quản lý Cover Letter</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">Thư xin việc gửi nhà tuyển dụng</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCoverLetter('lead')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors text-left bg-transparent border-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <EditOutlined className="text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-[13px] group-hover:text-emerald-600">Mẫu Cover Letter</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">Các mẫu thư ứng tuyển hay nhất</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dropdown
        popupRender={() => menuContent}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        trigger={['hover', 'click']}
        placement="bottomLeft"
        overlayClassName="cv-header-dropdown-overlay"
      >
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
            isCvActive || dropdownOpen
              ? 'text-emerald-600 bg-emerald-50'
              : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50 bg-transparent'
          } ${className}`}
        >
          <span>Tạo CV</span>
          {dropdownOpen ? (
            <UpOutlined className="text-[10px] transition-transform" />
          ) : (
            <DownOutlined className="text-[10px] transition-transform" />
          )}
        </button>
      </Dropdown>

      {/* Guide Modal */}
      <CvGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Cover Letter Modal */}
      <CoverLetterModal
        open={coverLetterOpen}
        initialType={coverLetterInitialType}
        onClose={() => setCoverLetterOpen(false)}
      />
    </>
  );
};
