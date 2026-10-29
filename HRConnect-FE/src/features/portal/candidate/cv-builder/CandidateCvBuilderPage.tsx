import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Modal, Spin, Result, Button, Alert } from 'antd';
import { FilePdfOutlined, CheckCircleFilled, FolderOpenOutlined } from '@ant-design/icons';
import { CvTopbar } from './CvTopbar';
import { CvSidebarTools, type SectionVisibility } from './CvSidebarTools';
import { CvCanvas } from './CvCanvas';
import { CvPreviewModal } from './CvPreviewModal';
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
import {
  cvBuilderDraftKey,
  readCvBuilderDraft,
  removeCvBuilderDraft,
  writeCvBuilderDraft,
  type CvBuilderDraft,
} from './services/cvBuilderDraftStorage';
import './cv-builder.css';

const DEFAULT_PRESENTATION: CvPresentationConfig = {
  accentColor: '#1e3a8a',
  density: 'normal',
  fontFamily: 'BE_VIETNAM_PRO',
  layout: 'ats',
  showAvatar: false,
  visibleSections: ['summary', 'experiences', 'projects', 'educations', 'activities', 'skills', 'languages', 'certificates'],
};

const inferTemplateLayout = (code?: string): CvLayoutStyle => {
  const normalized = (code || '').toUpperCase();
  if (normalized.includes('MODERN')) return 'modern';
  if (normalized.includes('COMPACT')) return 'compact';
  if (normalized.includes('EXECUTIVE')) return 'executive';
  if (normalized.includes('ELEGANT')) return 'elegant';
  if (normalized.includes('MINIMAL')) return 'minimal';
  return 'classic';
};

