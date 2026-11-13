/**
 * @file CvCanvas.tsx
 * @description Live WYSIWYG A4 Canvas matching PDF Page 20 & Page 25.
 * Features 6 distinct CV template layouts (ATS, Modern 2-column, Elegant banner,
 * Minimalist, Executive reverse 2-column, Creative Timeline) with fully working
 * inline editing, spacebar support, and editable education/experience time periods.
 */
import React, { useState } from 'react';
import { CvInlineField } from './CvInlineField';
import type {
  CvFontFamily,
  CvLayoutStyle,
  StructuredCvContent,
  StructuredCvExperience,
  StructuredCvEducation,
  StructuredCvProject,
  StructuredCvActivity,
} from '@/types/api/cvBuilder';
import type { SectionVisibility } from './CvSidebarTools';

export interface CvCanvasProps {
  content: StructuredCvContent;
  onChangeContent: (updated: Partial<StructuredCvContent>) => void;
  accentColor: string;
  fontFamily: CvFontFamily;
  layout: CvLayoutStyle;
  density: 'compact' | 'normal' | 'spacious';
  sectionVisibility: SectionVisibility;
  onToggleSection?: (key: keyof SectionVisibility, visible: boolean) => void;
  activeSection?: string;
  onSelectSection?: (key: string) => void;
  avatarUrl?: string;
  showAvatar?: boolean;
  onShowAvatarChange?: (show: boolean) => void;
  onAvatarUpload?: (dataUrl: string, file: File) => void;
  readOnly?: boolean;
}

