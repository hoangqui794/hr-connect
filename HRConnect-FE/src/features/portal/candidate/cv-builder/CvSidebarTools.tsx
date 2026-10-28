import React from 'react';
import { Switch, Radio, Tooltip, Collapse, Spin } from 'antd';
import {
  BgColorsOutlined,
  FontSizeOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  LayoutOutlined,
  BookOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  ProjectOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import type { CvTemplateDto } from '@/types/api/cvBuilder';
import { COLOR_PALETTES, FONT_OPTIONS, FONT_SIZE_SCALES, DENSITY_OPTIONS } from './CvTopbar';

export interface SectionVisibility {
  summary: boolean;
  experiences: boolean;
  educations: boolean;
  skills: boolean;
  languages?: boolean;
  certificates: boolean;
  projects?: boolean;
  activities?: boolean;
  awards?: boolean;
  references?: boolean;
  interests?: boolean;
}

export interface CvSidebarToolsProps {
  templates: CvTemplateDto[];
  isLoadingTemplates: boolean;
  selectedTemplateCode: 'STANDARD' | 'MODERN_TWO_COL';
  onSelectTemplateCode: (code: 'STANDARD' | 'MODERN_TWO_COL') => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  fontSizeScale: 'small' | 'normal' | 'large';
  onFontSizeScaleChange: (scale: 'small' | 'normal' | 'large') => void;
  density: 'compact' | 'normal' | 'spacious';
  onDensityChange: (density: 'compact' | 'normal' | 'spacious') => void;
  sectionVisibility: SectionVisibility;
  onToggleSection: (key: keyof SectionVisibility, visible: boolean) => void;
  completeness: number;
}

export const CvSidebarTools: React.FC<CvSidebarToolsProps> = ({
  selectedTemplateCode,
  onSelectTemplateCode,
  accentColor,
  onAccentColorChange,
  fontFamily,
  onFontFamilyChange,
  fontSizeScale,
  onFontSizeScaleChange,
  density,
  onDensityChange,
  sectionVisibility,
  onToggleSection,
  completeness,
}) => {
  const sectionsList: Array<{ key: keyof SectionVisibility; label: string; icon: React.ReactNode }> = [
    { key: 'summary', label: 'Mục tiêu & Tóm tắt', icon: <ThunderboltOutlined /> },
    { key: 'experiences', label: 'Kinh nghiệm làm việc', icon: <ApartmentOutlined /> },
    { key: 'educations', label: 'Học vấn & Bằng cấp', icon: <BookOutlined /> },
    { key: 'skills', label: 'Kỹ năng chuyên môn', icon: <AppstoreOutlined /> },
    { key: 'projects', label: 'Dự án tiêu biểu', icon: <ProjectOutlined /> },
    { key: 'activities', label: 'Hoạt động & CLB', icon: <TeamOutlined /> },
    { key: 'certificates', label: 'Chứng chỉ quốc tế', icon: <SafetyCertificateOutlined /> },
    { key: 'awards', label: 'Danh hiệu & Giải thưởng', icon: <TrophyOutlined /> },
    { key: 'references', label: 'Người giới thiệu', icon: <TeamOutlined /> },
    { key: 'interests', label: 'Sở thích cá nhân', icon: <HeartOutlined /> },
  ];

  return (
    <aside className="cv-sidebar w-72 h-full bg-white border-0 border-r border-solid border-slate-200 flex flex-col shrink-0 overflow-y-auto select-none shadow-xs no-print cv-builder-scroll">
      {/* Header */}
      <div className="p-4 border-0 border-b border-solid border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutOutlined className="text-blue-600 text-base" />
          <h2 className="text-sm font-bold text-slate-800 m-0">Tùy biến CV</h2>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
          <span className="text-[10px] text-slate-500 font-medium">Hoàn thiện:</span>
          <span className="text-xs font-bold text-blue-600">{completeness}%</span>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* ── 1. CHỌN MẪU CV (Template Selector) ── */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Mẫu CV Trình bày
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div
              onClick={() => onSelectTemplateCode('STANDARD')}
              className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left h-24 ${
                selectedTemplateCode === 'STANDARD'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Mẫu Tiêu Chuẩn</span>
                {selectedTemplateCode === 'STANDARD' && <CheckCircleOutlined className="text-blue-600 text-xs" />}
              </div>
              <span className="text-[10px] text-slate-500 leading-tight">1 Cột tuần tự, chuẩn quét ATS</span>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded w-fit">
                98% ATS Match
              </span>
            </div>

            <div
              onClick={() => onSelectTemplateCode('MODERN_TWO_COL')}
              className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left h-24 ${
                selectedTemplateCode === 'MODERN_TWO_COL'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Hai Cột Hiện Đại</span>
                {selectedTemplateCode === 'MODERN_TWO_COL' && <CheckCircleOutlined className="text-blue-600 text-xs" />}
              </div>
              <span className="text-[10px] text-slate-500 leading-tight">Thanh lịch, phân tách trực quan</span>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 py-0.2 rounded w-fit">
                TopCV Favorite
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. TÔNG MÀU CHỦ ĐẠO ── */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Tông màu chủ đạo
          </span>
          <div className="flex items-center gap-2">
            {COLOR_PALETTES.map((p) => {
              const isSelected = accentColor.toLowerCase() === p.value.toLowerCase();
              return (
                <Tooltip key={p.value} title={p.name}>
                  <button
                    type="button"
                    onClick={() => onAccentColorChange(p.value)}
                    style={{ backgroundColor: p.value }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 flex items-center justify-center ${
                      isSelected
                        ? 'scale-115 border-white shadow-sm ring-2 ring-slate-800 ring-offset-1'
                        : 'border-transparent hover:scale-105'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* ── 3. FONT CHỮ & CỠ CHỮ ── */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Phông chữ
            </label>
            <select
              value={fontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg p-2 outline-none cursor-pointer hover:border-slate-300"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Cỡ chữ
              </label>
              <select
                value={fontSizeScale}
                onChange={(e) => onFontSizeScaleChange(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg p-2 outline-none cursor-pointer"
              >
                {FONT_SIZE_SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label.replace('Cỡ chữ: ', '')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Dòng
              </label>
              <select
                value={density}
                onChange={(e) => onDensityChange(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg p-2 outline-none cursor-pointer"
              >
                {DENSITY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label.replace('Dòng: ', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── 4. CÁC MỤC HIỂN THỊ (Section Toggles) ── */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Các mục trên CV
            </span>
            <span className="text-[10px] text-slate-400">Ẩn / Hiện</span>
          </div>

          <div className="space-y-1.5">
            {sectionsList.map((sec) => {
              const isVisible = Boolean(sectionVisibility[sec.key]);
              return (
                <div
                  key={sec.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <span className="text-slate-400">{sec.icon}</span>
                    <span>{sec.label}</span>
                  </div>
                  <Switch
                    size="small"
                    checked={isVisible}
                    onChange={(checked) => onToggleSection(sec.key, checked)}
                    className="accent-blue-600"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Mẹo viết CV ATS */}
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1 text-xs text-blue-900">
          <span className="font-bold flex items-center gap-1 text-[11px] text-blue-700 uppercase">
            💡 Gợi ý chuẩn ATS
          </span>
          <p className="text-[11px] leading-relaxed text-slate-600 m-0">
            Sử dụng các số liệu cụ thể (%) trong phần kinh nghiệm để làm nổi bật kết quả thực tế và giúp CV vượt qua bộ lọc tự động.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default CvSidebarTools;
