/**
 * @file CvTopbar.tsx
 * @description Topbar + formatting sub-bar for Candidate CV Builder matching PDF Page 20
 * with a custom polished dropdown for font family selection.
 */
import React, { useState, useRef, useEffect } from 'react';
import type { CvFontFamily } from '@/types/api/cvBuilder';

export interface CvTopbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  isPrimary: boolean;
  onPrimaryChange: (isPrimary: boolean) => void;
  onPreview: () => void;
  onDownloadPdf?: () => void;
  onSave: () => void;
  onSaveDraft: () => void;
  isSaving: boolean;
  draftStatus: 'idle' | 'saving' | 'saved' | 'error';
  onBack: () => void;
  completeness: number;
  mode: 'create' | 'edit';
  // Formatting bar controls (PDF Page 20)
  templateName?: string;
  onOpenTemplateGallery?: () => void;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
  fontFamily?: CvFontFamily;
  onFontFamilyChange?: (font: CvFontFamily) => void;
  density?: 'compact' | 'normal' | 'spacious';
  onDensityChange?: (density: 'compact' | 'normal' | 'spacious') => void;
}

const COLOR_SWATCHES = [
  { name: 'Xanh Azure', value: '#0284C7' },
  { name: 'Xanh lá', value: '#166534' },
  { name: 'Đỏ mận', value: '#9F1239' },
  { name: 'Xám than', value: '#334155' },
];

const FONT_OPTIONS: Array<{
  label: string;
  value: CvFontFamily;
  hint: string;
  fontStack: string;
}> = [
  {
    label: 'Be Vietnam Pro',
    value: 'BE_VIETNAM_PRO',
    hint: 'Chuẩn tiếng Việt',
    fontStack: "'Be Vietnam Pro', system-ui, sans-serif",
  },
  {
    label: 'Inter',
    value: 'INTER',
    hint: 'Hiện đại, gọn gàng',
    fontStack: "'Inter', system-ui, sans-serif",
  },
  {
    label: 'Roboto',
    value: 'ROBOTO',
    hint: 'Cổ điển, rõ nét',
    fontStack: "'Roboto', system-ui, sans-serif",
  },
];

const DENSITY_OPTIONS: Array<{ label: string; value: 'compact' | 'normal' | 'spacious' }> = [
  { label: 'Chặt chẽ', value: 'compact' },
  { label: 'Tiêu chuẩn', value: 'normal' },
  { label: 'Thoáng đãng', value: 'spacious' },
];

