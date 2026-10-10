import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
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
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore, CandidateProfile, CandidateCV } from '@/stores/candidateStore';
import { saveHRConnectUser, findHRConnectUserByEmail } from '@/services/localStorageService';
import { candidateService } from '@/services/candidateService';
import { useCandidateProfile } from '@/hooks/useCandidateProfile';
import type { UploadProps } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 4 Mẫu CV ATS Tiêu Chuẩn
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

  const { user } = useAuthStore();
  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const { profile, updateProfile, cvs, addCV, setDefaultCV, deleteCV, initCandidateFromUser } = useCandidateStore();

  // Only display CVs created or uploaded by current user
  const myCvs = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return (cvs || []).filter((c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail);
  }, [currentUserEmail, cvs]);

  const { profile: apiProfile, refetch: refetchApiProfile } = useCandidateProfile();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const savingProfile = isSaving;

  // --- Form & Banner state: always reflects the logged-in account & latest saved values ---
  const [formData, setFormData] = useState(() => {
    const storedUser = user ? findHRConnectUserByEmail(user.email) : null;
    return {
      fullName:       storedUser?.fullName  || user?.name  || '',
      email:          storedUser?.email      || user?.email || '',
      phone:          storedUser?.phone      || user?.phone || '',
      jobTitle:       profile?.targetRole    || '',
      targetRole:     profile?.targetRole    || '',
      expectedSalary: profile?.expectedSalary|| '',
      currentLevel:   profile?.currentLevel  || '',
      experienceYears:profile?.experienceYears || '',
    };
  });

  /** Returns initials: first char of first word + first char of last word */
  const getInitials = (name?: string): string => {
    if (!name) return 'UV';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // ALWAYS sync identity fields and profile values into the form
  React.useEffect(() => {
    if (!user) return;

    // Look up the full stored record (may have more info than authStore)
    const storedUser = findHRConnectUserByEmail(user.email);
    const resolvedName  = apiProfile?.fullName || storedUser?.fullName  || user.name  || profile.fullName || (user.email ? user.email.split('@')[0] : 'Ứng viên');
    const resolvedEmail = apiProfile?.email    || storedUser?.email      || user.email || profile.email    || '';
    const resolvedPhone = apiProfile?.phone    || storedUser?.phone      || user.phone || profile.phone    || '';

    // Force-init candidateStore profile with current user identity
    initCandidateFromUser({
      name:  resolvedName,
      email: resolvedEmail,
      phone: resolvedPhone,
    });

    const resolvedExp =
      typeof apiProfile?.yearsOfExperience === 'number' && apiProfile.yearsOfExperience > 0
        ? `${apiProfile.yearsOfExperience} năm kinh nghiệm`
        : (profile?.experienceYears || '');

    // Populate all form fields so initial values are immediately editable and valid
    form.setFieldsValue({
      fullName: resolvedName,
      email:    resolvedEmail,
      phone:    resolvedPhone,
      location: apiProfile?.currentAddress || profile?.location || '',
      targetRole: profile?.targetRole || '',
      expectedSalary: profile?.expectedSalary || '',
      currentLevel: apiProfile?.highestEducation || profile?.currentLevel || '',
      experienceYears: resolvedExp,
      foreignLanguages: profile?.foreignLanguages || '',
      availableDate: profile?.availableDate || '',
      bio: apiProfile?.summary || profile?.bio || '',
    });

    // Sync banner immediately
    setFormData((prev) => ({
      ...prev,
      fullName: resolvedName,
      email:    resolvedEmail,
      phone:    resolvedPhone,
      jobTitle: profile?.targetRole || prev?.jobTitle || '',
      targetRole: profile?.targetRole || prev?.targetRole || '',
      expectedSalary: profile?.expectedSalary || prev?.expectedSalary || '',
      currentLevel: apiProfile?.highestEducation || profile?.currentLevel || prev?.currentLevel || '',
      experienceYears: resolvedExp || prev?.experienceYears || '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, apiProfile]);

  // Skill tags input state
  const [skillsList, setSkillsList] = useState<string[]>(
    profile?.skills && profile.skills.length > 0
      ? profile.skills
      : []
  );
  const [newSkillInput, setNewSkillInput] = useState('');
  const [showSkillInput, setShowSkillInput] = useState(false);

  // Modal 1: Platform Builder Form
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const [builderForm] = Form.useForm();

  // Modal 2: Template Selection Preview
  const [selectedTemplate, setSelectedTemplate] = useState<AtsTemplateItem | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Modal 3: File Upload
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Handle Profile Update — saves to candidateStore + hrconnect_users + authStore + formData
  const handleSaveProfile = async (values: any) => {
    setIsSaving(true);
    try {
      // 1. Update candidateStore (local UI state + persist)
      updateProfile({
        ...values,
        fullName: (values.fullName || user?.name || '').trim(),
        email: (values.email || user?.email || '').toLowerCase().trim(),
        phone: (values.phone || user?.phone || '').trim(),
        targetRole: values.targetRole || values.jobTitle || profile.targetRole || '',
        skills: skillsList,
      });

      // 1.1 Call Backend PUT /api/v1/candidates/profile/me
      try {
        await candidateService.updateProfile({
          fullName: (values.fullName || user?.name || '').trim(),
          phone: (values.phone || user?.phone || '').trim(),
          currentAddress: (values.location || '').trim(),
          highestEducation: (values.currentLevel || '').trim(),
          yearsOfExperience: parseFloat(values.experienceYears) || (apiProfile?.yearsOfExperience ?? 0),
          summary: (values.bio || '').trim(),
        });
        await refetchApiProfile();
      } catch (apiErr) {
        console.warn('Backend API updateProfile failed (continuing with local persistence):', apiErr);
      }

      // 2. Persist identity changes back to hrconnect_users localStorage
      if (user) {
        const storedUser = findHRConnectUserByEmail(user.email);
        saveHRConnectUser({
          id: storedUser?.id || user.id,
          email: (values.email || user.email).toLowerCase().trim(),
          role: user.role,
          fullName: (values.fullName || user.name).trim(),
          phone: values.phone?.trim() || storedUser?.phone,
          password: storedUser?.password || '123456',
          companyName: storedUser?.companyName,
          companySize: storedUser?.companySize,
        });

        // 3. Sync name + phone into authStore in-memory user object
        useAuthStore.setState((state) => ({
          user: state.user
            ? {
                ...state.user,
                name: (values.fullName || state.user.name).trim(),
                phone: values.phone?.trim() || state.user.phone,
              }
            : null,
        }));
      }

      // 4. Update banner immediately so it reflects new values without reload
      setFormData({
        fullName:       (values.fullName || user?.name || '').trim(),
        email:          (values.email    || user?.email || '').toLowerCase().trim(),
        phone:          (values.phone    || user?.phone || '').trim(),
        jobTitle:       values.targetRole || values.jobTitle || '',
        targetRole:     values.targetRole || values.jobTitle || '',
        expectedSalary: values.expectedSalary || '',
        currentLevel:   values.currentLevel   || '',
        experienceYears:values.experienceYears || '',
      });

      message.success('Lưu thông tin hồ sơ thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu thông tin hồ sơ:', error);
      message.error('Có lỗi xảy ra khi lưu thông tin hồ sơ. Vui lòng thử lại!');
    } finally {
      setIsSaving(false);
    }
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

  // Tính toán số năm kinh nghiệm an toàn: chỉ hiển thị khi số năm kinh nghiệm > 0
  const experienceYearsRaw =
    apiProfile?.yearsOfExperience !== undefined && apiProfile?.yearsOfExperience !== null
      ? `${apiProfile.yearsOfExperience} năm kinh nghiệm`
      : (formData?.experienceYears || profile?.experienceYears || '');

  const experienceNum =
    typeof apiProfile?.yearsOfExperience === 'number'
      ? apiProfile.yearsOfExperience
      : parseFloat(String(experienceYearsRaw || '').replace(/[^\d.]/g, '')) || 0;

  const hasValidExperience = experienceNum > 0;
  const displayExperience =
    typeof experienceYearsRaw === 'string' &&
    experienceYearsRaw.trim() &&
    !experienceYearsRaw.trim().startsWith('0')
      ? experienceYearsRaw.trim()
      : `${experienceNum} năm kinh nghiệm`;

  return (
    <div className="candidate-page candidate-profile-page" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header Profile Summary — Impeccable Style System */}
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
        {/* Subtle decorative glow */}
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
              <Avatar
                size={84}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  fontSize: 28,
                  fontWeight: 800,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {getInitials(user?.name || formData?.fullName)}
              </Avatar>
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #0B0F17',
                }}
                title="Tài khoản đang hoạt động"
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: '#ffffff',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {user?.name || formData?.fullName || 'Chưa cập nhật họ tên'}
                </h1>
                {/* Badge cấp bậc: Ẩn khi chưa có dữ liệu */}
                {(formData?.currentLevel || profile?.currentLevel || apiProfile?.highestEducation) ? (
                  <span
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: 9999,
                      padding: '2px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {formData?.currentLevel || profile?.currentLevel || apiProfile?.highestEducation}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  color: '#cbd5e1',
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{formData?.jobTitle || formData?.targetRole || profile?.targetRole || 'Chưa cập nhật chức danh'}</span>
                {hasValidExperience && (
                  <>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span style={{ color: '#94a3b8' }}>{displayExperience}</span>
                  </>
                )}
              </div>

              {/* Contact Pills */}
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
                  <span style={{ color: '#e2e8f0' }}>{user?.email || formData?.email || 'Chưa có email'}</span>
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
                  <span style={{ color: '#e2e8f0' }}>{user?.phone || formData?.phone || 'Chưa có số điện thoại'}</span>
                </div>
              </div>
            </div>
          </Col>

          {/* Metric Box */}
          <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                marginLeft: 'auto',
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
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#34d399',
                  lineHeight: 1.2,
                }}
              >
                {formData?.expectedSalary || profile?.expectedSalary || 'Thương lượng'}
              </div>
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
                  Phần 1: Thông tin nghề nghiệp cốt lõi
                </span>
              ),
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveProfile}
                    onFinishFailed={({ errorFields }) => {
                      const firstError = errorFields?.[0]?.errors?.[0];
                      message.error(firstError || 'Vui lòng kiểm tra và điền đầy đủ các trường thông tin bắt buộc còn thiếu!');
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
                        Họ tên và số điện thoại được sử dụng để HR và Nhà tuyển dụng liên hệ phỏng vấn trực tiếp.
                      </Text>

                      <Row gutter={[20, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="fullName"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Họ và tên <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập họ và tên của bạn' }]}
                          >
                            <Input size="large" placeholder="VD: Nguyễn Văn B" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="email"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa chỉ Email <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[
                              { required: true, message: 'Vui lòng nhập địa chỉ email' },
                              { type: 'email', message: 'Địa chỉ email không đúng định dạng (VD: ungvien@gmail.com)' },
                            ]}
                          >
                            <Input size="large" placeholder="VD: ungvien5@gmail.com" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="phone"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số điện thoại liên hệ <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[
                              { required: true, message: 'Vui lòng nhập số điện thoại liên hệ' },
                              { pattern: /^[0-9+() -]{8,15}$/, message: 'Số điện thoại không hợp lệ (8 - 15 chữ số)' },
                            ]}
                          >
                            <Input size="large" placeholder="VD: 0912 345 678" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="location"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa điểm &amp; Hình thức làm việc</span>}
                          >
                            <Input size="large" placeholder="VD: Hà Nội, TP.HCM, Hybrid / Remote..." style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <Divider style={{ margin: '8px 0 28px' }} />

                    {/* Nhóm 2: Định hướng chuyên môn & Đãi ngộ */}
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
                        Định hướng chuyên môn &amp; Dải lương kỳ vọng
                      </div>
                      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 16 }}>
                        Giúp hệ thống AI tự động phân tích và ghép nối đúng các vị trí công việc có mức đãi ngộ phù hợp.
                      </Text>

                      <Row gutter={[20, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="targetRole"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chức danh chuyên môn mong muốn</span>}
                          >
                            <Input size="large" placeholder="VD: Senior Fullstack Engineer / Tech Lead" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="expectedSalary"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Dải lương kỳ vọng (VND / tháng)</span>}
                          >
                            <Input size="large" placeholder="VD: 45.000.000 - 65.000.000 đ/tháng" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="currentLevel"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Cấp bậc chuyên môn hiện tại</span>}
                          >
                            <Select size="large" style={{ borderRadius: 12 }}>
                              <Option value="Junior / Fresher">Junior / Fresher (1 - 2 năm)</Option>
                              <Option value="Mid-Level">Mid-Level (2 - 4 năm)</Option>
                              <Option value="Senior Level / Team Lead">Senior Level / Team Lead (5+ năm)</Option>
                              <Option value="Principal / Architect">Principal / Software Architect</Option>
                              <Option value="Engineering Manager / CTO">Engineering Manager / CTO</Option>
                            </Select>
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="experienceYears"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số năm kinh nghiệm tích lũy</span>}
                          >
                            <Input size="large" placeholder="VD: 5+ năm kinh nghiệm" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="foreignLanguages"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Trình độ ngoại ngữ</span>}
                          >
                            <Input size="large" placeholder="VD: Tiếng Anh (IELTS 7.0 / Giao tiếp công việc thành thạo)" style={{ borderRadius: 12, border: '1px solid #cbd5e1' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="availableDate"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Ngày sẵn sàng nhận việc</span>}
                          >
                            <Select size="large" style={{ borderRadius: 12 }}>
                              <Option value="Sẵn sàng làm việc ngay lập tức">Sẵn sàng làm việc ngay lập tức</Option>
                              <Option value="Sau 15 ngày kể từ ngày nhận Offer">Sau 15 ngày kể từ ngày nhận Offer</Option>
                              <Option value="Sau 30 ngày (bàn giao công việc hiện tại)">Sau 30 ngày (bàn giao công việc hiện tại)</Option>
                              <Option value="Thương lượng linh hoạt">Thương lượng linh hoạt</Option>
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
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          3
                        </span>
                        Kỹ năng cốt lõi & Mục tiêu phát triển sự nghiệp
                      </div>
                      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 16 }}>
                        Thêm các từ khóa kỹ năng chính (Skills Tags) để tăng tỷ lệ khớp hồ sơ ATS.
                      </Text>

                      <Row gutter={[20, 16]}>
                        <Col xs={24}>
                          <div style={{ marginBottom: 16 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 8 }}>
                              Danh sách Kỹ năng chính (Skills Tags)
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              {skillsList.map((skill) => (
                                <Tag
                                  key={skill}
                                  closable
                                  onClose={() => handleRemoveSkill(skill)}
                                  style={{
                                    padding: '5px 14px',
                                    fontSize: 12.5,
                                    borderRadius: 9999,
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    color: '#1e40af',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
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
                                  placeholder="Nhập kỹ năng..."
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
                                  + Thêm kỹ năng
                                </Button>
                              )}
                            </div>
                          </div>
                        </Col>

                        <Col xs={24}>
                          <Form.Item
                            name="bio"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tóm tắt kinh nghiệm & Mục tiêu nghề nghiệp</span>}
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
                        onClick={() => form.submit()}
                        loading={isSaving || savingProfile}
                        style={{
                          borderRadius: 9999,
                          fontWeight: 700,
                          fontSize: 15,
                          background: '#00b14f',
                          borderColor: '#00b14f',
                          height: 46,
                          padding: '0 36px',
                          boxShadow: '0 4px 14px rgba(0, 177, 79, 0.28)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                      >
                        Lưu thông tin hồ sơ
                      </Button>
                    </div>
                  </Form>
                </div>
              ),
            },

            // ==================== TAB 2 ====================
            {
              key: 'cv-center',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileTextOutlined />
                  Phần 2: Trung tâm Quản lý CV (3 Chế độ tạo)
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  {/* 3 Khối hành động tương ứng 3 chế độ tạo CV */}
                  <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                    {/* Chế độ 1: Platform Builder */}
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

                    {/* Chế độ 2: Template-Based */}
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

                    {/* Chế độ 3: File Upload */}
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
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <UploadOutlined style={{ fontSize: 22, color: '#10b981' }} />
                          </div>
                          <Tag color="green" style={{ borderRadius: 6, fontWeight: 700, marginBottom: 8 }}>
                            Chế độ 3
                          </Tag>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
                            Tải tệp CV lên (File Upload)
                          </div>
                          <Paragraph style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                            Drag & Drop tệp CV sẵn có từ máy tính (hỗ trợ định dạng PDF, DOCX dung lượng tối đa 5MB).
                          </Paragraph>
                        </div>
                        <Button
                          block
                          icon={<UploadOutlined />}
                          onClick={() => setIsUploadModalOpen(true)}
                          style={{
                            borderRadius: 8,
                            fontWeight: 700,
                            borderColor: '#10b981',
                            color: '#10b981',
                            marginTop: 12,
                          }}
                        >
                          Tải lên PDF/DOCX (5MB)
                        </Button>
                      </Card>
                    </Col>
                  </Row>

                  {/* Bảng Quản lý Danh sách CV của ứng viên */}
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Title level={5} style={{ margin: 0, fontWeight: 800 }}>
                        Danh sách hồ sơ CV đã tạo ({myCvs.length})
                      </Title>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Bản CV được đặt làm mặc định sẽ tự động chọn sẵn khi ứng tuyển việc làm ngoài Trang chủ.
                      </Text>
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
                            render: (_, record) => (
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
                              )
                            ),
                          },
                          {
                            title: 'Thao tác',
                            key: 'actions',
                            align: 'right',
                            render: (_, record) => (
                              <Space size={8}>
                                <Button
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  onClick={() => message.success(`Đang chuẩn bị tải xuống "${record.name}"...`)}
                                  style={{ borderRadius: 6 }}
                                >
                                  Tải xuống
                                </Button>

                                <Popconfirm
                                  title="Xóa bản CV này?"
                                  description="Bạn có chắc muốn xóa bản CV này khỏi danh sách hồ sơ?"
                                  onConfirm={() => {
                                    deleteCV(record.id);
                                    message.success('Đã xóa CV thành công.');
                                  }}
                                  okText="Xóa"
                                  cancelText="Hủy"
                                >
                                  <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
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

      {/* MODAL 1: Platform Builder Form (Học vấn, Kinh nghiệm, Dự án, Chứng chỉ) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />
            <span style={{ fontWeight: 800 }}>Tạo Hồ Sơ Trực Tuyến (Platform Builder)</span>
          </div>
        }
        open={isBuilderModalOpen}
        onCancel={() => setIsBuilderModalOpen(false)}
        onOk={handleSaveOnlineCv}
        okText="Xuất Bản Bản CV Chuẩn ATS"
        cancelText="Hủy"
        width={720}
        style={{ top: 25 }}
      >
        <Form form={builderForm} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <Form.Item name="roleTarget" label={<span style={{ fontWeight: 700 }}>1. Chức danh mục tiêu của bản CV</span>} initialValue={profile.targetRole}>
              <Input placeholder="VD: Senior ReactJS / Frontend Lead" />
            </Form.Item>

            <Form.Item name="education" label={<span style={{ fontWeight: 700 }}>2. Học vấn & Trình độ đào tạo</span>} initialValue="Đại học Bách Khoa Hà Nội - Chuyên ngành Kỹ thuật Phần mềm (Tốt nghiệp loại Giỏi)">
              <Input.TextArea rows={2} placeholder="Trường, chuyên ngành, xếp loại tốt nghiệp..." />
            </Form.Item>

            <Form.Item name="experience" label={<span style={{ fontWeight: 700 }}>3. Kinh nghiệm làm việc chính</span>} initialValue="Kỹ sư cao cấp tại FinTech Corp (2022 - Nay): Thiết kế kiến trúc Micro-frontends, tăng 40% hiệu năng tải trang và giảm 60% lỗi runtime.">
              <Input.TextArea rows={3} placeholder="Mô tả các công ty, vị trí và đóng góp đo lường được bằng số liệu..." />
            </Form.Item>

            <Form.Item name="projects" label={<span style={{ fontWeight: 700 }}>4. Dự án nổi bật (Key Projects)</span>} initialValue="Hệ thống Cổng thanh toán Quốc tế: Xử lý 10,000+ giao dịch/giây, tối ưu Core Web Vitals chuẩn 99/100 Google Lighthouse.">
              <Input.TextArea rows={3} placeholder="Tên dự án, công nghệ ứng dụng (ReactJS, TypeScript, Kafka) và quy mô người dùng..." />
            </Form.Item>

            <Form.Item name="certificates" label={<span style={{ fontWeight: 700 }}>5. Chứng chỉ chuyên môn & Giải thưởng</span>} initialValue="AWS Certified Solutions Architect Associate (2025), Meta React Certified Professional Developer.">
              <Input placeholder="Các chứng chỉ quốc tế uy tín..." />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* MODAL 2: Template-Based (Chọn 4 Mẫu ATS) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppstoreOutlined style={{ color: '#0284c7', fontSize: 18 }} />
            <span style={{ fontWeight: 800 }}>Kho 4 Mẫu CV Tiêu Chuẩn Quốc Tế (ATS Certified)</span>
          </div>
        }
        open={isTemplateModalOpen}
        onCancel={() => setIsTemplateModalOpen(false)}
        onOk={handleConfirmTemplate}
        okText="Chọn Mẫu Này & Tạo CV"
        cancelText="Đóng"
        width={780}
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Tất cả 4 mẫu dưới đây đều được cấu hình chuẩn phông chữ, khoảng cách lề và cấu trúc phân đoạn giúp hệ thống ATS đọc dữ liệu tự động đạt 90%+ tỷ lệ vượt qua.
          </Paragraph>

          <Row gutter={[16, 16]}>
            {ATS_TEMPLATES.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <Col xs={24} sm={12} key={tpl.id}>
                  <div
                    onClick={() => setSelectedTemplate(tpl)}
                    style={{
                      border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: 16,
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 8px 20px rgba(2, 132, 199, 0.15)' : 'none',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          height: 60,
                          borderRadius: 10,
                          background: tpl.previewBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 16px',
                          color: '#fff',
                          marginBottom: 12,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{tpl.category}</span>
                        <Tag color="#34d399" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>
                          ATS {tpl.score}/100
                        </Tag>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 6 }}>
                        {tpl.name}
                      </div>

                      <Paragraph style={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                        {tpl.description}
                      </Paragraph>
                    </div>

                    <div style={{ marginTop: 14, textAlign: 'right' }}>
                      {isSelected ? (
                        <Tag color="blue" icon={<CheckOutlined />} style={{ fontWeight: 700, padding: '3px 10px' }}>
                          Đang chọn
                        </Tag>
                      ) : (
                        <Button size="small" style={{ borderRadius: 6 }}>
                          Xem mẫu
                        </Button>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      </Modal>

      {/* MODAL 3: File Upload (PDF/DOCX max 5MB) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UploadOutlined style={{ color: '#10b981', fontSize: 18 }} />
            <span style={{ fontWeight: 800 }}>Tải Lên Tệp CV (PDF / DOCX)</span>
          </div>
        }
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ marginTop: 12 }}>
          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 36, color: '#10b981' }} />
            </p>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', margin: '0 0 6px' }}>
              Nhấp hoặc kéo thả tệp CV vào khu vực này
            </p>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              Hỗ trợ định dạng <strong>.PDF, .DOC, .DOCX</strong>. Dung lượng tối đa: <strong>5MB</strong>.
            </p>
            <p style={{ color: '#0284c7', fontSize: 12, marginTop: 10, fontWeight: 600 }}>
              AI sẽ tự động quét từ khóa và tính điểm độ khớp ATS ngay sau khi tải lên.
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
};

export default CandidateProfilePage;
