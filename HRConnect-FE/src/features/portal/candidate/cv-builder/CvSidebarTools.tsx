import React from 'react';
import { Switch, Tooltip, Collapse, Spin, Select } from 'antd';
import {
  BgColorsOutlined,
  FontSizeOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import type {
  CvFontFamily,
  CvLayoutStyle,
  CvTemplateDto,
} from '@/types/api/cvBuilder';

export interface ColorPreset {
  name: string;
  value: string;
  border?: string;
}

export const ACCENT_COLOR_PRESETS: ColorPreset[] = [
  { name: 'Xanh Navy', value: '#1e3a8a' },
  { name: 'Xanh Rêu', value: '#166534' },
  { name: 'Đỏ Mận', value: '#831843' },
  { name: 'Đen Xám', value: '#1f2937' },
  { name: 'Xanh Hoàng Gia', value: '#2563eb' },
  { name: 'Xanh Mòng Két', value: '#0f766e' },
];

export const FONT_PRESETS = [
  { name: 'Be Vietnam Pro', value: 'BE_VIETNAM_PRO', description: 'Hiện đại, tối ưu tiếng Việt' },
  { name: 'Roboto', value: 'ROBOTO', description: 'Rõ ràng, chuyên nghiệp' },
  { name: 'Inter', value: 'INTER', description: 'Gọn gàng, phù hợp ngành công nghệ' },
] satisfies Array<{ name: string; value: CvFontFamily; description: string }>;

export const DENSITY_PRESETS = [
  { label: 'Chặt chẽ', value: 'compact' },
  { label: 'Tiêu chuẩn', value: 'normal' },
  { label: 'Thoáng đãng', value: 'spacious' },
];

const templateLayoutFromCode = (template: CvTemplateDto): CvLayoutStyle => {
  if (template.templateConfig?.layout) return template.templateConfig.layout;
  const code = template.code.toUpperCase();
  if (code.includes('MODERN')) return 'modern';
  if (code.includes('COMPACT')) return 'compact';
  if (code.includes('EXECUTIVE')) return 'executive';
  if (code.includes('ELEGANT')) return 'elegant';
  if (code.includes('MINIMAL')) return 'minimal';
  return 'classic';
};

export interface SectionVisibility {
  summary: boolean;
  experiences: boolean;
  educations: boolean;
  skills: boolean;
  languages: boolean;
  certificates: boolean;
}

export interface CvSidebarToolsProps {
  templates: CvTemplateDto[];
  isLoadingTemplates: boolean;
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  fontFamily: CvFontFamily;
  onFontFamilyChange: (font: CvFontFamily) => void;
  layout: CvLayoutStyle;
  density: 'compact' | 'normal' | 'spacious';
  onDensityChange: (density: 'compact' | 'normal' | 'spacious') => void;
  sectionVisibility: SectionVisibility;
  onToggleSection: (key: keyof SectionVisibility, visible: boolean) => void;
}

export const CvSidebarTools: React.FC<CvSidebarToolsProps> = ({
  templates,
  isLoadingTemplates,
  selectedTemplateId,
  onSelectTemplate,
  accentColor,
  onAccentColorChange,
  fontFamily,
  onFontFamilyChange,
  layout,
  density,
  onDensityChange,
  sectionVisibility,
  onToggleSection,
}) => {
  const visibleSectionCount = Object.values(sectionVisibility).filter(Boolean).length;
  const sectionsList: Array<{ key: keyof SectionVisibility; label: string; countHint?: string }> = [
    { key: 'summary', label: 'Tóm tắt / Mục tiêu nghề nghiệp' },
    { key: 'experiences', label: 'Kinh nghiệm làm việc' },
    { key: 'educations', label: 'Học vấn & Bằng cấp' },
    { key: 'skills', label: 'Kỹ năng chuyên môn' },
    { key: 'languages', label: 'Ngoại ngữ' },
    { key: 'certificates', label: 'Chứng chỉ & Giải thưởng' },
  ];

  return (
    <aside className="w-[340px] h-full bg-white border-0 border-r border-solid border-slate-200 flex flex-col shrink-0 overflow-y-auto select-none shadow-xs">
      <div className="p-4 border-0 border-b border-solid border-slate-100 flex items-center gap-2">
        <LayoutOutlined className="text-blue-600 text-lg" />
        <h2 className="text-sm font-bold text-slate-800 m-0">Công cụ tùy biến CV</h2>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* ── 1. CHỌN MẪU CV (Template Selector) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mẫu CV</span>
            {selectedTemplateId && (
              <button
                type="button"
                onClick={() => onSelectTemplate(null)}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                Đặt lại chuẩn ATS
              </button>
            )}
          </div>

          {isLoadingTemplates ? (
            <div className="py-4 text-center">
              <Spin size="small" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSelectTemplate(null)}
                className={`cv-template-option p-2.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between min-h-[116px] ${
                  selectedTemplateId === null
                    ? 'border-blue-600 bg-blue-50 shadow-xs ring-1 ring-blue-100'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <span className="cv-template-mini cv-template-mini--ats" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Chuẩn ATS</span>
                  {selectedTemplateId === null && <CheckCircleOutlined className="text-blue-600 text-xs" />}
                </div>
                <span className="text-[10px] leading-4 text-slate-500">Một cột, dễ đọc và tối ưu máy quét tuyển dụng</span>
              </button>

              {templates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.cvTemplateId;
                return (
                  <button
                    type="button"
                    key={tpl.cvTemplateId}
                    onClick={() => {
                      onSelectTemplate(tpl.cvTemplateId);
                      if (tpl.templateConfig?.accentColor) {
                        onAccentColorChange(tpl.templateConfig.accentColor);
                      }
                      if (tpl.templateConfig?.density && (tpl.templateConfig.density === 'compact' || tpl.templateConfig.density === 'normal' || tpl.templateConfig.density === 'spacious')) {
                        onDensityChange(tpl.templateConfig.density as any);
                      }
                    }}
                    className={`cv-template-option p-2.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between min-h-[116px] relative overflow-hidden ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 shadow-xs ring-1 ring-blue-100'
                        : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}
                  >
                    <span
                      className={`cv-template-mini cv-template-mini--${templateLayoutFromCode(tpl)}`}
                      style={{ '--cv-mini-accent': tpl.templateConfig?.accentColor || '#2563eb' } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <i /><i /><i /><i />
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 truncate">{tpl.name}</span>
                      {isSelected && <CheckCircleOutlined className="text-blue-600 text-xs shrink-0" />}
                    </div>
                    <span className="text-[10px] leading-4 text-slate-500 line-clamp-2">
                      {tpl.description || (tpl.templateConfig?.density === 'compact' ? 'Gọn trong một trang' : 'Bố cục chuyên nghiệp')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 2. BẢNG MÀU CHỦ ĐẠO (Accent Color) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <BgColorsOutlined className="text-slate-500" />
            <span>Màu chủ đạo</span>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            {ACCENT_COLOR_PRESETS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.value.toLowerCase();
              return (
                <Tooltip key={preset.value} title={preset.name}>
                  <button
                    type="button"
                    aria-label={preset.name}
                    onClick={() => onAccentColorChange(preset.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer relative flex items-center justify-center ${
                      isSelected ? 'scale-110 shadow-sm border-white ring-2 ring-blue-500' : 'border-white hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                  </button>
                </Tooltip>
              );
            })}

            {/* Custom Color Input */}
            <Tooltip title="Tùy chọn mã màu riêng">
              <label className="w-7 h-7 rounded-full border border-dashed border-slate-300 hover:border-blue-400 flex items-center justify-center cursor-pointer text-slate-500 text-xs overflow-hidden">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => onAccentColorChange(e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                  aria-label="Chọn màu tùy chỉnh"
                />
                +
              </label>
            </Tooltip>
          </div>
        </div>

        {/* ── 3. FONT CHỮ (Typography) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <FontSizeOutlined className="text-slate-500" />
            <span>Font chữ</span>
          </div>

          <Select<CvFontFamily>
            value={fontFamily}
            onChange={onFontFamilyChange}
            className="w-full"
            aria-label="Chọn font chữ cho toàn bộ CV"
            options={FONT_PRESETS.map((font) => ({
              value: font.value,
              label: (
                <div className="flex items-center justify-between gap-3 py-0.5">
                  <span className="font-semibold text-slate-800">{font.name}</span>
                  <span className="text-[10px] text-slate-500">{font.description}</span>
                </div>
              ),
            }))}
          />
          <p className="m-0 text-[10px] leading-4 text-slate-500">
            Font được áp dụng cho toàn bộ nội dung và file PDF khi lưu.
          </p>
        </div>

        {/* ── 4. GIÃN CÁCH DÒNG (Density) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Giãn cách dòng</span>
          </div>

          <Select<'compact' | 'normal' | 'spacious'>
            value={density}
            onChange={onDensityChange}
            className="w-full"
            aria-label="Chọn độ giãn nội dung CV"
            options={DENSITY_PRESETS}
          />
        </div>

        {/* ── 5. QUẢN LÝ MỤC NỘI DUNG (Section Visibility) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <AppstoreOutlined className="text-slate-500" />
            <span>Quản lý các mục</span>
          </div>

          <Collapse
            ghost
            size="small"
            className="cv-builder-section-collapse rounded-xl border border-slate-200 bg-slate-50/70"
            items={[{
              key: 'sections',
              label: `${Object.values(sectionVisibility).filter(Boolean).length}/${sectionsList.length} mục đang hiển thị`,
              children: (
                <div className="space-y-2">
                  {sectionsList.map((sec) => (
                    <div key={sec.key} className="flex items-center justify-between gap-3 py-1 text-xs">
                      <span className="text-slate-700 font-medium">{sec.label}</span>
                      <Switch
                        size="small"
                        checked={sectionVisibility[sec.key]}
                        disabled={sectionVisibility[sec.key] && visibleSectionCount === 1}
                        onChange={(checked) => onToggleSection(sec.key, checked)}
                        aria-label={`${sectionVisibility[sec.key] ? 'Ẩn' : 'Hiện'} ${sec.label}`}
                      />
                    </div>
                  ))}
                </div>
              ),
            }]}
          />
          <span className="sr-only">Bố cục hiện tại: {layout}</span>
        </div>
      </div>
    </aside>
  );
};

export default CvSidebarTools;
