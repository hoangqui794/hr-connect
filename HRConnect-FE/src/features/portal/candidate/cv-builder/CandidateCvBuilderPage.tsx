import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { CvTopbar } from './CvTopbar';
import { CvSidebarTools, type SectionVisibility } from './CvSidebarTools';
import { CvCanvas } from './CvCanvas';
import { CvPreviewModal } from './CvPreviewModal';
import { CvTemplateModal } from './CvTemplateModal';
import { STATIC_CV_TEMPLATES } from './constants/templates';
import {
  getSavedCvById,
  saveCandidateCv,
  validateCvBasics,
} from './services/cvStorage';
import { mf04Api } from '@/services/api/mf04Api';
import type { StructuredCvContent } from '@/types/api/cvBuilder';
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

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

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
    avatarUrl: undefined,
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

  const [previewOpen, setPreviewOpen] = useState<boolean>(
    searchParams.get('action') === 'preview'
  );

  // Static templates list (no remote API calls to prevent 404 errors)
  const templates = STATIC_CV_TEMPLATES;

  // Candidate profile query for auto-prefill in create mode
  const { data: candidateProfile } = useQuery({
    queryKey: ['my-candidate-profile'],
    queryFn: () => mf04Api.getProfile(),
    enabled: mode === 'create',
    staleTime: 5 * 60 * 1000,
  });

  // Initialize or populate data from LocalStorage (edit) or Profile (create)
  useEffect(() => {
    if (isInitialized) return;

    if (mode === 'edit' && cvId) {
      const stored = getSavedCvById(cvId);
      if (stored) {
        setIsInitialized(true);
        setTitle(stored.title || '');
        setIsPrimary(stored.isPrimary || false);
        setSelectedTemplateId(stored.selectedTemplateCode || null);

        const loadedContent = stored.structuredContent || ({} as StructuredCvContent);
        if (
          loadedContent.selectedTemplateCode === 'MODERN_TWO_COL' ||
          loadedContent.selectedTemplateCode === 'STANDARD'
        ) {
          setSelectedTemplateCode(loadedContent.selectedTemplateCode);
        } else if (
          stored.selectedTemplateCode === 'MODERN_TWO_COL' ||
          stored.selectedTemplateCode === 'STANDARD'
        ) {
          setSelectedTemplateCode(stored.selectedTemplateCode);
        }

        if (loadedContent.accentColor || stored.accentColor) {
          setAccentColor(loadedContent.accentColor || stored.accentColor);
        }
        if (loadedContent.fontFamily || stored.fontFamily) {
          setFontFamily(loadedContent.fontFamily || stored.fontFamily);
        }
        if (loadedContent.fontSizeScale || stored.fontSizeScale) {
          setFontSizeScale(
            (loadedContent.fontSizeScale || stored.fontSizeScale) as 'small' | 'normal' | 'large'
          );
        }
        if (loadedContent.density || stored.density) {
          setDensity((loadedContent.density || stored.density) as 'compact' | 'normal' | 'spacious');
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
          avatarUrl: loadedContent.avatarUrl || undefined,
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

        setIsSaved(true);
        return;
      }
    }

    // Default pre-fill for new CV or if draft not found
    if (mode === 'create') {
      const styleParam = searchParams.get('style');
      const roleParam = searchParams.get('role');

      // ── Apply Style Presets ──
      if (styleParam === 'simple') {
        setSelectedTemplateCode('STANDARD');
        setAccentColor('#2563EB');
        setFontFamily("'Inter', sans-serif");
        setDensity('normal');
      } else if (styleParam === 'impressive') {
        setSelectedTemplateCode('MODERN_TWO_COL');
        setAccentColor('#059669');
        setFontFamily("'Plus Jakarta Sans', sans-serif");
        setDensity('normal');
      } else if (styleParam === 'professional') {
        setSelectedTemplateCode('MODERN_TWO_COL');
        setAccentColor('#0F172A');
        setFontFamily("'Inter', sans-serif");
        setDensity('normal');
      } else if (styleParam === 'harvard') {
        setSelectedTemplateCode('STANDARD');
        setAccentColor('#1E293B');
        setFontFamily("'Georgia', serif");
        setDensity('compact');
      }

      const defaultName =
        candidateProfile?.fullName ||
        currentUser?.name ||
        (currentUser as any)?.fullName ||
        'Nguyễn Minh Trang';

      const defaultEmail = candidateProfile?.email || currentUser?.email || 'minhtrang.candidate@hrconnect.vn';
      const defaultPhone = candidateProfile?.phone || currentUser?.phone || '0912 345 678';
      const defaultAddress = candidateProfile?.currentAddress || 'Hà Nội, Việt Nam';

      let defaultTitle = candidateProfile?.currentJobTitle || 'Chuyên viên Phát triển Phần mềm';
      let defaultSummary =
        'Kỹ sư phần mềm nhiệt huyết với hơn 2 năm kinh nghiệm thực chiến phát triển các ứng dụng web hiện đại bằng React, TypeScript và Node.js. Đam mê tối ưu hóa trải nghiệm người dùng, viết mã nguồn sạch (Clean Code) và xây dựng kiến trúc hệ thống mở rộng linh hoạt.';
      let defaultExperiences = [
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
      ];
      let defaultSkills = [
        'React',
        'TypeScript',
        'Tailwind CSS',
        'Node.js',
        'Next.js',
        'REST API',
        'Git / GitHub',
        'Tư duy giải quyết vấn đề',
        'Làm việc nhóm Agile / Scrum',
      ];
      let defaultCertificates = [
        'Chứng chỉ AWS Certified Developer - Associate (2023)',
        'Meta Front-End Developer Professional Certificate (2022)',
      ];

      // ── Tailor Sample Data by Role ──
      if (roleParam === 'sales') {
        defaultTitle = 'Chuyên viên Phát triển Kinh doanh B2B (Sales Specialist)';
        defaultSummary =
          'Chuyên viên Kinh doanh năng động với hơn 3 năm kinh nghiệm phát triển thị trường B2B, quản lý quan hệ khách hàng doanh nghiệp và liên tục vượt chỉ tiêu doanh số 130% liên tiếp 4 quý. Sở hữu kỹ năng đàm phán hợp đồng, phân tích nhu cầu và xây dựng giải pháp tối ưu cho khách hàng.';
        defaultExperiences = [
          {
            title: 'Senior B2B Sales Executive',
            company: 'Công ty Cổ phần Giải pháp Doanh nghiệp VinaCorp',
            startDate: '2023',
            endDate: 'Hiện tại',
            description:
              'Phát triển mạng lưới hơn 50 khách hàng doanh nghiệp vừa và lớn; Đạt doanh số 4.8 tỷ VNĐ/năm (vượt 135% KPI cam kết); Quản lý toàn bộ quy trình từ tiếp cận, demo giải pháp, đàm phán hợp đồng đến bàn giao.',
          },
          {
            title: 'B2B Sales Representative',
            company: 'Tập đoàn Dịch vụ Thương mại Á Châu',
            startDate: '2021',
            endDate: '2023',
            description:
              'Chăm sóc và duy trì mối quan hệ đối tác chiến lược; Tổ chức hơn 80 buổi giới thiệu sản phẩm trực tiếp và trực tuyến cho khách hàng doanh nghiệp; Tăng tỷ lệ tái ký hợp đồng lên 85%.',
          },
        ];
        defaultSkills = [
          'Đàm phán & Thương lượng B2B',
          'Quản trị quan hệ khách hàng (CRM)',
          'Kỹ năng chốt hợp đồng (Closing)',
          'Phân tích nhu cầu khách hàng',
          'Thuyết trình giải pháp doanh nghiệp',
          'HubSpot / Salesforce',
          'Giao tiếp tiếng Anh lưu loát',
        ];
        defaultCertificates = [
          'Chứng chỉ Professional B2B Sales Negotiation Masterclass',
          'HubSpot Inbound Sales Certified',
        ];
      } else if (roleParam === 'accountant') {
        defaultTitle = 'Chuyên viên Kế toán Tổng hợp (General Accountant)';
        defaultSummary =
          'Chuyên viên Kế toán với hơn 3 năm kinh nghiệm trong công tác kế toán tổng hợp, lập báo cáo tài chính, quyết toán thuế TNDN/TNCN/GTGT và quản trị dòng tiền. Nắm vững chuẩn mực kế toán Việt Nam (VAS), cẩn trọng, chính xác tuyệt đối và am hiểu các phần mềm kế toán hiện đại.';
        defaultExperiences = [
          {
            title: 'Kế toán Tổng hợp',
            company: 'Công ty Cổ phần Đầu tư & Thương mại Đại Phát',
            startDate: '2022',
            endDate: 'Hiện tại',
            description:
              'Chịu trách nhiệm lập báo cáo tài chính quý/năm, quyết toán thuế GTGT, TNCN, TNDN; Phân tích biến động chi phí định kỳ giúp công ty tối ưu 12% chi phí vận hành; Làm việc trực tiếp với cơ quan Thuế và đơn vị Kiểm toán độc lập.',
          },
          {
            title: 'Kế toán Nội bộ & Công nợ',
            company: 'Công ty TNHH Dịch vụ Toàn Cầu',
            startDate: '2021',
            endDate: '2022',
            description:
              'Theo dõi và đối chiếu công nợ phải thu - phải trả; Lập phiếu thu/chi, ủy nhiệm chi ngân hàng và hạch toán vào phần mềm kế toán chính xác 100%.',
          },
        ];
        defaultSkills = [
          'Kế toán tổng hợp',
          'Báo cáo tài chính VAS',
          'Quyết toán thuế & Hóa đơn điện tử',
          'Phần mềm MISA / FAST / SAP',
          'Excel nâng cao (VLOOKUP, Pivot, Macro)',
          'Kiểm soát nội bộ & Quản trị rủi ro',
          'Cẩn thận & Tỉ mỉ',
        ];
        defaultCertificates = [
          'Chứng chỉ Kế toán trưởng Doanh nghiệp Quốc gia',
          'Chứng chỉ Ứng dụng CNTT nâng cao trong Tài chính Kế toán',
        ];
      } else if (roleParam === 'marketing') {
        defaultTitle = 'Chuyên viên Digital Marketing / Performance & Growth';
        defaultSummary =
          'Chuyên viên Digital Marketing sáng tạo và định hướng số liệu với hơn 3 năm kinh nghiệm xây dựng chiến dịch đa kênh: Performance Ads (Facebook, Google, TikTok), SEO, Content và CRM Automation. Đã từng quản lý ngân sách quảng cáo hơn 500 triệu/tháng với ROAS trung bình đạt 3.8x.';
        defaultExperiences = [
          {
            title: 'Senior Digital Marketing Specialist',
            company: 'Tập đoàn Bán lẻ & E-commerce SkyTech',
            startDate: '2023',
            endDate: 'Hiện tại',
            description:
              'Lập kế hoạch và thực thi chiến dịch quảng cáo đa kênh Google Ads, Meta Ads và TikTok Ads; Tối ưu tỷ lệ chuyển đổi website tăng 28%; Tăng trưởng doanh thu kênh online 45% so với cùng kỳ.',
          },
          {
            title: 'Content & Social Media Marketer',
            company: 'Agency Truyền thông Sáng tạo Phoenix',
            startDate: '2021',
            endDate: '2023',
            description:
              'Xây dựng chiến lược nội dung viral trên các nền tảng mạng xã hội; Quản lý đội ngũ cộng tác viên sáng tạo nội dung và thiết kế đồ họa.',
          },
        ];
        defaultSkills = [
          'Google Ads & Meta Ads',
          'SEO On-page / Off-page',
          'Content Strategy & Copywriting',
          'Google Analytics 4 & Tag Manager',
          'Tối ưu tỷ lệ chuyển đổi (CRO)',
          'Email Automation & CRM',
          'Canva / Adobe Photoshop',
        ];
        defaultCertificates = [
          'Google Ads Search & Measurement Certified',
          'Meta Certified Digital Marketing Associate',
        ];
      }

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
        summary: defaultSummary,
        experiences: defaultExperiences,
        educations: [
          {
            school: 'Đại học Bách Khoa Hà Nội',
            degree: 'Cử nhân Đại học chính quy',
            startDate: '2018',
            endDate: '2022',
            description: 'Tốt nghiệp loại Giỏi (GPA: 3.55/4.0). Đạt học bổng khuyến khích học tập 3 kỳ liên tiếp.',
          },
        ],
        skills: defaultSkills,
        languages: [
          'Tiếng Việt (Bản ngữ)',
          'Tiếng Anh (IELTS 7.0 - Giao tiếp công việc thành thạo)',
        ],
        certificates: defaultCertificates,
        projects: [
          {
            name: 'HR Connect Recruitment Platform',
            role: defaultTitle,
            startDate: '2024',
            endDate: 'Hiện tại',
            description:
              'Đóng góp triển khai các phân hệ dịch vụ tuyển dụng, xây dựng công cụ tạo CV online trực quan chuẩn TopCV và tính năng tìm kiếm việc làm thời gian thực.',
          },
        ],
        activities: [
          {
            organization: 'CLB Nhà Lập Trình & Đổi Mới Sáng Tạo',
            role: 'Trưởng ban Chuyên môn',
            startDate: '2020',
            endDate: '2022',
            description: 'Tổ chức các buổi workshop chia sẻ kỹ năng và định hướng nghề nghiệp cho hơn 500 sinh viên.',
          },
        ],
        awards: [
          {
            title: 'Giải Nhất Cuộc thi Sáng tạo Khởi nghiệp Trẻ',
            year: '2023',
          },
        ],
        references: [
          {
            name: 'Nguyễn Văn Nam',
            title: 'Giám đốc Bộ phận tại NovaTech',
            phone: '0988 888 999',
            email: 'nam.nguyen@novatech.vn',
          },
        ],
        interests: ['Đọc sách chuyên ngành', 'Chạy bộ bán Marathon', 'Nhiếp ảnh đường phố'],
      });
      setIsInitialized(true);
      setIsSaved(false);
    }
  }, [cvId, mode, candidateProfile, currentUser, isInitialized, searchParams]);

  // Handle immediate print/download if requested via query param
  useEffect(() => {
    if (searchParams.get('action') === 'download') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Update content callback with modification tracking
  const handleContentChange = useCallback((patch: Partial<StructuredCvContent>) => {
    setContent((prev) => ({ ...prev, ...patch }));
    setIsSaved(false);
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setIsSaved(false);
  }, []);

  const handleAccentColorChange = useCallback((color: string) => {
    setAccentColor(color);
    setIsSaved(false);
  }, []);

  const handleFontFamilyChange = useCallback((font: string) => {
    setFontFamily(font);
    setIsSaved(false);
  }, []);

  const handleFontSizeScaleChange = useCallback((scale: 'small' | 'normal' | 'large') => {
    setFontSizeScale(scale);
    setIsSaved(false);
  }, []);

  const handleDensityChange = useCallback((dens: 'compact' | 'normal' | 'spacious') => {
    setDensity(dens);
    setIsSaved(false);
  }, []);

  const handleSelectTemplate = useCallback((code: 'STANDARD' | 'MODERN_TWO_COL') => {
    setSelectedTemplateCode(code);
    setIsSaved(false);
  }, []);

  const handleToggleSection = useCallback((key: keyof SectionVisibility, visible: boolean) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: visible }));
  }, []);

  // ── SAVE CV ACTION (LocalStorage Persistence & Sync with Dashboard) ──
  const handleSave = () => {
    // 1. Validate mandatory fields
    const validation = validateCvBasics(content);
    if (!validation.isValid) {
      message.error(validation.error || 'Vui lòng kiểm tra lại thông tin cơ bản.');
      return;
    }

    setIsSaving(true);
    try {
      const structuredContent: StructuredCvContent = {
        ...content,
        fullName: content.fullName?.trim() || '',
        headline: content.headline?.trim() || '',
        email: content.email?.trim() || '',
        phone: content.phone?.trim() || '',
        address: content.address?.trim() || '',
        summary: content.summary?.trim() || '',
        selectedTemplateCode,
        accentColor,
        fontFamily,
        fontSizeScale,
        density,
      };

      const saved = saveCandidateCv({
        cvId: cvId || undefined,
        title: title.trim() || `CV - ${structuredContent.fullName}`,
        isPrimary,
        selectedTemplateCode,
        accentColor,
        fontFamily,
        fontSizeScale,
        density,
        structuredContent,
      });

      setIsSaved(true);
      message.success('Đã lưu CV thành công!');

      // Notify other views (Kho CV, Dashboard, etc.) that CV list was updated
      window.dispatchEvent(new Event('candidate_cv_updated'));

      // Invalidate candidate CV cache across portal and dashboard
      void queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      void queryClient.invalidateQueries({ queryKey: ['candidate-cvs'] });

      // If created as new, replace route with cvId without page reload
      if (mode === 'create' && saved.cvId) {
        navigate(`/candidate/cv-builder/${saved.cvId}`, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu CV.';
      message.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/candidate/cvs');
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100/90 font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. STICKY TOPBAR HEADER */}
      <CvTopbar
        title={title}
        onTitleChange={handleTitleChange}
        isPrimary={isPrimary}
        onPrimaryChange={(val) => {
          setIsPrimary(val);
          setIsSaved(false);
        }}
        accentColor={accentColor}
        onAccentColorChange={handleAccentColorChange}
        fontFamily={fontFamily}
        onFontFamilyChange={handleFontFamilyChange}
        fontSizeScale={fontSizeScale}
        onFontSizeScaleChange={handleFontSizeScaleChange}
        density={density}
        onDensityChange={handleDensityChange}
        selectedTemplateCode={selectedTemplateCode}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        sectionVisibility={sectionVisibility}
        onToggleSection={handleToggleSection}
        onPreview={() => setPreviewOpen(true)}
        onDownloadPdf={handleDownloadPdf}
        onSave={handleSave}
        isSaving={isSaving}
        isSaved={isSaved}
        onBack={handleBack}
        mode={mode}
      />

      {/* 2. MAIN WORKSPACE (Sidebar Tools + Live A4 Canvas) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Tools */}
        <CvSidebarTools
          templates={templates}
          isLoadingTemplates={false}
          selectedTemplateCode={selectedTemplateCode}
          onSelectTemplateCode={handleSelectTemplate}
          accentColor={accentColor}
          onAccentColorChange={handleAccentColorChange}
          fontFamily={fontFamily}
          onFontFamilyChange={handleFontFamilyChange}
          fontSizeScale={fontSizeScale}
          onFontSizeScaleChange={handleFontSizeScaleChange}
          density={density}
          onDensityChange={handleDensityChange}
          sectionVisibility={sectionVisibility}
          onToggleSection={handleToggleSection}
          completeness={100}
        />

        {/* Center Live A4 Canvas */}
        <CvCanvas
          content={content}
          onChangeContent={handleContentChange}
          selectedTemplateCode={selectedTemplateCode}
          accentColor={accentColor}
          fontFamily={fontFamily}
          fontSizeScale={fontSizeScale}
          density={density}
          sectionVisibility={sectionVisibility}
        />
      </div>

      {/* 3. MODAL: Preview CV */}
      <CvPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        content={content}
        title={title}
        accentColor={accentColor}
        fontFamily={fontFamily}
        fontSizeScale={fontSizeScale}
        density={density}
        selectedTemplateCode={selectedTemplateCode}
        sectionVisibility={sectionVisibility}
      />

      {/* 4. MODAL: Switch CV Template */}
      <CvTemplateModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        selectedTemplateCode={selectedTemplateCode}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};

export default CandidateCvBuilderPage;