export const CandidateCvBuilderPage: React.FC = () => {
  const { cvId } = useParams<{ cvId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const avatarUrl = getAvatarImageUrl(currentUser?.avatar);

  const mode: 'create' | 'edit' = cvId ? 'edit' : 'create';

  // ── Builder Configuration State ──
  const [title, setTitle] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    searchParams.get('template') || null
  );
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_PRESENTATION.accentColor);
  const [fontFamily, setFontFamily] = useState<CvFontFamily>(DEFAULT_PRESENTATION.fontFamily);
  const [layout, setLayout] = useState<CvLayoutStyle>(DEFAULT_PRESENTATION.layout);
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [showAvatar, setShowAvatar] = useState<boolean>(DEFAULT_PRESENTATION.showAvatar);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    summary: true,
    experiences: true,
    projects: true,
    educations: true,
    activities: true,
    skills: true,
    languages: true,
    certificates: true,
  });

  // ── Structured CV Content State ──
  const [content, setContent] = useState<StructuredCvContent>({
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    address: '',
    summary: '',
    experiences: [],
    projects: [],
    educations: [],
    activities: [],
    skills: [],
    languages: [],
    certificates: [],
  });

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [saveSuccessData, setSaveSuccessData] = useState<StructuredCvDetailDto | null>(null);
  const initialTemplateAppliedRef = useRef(false);
  const initializedDataRef = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<CvBuilderDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftKey = useMemo(
    () => cvBuilderDraftKey(currentUser?.id || 'anonymous', cvId),
    [currentUser?.id, cvId]
  );

  // 1. Fetch available templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['cv-templates'],
    queryFn: () => cvBuilderApi.getTemplates(),
    staleTime: 5 * 60 * 1000,
  });

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

  // Initialize or populate data
  useEffect(() => {
    if (initializedDataRef.current) return;
    if (mode === 'edit' && existingCv) {
      setTitle(existingCv.title || '');
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
        const visibleSections = new Set(presentation.visibleSections || DEFAULT_PRESENTATION.visibleSections);
        setSectionVisibility({
          summary: visibleSections.has('summary'),
          experiences: visibleSections.has('experiences'),
          projects: visibleSections.has('projects') || !('projects' in loadedContent),
          educations: visibleSections.has('educations'),
          activities: visibleSections.has('activities') || !('activities' in loadedContent),
          skills: visibleSections.has('skills'),
          languages: visibleSections.has('languages'),
          certificates: visibleSections.has('certificates'),
        });
      }
      setContent({
        fullName: loadedContent.fullName || '',
        headline: loadedContent.headline || '',
        email: loadedContent.email || '',
        phone: loadedContent.phone || '',
        address: loadedContent.address || '',
        summary: loadedContent.summary || '',
        experiences: loadedContent.experiences || [],
        projects: loadedContent.projects || [],
        educations: loadedContent.educations || [],
        activities: loadedContent.activities || [],
        skills: loadedContent.skills || [],
        languages: loadedContent.languages || [],
        certificates: loadedContent.certificates || [],
      });
      initializedDataRef.current = true;
      setAvailableDraft(readCvBuilderDraft(draftKey));
      setDraftReady(true);
    } else if (mode === 'create' && currentUser) {
      const defaultName = currentUser?.name || (currentUser as any)?.fullName || '';
      setTitle(defaultName ? `CV - ${defaultName}` : 'CV Ứng tuyển');
      setIsPrimary(false);
      setContent((prev) => ({
        ...prev,
        fullName: defaultName,
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        headline: '', address: '', summary: '', experiences: [], projects: [], educations: [], activities: [],
        skills: [], languages: [], certificates: [],
      }));
      initializedDataRef.current = true;
      setAvailableDraft(readCvBuilderDraft(draftKey));
      setDraftReady(true);
    }
  }, [mode, existingCv, currentUser, draftKey]);

  const applyTemplatePresentation = useCallback((templateId: string | null) => {
    const selectedTemplate = templateId
      ? templates.find((template) => template.cvTemplateId === templateId)
      : undefined;
    const config = selectedTemplate?.templateConfig;

    setSelectedTemplateId(templateId);
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
    const configuredSections = new Set(
      (config?.sections || DEFAULT_PRESENTATION.visibleSections).map((section: string) => {
        if (section === 'experience') return 'experiences';
        if (section === 'education') return 'educations';
        return section;
      })
    );
    configuredSections.add('projects');
    configuredSections.add('activities');
    setSectionVisibility({
      summary: configuredSections.has('summary'),
      experiences: configuredSections.has('experiences'),
      projects: configuredSections.has('projects'),
      educations: configuredSections.has('educations'),
      activities: configuredSections.has('activities'),
      skills: configuredSections.has('skills'),
      languages: configuredSections.has('languages'),
      certificates: configuredSections.has('certificates'),
    });
  }, [templates]);

  // Apply an initial URL/legacy template once. New CVs and older CVs do not yet
  // contain presentation settings, so their selected template supplies them.
  useEffect(() => {
    if (initialTemplateAppliedRef.current || templates.length === 0) return;

    const hasSavedPresentation = Boolean(existingCv?.structuredContent?.presentation);
    if (selectedTemplateId && !hasSavedPresentation) {
      applyTemplatePresentation(selectedTemplateId);
    }
    initialTemplateAppliedRef.current = true;
  }, [applyTemplatePresentation, existingCv, selectedTemplateId, templates]);

  // Update content helper
  const handleUpdateContent = (updated: Partial<StructuredCvContent>) => {
    setContent((prev) => ({ ...prev, ...updated }));
  };

  // Section visibility toggle
  const handleToggleSection = (key: keyof SectionVisibility, visible: boolean) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: visible }));
  };

  const currentDraftPayload = useCallback(() => ({
    title,
    isPrimary,
    selectedTemplateId,
    accentColor,
    fontFamily,
    layout,
    density,
    showAvatar,
    sectionVisibility,
    content,
  }), [title, isPrimary, selectedTemplateId, accentColor, fontFamily, layout, density, showAvatar, sectionVisibility, content]);

  const saveDraftNow = useCallback(() => {
    try {
      setDraftStatus('saving');
      writeCvBuilderDraft(draftKey, currentDraftPayload());
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
      message.error('Không thể lưu bản nháp trên trình duyệt này.');
    }
  }, [currentDraftPayload, draftKey]);

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
    setSectionVisibility(availableDraft.sectionVisibility);
    setContent(availableDraft.content);
    setAvailableDraft(null);
    setDraftStatus('saved');
    message.success('Đã khôi phục bản nháp gần nhất.');
  };

  const discardDraft = () => {
    removeCvBuilderDraft(draftKey);
    setAvailableDraft(null);
    setDraftStatus('idle');
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
      // Clean empty experiences/educations
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
      setDraftStatus('idle');
      message.success(
        mode === 'edit'
          ? 'Đã cập nhật nội dung CV thành công! File PDF đang được tự động đồng bộ.'
          : 'Tạo CV thành công! File PDF đã được tự động khởi tạo trong Kho CV.'
      );
    },
    onError: (err: unknown) => {
      const rawData = (err as any)?.response?.data;
      const rawCode = String(
        rawData?.errorCode ?? rawData?.code ?? rawData?.message ?? (err as any)?.message ?? ''
      );
      const apiMsg = getApiErrorMessage(err);
      const combined = `${rawCode} ${apiMsg}`;

      if (combined.includes('CV_CONTENT_EMPTY')) {
        message.error(
          'Nội dung CV chưa đủ thông tin. Vui lòng nhập ít nhất 1 trong các mục: Mục tiêu nghề nghiệp, Kinh nghiệm, Dự án, Học vấn hoặc Kỹ năng.'
        );
      } else if (combined.includes('CV_NOT_STRUCTURED')) {
        message.error('CV này là file tải lên thông thường, không thể chỉnh sửa theo dạng có cấu trúc.');
      } else {
        message.error(apiMsg || rawCode || 'Có lỗi xảy ra khi lưu CV.');
      }
    },
  });

  // Handle back to /candidate/cvs
  const handleBack = () => {
    navigate('/candidate/cvs');
  };

  if (mode === 'edit' && isLoadingExisting) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#f0f2f5] gap-3">
        <Spin size="large" />
        <span className="text-sm font-medium text-slate-600">Đang tải dữ liệu CV...</span>
      </div>
    );
  }

  if (mode === 'edit' && isErrorExisting) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#f0f2f5] p-4">
        <Result
          status="error"
          title="Không thể tải nội dung CV"
          subTitle={getApiErrorMessage(existingError)}
          extra={[
            <Button type="primary" key="back" onClick={handleBack}>
              Quay lại kho CV
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="candidate-cv-builder-page h-full w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-[#eef2f7] text-slate-900 select-none">
      {/* ── 1. TOPBAR ── */}
      <CvTopbar
        title={title}
        onTitleChange={setTitle}
        isPrimary={isPrimary}
        onPrimaryChange={setIsPrimary}
        onPreview={() => setPreviewOpen(true)}
        onSave={() => saveMutation.mutate()}
        onSaveDraft={saveDraftNow}
        isSaving={saveMutation.isPending}
        draftStatus={draftStatus}
        onBack={handleBack}
        completeness={completeness}
        mode={mode}
      />

      {availableDraft && (
        <Alert
          type="info"
          showIcon
          className="!rounded-none !border-x-0 !border-t-0"
          message="Có bản nháp chưa xuất bản"
          description={`Được lưu lúc ${new Date(availableDraft.savedAt).toLocaleString('vi-VN')}. Bạn có thể khôi phục để tiếp tục đúng chỗ đang làm.`}
          action={<div className="flex gap-2"><Button size="small" onClick={discardDraft}>Bỏ bản nháp</Button><Button size="small" type="primary" onClick={restoreDraft}>Khôi phục</Button></div>}
        />
      )}

      {/* ── 2. MAIN WORKSPACE: SIDEBAR + LIVE CANVAS ── */}
      <div className="cv-builder-workspace flex-1 min-h-0 flex overflow-hidden">
        {/* Left Toolbox Sidebar */}
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
        />

        {/* Center Main A4 Canvas */}
        <CvCanvas
          content={content}
          onChangeContent={handleUpdateContent}
          accentColor={accentColor}
          fontFamily={fontFamily}
          layout={layout}
          density={density}
          sectionVisibility={sectionVisibility}
          avatarUrl={avatarUrl}
          showAvatar={showAvatar}
        />
      </div>

      {/* ── 3. PREVIEW MODAL ── */}
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

      {/* ── 4. SAVE SUCCESS DIALOG ── */}
      <Modal
        open={Boolean(saveSuccessData)}
        onCancel={() => setSaveSuccessData(null)}
        footer={null}
        centered
        width={480}
      >
        <div className="text-center py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
            <CheckCircleFilled />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 m-0">Lưu CV thành công!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Bản CV đã được lưu vào hệ thống và file PDF đang được tự động xuất bản chuẩn ATS.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {saveSuccessData?.pdfUrl && (
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                href={saveSuccessData.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                block
                className="!h-10 !rounded-xl !bg-blue-600 hover:!bg-blue-700 font-semibold"
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
