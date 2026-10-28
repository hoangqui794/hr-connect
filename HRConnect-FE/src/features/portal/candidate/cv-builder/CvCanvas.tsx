import React, { useState, useRef } from 'react';
import { Button, Tooltip, Tag } from 'antd';
import {
  PlusOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  CalendarOutlined,
  UserOutlined,
  GlobalOutlined,
  CameraOutlined,
  ApartmentOutlined,
  BookOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  ProjectOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  HeartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { CvInlineField } from './CvInlineField';
import { CvItemControls } from './CvItemControls';
import type {
  StructuredCvContent,
  StructuredCvExperience,
  StructuredCvEducation,
  StructuredCvProject,
  StructuredCvActivity,
  StructuredCvAward,
  StructuredCvReference,
} from '@/types/api/cvBuilder';
import type { SectionVisibility } from './CvSidebarTools';

export interface CvCanvasProps {
  content: StructuredCvContent;
  onChangeContent: (updated: Partial<StructuredCvContent>) => void;
  accentColor: string;
  fontFamily: string;
  fontSizeScale: 'small' | 'normal' | 'large';
  density: 'compact' | 'normal' | 'spacious';
  selectedTemplateCode: 'STANDARD' | 'MODERN_TWO_COL';
  sectionVisibility: SectionVisibility;
  readOnly?: boolean;
}

export const CvCanvas: React.FC<CvCanvasProps> = ({
  content,
  onChangeContent,
  accentColor,
  fontFamily,
  fontSizeScale,
  density,
  selectedTemplateCode,
  sectionVisibility,
  readOnly = false,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Density configs
  const densityStyles = {
    compact: {
      sectionGap: 'gap-3.5',
      itemGap: 'space-y-2',
      lineHeight: 'leading-snug',
      padding: 'p-7 sm:p-9',
    },
    normal: {
      sectionGap: 'gap-5',
      itemGap: 'space-y-3.5',
      lineHeight: 'leading-normal',
      padding: 'p-8 sm:p-10',
    },
    spacious: {
      sectionGap: 'gap-6',
      itemGap: 'space-y-4.5',
      lineHeight: 'leading-relaxed',
      padding: 'p-10 sm:p-12',
    },
  }[density];

  // Font size scales
  const fontScaleStyles = {
    small: {
      name: 'text-2xl',
      headline: 'text-xs font-semibold',
      sectionTitle: 'text-xs font-bold',
      itemTitle: 'text-xs font-bold',
      body: 'text-[11px]',
      meta: 'text-[10px]',
    },
    normal: {
      name: 'text-3xl',
      headline: 'text-sm font-semibold',
      sectionTitle: 'text-sm font-bold',
      itemTitle: 'text-xs font-bold',
      body: 'text-xs',
      meta: 'text-[11px]',
    },
    large: {
      name: 'text-4xl',
      headline: 'text-base font-semibold',
      sectionTitle: 'text-base font-bold',
      itemTitle: 'text-sm font-bold',
      body: 'text-sm',
      meta: 'text-xs',
    },
  }[fontSizeScale];

  // Avatar upload handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onChangeContent({ avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to reorder array items
  const moveItem = <T,>(list: T[], index: number, direction: 'up' | 'down'): T[] => {
    const nextList = [...list];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return list;
    const temp = nextList[index];
    nextList[index] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    return nextList;
  };

  // ── Experiences Handlers ──
  const handleAddExperience = () => {
    const nextExp: StructuredCvExperience = {
      title: 'Chức danh vị trí',
      company: 'Tên công ty / Tổ chức',
      startDate: '2023',
      endDate: 'Hiện tại',
      description: 'Mô tả trách nhiệm cốt lõi, thành tích đạt được và số liệu chứng minh...',
    };
    onChangeContent({ experiences: [...(content.experiences || []), nextExp] });
  };

  const handleUpdateExperience = (idx: number, field: keyof StructuredCvExperience, val: string) => {
    const list = [...(content.experiences || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ experiences: list });
  };

  const handleRemoveExperience = (idx: number) => {
    onChangeContent({ experiences: (content.experiences || []).filter((_, i) => i !== idx) });
  };

  // ── Educations Handlers ──
  const handleAddEducation = () => {
    const nextEdu: StructuredCvEducation = {
      school: 'Tên trường Đại học / Học viện',
      degree: 'Chuyên ngành đào tạo',
      startDate: '2020',
      endDate: '2024',
      description: 'Xếp loại: Giỏi (GPA 3.6/4.0), Thành tích nổi bật hoặc học bổng...',
    };
    onChangeContent({ educations: [...(content.educations || []), nextEdu] });
  };

  const handleUpdateEducation = (idx: number, field: keyof StructuredCvEducation, val: string) => {
    const list = [...(content.educations || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ educations: list });
  };

  const handleRemoveEducation = (idx: number) => {
    onChangeContent({ educations: (content.educations || []).filter((_, i) => i !== idx) });
  };

  // ── Projects Handlers ──
  const handleAddProject = () => {
    const nextProj: StructuredCvProject = {
      id: `proj-${Date.now()}`,
      name: 'Tên dự án tiêu biểu',
      role: 'Trưởng nhóm / Thành viên phát triển',
      startDate: '2023',
      endDate: '2024',
      description: 'Mô tả mục tiêu dự án, công nghệ ứng dụng, quy mô người dùng và kết quả đạt được...',
    };
    onChangeContent({ projects: [...(content.projects || []), nextProj] });
  };

  const handleUpdateProject = (idx: number, field: keyof StructuredCvProject, val: string) => {
    const list = [...(content.projects || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ projects: list });
  };

  const handleRemoveProject = (idx: number) => {
    onChangeContent({ projects: (content.projects || []).filter((_, i) => i !== idx) });
  };

  // ── Activities Handlers ──
  const handleAddActivity = () => {
    const nextAct: StructuredCvActivity = {
      id: `act-${Date.now()}`,
      organization: 'Tên CLB / Tổ chức xã hội',
      role: 'Thành viên ban tổ chức / Tình nguyện viên',
      startDate: '2022',
      endDate: '2023',
      description: 'Tổ chức sự kiện, điều phối thành viên và đóng góp cho cộng đồng...',
    };
    onChangeContent({ activities: [...(content.activities || []), nextAct] });
  };

  const handleUpdateActivity = (idx: number, field: keyof StructuredCvActivity, val: string) => {
    const list = [...(content.activities || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ activities: list });
  };

  const handleRemoveActivity = (idx: number) => {
    onChangeContent({ activities: (content.activities || []).filter((_, i) => i !== idx) });
  };

  // ── Awards Handlers ──
  const handleAddAward = () => {
    const nextAward: StructuredCvAward = {
      id: `award-${Date.now()}`,
      title: 'Tên giải thưởng / Danh hiệu đạt được',
      year: '2023',
      issuer: 'Đơn vị trao giải / Cuộc thi',
    };
    onChangeContent({ awards: [...(content.awards || []), nextAward] });
  };

  const handleUpdateAward = (idx: number, field: keyof StructuredCvAward, val: string) => {
    const list = [...(content.awards || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ awards: list });
  };

  const handleRemoveAward = (idx: number) => {
    onChangeContent({ awards: (content.awards || []).filter((_, i) => i !== idx) });
  };

  // ── References Handlers ──
  const handleAddReference = () => {
    const nextRef: StructuredCvReference = {
      id: `ref-${Date.now()}`,
      name: 'Họ tên người giới thiệu',
      title: 'Chức vụ / Vị trí',
      company: 'Tên công ty / Cơ quan',
      phone: '0912 345 678',
      email: 'ref@example.com',
    };
    onChangeContent({ references: [...(content.references || []), nextRef] });
  };

  const handleUpdateReference = (idx: number, field: keyof StructuredCvReference, val: string) => {
    const list = [...(content.references || [])];
    list[idx] = { ...list[idx], [field]: val };
    onChangeContent({ references: list });
  };

  const handleRemoveReference = (idx: number) => {
    onChangeContent({ references: (content.references || []).filter((_, i) => i !== idx) });
  };

  // ── Skills Handlers ──
  const skillsList = content.skills && content.skills.length > 0
    ? content.skills
    : ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'REST API', 'Git', 'Làm việc nhóm'];

  const handleAddSkillTag = () => {
    const newSkill = prompt('Nhập tên kỹ năng mới:');
    if (newSkill && newSkill.trim()) {
      onChangeContent({ skills: [...skillsList, newSkill.trim()] });
    }
  };

  const handleRemoveSkillTag = (idx: number) => {
    onChangeContent({ skills: skillsList.filter((_, i) => i !== idx) });
  };

  // ── Certificates Handlers ──
  const certsList = content.certificates || [];
  const handleAddCert = () => {
    const cert = prompt('Nhập tên chứng chỉ mới:');
    if (cert && cert.trim()) {
      onChangeContent({ certificates: [...certsList, cert.trim()] });
    }
  };
  const handleRemoveCert = (idx: number) => {
    onChangeContent({ certificates: certsList.filter((_, i) => i !== idx) });
  };

  // ── Interests Handlers ──
  const interestsList = content.interests && content.interests.length > 0
    ? content.interests
    : ['Đọc sách công nghệ', 'Chạy bộ', 'Nhiếp ảnh'];
  const handleAddInterest = () => {
    const item = prompt('Nhập sở thích mới:');
    if (item && item.trim()) {
      onChangeContent({ interests: [...interestsList, item.trim()] });
    }
  };
  const handleRemoveInterest = (idx: number) => {
    onChangeContent({ interests: interestsList.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex-1 h-full bg-slate-100/90 overflow-y-auto flex flex-col items-center relative cv-builder-scroll">
      {/* Zoom Control Bar (Fixed Bottom-Right Floating) */}
      <div className="fixed bottom-6 right-8 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-full px-3 py-1 flex items-center gap-1.5 select-none no-print">
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
        <span className="text-xs font-semibold text-slate-700 min-w-[36px] text-center">
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
        <Tooltip title="Khổ 100%">
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

      {/* Hidden File Input for Avatar */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Canvas Paper Wrapper with Scale */}
      <div className="flex-1 flex justify-center items-start pb-20 px-4 w-full">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="shrink-0"
        >
          {/* =================================================================== */}
          {/* A4 PAPER CANVAS (Chuẩn kích thước 794px ~ 210mm x 1123px ~ 297mm) */}
          {/* =================================================================== */}
          <div
            id="cv-paper-canvas"
            style={{
              width: '794px',
              minHeight: '1123px',
              fontFamily: fontFamily,
            }}
            className={`bg-white text-slate-800 shadow-xl rounded-sm ${densityStyles.padding} flex flex-col ${densityStyles.sectionGap} border border-slate-200/60 relative print:shadow-none print:m-0 print:p-0 print:border-none`}
          >
            {/* =============================================================== */}
            {/* 1. MẪU 1: TIÊU CHUẨN (1 CỘT TUẦN TỰ THANH LỊCH - HÌNH 1 & 2)    */}
            {/* =============================================================== */}
            {selectedTemplateCode === 'STANDARD' && (
              <>
                {/* ── HEADER CHUẨN TOPCV: AVATAR TRÒN + TÊN + LIÊN HỆ ── */}
                <header className="flex items-center gap-6 pb-4 border-b border-slate-200/90">
                  {/* Avatar Profile */}
                  <div
                    onClick={() => !readOnly && avatarInputRef.current?.click()}
                    className={`relative w-28 h-28 rounded-full overflow-hidden border-2 p-1 bg-slate-50 shrink-0 shadow-sm flex items-center justify-center ${
                      readOnly ? '' : 'cursor-pointer group/avatar'
                    }`}
                    style={{ borderColor: accentColor }}
                    title={readOnly ? '' : 'Nhấp để đổi ảnh đại diện'}
                  >
                    {content.avatarUrl ? (
                      <img
                        src={content.avatarUrl}
                        alt="Ảnh đại diện CV"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                        <UserOutlined className="text-3xl" />
                        <span className="text-[9px] mt-1">Ảnh CV</span>
                      </div>
                    )}
                    {!readOnly && (
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white text-[10px] transition-opacity">
                        <CameraOutlined className="text-lg mb-0.5" />
                        <span>Đổi ảnh</span>
                      </div>
                    )}
                  </div>

                  {/* Tên & Thông tin liên hệ */}
                  <div className="flex-1 min-w-0">
                    <CvInlineField
                      value={content.fullName || ''}
                      onChange={(v) => onChangeContent({ fullName: v })}
                      placeholder="HỌ VÀ TÊN CỦA BẠN"
                      readOnly={readOnly}
                      className={`${fontScaleStyles.name} font-extrabold uppercase tracking-tight text-slate-900 m-0`}
                      style={{ color: accentColor }}
                    />

                    <CvInlineField
                      value={content.headline || ''}
                      onChange={(v) => onChangeContent({ headline: v })}
                      placeholder="Vị trí ứng tuyển (VD: Chuyên viên Phát triển Phần mềm)"
                      readOnly={readOnly}
                      className={`${fontScaleStyles.headline} font-semibold text-slate-600 mt-0.5 mb-2`}
                    />

                    {/* Dải liên hệ với icon nhỏ gọn */}
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <CalendarOutlined className="text-slate-400 shrink-0" />
                        <CvInlineField
                          value={content.dob || ''}
                          onChange={(v) => onChangeContent({ dob: v })}
                          placeholder="Ngày sinh (VD: 01/01/2000)"
                          readOnly={readOnly}
                          className={fontScaleStyles.body}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PhoneOutlined className="text-slate-400 shrink-0" />
                        <CvInlineField
                          value={content.phone || ''}
                          onChange={(v) => onChangeContent({ phone: v })}
                          placeholder="Số điện thoại"
                          readOnly={readOnly}
                          className={fontScaleStyles.body}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MailOutlined className="text-slate-400 shrink-0" />
                        <CvInlineField
                          value={content.email || ''}
                          onChange={(v) => onChangeContent({ email: v })}
                          placeholder="Địa chỉ Email"
                          readOnly={readOnly}
                          className={fontScaleStyles.body}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HomeOutlined className="text-slate-400 shrink-0" />
                        <CvInlineField
                          value={content.address || ''}
                          onChange={(v) => onChangeContent({ address: v })}
                          placeholder="Địa chỉ / Thành phố"
                          readOnly={readOnly}
                          className={fontScaleStyles.body}
                        />
                      </div>
                    </div>
                  </div>
                </header>

                {/* ── MỤC TIÊU NGHỀ NGHIỆP ── */}
                {sectionVisibility.summary && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Mục tiêu nghề nghiệp
                      </h3>
                    </div>
                    <CvInlineField
                      multiline
                      rows={2}
                      value={content.summary || ''}
                      onChange={(v) => onChangeContent({ summary: v })}
                      placeholder="Mô tả mục tiêu ngắn hạn và dài hạn của bạn..."
                      readOnly={readOnly}
                      className={`${fontScaleStyles.body} text-slate-700 ${densityStyles.lineHeight}`}
                    />
                  </section>
                )}

                {/* ── HỌC VẤN ── */}
                {sectionVisibility.educations && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Học vấn
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddEducation}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm học vấn
                        </button>
                      )}
                    </div>
                    <div className={densityStyles.itemGap}>
                      {(content.educations || []).map((edu, idx) => (
                        <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70">
                          {!readOnly && (
                            <CvItemControls
                              onMoveUp={() => onChangeContent({ educations: moveItem(content.educations, idx, 'up') })}
                              onMoveDown={() => onChangeContent({ educations: moveItem(content.educations, idx, 'down') })}
                              onDelete={() => handleRemoveEducation(idx)}
                              canMoveUp={idx > 0}
                              canMoveDown={idx < (content.educations?.length || 1) - 1}
                            />
                          )}
                          <div className="grid grid-cols-12 gap-3 items-baseline">
                            {/* Cột thời gian bên trái */}
                            <div className="col-span-3 text-[11px] font-semibold text-slate-500">
                              <CvInlineField
                                value={`${edu.startDate} - ${edu.endDate || 'Hiện tại'}`}
                                onChange={(v) => {
                                  const parts = v.split('-');
                                  handleUpdateEducation(idx, 'startDate', parts[0]?.trim() || '');
                                  if (parts[1]) handleUpdateEducation(idx, 'endDate', parts[1]?.trim() || '');
                                }}
                                placeholder="2020 - 2024"
                                readOnly={readOnly}
                                className="text-[11px] text-slate-500 font-semibold"
                              />
                            </div>
                            {/* Cột nội dung bên phải */}
                            <div className="col-span-9 space-y-0.5">
                              <CvInlineField
                                value={edu.school}
                                onChange={(v) => handleUpdateEducation(idx, 'school', v)}
                                placeholder="Tên trường Đại học / Học viện"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.itemTitle} text-slate-900 font-bold`}
                              />
                              <CvInlineField
                                value={edu.degree}
                                onChange={(v) => handleUpdateEducation(idx, 'degree', v)}
                                placeholder="Chuyên ngành đào tạo"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} font-medium text-slate-700`}
                              />
                              <CvInlineField
                                multiline
                                rows={1}
                                value={edu.description || ''}
                                onChange={(v) => handleUpdateEducation(idx, 'description', v)}
                                placeholder="Xếp loại tốt nghiệp, GPA, thành tích..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── KINH NGHIỆM LÀM VIỆC ── */}
                {sectionVisibility.experiences && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Kinh nghiệm làm việc
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddExperience}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm kinh nghiệm
                        </button>
                      )}
                    </div>
                    <div className={densityStyles.itemGap}>
                      {(content.experiences || []).map((exp, idx) => (
                        <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70">
                          {!readOnly && (
                            <CvItemControls
                              onMoveUp={() => onChangeContent({ experiences: moveItem(content.experiences, idx, 'up') })}
                              onMoveDown={() => onChangeContent({ experiences: moveItem(content.experiences, idx, 'down') })}
                              onDelete={() => handleRemoveExperience(idx)}
                              canMoveUp={idx > 0}
                              canMoveDown={idx < (content.experiences?.length || 1) - 1}
                            />
                          )}
                          <div className="grid grid-cols-12 gap-3 items-baseline">
                            <div className="col-span-3 text-[11px] font-semibold text-slate-500">
                              <CvInlineField
                                value={`${exp.startDate} - ${exp.endDate || 'Hiện tại'}`}
                                onChange={(v) => {
                                  const parts = v.split('-');
                                  handleUpdateExperience(idx, 'startDate', parts[0]?.trim() || '');
                                  if (parts[1]) handleUpdateExperience(idx, 'endDate', parts[1]?.trim() || '');
                                }}
                                placeholder="2022 - Nay"
                                readOnly={readOnly}
                                className="text-[11px] text-slate-500 font-semibold"
                              />
                            </div>
                            <div className="col-span-9 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <CvInlineField
                                  value={exp.company}
                                  onChange={(v) => handleUpdateExperience(idx, 'company', v)}
                                  placeholder="Tên công ty / Doanh nghiệp"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.itemTitle} font-bold text-slate-900`}
                                />
                                <span className="text-slate-300">|</span>
                                <CvInlineField
                                  value={exp.title}
                                  onChange={(v) => handleUpdateExperience(idx, 'title', v)}
                                  placeholder="Chức danh vị trí"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.body} font-semibold text-slate-700`}
                                />
                              </div>
                              <CvInlineField
                                multiline
                                rows={2}
                                value={exp.description || ''}
                                onChange={(v) => handleUpdateExperience(idx, 'description', v)}
                                placeholder="Mô tả công việc, trách nhiệm chính và kết quả đạt được..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── KỸ NĂNG ── */}
                {sectionVisibility.skills && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Kỹ năng
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddSkillTag}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm kỹ năng
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-medium group/tag"
                        >
                          <span>{skill}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSkillTag(idx)}
                              className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 text-[10px] opacity-0 group-hover/tag:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── DỰ ÁN TIÊU BIỂU (OPTIONAL) ── */}
                {sectionVisibility.projects && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Dự án tiêu biểu
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddProject}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm dự án
                        </button>
                      )}
                    </div>
                    <div className={densityStyles.itemGap}>
                      {(content.projects || []).map((proj, idx) => (
                        <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70">
                          {!readOnly && (
                            <CvItemControls
                              onMoveUp={() => onChangeContent({ projects: moveItem(content.projects || [], idx, 'up') })}
                              onMoveDown={() => onChangeContent({ projects: moveItem(content.projects || [], idx, 'down') })}
                              onDelete={() => handleRemoveProject(idx)}
                              canMoveUp={idx > 0}
                              canMoveDown={idx < (content.projects?.length || 1) - 1}
                            />
                          )}
                          <div className="grid grid-cols-12 gap-3 items-baseline">
                            <div className="col-span-3 text-[11px] font-semibold text-slate-500">
                              <CvInlineField
                                value={`${proj.startDate || ''} - ${proj.endDate || 'Hiện tại'}`}
                                onChange={(v) => {
                                  const parts = v.split('-');
                                  handleUpdateProject(idx, 'startDate', parts[0]?.trim() || '');
                                  if (parts[1]) handleUpdateProject(idx, 'endDate', parts[1]?.trim() || '');
                                }}
                                placeholder="2023 - 2024"
                                readOnly={readOnly}
                                className="text-[11px] text-slate-500 font-semibold"
                              />
                            </div>
                            <div className="col-span-9 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <CvInlineField
                                  value={proj.name}
                                  onChange={(v) => handleUpdateProject(idx, 'name', v)}
                                  placeholder="Tên dự án"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.itemTitle} font-bold text-slate-900`}
                                />
                                <span className="text-slate-300">|</span>
                                <CvInlineField
                                  value={proj.role || ''}
                                  onChange={(v) => handleUpdateProject(idx, 'role', v)}
                                  placeholder="Vai trò của bạn"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.body} font-semibold text-slate-700`}
                                />
                              </div>
                              <CvInlineField
                                multiline
                                rows={2}
                                value={proj.description || ''}
                                onChange={(v) => handleUpdateProject(idx, 'description', v)}
                                placeholder="Mục tiêu dự án, công nghệ ứng dụng, quy mô và kết quả..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── CHỨNG CHỈ (OPTIONAL) ── */}
                {sectionVisibility.certificates && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Chứng chỉ
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddCert}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm chứng chỉ
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {certsList.map((cert, idx) => {
                        const certText = typeof cert === 'string' ? cert : (cert as any)?.name ? `${(cert as any).name}${(cert as any).year ? ` (${(cert as any).year})` : ''}` : String(cert);
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-700 group/cert">
                            <span>• {certText}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCert(idx)}
                              className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover/cert:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </section>
                )}

                {/* ── DANH HIỆU VÀ GIẢI THƯỞNG (OPTIONAL) ── */}
                {sectionVisibility.awards && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Danh hiệu và giải thưởng
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddAward}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm giải thưởng
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {(content.awards || []).map((award, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-3 text-xs items-baseline group relative">
                          {!readOnly && (
                            <CvItemControls
                              onDelete={() => handleRemoveAward(idx)}
                            />
                          )}
                          <div className="col-span-3 text-[11px] font-semibold text-slate-500">
                            <CvInlineField
                              value={award.year || ''}
                              onChange={(v) => handleUpdateAward(idx, 'year', v)}
                              placeholder="2023"
                              readOnly={readOnly}
                              className="text-[11px] text-slate-500"
                            />
                          </div>
                          <div className="col-span-9">
                            <CvInlineField
                              value={award.title}
                              onChange={(v) => handleUpdateAward(idx, 'title', v)}
                              placeholder="Tên giải thưởng / Đơn vị trao giải"
                              readOnly={readOnly}
                              className={`${fontScaleStyles.body} font-medium text-slate-800`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── SỞ THÍCH (OPTIONAL) ── */}
                {sectionVisibility.interests && (
                  <section className="space-y-2">
                    <div className="bg-slate-100/80 rounded px-3 py-1 flex items-center justify-between">
                      <h3 className={`${fontScaleStyles.sectionTitle} uppercase tracking-wider text-slate-800 m-0`}>
                        Sở thích
                      </h3>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddInterest}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                        >
                          + Thêm sở thích
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-700 pt-1">
                      {interestsList.map((item, idx) => {
                        const itemText = typeof item === 'string' ? item : (item as any)?.name || String(item);
                        return (
                          <span key={idx} className="flex items-center gap-1 group/interest">
                            <span>• {itemText}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInterest(idx)}
                              className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover/interest:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      );
                    })}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* =============================================================== */}
            {/* 2. MẪU 2: HAI CỘT HIỆN ĐẠI (THANH LỊCH - HÌNH 3 & 4 CỦA USER)   */}
            {/* =============================================================== */}
            {selectedTemplateCode === 'MODERN_TWO_COL' && (
              <>
                {/* ── HEADER 2 CỘT: AVATAR VUÔNG BO GÓC + TÊN + TÓM TẮT ── */}
                <header className="flex items-start gap-6 pb-4 border-b-2 border-solid" style={{ borderColor: accentColor }}>
                  <div
                    onClick={() => !readOnly && avatarInputRef.current?.click()}
                    className={`relative w-28 h-32 rounded-xl overflow-hidden border-2 p-1 bg-slate-50 shrink-0 shadow-sm flex items-center justify-center ${
                      readOnly ? '' : 'cursor-pointer group/avatar'
                    }`}
                    style={{ borderColor: accentColor }}
                    title={readOnly ? '' : 'Nhấp để đổi ảnh đại diện'}
                  >
                    {content.avatarUrl ? (
                      <img
                        src={content.avatarUrl}
                        alt="Ảnh đại diện CV"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                        <UserOutlined className="text-3xl" />
                        <span className="text-[9px] mt-1">Ảnh CV</span>
                      </div>
                    )}
                    {!readOnly && (
                      <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white text-[10px] transition-opacity">
                        <CameraOutlined className="text-lg mb-0.5" />
                        <span>Đổi ảnh</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <CvInlineField
                      value={content.fullName || ''}
                      onChange={(v) => onChangeContent({ fullName: v })}
                      placeholder="HỌ VÀ TÊN"
                      readOnly={readOnly}
                      className={`${fontScaleStyles.name} font-extrabold text-slate-900 m-0 tracking-tight`}
                      style={{ color: accentColor }}
                    />

                    <CvInlineField
                      value={content.headline || ''}
                      onChange={(v) => onChangeContent({ headline: v })}
                      placeholder="Vị trí ứng tuyển (VD: Quản lý nhà hàng / Software Engineer)"
                      readOnly={readOnly}
                      className={`${fontScaleStyles.headline} font-bold text-slate-700 mt-1 mb-2`}
                    />

                    <CvInlineField
                      multiline
                      rows={2}
                      value={content.summary || ''}
                      onChange={(v) => onChangeContent({ summary: v })}
                      placeholder="Tóm tắt năng lực cốt lõi, kinh nghiệm nổi bật và định hướng nghề nghiệp..."
                      readOnly={readOnly}
                      className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                    />
                  </div>
                </header>

                {/* ── HAI CỘT NỘI DUNG CHÍNH (CỘT TRÁI 35% & CỘT PHẢI 65%) ── */}
                <div className="grid grid-cols-12 gap-6 items-start">
                  {/* CỘT TRÁI (35%): THÔNG TIN CÁ NHÂN, KỸ NĂNG, CHỨNG CHỈ, SỞ THÍCH */}
                  <div className="col-span-4 space-y-5 border-r border-slate-200/80 pr-4">
                    {/* Thông tin cá nhân */}
                    <div className="space-y-2">
                      <div className="border-b-2 border-solid pb-1" style={{ borderColor: accentColor }}>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                          Thông tin cá nhân
                        </h4>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarOutlined style={{ color: accentColor }} className="shrink-0 text-xs" />
                          <CvInlineField
                            value={content.dob || ''}
                            onChange={(v) => onChangeContent({ dob: v })}
                            placeholder="Ngày sinh"
                            readOnly={readOnly}
                            className={fontScaleStyles.body}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MailOutlined style={{ color: accentColor }} className="shrink-0 text-xs" />
                          <CvInlineField
                            value={content.email || ''}
                            onChange={(v) => onChangeContent({ email: v })}
                            placeholder="Email"
                            readOnly={readOnly}
                            className={fontScaleStyles.body}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PhoneOutlined style={{ color: accentColor }} className="shrink-0 text-xs" />
                          <CvInlineField
                            value={content.phone || ''}
                            onChange={(v) => onChangeContent({ phone: v })}
                            placeholder="Số điện thoại"
                            readOnly={readOnly}
                            className={fontScaleStyles.body}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HomeOutlined style={{ color: accentColor }} className="shrink-0 text-xs" />
                          <CvInlineField
                            value={content.address || ''}
                            onChange={(v) => onChangeContent({ address: v })}
                            placeholder="Địa chỉ"
                            readOnly={readOnly}
                            className={fontScaleStyles.body}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Kỹ năng */}
                    {sectionVisibility.skills && (
                      <div className="space-y-2">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Kỹ năng
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddSkillTag}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {skillsList.map((skill, idx) => (
                            <div key={idx} className="group/skill flex items-center justify-between text-xs text-slate-700">
                              <span className="font-medium">• {skill}</span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSkillTag(idx)}
                                  className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover/skill:opacity-100 text-[10px]"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chứng chỉ */}
                    {sectionVisibility.certificates && (
                      <div className="space-y-2">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Chứng chỉ
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddCert}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {certsList.map((cert, idx) => {
                            const certText = typeof cert === 'string' ? cert : (cert as any)?.name ? `${(cert as any).name}${(cert as any).year ? ` (${(cert as any).year})` : ''}` : String(cert);
                            return (
                              <div key={idx} className="group/cert flex items-center justify-between text-xs text-slate-700">
                                <span>• {certText}</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCert(idx)}
                                    className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover/cert:opacity-100 text-[10px]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sở thích */}
                    {sectionVisibility.interests && (
                      <div className="space-y-2">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Sở thích
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddInterest}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm
                            </button>
                          )}
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                          {interestsList.map((item, idx) => {
                            const itemText = typeof item === 'string' ? item : (item as any)?.name || String(item);
                            return (
                              <div key={idx} className="flex items-center justify-between group/int">
                                <span>• {itemText}</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveInterest(idx)}
                                    className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover/int:opacity-100 text-[10px]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CỘT PHẢI (65%): HỌC VẤN, KINH NGHIỆM TIMELINE, DỰ ÁN, GIẢI THƯỞNG */}
                  <div className="col-span-8 space-y-5">
                    {/* Học vấn */}
                    {sectionVisibility.educations && (
                      <div className="space-y-2.5">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Học vấn
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddEducation}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm học vấn
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {(content.educations || []).map((edu, idx) => (
                            <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70">
                              {!readOnly && (
                                <CvItemControls
                                  onMoveUp={() => onChangeContent({ educations: moveItem(content.educations, idx, 'up') })}
                                  onMoveDown={() => onChangeContent({ educations: moveItem(content.educations, idx, 'down') })}
                                  onDelete={() => handleRemoveEducation(idx)}
                                  canMoveUp={idx > 0}
                                  canMoveDown={idx < (content.educations?.length || 1) - 1}
                                />
                              )}
                              <div className="flex items-baseline justify-between">
                                <CvInlineField
                                  value={edu.school}
                                  onChange={(v) => handleUpdateEducation(idx, 'school', v)}
                                  placeholder="Tên trường học"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.itemTitle} font-bold text-slate-900`}
                                />
                                <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                                  {edu.startDate} – {edu.endDate || 'Hiện tại'}
                                </span>
                              </div>
                              <CvInlineField
                                value={edu.degree}
                                onChange={(v) => handleUpdateEducation(idx, 'degree', v)}
                                placeholder="Ngành học / Bằng cấp"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} font-medium text-slate-700`}
                              />
                              <CvInlineField
                                multiline
                                rows={1}
                                value={edu.description || ''}
                                onChange={(v) => handleUpdateEducation(idx, 'description', v)}
                                placeholder="Xếp loại, GPA..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kinh nghiệm làm việc (TIMELINE TRỤC DỌC) */}
                    {sectionVisibility.experiences && (
                      <div className="space-y-2.5">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Kinh nghiệm làm việc
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddExperience}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm kinh nghiệm
                            </button>
                          )}
                        </div>
                        {/* Timeline List */}
                        <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                          {(content.experiences || []).map((exp, idx) => (
                            <div key={idx} className="relative group p-1 rounded hover:bg-slate-50/70">
                              {/* Timeline dot */}
                              <span
                                className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs"
                                style={{ backgroundColor: accentColor }}
                              />
                              {!readOnly && (
                                <CvItemControls
                                  onMoveUp={() => onChangeContent({ experiences: moveItem(content.experiences, idx, 'up') })}
                                  onMoveDown={() => onChangeContent({ experiences: moveItem(content.experiences, idx, 'down') })}
                                  onDelete={() => handleRemoveExperience(idx)}
                                  canMoveUp={idx > 0}
                                  canMoveDown={idx < (content.experiences?.length || 1) - 1}
                                />
                              )}
                              <div className="flex items-baseline justify-between">
                                <CvInlineField
                                  value={exp.title}
                                  onChange={(v) => handleUpdateExperience(idx, 'title', v)}
                                  placeholder="Chức danh"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.itemTitle} font-bold text-slate-900`}
                                />
                                <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                                  {exp.startDate} – {exp.endDate || 'Hiện tại'}
                                </span>
                              </div>
                              <CvInlineField
                                value={exp.company}
                                onChange={(v) => handleUpdateExperience(idx, 'company', v)}
                                placeholder="Tên công ty"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} font-semibold`}
                                style={{ color: accentColor }}
                              />
                              <CvInlineField
                                multiline
                                rows={2}
                                value={exp.description || ''}
                                onChange={(v) => handleUpdateExperience(idx, 'description', v)}
                                placeholder="Chi tiết trách nhiệm và thành tích..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dự án tiêu biểu */}
                    {sectionVisibility.projects && (
                      <div className="space-y-2.5">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Dự án tiêu biểu
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddProject}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm dự án
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {(content.projects || []).map((proj, idx) => (
                            <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70">
                              {!readOnly && (
                                <CvItemControls
                                  onMoveUp={() => onChangeContent({ projects: moveItem(content.projects || [], idx, 'up') })}
                                  onMoveDown={() => onChangeContent({ projects: moveItem(content.projects || [], idx, 'down') })}
                                  onDelete={() => handleRemoveProject(idx)}
                                  canMoveUp={idx > 0}
                                  canMoveDown={idx < (content.projects?.length || 1) - 1}
                                />
                              )}
                              <div className="flex items-baseline justify-between">
                                <CvInlineField
                                  value={proj.name}
                                  onChange={(v) => handleUpdateProject(idx, 'name', v)}
                                  placeholder="Tên dự án"
                                  readOnly={readOnly}
                                  className={`${fontScaleStyles.itemTitle} font-bold text-slate-900`}
                                />
                                <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                                  {proj.startDate} – {proj.endDate || 'Hiện tại'}
                                </span>
                              </div>
                              <CvInlineField
                                value={proj.role || ''}
                                onChange={(v) => handleUpdateProject(idx, 'role', v)}
                                placeholder="Vai trò"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} font-semibold`}
                                style={{ color: accentColor }}
                              />
                              <CvInlineField
                                multiline
                                rows={2}
                                value={proj.description || ''}
                                onChange={(v) => handleUpdateProject(idx, 'description', v)}
                                placeholder="Mô tả dự án..."
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} text-slate-600 ${densityStyles.lineHeight}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danh hiệu & Giải thưởng */}
                    {sectionVisibility.awards && (
                      <div className="space-y-2.5">
                        <div className="border-b-2 border-solid pb-1 flex items-center justify-between" style={{ borderColor: accentColor }}>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            Danh hiệu & Giải thưởng
                          </h4>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={handleAddAward}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0"
                            >
                              + Thêm giải thưởng
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {(content.awards || []).map((award, idx) => (
                            <div key={idx} className="group relative rounded p-1 hover:bg-slate-50/70 flex items-baseline justify-between">
                              {!readOnly && <CvItemControls onDelete={() => handleRemoveAward(idx)} />}
                              <CvInlineField
                                value={award.title}
                                onChange={(v) => handleUpdateAward(idx, 'title', v)}
                                placeholder="Tên giải thưởng"
                                readOnly={readOnly}
                                className={`${fontScaleStyles.body} font-medium text-slate-800`}
                              />
                              <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                                {award.year || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CvCanvas;
