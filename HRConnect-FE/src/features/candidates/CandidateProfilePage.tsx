import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Tag,
  Table,
  Upload,
  Modal,
  Avatar,
  Space,
  Popconfirm,
  message,
  Typography,
  Divider,
  Empty,
  Skeleton,
  Alert,
  Switch,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  DownloadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  CheckOutlined,
  MailOutlined,
  PhoneOutlined,
  EyeOutlined,
  GlobalOutlined,
  DollarOutlined,
  CalendarOutlined,
  CompassOutlined,
  LaptopOutlined,
  EditOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { mf04Api } from '@/services/api/mf04Api';
import type { UpdateCandidateProfileCommand, CandidateProfileData } from '@/types/api/mf04';
import { candidateService, type CandidateSkillItemDto } from '@/services/candidateService';
import { getApiErrorMessage } from '@/services/apiClient';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import type { UploadProps } from 'antd';

export interface CandidateCV {
  id: string;
  userEmail?: string;
  name: string;
  updatedAt: string;
  size: string;
  isDefault: boolean;
  atsScore: number;
  type: 'Platform Builder' | 'Template ATS' | 'File Upload';
  fileUrl?: string;
  previewUrl?: string;
}

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 4 Mẫu CV ATS Tiêu Chuẩn (Hỗ trợ trình soạn thảo offline/preview)
interface AtsTemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  score: number;
  previewBg: string;
}

