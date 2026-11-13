/**
 * @file CandidateCvBuilderPage.tsx
 * @description Candidate CV Builder matching PDF Page 24 (Step 1: Chọn mẫu CV),
 * PDF Page 20 (Step 2: Điền nội dung & Trình soạn thảo CV), and PDF Page 25 (Bản xem trước A4 chuẩn).
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Modal, Spin, Result, Button, Alert } from 'antd';
import { FilePdfOutlined, CheckCircleFilled, FolderOpenOutlined } from '@ant-design/icons';
import { CvTopbar } from './CvTopbar';
import { CvSidebarTools, type SectionVisibility } from './CvSidebarTools';
import { CvCanvas } from './CvCanvas';
import { CvPreviewModal } from './CvPreviewModal';
import {
  CvTemplateGalleryView,
  BUILTIN_CV_TEMPLATES,
  type BuiltInCvTemplate,
} from './CvTemplateGalleryView';
import { STATIC_CV_TEMPLATES } from './constants/templates';
import {
  cvBuilderApi,
  validateStructuredCvContent,
} from '@/services/api/cvBuilderApi';
import type {
  CvFontFamily,
  CvLayoutStyle,
  CvPresentationConfig,
  StructuredCvContent,
  StructuredCvDetailDto,
} from '@/types/api/cvBuilder';
import { getAvatarImageUrl, useAuthStore } from '@/stores/authStore';
import { getApiErrorMessage } from '@/services/apiClient';
import { candidateCvApi } from '@/services/api/mf02/candidateCvApi';
import { mf04Api } from '@/services/api/mf04Api';
import { userApi } from '@/services/api/userApi';
import {
  cvBuilderDraftKey,
  readCvBuilderDraft,
  removeCvBuilderDraft,
  writeCvBuilderDraft,
  type CvBuilderDraft,
} from './services/cvBuilderDraftStorage';
import './cv-builder.css';

const DEFAULT_PRESENTATION: CvPresentationConfig = {
  accentColor: '#0284C7',
  density: 'normal',
  fontFamily: 'BE_VIETNAM_PRO',
  layout: 'ats',
  showAvatar: false,
  visibleSections: ['summary', 'experiences', 'educations', 'skills', 'languages'],
};

const DEFAULT_EDITOR_CONTENT: StructuredCvContent = {
  fullName: 'Trương Hoàng Quí',
  headline: 'Backend Developer (.NET)',
  email: 'truongqui858@gmail.com',
  phone: '0912 345 678',
  address: 'Thủ Đức, Hồ Chí Minh',
  summary:
    'Lập trình viên backend 3 năm kinh nghiệm với .NET và SQL Server, mong muốn đảm nhận vai trò Senior trong môi trường sản phẩm.',
  experiences: [
    {
      title: 'Backend Developer',
      company: 'Công ty ABC Tech',
      startDate: '03/2023',
      endDate: 'nay',
      description:
        '• Thiết kế REST API bằng ASP.NET Core 8, viết unit test với xUnit.\n• Tối ưu truy vấn SQL Server, giảm thời gian phản hồi trung bình 40%.',
    },
    {
      title: 'Thực tập sinh .NET',
      company: 'Công ty XYZ Software',
      startDate: '06/2022',
      endDate: '12/2022',
      description: '• Xây dựng module báo cáo bằng Entity Framework Core.',
    },
  ],
  projects: [],
  educations: [
    {
      school: 'Đại học FPT',
      degree: 'Kỹ thuật phần mềm',
      startDate: '2019',
      endDate: '2023',
      description: '',
    },
  ],
  activities: [],
  skills: ['C#', 'ASP.NET Core', 'Entity Framework', 'SQL Server', 'PostgreSQL', 'Docker', 'Git'],
  languages: ['Tiếng Anh – đọc hiểu tài liệu kỹ thuật (TOEIC 750)'],
  certificates: [],
};

const inferTemplateLayout = (code?: string): CvLayoutStyle => {
  const normalized = (code || '').toUpperCase();
  if (normalized.includes('MODERN')) return 'modern';
  if (normalized.includes('COMPACT')) return 'compact';
  if (normalized.includes('EXECUTIVE')) return 'executive';
  if (normalized.includes('ELEGANT')) return 'elegant';
  if (normalized.includes('MINIMAL')) return 'minimal';
  if (normalized.includes('CLASSIC')) return 'elegant';
  return 'ats';
};

export const CandidateCvBuilderPage: React.FC = () => {
  const { message } = App.useApp();
  const { cvId } = useParams<{ cvId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const profileAvatarUrl = getAvatarImageUrl(currentUser?.avatar);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(undefined);
  const avatarUrl = customAvatarUrl || profileAvatarUrl;

  const mode: 'create' | 'edit' = cvId ? 'edit' : 'create';
  const stepParam = searchParams.get('step');
  const viewStep: 'templates' | 'editor' =
    stepParam === 'templates'
      ? 'templates'
      : stepParam === 'editor' || mode === 'edit' || Boolean(searchParams.get('template'))
        ? 'editor'
        : 'templates';

  // ── Builder Configuration State ──
  const [title, setTitle] = useState<string>('CV Backend Developer');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    searchParams.get('template') || null
  );
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('STANDARD');
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('Tiêu chuẩn');
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_PRESENTATION.accentColor);
  const [fontFamily, setFontFamily] = useState<CvFontFamily>(DEFAULT_PRESENTATION.fontFamily);
  const [layout, setLayout] = useState<CvLayoutStyle>(DEFAULT_PRESENTATION.layout);
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [showAvatar, setShowAvatar] = useState<boolean>(DEFAULT_PRESENTATION.showAvatar);
  const [activeSection, setActiveSection] = useState<string>('experiences');
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    summary: true,
    experiences: true,
    projects: false,
    educations: true,
    activities: false,
    skills: true,
    languages: true,
    certificates: false,
  });

  // ── Structured CV Content State ──
  const [content, setContent] = useState<StructuredCvContent>(DEFAULT_EDITOR_CONTENT);

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [saveSuccessData, setSaveSuccessData] = useState<StructuredCvDetailDto | null>(null);
  const initialTemplateAppliedRef = useRef(false);
  const initializedDataRef = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<CvBuilderDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const draftKey = useMemo(
    () => cvBuilderDraftKey(currentUser?.id || 'anonymous', cvId),
    [currentUser?.id, cvId]
  );

  // 1. Fetch available templates
  const { data: remoteTemplates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['cv-templates'],
    queryFn: () => cvBuilderApi.getTemplates(),
    staleTime: 5 * 60 * 1000,
  });

  const templates = useMemo(() => {
    return remoteTemplates.length > 0 ? remoteTemplates : STATIC_CV_TEMPLATES;
  }, [remoteTemplates]);

  // 2. Fetch existing CV if in edit mode
  const {
    data: existingCv,
    isLoading: isLoadingExisting,
    isError: isErrorExisting,
    error: existingError,
  } = useQuery({
    queryKey: ['candidate-cv-structured', cvId],
    queryFn: () => cvBuilderApi.getStructuredCv(cvId!),
    enabled: mode === 'edit' && Boolean(cvId),
  });

  // 2b. Fetch candidate profile to pre-fill CV Builder in create mode (PDF Page 24: "Thông tin trong hồ sơ của bạn được điền sẵn vào mẫu")
  const { data: candidateProfile } = useQuery({
    queryKey: ['candidate-profile-prefill'],
    queryFn: () => mf04Api.getProfile(),
    enabled: mode === 'create',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const profileSyncedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create' || !candidateProfile || profileSyncedRef.current || availableDraft) return;
    profileSyncedRef.current = true;

    const profileSkills = (candidateProfile.skills ?? [])
      .map((s) => s.skillName?.trim())
      .filter((s): s is string => Boolean(s));

    setContent((prev) => ({
      ...prev,
      fullName: candidateProfile.fullName?.trim() || prev.fullName,
      headline:
        candidateProfile.targetRole?.trim() ||
        candidateProfile.currentJobTitle?.trim() ||
        prev.headline,
      email: candidateProfile.email?.trim() || prev.email,
      phone: candidateProfile.phone?.trim() || prev.phone,
      address: candidateProfile.currentAddress?.trim() || prev.address,
      summary: candidateProfile.summary?.trim() || prev.summary,
      skills: profileSkills.length > 0 ? profileSkills : prev.skills,
    }));
  }, [mode, candidateProfile, availableDraft]);

  // Initialize or populate data
  useEffect(() => {
    if (initializedDataRef.current) return;
    if (mode === 'edit' && existingCv) {
      setTitle(existingCv.title || 'CV Backend Developer');
      setIsPrimary(existingCv.isPrimary || false);
      setSelectedTemplateId(existingCv.cvTemplateId || null);

      const loadedContent = existingCv.structuredContent || ({} as StructuredCvContent);
      const presentation = loadedContent.presentation;
      if (presentation) {
        setAccentColor(presentation.accentColor || DEFAULT_PRESENTATION.accentColor);
        setDensity(presentation.density || DEFAULT_PRESENTATION.density);
        setFontFamily(presentation.fontFamily || DEFAULT_PRESENTATION.fontFamily);
        setLayout(presentation.layout || DEFAULT_PRESENTATION.layout);
        setShowAvatar(Boolean(presentation.showAvatar));
        if (presentation.avatarDataUrl) {
          setCustomAvatarUrl(presentation.avatarDataUrl);
        }
        const visibleSections = new Set(
          presentation.visibleSections || DEFAULT_PRESENTATION.visibleSections
        );
        setSectionVisibility({
          summary: visibleSections.has('summary'),
          experiences: visibleSections.has('experiences'),
          projects: visibleSections.has('projects'),
          educations: visibleSections.has('educations'),
          activities: visibleSections.has('activities'),
          skills: visibleSections.has('skills'),
          languages: visibleSections.has('languages'),
          certificates: visibleSections.has('certificates'),
        });
      }
      setContent({
        fullName: loadedContent.fullName || DEFAULT_EDITOR_CONTENT.fullName,
        headline: loadedContent.headline || DEFAULT_EDITOR_CONTENT.headline,
        email: loadedContent.email || DEFAULT_EDITOR_CONTENT.email,
        phone: loadedContent.phone || DEFAULT_EDITOR_CONTENT.phone,
        address: loadedContent.address || DEFAULT_EDITOR_CONTENT.address,
        summary: loadedContent.summary || DEFAULT_EDITOR_CONTENT.summary,
        experiences:
          loadedContent.experiences && loadedContent.experiences.length > 0
            ? loadedContent.experiences
            : DEFAULT_EDITOR_CONTENT.experiences,
        projects: loadedContent.projects || [],
        educations:
          loadedContent.educations && loadedContent.educations.length > 0
            ? loadedContent.educations
            : DEFAULT_EDITOR_CONTENT.educations,
        activities: loadedContent.activities || [],
        skills:
          loadedContent.skills && loadedContent.skills.length > 0
            ? loadedContent.skills
            : DEFAULT_EDITOR_CONTENT.skills,
        languages:
          loadedContent.languages && loadedContent.languages.length > 0
            ? loadedContent.languages
            : DEFAULT_EDITOR_CONTENT.languages,
        certificates: loadedContent.certificates || [],
      });
      initializedDataRef.current = true;
      setAvailableDraft(readCvBuilderDraft(draftKey));
      setDraftReady(true);
    } else if (mode === 'create') {
      const rawName =
        currentUser?.name ||
        (currentUser as { fullName?: string } | null)?.fullName ||
        '';
      const defaultName =
        !rawName || rawName === 'truongqui858' || rawName === currentUser?.email?.split('@')[0]
          ? DEFAULT_EDITOR_CONTENT.fullName
          : rawName;
      setTitle('CV Backend Developer');
      setIsPrimary(false);
      setContent({
        ...DEFAULT_EDITOR_CONTENT,
        fullName: defaultName,
        email: currentUser?.email || DEFAULT_EDITOR_CONTENT.email,
        phone: currentUser?.phone || DEFAULT_EDITOR_CONTENT.phone,
      });
      initializedDataRef.current = true;
      setAvailableDraft(null);
      setDraftReady(true);
    }
  }, [mode, existingCv, currentUser, draftKey]);

  const applyTemplatePresentation = useCallback(
    (templateId: string | null) => {
      const selectedTemplate = templateId
        ? templates.find((template) => template.cvTemplateId === templateId)
        : undefined;
      const config = selectedTemplate?.templateConfig;

      setSelectedTemplateId(templateId);
      if (selectedTemplate?.name) {
        setSelectedTemplateName(selectedTemplate.name);
      }
      setAccentColor(config?.accentColor || DEFAULT_PRESENTATION.accentColor);
      setDensity(
        config?.density === 'compact' || config?.density === 'spacious'
          ? config.density
          : DEFAULT_PRESENTATION.density
      );
      setFontFamily(config?.fontFamily || DEFAULT_PRESENTATION.fontFamily);
      setLayout(
        config?.layout ||
          (templateId ? inferTemplateLayout(selectedTemplate?.code) : DEFAULT_PRESENTATION.layout)
      );
    },
    [templates]
  );

  useEffect(() => {
    if (initialTemplateAppliedRef.current || templates.length === 0) return;

    const hasSavedPresentation = Boolean(existingCv?.structuredContent?.presentation);
    if (selectedTemplateId && !hasSavedPresentation) {
      applyTemplatePresentation(selectedTemplateId);
    }
    initialTemplateAppliedRef.current = true;
  }, [applyTemplatePresentation, existingCv, selectedTemplateId, templates]);

  const handleSelectBuiltInTemplate = (tpl: BuiltInCvTemplate, chosenColor: string) => {
    const matchedBackendTpl = templates.find(
      (t) =>
        t.code?.toUpperCase() === tpl.code.toUpperCase() ||
        t.name?.toLowerCase() === tpl.name.toLowerCase()
    );
    setSelectedTemplateId(matchedBackendTpl?.cvTemplateId || null);
    setSelectedTemplateCode(tpl.code);
    setSelectedTemplateName(tpl.name);
    setLayout(tpl.layout);
    setAccentColor(chosenColor || tpl.defaultColor);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', 'editor');
    setSearchParams(nextParams);
  };

  const handleJumpToStep = (targetStep: 'templates' | 'editor') => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', targetStep);
    setSearchParams(nextParams);
  };

  // Update content helper
  const handleUpdateContent = (updated: Partial<StructuredCvContent>) => {
    setContent((prev) => ({ ...prev, ...updated }));
  };

  // Section visibility toggle
  const handleToggleSection = (key: keyof SectionVisibility, visible: boolean) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: visible }));
  };

  const currentDraftPayload = useCallback(
    () => ({
      title,
      isPrimary,
      selectedTemplateId,
      accentColor,
      fontFamily,
      layout,
      density,
      showAvatar,
      avatarDataUrl: customAvatarUrl,
      sectionVisibility,
      content,
    }),
    [
      title,
      isPrimary,
      selectedTemplateId,
      accentColor,
      fontFamily,
      layout,
      density,
      showAvatar,
      customAvatarUrl,
      sectionVisibility,
      content,
    ]
  );

  const saveDraftNow = useCallback(() => {
    try {
      setDraftStatus('saving');
      writeCvBuilderDraft(draftKey, currentDraftPayload());
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
      message.error('Không thể lưu bản nháp trên trình duyệt này.');
    }
  }, [currentDraftPayload, draftKey, message]);

  useEffect(() => {
    if (!draftReady || availableDraft) return;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => {
      try {
        writeCvBuilderDraft(draftKey, currentDraftPayload());
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [availableDraft, currentDraftPayload, draftKey, draftReady]);

  const restoreDraft = () => {
    if (!availableDraft) return;
    setTitle(availableDraft.title);
    setIsPrimary(availableDraft.isPrimary);
    setSelectedTemplateId(availableDraft.selectedTemplateId);
    setAccentColor(availableDraft.accentColor);
    setFontFamily(availableDraft.fontFamily);
    setLayout(availableDraft.layout);
    setDensity(availableDraft.density);
    setShowAvatar(Boolean(availableDraft.showAvatar));
    if (availableDraft.avatarDataUrl) {
      setCustomAvatarUrl(availableDraft.avatarDataUrl);
    }
    setSectionVisibility(availableDraft.sectionVisibility);
    setContent(availableDraft.content);
    setAvailableDraft(null);
    setDraftStatus('saved');
    message.success('Đã khôi phục bản nháp gần nhất.');
  };

  const discardDraft = () => {
    removeCvBuilderDraft(draftKey);
    setAvailableDraft(null);
    setDraftStatus('saved');
  };

  // Completeness score
  const calculateCompleteness = () => {
    let score = 0;
    if (content.fullName?.trim()) score += 20;
    if (content.headline?.trim() || content.email?.trim() || content.phone?.trim()) score += 15;
    if (content.summary?.trim()) score += 15;
    if (content.experiences?.some((exp) => exp.title?.trim() && exp.company?.trim())) score += 25;
    if (content.projects?.some((project) => project.name?.trim())) score += 10;
    if (content.educations?.some((edu) => edu.school?.trim() && edu.degree?.trim())) score += 15;
    if (content.skills && content.skills.length > 0) score += 10;
    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanedExperiences = (content.experiences || []).filter(
        (e) => e.title?.trim() || e.company?.trim() || e.description?.trim()
      );
      const cleanedEducations = (content.educations || []).filter(
        (e) => e.school?.trim() || e.degree?.trim() || e.description?.trim()
      );
      const cleanedProjects = (content.projects || []).filter(
        (project) => project.name?.trim() || project.description?.trim()
      );
      const cleanedActivities = (content.activities || []).filter(
        (activity) => activity.name?.trim() || activity.description?.trim()
      );

      const structuredContent: StructuredCvContent = {
        fullName: content.fullName.trim(),
        headline: content.headline?.trim() || undefined,
        email: content.email?.trim() || undefined,
        phone: content.phone?.trim() || undefined,
        address: content.address?.trim() || undefined,
        summary: content.summary?.trim() || undefined,
        experiences: cleanedExperiences,
        projects: cleanedProjects,
        educations: cleanedEducations,
        activities: cleanedActivities,
        skills: content.skills || [],
        languages: content.languages || [],
        certificates: content.certificates || [],
        presentation: {
          accentColor,
          density,
          fontFamily,
          layout,
          showAvatar: showAvatar && Boolean(avatarUrl),
          avatarDataUrl: customAvatarUrl,
          visibleSections: Object.entries(sectionVisibility)
            .filter(([, visible]) => visible)
            .map(([section]) => section) as CvPresentationConfig['visibleSections'],
        },
      };

      const validation = validateStructuredCvContent(structuredContent, title);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      if (mode === 'edit' && cvId) {
        const updated = await cvBuilderApi.updateStructuredCv(cvId, {
          title: title.trim(),
          cvTemplateId: selectedTemplateId,
          structuredContent,
        });
        if (isPrimary && !existingCv?.isPrimary) {
          await candidateCvApi.setPrimary(cvId);
          return { ...updated, isPrimary: true };
        }
        return updated;
      } else {
        return cvBuilderApi.createStructuredCv({
          title: title.trim(),
          cvTemplateId: selectedTemplateId,
          isPrimary,
          structuredContent,
        });
      }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-cvs'] });
      if (cvId) {
        void queryClient.invalidateQueries({ queryKey: ['candidate-cv-structured', cvId] });
      }
      setSaveSuccessData(result);
      removeCvBuilderDraft(draftKey);
      setDraftStatus('saved');
      message.success(
        mode === 'edit'
          ? 'Đã cập nhật nội dung CV thành công! File PDF đang được tự động đồng bộ.'
          : 'Tạo CV thành công! File PDF đã được tự động khởi tạo trong Kho CV.'
      );
    },
    onError: (err: unknown) => {
      const rawData = (err as { response?: { data?: Record<string, unknown> }; message?: string })
        ?.response?.data;
      const rawCode = String(
        rawData?.errorCode ?? rawData?.code ?? rawData?.message ?? (err as Error)?.message ?? ''
      );
      const apiMsg = getApiErrorMessage(err);
      const combined = `${rawCode} ${apiMsg}`;

      if (combined.includes('CV_CONTENT_EMPTY')) {
        message.error(
          'Nội dung CV chưa đủ thông tin. Vui lòng nhập ít nhất 1 trong các mục: Mục tiêu nghề nghiệp, Kinh nghiệm, Dự án, Học vấn hoặc Kỹ năng.'
        );
      } else if (combined.includes('CV_NOT_STRUCTURED')) {
        message.error(
          'CV này là file tải lên thông thường, không thể chỉnh sửa theo dạng có cấu trúc.'
        );
      } else {
        message.error(apiMsg || rawCode || 'Có lỗi xảy ra khi lưu CV.');
      }
    },
  });

  const handleDownloadPdf = async () => {
    const directUrl = saveSuccessData?.pdfUrl || existingCv?.pdfUrl;
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const targetCvId = saveSuccessData?.cvId || cvId;
    if (targetCvId) {
      try {
        const signed = await candidateCvApi.downloadUrl(targetCvId);
        if (signed?.downloadUrl) {
          window.open(signed.downloadUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch {
        // Fallback to browser print if signed URL is unavailable
      }
    }
    window.print();
  };

  // Handle back
  const handleBack = () => {
    if (mode === 'create' && viewStep === 'editor') {
      handleJumpToStep('templates');
    } else {
      navigate('/candidate/cvs');
    }
  };

  if (mode === 'edit' && isLoadingExisting) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F7F8FA]">
        <Spin size="large" />
        <span className="text-sm font-medium text-slate-600">Đang tải dữ liệu CV...</span>
      </div>
    );
  }

  if (mode === 'edit' && isErrorExisting) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] p-4">
        <Result
          status="error"
          title="Không thể tải nội dung CV"
          subTitle={getApiErrorMessage(existingError)}
          extra={[
            <Button type="primary" key="back" onClick={() => navigate('/candidate/cvs')}>
              Quay lại kho CV
            </Button>,
          ]}
        />
      </div>
    );
  }

  // ── STEP 1: CHỌN MẪU CV (PDF Page 24) ──
  if (viewStep === 'templates') {
    return (
      <CvTemplateGalleryView
        selectedTemplateCode={selectedTemplateCode}
        selectedColor={accentColor}
        onSelectTemplateAndContinue={handleSelectBuiltInTemplate}
        onJumpToEditor={() => handleJumpToStep('editor')}
      />
    );
  }

  // ── STEP 2: TRÌNH SOẠN THẢO CV (PDF Page 20) ──
  return (
    <div className="candidate-cv-builder-page flex h-full max-h-screen w-full flex-1 flex-col overflow-hidden bg-[#EEF2F6] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A]">
      {/* 1. TOPBAR + FORMATTING SUB-BAR */}
      <CvTopbar
        title={title}
        onTitleChange={setTitle}
        isPrimary={isPrimary}
        onPrimaryChange={setIsPrimary}
        onPreview={() => setPreviewOpen(true)}
        onDownloadPdf={() => void handleDownloadPdf()}
        onSave={() => saveMutation.mutate()}
        onSaveDraft={saveDraftNow}
        isSaving={saveMutation.isPending}
        draftStatus={draftStatus}
        onBack={handleBack}
        completeness={completeness}
        mode={mode}
        templateName={
          BUILTIN_CV_TEMPLATES.find(
            (t) =>
              t.code === selectedTemplateCode ||
              (t.code.startsWith('MODERN') && selectedTemplateCode.startsWith('MODERN'))
          )?.name || selectedTemplateName
        }
        onOpenTemplateGallery={() => handleJumpToStep('templates')}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        density={density}
        onDensityChange={setDensity}
      />

      {availableDraft && (
        <Alert
          type="info"
          showIcon
          className="cv-builder-draft-alert !rounded-none !border-x-0 !border-t-0"
          message={
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-semibold text-slate-800">Có bản nháp chưa xuất bản</span>
              <span className="text-xs font-normal text-slate-600">
                Lưu lúc {new Date(availableDraft.savedAt).toLocaleString('vi-VN')}
              </span>
            </div>
          }
          action={
            <div className="flex gap-1.5">
              <Button size="small" type="text" onClick={discardDraft}>
                Bỏ bản nháp
              </Button>
              <Button size="small" type="primary" onClick={restoreDraft}>
                Khôi phục
              </Button>
            </div>
          }
        />
      )}

      {/* 2. MAIN WORKSPACE: LEFT SECTION CARD + LIVE A4 PAPER */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 px-4 py-5 pb-24 sm:px-6 lg:flex-row lg:gap-10">
          {/* Left Floating Card: "Các mục trong CV" */}
          <CvSidebarTools
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={applyTemplatePresentation}
            accentColor={accentColor}
            onAccentColorChange={setAccentColor}
            fontFamily={fontFamily}
            onFontFamilyChange={setFontFamily}
            layout={layout}
            density={density}
            onDensityChange={setDensity}
            avatarUrl={avatarUrl}
            showAvatar={showAvatar}
            onShowAvatarChange={setShowAvatar}
            sectionVisibility={sectionVisibility}
            onToggleSection={handleToggleSection}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          {/* Center/Right Live A4 Canvas */}
          <CvCanvas
            content={content}
            onChangeContent={handleUpdateContent}
            accentColor={accentColor}
            fontFamily={fontFamily}
            layout={layout}
            density={density}
            sectionVisibility={sectionVisibility}
            onToggleSection={handleToggleSection}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            avatarUrl={avatarUrl}
            showAvatar={showAvatar}
            onShowAvatarChange={setShowAvatar}
            onAvatarUpload={(dataUrl, file) => {
              setCustomAvatarUrl(dataUrl);
              setShowAvatar(true);
              message.success('Đã thêm ảnh vào CV.');
              void userApi
                .uploadAvatar(file)
                .then((res) => {
                  if (res?.data?.avatarUrl) {
                    updateUser({ avatar: res.data.avatarUrl });
                  }
                })
                .catch(() => {
                  // Keep local DataURL on the CV even if backend avatar upload is unavailable
                });
            }}
          />
        </div>
      </div>

      {/* 3. PREVIEW MODAL */}
      <CvPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        content={content}
        accentColor={accentColor}
        fontFamily={fontFamily}
        layout={layout}
        density={density}
        sectionVisibility={sectionVisibility}
        avatarUrl={avatarUrl}
        showAvatar={showAvatar}
        pdfUrl={saveSuccessData?.pdfUrl || existingCv?.pdfUrl}
        title={title}
      />

      {/* 4. SAVE SUCCESS DIALOG */}
      <Modal
        open={Boolean(saveSuccessData)}
        onCancel={() => setSaveSuccessData(null)}
        footer={null}
        centered
        width={480}
      >
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600 shadow-xs">
            <CheckCircleFilled />
          </div>

          <div>
            <h3 className="m-0 text-lg font-bold text-slate-900">Lưu CV thành công!</h3>
            <p className="mt-1 text-xs text-slate-500">
              Bản CV đã được lưu vào hệ thống và file PDF đang được tự động xuất bản chuẩn ATS.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {saveSuccessData?.pdfUrl && (
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                href={saveSuccessData.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                block
                className="!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-sky-500 !to-blue-600 font-semibold hover:!from-sky-600 hover:!to-blue-700 shadow-sm"
              >
                Mở xem file PDF vừa tạo
              </Button>
            )}

            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => {
                setSaveSuccessData(null);
                navigate('/candidate/cvs');
              }}
              block
              className="!h-10 !rounded-xl font-semibold"
            >
              Về kho CV của tôi
            </Button>

            <Button
              type="text"
              onClick={() => {
                const newId = saveSuccessData?.cvId;
                setSaveSuccessData(null);
                if (mode === 'create' && newId) {
                  navigate(`/candidate/cv-builder/${newId}`, { replace: true });
                }
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Tiếp tục chỉnh sửa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CandidateCvBuilderPage;
