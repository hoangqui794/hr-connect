/**
 * @file CvCanvas.tsx
 * @description Live WYSIWYG A4 Canvas matching PDF Page 20 & Page 25.
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

  // Sync external changes
  React.useEffect(() => {
    setSkillsText((content.skills || []).join(', '));
  }, [content.skills]);

  React.useEffect(() => {
    setLanguagesText((content.languages || []).join(', '));
  }, [content.languages]);

  React.useEffect(() => {
    setCertificatesText((content.certificates || []).join(', '));
  }, [content.certificates]);

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

  // Experience handlers
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

  // Education handlers
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

  // Project handlers
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

  // Activity handlers
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

  const hiddenSectionLabels: Array<{ key: keyof SectionVisibility; label: string }> = [
    ...(!sectionVisibility.projects ? [{ key: 'projects' as const, label: 'Dự án nổi bật' }] : []),
    ...(!sectionVisibility.certificates ? [{ key: 'certificates' as const, label: 'Chứng chỉ' }] : []),
    ...(!sectionVisibility.activities ? [{ key: 'activities' as const, label: 'Hoạt động' }] : []),
  ];

  const isExperiencesActive = !readOnly && activeSection === 'experiences';

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
        {/* ── HEADER: PERSONAL INFORMATION (PDF Page 20 & Page 25) ── */}
        <header
          onClick={() => !readOnly && onSelectSection?.('personal')}
          className="flex flex-col gap-4 border-0 border-b-[1.5px] border-solid pb-5 sm:flex-row sm:items-center sm:gap-6"
          style={{ borderColor: accentColor }}
        >
          {/* Photo Box ("Thêm ảnh" in Editor or grey photo block in Preview) */}
          {readOnly ? (
            showAvatar && (
              <div className="h-[104px] w-[88px] shrink-0 overflow-hidden rounded-[6px] bg-[#E2E8F0]">
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
                className="flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[6px] border border-dashed border-[#94A3B8] bg-[#F8FAFC] text-[12px] font-medium text-[#475569] outline-none transition-all duration-150 hover:border-[#0284C7] hover:bg-[#F0F9FF]/60 hover:text-[#0369A1]"
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

          {/* Identity Block */}
          <div className="min-w-0 flex-1">
            <CvInlineField
              value={content.fullName || ''}
              onChange={(val) => onChangeContent({ fullName: val })}
              placeholder="Trương Hoàng Quí"
              aria-label="Họ và tên"
              readOnly={readOnly}
              className="!px-1 !py-0.5 text-[26px] font-bold leading-tight tracking-[-0.01em] text-[#0F172A]"
            />

            <div className="mt-0.5">
              <CvInlineField
                value={content.headline || ''}
                onChange={(val) => onChangeContent({ headline: val })}
                placeholder="Backend Developer (.NET)"
                aria-label="Chức danh chuyên môn"
                readOnly={readOnly}
                className="!px-1 !py-0.5 text-[15px] font-semibold"
                style={{ color: accentColor }}
              />
            </div>

            {/* Single-line dot-separated contact bar matching PDF Page 20 */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[12.5px] text-[#475569]">
              <CvInlineField
                value={content.email || ''}
                onChange={(val) => onChangeContent({ email: val })}
                readOnly={readOnly}
                aria-label="Email liên hệ"
                placeholder="truongqui858@gmail.com"
                className="!px-1 !py-0 w-auto min-w-[140px]"
              />
              <span className="text-slate-400">·</span>
              <CvInlineField
                value={content.phone || ''}
                onChange={(val) => onChangeContent({ phone: val })}
                readOnly={readOnly}
                aria-label="Số điện thoại"
                placeholder="0912 345 678"
                className="!px-1 !py-0 w-auto min-w-[100px]"
              />
              <span className="text-slate-400">·</span>
              <CvInlineField
                value={content.address || ''}
                onChange={(val) => onChangeContent({ address: val })}
                readOnly={readOnly}
                aria-label="Địa chỉ"
                placeholder="Thủ Đức, Hồ Chí Minh"
                className="!px-1 !py-0 w-auto min-w-[140px]"
              />
            </div>
          </div>
        </header>

        {/* ── SECTION: MỤC TIÊU NGHỀ NGHIỆP ── */}
        {sectionVisibility.summary && (
          <section
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
        )}

        {/* ── SECTION: KINH NGHIỆM LÀM VIỆC (With Active Section Highlight & Floating Dark Action Pill matching PDF Page 20) ── */}
        {sectionVisibility.experiences && (
          <section
            onClick={() => !readOnly && onSelectSection?.('experiences')}
            className={`cv-paper__section relative rounded-[8px] transition-all duration-150 ${
              isExperiencesActive
                ? '-mx-3 border-[1.5px] border-solid border-[#0284C7] px-3 py-3'
                : ''
            }`}
          >
            {/* Dark Navy Floating Section Action Pill (PDF Page 20: ↑ ↓ + Thêm kinh nghiệm ×) */}
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

            <h3
              className="m-0 mb-2 px-1 text-[12px] font-bold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              KINH NGHIỆM LÀM VIỆC
            </h3>

            <div className={densityStyles.itemGap}>
              {(content.experiences || []).map((exp, idx) => {
                const lines = (exp.description || '')
                  .split('\n')
                  .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
                  .filter(Boolean);

                return (
                  <div key={idx} className="group relative px-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
                        <CvInlineField
                          value={exp.title || ''}
                          onChange={(val) => handleUpdateExperience(idx, 'title', val)}
                          readOnly={readOnly}
                          aria-label={`Chức danh ${idx + 1}`}
                          placeholder="Backend Developer"
                          className="!px-1 !py-0 w-auto min-w-[130px] font-bold text-[#0F172A]"
                        />
                        <span className="text-slate-400 font-normal">·</span>
                        <CvInlineField
                          value={exp.company || ''}
                          onChange={(val) => handleUpdateExperience(idx, 'company', val)}
                          readOnly={readOnly}
                          aria-label={`Công ty ${idx + 1}`}
                          placeholder="Công ty ABC Tech"
                          className="!px-1 !py-0 w-auto min-w-[130px] font-bold text-[#0F172A]"
                        />
                      </div>

                      <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-[#64748B]">
                        <CvInlineField
                          value={exp.startDate || ''}
                          onChange={(val) => handleUpdateExperience(idx, 'startDate', val)}
                          readOnly={readOnly}
                          placeholder="01/2024"
                          aria-label={`Ngày bắt đầu ${idx + 1}`}
                          className="!px-1 !py-0 w-16 text-center text-[12.5px] text-[#64748B]"
                        />
                        <span>–</span>
                        <CvInlineField
                          value={exp.endDate || ''}
                          onChange={(val) => handleUpdateExperience(idx, 'endDate', val)}
                          readOnly={readOnly}
                          placeholder="nay"
                          aria-label={`Ngày kết thúc ${idx + 1}`}
                          className="!px-1 !py-0 w-14 text-center text-[12.5px] text-[#64748B]"
                        />
                        {!readOnly && (content.experiences || []).length > 1 && (
                          <button
                            type="button"
                            title="Xóa vị trí này"
                            onClick={() => handleRemoveExperience(idx)}
                            className="ml-1 hidden cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#94A3B8] hover:text-[#DC2626] group-hover:inline"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bullet points rendered cleanly with inline editing */}
                    <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-[13px] text-[#1E293B]">
                      {(lines.length > 0 ? lines : ['']).map((bullet, bIdx) => {
                        const isHighlightedBullet =
                          isExperiencesActive && idx === 0 && bIdx === 1;
                        return (
                          <li key={bIdx} className={densityStyles.lineHeight}>
                            <span
                              contentEditable={!readOnly}
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const nextLines = lines.length > 0 ? [...lines] : [''];
                                nextLines[bIdx] = e.currentTarget.textContent || '';
                                handleUpdateExperience(
                                  idx,
                                  'description',
                                  nextLines.map((l) => `• ${l}`).join('\n')
                                );
                              }}
                              className={`inline-block rounded px-1 py-0 text-[13px] text-[#1E293B] outline-none ${
                                isHighlightedBullet
                                  ? 'border border-solid border-[#38BDF8] bg-[#E0F2FE]/60'
                                  : 'hover:bg-[#F8FAFC] focus:border focus:border-solid focus:border-[#0284C7] focus:bg-white'
                              }`}
                            >
                              {bullet}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SECTION: HỌC VẤN ── */}
        {sectionVisibility.educations && (
          <section
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
              {!readOnly && activeSection === 'educations' && (
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
              {(content.educations || []).map((edu, idx) => (
                <div key={idx} className="flex flex-wrap items-baseline justify-between gap-2">
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
                  <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-[#64748B]">
                    <CvInlineField
                      value={edu.startDate || ''}
                      onChange={(val) => handleUpdateEducation(idx, 'startDate', val)}
                      readOnly={readOnly}
                      aria-label={`Năm bắt đầu học vấn ${idx + 1}`}
                      placeholder="2019"
                      className="!px-1 !py-0 w-16 text-center text-[12.5px] text-[#64748B]"
                    />
                    <span>–</span>
                    <CvInlineField
                      value={edu.endDate || ''}
                      onChange={(val) => handleUpdateEducation(idx, 'endDate', val)}
                      readOnly={readOnly}
                      aria-label={`Năm kết thúc học vấn ${idx + 1}`}
                      placeholder="2023"
                      className="!px-1 !py-0 w-16 text-center text-[12.5px] text-[#64748B]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION: KỸ NĂNG CHUYÊN MÔN ── */}
        {sectionVisibility.skills && (
          <section
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
        )}

        {/* ── SECTION: NGOẠI NGỮ ── */}
        {sectionVisibility.languages && (
          <section
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
        )}

        {/* ── OPTIONAL SECTION: DỰ ÁN NỔI BẬT ── */}
        {sectionVisibility.projects && (
          <section
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
                {(content.projects || []).map((proj, idx) => (
                  <div key={idx}>
                    <CvInlineField
                      value={proj.name}
                      onChange={(v) => handleUpdateProject(idx, 'name', v)}
                      placeholder="Tên dự án"
                      readOnly={readOnly}
                      className="!px-0 text-[13px] font-bold text-[#0F172A]"
                    />
                    <CvInlineField
                      multiline
                      rows={2}
                      value={proj.description || ''}
                      onChange={(v) => handleUpdateProject(idx, 'description', v)}
                      placeholder="Mô tả dự án và công nghệ sử dụng..."
                      readOnly={readOnly}
                      className="!px-0 text-[13px] text-[#1E293B]"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── OPTIONAL SECTION: CHỨNG CHỈ VÀ GIẢI THƯỞNG ── */}
        {sectionVisibility.certificates && (
          <section
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
        )}

        {/* ── OPTIONAL SECTION: HOẠT ĐỘNG ── */}
        {sectionVisibility.activities && (
          <section
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
                  <div key={idx}>
                    <CvInlineField
                      value={act.name}
                      onChange={(v) => handleUpdateActivity(idx, 'name', v)}
                      placeholder="Tên hoạt động / Câu lạc bộ"
                      readOnly={readOnly}
                      className="!px-0 text-[13px] font-bold text-[#0F172A]"
                    />
                    <CvInlineField
                      multiline
                      rows={2}
                      value={act.description || ''}
                      onChange={(v) => handleUpdateActivity(idx, 'description', v)}
                      placeholder="Mô tả vai trò và đóng góp..."
                      readOnly={readOnly}
                      className="!px-0 text-[13px] text-[#1E293B]"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── BOTTOM DASHED ADD HIDDEN SECTIONS BOX (PDF Page 20: "+ Thêm mục: Dự án nổi bật, Chứng chỉ, Hoạt động") ── */}
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
