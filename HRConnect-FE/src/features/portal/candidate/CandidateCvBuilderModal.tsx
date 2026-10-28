import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Checkbox,
  Progress,
  message,
  Alert,
  Spin,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  FilePdfOutlined,
  LayoutOutlined,
  FormOutlined,
  ThunderboltOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  BookOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  TranslationOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cvBuilderApi,
  validateStructuredCvContent,
} from '@/services/api/cvBuilderApi';
import { STATIC_CV_TEMPLATES } from './cv-builder/constants/templates';
import { getSavedCvById, saveCandidateCv } from './cv-builder/services/cvStorage';
import type {
  StructuredCvContent,
  StructuredCvExperience,
  StructuredCvEducation,
} from '@/types/api/cvBuilder';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorMessage } from '@/services/apiClient';

const { TextArea } = Input;

export type CvPreset = 'ats' | 'classic' | 'compact';

const DEFAULT_SKILL_SUGGESTIONS = [
  'React',
  'TypeScript',
  'Node.js',
  'JavaScript',
  'Python',
  'Java',
  'Golang',
  'Docker',
  'Kubernetes',
  'SQL',
  'PostgreSQL',
  'AWS',
  'Git',
  'CI/CD',
  'REST API',
];

export interface CandidateCvBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  editCvId?: string;
  initialTemplateId?: string | null;
}

