import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Modal, Spin, Result, Button } from 'antd';
import { FilePdfOutlined, CheckCircleFilled, FolderOpenOutlined } from '@ant-design/icons';
import { CvTopbar } from './CvTopbar';
import { CvSidebarTools, type SectionVisibility } from './CvSidebarTools';
import { CvCanvas } from './CvCanvas';
import { CvPreviewModal } from './CvPreviewModal';
import { CvTemplateModal } from './CvTemplateModal';
import {
  cvBuilderApi,
  validateStructuredCvContent,
} from '@/services/api/cvBuilderApi';
import { mf04Api } from '@/services/api/mf04Api';
import type {
  StructuredCvContent,
  StructuredCvDetailDto,
} from '@/types/api/cvBuilder';
import { useAuthStore } from '@/stores/authStore';
import { candidateKeys } from '@/features/portal/CandidatePages';
import './cv-builder.css';

export const CandidateCvBuilderPage: React.FC = () => {
  const { cvId } = useParams<{ cvId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const mode: 'create' | 'edit' = cvId ? 'edit' : 'create';

  // ── Builder Configuration State ──
  const [title, setTitle] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    searchParams.get('template') || null
  );
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<'STANDARD' | 'MODERN_TWO_COL'>('STANDARD');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  const [accentColor, setAccentColor] = useState<string>('#2563EB'); // Primary Blue
  const [fontFamily, setFontFamily] = useState<string>("'Inter', sans-serif");
  const [fontSizeScale, setFontSizeScale] = useState<'small' | 'normal' | 'large'>('normal');
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');

  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    summary: true,
    experiences: true,
    educations: true,
    skills: true,
    languages: true,
    certificates: true,
    projects: true,
    activities: true,
    awards: true,
    references: false,
    interests: true,
  });

  // ── Structured CV Content State ──
  const [content, setContent] = useState<StructuredCvContent>({
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    address: '',
    summary: '',
    dob: '',
    gender: '',
    website: '',
    experiences: [],
    educations: [],
    skills: [],
    languages: [],
    certificates: [],
    projects: [],
    activities: [],
    awards: [],
    references: [],
    interests: [],
  });

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [saveSuccessData, setSaveSuccessData] = useState<StructuredCvDetailDto | null>(null);

  // 1. Fetch available templates from API (if any)
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

  // 3. Fetch candidate profile for auto-prefill in create mode
  const { data: candidateProfile } = useQuery({
    queryKey: ['my-candidate-profile'],
    queryFn: () => mf04Api.getProfile(),
    enabled: mode === 'create',
    staleTime: 5 * 60 * 1000,
  });

  // Initialize or populate data
  useEffect(() => {
    if (mode === 'edit' && existingCv) {
      setTitle(existingCv.title || '');
      setIsPrimary(existingCv.isPrimary || false);
      setSelectedTemplateId(existingCv.cvTemplateId || null);

      const loadedContent = existingCv.structuredContent || ({} as StructuredCvContent);
      if (loadedContent.selectedTemplateCode === 'MODERN_TWO_COL' || loadedContent.selectedTemplateCode === 'STANDARD') {
        setSelectedTemplateCode(loadedContent.selectedTemplateCode);
      }
      if (loadedContent.accentColor) {
        setAccentColor(loadedContent.accentColor);
      }
      if (loadedContent.fontFamily) {
        setFontFamily(loadedContent.fontFamily);
      }
      if (loadedContent.fontSizeScale) {
        setFontSizeScale(loadedContent.fontSizeScale);
      }
      if (loadedContent.density) {
        setDensity(loadedContent.density);
      }

      setContent({
        fullName: loadedContent.fullName || '',
        headline: loadedContent.headline || '',
        email: loadedContent.email || '',
        phone: loadedContent.phone || '',
        address: loadedContent.address || '',
        summary: loadedContent.summary || '',
        dob: loadedContent.dob || '',
        gender: loadedContent.gender || '',
        website: loadedContent.website || '',
        avatarUrl: loadedContent.avatarUrl || '',
        experiences: loadedContent.experiences || [],
        educations: loadedContent.educations || [],
        skills: loadedContent.skills || [],
        languages: loadedContent.languages || [],
        certificates: loadedContent.certificates || [],
        projects: loadedContent.projects || [],
        activities: loadedContent.activities || [],
        awards: loadedContent.awards || [],
        references: loadedContent.references || [],
        interests: loadedContent.interests || [],
        additionalInfo: loadedContent.additionalInfo || '',
      });
    } else if (mode === 'create') {
      const defaultName =
        candidateProfile?.fullName ||
        currentUser?.name ||
        (currentUser as any)?.fullName ||
        'Nguyễn Minh Trang';

      const defaultEmail = candidateProfile?.email || currentUser?.email || 'minhtrang.candidate@hrconnect.vn';
      const defaultPhone = candidateProfile?.phone || currentUser?.phone || '0912 345 678';
      const defaultAddress = candidateProfile?.currentAddress || 'Hà Nội, Việt Nam';
      const defaultTitle = candidateProfile?.currentJobTitle || 'Chuyên viên Phát triển Phần mềm';

      setTitle(`CV - ${defaultName}`);
      setIsPrimary(false);

      setContent({
        fullName: defaultName,
        headline: defaultTitle,
        email: defaultEmail,
        phone: defaultPhone,
        address: defaultAddress,
        dob: candidateProfile?.dateOfBirth || '15/08/2000',
        gender: candidateProfile?.gender || 'Nữ',
        website: 'linkedin.com/in/nguyenminhtrang',
        avatarUrl: candidateProfile?.avatarUrl || currentUser?.avatar || undefined,
        summary:
          'Kỹ sư phần mềm nhiệt huyết với hơn 2 năm kinh nghiệm thực chiến phát triển các ứng dụng web hiện đại bằng React, TypeScript và Node.js. Đam mê tối ưu hóa trải nghiệm người dùng, viết mã nguồn sạch (Clean Code) và xây dựng kiến trúc hệ thống mở rộng linh hoạt.',
        experiences: [
          {
            title: 'Frontend Developer',
            company: 'Công ty Cổ phần Công nghệ NovaTech',
            startDate: '2023',
            endDate: 'Hiện tại',
            description:
              'Phát triển các module giao diện người dùng chính cho nền tảng tuyển dụng thông minh. Tối ưu thời gian tải trang thêm 35% và tái cấu trúc hệ thống Component Design System dùng Tailwind CSS.',
          },
          {
            title: 'Junior Web Developer',
            company: 'Tập đoàn Giải pháp Số Nexus',
            startDate: '2022',
            endDate: '2023',
            description:
              'Xây dựng các RESTful API và tích hợp giao diện người dùng. Hợp tác chặt chẽ cùng đội ngũ Product & QA đảm bảo tiến độ bàn giao sản phẩm đúng cam kết.',
          },
        ],
        educations: [
          {
            school: 'Đại học Bách Khoa Hà Nội',
            degree: 'Cử nhân Công nghệ Thông tin',
            startDate: '2018',
            endDate: '2022',
            description: 'Tốt nghiệp loại Giỏi (GPA: 3.55/4.0). Đạt học bổng khuyến khích học tập 3 kỳ liên tiếp.',
          },
        ],
        skills: [
          'React',
          'TypeScript',
          'Tailwind CSS',
          'Node.js',
          'Next.js',
          'REST API',
          'Git / GitHub',
          'Tư duy giải quyết vấn đề',
          'Làm việc nhóm Agile / Scrum',
        ],
        languages: ['Tiếng Việt (Bản ngữ)', 'Tiếng Anh (IELTS 7.0)'],
        certificates: [
          'AWS Certified Cloud Practitioner (2023)',
          'Meta Frontend Developer Professional Certificate (Coursera)',
        ],
        projects: [
          {
            id: 'proj-1',
            name: 'HR Connect Online CV Builder',
            role: 'Lead Frontend Developer',
            startDate: '2024',
            endDate: '2024',
            description:
              'Xây dựng công cụ tạo và chỉnh sửa CV trực tuyến dạng WYSIWYG trên khổ giấy A4, hỗ trợ đa mẫu bố cục và xuất bản PDF vector chuẩn in ấn.',
          },
        ],
        activities: [
          {
            id: 'act-1',
            organization: 'CLB Lập trình Bách Khoa (BK IT Club)',
            role: 'Trưởng ban Kỹ thuật',
            startDate: '2020',
            endDate: '2022',
            description: 'Tổ chức các buổi workshop chia sẻ kiến thức Web Development cho hơn 300 sinh viên.',
          },
        ],
        awards: [
          {
            id: 'award-1',
            title: 'Giải Ba cuộc thi Hackathon Sinh viên Công nghệ toàn quốc',
            year: '2022',
            issuer: 'Hiệp hội Phần mềm và Dịch vụ CNTT Việt Nam (VINASA)',
          },
        ],
        references: [
          {
            id: 'ref-1',
            name: 'Nguyễn Văn Hùng',
            title: 'Technical Lead',
            company: 'Công ty Cổ phần Công nghệ NovaTech',
            email: 'hung.nguyen@novatech.vn',
            phone: '0988 123 456',
          },
        ],
        interests: ['Đọc sách công nghệ', 'Chạy bộ bán Marathon', 'Nhiếp ảnh đường phố'],
      });
    }
  }, [mode, existingCv, candidateProfile, currentUser]);

  // Update content helper
  const handleUpdateContent = (updated: Partial<StructuredCvContent>) => {
    setContent((prev) => ({ ...prev, ...updated }));
  };

  // Section visibility toggle
  const handleToggleSection = (key: keyof SectionVisibility, visible: boolean) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: visible }));
  };

  // Completeness score
  const calculateCompleteness = () => {
    let score = 0;
    if (content.fullName?.trim()) score += 20;
    if (content.headline?.trim() || content.email?.trim() || content.phone?.trim()) score += 15;
    if (content.summary?.trim()) score += 15;
    if (content.experiences?.some((exp) => exp.title?.trim() && exp.company?.trim())) score += 25;
    if (content.educations?.some((edu) => edu.school?.trim() && edu.degree?.trim())) score += 15;
    if (content.skills && content.skills.length > 0) score += 10;
    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  // 4. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Clean empty experiences/educations
      const cleanedExperiences = (content.experiences || []).filter(
        (e) => e.title?.trim() || e.company?.trim() || e.description?.trim()
      );
      const cleanedEducations = (content.educations || []).filter(
        (e) => e.school?.trim() || e.degree?.trim() || e.description?.trim()
      );

      const structuredContent: StructuredCvContent = {
        fullName: content.fullName.trim(),
        headline: content.headline?.trim() || undefined,
        email: content.email?.trim() || undefined,
        phone: content.phone?.trim() || undefined,
        address: content.address?.trim() || undefined,
        summary: content.summary?.trim() || undefined,
        dob: content.dob?.trim() || undefined,
        gender: content.gender?.trim() || undefined,
        website: content.website?.trim() || undefined,
        avatarUrl: content.avatarUrl || undefined,
        experiences: cleanedExperiences,
        educations: cleanedEducations,
        skills: content.skills || [],
        languages: content.languages || [],
        certificates: content.certificates || [],
        projects: content.projects || [],
        activities: content.activities || [],
        awards: content.awards || [],
        references: content.references || [],
        interests: content.interests || [],
        additionalInfo: content.additionalInfo?.trim() || undefined,
        // Layout config
        selectedTemplateCode,
        accentColor,
        fontFamily,
        fontSizeScale,
        density,
      };

      const validation = validateStructuredCvContent(structuredContent, title);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      if (mode === 'edit' && cvId) {
        return cvBuilderApi.updateStructuredCv(cvId, {
          title: title.trim(),
          cvTemplateId: selectedTemplateId,
          structuredContent,
        });
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
      // Invalidate candidate CV cache across portal and dashboard
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      void queryClient.invalidateQueries({ queryKey: ['candidate-cvs'] });
      if (cvId) {
        void queryClient.invalidateQueries({ queryKey: ['candidate-cv-structured', cvId] });
      }
      setSaveSuccessData(result);
      message.success(
        mode === 'edit'
          ? 'Đã cập nhật nội dung CV thành công! File PDF đang được tự động đồng bộ.'
          : 'Tạo CV thành công! File PDF đã được tự động khởi tạo trong Kho CV.'
      );
    },
    onError: (err: unknown) => {
      const errorMsg =
        err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu CV. Vui lòng kiểm tra lại thông tin.';
      message.error(errorMsg);
    },
  });

  const handleBack = () => {
    navigate('/candidate/cvs');
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  // Loading state
  if (mode === 'edit' && isLoadingExisting) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Spin size="large" />
        <p className="text-sm font-semibold text-slate-600">Đang tải dữ liệu hồ sơ CV của bạn...</p>
      </div>
    );
  }

  // Error state
  if (mode === 'edit' && isErrorExisting) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
        <Result
          status="404"
          title="Không tìm thấy bản CV"
          subTitle={
            existingError instanceof Error
              ? existingError.message
              : 'Bản CV này có thể đã bị xóa hoặc bạn không có quyền truy cập.'
          }
          extra={
            <Button type="primary" onClick={() => navigate('/candidate/cvs')} className="!rounded-xl">
              Quay lại danh sách CV
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 text-slate-900 select-none">
      {/* ── 1. TOPBAR (Thanh công cụ điều khiển trên cùng) ── */}
      <CvTopbar
        title={title}
        onTitleChange={setTitle}
        isPrimary={isPrimary}
        onPrimaryChange={setIsPrimary}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        fontSizeScale={fontSizeScale}
        onFontSizeScaleChange={setFontSizeScale}
        density={density}
        onDensityChange={setDensity}
        selectedTemplateCode={selectedTemplateCode}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        sectionVisibility={sectionVisibility}
        onToggleSection={handleToggleSection}
        onPreview={() => setPreviewOpen(true)}
        onDownloadPdf={handleDownloadPdf}
        onSave={() => saveMutation.mutate()}
        isSaving={saveMutation.isPending}
        onBack={handleBack}
        mode={mode}
      />

      {/* ── 2. MAIN WORKSPACE: SIDEBAR + LIVE CANVAS ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox Sidebar */}
        <CvSidebarTools
          templates={templates}
          isLoadingTemplates={isLoadingTemplates}
          selectedTemplateCode={selectedTemplateCode}
          onSelectTemplateCode={setSelectedTemplateCode}
          accentColor={accentColor}
          onAccentColorChange={setAccentColor}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          fontSizeScale={fontSizeScale}
          onFontSizeScaleChange={setFontSizeScale}
          density={density}
          onDensityChange={setDensity}
          sectionVisibility={sectionVisibility}
          onToggleSection={handleToggleSection}
          completeness={completeness}
        />

        {/* Center Main A4 Live Canvas */}
        <CvCanvas
          content={content}
          onChangeContent={handleUpdateContent}
          accentColor={accentColor}
          fontFamily={fontFamily}
          fontSizeScale={fontSizeScale}
          density={density}
          selectedTemplateCode={selectedTemplateCode}
          sectionVisibility={sectionVisibility}
        />
      </div>

      {/* ── 3. PREVIEW MODAL ── */}
      <CvPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        content={content}
        accentColor={accentColor}
        fontFamily={fontFamily}
        fontSizeScale={fontSizeScale}
        density={density}
        selectedTemplateCode={selectedTemplateCode}
        sectionVisibility={sectionVisibility}
        pdfUrl={saveSuccessData?.pdfUrl || existingCv?.pdfUrl}
        title={title}
      />

      {/* ── 4. TEMPLATE SWITCHER MODAL ── */}
      <CvTemplateModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        selectedTemplateCode={selectedTemplateCode}
        onSelectTemplate={(code) => setSelectedTemplateCode(code)}
      />

      {/* ── 5. SAVE SUCCESS DIALOG ── */}
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
              Bản CV đã được lưu vào hệ thống và danh sách CV ở Dashboard đã được đồng bộ.
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