const ATS_TEMPLATES: AtsTemplateItem[] = [
  {
    id: 'tpl-tech',
    name: 'Công nghệ hiện đại (Tech Modern ATS)',
    category: 'IT & Software',
    description: 'Tối ưu hóa mật độ từ khóa kỹ năng (ReactJS, Microservices, Cloud). Bố cục 2 cột thông minh vượt qua bộ lọc tự động.',
    score: 96,
    previewBg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
  },
  {
    id: 'tpl-exec',
    name: 'Quản lý cấp cao (Executive Leadership)',
    category: 'Leadership & Management',
    description: 'Nhấn mạnh thành tựu kinh doanh, quy mô đội ngũ (Team Size 20+) và chỉ số ROI. Phù hợp vị trí Tech Lead, Director, CTO.',
    score: 94,
    previewBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  {
    id: 'tpl-creative',
    name: 'Sáng tạo (Creative Product & Design)',
    category: 'UI/UX & Product',
    description: 'Trình bày nổi bật Portfolio, liên kết Figma/Behance và các dự án thiết kế trải nghiệm người dùng đoạt giải thưởng.',
    score: 91,
    previewBg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  },
  {
    id: 'tpl-minimal',
    name: 'Tối giản (Minimalist Harvard Format)',
    category: 'Tiêu chuẩn quốc tế',
    description: 'Định dạng 1 cột thuần đen trắng chuẩn Đại học Harvard. Tương thích 100% với mọi hệ thống ATS cổ điển và hiện đại.',
    score: 98,
    previewBg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
  },
];

export const CandidateProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabKey = searchParams.get('tab') || 'career-info';

  const { user, updateUser } = useAuthStore();
  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const [localCvs, setLocalCvs] = useState<CandidateCV[]>([]);

  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // Load Candidate Profile directly from Database API (Single Source of Truth)
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['candidate', 'profile'],
    queryFn: () => mf04Api.getProfile(),
  });

  // Local state for skills tags
  // Local state for skills tags
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [showSkillInput, setShowSkillInput] = useState(false);

  // Local state for immediate Visibility Switch responsiveness
  const [isPublicState, setIsPublicState] = useState<boolean | null>(null);
  const isPublic = isPublicState !== null
    ? isPublicState
    : (profile?.profileVisibility || 'PRIVATE').toUpperCase() === 'PUBLIC';

  // Visibility toggle mutation
  const visibilityMutation = useMutation({
    mutationFn: (newVisibility: 'PUBLIC' | 'PRIVATE') =>
      mf04Api.updateVisibility({ visibility: newVisibility }),
    onSuccess: (_, newVisibility) => {
      setIsPublicState(newVisibility === 'PUBLIC');
      message.success(
        newVisibility === 'PUBLIC'
          ? 'Hồ sơ đã chuyển sang chế độ Công khai (Nhà tuyển dụng có thể tìm kiếm bạn).'
          : 'Hồ sơ đã chuyển sang chế độ Riêng tư (Ẩn khỏi tìm kiếm của Nhà tuyển dụng).'
      );
      queryClient.invalidateQueries({ queryKey: ['candidate', 'profile'] });
    },
    onError: (err: any) => {
      setIsPublicState((profile?.profileVisibility || 'PRIVATE').toUpperCase() === 'PUBLIC');
      message.error(err?.response?.data?.message || err?.message || 'Không thể cập nhật chế độ hiển thị');
    },
  });

  // Update profile mutation (saves to DB API)
  const updateProfileMutation = useMutation({
    mutationFn: (command: UpdateCandidateProfileCommand) => mf04Api.updateProfile(command),
    onSuccess: (updatedData) => {
      message.success('Cập nhật hồ sơ nghề nghiệp thành công!');
      queryClient.invalidateQueries({ queryKey: ['candidate', 'profile'] });
      if (updatedData.fullName && updateUser) {
        updateUser({ name: updatedData.fullName });
      }
    },
    onError: (err: any) => {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra khi lưu thông tin hồ sơ. Vui lòng kiểm tra lại!';
      message.error(errMsg);
    },
  });

  // Compute formInitialValues from DB profile
  const formInitialValues = useMemo(() => {
    if (!profile) return undefined;
    const locs = profile.preferredLocations
      ? (Array.isArray(profile.preferredLocations)
        ? profile.preferredLocations
        : typeof profile.preferredLocations === 'string'
          ? (profile.preferredLocations as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [])
      : [];

    const modes = profile.preferredWorkModes
      ? (Array.isArray(profile.preferredWorkModes)
        ? profile.preferredWorkModes
        : typeof profile.preferredWorkModes === 'string'
          ? (profile.preferredWorkModes as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [])
      : [];

    return {
      fullName: profile.fullName || user?.name || '',
      email: profile.email || user?.email || '',
      phone: profile.phone || user?.phone || '',
      currentAddress: profile.currentAddress || '',
      highestEducation: profile.highestEducation || '',
      yearsOfExperience: profile.yearsOfExperience ?? 0,
      summary: profile.summary || '',
      // 9 Career Fields
      currentJobTitle: profile.currentJobTitle || '',
      currentLevel: profile.currentLevel || 'Mid-Level',
      targetRole: profile.targetRole || '',
      expectedSalaryMin: profile.expectedSalaryMin || null,
      expectedSalaryMax: profile.expectedSalaryMax || null,
      expectedSalaryCurrency: profile.expectedSalaryCurrency || 'VND',
      availableFrom: profile.availableFrom || '',
      preferredLocations: locs,
      preferredWorkModes: modes,
    };
  }, [profile, user?.name, user?.email, user?.phone]);

  // Sync profile data from DB into Form when query resolves
  useEffect(() => {
    if (profile) {
      if (profile.profileVisibility) {
        setIsPublicState(profile.profileVisibility.toUpperCase() === 'PUBLIC');
      }

      if (formInitialValues) {
        form.setFieldsValue(formInitialValues);
      }

      // Extract skills list
      if (profile.skills && profile.skills.length > 0) {
        const nextSkills = profile.skills
          .map((s) => s.skillName || '')
          .filter(Boolean);
        setSkillsList((prev) => {
          if (prev.length === nextSkills.length && prev.every((v, i) => v === nextSkills[i])) {
            return prev;
          }
          return nextSkills;
        });
      }
    }
  }, [profile, formInitialValues, form]);

  // Dedicated Skills Management (from backend /skills & /candidates/profile/me/skills)
  const [catalogSkills, setCatalogSkills] = useState<Array<{ skillId: string; skillName: string; category?: string | null }>>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<CandidateSkillItemDto | null>(null);
  const [skillModalForm] = Form.useForm();
  const [isSavingSkill, setIsSavingSkill] = useState(false);

  const fetchCatalogSkills = async (search?: string) => {
    setLoadingCatalog(true);
    try {
      const res = await candidateService.getCatalogSkills({ search, pageSize: 100 });
      const items = res?.data?.items || res?.items || res?.data || [];
      setCatalogSkills(items);
    } catch (err) {
      console.error('Failed to load skills catalog', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleOpenAddSkill = () => {
    setEditingSkill(null);
    skillModalForm.resetFields();
    skillModalForm.setFieldsValue({ proficiencyLevel: 'INTERMEDIATE', yearsOfExperience: 1 });
    setIsSkillModalOpen(true);
    void fetchCatalogSkills();
  };

  const handleOpenEditSkill = (skill: CandidateSkillItemDto) => {
    setEditingSkill(skill);
    skillModalForm.setFieldsValue({
      skillId: skill.skillId,
      proficiencyLevel: skill.proficiencyLevel || 'INTERMEDIATE',
      yearsOfExperience: skill.yearsOfExperience || 1,
    });
    setIsSkillModalOpen(true);
  };

  const handleSaveSkillSubmit = async () => {
    try {
      const values = await skillModalForm.validateFields();
      setIsSavingSkill(true);
      if (editingSkill?.skillId) {
        await candidateService.updateSkill(editingSkill.skillId, {
          proficiencyLevel: values.proficiencyLevel,
          yearsOfExperience: values.yearsOfExperience != null ? Number(values.yearsOfExperience) : undefined,
        });
        message.success('Đã cập nhật kỹ năng thành công!');
      } else {
        await candidateService.addSkill({
          skillId: values.skillId,
          proficiencyLevel: values.proficiencyLevel,
          yearsOfExperience: values.yearsOfExperience != null ? Number(values.yearsOfExperience) : undefined,
        });
        message.success('Đã thêm kỹ năng vào hồ sơ thành công!');
      }
      setIsSkillModalOpen(false);
      skillModalForm.resetFields();
      setEditingSkill(null);
      await refetch();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể lưu kỹ năng.'));
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleRemoveSkillApi = async (skillId?: string) => {
    if (!skillId) return;
    try {
      await candidateService.removeSkill(skillId);
      message.success('Đã xóa kỹ năng khỏi hồ sơ.');
      await refetch();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể xóa kỹ năng.'));
    }
  };

  // Modal 1: Platform Builder Form
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const [builderForm] = Form.useForm();

  // Modal 2: Template Selection Preview
  const [selectedTemplate, setSelectedTemplate] = useState<AtsTemplateItem | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Modal 3: File Upload
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Only display CVs created or uploaded by current user
  const myCvs = React.useMemo(() => {
    if (!currentUserEmail) return localCvs;
    return localCvs.filter((c) => !c.userEmail || c.userEmail.toLowerCase().trim() === currentUserEmail);
  }, [currentUserEmail, localCvs]);

  const addCV = (newCv: CandidateCV) => setLocalCvs((prev) => [newCv, ...prev]);
  const setDefaultCV = (id: string) =>
    setLocalCvs((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  const deleteCV = (id: string) => setLocalCvs((prev) => prev.filter((c) => c.id !== id));

  /** Returns initials: first char of first word + first char of last word */
  const getInitials = (name?: string): string => {
    if (!name) return 'UV';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Submit Handler: Saves directly to Database API
  const handleSaveProfile = async (values: any) => {
    const locsString = Array.isArray(values.preferredLocations)
      ? (values.preferredLocations.length > 0 ? values.preferredLocations.join(', ') : null)
      : (typeof values.preferredLocations === 'string' && values.preferredLocations.trim() ? values.preferredLocations.trim() : null);

    const modesString = Array.isArray(values.preferredWorkModes)
      ? (values.preferredWorkModes.length > 0 ? values.preferredWorkModes.join(', ') : null)
      : (typeof values.preferredWorkModes === 'string' && values.preferredWorkModes.trim() ? values.preferredWorkModes.trim() : null);

    const command: UpdateCandidateProfileCommand = {
      fullName: (values.fullName || user?.name || '').trim(),
      phone: (values.phone || user?.phone || '').trim() || null,
      dateOfBirth: values.dateOfBirth || profile?.dateOfBirth || null,
      gender: values.gender || profile?.gender || null,
      currentAddress: (values.currentAddress || '').trim() || null,
      highestEducation: values.highestEducation || null,
      yearsOfExperience:
        typeof values.yearsOfExperience === 'number'
          ? values.yearsOfExperience
          : parseFloat(values.yearsOfExperience) || 0,
      summary: (values.summary || '').trim() || null,
      // 9 Career Fields
      currentJobTitle: (values.currentJobTitle || '').trim() || null,
      currentLevel: values.currentLevel || null,
      targetRole: (values.targetRole || '').trim() || null,
      expectedSalaryMin: values.expectedSalaryMin != null && values.expectedSalaryMin !== '' ? Number(values.expectedSalaryMin) : null,
      expectedSalaryMax: values.expectedSalaryMax != null && values.expectedSalaryMax !== '' ? Number(values.expectedSalaryMax) : null,
      expectedSalaryCurrency: values.expectedSalaryCurrency || 'VND',
      availableFrom: values.availableFrom || null,
      preferredLocations: locsString as any,
      preferredWorkModes: modesString as any,
    };

    updateProfileMutation.mutate(command);
  };

  // Add / Remove Skill
  const handleAddSkill = () => {
    if (newSkillInput.trim() && !skillsList.includes(newSkillInput.trim())) {
      setSkillsList([...skillsList, newSkillInput.trim()]);
    }
    setNewSkillInput('');
    setShowSkillInput(false);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkillsList(skillsList.filter((s) => s !== skillToRemove));
  };

  // Handle Save Online Builder CV
  const handleSaveOnlineCv = async () => {
    try {
      const values = await builderForm.validateFields();
      const newCv: CandidateCV = {
        id: `cv-builder-${Date.now()}`,
        name: `CV ${values.roleTarget || profile?.targetRole || 'Chuyên viên'} (Online ATS)`,
        updatedAt: 'Hôm nay',
        size: '1.9 MB',
        isDefault: myCvs.length === 0,
        atsScore: 95,
        type: 'Platform Builder',
        userEmail: currentUserEmail,
      };
      addCV(newCv);
      setIsBuilderModalOpen(false);
      builderForm.resetFields();
      message.success(`Đã xuất bản CV trực tuyến "${newCv.name}" với điểm chuẩn ATS 95/100!`);
    } catch {
      // validation error
    }
  };

  // Handle Select ATS Template
  const handleConfirmTemplate = () => {
    if (!selectedTemplate) return;
    const newCv: CandidateCV = {
      id: `cv-tpl-${Date.now()}`,
      name: `CV ${profile?.targetRole || 'Chuyên viên'} (${selectedTemplate.name})`,
      updatedAt: 'Hôm nay',
      size: '2.1 MB',
      isDefault: myCvs.length === 0,
      atsScore: selectedTemplate.score,
      type: 'Template ATS',
      userEmail: currentUserEmail,
    };
    addCV(newCv);
    setIsTemplateModalOpen(false);
    message.success(`Đã tạo hồ sơ từ mẫu "${selectedTemplate.name}" thành công!`);
  };

  // File Upload Config (Max 5MB)
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isLt5M = file.size / 1024 / 1024 <= 5;
      if (!isLt5M) {
        message.error('Dung lượng tệp CV không được vượt quá 5MB!');
        return false;
      }
      const newCv: CandidateCV = {
        id: `cv-upload-${Date.now()}`,
        name: file.name,
        updatedAt: 'Hôm nay',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        isDefault: myCvs.length === 0,
        atsScore: 93,
        type: 'File Upload',
        userEmail: currentUserEmail,
      };
      addCV(newCv);
      setIsUploadModalOpen(false);
      message.success(`Đã tải lên tệp "${file.name}" thành công!`);
      return false;
    },
  };

  // Formatted salary string
  const formatSalaryDisplay = () => {
    if (profile?.expectedSalaryMin && profile?.expectedSalaryMax) {
      const min = profile.expectedSalaryMin.toLocaleString('vi-VN');
      const max = profile.expectedSalaryMax.toLocaleString('vi-VN');
      return `${min} - ${max} ${profile.expectedSalaryCurrency || 'VND'}`;
    }
    if (profile?.expectedSalaryMin) {
      return `Từ ${profile.expectedSalaryMin.toLocaleString('vi-VN')} ${profile.expectedSalaryCurrency || 'VND'}`;
    }
    return 'Thương lượng';
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 16px' }}>
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 16px' }}>
        <Alert
          type="error"
          showIcon
          message="Không thể tải hồ sơ ứng viên"
          description={error instanceof Error ? error.message : 'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.'}
          action={
            <Button type="primary" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="candidate-page candidate-profile-page" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header Profile Summary — Modern Dark Hero */}
      <div
        className="candidate-profile-hero"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0B0F17 0%, #111827 50%, #1e293b 100%)',
          border: '1px solid rgba(51, 65, 85, 0.7)',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
          padding: '28px 32px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow decoration */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <Row align="middle" justify="space-between" gutter={[24, 20]}>
          <Col xs={24} md={16} style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <AvatarUpload size={84} />
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isPublic ? '#10b981' : '#f59e0b',
                  border: '2px solid #0B0F17',
                }}
                title={isPublic ? 'Hồ sơ Công khai' : 'Hồ sơ Riêng tư'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {profile?.fullName || user?.name || 'Ứng viên'}
                </h1>
                <Tag
                  color="blue"
                  style={{
                    borderRadius: 9999,
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#93c5fd',
                  }}
                >
                  {profile?.currentLevel || 'Chuyên viên'}
                </Tag>
              </div>

              <div
                style={{
                  color: '#38bdf8',
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>{profile?.currentJobTitle || profile?.targetRole || 'Chưa cập nhật chức danh'}</span>
                {profile?.yearsOfExperience ? (
                  <>
                    <span style={{ color: '#475569' }}>•</span>
                    <span style={{ color: '#94a3b8' }}>{profile.yearsOfExperience} năm kinh nghiệm</span>
                  </>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(51, 65, 85, 0.8)',
                    borderRadius: 9999,
                    padding: '4px 12px',
                    fontSize: 12,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MailOutlined style={{ color: '#60a5fa' }} />
                  <span style={{ color: '#e2e8f0' }}>{profile?.email || user?.email || 'Chưa có email'}</span>
                </div>
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(51, 65, 85, 0.8)',
                    borderRadius: 9999,
                    padding: '4px 12px',
                    fontSize: 12,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <PhoneOutlined style={{ color: '#34d399' }} />
                  <span style={{ color: '#e2e8f0' }}>{profile?.phone || user?.phone || 'Chưa có số điện thoại'}</span>
                </div>
              </div>
            </div>
          </Col>

          {/* Metric & Visibility Box */}
          <Col xs={24} md={8} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                backdropFilter: 'blur(12px)',
                borderRadius: 16,
                padding: '16px 22px',
                minWidth: 220,
                textAlign: 'right',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Mức lương
                </span>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                    color: '#94a3b8',
                  }}
                >
                  Kỳ vọng / Tháng
                </span>
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#34d399',
                  lineHeight: 1.2,
                }}
              >
                {formatSalaryDisplay()}
              </div>
            </div>

            {/* Visibility Toggle */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                borderRadius: 12,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <GlobalOutlined style={{ color: isPublic ? '#10b981' : '#94a3b8' }} />
              <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>
                {isPublic ? 'Công khai hồ sơ' : 'Ẩn hồ sơ (Riêng tư)'}
              </span>
              <Switch
                checked={isPublic}
                loading={visibilityMutation.isPending}
                onChange={(checked) => visibilityMutation.mutate(checked ? 'PUBLIC' : 'PRIVATE')}
                size="small"
              />
            </div>
          </Col>
        </Row>
      </div>

      {/* Main Tabs Container */}
      <Card
        className="candidate-profile-tabs"
        bordered={false}
        style={{
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={(key) => setSearchParams({ tab: key })}
          size="large"
          items={[
            // ==================== TAB 1 ====================
            {
              key: 'career-info',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <UserOutlined />
                  Thông tin cá nhân &amp; Nghề nghiệp (MF-04 DB)
                </span>
              ),
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Form
                    form={form}
                    initialValues={formInitialValues}
                    layout="vertical"
                    onFinish={handleSaveProfile}
                    onFinishFailed={({ errorFields }) => {
                      const firstError = errorFields?.[0]?.errors?.[0];
                      message.error(firstError || 'Vui lòng kiểm tra lại các trường thông tin bắt buộc!');
                    }}
                    requiredMark="optional"
                  >
                    {/* Nhóm 1: Thông tin định danh & Liên hệ */}
                    <div style={{ marginBottom: 28 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          color: '#0f172a',
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          1
                        </span>
                        Thông tin liên hệ &amp; Định danh cá nhân
                      </div>
                      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 16 }}>
                        Email đăng nhập là cố định. Để liên kết các email ứng tuyển phụ, vui lòng truy cập trang Quản lý danh tính MF-02.
                      </Text>

                      <Row gutter={[20, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="fullName"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Họ và tên <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập họ và tên của bạn' }]}
                          >
                            <Input size="large" placeholder="VD: Nguyễn Văn A" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="email"
                            label={
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                                  Địa chỉ Email (Đăng nhập)
                                  <Tooltip title="Email tài khoản được bảo mật và cố định. Để dùng email khác khi nộp đơn, hãy thêm ở Quản lý danh tính MF-02.">
                                    <MailOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                                  </Tooltip>
                                </span>
                                <Link
                                  to="/candidate/settings/email-identities"
                                  style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}
                                >
                                  Quản lý danh tính MF-02 →
                                </Link>
                              </div>
                            }
                          >
                            <Input
                              size="large"
                              disabled
                              style={{ borderRadius: 12, background: '#f8fafc', color: '#64748b' }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="phone"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số điện thoại liên hệ</span>}
                            rules={[
                              { pattern: /^[0-9+() -]{8,15}$/, message: 'Số điện thoại không hợp lệ (8 - 15 chữ số)' },
                            ]}
                          >
                            <Input size="large" placeholder="VD: 0912 345 678" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="currentAddress"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa chỉ hiện tại</span>}
                          >
                            <Input size="large" placeholder="VD: Quận Cầu Giấy, Hà Nội" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="highestEducation"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Trình độ học vấn cao nhất</span>}
                          >
                            <Select size="large" placeholder="Chọn học vấn" style={{ borderRadius: 12 }}>
                              <Option value="Đại học">Đại học</Option>
                              <Option value="Thạc sĩ">Thạc sĩ</Option>
                              <Option value="Tiến sĩ">Tiến sĩ</Option>
                              <Option value="Cao đẳng">Cao đẳng</Option>
                              <Option value="Khác">Khác</Option>
                            </Select>
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="yearsOfExperience"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số năm kinh nghiệm tích lũy</span>}
                          >
                            <InputNumber
                              size="large"
                              min={0}
                              max={50}
                              step={0.5}
                              style={{ width: '100%', borderRadius: 12 }}
                              placeholder="VD: 3 hoặc 5.5"
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <Divider style={{ margin: '8px 0 28px' }} />

                    {/* Nhóm 2: 9 Trường nghề nghiệp MF-04 */}
                    <div style={{ marginBottom: 28 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          color: '#0f172a',
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          2
                        </span>
                        Định hướng nghề nghiệp &amp; Dải đãi ngộ (9 Trường MF-04)
                      </div>
                      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 16 }}>
                        Dữ liệu lưu trực tiếp vào Database, hỗ trợ AI và Nhà tuyển dụng lọc đúng ứng viên tiềm năng.
                      </Text>

                      <Row gutter={[20, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="currentJobTitle"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chức danh hiện tại</span>}
                          >
                            <Input size="large" placeholder="VD: Senior React Developer" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="currentLevel"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Cấp bậc chuyên môn</span>}
                          >
                            <Select size="large" style={{ borderRadius: 12 }}>
                              <Option value="Intern">Intern / Thực tập sinh</Option>
                              <Option value="Fresher">Fresher (Dưới 1 năm)</Option>
                              <Option value="Junior">Junior (1 - 2 năm)</Option>
                              <Option value="Mid-Level">Mid-Level (2 - 4 năm)</Option>
                              <Option value="Senior">Senior (5+ năm)</Option>
                              <Option value="Lead">Team Lead / Tech Lead</Option>
                              <Option value="Manager">Engineering Manager / Quản lý</Option>
                              <Option value="Director">Director / Giám đốc</Option>
                            </Select>
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="targetRole"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Vị trí mục tiêu mong muốn</span>}
                          >
                            <Input size="large" placeholder="VD: Frontend Lead / Solution Architect" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="availableFrom"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Ngày có thể nhận việc</span>}
                          >
                            <Input
                              type="date"
                              size="large"
                              min={new Date().toISOString().split('T')[0]}
                              style={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                            />
                          </Form.Item>
                        </Col>

                        {/* Salary Range */}
                        <Col xs={24} md={8}>
                          <Form.Item
                            name="expectedSalaryMin"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Lương tối thiểu</span>}
                          >
                            <InputNumber
                              size="large"
                              min={0}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                              style={{ width: '100%', borderRadius: 12 }}
                              placeholder="VD: 25,000,000"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item
                            name="expectedSalaryMax"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Lương tối đa</span>}
                            dependencies={['expectedSalaryMin']}
                            rules={[
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const min = getFieldValue('expectedSalaryMin');
                                  if (min != null && value != null && value < min) {
                                    return Promise.reject(new Error('Mức lương tối đa phải lớn hơn hoặc bằng mức lương tối thiểu'));
                                  }
                                  return Promise.resolve();
                                },
                              }),
                            ]}
                          >
                            <InputNumber
                              size="large"
                              min={0}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                              style={{ width: '100%', borderRadius: 12 }}
                              placeholder="VD: 45,000,000"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item
                            name="expectedSalaryCurrency"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Loại tiền tệ</span>}
                          >
                            <Select size="large" style={{ borderRadius: 12 }}>
                              <Option value="VND">VND (Việt Nam Đồng)</Option>
                              <Option value="USD">USD (Đô la Mỹ)</Option>
                            </Select>
                          </Form.Item>
                        </Col>

                        {/* Preferred Locations */}
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="preferredLocations"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa điểm làm việc ưu tiên</span>}
                          >
                            <Select
                              mode="tags"
                              size="large"
                              placeholder="Chọn hoặc nhập địa điểm (VD: Hà Nội, TP.HCM, Remote)"
                              style={{ borderRadius: 12 }}
                            >
                              <Option value="Hà Nội">Hà Nội</Option>
                              <Option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</Option>
                              <Option value="Đà Nẵng">Đà Nẵng</Option>
                              <Option value="Cần Thơ">Cần Thơ</Option>
                              <Option value="Remote">Làm việc từ xa (Remote)</Option>
                              <Option value="Toàn quốc">Toàn quốc</Option>
                            </Select>
                          </Form.Item>
                        </Col>

                        {/* Preferred Work Modes */}
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="preferredWorkModes"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chế độ làm việc mong muốn</span>}
                          >
                            <Select
                              mode="multiple"
                              size="large"
                              placeholder="Chọn hình thức làm việc"
                              style={{ borderRadius: 12 }}
                            >
                              <Option value="ONSITE">Tại văn phòng (Onsite)</Option>
                              <Option value="HYBRID">Linh hoạt kết hợp (Hybrid)</Option>
                              <Option value="REMOTE">Làm việc từ xa (Remote)</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <Divider style={{ margin: '8px 0 28px' }} />

                    {/* Nhóm 3: Kỹ năng chuyên môn & Giới thiệu */}
                    <div style={{ marginBottom: 28 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          color: '#0f172a',
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#00b14f',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          3
                        </span>
                        Kỹ năng chuyên môn & Giới thiệu bản thân
                      </div>
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                        Khai báo kỹ năng từ danh mục hệ thống giúp thuật toán AI so khớp hồ sơ đạt điểm cao nhất.
                      </p>

                      <Row gutter={[20, 16]}>
                        <Col xs={24}>
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                                Danh sách Kỹ năng chuyên môn (Đồng bộ Backend API)
                              </span>
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleOpenAddSkill}
                                style={{ borderRadius: 8, fontWeight: 600, background: '#2563eb' }}
                              >
                                + Thêm kỹ năng từ danh mục
                              </Button>
                            </div>

                            {/* Render API Skills List */}
                            {profile?.skills && profile.skills.length > 0 ? (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
                                {profile.skills.map((skill) => {
                                  const levelConfig: Record<string, { label: string; color: string }> = {
                                    BEGINNER: { label: 'Mới bắt đầu', color: 'cyan' },
                                    INTERMEDIATE: { label: 'Trung cấp', color: 'blue' },
                                    ADVANCED: { label: 'Thành thạo', color: 'purple' },
                                    EXPERT: { label: 'Chuyên gia', color: 'gold' },
                                  };
                                  const lvl = levelConfig[skill.proficiencyLevel?.toUpperCase() || ''] || { label: skill.proficiencyLevel || 'Cơ bản', color: 'default' };

                                  return (
                                    <div
                                      key={skill.skillId || skill.skillName}
                                      style={{
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        padding: '12px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                      }}
                                    >
                                      <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                                        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span className="truncate">{skill.skillName || 'Kỹ năng'}</span>
                                          {skill.category && (
                                            <Tag style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, margin: 0 }}>
                                              {skill.category}
                                            </Tag>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                          <Tag color={lvl.color} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 9999, margin: 0, fontWeight: 600 }}>
                                            {lvl.label}
                                          </Tag>
                                          {skill.yearsOfExperience != null && (
                                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                              {skill.yearsOfExperience} năm KN
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Button
                                          size="small"
                                          type="text"
                                          icon={<EditOutlined style={{ color: '#0284c7' }} />}
                                          onClick={() => handleOpenEditSkill(skill)}
                                          title="Chỉnh sửa kỹ năng"
                                        />
                                        <Popconfirm
                                          title="Xóa kỹ năng này?"
                                          description={`Xóa "${skill.skillName}" khỏi hồ sơ của bạn?`}
                                          okText="Xóa"
                                          okButtonProps={{ danger: true }}
                                          cancelText="Hủy"
                                          onConfirm={() => handleRemoveSkillApi(skill.skillId)}
                                        >
                                          <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            title="Xóa kỹ năng"
                                          />
                                        </Popconfirm>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1', textAlign: 'center', marginBottom: 16 }}>
                                <Text style={{ color: '#64748b', fontSize: 13 }}>
                                  Chưa có kỹ năng chuyên môn nào được lưu trong cơ sở dữ liệu. Bấm "Thêm kỹ năng từ danh mục" để bổ sung.
                                </Text>
                              </div>
                            )}

                            {/* Quick custom skill tags */}
                            <div style={{ marginTop: 10 }}>
                              <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                Từ khóa bổ sung nhanh (Keyword Tags):
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {skillsList.map((skill) => (
                                  <Tag
                                    key={skill}
                                    closable
                                    onClose={() => handleRemoveSkill(skill)}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: 12,
                                      borderRadius: 9999,
                                      background: 'rgba(59, 130, 246, 0.08)',
                                      color: '#1e40af',
                                      border: '1px solid rgba(59, 130, 246, 0.25)',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {skill}
                                  </Tag>
                                ))}

                                {showSkillInput ? (
                                  <Input
                                    size="small"
                                    style={{ width: 140, borderRadius: 8 }}
                                    value={newSkillInput}
                                    onChange={(e) => setNewSkillInput(e.target.value)}
                                    onBlur={handleAddSkill}
                                    onPressEnter={handleAddSkill}
                                    autoFocus
                                    placeholder="Nhập từ khóa..."
                                  />
                                ) : (
                                  <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => setShowSkillInput(true)}
                                    style={{
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      border: '1px dashed #94a3b8',
                                      color: '#2563eb',
                                    }}
                                  >
                                    + Nhập nhanh
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Col>

                        <Col xs={24}>
                          <Form.Item
                            name="summary"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tóm tắt kinh nghiệm &amp; Mục tiêu nghề nghiệp</span>}
                          >
                            <Input.TextArea
                              rows={4}
                              placeholder="Mô tả ngắn gọn kinh nghiệm, thế mạnh và định hướng phát triển sự nghiệp..."
                              style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <div style={{ paddingTop: 8 }}>
                      <Button
                        type="primary"
                        size="large"
                        htmlType="submit"
                        loading={updateProfileMutation.isPending}
                        style={{
                          borderRadius: 9999,
                          fontWeight: 700,
                          fontSize: 15,
                          background: '#2563eb',
                          borderColor: '#2563eb',
                          height: 46,
                          padding: '0 36px',
                          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.24)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                      >
                        Lưu thông tin hồ sơ vào Database
                      </Button>
                    </div>
                  </Form>
                </div>
              ),
            },

            // ==================== TAB 2 ====================
            {
              key: 'cv-center',
              forceRender: true,
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileTextOutlined />
                  Kho CV &amp; Công cụ soạn thảo
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {/* Primary CV Card from DB */}
                  <Card
                    style={{
                      borderRadius: 16,
                      border: '1.5px solid #bfdbfe',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                      marginBottom: 24,
                    }}
                  >
                    <Row align="middle" justify="space-between" gutter={[16, 16]}>
                      <Col xs={24} md={16}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <SafetyCertificateOutlined style={{ fontSize: 28, color: '#2563eb' }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#1e3a8a' }}>
                              Bản CV mặc định trên hệ thống
                            </div>
                            <Text style={{ fontSize: 13, color: '#475569' }}>
                              {profile?.primaryCv?.title || profile?.primaryCv?.fileName || 'Chưa thiết lập CV mặc định'}
                            </Text>
                          </div>
                        </div>
                      </Col>
                      <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                        <Button
                          type="primary"
                          onClick={() => navigate('/candidate/cvs')}
                          style={{ borderRadius: 8, fontWeight: 600 }}
                        >
                          Quản lý kho CV MF-02 →
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* 3 Action blocks */}
                  <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                    {/* Mode 1: Platform Builder */}
                    <Col xs={24} md={8}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: 14,
                          border: '1.5px solid #e2e8f0',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                        styles={{ body: { padding: '24px' } }}
                      >
                        <div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <ThunderboltOutlined style={{ fontSize: 22, color: '#8b5cf6' }} />
                          </div>
                          <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, marginBottom: 8 }}>
                            Chế độ 1
                          </Tag>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
                            Tạo hồ sơ trực tuyến (Platform Builder)
                          </div>
                          <Paragraph style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                            Điền chi tiết từng đề mục: Học vấn, Kinh nghiệm làm việc, Dự án nổi bật và Chứng chỉ. AI tự động tối ưu hóa điểm chuẩn ATS.
                          </Paragraph>
                        </div>
                        <Button
                          type="primary"
                          block
                          icon={<ThunderboltOutlined />}
                          onClick={() => setIsBuilderModalOpen(true)}
                          style={{
                            borderRadius: 8,
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            border: 'none',
                            marginTop: 12,
                          }}
                        >
                          Soạn CV trực tuyến
                        </Button>
                      </Card>
                    </Col>

                    {/* Mode 2: Template-Based */}
                    <Col xs={24} md={8}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: 14,
                          border: '1.5px solid #e2e8f0',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                        styles={{ body: { padding: '24px' } }}
                      >
                        <div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <AppstoreOutlined style={{ fontSize: 22, color: '#0284c7' }} />
                          </div>
                          <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, marginBottom: 8 }}>
                            Chế độ 2
                          </Tag>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
                            Mẫu CV tiêu chuẩn (Template-Based)
                          </div>
                          <Paragraph style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                            Xem trước và lựa chọn 4 mẫu chuẩn hóa quốc tế: Công nghệ hiện đại, Quản lý cấp cao, Sáng tạo, Tối giản Harvard.
                          </Paragraph>
                        </div>
                        <Button
                          block
                          icon={<AppstoreOutlined />}
                          onClick={() => {
                            setSelectedTemplate(ATS_TEMPLATES[0]);
                            setIsTemplateModalOpen(true);
                          }}
                          style={{
                            borderRadius: 8,
                            fontWeight: 700,
                            borderColor: '#0284c7',
                            color: '#0284c7',
                            marginTop: 12,
                          }}
                        >
                          Chọn 4 mẫu ATS
                        </Button>
                      </Card>
                    </Col>

                    {/* Mode 3: File Upload */}
                    <Col xs={24} md={8}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: 14,
                          border: '1.5px solid #e2e8f0',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                        styles={{ body: { padding: '24px' } }}
                      >
                        <div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <UploadOutlined style={{ fontSize: 22, color: '#2563eb' }} />
                          </div>
                          <Tag color="green" style={{ borderRadius: 6, fontWeight: 700, marginBottom: 8 }}>
                            Chế độ 3
                          </Tag>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
                            Tải tệp CV lên (File Upload)
                          </div>
                          <Paragraph style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                            Drag &amp; Drop tệp CV sẵn có từ máy tính (hỗ trợ định dạng PDF, DOCX dung lượng tối đa 5MB).
                          </Paragraph>
                        </div>
                        <Button
                          block
                          icon={<UploadOutlined />}
                          onClick={() => setIsUploadModalOpen(true)}
                          style={{
                            borderRadius: 8,
                            fontWeight: 700,
                            borderColor: '#2563eb',
                            color: '#2563eb',
                            marginTop: 12,
                          }}
                        >
                          Tải lên PDF/DOCX (5MB)
                        </Button>
                      </Card>
                    </Col>
                  </Row>

                  {/* CV Table */}
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Title level={5} style={{ margin: 0, fontWeight: 800 }}>
                        Danh sách hồ sơ CV đã tạo ({myCvs.length})
                      </Title>
                    </div>

                    {myCvs.length === 0 ? (
                      <Empty
                        description="Bạn chưa tạo hoặc tải lên bản CV nào. Hãy sử dụng một trong các chế độ tạo CV ở trên!"
                        style={{ padding: '36px 0' }}
                      />
                    ) : (
                      <Table
                        dataSource={myCvs}
                        rowKey="id"
                        pagination={false}
                        columns={[
                          {
                            title: 'Tên bản CV',
                            key: 'name',
                            render: (_, record) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FileTextOutlined style={{ color: '#0284c7', fontSize: 18 }} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                                    {record.name}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    Dung lượng: {record.size} • Cập nhật: {record.updatedAt}
                                  </div>
                                </div>
                              </div>
                            ),
                          },
                          {
                            title: 'Chế độ tạo',
                            dataIndex: 'type',
                            key: 'type',
                            render: (type) => (
                              <Tag
                                color={type === 'Platform Builder' ? 'purple' : type === 'Template ATS' ? 'blue' : 'green'}
                                style={{ borderRadius: 6, fontWeight: 700 }}
                              >
                                {type}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Điểm chuẩn ATS',
                            dataIndex: 'atsScore',
                            key: 'atsScore',
                            render: (score) => (
                              <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 700 }}>
                                ATS {score}/100
                              </Tag>
                            ),
                          },
                          {
                            title: 'Trạng thái',
                            key: 'isDefault',
                            render: (_, record) =>
                              record.isDefault ? (
                                <Tag color="success" style={{ borderRadius: 6, fontWeight: 700 }}>
                                  ✓ CV Mặc định
                                </Tag>
                              ) : (
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setDefaultCV(record.id);
                                    message.success(`Đã đặt "${record.name}" làm CV mặc định!`);
                                  }}
                                  style={{ borderRadius: 6, fontSize: 12 }}
                                >
                                  Đặt làm mặc định
                                </Button>
                              ),
                          },
                          {
                            title: 'Thao tác',
                            key: 'actions',
                            align: 'right',
                            render: (_, record) => (
                              <Space>
                                <Button
                                  type="text"
                                  icon={<EyeOutlined />}
                                  onClick={() => message.info(`Đang mở bản xem trước cho "${record.name}"`)}
                                />
                                <Popconfirm
                                  title="Xác nhận xóa bản CV này?"
                                  onConfirm={() => {
                                    deleteCV(record.id);
                                    message.success('Đã xóa bản CV!');
                                  }}
                                  okText="Xóa"
                                  cancelText="Hủy"
                                >
                                  <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal 1: Platform Builder Form */}
      <Modal
        title="Soạn thảo CV trực tuyến (Platform Builder)"
        open={isBuilderModalOpen}
        onCancel={() => setIsBuilderModalOpen(false)}
        onOk={handleSaveOnlineCv}
        okText="Lưu & Xuất bản"
        cancelText="Hủy"
        width={720}
      >
        <Form form={builderForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="roleTarget"
            label="Vị trí ứng tuyển mục tiêu"
            rules={[{ required: true, message: 'Vui lòng nhập vị trí mục tiêu' }]}
          >
            <Input placeholder="VD: Senior React Developer" />
          </Form.Item>
          <Form.Item name="summary" label="Tóm tắt giới thiệu bản thân">
            <Input.TextArea rows={3} placeholder="Mô tả kỹ năng và kinh nghiệm nổi bật..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 2: Template Selection Preview */}
      <Modal
        title="Chọn mẫu CV ATS tiêu chuẩn"
        open={isTemplateModalOpen}
        onCancel={() => setIsTemplateModalOpen(false)}
        onOk={handleConfirmTemplate}
        okText="Sử dụng mẫu này"
        cancelText="Hủy"
        width={780}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
          {ATS_TEMPLATES.map((tpl) => (
            <Card
              key={tpl.id}
              hoverable
              onClick={() => setSelectedTemplate(tpl)}
              style={{
                borderRadius: 12,
                border: selectedTemplate?.id === tpl.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  height: 90,
                  borderRadius: 8,
                  background: tpl.previewBg,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {tpl.category}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{tpl.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{tpl.description}</div>
              <Tag color="cyan" style={{ marginTop: 8, borderRadius: 4 }}>
                Điểm ATS: {tpl.score}/100
              </Tag>
            </Card>
          ))}
        </div>
      </Modal>

      {/* Modal 3: File Upload */}
      <Modal
        title="Tải tệp CV lên (PDF / DOCX)"
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
      >
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 40, color: '#2563eb' }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              Kéo thả tệp CV vào đây hoặc bấm để chọn tệp từ máy tính
            </p>
            <p className="ant-upload-hint" style={{ color: '#64748b' }}>
              Hỗ trợ định dạng PDF, DOCX dung lượng tối đa 5MB.
            </p>
          </Upload.Dragger>
        </div>
      </Modal>

      {/* MODAL 4: Thêm / Chỉnh sửa Kỹ năng (API Backend) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOutlined style={{ color: '#2563eb', fontSize: 18 }} />
            <span style={{ fontWeight: 800 }}>
              {editingSkill ? `Chỉnh sửa kỹ năng: ${editingSkill.skillName || ''}` : 'Thêm Kỹ Năng Vào Hồ Sơ'}
            </span>
          </div>
        }
        open={isSkillModalOpen}
        onCancel={() => {
          setIsSkillModalOpen(false);
          setEditingSkill(null);
          skillModalForm.resetFields();
        }}
        onOk={handleSaveSkillSubmit}
        okText={editingSkill ? 'Lưu cập nhật' : 'Thêm kỹ năng'}
        cancelText="Hủy"
        confirmLoading={isSavingSkill}
        width={520}
      >
        <Form form={skillModalForm} layout="vertical" style={{ marginTop: 16 }}>
          {!editingSkill ? (
            <Form.Item
              name="skillId"
              label={<span style={{ fontWeight: 700 }}>Chọn kỹ năng từ danh mục hệ thống</span>}
              rules={[{ required: true, message: 'Vui lòng chọn kỹ năng.' }]}
            >
              <Select
                showSearch
                placeholder="Tìm kiếm kỹ năng (ví dụ: React, .NET, Docker...)"
                loading={loadingCatalog}
                filterOption={(input, option) =>
                  String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                }
                options={catalogSkills.map((s) => ({
                  value: s.skillId,
                  label: s.category ? `${s.skillName} (${s.category})` : s.skillName,
                }))}
              />
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>Kỹ năng đang chỉnh sửa:</span>
              <strong style={{ fontSize: 15, color: '#0f172a' }}>{editingSkill.skillName}</strong>
              {editingSkill.category && (
                <Tag color="blue" style={{ marginLeft: 8 }}>{editingSkill.category}</Tag>
              )}
            </div>
          )}

          <Form.Item
            name="proficiencyLevel"
            label={<span style={{ fontWeight: 700 }}>Mức độ thành thạo</span>}
            rules={[{ required: true, message: 'Vui lòng chọn mức độ.' }]}
          >
            <Select
              options={[
                { value: 'BEGINNER', label: 'Mới bắt đầu (Beginner)' },
                { value: 'INTERMEDIATE', label: 'Trung cấp (Intermediate)' },
                { value: 'ADVANCED', label: 'Thành thạo (Advanced)' },
                { value: 'EXPERT', label: 'Chuyên gia (Expert)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="yearsOfExperience"
            label={<span style={{ fontWeight: 700 }}>Số năm kinh nghiệm</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập số năm kinh nghiệm.' },
            ]}
          >
            <InputNumber
              min={0}
              max={80}
              step={0.5}
              style={{ width: '100%' }}
              placeholder="Ví dụ: 2.5"
              addonAfter="năm"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CandidateProfilePage;
