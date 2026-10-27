import React, { useState, useRef, useEffect } from 'react';
import { Button, Tooltip, Checkbox, Dropdown, MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  EyeOutlined,
  SaveOutlined,
  CheckOutlined,
  DownloadOutlined,
  LayoutOutlined,
  PlusOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import type { SectionVisibility } from './CvSidebarTools';

export interface ColorPreset {
  name: string;
  value: string;
}

export const COLOR_PALETTES: ColorPreset[] = [
  { name: 'Xanh dương Primary', value: '#2563EB' },
  { name: 'Xanh ngọc', value: '#0D9488' },
  { name: 'Đỏ Bordeaux', value: '#991B1B' },
  { name: 'Than tối giản', value: '#1E293B' },
];

export const FONT_OPTIONS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Be Vietnam Pro', value: "'Be Vietnam Pro', sans-serif" },
];

export const FONT_SIZE_SCALES: Array<{ label: string; value: 'small' | 'normal' | 'large' }> = [
  { label: 'Cỡ chữ: Nhỏ', value: 'small' },
  { label: 'Cỡ chữ: Chuẩn', value: 'normal' },
  { label: 'Cỡ chữ: Lớn', value: 'large' },
];

export const DENSITY_OPTIONS: Array<{ label: string; value: 'compact' | 'normal' | 'spacious' }> = [
  { label: 'Dòng: Chặt chẽ', value: 'compact' },
  { label: 'Dòng: Chuẩn', value: 'normal' },
  { label: 'Dòng: Thoáng', value: 'spacious' },
];

export interface CvTopbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  isPrimary: boolean;
  onPrimaryChange: (isPrimary: boolean) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  fontSizeScale: 'small' | 'normal' | 'large';
  onFontSizeScaleChange: (scale: 'small' | 'normal' | 'large') => void;
  density: 'compact' | 'normal' | 'spacious';
  onDensityChange: (density: 'compact' | 'normal' | 'spacious') => void;
  selectedTemplateCode: 'STANDARD' | 'MODERN_TWO_COL';
  onOpenTemplateModal: () => void;
  sectionVisibility: SectionVisibility;
  onToggleSection: (key: keyof SectionVisibility, visible: boolean) => void;
  onPreview: () => void;
  onDownloadPdf: () => void;
  onSave: () => void;
  isSaving: boolean;
  onBack: () => void;
  mode: 'create' | 'edit';
}