export const CandidateCvBuilderModal: React.FC<CandidateCvBuilderModalProps> = ({
  open,
  onClose,
  onSuccess,
  mode = 'create',
  editCvId,
  initialTemplateId = null,
}) => {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // Flow step in create mode: 'choose' | 'edit'
  const [step, setStep] = useState<'choose' | 'edit'>(mode === 'edit' ? 'edit' : 'choose');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId);
  const [title, setTitle] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [preset, setPreset] = useState<CvPreset>('ats');

  // Structured Content State
  const [fullName, setFullName] = useState<string>('');
  const [headline, setHeadline] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [experiences, setExperiences] = useState<StructuredCvExperience[]>([]);
  const [educations, setEducations] = useState<StructuredCvEducation[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<string[]>([]);

  // Input states for tags
  const [skillInput, setSkillInput] = useState<string>('');
  const [languageInput, setLanguageInput] = useState<string>('');
  const [certInput, setCertInput] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // 1. Query: List templates from cvBuilderApi (with static fallback)
  const { data: remoteTemplates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['cv-templates'],
    queryFn: () => cvBuilderApi.getTemplates(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const templates = remoteTemplates.length > 0 ? remoteTemplates : STATIC_CV_TEMPLATES;

  // 2. Fetch structured CV if in edit mode (from local storage or fallback)
  const {
    data: existingCv,
    isLoading: isLoadingExisting,
    isError: isErrorExisting,
    error: existingError,
  } = useQuery({
    queryKey: ['candidate-cv-structured', editCvId],
    queryFn: async () => {
      const stored = getSavedCvById(editCvId!);
      if (stored) {
        return {
          cvId: stored.cvId,
          title: stored.title,
          cvTemplateId: stored.selectedTemplateCode,
          isPrimary: stored.isPrimary,
          status: stored.status,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
          structuredContent: stored.structuredContent,
        };
      }
      return cvBuilderApi.getStructuredCv(editCvId!);
    },
    enabled: open && mode === 'edit' && Boolean(editCvId),
  });

  // Populate form on edit load or initial open
  useEffect(() => {
    if (!open) {
      setValidationError(null);
      return;
    }

    if (mode === 'edit' && existingCv) {
      setStep('edit');
      setTitle(existingCv.title || '');
      setIsPrimary(existingCv.isPrimary || false);
      setSelectedTemplateId(existingCv.cvTemplateId || null);

      const content = existingCv.structuredContent || ({} as StructuredCvContent);
      setFullName(content.fullName || '');
      setHeadline(content.headline || '');
      setEmail(content.email || '');
      setPhone(content.phone || '');
      setAddress(content.address || '');
      setSummary(content.summary || '');
      setExperiences(content.experiences || []);
      setEducations(content.educations || []);
      setSkills(content.skills || []);
      setLanguages(content.languages || []);
      setCertificates(content.certificates || []);
    } else if (mode === 'create') {
      setStep('choose');
      const defaultName = currentUser?.name || (currentUser as any)?.fullName || '';
      setTitle(defaultName ? `CV - ${defaultName}` : 'CV Ứng tuyển');
      setIsPrimary(false);
      setSelectedTemplateId(initialTemplateId);
      setFullName(defaultName);
      setEmail(currentUser?.email || '');
      setPhone(currentUser?.phone || '');
      setHeadline('');
      setAddress('');
      setSummary('');
      setExperiences([
        {
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          description: '',
        },
      ]);
      setEducations([
        {
          school: '',
          degree: '',
          startDate: '',
          endDate: '',
          description: '',
        },
      ]);
      setSkills(['React', 'TypeScript', 'Node.js']);
      setLanguages(['Tiếng Việt (Bản ngữ)', 'Tiếng Anh (Giao tiếp tốt)']);
      setCertificates([]);
    }
  }, [open, mode, existingCv, initialTemplateId, currentUser]);

  // Completeness score calculator
  const calculateCompleteness = () => {
    let score = 0;
    if (fullName.trim()) score += 20;
    if (headline.trim() || email.trim() || phone.trim()) score += 15;
    if (summary.trim()) score += 15;
    if (experiences.some((exp) => exp.title.trim() && exp.company.trim())) score += 25;
    if (educations.some((edu) => edu.school.trim() && edu.degree.trim())) score += 15;
    if (skills.length > 0) score += 10;
    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  // Experience handlers
  const handleAddExperience = () => {
    setExperiences((prev) => [
      ...prev,
      { title: '', company: '', startDate: '', endDate: '', description: '' },
    ]);
  };

  const handleUpdateExperience = (
    index: number,
    field: keyof StructuredCvExperience,
    val: string
  ) => {
    setExperiences((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveExperience = (index: number) => {
    setExperiences((prev) => prev.filter((_, i) => i !== index));
  };

  // Education handlers
  const handleAddEducation = () => {
    setEducations((prev) => [
      ...prev,
      { school: '', degree: '', startDate: '', endDate: '', description: '' },
    ]);
  };

  const handleUpdateEducation = (
    index: number,
    field: keyof StructuredCvEducation,
    val: string
  ) => {
    setEducations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveEducation = (index: number) => {
    setEducations((prev) => prev.filter((_, i) => i !== index));
  };

  // Tag list helpers
  const handleAddTag = (
    tagVal: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = tagVal.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const handleRemoveTag = (
    tagToRemove: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter((t) => t !== tagToRemove));
  };

  // 3. Mutation: Create / Update Structured CV
  const saveMutation = useMutation({
    mutationFn: async () => {
      setValidationError(null);

      // Clean empty experiences/educations
      const cleanedExperiences = experiences.filter(
        (e) => e.title.trim() || e.company.trim() || e.description?.trim()
      );
      const cleanedEducations = educations.filter(
        (e) => e.school.trim() || e.degree.trim() || e.description?.trim()
      );

      const structuredContent: StructuredCvContent = {
        fullName: fullName.trim(),
        headline: headline.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        summary: summary.trim() || undefined,
        experiences: cleanedExperiences,
        educations: cleanedEducations,
        skills: skills,
        languages: languages,
        certificates: certificates,
      };

      let apiResult;
      if (mode === 'edit' && editCvId) {
        apiResult = await cvBuilderApi.updateStructuredCv(editCvId, {
          title: title.trim(),
          cvTemplateId: selectedTemplateId,
          structuredContent,
        });
      } else {
        apiResult = await cvBuilderApi.createStructuredCv({
          title: title.trim(),
          cvTemplateId: selectedTemplateId,
          isPrimary,
          structuredContent,
        });
      }

      saveCandidateCv({
        cvId: mode === 'edit' ? editCvId : apiResult?.cvId,
        title: title.trim(),
        isPrimary,
        selectedTemplateCode: selectedTemplateId || 'STANDARD',
        structuredContent,
      });

      return apiResult;
    },
    onSuccess: () => {
      message.success(
        mode === 'edit'
          ? 'Đã cập nhật nội dung CV thành công! File PDF đang được tự động đồng bộ.'
          : 'Tạo CV thành công! File PDF đã được tự động khởi tạo trong Kho CV.'
      );
      void queryClient.invalidateQueries({ queryKey: ['candidate-cvs'] });
      window.dispatchEvent(new Event('candidate_cv_updated'));
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const rawData = (err as any)?.response?.data;
      const rawCode = String(rawData?.errorCode ?? rawData?.code ?? rawData?.message ?? (err as any)?.message ?? '');
      const apiMsg = getApiErrorMessage(err);
      const combined = `${rawCode} ${apiMsg}`;

      if (combined.includes('CV_CONTENT_EMPTY') || combined.includes('Bắt buộc phải có ít nhất 1 trong các mục')) {
        setValidationError(
          'Nội dung CV chưa đủ thông tin. Vui lòng nhập ít nhất 1 trong các mục: Mục tiêu nghề nghiệp, Kinh nghiệm làm việc, Học vấn hoặc Kỹ năng.'
        );
      } else if (combined.includes('CV_NOT_STRUCTURED')) {
        setValidationError('CV này là file tải lên thông thường, không thể chỉnh sửa theo dạng có cấu trúc.');
      } else {
        setValidationError(apiMsg || rawCode);
      }
    },
  });

  const selectedTemplate = templates.find((t) => t.cvTemplateId === selectedTemplateId);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1240}
      style={{ top: 16 }}
      destroyOnHidden
      footer={null}
      title={
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-base">
              <FilePdfOutlined />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base">
                {mode === 'edit'
                  ? 'Chỉnh sửa nội dung CV'
                  : step === 'choose'
                  ? 'Tạo CV mới cho ứng viên'
                  : 'Dựng nội dung CV chuyên nghiệp'}
              </span>
              {step === 'edit' && (
                <span className="text-xs font-normal text-slate-500 bg-slate-100 rounded-md px-2 py-0.5 ml-2 border border-slate-200">
                  {selectedTemplate ? `Mẫu: ${selectedTemplate.name}` : 'Bố cục tự dựng'}
                </span>
              )}
            </div>
          </div>

          {step === 'edit' && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <EyeOutlined className="text-slate-400" />
              <span>Chế độ Live Preview tự động đồng bộ</span>
            </div>
          )}
        </div>
      }
    >
      {/* ── STEP 1: CHOOSE CREATION METHOD (Create mode) ── */}
      {step === 'choose' && mode === 'create' && (
        <div className="py-4 space-y-6">
          <p className="text-sm text-slate-600 m-0">
            Chọn phương thức tạo CV phù hợp để hồ sơ của bạn đạt chuẩn ATS và thu hút nhà tuyển dụng:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Chọn mẫu thiết kế */}
            <div
              className="border border-slate-200 hover:border-blue-500 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-md bg-white flex flex-col justify-between group"
              onClick={() => {
                if (templates.length > 0) {
                  setSelectedTemplateId(templates[0].cvTemplateId);
                }
                setStep('edit');
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                    <LayoutOutlined />
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                    Gợi ý tốt nhất
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">
                  Dựng CV theo mẫu đẹp
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Chọn bố cục thiết kế chuyên nghiệp với màu sắc thương hiệu và định dạng tối ưu cho hệ thống AI chấm điểm.
                </p>

                {/* Templates preview list */}
                {isLoadingTemplates ? (
                  <div className="py-3 text-center">
                    <Spin size="small" />
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {templates.slice(0, 3).map((tpl) => (
                      <div
                        key={tpl.cvTemplateId}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-medium text-slate-800">{tpl.name}</span>
                        <div className="flex items-center gap-1.5">
                          {tpl.templateConfig?.accentColor && (
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border border-white shadow-xs"
                              style={{ backgroundColor: tpl.templateConfig.accentColor }}
                            />
                          )}
                          <span className="text-[11px] text-slate-400">
                            {tpl.templateConfig?.density === 'compact' ? 'Gọn gàng' : 'Chuẩn'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="primary" className="mt-6 w-full !rounded-xl !bg-blue-600 hover:!bg-blue-700">
                Bắt đầu chọn mẫu
              </Button>
            </div>

            {/* Card 2: Tự dựng nền tảng (cvTemplateId = null) */}
            <div
              className="border border-slate-200 hover:border-blue-500 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-md bg-white flex flex-col justify-between group"
              onClick={() => {
                setSelectedTemplateId(null);
                setStep('edit');
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                    <FormOutlined />
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                    Bố cục chuẩn ATS
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">
                  Tự dựng CV nhanh
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Điền trực tiếp thông tin vào biểu mẫu chuẩn mực, không ràng buộc màu sắc cầu kỳ, dễ dàng xuất PDF và nộp hồ sơ.
                </p>
                <div className="p-3.5 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-2 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircleFilled className="text-emerald-500 text-sm" />
                    <span>Tự động tối ưu hoá từ khoá cho bộ lọc HR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleFilled className="text-emerald-500 text-sm" />
                    <span>Xuất file PDF chuẩn chất lượng cao ngay lập tức</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleFilled className="text-emerald-500 text-sm" />
                    <span>Cho phép chỉnh sửa lại nội dung bất kỳ lúc nào</span>
                  </div>
                </div>
              </div>

              <Button className="mt-6 w-full !rounded-xl">Tự dựng ngay</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: SPLIT SCREEN (60% Form Editor + 40% Live Preview) ── */}
      {step === 'edit' && (
        <div className="py-2 space-y-4">
          {isLoadingExisting ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <Spin size="large" />
              <span className="text-sm text-slate-500">Đang tải dữ liệu CV...</span>
            </div>
          ) : isErrorExisting ? (
            <Alert
              type="error"
              showIcon
              message="Không thể tải nội dung CV"
              description={getApiErrorMessage(existingError)}
            />
          ) : (
            <>
              {/* Top Control Bar: Title, Checkbox, Segmented Control for Presets, Completeness */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-7">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Tiêu đề CV (VD: CV Senior Frontend Developer - 2026)"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          maxLength={180}
                          className="rounded-lg font-medium"
                          prefix={<span className="text-xs font-semibold text-slate-500 mr-1">Tiêu đề:</span>}
                        />
                      </div>
                      {mode === 'create' && (
                        <Checkbox
                          checked={isPrimary}
                          onChange={(e) => setIsPrimary(e.target.checked)}
                          className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                        >
                          CV chính
                        </Checkbox>
                      )}
                    </div>
                  </div>

                  {/* Preset Segmented Control */}
                  <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-3">
                    <div className="bg-slate-200/80 p-1 rounded-lg flex gap-1">
                      {(
                        [
                          { key: 'ats', label: 'Chuẩn ATS' },
                          { key: 'classic', label: 'Cổ điển' },
                          { key: 'compact', label: 'Gọn một trang' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setPreset(item.key)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all border-0 cursor-pointer ${
                            preset === item.key
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'bg-transparent text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Completeness Pill */}
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <div className="flex-1">
                        <Progress
                          percent={completeness}
                          size="small"
                          status={completeness >= 80 ? 'success' : 'active'}
                          showInfo={false}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{completeness}%</span>
                    </div>
                  </div>
                </div>

                {/* Validation alert */}
                {validationError && (
                  <Alert
                    type="error"
                    showIcon
                    message={validationError}
                    closable
                    onClose={() => setValidationError(null)}
                  />
                )}
              </div>

              {/* ── SPLIT SCREEN CONTAINER ── */}
              <div className="flex flex-col lg:flex-row gap-5">
                {/* ── LEFT COLUMN (60%): FORM EDITOR ── */}
                <div className="w-full lg:w-[58%] max-h-[66vh] overflow-y-auto pr-2 space-y-4">
                  {/* SECTION 1: PERSONAL INFORMATION */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <UserOutlined className="text-blue-600" />
                      <span>1. Thông tin cá nhân & Headline</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Họ và tên <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="Nguyễn Văn A"
                          prefix={<UserOutlined className="text-slate-400" />}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Chức danh chuyên môn (Headline)
                        </label>
                        <Input
                          placeholder="VD: Senior Frontend Developer"
                          value={headline}
                          onChange={(e) => setHeadline(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email liên hệ</label>
                        <Input
                          placeholder="nguyenvana@example.com"
                          prefix={<MailOutlined className="text-slate-400" />}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại</label>
                        <Input
                          placeholder="0912 345 678"
                          prefix={<PhoneOutlined className="text-slate-400" />}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Địa chỉ / Khu vực</label>
                        <Input
                          placeholder="VD: Quận Cầu Giấy, Hà Nội"
                          prefix={<HomeOutlined className="text-slate-400" />}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CAREER SUMMARY */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <ThunderboltOutlined className="text-amber-500" />
                        <span>2. Tóm tắt mục tiêu / Giới thiệu bản thân</span>
                      </div>
                    </div>
                    <TextArea
                      rows={3}
                      maxLength={600}
                      showCount
                      placeholder="Mô tả tóm tắt kinh nghiệm nổi bật, kỹ năng thế mạnh và định hướng công việc tiếp theo..."
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                    />
                  </div>

                  {/* SECTION 3: WORK EXPERIENCES */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <ApartmentOutlined className="text-blue-600" />
                        <span>3. Kinh nghiệm làm việc</span>
                      </div>
                      <Button
                        size="small"
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAddExperience}
                        className="text-xs text-blue-600 border-blue-300"
                      >
                        Thêm kinh nghiệm
                      </Button>
                    </div>

                    {experiences.length === 0 ? (
                      <p className="text-xs text-slate-400 italic m-0 py-2">
                        Chưa có kinh nghiệm nào. Bấm &quot;Thêm kinh nghiệm&quot; để bổ sung lịch sử làm việc.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {experiences.map((exp, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Vị trí #{idx + 1}
                              </span>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveExperience(idx)}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Chức danh / Vị trí
                                </label>
                                <Input
                                  size="small"
                                  placeholder="VD: Senior React Developer"
                                  value={exp.title}
                                  onChange={(e) => handleUpdateExperience(idx, 'title', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Công ty / Tổ chức
                                </label>
                                <Input
                                  size="small"
                                  placeholder="VD: Tập đoàn Công nghệ ABC"
                                  value={exp.company}
                                  onChange={(e) => handleUpdateExperience(idx, 'company', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Bắt đầu (Tháng/Năm)
                                </label>
                                <Input
                                  size="small"
                                  placeholder="03/2022"
                                  value={exp.startDate}
                                  onChange={(e) => handleUpdateExperience(idx, 'startDate', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Kết thúc (hoặc Hiện tại)
                                </label>
                                <Input
                                  size="small"
                                  placeholder="Hiện tại"
                                  value={exp.endDate ?? ''}
                                  onChange={(e) => handleUpdateExperience(idx, 'endDate', e.target.value)}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                Mô tả công việc & Thành tựu
                              </label>
                              <TextArea
                                rows={2}
                                placeholder="Mô tả trách nhiệm chính, công nghệ sử dụng, giải pháp và kết quả đạt được..."
                                value={exp.description ?? ''}
                                onChange={(e) => handleUpdateExperience(idx, 'description', e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: EDUCATIONS */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <BookOutlined className="text-emerald-600" />
                        <span>4. Học vấn & Bằng cấp</span>
                      </div>
                      <Button
                        size="small"
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAddEducation}
                        className="text-xs text-emerald-600 border-emerald-300"
                      >
                        Thêm học vấn
                      </Button>
                    </div>

                    {educations.length === 0 ? (
                      <p className="text-xs text-slate-400 italic m-0 py-2">
                        Chưa có học vấn nào. Bấm &quot;Thêm học vấn&quot; để bổ sung bằng cấp, trường học.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {educations.map((edu, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Bằng cấp #{idx + 1}
                              </span>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveEducation(idx)}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Trường / Học viện
                                </label>
                                <Input
                                  size="small"
                                  placeholder="VD: Đại học Bách Khoa Hà Nội"
                                  value={edu.school}
                                  onChange={(e) => handleUpdateEducation(idx, 'school', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Chuyên ngành / Bằng cấp
                                </label>
                                <Input
                                  size="small"
                                  placeholder="VD: Cử nhân Công nghệ Thông tin"
                                  value={edu.degree}
                                  onChange={(e) => handleUpdateEducation(idx, 'degree', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Bắt đầu
                                </label>
                                <Input
                                  size="small"
                                  placeholder="2018"
                                  value={edu.startDate}
                                  onChange={(e) => handleUpdateEducation(idx, 'startDate', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  Tốt nghiệp / Kết thúc
                                </label>
                                <Input
                                  size="small"
                                  placeholder="2022"
                                  value={edu.endDate ?? ''}
                                  onChange={(e) => handleUpdateEducation(idx, 'endDate', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: SKILLS, LANGUAGES & CERTIFICATES */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white shadow-xs">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <TrophyOutlined className="text-amber-600" />
                      <span>5. Kỹ năng, Ngôn ngữ & Chứng chỉ</span>
                    </div>

                    {/* Skills */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">Kỹ năng chuyên môn</label>
                      <div className="flex gap-2">
                        <Input
                          size="small"
                          placeholder="Nhập kỹ năng và bấm Enter (VD: React, Docker, SQL...)"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onPressEnter={() =>
                            handleAddTag(skillInput, skills, setSkills, setSkillInput)
                          }
                          className="max-w-md"
                        />
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            handleAddTag(skillInput, skills, setSkills, setSkillInput)
                          }
                        >
                          Thêm
                        </Button>
                      </div>

                      {/* Suggestions */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[11px] text-slate-400 mr-1">Gợi ý:</span>
                        {DEFAULT_SKILL_SUGGESTIONS.filter((s) => !skills.includes(s))
                          .slice(0, 7)
                          .map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleAddTag(sug, skills, setSkills, setSkillInput)}
                              className="bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs px-2 py-0.5 rounded-md border border-slate-200 transition-colors cursor-pointer"
                            >
                              + {sug}
                            </button>
                          ))}
                      </div>

                      {/* Active skills as flat neutral grey tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium border border-slate-200/60"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(skill, skills, setSkills)}
                              className="text-slate-400 hover:text-slate-700 border-0 bg-transparent p-0 cursor-pointer text-sm leading-none flex items-center justify-center transition-colors"
                              title="Xóa"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <Divider className="my-2" />

                    {/* Languages */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <TranslationOutlined /> Ngoại ngữ
                      </label>
                      <div className="flex gap-2">
                        <Input
                          size="small"
                          placeholder="VD: Tiếng Anh (TOEIC 850)"
                          value={languageInput}
                          onChange={(e) => setLanguageInput(e.target.value)}
                          onPressEnter={() =>
                            handleAddTag(languageInput, languages, setLanguages, setLanguageInput)
                          }
                          className="max-w-md"
                        />
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            handleAddTag(languageInput, languages, setLanguages, setLanguageInput)
                          }
                        >
                          Thêm
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {languages.map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium border border-slate-200/60"
                          >
                            <span>{lang}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(lang, languages, setLanguages)}
                              className="text-slate-400 hover:text-slate-700 border-0 bg-transparent p-0 cursor-pointer text-sm leading-none flex items-center justify-center transition-colors"
                              title="Xóa"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <Divider className="my-2" />

                    {/* Certificates */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <TrophyOutlined /> Chứng chỉ / Giải thưởng
                      </label>
                      <div className="flex gap-2">
                        <Input
                          size="small"
                          placeholder="VD: AWS Certified Solutions Architect"
                          value={certInput}
                          onChange={(e) => setCertInput(e.target.value)}
                          onPressEnter={() =>
                            handleAddTag(certInput, certificates, setCertificates, setCertInput)
                          }
                          className="max-w-md"
                        />
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            handleAddTag(certInput, certificates, setCertificates, setCertInput)
                          }
                        >
                          Thêm
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {certificates.map((cert) => (
                          <span
                            key={cert}
                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium border border-slate-200/60"
                          >
                            <span>{cert}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(cert, certificates, setCertificates)}
                              className="text-slate-400 hover:text-slate-700 border-0 bg-transparent p-0 cursor-pointer text-sm leading-none flex items-center justify-center transition-colors"
                              title="Xóa"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN (40%): LIVE A4 PREVIEW ── */}
                <div className="w-full lg:w-[42%] max-h-[66vh] overflow-y-auto bg-slate-100/80 p-4 rounded-xl border border-slate-200 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between pb-2.5 mb-2 border-0 border-b border-solid border-slate-200/80 text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <EyeOutlined className="text-blue-600" />
                      Live Preview (Khổ A4)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Mẫu: {preset === 'ats' ? 'ATS Standard' : preset === 'classic' ? 'Classic' : '1-Page Compact'}
                    </span>
                  </div>

                  {/* A4 Sheet Container */}
                  <div
                    className={`w-full bg-white shadow-md border border-slate-200/80 rounded-md p-6 text-slate-800 transition-all ${
                      preset === 'compact' ? 'text-[11px] leading-tight space-y-3' : 'text-xs leading-relaxed space-y-4'
                    }`}
                    style={{ minHeight: '520px' }}
                  >
                    {/* PRESET: CLASSIC HEADER */}
                    {preset === 'classic' ? (
                      <div className="text-center pb-3 border-b border-slate-300">
                        <h2 className="text-lg font-serif font-bold text-slate-900 tracking-wide uppercase m-0">
                          {fullName.trim() || 'HỌ VÀ TÊN ỨNG VIÊN'}
                        </h2>
                        {headline.trim() && (
                          <div className="text-xs text-slate-600 italic font-medium mt-1">
                            {headline}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 mt-2">
                          {email && <span>{email}</span>}
                          {email && phone && <span>•</span>}
                          {phone && <span>{phone}</span>}
                          {(email || phone) && address && <span>•</span>}
                          {address && <span>{address}</span>}
                        </div>
                      </div>
                    ) : preset === 'compact' ? (
                      /* PRESET: COMPACT HEADER */
                      <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                        <div>
                          <h2 className="text-base font-bold text-slate-900 m-0">
                            {fullName.trim() || 'Họ và tên ứng viên'}
                          </h2>
                          <div className="text-xs text-blue-700 font-medium">
                            {headline.trim() || 'Chức danh chuyên môn'}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                          {email && <div>{email}</div>}
                          {phone && <div>{phone}</div>}
                          {address && <div>{address}</div>}
                        </div>
                      </div>
                    ) : (
                      /* PRESET: ATS STANDARD HEADER */
                      <div className="pb-3 border-b-2 border-slate-800">
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight m-0 uppercase">
                          {fullName.trim() || 'Họ và tên ứng viên'}
                        </h2>
                        <div className="text-sm font-semibold text-slate-700 mt-0.5">
                          {headline.trim() || 'Chức danh nghề nghiệp'}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2 font-mono">
                          {email && <span>{email}</span>}
                          {email && phone && <span>|</span>}
                          {phone && <span>{phone}</span>}
                          {(email || phone) && address && <span>|</span>}
                          {address && <span>{address}</span>}
                        </div>
                      </div>
                    )}

                    {/* SUMMARY SECTION */}
                    {summary.trim() && (
                      <div>
                        <div
                          className={`font-bold text-slate-900 uppercase tracking-wider mb-1.5 ${
                            preset === 'ats'
                              ? 'text-xs border-b border-slate-300 pb-0.5'
                              : preset === 'classic'
                              ? 'text-xs text-center text-slate-800 font-serif border-b border-slate-200 pb-0.5'
                              : 'text-[11px] text-blue-700'
                          }`}
                        >
                          Tóm tắt chuyên môn
                        </div>
                        <p className="text-slate-700 m-0 text-justify text-[11px] leading-relaxed">
                          {summary}
                        </p>
                      </div>
                    )}

                    {/* EXPERIENCES SECTION */}
                    {experiences.some((e) => e.title.trim() || e.company.trim()) && (
                      <div>
                        <div
                          className={`font-bold text-slate-900 uppercase tracking-wider mb-2 ${
                            preset === 'ats'
                              ? 'text-xs border-b border-slate-300 pb-0.5'
                              : preset === 'classic'
                              ? 'text-xs text-center text-slate-800 font-serif border-b border-slate-200 pb-0.5'
                              : 'text-[11px] text-blue-700'
                          }`}
                        >
                          Kinh nghiệm làm việc
                        </div>
                        <div className="space-y-2.5">
                          {experiences
                            .filter((e) => e.title.trim() || e.company.trim())
                            .map((exp, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {exp.title || 'Chức danh'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {exp.startDate || 'Bắt đầu'} - {exp.endDate || 'Hiện tại'}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium text-slate-600 italic">
                                  {exp.company}
                                </div>
                                {exp.description && (
                                  <div className="text-[11px] text-slate-700 pl-3 border-l-2 border-slate-200 whitespace-pre-line">
                                    {exp.description}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* EDUCATIONS SECTION */}
                    {educations.some((e) => e.school.trim() || e.degree.trim()) && (
                      <div>
                        <div
                          className={`font-bold text-slate-900 uppercase tracking-wider mb-2 ${
                            preset === 'ats'
                              ? 'text-xs border-b border-slate-300 pb-0.5'
                              : preset === 'classic'
                              ? 'text-xs text-center text-slate-800 font-serif border-b border-slate-200 pb-0.5'
                              : 'text-[11px] text-blue-700'
                          }`}
                        >
                          Học vấn & Bằng cấp
                        </div>
                        <div className="space-y-2">
                          {educations
                            .filter((e) => e.school.trim() || e.degree.trim())
                            .map((edu, i) => (
                              <div key={i} className="flex items-baseline justify-between">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{edu.school}</div>
                                  <div className="text-[11px] text-slate-600">{edu.degree}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {edu.startDate} - {edu.endDate || 'Hiện tại'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* SKILLS SECTION */}
                    {skills.length > 0 && (
                      <div>
                        <div
                          className={`font-bold text-slate-900 uppercase tracking-wider mb-1.5 ${
                            preset === 'ats'
                              ? 'text-xs border-b border-slate-300 pb-0.5'
                              : preset === 'classic'
                              ? 'text-xs text-center text-slate-800 font-serif border-b border-slate-200 pb-0.5'
                              : 'text-[11px] text-blue-700'
                          }`}
                        >
                          Kỹ năng chuyên môn
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200/60"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LANGUAGES & CERTIFICATES */}
                    {(languages.length > 0 || certificates.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {languages.length > 0 && (
                          <div>
                            <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1">
                              Ngoại ngữ
                            </div>
                            <ul className="list-disc list-inside text-[11px] text-slate-700 m-0 p-0 space-y-0.5">
                              {languages.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {certificates.length > 0 && (
                          <div>
                            <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1">
                              Chứng chỉ
                            </div>
                            <ul className="list-disc list-inside text-[11px] text-slate-700 m-0 p-0 space-y-0.5">
                              {certificates.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── FOOTER ACTIONS ── */}
              <div className="flex items-center justify-between pt-3 border-0 border-t border-solid border-slate-200 mt-2">
                <div>
                  {mode === 'create' && (
                    <Button onClick={() => setStep('choose')}>&larr; Chọn lại phương thức</Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={onClose} disabled={saveMutation.isPending}>
                    Hủy bỏ
                  </Button>
                  <Button
                    type="primary"
                    loading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    className="!rounded-xl !bg-blue-600 hover:!bg-blue-700 !px-6 shadow-sm font-semibold"
                  >
                    {mode === 'edit' ? 'Lưu thay đổi' : 'Tạo và xuất bản CV'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default CandidateCvBuilderModal;