export const CvTopbar: React.FC<CvTopbarProps> = ({
  title,
  onTitleChange,
  onPreview,
  onDownloadPdf,
  onSave,
  isSaving,
  draftStatus,
  onBack,
  templateName = 'Tiêu chuẩn',
  onOpenTemplateGallery,
  accentColor = '#0284C7',
  onAccentColorChange,
  fontFamily = 'BE_VIETNAM_PRO',
  onFontFamilyChange,
  density = 'normal',
  onDensityChange,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Close custom font menu on outside click or Escape
  useEffect(() => {
    if (!fontMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFontMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [fontMenuOpen]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    const trimmed = tempTitle.trim();
    if (trimmed) {
      onTitleChange(trimmed);
    } else {
      setTempTitle(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
    }
  };

  const currentFont =
    FONT_OPTIONS.find((opt) => opt.value === fontFamily) || FONT_OPTIONS[0];

  return (
    <header className="w-full shrink-0 select-none bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A] z-30">
      {/* ── ROW 1: Document Title + Auto-save Status + Action Buttons (PDF Page 20) ── */}
      <div className="border-0 border-b border-solid border-[#E2E8F0]">
        <div className="mx-auto flex h-[54px] w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Back Chevron + Title + Auto-saved status */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Quay lại"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-[#334155] transition-colors duration-150 hover:bg-[#F1F5F9]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                maxLength={180}
                aria-label="Nhập tiêu đề CV"
                className="h-8 min-w-[180px] rounded-[6px] border border-solid border-[#0284C7] bg-white px-2.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[15px] font-bold text-[#0F172A] outline-none sm:min-w-[260px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                title="Nhấp để đổi tên CV"
                className="cursor-pointer truncate rounded-[6px] border-0 bg-transparent px-1.5 py-1 text-left font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[15px] font-bold text-[#0F172A] transition-colors duration-150 hover:bg-[#F1F5F9]"
              >
                {title || 'CV Backend Developer'}
              </button>
            )}

            <span
              aria-live="polite"
              className="hidden items-center gap-1.5 text-[12px] font-medium text-[#15803D] sm:inline-flex"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>
                {draftStatus === 'saving' ? 'Đang lưu tự động…' : 'Đã lưu tự động'}
              </span>
            </span>
          </div>

          {/* Right: Undo, Redo, Xem trước, Tải PDF, Lưu vào Kho CV */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Hoàn tác"
              onClick={() => document.execCommand('undo')}
              className="hidden h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[7px] border border-solid border-[#CBD5E1] bg-white text-[#334155] transition-colors duration-150 hover:bg-[#F8FAFC] sm:inline-flex"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Làm lại"
              onClick={() => document.execCommand('redo')}
              className="hidden h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[7px] border border-solid border-[#CBD5E1] bg-white text-[#334155] transition-colors duration-150 hover:bg-[#F8FAFC] sm:inline-flex"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M15 14l5-5-5-5" />
                <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onPreview}
              className="h-[34px] cursor-pointer rounded-[7px] border border-solid border-[#CBD5E1] bg-white px-3.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-[#0F172A] transition-colors duration-150 hover:bg-[#F8FAFC]"
            >
              Xem trước
            </button>

            <button
              type="button"
              onClick={onDownloadPdf || onPreview}
              className="hidden h-[34px] cursor-pointer rounded-[7px] border border-solid border-sky-600 bg-white px-3.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-sky-700 transition-colors duration-150 hover:bg-sky-50 sm:inline-flex sm:items-center"
            >
              Tải PDF
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className="h-[34px] cursor-pointer rounded-[7px] border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[13px] font-semibold text-white shadow-xs transition-all duration-150 hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu…' : 'Lưu vào Kho CV'}
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Formatting Toolbar (Mẫu | Màu | Phông chữ | Khoảng cách) ── */}
      <div className="border-0 border-b border-solid border-[#E2E8F0] bg-white">
        <div className="mx-auto flex min-h-[46px] w-full max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-1.5 text-[12px] sm:px-6">
          {/* Mẫu */}
          <div className="flex items-center gap-2 rounded-[7px] border border-solid border-[#E2E8F0] bg-white px-3 py-1">
            <span className="text-[#64748B]">Mẫu</span>
            <strong className="font-semibold text-[#0F172A]">{templateName}</strong>
            {onOpenTemplateGallery && (
              <button
                type="button"
                onClick={onOpenTemplateGallery}
                className="ml-0.5 cursor-pointer border-0 bg-transparent p-0 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[12px] font-medium text-[#0284C7] hover:underline"
              >
                Đổi mẫu
              </button>
            )}
          </div>

          {/* Màu */}
          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">Màu</span>
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((swatch) => {
                const active = accentColor.toLowerCase() === swatch.value.toLowerCase();
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    aria-label={swatch.name}
                    onClick={() => onAccentColorChange?.(swatch.value)}
                    className={`h-[18px] w-[18px] cursor-pointer rounded-full border-0 p-0 transition-transform duration-150 ${
                      active ? 'ring-2 ring-[#0284C7] ring-offset-1' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: swatch.value }}
                  />
                );
              })}
            </div>
          </div>

          {/* Phông chữ (Custom Styled Dropdown Popover) */}
          <div className="relative flex items-center gap-2" ref={fontMenuRef}>
            <span className="text-[#64748B]">Phông chữ</span>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={fontMenuOpen}
              aria-label="Chọn phông chữ"
              onClick={() => setFontMenuOpen((prev) => !prev)}
              className={`flex h-[30px] min-w-[144px] cursor-pointer items-center justify-between gap-2 rounded-[7px] border border-solid bg-white px-2.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[12px] font-medium text-[#0F172A] outline-none transition-all duration-150 ${
                fontMenuOpen
                  ? 'border-[#0284C7] ring-2 ring-[#0284C7]/15'
                  : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              <span style={{ fontFamily: currentFont.fontStack }}>{currentFont.label}</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#475569"
                strokeWidth="2.2"
                className={`shrink-0 transition-transform duration-200 ${
                  fontMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {fontMenuOpen && (
              <div
                role="listbox"
                aria-label="Danh sách phông chữ"
                className="absolute left-[68px] top-[calc(100%+6px)] z-50 w-[228px] origin-top animate-[admin-page-in_150ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[10px] border border-solid border-[#E2E8F0] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
              >
                {FONT_OPTIONS.map((opt) => {
                  const selected = opt.value === fontFamily;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onFontFamilyChange?.(opt.value);
                        setFontMenuOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-[7px] border-0 px-2.5 py-2 text-left transition-colors duration-150 ${
                        selected
                          ? 'bg-[#E0F2FE]/80 text-[#0369A1]'
                          : 'bg-transparent text-[#0F172A] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-[12.5px] ${selected ? 'font-semibold' : 'font-medium'}`}
                          style={{ fontFamily: opt.fontStack }}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-[#64748B]">{opt.hint}</div>
                      </div>
                      {selected && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="2.5"
                          className="shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Khoảng cách */}
          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">Khoảng cách</span>
            <div className="inline-flex overflow-hidden rounded-[7px] border border-solid border-[#E2E8F0] bg-white">
              {DENSITY_OPTIONS.map((opt) => {
                const active = density === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDensityChange?.(opt.value)}
                    className={`h-[28px] cursor-pointer border-0 px-2.5 font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[12px] transition-colors duration-150 ${
                      active
                        ? 'bg-[#E0F2FE] font-semibold text-[#0369A1]'
                        : 'bg-white font-normal text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default CvTopbar;
