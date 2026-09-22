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
  const { profile, updateProfile, cvs, addCV, setDefaultCV, deleteCV } = useCandidateStore();

  const [form] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);

  // Skill tags input state
  const [skillsList, setSkillsList] = useState<string[]>(profile.skills || ['ReactJS', 'TypeScript', 'Node.js']);
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

  // Handle Profile Update
  const handleSaveProfile = async (values: any) => {
    setSavingProfile(true);
    setTimeout(() => {
      updateProfile({
        ...values,
        skills: skillsList,
      });
      setSavingProfile(false);
      message.success('Cập nhật thông tin nghề nghiệp thành công!');
    }, 400);
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
        name: `CV ${values.roleTarget || profile.targetRole} (Online ATS)`,
        updatedAt: 'Hôm nay',
        size: '1.9 MB',
        isDefault: cvs.length === 0,
        atsScore: 95,
        type: 'Platform Builder',
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
      name: `CV ${profile.targetRole} (${selectedTemplate.name})`,
      updatedAt: 'Hôm nay',
      size: '2.1 MB',
      isDefault: false,
      atsScore: selectedTemplate.score,
      type: 'Template ATS',
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
        isDefault: false,
        atsScore: 93,
        type: 'File Upload',
      };
      addCV(newCv);
      setIsUploadModalOpen(false);
      message.success(`Đã tải lên tệp "${file.name}" thành công!`);
      return false;
    },
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header Profile Summary */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff',
          marginBottom: 24,
        }}
        styles={{ body: { padding: '28px 32px' } }}
      >
        <Row align="middle" justify="space-between" gutter={[20, 20]}>
          <Col xs={24} sm={16} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Avatar size={76} style={{ background: '#0284c7', fontSize: 26, fontWeight: 800 }}>
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'NM'}
            </Avatar>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
                  {profile.fullName || user?.name}
                </Title>
                <Tag color="#0284c7" style={{ borderRadius: 10, fontWeight: 700 }}>
                  {profile.currentLevel}
                </Tag>
              </div>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                {profile.targetRole} • {profile.experienceYears}
              </Text>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, color: '#cbd5e1', fontSize: 13 }}>
                <span><MailOutlined /> {profile.email || user?.email}</span>
                <span><PhoneOutlined /> {profile.phone}</span>
              </div>
            </div>
          </Col>

          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px 18px', borderRadius: 12, display: 'inline-block' }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Lương kỳ vọng
              </Text>
              <div style={{ color: '#34d399', fontSize: 18, fontWeight: 800 }}>
                {profile.expectedSalary}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Main Tabs Container */}
      <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
        <Tabs
          activeKey={activeTabKey}
          onChange={(key) => setSearchParams({ tab: key })}
          size="large"
          items={[
            // ==================== TAB 1 ====================
            {
              key: 'career-info',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined />
                  Phần 1: Thông tin nghề nghiệp cốt lõi
                </span>
              ),
              children: (
                <div style={{ paddingTop: 10 }}>
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={profile}
                    onFinish={handleSaveProfile}
                  >
                    <Row gutter={[24, 16]}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="fullName"
                          label={<span style={{ fontWeight: 600 }}>Họ và tên</span>}
                          rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                        >
                          <Input size="large" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="email"
                          label={<span style={{ fontWeight: 600 }}>Địa chỉ Email</span>}
                          rules={[{ required: true, type: 'email' }]}
                        >
                          <Input size="large" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="phone"
                          label={<span style={{ fontWeight: 600 }}>Số điện thoại liên hệ</span>}
                          rules={[{ required: true }]}
                        >
                          <Input size="large" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="targetRole"
                          label={<span style={{ fontWeight: 600 }}>Chức danh chuyên môn mong muốn</span>}
                          rules={[{ required: true }]}
                        >
                          <Input size="large" placeholder="VD: Senior Fullstack Engineer / Tech Lead" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="expectedSalary"
                          label={<span style={{ fontWeight: 600 }}>Dải lương kỳ vọng (VND / tháng)</span>}
                          rules={[{ required: true }]}
                        >
                          <Input size="large" placeholder="VD: 45.000.000 - 65.000.000 đ/tháng" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="currentLevel"
                          label={<span style={{ fontWeight: 600 }}>Cấp bậc chuyên môn hiện tại</span>}
                          rules={[{ required: true }]}
                        >
                          <Select size="large" style={{ borderRadius: 8 }}>
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
                          label={<span style={{ fontWeight: 600 }}>Số năm kinh nghiệm tích lũy</span>}
                          rules={[{ required: true }]}
                        >
                          <Input size="large" placeholder="VD: 5+ năm kinh nghiệm" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="foreignLanguages"
                          label={<span style={{ fontWeight: 600 }}>Trình độ ngoại ngữ</span>}
                        >
                          <Input size="large" placeholder="VD: Tiếng Anh (IELTS 7.0 / Giao tiếp công việc thành thạo)" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="availableDate"
                          label={<span style={{ fontWeight: 600 }}>Ngày sẵn sàng nhận việc</span>}
                          rules={[{ required: true }]}
                        >
                          <Select size="large" style={{ borderRadius: 8 }}>
                            <Option value="Sẵn sàng làm việc ngay lập tức">Sẵn sàng làm việc ngay lập tức</Option>
                            <Option value="Sau 15 ngày kể từ ngày nhận Offer">Sau 15 ngày kể từ ngày nhận Offer</Option>
                            <Option value="Sau 30 ngày (bàn giao công việc hiện tại)">Sau 30 ngày (bàn giao công việc hiện tại)</Option>
                            <Option value="Thương lượng linh hoạt">Thương lượng linh hoạt</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="location"
                          label={<span style={{ fontWeight: 600 }}>Địa điểm & Hình thức làm việc</span>}
                        >
                          <Input size="large" placeholder="Hà Nội, TP.HCM, Remote..." style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>

                      {/* Danh sách kỹ năng chính */}
                      <Col xs={24}>
                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
                            Danh sách Kỹ năng chính (Skills Tags)
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            {skillsList.map((skill) => (
                              <Tag
                                key={skill}
                                closable
                                onClose={() => handleRemoveSkill(skill)}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: 13,
                                  borderRadius: 6,
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 600,
                                }}
                              >
                                {skill}
                              </Tag>
                            ))}

                            {showSkillInput ? (
                              <Input
                                size="small"
                                style={{ width: 140, borderRadius: 6 }}
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
                                style={{ borderRadius: 6, fontWeight: 600 }}
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
                          label={<span style={{ fontWeight: 600 }}>Tóm tắt kinh nghiệm & Mục tiêu nghề nghiệp</span>}
                        >
                          <Input.TextArea rows={3} style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      loading={savingProfile}
                      style={{
                        borderRadius: 8,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        border: 'none',
                        height: 44,
                        padding: '0 32px',
                      }}
                    >
                      Lưu thông tin nghề nghiệp
                    </Button>
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
                        Danh sách hồ sơ CV đã tạo ({cvs.length})
                      </Title>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Bản CV được đặt làm mặc định sẽ tự động chọn sẵn khi ứng tuyển việc làm ngoài Trang chủ.
                      </Text>
                    </div>

                    <Table
                      dataSource={cvs}
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