export const CvTopbar: React.FC<CvTopbarProps> = ({
  title,
  onTitleChange,
  isPrimary,
  onPrimaryChange,
  accentColor,
  onAccentColorChange,
  fontFamily,
  onFontFamilyChange,
  fontSizeScale,
  onFontSizeScaleChange,
  density,
  onDensityChange,
  selectedTemplateCode,
  onOpenTemplateModal,
  sectionVisibility,
  onToggleSection,
  onPreview,
  onDownloadPdf,
  onSave,
  isSaving,
  onBack,
  mode,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

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

  // Section toggle menu items
  const sectionItems: MenuProps['items'] = [
    {
      key: 'summary',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Mục tiêu nghề nghiệp</span>
          <input
            type="checkbox"
            checked={sectionVisibility.summary}
            onChange={(e) => onToggleSection('summary', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'experiences',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Kinh nghiệm làm việc</span>
          <input
            type="checkbox"
            checked={sectionVisibility.experiences}
            onChange={(e) => onToggleSection('experiences', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'educations',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Học vấn & Bằng cấp</span>
          <input
            type="checkbox"
            checked={sectionVisibility.educations}
            onChange={(e) => onToggleSection('educations', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'skills',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Kỹ năng chuyên môn & mềm</span>
          <input
            type="checkbox"
            checked={sectionVisibility.skills}
            onChange={(e) => onToggleSection('skills', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'projects',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Dự án tiêu biểu</span>
          <input
            type="checkbox"
            checked={Boolean(sectionVisibility.projects)}
            onChange={(e) => onToggleSection('projects', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'activities',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Hoạt động xã hội / CLB</span>
          <input
            type="checkbox"
            checked={Boolean(sectionVisibility.activities)}
            onChange={(e) => onToggleSection('activities', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'certificates',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Chứng chỉ quốc tế</span>
          <input
            type="checkbox"
            checked={sectionVisibility.certificates}
            onChange={(e) => onToggleSection('certificates', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'awards',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Danh hiệu & Giải thưởng</span>
          <input
            type="checkbox"
            checked={Boolean(sectionVisibility.awards)}
            onChange={(e) => onToggleSection('awards', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'references',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Người giới thiệu</span>
          <input
            type="checkbox"
            checked={Boolean(sectionVisibility.references)}
            onChange={(e) => onToggleSection('references', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
    {
      key: 'interests',
      label: (
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1 text-xs">
          <span>Sở thích cá nhân</span>
          <input
            type="checkbox"
            checked={Boolean(sectionVisibility.interests)}
            onChange={(e) => onToggleSection('interests', e.target.checked)}
            className="accent-blue-600"
          />
        </label>
      ),
    },
  ];

  return (
    <header className="cv-topbar sticky top-0 left-0 right-0 z-30 w-full bg-white border-0 border-b border-solid border-slate-200 px-3 sm:px-5 py-2.5 flex items-center justify-between shadow-2xs select-none no-print">
      {/* ── LEFT: Back button & CV Title Edit ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Tooltip title="Quay lại danh sách hồ sơ">
          <Button
            type="text"
            shape="circle"
            icon={<ArrowLeftOutlined className="text-slate-600 text-sm" />}
            onClick={onBack}
            className="hover:bg-slate-100"
            aria-label="Quay lại"
          />
        </Tooltip>

        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                maxLength={180}
                aria-label="Nhập tiêu đề CV"
                className="text-sm font-bold text-slate-800 bg-white border border-blue-400 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[200px] sm:min-w-[260px]"
              />
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSaveTitle();
                }}
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 cursor-pointer group py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors min-w-0"
              onClick={() => setIsEditingTitle(true)}
              title="Nhấp để đổi tên file CV"
            >
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-[260px] m-0">
                {title || 'CV chưa đặt tên'}
              </h1>
              <EditOutlined className="text-slate-400 group-hover:text-blue-600 text-xs transition-colors shrink-0" />
            </div>
          )}

          <span className="hidden xl:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {mode === 'edit' ? 'Đang sửa' : 'Tạo mới'}
          </span>
        </div>
      </div>

      {/* ── CENTER: Quick TopCV Controls (Palette, Font, Scale, Template) ── */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Color Palette Selector */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-2.5 py-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-0.5">Tông màu:</span>
          {COLOR_PALETTES.map((p) => {
            const isSelected = accentColor.toLowerCase() === p.value.toLowerCase();
            return (
              <Tooltip key={p.value} title={p.name}>
                <button
                  type="button"
                  onClick={() => onAccentColorChange(p.value)}
                  style={{ backgroundColor: p.value }}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer border-2 flex items-center justify-center ${
                    isSelected
                      ? 'scale-115 border-white shadow-sm ring-2 ring-slate-800 ring-offset-1'
                      : 'border-transparent hover:scale-110'
                  }`}
                  aria-label={p.name}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Font Family Selector */}
        <div className="flex items-center">
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            aria-label="Chọn font chữ"
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-300"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size Scale Selector */}
        <div className="flex items-center">
          <select
            value={fontSizeScale}
            onChange={(e) => onFontSizeScaleChange(e.target.value as any)}
            aria-label="Chọn cỡ chữ"
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-300"
          >
            {FONT_SIZE_SCALES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Line Spacing / Density Selector */}
        <div className="flex items-center">
          <select
            value={density}
            onChange={(e) => onDensityChange(e.target.value as any)}
            aria-label="Chọn khoảng cách dòng"
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-300"
          >
            {DENSITY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* + Thêm mục Dropdown */}
        <Dropdown menu={{ items: sectionItems }} trigger={['click']} placement="bottom">
          <button
            type="button"
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 transition-colors"
          >
            <PlusOutlined className="text-[11px] text-blue-600" />
            <span>Thêm mục</span>
          </button>
        </Dropdown>

        {/* Đổi mẫu CV */}
        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <LayoutOutlined className="text-xs" />
          <span>{selectedTemplateCode === 'STANDARD' ? 'Mẫu 1: Tiêu Chuẩn' : 'Mẫu 2: Hai Cột'}</span>
        </button>
      </div>

      {/* ── RIGHT: Actions (Primary Checkbox, Preview, Print PDF, Save) ── */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Set as Primary CV Checkbox */}
        <div className="hidden 2xl:flex items-center mr-1">
          <Checkbox
            checked={isPrimary}
            onChange={(e) => onPrimaryChange(e.target.checked)}
            className="text-xs font-medium text-slate-600 select-none"
          >
            Đặt làm CV chính
          </Checkbox>
        </div>

        {/* Preview Button */}
        <Tooltip title="Xem trước trang in">
          <Button
            icon={<EyeOutlined />}
            onClick={onPreview}
            className="!rounded-lg font-semibold text-xs text-slate-700 hover:text-blue-600 hover:border-blue-400 flex items-center gap-1"
          >
            <span className="hidden sm:inline">Xem trước</span>
          </Button>
        </Tooltip>

        {/* Download PDF Button via window.print() */}
        <Tooltip title="Tải file PDF (In chuẩn A4)">
          <Button
            icon={<DownloadOutlined />}
            onClick={onDownloadPdf}
            className="!rounded-lg font-semibold text-xs text-slate-700 hover:text-blue-600 hover:border-blue-400 flex items-center gap-1"
          >
            <span className="hidden sm:inline">Tải PDF</span>
          </Button>
        </Tooltip>

        {/* Save CV Button */}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={isSaving}
          onClick={onSave}
          className="!rounded-lg !bg-blue-600 hover:!bg-blue-700 !font-bold text-xs !px-4 shadow-xs flex items-center gap-1.5"
        >
          <span>Lưu CV</span>
        </Button>
      </div>
    </header>
  );
};

export default CvTopbar;
