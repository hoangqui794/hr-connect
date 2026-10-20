import React from 'react';
import { Switch, Radio, Tooltip, Collapse, Spin } from 'antd';
import {
  BgColorsOutlined,
  FontSizeOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import type { CvTemplateDto } from '@/types/api/cvBuilder';

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
  { name: 'Be Vietnam Pro', value: "'Be Vietnam Pro', sans-serif", description: 'Hiện đại, tối ưu tiếng Việt' },
  { name: 'Roboto', value: "'Roboto', sans-serif", description: 'Rõ ràng, chuyên nghiệp' },
  { name: 'Inter', value: "'Inter', sans-serif", description: 'Công nghệ, quốc tế' },
];

export const DENSITY_PRESETS = [
  { label: 'Chặt chẽ', value: 'compact' },
  { label: 'Tiêu chuẩn', value: 'normal' },
  { label: 'Thoáng đãng', value: 'spacious' },
];

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
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
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
  density,
  onDensityChange,
  sectionVisibility,
  onToggleSection,
}) => {
  const sectionsList: Array<{ key: keyof SectionVisibility; label: string; countHint?: string }> = [
    { key: 'summary', label: 'Tóm tắt / Mục tiêu nghề nghiệp' },
    { key: 'experiences', label: 'Kinh nghiệm làm việc' },
    { key: 'educations', label: 'Học vấn & Bằng cấp' },
    { key: 'skills', label: 'Kỹ năng chuyên môn' },
    { key: 'languages', label: 'Ngoại ngữ' },
    { key: 'certificates', label: 'Chứng chỉ & Giải thưởng' },
  ];

  return (
    <aside className="w-80 h-full bg-white border-0 border-r border-solid border-slate-200 flex flex-col shrink-0 overflow-y-auto select-none shadow-xs">
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
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => onSelectTemplate(null)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between h-20 ${
                  selectedTemplateId === null
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Chuẩn ATS</span>
                  {selectedTemplateId === null && <CheckCircleOutlined className="text-blue-600 text-xs" />}
                </div>
                <span className="text-[10px] text-slate-500">Tối ưu máy quét tuyển dụng</span>
              </div>

              {templates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.cvTemplateId;
                return (
                  <div
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
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between h-20 relative overflow-hidden ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 truncate">{tpl.name}</span>
                      {isSelected && <CheckCircleOutlined className="text-blue-600 text-xs shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-auto">
                      {tpl.templateConfig?.accentColor && (
                        <span
                          className="w-3 h-3 rounded-full inline-block border border-white shadow-xs shrink-0"
                          style={{ backgroundColor: tpl.templateConfig.accentColor }}
                        />
                      )}
                      <span className="text-[10px] text-slate-500 truncate">
                        {tpl.templateConfig?.density === 'compact' ? 'Gọn gàng' : 'Tiêu chuẩn'}
                      </span>
                    </div>
                  </div>
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

          <div className="space-y-1.5">
            {FONT_PRESETS.map((font) => {
              const isSelected = fontFamily.includes(font.name);
              return (
                <div
                  key={font.name}
                  onClick={() => onFontFamilyChange(font.value)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                  style={{ fontFamily: font.value }}
                >
                  <div>
                    <div className="text-xs">{font.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{font.description}</div>
                  </div>
                  {isSelected && <CheckCircleOutlined className="text-blue-600 text-xs" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. GIÃN CÁCH DÒNG (Density) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Giãn cách dòng</span>
          </div>

          <Radio.Group
            value={density}
            onChange={(e) => onDensityChange(e.target.value)}
            className="w-full grid grid-cols-3 text-center !rounded-xl"
            buttonStyle="solid"
            size="small"
          >
            {DENSITY_PRESETS.map((d) => (
              <Radio.Button key={d.value} value={d.value} className="text-xs text-center !rounded-none first:!rounded-l-lg last:!rounded-r-lg">
                {d.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        {/* ── 5. QUẢN LÝ MỤC NỘI DUNG (Section Visibility) ── */}
        <div className="space-y-2.5 pt-3 border-0 border-t border-solid border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <AppstoreOutlined className="text-slate-500" />
            <span>Quản lý các mục</span>
          </div>

          <div className="space-y-2">
            {sectionsList.map((sec) => (
              <div
                key={sec.key}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <span className="text-slate-700 font-medium truncate max-w-[190px]">{sec.label}</span>
                <Switch
                  size="small"
                  checked={sectionVisibility[sec.key]}
                  onChange={(checked) => onToggleSection(sec.key, checked)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CvSidebarTools;
