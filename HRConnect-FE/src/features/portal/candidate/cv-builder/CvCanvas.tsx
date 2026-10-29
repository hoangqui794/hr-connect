import React, { useState } from 'react';
import { Button, Tooltip, Tag } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  BookOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  TranslationOutlined,
  StarOutlined,
  CodeOutlined,
  TeamOutlined,
} from '@ant-design/icons';
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
  avatarUrl?: string;
  showAvatar?: boolean;
  readOnly?: boolean;
}

const DEFAULT_SKILL_SUGGESTIONS = [
  'React',
  'TypeScript',
  'Node.js',
  'JavaScript',
  'Python',
  'Java',
  'Golang',
  'Docker',
  'PostgreSQL',
  'AWS',
  'Git',
  'CI/CD',
];

export const CvCanvas: React.FC<CvCanvasProps> = ({
  content,
  onChangeContent,
  accentColor,
  fontFamily,
  layout,
  density,
  sectionVisibility,
  avatarUrl,
  showAvatar = false,
  readOnly = false,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [newSkillText, setNewSkillText] = useState<string>('');
  const [isAddingSkill, setIsAddingSkill] = useState<boolean>(false);
  const [newLangText, setNewLangText] = useState<string>('');
  const [isAddingLang, setIsAddingLang] = useState<boolean>(false);
  const [newCertText, setNewCertText] = useState<string>('');
  const [isAddingCert, setIsAddingCert] = useState<boolean>(false);

  const fontStack = {
    BE_VIETNAM_PRO: "'Be Vietnam Pro', sans-serif",
    ROBOTO: "'Roboto', sans-serif",
    INTER: "'Inter', sans-serif",
  }[fontFamily] || "'Inter', sans-serif";

  // Density styles
  const densityStyles = {
    compact: {
      sectionGap: 'gap-4',
      itemGap: 'space-y-2',
      lineHeight: 'leading-snug',
      padding: 'p-8 sm:p-10',
    },
    normal: {
      sectionGap: 'gap-6',
      itemGap: 'space-y-3.5',
      lineHeight: 'leading-relaxed',
      padding: 'p-10 sm:p-12',
    },
    spacious: {
      sectionGap: 'gap-8',
      itemGap: 'space-y-5',
      lineHeight: 'leading-loose',
      padding: 'p-12 sm:p-14',
    },
  }[density];

  // Experience handlers
  const handleAddExperience = () => {
    const nextExp: StructuredCvExperience = {
      title: 'Chức danh vị trí',
      company: 'Tên công ty / Tổ chức',
      startDate: '01/2023',
      endDate: 'Hiện tại',
      description: 'Mô tả trách nhiệm chính, các dự án công nghệ và thành tựu nổi bật đạt được...',
    };
    onChangeContent({
      experiences: [...(content.experiences || []), nextExp],
    });
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

  const handleAddProject = () => {
    const nextProject: StructuredCvProject = {
      name: 'Tên dự án', role: 'Vai trò của bạn', startDate: '', endDate: '',
      technologies: '', url: '',
      description: 'Mô tả bài toán, phần việc bạn thực hiện và kết quả nổi bật...',
    };
    onChangeContent({ projects: [...(content.projects || []), nextProject] });
  };

  const handleUpdateProject = (index: number, field: keyof StructuredCvProject, value: string) => {
    const list = [...(content.projects || [])];
    list[index] = { ...list[index], [field]: value };
    onChangeContent({ projects: list });
  };

  const handleRemoveProject = (index: number) =>
    onChangeContent({ projects: (content.projects || []).filter((_, itemIndex) => itemIndex !== index) });

  // Education handlers
  const handleAddEducation = () => {
    const nextEdu: StructuredCvEducation = {
      school: 'Tên trường / Học viện',
      degree: 'Cử nhân / Chuyên ngành',
      startDate: '2019',
      endDate: '2023',
      description: 'Điểm trung bình (GPA), đề tài tốt nghiệp hoặc giải thưởng nghiên cứu...',
    };
    onChangeContent({
      educations: [...(content.educations || []), nextEdu],
    });
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

  const handleRemoveEducation = (index: number) => {
    const list = (content.educations || []).filter((_, i) => i !== index);
    onChangeContent({ educations: list });
  };

  const handleAddActivity = () => {
    const nextActivity: StructuredCvActivity = {
      name: 'Tên tổ chức / Hoạt động', role: 'Vai trò của bạn', startDate: '', endDate: '',
      description: 'Mô tả đóng góp, trách nhiệm hoặc thành tích nổi bật...',
    };
    onChangeContent({ activities: [...(content.activities || []), nextActivity] });
  };

  const handleUpdateActivity = (index: number, field: keyof StructuredCvActivity, value: string) => {
    const list = [...(content.activities || [])];
    list[index] = { ...list[index], [field]: value };
    onChangeContent({ activities: list });
  };

  const handleRemoveActivity = (index: number) =>
    onChangeContent({ activities: (content.activities || []).filter((_, itemIndex) => itemIndex !== index) });

  // Skills handlers
  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !(content.skills || []).includes(trimmed)) {
      onChangeContent({ skills: [...(content.skills || []), trimmed] });
      setNewSkillText('');
      setIsAddingSkill(false);
    }
  };

  const handleRemoveSkill = (skill: string) => {
    onChangeContent({
      skills: (content.skills || []).filter((s) => s !== skill),
    });
  };

  // Languages handlers
  const handleAddLanguage = (lang: string) => {
    const trimmed = lang.trim();
    if (trimmed && !(content.languages || []).includes(trimmed)) {
      onChangeContent({ languages: [...(content.languages || []), trimmed] });
      setNewLangText('');
      setIsAddingLang(false);
    }
  };

  const handleRemoveLanguage = (lang: string) => {
    onChangeContent({
      languages: (content.languages || []).filter((l) => l !== lang),
    });
  };

  // Certificates handlers
  const handleAddCertificate = (cert: string) => {
    const trimmed = cert.trim();
    if (trimmed && !(content.certificates || []).includes(trimmed)) {
      onChangeContent({ certificates: [...(content.certificates || []), trimmed] });
      setNewCertText('');
      setIsAddingCert(false);
    }
  };

  const handleRemoveCertificate = (cert: string) => {
    onChangeContent({
      certificates: (content.certificates || []).filter((c) => c !== cert),
    });
  };

  return (
    <div className="flex-1 min-h-0 h-full bg-[#f0f2f5] overflow-auto flex flex-col relative">
      {/* Zoom Toolbar */}
      <div className="sticky top-3 left-1/2 -translate-x-1/2 z-20 mx-auto bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md rounded-full px-3 py-1 flex items-center gap-1.5 select-none my-2">
        <Tooltip title="Thu nhỏ">
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<ZoomOutOutlined />}
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            disabled={zoom <= 50}
          />
        </Tooltip>
        <span className="text-xs font-semibold text-slate-700 min-w-[40px] text-center">
          {zoom}%
        </span>
        <Tooltip title="Phóng to">
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<ZoomInOutlined />}
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            disabled={zoom >= 150}
          />
        </Tooltip>
        <div className="w-[1px] h-3.5 bg-slate-200 mx-1" />
        <Tooltip title="Kích thước chuẩn (100%)">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined className="text-xs" />}
            onClick={() => setZoom(100)}
          >
            100%
          </Button>
        </Tooltip>
      </div>

      {/* Canvas Paper Container */}
      <div className="flex-1 flex justify-center items-start pb-16 px-4">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="shrink-0"
        >
          {/* A4 Paper */}
          <div
            id={readOnly ? 'cv-paper-preview' : 'cv-paper-editor'}
            style={{
              width: '794px',
              minHeight: '1123px',
              '--cv-font-family': fontStack,
              fontFamily: fontStack,
              '--cv-accent': accentColor,
            } as React.CSSProperties}
            className={`cv-paper ${readOnly ? 'cv-paper--preview' : 'cv-paper--editor'} cv-paper--${layout} cv-density--${density} bg-white text-slate-800 shadow-xl rounded-sm ${densityStyles.padding} flex flex-col ${densityStyles.sectionGap} border border-slate-200/60 print:shadow-none print:m-0 print:border-none`}
          >
            {/* ── HEADER: PERSONAL INFORMATION ── */}
            <header
              className={`cv-paper__header relative border-0 border-b-2 border-solid pb-5 ${showAvatar && avatarUrl ? 'cv-paper__header--with-avatar' : ''}`}
              style={{ borderColor: accentColor }}
            >
              {showAvatar && avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={`Ảnh đại diện của ${content.fullName || 'ứng viên'}`}
                  className="cv-paper__avatar"
                />
              )}
              {/* Full Name */}
              <div className="mb-1">
                <CvInlineField
                  value={content.fullName || ''}
                  onChange={(val) => onChangeContent({ fullName: val })}
                  placeholder="HỌ VÀ TÊN CỦA BẠN"
                  aria-label="Họ và tên"
                  readOnly={readOnly}
                  className={`text-3xl font-extrabold uppercase tracking-tight placeholder:normal-case placeholder:font-bold ${layout === 'modern' ? 'text-white' : 'text-slate-900'}`}
                  style={{ color: layout === 'modern' ? '#ffffff' : accentColor }}
                />
              </div>

              {/* Headline */}
              <div className="mb-3">
                <CvInlineField
                  value={content.headline || ''}
                  onChange={(val) => onChangeContent({ headline: val })}
                  placeholder="Vị trí ứng tuyển (VD: Senior Frontend Engineer)"
                  aria-label="Chức danh chuyên môn"
                  readOnly={readOnly}
                  className={`text-base font-semibold tracking-wide ${layout === 'modern' ? 'text-white/90' : 'text-slate-600'}`}
                />
              </div>

              {/* Contact Bar */}
              <div className={`flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs ${layout === 'modern' ? 'text-white/85' : 'text-slate-600'}`}>
                <div className="flex items-center gap-1.5 min-w-[170px]">
                  <MailOutlined className={layout === 'modern' ? 'text-white/80' : 'text-slate-400'} />
                  <CvInlineField
                    value={content.email || ''}
                    onChange={(val) => onChangeContent({ email: val })}
                    placeholder="email@example.com"
                    aria-label="Email"
                    readOnly={readOnly}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 min-w-[140px]">
                  <PhoneOutlined className={layout === 'modern' ? 'text-white/80' : 'text-slate-400'} />
                  <CvInlineField
                    value={content.phone || ''}
                    onChange={(val) => onChangeContent({ phone: val })}
                    placeholder="0912 345 678"
                    aria-label="Số điện thoại"
                    readOnly={readOnly}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <HomeOutlined className={layout === 'modern' ? 'text-white/80' : 'text-slate-400'} />
                  <CvInlineField
                    value={content.address || ''}
                    onChange={(val) => onChangeContent({ address: val })}
                    placeholder="Địa chỉ / Thành phố (VD: Hà Nội, Việt Nam)"
                    aria-label="Địa chỉ"
                    readOnly={readOnly}
                    className="text-xs"
                  />
                </div>
              </div>
            </header>

            {/* ── SECTION: SUMMARY ── */}
            {sectionVisibility.summary && (
              <section className="cv-paper__section cv-paper__section--summary space-y-2">
                <div className="flex items-center gap-2 pb-1 border-0 border-b border-solid border-slate-200">
                  <ThunderboltOutlined style={{ color: accentColor }} className="text-sm" />
                  <h3
                    className="text-xs font-bold uppercase tracking-wider m-0"
                    style={{ color: accentColor }}
                  >
                    Mục tiêu nghề nghiệp & Tóm tắt
                  </h3>
                </div>
                <CvInlineField
                  multiline
                  rows={3}
                  value={content.summary || ''}
                  onChange={(val) => onChangeContent({ summary: val })}
                  placeholder="Mô tả tóm tắt kỹ năng chuyên môn, kinh nghiệm nổi bật và định hướng phát triển sự nghiệp của bạn..."
                  aria-label="Mục tiêu nghề nghiệp"
                  readOnly={readOnly}
                  className={`text-xs text-slate-700 ${densityStyles.lineHeight}`}
                />
              </section>
            )}

            {/* ── SECTION: WORK EXPERIENCES ── */}
            {sectionVisibility.experiences && (
              <section className="cv-paper__section cv-paper__section--experiences space-y-3">
                <div className="flex items-center justify-between pb-1 border-0 border-b border-solid border-slate-200">
                  <div className="flex items-center gap-2">
                    <ApartmentOutlined style={{ color: accentColor }} className="text-sm" />
                    <h3
                      className="text-xs font-bold uppercase tracking-wider m-0"
                      style={{ color: accentColor }}
                    >
                      Kinh nghiệm làm việc
                    </h3>
                  </div>
                  {!readOnly && (
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddExperience}
                      className="text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      Thêm vị trí
                    </Button>
                  )}
                </div>

                <div className={densityStyles.itemGap}>
                  {(content.experiences || []).length === 0 ? (
                    <div
                      onClick={handleAddExperience}
                      className="p-4 border border-dashed border-slate-300 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 text-xs text-slate-400"
                    >
                      + Nhấp vào đây để thêm mốc kinh nghiệm làm việc đầu tiên
                    </div>
                  ) : (
                    content.experiences.map((exp, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-md p-2 -mx-2 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Remove item button */}
                        {!readOnly && (
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip title="Xóa mốc kinh nghiệm này">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined className="text-xs" />}
                                onClick={() => handleRemoveExperience(idx)}
                              />
                            </Tooltip>
                          </div>
                        )}

                        <div className="flex flex-wrap items-baseline justify-between gap-1 mb-0.5 pr-6">
                          <div className="font-bold text-xs text-slate-900 flex-1 min-w-[200px]">
                            <CvInlineField
                              value={exp.title}
                              onChange={(v) => handleUpdateExperience(idx, 'title', v)}
                              placeholder="Chức danh / Vị trí làm việc"
                              aria-label={`Chức danh kinh nghiệm ${idx + 1}`}
                              readOnly={readOnly}
                              className="font-bold text-xs text-slate-900"
                            />
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <CvInlineField
                              value={exp.startDate}
                              onChange={(v) => handleUpdateExperience(idx, 'startDate', v)}
                              placeholder="Bắt đầu"
                              aria-label={`Ngày bắt đầu ${idx + 1}`}
                              readOnly={readOnly}
                              className="w-20 text-right text-[11px] text-slate-500 font-medium"
                            />
                            <span>–</span>
                            <CvInlineField
                              value={exp.endDate || ''}
                              onChange={(v) => handleUpdateExperience(idx, 'endDate', v)}
                              placeholder="Hiện tại"
                              aria-label={`Ngày kết thúc ${idx + 1}`}
                              readOnly={readOnly}
                              className="w-20 text-[11px] text-slate-500 font-medium"
                            />
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-700 mb-1.5" style={{ color: accentColor }}>
                          <CvInlineField
                            value={exp.company}
                            onChange={(v) => handleUpdateExperience(idx, 'company', v)}
                            placeholder="Tên công ty / Doanh nghiệp"
                            aria-label={`Công ty ${idx + 1}`}
                            readOnly={readOnly}
                            className="font-semibold text-xs"
                            style={{ color: accentColor }}
                          />
                        </div>

                        <CvInlineField
                          multiline
                          rows={2}
                          value={exp.description || ''}
                          onChange={(v) => handleUpdateExperience(idx, 'description', v)}
                          placeholder="Mô tả trách nhiệm cốt lõi, công nghệ đã áp dụng, kết quả định lượng đạt được..."
                          aria-label={`Mô tả kinh nghiệm ${idx + 1}`}
                          readOnly={readOnly}
                          className={`text-xs text-slate-600 ${densityStyles.lineHeight}`}
                        />
                      </div>
                    ))
                  )}
                </div>

                {!readOnly && (content.experiences || []).length > 0 && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={handleAddExperience}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:border-blue-400 !rounded-md mt-1"
                  >
                    Thêm kinh nghiệm làm việc
                  </Button>
                )}
              </section>
            )}

            {sectionVisibility.projects && (
              <section className="cv-paper__section cv-paper__section--projects space-y-3">
                <div className="flex items-center justify-between pb-1 border-0 border-b border-solid border-slate-200">
                  <div className="flex items-center gap-2"><CodeOutlined style={{ color: accentColor }} /><h3 className="m-0 text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>Dự án nổi bật</h3></div>
                  {!readOnly && <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddProject} className="text-[11px] text-blue-600">Thêm dự án</Button>}
                </div>
                {(content.projects || []).length === 0 ? (
                  !readOnly && <button type="button" onClick={handleAddProject} className="cv-empty-section">+ Thêm dự án học tập, cá nhân hoặc đã tham gia</button>
                ) : (
                  <div className={densityStyles.itemGap}>
                    {(content.projects || []).map((project, idx) => (
                      <article key={idx} className="group relative -mx-2 rounded-md p-2 hover:bg-slate-50/80">
                        {!readOnly && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveProject(idx)} className="!absolute right-1 top-1 opacity-0 group-hover:opacity-100" aria-label={`Xóa dự án ${idx + 1}`} />}
                        <div className="grid grid-cols-[1fr_auto] gap-3 pr-7">
                          <CvInlineField value={project.name} onChange={(value) => handleUpdateProject(idx, 'name', value)} placeholder="Tên dự án" aria-label={`Tên dự án ${idx + 1}`} readOnly={readOnly} className="text-xs font-bold text-slate-900" />
                          <div className="flex items-center text-[11px] text-slate-500"><CvInlineField value={project.startDate || ''} onChange={(value) => handleUpdateProject(idx, 'startDate', value)} placeholder="Bắt đầu" aria-label={`Bắt đầu dự án ${idx + 1}`} readOnly={readOnly} className="w-16 text-right" /><span>–</span><CvInlineField value={project.endDate || ''} onChange={(value) => handleUpdateProject(idx, 'endDate', value)} placeholder="Kết thúc" aria-label={`Kết thúc dự án ${idx + 1}`} readOnly={readOnly} className="w-16" /></div>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <CvInlineField value={project.role || ''} onChange={(value) => handleUpdateProject(idx, 'role', value)} placeholder="Vai trò của bạn" aria-label={`Vai trò dự án ${idx + 1}`} readOnly={readOnly} className="text-xs font-semibold" style={{ color: accentColor }} />
                          <CvInlineField value={project.technologies || ''} onChange={(value) => handleUpdateProject(idx, 'technologies', value)} placeholder="Công nghệ / Công cụ" aria-label={`Công nghệ dự án ${idx + 1}`} readOnly={readOnly} className="text-right text-[11px] text-slate-500" />
                        </div>
                        <CvInlineField multiline rows={2} value={project.description || ''} onChange={(value) => handleUpdateProject(idx, 'description', value)} placeholder="Bạn đã làm gì và kết quả đo được là gì?" aria-label={`Mô tả dự án ${idx + 1}`} readOnly={readOnly} className={`mt-1 text-xs text-slate-600 ${densityStyles.lineHeight}`} />
                        <CvInlineField value={project.url || ''} onChange={(value) => handleUpdateProject(idx, 'url', value)} placeholder="Liên kết dự án / GitHub / sản phẩm (không bắt buộc)" aria-label={`Liên kết dự án ${idx + 1}`} readOnly={readOnly} className="mt-1 text-[11px] text-slate-500" />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── SECTION: EDUCATIONS ── */}
            {sectionVisibility.educations && (
              <section className="cv-paper__section cv-paper__section--educations space-y-3">
                <div className="flex items-center justify-between pb-1 border-0 border-b border-solid border-slate-200">
                  <div className="flex items-center gap-2">
                    <BookOutlined style={{ color: accentColor }} className="text-sm" />
                    <h3
                      className="text-xs font-bold uppercase tracking-wider m-0"
                      style={{ color: accentColor }}
                    >
                      Học vấn & Bằng cấp
                    </h3>
                  </div>
                  {!readOnly && (
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddEducation}
                      className="text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      Thêm học vấn
                    </Button>
                  )}
                </div>

                <div className={densityStyles.itemGap}>
                  {(content.educations || []).length === 0 ? (
                    <div
                      onClick={handleAddEducation}
                      className="p-4 border border-dashed border-slate-300 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 text-xs text-slate-400"
                    >
                      + Nhấp vào đây để thêm trường học hoặc bằng cấp
                    </div>
                  ) : (
                    content.educations.map((edu, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-md p-2 -mx-2 hover:bg-slate-50/80 transition-colors"
                      >
                        {!readOnly && (
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip title="Xóa học vấn này">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined className="text-xs" />}
                                onClick={() => handleRemoveEducation(idx)}
                              />
                            </Tooltip>
                          </div>
                        )}

                        <div className="flex flex-wrap items-baseline justify-between gap-1 mb-0.5 pr-6">
                          <div className="font-bold text-xs text-slate-900 flex-1 min-w-[200px]">
                            <CvInlineField
                              value={edu.school}
                              onChange={(v) => handleUpdateEducation(idx, 'school', v)}
                              placeholder="Trường Đại học / Viện đào tạo"
                              aria-label={`Trường học ${idx + 1}`}
                              readOnly={readOnly}
                              className="font-bold text-xs text-slate-900"
                            />
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <CvInlineField
                              value={edu.startDate}
                              onChange={(v) => handleUpdateEducation(idx, 'startDate', v)}
                              placeholder="Bắt đầu"
                              aria-label={`Năm bắt đầu ${idx + 1}`}
                              readOnly={readOnly}
                              className="w-16 text-right text-[11px] text-slate-500 font-medium"
                            />
                            <span>–</span>
                            <CvInlineField
                              value={edu.endDate || ''}
                              onChange={(v) => handleUpdateEducation(idx, 'endDate', v)}
                              placeholder="Tốt nghiệp"
                              aria-label={`Năm kết thúc ${idx + 1}`}
                              readOnly={readOnly}
                              className="w-16 text-[11px] text-slate-500 font-medium"
                            />
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-700 mb-1" style={{ color: accentColor }}>
                          <CvInlineField
                            value={edu.degree}
                            onChange={(v) => handleUpdateEducation(idx, 'degree', v)}
                            placeholder="Chuyên ngành / Bằng cấp (VD: Cử nhân Kỹ thuật Phần mềm)"
                            aria-label={`Bằng cấp ${idx + 1}`}
                            readOnly={readOnly}
                            className="font-semibold text-xs"
                            style={{ color: accentColor }}
                          />
                        </div>

                        <CvInlineField
                          multiline
                          rows={1}
                          value={edu.description || ''}
                          onChange={(v) => handleUpdateEducation(idx, 'description', v)}
                          placeholder="Mô tả thành tích tốt nghiệp, GPA, hoạt động học thuật..."
                          aria-label={`Mô tả học vấn ${idx + 1}`}
                          readOnly={readOnly}
                          className={`text-xs text-slate-600 ${densityStyles.lineHeight}`}
                        />
                      </div>
                    ))
                  )}
                </div>

                {!readOnly && (content.educations || []).length > 0 && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={handleAddEducation}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:border-blue-400 !rounded-md mt-1"
                  >
                    Thêm học vấn & bằng cấp
                  </Button>
                )}
              </section>
            )}

            {sectionVisibility.activities && (
              <section className="cv-paper__section cv-paper__section--activities space-y-3">
                <div className="flex items-center justify-between pb-1 border-0 border-b border-solid border-slate-200">
                  <div className="flex items-center gap-2"><TeamOutlined style={{ color: accentColor }} /><h3 className="m-0 text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>Hoạt động</h3></div>
                  {!readOnly && <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddActivity} className="text-[11px] text-blue-600">Thêm hoạt động</Button>}
                </div>
                {(content.activities || []).length === 0 ? (
                  !readOnly && <button type="button" onClick={handleAddActivity} className="cv-empty-section">+ Thêm hoạt động cộng đồng, câu lạc bộ hoặc tình nguyện</button>
                ) : (
                  <div className={densityStyles.itemGap}>
                    {(content.activities || []).map((activity, idx) => (
                      <article key={idx} className="group relative -mx-2 rounded-md p-2 hover:bg-slate-50/80">
                        {!readOnly && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveActivity(idx)} className="!absolute right-1 top-1 opacity-0 group-hover:opacity-100" aria-label={`Xóa hoạt động ${idx + 1}`} />}
                        <div className="grid grid-cols-[1fr_auto] gap-3 pr-7">
                          <CvInlineField value={activity.name} onChange={(value) => handleUpdateActivity(idx, 'name', value)} placeholder="Tên hoạt động / tổ chức" aria-label={`Tên hoạt động ${idx + 1}`} readOnly={readOnly} className="text-xs font-bold text-slate-900" />
                          <div className="flex items-center text-[11px] text-slate-500"><CvInlineField value={activity.startDate || ''} onChange={(value) => handleUpdateActivity(idx, 'startDate', value)} placeholder="Bắt đầu" aria-label={`Bắt đầu hoạt động ${idx + 1}`} readOnly={readOnly} className="w-16 text-right" /><span>–</span><CvInlineField value={activity.endDate || ''} onChange={(value) => handleUpdateActivity(idx, 'endDate', value)} placeholder="Kết thúc" aria-label={`Kết thúc hoạt động ${idx + 1}`} readOnly={readOnly} className="w-16" /></div>
                        </div>
                        <CvInlineField value={activity.role || ''} onChange={(value) => handleUpdateActivity(idx, 'role', value)} placeholder="Vai trò của bạn" aria-label={`Vai trò hoạt động ${idx + 1}`} readOnly={readOnly} className="mt-1 text-xs font-semibold" style={{ color: accentColor }} />
                        <CvInlineField multiline rows={2} value={activity.description || ''} onChange={(value) => handleUpdateActivity(idx, 'description', value)} placeholder="Mô tả đóng góp hoặc thành tích nổi bật" aria-label={`Mô tả hoạt động ${idx + 1}`} readOnly={readOnly} className={`mt-1 text-xs text-slate-600 ${densityStyles.lineHeight}`} />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── SECTION: SKILLS ── */}
            {sectionVisibility.skills && (
              <section className="cv-paper__section cv-paper__section--skills space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-0 border-b border-solid border-slate-200">
                  <StarOutlined style={{ color: accentColor }} className="text-sm" />
                  <h3
                    className="text-xs font-bold uppercase tracking-wider m-0"
                    style={{ color: accentColor }}
                  >
                    Kỹ năng chuyên môn
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  {(content.skills || []).map((skill) => (
                    <Tag
                      key={skill}
                      closable={!readOnly}
                      onClose={() => handleRemoveSkill(skill)}
                      className="text-xs px-2.5 py-1 rounded-md font-medium border-slate-200 bg-slate-50 text-slate-800"
                    >
                      {skill}
                    </Tag>
                  ))}

                  {!readOnly && (
                    <>
                      {isAddingSkill ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newSkillText}
                            onChange={(e) => setNewSkillText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddSkill(newSkillText);
                              } else if (e.key === 'Escape') {
                                setIsAddingSkill(false);
                              }
                            }}
                            onBlur={() => {
                              if (newSkillText.trim()) {
                                handleAddSkill(newSkillText);
                              } else {
                                setIsAddingSkill(false);
                              }
                            }}
                            placeholder="Tên kỹ năng..."
                            autoFocus
                            className="text-xs border border-blue-400 rounded px-2 py-0.5 outline-none w-28"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingSkill(true)}
                          className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 border border-dashed border-blue-300 rounded px-2 py-1 cursor-pointer transition-colors"
                        >
                          + Thêm kỹ năng
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Suggestions if skills are few */}
                {!readOnly && (content.skills || []).length < 5 && (
                  <div className="flex flex-wrap gap-1 items-center pt-1 text-[11px] text-slate-400">
                    <span>Gợi ý:</span>
                    {DEFAULT_SKILL_SUGGESTIONS.filter((s) => !(content.skills || []).includes(s))
                      .slice(0, 6)
                      .map((sug) => (
                        <span
                          key={sug}
                          onClick={() => handleAddSkill(sug)}
                          className="cursor-pointer text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                        >
                          + {sug}
                        </span>
                      ))}
                  </div>
                )}
              </section>
            )}

            {/* ── SECTION: LANGUAGES & CERTIFICATES ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Languages */}
              {sectionVisibility.languages && (
                <section className="cv-paper__section cv-paper__section--languages space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-0 border-b border-solid border-slate-200">
                    <TranslationOutlined style={{ color: accentColor }} className="text-sm" />
                    <h3
                      className="text-xs font-bold uppercase tracking-wider m-0"
                      style={{ color: accentColor }}
                    >
                      Ngoại ngữ
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(content.languages || []).map((lang) => (
                      <Tag
                        key={lang}
                        closable={!readOnly}
                        onClose={() => handleRemoveLanguage(lang)}
                        className="text-xs px-2.5 py-1 rounded-md font-medium border-slate-200 bg-slate-50 text-slate-800"
                      >
                        {lang}
                      </Tag>
                    ))}

                    {!readOnly && (
                      <>
                        {isAddingLang ? (
                          <input
                            type="text"
                            value={newLangText}
                            onChange={(e) => setNewLangText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddLanguage(newLangText);
                              else if (e.key === 'Escape') setIsAddingLang(false);
                            }}
                            onBlur={() => {
                              if (newLangText.trim()) handleAddLanguage(newLangText);
                              else setIsAddingLang(false);
                            }}
                            placeholder="Tiếng Anh (IELTS 7.0)..."
                            autoFocus
                            className="text-xs border border-blue-400 rounded px-2 py-0.5 outline-none w-36"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddingLang(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 border border-dashed border-blue-300 rounded px-2 py-1 cursor-pointer transition-colors"
                          >
                            + Thêm ngoại ngữ
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Certificates */}
              {sectionVisibility.certificates && (
                <section className="cv-paper__section cv-paper__section--certificates space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-0 border-b border-solid border-slate-200">
                    <TrophyOutlined style={{ color: accentColor }} className="text-sm" />
                    <h3
                      className="text-xs font-bold uppercase tracking-wider m-0"
                      style={{ color: accentColor }}
                    >
                      Chứng chỉ & Giải thưởng
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(content.certificates || []).map((cert) => (
                      <Tag
                        key={cert}
                        closable={!readOnly}
                        onClose={() => handleRemoveCertificate(cert)}
                        className="text-xs px-2.5 py-1 rounded-md font-medium border-slate-200 bg-slate-50 text-slate-800"
                      >
                        {cert}
                      </Tag>
                    ))}

                    {!readOnly && (
                      <>
                        {isAddingCert ? (
                          <input
                            type="text"
                            value={newCertText}
                            onChange={(e) => setNewCertText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCertificate(newCertText);
                              else if (e.key === 'Escape') setIsAddingCert(false);
                            }}
                            onBlur={() => {
                              if (newCertText.trim()) handleAddCertificate(newCertText);
                              else setIsAddingCert(false);
                            }}
                            placeholder="AWS Certified..."
                            autoFocus
                            className="text-xs border border-blue-400 rounded px-2 py-0.5 outline-none w-36"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddingCert(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 border border-dashed border-blue-300 rounded px-2 py-1 cursor-pointer transition-colors"
                          >
                            + Thêm chứng chỉ
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CvCanvas;
