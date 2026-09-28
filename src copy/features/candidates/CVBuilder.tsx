import React, { useState } from 'react';
import {
  Tabs, Form, Input, Button, Upload, Select, Card, Row, Col,
  Typography, Tag, Space, Progress, message, Divider,
} from 'antd';
import {
  EditOutlined, FileTextOutlined, UploadOutlined, PlusOutlined,
  DeleteOutlined, EyeOutlined, DownloadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CV_TEMPLATES = [
  { id: 'modern', name: 'Modern Tech', preview: '🎨', desc: 'Clean single-column, ATS-optimized for tech roles' },
  { id: 'executive', name: 'Executive', preview: '👔', desc: 'Two-column premium layout for senior positions' },
  { id: 'creative', name: 'Creative', preview: '🎭', desc: 'Visual layout for design and creative roles' },
  { id: 'minimal', name: 'Minimal', preview: '⚡', desc: 'Minimalist single-page, maximum information density' },
];

const PLATFORM_SECTIONS = [
  { key: 'summary', label: 'Professional Summary', icon: '📝' },
  { key: 'experience', label: 'Work Experience', icon: '💼' },
  { key: 'education', label: 'Education', icon: '🎓' },
  { key: 'skills', label: 'Technical Skills', icon: '⚙️' },
  { key: 'certifications', label: 'Certifications', icon: '🏆' },
  { key: 'projects', label: 'Key Projects', icon: '🚀' },
];

// Platform Builder Tab
const PlatformBuilder: React.FC = () => {
  const [activeSection, setActiveSection] = useState('summary');
  const [form] = Form.useForm();
  const [skills, setSkills] = useState<string[]>(['React', 'TypeScript', 'Node.js']);
  const [completeness, setCompleteness] = useState(35);

  return (
    <Row gutter={[16, 16]}>
      {/* Left: Section Navigator */}
      <Col xs={24} lg={7}>
        <Card size="small" style={{ borderRadius: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>CV Completeness</Text>
              <Text style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>{completeness}%</Text>
            </div>
            <Progress percent={completeness} showInfo={false} strokeColor={{ '0%': '#0284c7', '100%': '#10b981' }} />
          </div>
          <Divider style={{ margin: '10px 0' }} />
          {PLATFORM_SECTIONS.map((section) => (
            <div
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                background: activeSection === section.key ? '#f0f9ff' : 'transparent',
                border: activeSection === section.key ? '1px solid #bae6fd' : '1px solid transparent',
                marginBottom: 4,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{section.icon}</span>
              <span style={{ fontSize: 13, fontWeight: activeSection === section.key ? 600 : 400, color: activeSection === section.key ? '#0284c7' : '#475569' }}>
                {section.label}
              </span>
            </div>
          ))}
        </Card>
      </Col>

      {/* Right: Editor */}
      <Col xs={24} lg={17}>
        <Card size="small" style={{ borderRadius: 12 }} title={
          <Space>
            <span>{PLATFORM_SECTIONS.find(s => s.key === activeSection)?.icon}</span>
            <span style={{ fontWeight: 700 }}>{PLATFORM_SECTIONS.find(s => s.key === activeSection)?.label}</span>
          </Space>
        }>
          <Form form={form} layout="vertical">
            {activeSection === 'summary' && (
              <Form.Item label="Professional Summary" name="summary">
                <TextArea
                  placeholder="Write a compelling 2-3 sentence summary of your professional background, key skills, and career goals..."
                  rows={5}
                  showCount
                  maxLength={500}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            )}
            {activeSection === 'skills' && (
              <Form.Item label="Skills">
                <Select
                  mode="tags"
                  value={skills}
                  onChange={(v: string[]) => { setSkills(v); setCompleteness(Math.min(completeness + 5, 100)); }}
                  placeholder="Add skills..."
                  style={{ width: '100%' }}
                  tokenSeparators={[',']}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {skills.map((s) => (
                    <Tag key={s} closable onClose={() => setSkills(skills.filter(sk => sk !== s))} style={{ borderRadius: 6 }}>{s}</Tag>
                  ))}
                </div>
              </Form.Item>
            )}
            {(activeSection === 'experience' || activeSection === 'education' || activeSection === 'projects') && (
              <div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                  <Row gutter={[12, 0]}>
                    <Col xs={24} sm={12}>
                      <Form.Item label={activeSection === 'education' ? 'Degree / Qualification' : 'Job Title / Role'} name={`${activeSection}_title`}>
                        <Input placeholder={activeSection === 'education' ? 'B.Sc. Computer Science' : 'Senior Engineer'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={activeSection === 'education' ? 'Institution' : 'Company'} name={`${activeSection}_company`}>
                        <Input placeholder={activeSection === 'education' ? 'HCMUT' : 'VNG Corporation'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label="Description / Achievements" name={`${activeSection}_desc`}>
                        <TextArea rows={3} placeholder="Describe key responsibilities, achievements, or learnings..." style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
                <Button icon={<PlusOutlined />} type="dashed" block style={{ borderRadius: 8 }}>
                  Add Another {activeSection === 'education' ? 'Qualification' : 'Entry'}
                </Button>
              </div>
            )}
            {activeSection === 'certifications' && (
              <div>
                {['AWS Solutions Architect — Associate', 'Certified Kubernetes Administrator (CKA)'].map((cert, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🏆 {cert}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Issued 2024</div>
                    </div>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </div>
                ))}
                <Button icon={<PlusOutlined />} type="dashed" block style={{ borderRadius: 8, marginTop: 4 }}>
                  Add Certification
                </Button>
              </div>
            )}
          </Form>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button type="primary" onClick={() => { setCompleteness(Math.min(completeness + 10, 100)); void message.success('Section saved!'); }} style={{ borderRadius: 8 }}>
              Save Section
            </Button>
            <Button icon={<EyeOutlined />} style={{ borderRadius: 8 }}>Preview CV</Button>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

// Template Picker Tab
const TemplateBased: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
        Choose a professional template and fill in your details. All templates are ATS-optimized.
      </Text>
      <Row gutter={[16, 16]}>
        {CV_TEMPLATES.map((tpl) => (
          <Col key={tpl.id} xs={12} sm={6}>
            <div
              onClick={() => setSelected(tpl.id)}
              style={{
                border: `2px solid ${selected === tpl.id ? '#0284c7' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                textAlign: 'center',
                background: selected === tpl.id ? '#f0f9ff' : '#fff',
                transition: 'all 0.2s',
                boxShadow: selected === tpl.id ? '0 4px 12px rgba(2,132,199,0.15)' : 'none',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>{tpl.preview}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{tpl.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{tpl.desc}</div>
              {selected === tpl.id && (
                <Tag color="blue" style={{ marginTop: 10, borderRadius: 6, fontSize: 11 }}>✓ Selected</Tag>
              )}
            </div>
          </Col>
        ))}
      </Row>
      {selected && (
        <div style={{ marginTop: 20 }}>
          <Button type="primary" size="large" style={{ borderRadius: 10, fontWeight: 600 }}>
            Use {CV_TEMPLATES.find(t => t.id === selected)?.name} Template
          </Button>
        </div>
      )}
    </div>
  );
};

// File Upload Tab
const FileUploadCV: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const { Dragger } = Upload;
  return (
    <div style={{ maxWidth: 560 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
        Upload your existing CV. Our AI will automatically parse and index your profile for matching.
      </Text>
      <Dragger
        fileList={fileList}
        onChange={({ fileList: fl }) => setFileList(fl)}
        beforeUpload={() => false}
        accept=".pdf,.doc,.docx"
        maxCount={1}
        style={{ borderRadius: 12, padding: '24px 0' }}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined style={{ fontSize: 40, color: '#0284c7' }} />
        </p>
        <p style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 4 }}>
          Drop your CV here
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          PDF, DOC, or DOCX — max 10MB
        </p>
      </Dragger>
      {fileList.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Button type="primary" size="large" icon={<DownloadOutlined />} style={{ borderRadius: 10, fontWeight: 600 }}>
            Parse & Create Profile
          </Button>
        </div>
      )}
    </div>
  );
};

export const CVBuilder: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          <FileTextOutlined style={{ color: '#8b5cf6', marginRight: 8 }} />
          My CV
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Choose how you want to create your professional profile.
        </Text>
      </div>
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Tabs
          defaultActiveKey="builder"
          size="large"
          tabBarStyle={{ fontWeight: 500 }}
          items={[
            {
              key: 'builder',
              label: (
                <Space>
                  <EditOutlined />
                  Platform Builder
                </Space>
              ),
              children: <PlatformBuilder />,
            },
            {
              key: 'template',
              label: (
                <Space>
                  <FileTextOutlined />
                  Template-Based
                </Space>
              ),
              children: <TemplateBased />,
            },
            {
              key: 'upload',
              label: (
                <Space>
                  <UploadOutlined />
                  File Upload
                </Space>
              ),
              children: <FileUploadCV />,
            },
          ]}
        />
      </Card>
    </div>
  );
};