export const CvCanvas: React.FC<CvCanvasProps> = ({
  content,
  onChangeContent,
  accentColor,
  fontFamily,
  layout,
  density,
  sectionVisibility,
  onToggleSection,
  activeSection = 'experiences',
  onSelectSection,
  avatarUrl,
  showAvatar = false,
  onShowAvatarChange,
  onAvatarUpload,
  readOnly = false,
}) => {
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [skillsText, setSkillsText] = useState<string>(() =>
    (content.skills || []).join(', ')
  );
  const [languagesText, setLanguagesText] = useState<string>(() =>
    (content.languages || []).join(', ')
  );
  const [certificatesText, setCertificatesText] = useState<string>(() =>
    (content.certificates || []).join(', ')
  );

  // Sync external changes safely without stripping user spaces / commas while typing
  React.useEffect(() => {
    const joined = (content.skills || []).join(', ');
    const parsed = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    if (joined !== parsed) {
      setSkillsText(joined);
    }
  }, [content.skills, skillsText]);

  React.useEffect(() => {
    const joined = (content.languages || []).join(', ');
    const parsed = languagesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    if (joined !== parsed) {
      setLanguagesText(joined);
    }
  }, [content.languages, languagesText]);

  React.useEffect(() => {
    const joined = (content.certificates || []).join(', ');
    const parsed = certificatesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    if (joined !== parsed) {
      setCertificatesText(joined);
    }
  }, [content.certificates, certificatesText]);

  const fontStack =
    {
      BE_VIETNAM_PRO: "'Be Vietnam Pro', system-ui, sans-serif",
      ROBOTO: "'Roboto', system-ui, sans-serif",
      INTER: "'Inter', system-ui, sans-serif",
    }[fontFamily] || "'Be Vietnam Pro', system-ui, sans-serif";

  const densityStyles = {
    compact: {
      sectionGap: 'gap-3.5',
      itemGap: 'space-y-2',
      lineHeight: 'leading-[1.45]',
      padding: 'p-6 sm:p-9',
    },
    normal: {
      sectionGap: 'gap-5',
      itemGap: 'space-y-3',
      lineHeight: 'leading-[1.55]',
      padding: 'p-6 sm:p-11',
    },
    spacious: {
      sectionGap: 'gap-6',
      itemGap: 'space-y-4',
      lineHeight: 'leading-[1.68]',
      padding: 'p-7 sm:p-12',
    },
  }[density];

  // ── Experience Handlers ──
  const handleAddExperience = () => {
    const nextExp: StructuredCvExperience = {
      title: 'Backend Developer',
      company: 'Công ty mới',
      startDate: '01/2024',
      endDate: 'nay',
      description: '• Thiết kế và phát triển tính năng chính của sản phẩm.',
    };
    onChangeContent({
      experiences: [...(content.experiences || []), nextExp],
    });
    onSelectSection?.('experiences');
  };

  const handleUpdateExperience = (
    index: number,
    field: keyof StructuredCvExperience,
    val: string
  ) => {
    const list = [...(content.experiences || [])];
    list[index] = { ...list[index], [field]: val };
    onChangeContent({ experiences: list });
  };

  const handleUpdateExperiencePeriod = (index: number, raw: string) => {
    const list = [...(content.experiences || [])];
    const match = raw.split(/\s*[-–—]\s*/);
    if (match.length >= 2) {
      list[index] = {
        ...list[index],
        startDate: match[0]?.trim() || '',
        endDate: match.slice(1).join(' – ').trim() || '',
      };
    } else {
      list[index] = {
        ...list[index],
        startDate: raw.trim(),
        endDate: '',
      };
    }
    onChangeContent({ experiences: list });
  };

  const handleRemoveExperience = (index: number) => {
    const list = (content.experiences || []).filter((_, i) => i !== index);
    onChangeContent({ experiences: list });
  };

  const handleMoveExperience = (fromIdx: number, toIdx: number) => {
    const list = [...(content.experiences || [])];
    if (toIdx < 0 || toIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    onChangeContent({ experiences: list });
  };

  // ── Education Handlers ──
  const handleAddEducation = () => {
    const nextEdu: StructuredCvEducation = {
      school: 'Đại học FPT',
      degree: 'Kỹ thuật phần mềm',
      startDate: '2019',
      endDate: '2023',
      description: '',
    };
    onChangeContent({
      educations: [...(content.educations || []), nextEdu],
    });
    onSelectSection?.('educations');
  };

  const handleUpdateEducation = (
    index: number,
    field: keyof StructuredCvEducation,
    val: string
  ) => {
    const list = [...(content.educations || [])];
    list[index] = { ...list[index], [field]: val };
    onChangeContent({ educations: list });
  };

  const handleUpdateEducationPeriod = (index: number, raw: string) => {
    const list = [...(content.educations || [])];
    const match = raw.split(/\s*[-–—]\s*/);
    if (match.length >= 2) {
      list[index] = {
        ...list[index],
        startDate: match[0]?.trim() || '',
        endDate: match.slice(1).join(' – ').trim() || '',
      };
    } else {
      list[index] = {
        ...list[index],
        startDate: raw.trim(),
        endDate: '',
      };
    }
    onChangeContent({ educations: list });
  };

  const handleRemoveEducation = (index: number) => {
    const list = (content.educations || []).filter((_, i) => i !== index);
    onChangeContent({ educations: list });
  };

  // ── Project Handlers ──
  const handleAddProject = () => {
    const nextProject: StructuredCvProject = {
      name: 'Hệ thống Quản lý Tuyển dụng',
      role: 'Backend Developer',
      startDate: '2024',
      endDate: 'nay',
      technologies: '.NET 8, PostgreSQL, Docker',
      description: '• Xây dựng API quản lý quy trình ứng tuyển và chấm điểm hồ sơ.',
    };
    onChangeContent({ projects: [...(content.projects || []), nextProject] });
    onSelectSection?.('projects');
  };

  const handleUpdateProject = (
    index: number,
    field: keyof StructuredCvProject,
    value: string
  ) => {
    const list = [...(content.projects || [])];
    list[index] = { ...list[index], [field]: value };
    onChangeContent({ projects: list });
  };

  const handleUpdateProjectPeriod = (index: number, raw: string) => {
    const list = [...(content.projects || [])];
    const match = raw.split(/\s*[-–—]\s*/);
    if (match.length >= 2) {
      list[index] = {
        ...list[index],
        startDate: match[0]?.trim() || '',
        endDate: match.slice(1).join(' – ').trim() || '',
      };
    } else {
      list[index] = {
        ...list[index],
        startDate: raw.trim(),
        endDate: '',
      };
    }
    onChangeContent({ projects: list });
  };

  const handleRemoveProject = (index: number) => {
    const list = (content.projects || []).filter((_, i) => i !== index);
    onChangeContent({ projects: list });
  };

  // ── Activity Handlers ──
  const handleAddActivity = () => {
    const nextActivity: StructuredCvActivity = {
      name: 'CLB Kỹ thuật Phần mềm',
      role: 'Thành viên Ban Chuyên môn',
      startDate: '2021',
      endDate: '2023',
      description: '• Tổ chức workshop chia sẻ kiến thức lập trình cho sinh viên.',
    };
    onChangeContent({ activities: [...(content.activities || []), nextActivity] });
    onSelectSection?.('activities');
  };

  const handleUpdateActivity = (
    index: number,
    field: keyof StructuredCvActivity,
    value: string
  ) => {
    const list = [...(content.activities || [])];
    list[index] = { ...list[index], [field]: value };
    onChangeContent({ activities: list });
  };

  const handleRemoveActivity = (index: number) => {
    const list = (content.activities || []).filter((_, i) => i !== index);
    onChangeContent({ activities: list });
  };

  const hiddenSectionLabels: Array<{ key: keyof SectionVisibility; label: string }> = [
    ...(!sectionVisibility.projects ? [{ key: 'projects' as const, label: 'Dự án nổi bật' }] : []),
    ...(!sectionVisibility.certificates ? [{ key: 'certificates' as const, label: 'Chứng chỉ' }] : []),
    ...(!sectionVisibility.activities ? [{ key: 'activities' as const, label: 'Hoạt động' }] : []),
  ];

  const isExperiencesActive = !readOnly && activeSection === 'experiences';
  const isElegant = layout === 'elegant';

  // ── Section Renderers ──

  const renderHeader = () => (
    <header
      onClick={() => !readOnly && onSelectSection?.('personal')}
      className={`cv-paper__header flex flex-col gap-4 transition-all duration-150 sm:flex-row sm:items-center sm:gap-6 ${
        isElegant
          ? '-mx-6 -mt-6 sm:-mx-11 sm:-mt-11 mb-2 p-6 sm:p-8 text-white rounded-t-[7px] shadow-sm'
          : 'border-0 border-b-[1.5px] border-solid pb-5'
      }`}
      style={{
        borderColor: isElegant ? 'transparent' : accentColor,
        backgroundColor: isElegant ? accentColor : 'transparent',
      }}
    >
      {/* Photo Box */}
      {readOnly ? (
        showAvatar && (
          <div
            className={`h-[104px] w-[88px] shrink-0 overflow-hidden rounded-[8px] ${
              isElegant ? 'ring-4 ring-white/80 shadow-md bg-white/20' : 'bg-[#E2E8F0]'
            }`}
          >
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt={content.fullName || 'Ảnh đại diện'}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        )
      ) : (
        <div className="group/photo relative h-[104px] w-[88px] shrink-0">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            aria-label="Chọn ảnh chân dung cho CV"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (dataUrl) {
                  onAvatarUpload?.(dataUrl, file);
                  onShowAvatarChange?.(true);
                }
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              photoInputRef.current?.click();
            }}
            className={`flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[8px] border text-[12px] font-medium outline-none transition-all duration-150 ${
              isElegant
                ? 'border-white/40 bg-white/15 text-white hover:bg-white/25 ring-2 ring-white/60'
                : 'border-dashed border-[#94A3B8] bg-[#F8FAFC] text-[#475569] hover:border-[#0284C7] hover:bg-[#F0F9FF]/60 hover:text-[#0369A1]'
            }`}
          >
            {showAvatar && avatarUrl ? (
              <>
                <img
                  src={avatarUrl}
                  alt={content.fullName || 'Ảnh đại diện'}
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/45 text-[11px] font-semibold text-white opacity-0 transition-opacity duration-150 group-hover/photo:opacity-100">
                  Đổi ảnh
                </span>
              </>
            ) : (
              <span>Thêm ảnh</span>
            )}
          </button>
          {showAvatar && avatarUrl && (
            <button
              type="button"
              title="Xóa ảnh"
              aria-label="Xóa ảnh khỏi CV"
              onClick={(e) => {
                e.stopPropagation();
                onShowAvatarChange?.(false);
              }}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-solid border-[#E2E8F0] bg-white text-[11px] font-bold text-[#475569] opacity-0 shadow-xs transition-opacity duration-150 hover:bg-[#FEE2E2] hover:text-[#DC2626] group-hover/photo:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Identity Block (Always full width with generous spacing, break-words, never clipped) */}
      <div className="min-w-0 flex-1">
        <CvInlineField
          value={content.fullName || ''}
          onChange={(val) => onChangeContent({ fullName: val })}
          placeholder="Trương Hoàng Quí"
          aria-label="Họ và tên"
          readOnly={readOnly}
          className={`!px-1 !py-0.5 text-[26px] font-bold leading-tight tracking-[-0.01em] break-words ${
            isElegant ? '!text-white' : 'text-[#0F172A]'
          }`}
        />

        <div className="mt-0.5">
          <CvInlineField
            value={content.headline || ''}
            onChange={(val) => onChangeContent({ headline: val })}
            placeholder="Backend Developer (.NET)"
            aria-label="Chức danh chuyên môn"
            readOnly={readOnly}
            className={`!px-1 !py-0.5 text-[15px] font-semibold ${isElegant ? '!text-white/90' : ''}`}
            style={isElegant ? undefined : { color: accentColor }}
          />
        </div>

        {/* Single-line dot-separated contact bar */}
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[12.5px] ${
            isElegant ? 'text-white/85' : 'text-[#475569]'
          }`}
        >
          <CvInlineField
            value={content.email || ''}
            onChange={(val) => onChangeContent({ email: val })}
            readOnly={readOnly}
            aria-label="Email liên hệ"
            placeholder="truongqui858@gmail.com"
            className={`!px-1 !py-0 w-auto min-w-[140px] ${isElegant ? '!text-white' : ''}`}
          />
          <span className={isElegant ? 'text-white/60' : 'text-slate-400'}>·</span>
          <CvInlineField
            value={content.phone || ''}
            onChange={(val) => onChangeContent({ phone: val })}
            readOnly={readOnly}
            aria-label="Số điện thoại"
            placeholder="0912 345 678"
            className={`!px-1 !py-0 w-auto min-w-[100px] ${isElegant ? '!text-white' : ''}`}
          />
          <span className={isElegant ? 'text-white/60' : 'text-slate-400'}>·</span>
          <CvInlineField
            value={content.address || ''}
            onChange={(val) => onChangeContent({ address: val })}
            readOnly={readOnly}
            aria-label="Địa chỉ"
            placeholder="Thủ Đức, Hồ Chí Minh"
            className={`!px-1 !py-0 w-auto min-w-[140px] ${isElegant ? '!text-white' : ''}`}
          />
        </div>
      </div>
    </header>
  );

  const renderSummarySection = () => {
    if (!sectionVisibility.summary) return null;
    return (
      <section
        key="summary"
        onClick={() => !readOnly && onSelectSection?.('summary')}
        className={`cv-paper__section rounded-[8px] transition-all duration-150 ${
          !readOnly && activeSection === 'summary'
            ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-2.5'
            : ''
        }`}
      >
        <h3
          className="m-0 mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          MỤC TIÊU NGHỀ NGHIỆP
        </h3>
        <CvInlineField
          multiline
          rows={2}
          value={content.summary || ''}
          onChange={(val) => onChangeContent({ summary: val })}
          placeholder="Lập trình viên backend 3 năm kinh nghiệm với .NET và SQL Server, mong muốn đảm nhận vai trò Senior trong môi trường sản phẩm."
          aria-label="Mục tiêu nghề nghiệp"
          readOnly={readOnly}
          className={`!px-1 !py-0.5 text-[13px] text-[#1E293B] ${densityStyles.lineHeight}`}
        />
      </section>
    );
  };

  const renderExperiencesSection = (isTimeline = false) => {
    if (!sectionVisibility.experiences) return null;
    return (
      <section
        key="experiences"
        onClick={() => !readOnly && onSelectSection?.('experiences')}
        className={`cv-paper__section relative rounded-[8px] transition-all duration-150 ${
          isExperiencesActive
            ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-3'
            : ''
        }`}
      >
        {/* Floating Dark Section Pill */}
        {isExperiencesActive && (
          <div className="no-print absolute -top-[30px] right-2 z-20 flex items-center gap-2.5 rounded-[6px] bg-slate-800 px-3 py-1 text-[11.5px] font-medium text-white shadow-md">
            <button
              type="button"
              title="Di chuyển lên"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveExperience(1, 0);
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-white/90 hover:text-white"
            >
              ↑
            </button>
            <button
              type="button"
              title="Di chuyển xuống"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveExperience(0, 1);
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-white/90 hover:text-white"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddExperience();
              }}
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-white hover:underline"
            >
              + Thêm kinh nghiệm
            </button>
            <button
              type="button"
              title="Ẩn mục Kinh nghiệm làm việc"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSection?.('experiences', false);
              }}
              className="ml-0.5 cursor-pointer border-0 bg-transparent p-0 text-white/85 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3
            className="m-0 text-[12px] font-bold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            KINH NGHIỆM LÀM VIỆC
          </h3>
          {!readOnly && !isExperiencesActive && (
            <button
              type="button"
              onClick={handleAddExperience}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[#0284C7] hover:underline"
            >
              + Thêm kinh nghiệm
            </button>
          )}
        </div>

        <div className={densityStyles.itemGap}>
          {(content.experiences || []).map((exp, idx) => {
            const rawDescription = exp.description || '';
            const lines = rawDescription
              .split('\n')
              .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
              .filter(Boolean);

            const expPeriod =
              exp.startDate && exp.endDate
                ? `${exp.startDate} – ${exp.endDate}`
                : exp.startDate || exp.endDate || '';

            return (
              <div
                key={idx}
                className={`group rounded-[6px] px-1 py-1 transition-colors duration-150 hover:bg-[#F8FAFC]/70 ${
                  isTimeline ? 'cv-timeline-item' : ''
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
                    <CvInlineField
                      value={exp.title}
                      onChange={(val) => handleUpdateExperience(idx, 'title', val)}
                      placeholder="Chức danh công việc"
                      aria-label={`Chức danh ${idx + 1}`}
                      readOnly={readOnly}
                      className="!px-1 !py-0 w-auto min-w-[140px] font-bold text-[#0F172A]"
                    />
                    <span className="text-slate-400 font-normal">·</span>
                    <CvInlineField
                      value={exp.company}
                      onChange={(val) => handleUpdateExperience(idx, 'company', val)}
                      placeholder="Tên công ty"
                      aria-label={`Tên công ty ${idx + 1}`}
                      readOnly={readOnly}
                      className="!px-1 !py-0 w-auto min-w-[120px] font-semibold text-slate-800"
                    />
                  </div>

                  {/* Inline Editable Time Period */}
                  <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-[#64748B]">
                    <CvInlineField
                      value={expPeriod}
                      onChange={(val) => handleUpdateExperiencePeriod(idx, val)}
                      readOnly={readOnly}
                      placeholder="03/2023 – nay"
                      aria-label={`Thời gian làm việc ${idx + 1}`}
                      className="!px-1.5 !py-0.5 w-auto min-w-[95px] text-right text-[12.5px] font-medium text-[#64748B]"
                    />
                    {!readOnly && (content.experiences || []).length > 1 && (
                      <button
                        type="button"
                        title="Xóa vị trí này"
                        onClick={() => handleRemoveExperience(idx)}
                        className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Bullet Points with Reliable Native Inline Inputs */}
                <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-[13px] text-[#1E293B]">
                  {(lines.length > 0 ? lines : ['']).map((bullet, bIdx) => (
                    <li key={bIdx} className={densityStyles.lineHeight}>
                      <CvInlineField
                        value={bullet}
                        onChange={(newBullet) => {
                          const nextLines = lines.length > 0 ? [...lines] : [''];
                          nextLines[bIdx] = newBullet;
                          handleUpdateExperience(
                            idx,
                            'description',
                            nextLines.map((l) => (l.startsWith('•') ? l : `• ${l}`)).join('\n')
                          );
                        }}
                        readOnly={readOnly}
                        placeholder="Mô tả công việc và thành tích..."
                        aria-label={`Chi tiết công việc ${idx + 1} mục ${bIdx + 1}`}
                        className="!px-1 !py-0 text-[13px] text-[#1E293B]"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderEducationsSection = (isTimeline = false) => {
    if (!sectionVisibility.educations) return null;
    return (
      <section
        key="educations"
        onClick={() => !readOnly && onSelectSection?.('educations')}
        className={`cv-paper__section rounded-[8px] transition-all duration-150 ${
          !readOnly && activeSection === 'educations'
            ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-2.5'
            : ''
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3
            className="m-0 text-[12px] font-bold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            HỌC VẤN
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddEducation}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[#0284C7] hover:underline"
            >
              + Thêm học vấn
            </button>
          )}
        </div>

        <div className="space-y-2 px-1">
          {(content.educations || []).map((edu, idx) => {
            const eduPeriod =
              edu.startDate && edu.endDate
                ? `${edu.startDate} – ${edu.endDate}`
                : edu.startDate || edu.endDate || '';

            return (
              <div
                key={idx}
                className={`flex flex-wrap items-baseline justify-between gap-2 rounded-[6px] px-1 py-1 transition-colors duration-150 hover:bg-[#F8FAFC]/70 ${
                  isTimeline ? 'cv-timeline-item' : ''
                }`}
              >
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
                  <CvInlineField
                    value={edu.school || ''}
                    onChange={(val) => handleUpdateEducation(idx, 'school', val)}
                    readOnly={readOnly}
                    aria-label={`Trường học ${idx + 1}`}
                    placeholder="Đại học FPT"
                    className="!px-1 !py-0 w-auto min-w-[120px] font-bold text-[#0F172A]"
                  />
                  <span className="text-slate-400 font-normal">–</span>
                  <CvInlineField
                    value={edu.degree || ''}
                    onChange={(val) => handleUpdateEducation(idx, 'degree', val)}
                    readOnly={readOnly}
                    aria-label={`Bằng cấp / Chuyên ngành ${idx + 1}`}
                    placeholder="Kỹ thuật phần mềm"
                    className="!px-1 !py-0 w-auto min-w-[120px] font-bold text-[#0F172A]"
                  />
                </div>

                {/* Inline Editable Education Period */}
                <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-[#64748B]">
                  <CvInlineField
                    value={eduPeriod}
                    onChange={(val) => handleUpdateEducationPeriod(idx, val)}
                    readOnly={readOnly}
                    aria-label={`Thời gian học vấn ${idx + 1}`}
                    placeholder="2019 – 2023"
                    className="!px-1.5 !py-0.5 w-auto min-w-[100px] text-right text-[12.5px] font-medium text-[#64748B]"
                  />
                  {!readOnly && (content.educations || []).length > 1 && (
                    <button
                      type="button"
                      title="Xóa mục học vấn này"
                      aria-label="Xóa mục học vấn này"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveEducation(idx);
                      }}
                      className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderSkillsSection = () => {
    if (!sectionVisibility.skills) return null;
    return (
      <section
        key="skills"
        onClick={() => !readOnly && onSelectSection?.('skills')}
        className={`cv-paper__section rounded-[8px] transition-all duration-150 ${
          !readOnly && activeSection === 'skills'
            ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-2.5'
            : ''
        }`}
      >
        <h3
          className="m-0 mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          KỸ NĂNG CHUYÊN MÔN
        </h3>
        <CvInlineField
          value={skillsText}
          onChange={(val) => {
            setSkillsText(val);
            onChangeContent({
              skills: val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          placeholder="C#, ASP.NET Core, Entity Framework, SQL Server, PostgreSQL, Docker, Git"
          aria-label="Kỹ năng chuyên môn"
          readOnly={readOnly}
          className="!px-1 !py-0.5 text-[13px] text-[#1E293B]"
        />
      </section>
    );
  };

  const renderLanguagesSection = () => {
    if (!sectionVisibility.languages) return null;
    return (
      <section
        key="languages"
        onClick={() => !readOnly && onSelectSection?.('languages')}
        className={`cv-paper__section rounded-[8px] transition-all duration-150 ${
          !readOnly && activeSection === 'languages'
            ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-2.5'
            : ''
        }`}
      >
        <h3
          className="m-0 mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          NGOẠI NGỮ
        </h3>
        <CvInlineField
          value={languagesText}
          onChange={(val) => {
            setLanguagesText(val);
            onChangeContent({
              languages: val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          placeholder="Tiếng Anh – đọc hiểu tài liệu kỹ thuật (TOEIC 750)"
          aria-label="Ngoại ngữ"
          readOnly={readOnly}
          className="!px-1 !py-0.5 text-[13px] text-[#1E293B]"
        />
      </section>
    );
  };

  const renderProjectsSection = () => {
    if (!sectionVisibility.projects) return null;
    return (
      <section
        key="projects"
        onClick={() => !readOnly && onSelectSection?.('projects')}
        className="cv-paper__section space-y-2"
      >
        <div className="flex items-center justify-between px-1">
          <h3
            className="m-0 text-[12px] font-bold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            DỰ ÁN NỔI BẬT
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddProject}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[#0284C7] hover:underline"
            >
              + Thêm dự án
            </button>
          )}
        </div>
        {(content.projects || []).length === 0 ? (
          !readOnly && (
            <button
              type="button"
              onClick={handleAddProject}
              className="w-full cursor-pointer rounded-[6px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-2 text-[12px] text-[#64748B] hover:border-[#0284C7] hover:text-[#0369A1]"
            >
              + Nhấp để thêm dự án nổi bật đầu tiên
            </button>
          )
        ) : (
          <div className="space-y-2.5 px-1">
            {(content.projects || []).map((proj, idx) => {
              const projPeriod =
                proj.startDate && proj.endDate
                  ? `${proj.startDate} – ${proj.endDate}`
                  : proj.startDate || proj.endDate || '';

              return (
                <div key={idx} className="rounded-[6px] p-1 hover:bg-[#F8FAFC]/70 transition-colors">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                      <CvInlineField
                        value={proj.name}
                        onChange={(v) => handleUpdateProject(idx, 'name', v)}
                        placeholder="Tên dự án"
                        aria-label={`Tên dự án ${idx + 1}`}
                        readOnly={readOnly}
                        className="!px-0 text-[13px] font-bold text-[#0F172A] w-auto min-w-[120px]"
                      />
                      {proj.role && (
                        <>
                          <span className="text-slate-400 font-normal">·</span>
                          <CvInlineField
                            value={proj.role}
                            onChange={(v) => handleUpdateProject(idx, 'role', v)}
                            placeholder="Vai trò"
                            aria-label={`Vai trò dự án ${idx + 1}`}
                            readOnly={readOnly}
                            className="!px-0 text-[12.5px] font-medium text-slate-700 w-auto min-w-[80px]"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-[#64748B]">
                      <CvInlineField
                        value={projPeriod}
                        onChange={(v) => handleUpdateProjectPeriod(idx, v)}
                        placeholder="2023 – 2024"
                        aria-label={`Thời gian dự án ${idx + 1}`}
                        readOnly={readOnly}
                        className="!px-1.5 !py-0.5 w-auto min-w-[90px] text-right text-[12.5px] font-medium text-[#64748B]"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          title="Xóa dự án này"
                          onClick={() => handleRemoveProject(idx)}
                          className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <CvInlineField
                    multiline
                    rows={2}
                    value={proj.description || ''}
                    onChange={(v) => handleUpdateProject(idx, 'description', v)}
                    placeholder="Mô tả dự án và công nghệ sử dụng..."
                    aria-label={`Mô tả dự án ${idx + 1}`}
                    readOnly={readOnly}
                    className="!px-0 text-[13px] text-[#1E293B]"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderCertificatesSection = () => {
    if (!sectionVisibility.certificates) return null;
    return (
      <section
        key="certificates"
        onClick={() => !readOnly && onSelectSection?.('certificates')}
        className="cv-paper__section"
      >
        <h3
          className="m-0 mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          CHỨNG CHỈ VÀ GIẢI THƯỞNG
        </h3>
        <CvInlineField
          value={certificatesText}
          onChange={(val) => {
            setCertificatesText(val);
            onChangeContent({
              certificates: val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          placeholder="AWS Certified Developer Associate, Giải Nhì Sinh viên Nghiên cứu Khoa học"
          aria-label="Chứng chỉ và giải thưởng"
          readOnly={readOnly}
          className="!px-1 !py-0.5 text-[13px] text-[#1E293B]"
        />
      </section>
    );
  };

  const renderActivitiesSection = () => {
    if (!sectionVisibility.activities) return null;
    return (
      <section
        key="activities"
        onClick={() => !readOnly && onSelectSection?.('activities')}
        className="cv-paper__section space-y-2"
      >
        <div className="flex items-center justify-between px-1">
          <h3
            className="m-0 text-[12px] font-bold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            HOẠT ĐỘNG
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddActivity}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[#0284C7] hover:underline"
            >
              + Thêm hoạt động
            </button>
          )}
        </div>
        {(content.activities || []).length === 0 ? (
          !readOnly && (
            <button
              type="button"
              onClick={handleAddActivity}
              className="w-full cursor-pointer rounded-[6px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-2 text-[12px] text-[#64748B] hover:border-[#0284C7] hover:text-[#0369A1]"
            >
              + Nhấp để thêm hoạt động ngoại khóa / tình nguyện
            </button>
          )
        ) : (
          <div className="space-y-2.5 px-1">
            {(content.activities || []).map((act, idx) => (
              <div key={idx} className="rounded-[6px] p-1 hover:bg-[#F8FAFC]/70 transition-colors">
                <div className="flex items-baseline justify-between gap-2">
                  <CvInlineField
                    value={act.name}
                    onChange={(v) => handleUpdateActivity(idx, 'name', v)}
                    placeholder="Tên hoạt động / Câu lạc bộ"
                    aria-label={`Tên hoạt động ${idx + 1}`}
                    readOnly={readOnly}
                    className="!px-0 text-[13px] font-bold text-[#0F172A] w-auto min-w-[140px]"
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      title="Xóa hoạt động này"
                      onClick={() => handleRemoveActivity(idx)}
                      className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
                <CvInlineField
                  multiline
                  rows={2}
                  value={act.description || ''}
                  onChange={(v) => handleUpdateActivity(idx, 'description', v)}
                  placeholder="Mô tả vai trò và đóng góp..."
                  aria-label={`Mô tả hoạt động ${idx + 1}`}
                  readOnly={readOnly}
                  className="!px-0 text-[13px] text-[#1E293B]"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // ── Layout Dispatcher ──
  const renderBodyLayout = () => {
    if (layout === 'modern') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[34%_66%] gap-6 sm:gap-7 items-start w-full">
          {/* Left Column (34%): Short reference items */}
          <div className="space-y-5">
            {renderSkillsSection()}
            {renderLanguagesSection()}
            {renderCertificatesSection()}
          </div>
          {/* Right Column (66%): Long main items */}
          <div className="space-y-5">
            {renderSummarySection()}
            {renderExperiencesSection()}
            {renderProjectsSection()}
            {renderEducationsSection()}
            {renderActivitiesSection()}
          </div>
        </div>
      );
    }

    if (layout === 'executive') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[66%_34%] gap-6 sm:gap-7 items-start w-full">
          {/* Left Column (66%): Long main items */}
          <div className="space-y-5">
            {renderSummarySection()}
            {renderExperiencesSection()}
            {renderProjectsSection()}
            {renderEducationsSection()}
            {renderActivitiesSection()}
          </div>
          {/* Right Column (34%): Sidebar with left divider */}
          <div className="space-y-5 border-0 md:border-l md:border-slate-200/80 md:pl-6">
            {renderSkillsSection()}
            {renderLanguagesSection()}
            {renderCertificatesSection()}
          </div>
        </div>
      );
    }

    if (layout === 'compact') {
      // Creative Timeline layout: vertical connecting line & dots
      return (
        <div className="space-y-5 w-full">
          {renderSummarySection()}
          {renderExperiencesSection(true /* isTimeline */)}
          {renderProjectsSection()}
          {renderEducationsSection(true /* isTimeline */)}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {renderSkillsSection()}
            {renderLanguagesSection()}
          </div>
          {renderCertificatesSection()}
          {renderActivitiesSection()}
        </div>
      );
    }

    if (layout === 'minimal') {
      // Minimalist with subtle horizontal hairline dividers
      return (
        <div className="space-y-5 w-full cv-minimal-body">
          {renderSummarySection()}
          {renderExperiencesSection()}
          {renderEducationsSection()}
          {renderProjectsSection()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {renderSkillsSection()}
            {renderLanguagesSection()}
          </div>
          {renderCertificatesSection()}
          {renderActivitiesSection()}
        </div>
      );
    }

    // Default 'ats' & 'elegant': sequential 1-column layout
    return (
      <div className="space-y-5 w-full">
        {renderSummarySection()}
        {renderExperiencesSection()}
        {renderEducationsSection()}
        {renderSkillsSection()}
        {renderLanguagesSection()}
        {renderProjectsSection()}
        {renderCertificatesSection()}
        {renderActivitiesSection()}
      </div>
    );
  };

  return (
    <div className="min-w-0 flex-1">
      {/* A4 Paper Card */}
      <div
        id={readOnly ? 'cv-paper-preview' : 'cv-paper-editor'}
        style={
          {
            '--cv-font-family': fontStack,
            fontFamily: fontStack,
            '--cv-accent': accentColor,
          } as React.CSSProperties
        }
        className={`cv-paper ${readOnly ? 'cv-paper--preview' : 'cv-paper--editor'} cv-paper--${layout} cv-density--${density} mx-auto w-full max-w-[820px] rounded-[8px] border border-solid border-[#E2E8F0] bg-white text-[#0F172A] shadow-[0_2px_10px_rgba(15,23,42,0.04)] ${densityStyles.padding} flex flex-col ${densityStyles.sectionGap} print:m-0 print:border-none print:shadow-none`}
      >
        {/* Full-width Top Header (All 6 Templates) */}
        {renderHeader()}

        {/* Structured Body (1-col or 2-col depending on template layout) */}
        {renderBodyLayout()}

        {/* Bottom Dashed Add Hidden Sections Box */}
        {!readOnly && hiddenSectionLabels.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const next = hiddenSectionLabels[0];
              if (next) {
                onToggleSection?.(next.key, true);
                onSelectSection?.(next.key);
              }
            }}
            className="no-print mt-1 flex h-[40px] w-full cursor-pointer items-center justify-center rounded-[7px] border border-dashed border-[#CBD5E1] bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[12.5px] font-normal text-[#475569] transition-colors duration-150 hover:border-[#0284C7] hover:bg-[#F8FAFC] hover:text-[#0369A1]"
          >
            + Thêm mục: {hiddenSectionLabels.map((s) => s.label).join(', ')}
          </button>
        )}
      </div>
    </div>
  );
};

export default CvCanvas;
