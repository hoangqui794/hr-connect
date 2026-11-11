/**
 * @file CvSidebarTools.tsx
 * @description Left card ("Các mục trong CV") for Candidate CV Builder matching PDF Page 20.
 */
import React from 'react';
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
  { name: 'Xanh Azure', value: '#0284C7' },
  { name: 'Xanh Rêu', value: '#166534' },
  { name: 'Đỏ Mận', value: '#9F1239' },
  { name: 'Đen Xám', value: '#334155' },
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

export interface SectionVisibility {
  summary: boolean;
  experiences: boolean;
  projects: boolean;
  educations: boolean;
  activities: boolean;
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
  avatarUrl?: string;
  showAvatar: boolean;
  onShowAvatarChange: (show: boolean) => void;
  sectionVisibility: SectionVisibility;
  onToggleSection: (key: keyof SectionVisibility, visible: boolean) => void;
  activeSection?: string;
  onSelectSection?: (key: string) => void;
}

export const CvSidebarTools: React.FC<CvSidebarToolsProps> = ({
  sectionVisibility,
  onToggleSection,
  activeSection = 'experiences',
  onSelectSection,
}) => {
  const visibleSectionCount = Object.values(sectionVisibility).filter(Boolean).length;

  const items: Array<{
    id: string;
    key?: keyof SectionVisibility;
    label: string;
    checked: boolean;
    alwaysOn?: boolean;
  }> = [
    {
      id: 'personal',
      label: 'Thông tin cá nhân',
      checked: true,
      alwaysOn: true,
    },
    {
      id: 'summary',
      key: 'summary',
      label: 'Mục tiêu nghề nghiệp',
      checked: sectionVisibility.summary,
    },
    {
      id: 'experiences',
      key: 'experiences',
      label: 'Kinh nghiệm làm việc',
      checked: sectionVisibility.experiences,
    },
    {
      id: 'educations',
      key: 'educations',
      label: 'Học vấn và bằng cấp',
      checked: sectionVisibility.educations,
    },
    {
      id: 'skills',
      key: 'skills',
      label: 'Kỹ năng chuyên môn',
      checked: sectionVisibility.skills,
    },
    {
      id: 'languages',
      key: 'languages',
      label: 'Ngoại ngữ',
      checked: sectionVisibility.languages,
    },
    {
      id: 'projects',
      key: 'projects',
      label: 'Dự án nổi bật',
      checked: sectionVisibility.projects,
    },
    {
      id: 'certificates',
      key: 'certificates',
      label: 'Chứng chỉ và giải thưởng',
      checked: sectionVisibility.certificates,
    },
    {
      id: 'activities',
      key: 'activities',
      label: 'Hoạt động',
      checked: sectionVisibility.activities,
    },
  ];

  const handleEnableHiddenSection = () => {
    const firstHidden = (['projects', 'certificates', 'activities'] as Array<keyof SectionVisibility>).find(
      (k) => !sectionVisibility[k]
    );
    if (firstHidden) {
      onToggleSection(firstHidden, true);
      onSelectSection?.(firstHidden);
    }
  };

  return (
    <aside
      aria-label="Các mục trong CV"
      className="w-full shrink-0 select-none font-['Be_Vietnam_Pro',system-ui,sans-serif] lg:w-[252px] lg:sticky lg:top-[108px] lg:self-start"
    >
      <div className="rounded-[10px] border border-solid border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <h2 className="m-0 text-[13px] font-bold text-[#0F172A]">Các mục trong CV</h2>
        <p className="m-0 mt-1 text-[11px] leading-[1.45] text-[#64748B]">
          Kéo để đổi thứ tự, bỏ chọn để ẩn mục.
        </p>

        <div className="mt-3 divide-y divide-[#F1F5F9]">
          {items.map((item) => {
            const isActive = activeSection === item.id;
            const canUncheck = !item.alwaysOn && !(item.checked && visibleSectionCount <= 1);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"
              >
                <button
                  type="button"
                  onClick={() => onSelectSection?.(item.id)}
                  className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-['Be_Vietnam_Pro',system-ui,sans-serif] transition-colors duration-150 ${
                    isActive
                      ? 'font-semibold text-[#0369A1]'
                      : item.checked
                        ? 'font-medium text-[#1E293B] hover:text-[#0369A1]'
                        : 'font-normal text-[#64748B] hover:text-[#334155]'
                  }`}
                >
                  {/* 6-dot drag handle */}
                  <svg
                    width="10"
                    height="14"
                    viewBox="0 0 10 14"
                    fill="#94A3B8"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <circle cx="2.5" cy="2.5" r="1.1" />
                    <circle cx="7.5" cy="2.5" r="1.1" />
                    <circle cx="2.5" cy="7" r="1.1" />
                    <circle cx="7.5" cy="7" r="1.1" />
                    <circle cx="2.5" cy="11.5" r="1.1" />
                    <circle cx="7.5" cy="11.5" r="1.1" />
                  </svg>
                  <span className="truncate">{item.label}</span>
                </button>

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={`${item.checked ? 'Ẩn' : 'Hiện'} ${item.label}`}
                  disabled={!canUncheck && item.checked}
                  onClick={() => {
                    if (item.key) {
                      onToggleSection(item.key, !item.checked);
                    }
                  }}
                  className={`flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[4px] transition-colors duration-150 ${
                    item.checked
                      ? 'border border-solid border-[#0284C7] bg-[#0284C7] text-white'
                      : 'border border-solid border-[#94A3B8] bg-white text-transparent hover:border-[#0284C7]'
                  } disabled:cursor-default`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleEnableHiddenSection}
          className="mt-3 flex h-[36px] w-full cursor-pointer items-center justify-center rounded-[7px] border border-dashed border-[#CBD5E1] bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[12px] font-medium text-[#334155] transition-colors duration-150 hover:border-[#0284C7] hover:bg-[#F8FAFC] hover:text-[#0369A1]"
        >
          + Thêm mục tùy chỉnh
        </button>
      </div>
    </aside>
  );
};

export default CvSidebarTools;
