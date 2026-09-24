import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  Button,
  Tag,
  Space,
  Upload,
  Divider,
  message,
  Typography,
} from 'antd';
import {
  SendOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleFilled,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore, CandidateCV } from '@/stores/candidateStore';
import type { UploadProps } from 'antd';

const { Text, Paragraph } = Typography;

export interface JobToApply {
  id: string;
  title: string;
  company: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string;
}

interface ApplyJobModalProps {
  open: boolean;
  job: JobToApply | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ApplyJobModal: React.FC<ApplyJobModalProps> = ({
  open,
  job,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { profile, cvs, applyJob, addCV } = useCandidateStore();
  const [form] = Form.useForm();

  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false);

  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const userCvs = React.useMemo(() => {
    if (!currentUserEmail) return [];
    return (cvs || []).filter((c) => (c.userEmail || '').toLowerCase().trim() === currentUserEmail);
  }, [currentUserEmail, cvs]);

  // Set default selected CV and contact info whenever modal opens
  useEffect(() => {
    if (open) {
      const defaultCv = userCvs.find((c) => c.isDefault) || userCvs[0];
      setSelectedCvId(defaultCv?.id || '');

      form.setFieldsValue({
        fullName: profile.fullName || user?.name || '',
        email: profile.email || user?.email || '',
        phone: profile.phone || '0912 345 678',
        coverLetter: '',
      });
    }
  }, [open, userCvs, profile, user, form]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const newCv: CandidateCV = {
        id: `cv-${Date.now()}`,
        name: file.name,
        updatedAt: 'Vừa tải lên',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        isDefault: userCvs.length === 0,
        atsScore: 92,
        type: 'File Upload',
        userEmail: currentUserEmail,
      };
      addCV(newCv);
      setSelectedCvId(newCv.id);
      setIsQuickUploadOpen(false);
      message.success(`Đã tải lên tệp "${file.name}" và chọn làm CV ứng tuyển!`);
      return false;
    },
  };

  const getCvTypeBadge = (type: CandidateCV['type']) => {
    switch (type) {
      case 'Platform Builder':
        return <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, fontSize: 11 }}>Tạo trực tuyến</Tag>;
      case 'Template ATS':
        return <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, fontSize: 11 }}>Mẫu ATS</Tag>;
      case 'File Upload':
        return <Tag color="green" style={{ borderRadius: 6, fontWeight: 700, fontSize: 11 }}>File PDF tải lên</Tag>;
      default:
        return <Tag style={{ borderRadius: 6 }}>{type}</Tag>;
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedCvId) {
        message.error('Vui lòng chọn 1 bản CV trong danh sách để nộp hồ sơ!');
        return;
      }
      if (!job) return;

      const chosenCv = userCvs.find((c) => c.id === selectedCvId) || userCvs[0];

      setSubmitting(true);
      setTimeout(() => {
        const salaryString = job.salaryText
          ? job.salaryText
          : job.salaryMin && job.salaryMax
          ? `${(job.salaryMin / 1000000).toFixed(0)} - ${(job.salaryMax / 1000000).toFixed(0)} Triệu VNĐ`
          : 'Thỏa thuận theo năng lực';

        applyJob({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          salary: salaryString,
          cvUsed: chosenCv?.name || 'CV chính',
          coverLetter: values.coverLetter,
          applicantName: values.fullName,
          applicantEmail: values.email,
          applicantPhone: values.phone,
        });

        setSubmitting(false);
        message.success({
          content: 'Nộp hồ sơ thành công! Trạng thái đã được lưu vào Lịch sử ứng tuyển.',
          icon: <CheckCircleFilled style={{ color: '#10b981' }} />,
          duration: 4,
        });

        onClose();
        if (onSuccess) onSuccess();
      }, 500);
    } catch {
      // validation error
    }
  };

  if (!job) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SendOutlined style={{ color: '#0284c7', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Ứng tuyển vị trí: {job.title}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              {job.company}
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting} style={{ borderRadius: 8, fontWeight: 600 }}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SendOutlined />}
          loading={submitting}
          onClick={handleConfirmSubmit}
          style={{
            borderRadius: 8,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
          }}
        >
          Xác nhận nộp hồ sơ
        </Button>,
      ]}
      style={{ top: 30 }}
    >
      <div style={{ paddingTop: 8 }}>
        {/* Banner thông báo */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '1px solid #bae6fd',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <ThunderboltOutlined style={{ color: '#0284c7', fontSize: 16 }} />
          <Text style={{ fontSize: 12.5, color: '#0369a1', fontWeight: 600 }}>
            Hồ sơ ứng tuyển sẽ được chuyển ngay tới Nhà tuyển dụng và hệ thống AI sơ tuyển tự động của HR Connect.
          </Text>
        </div>

        {/* 1. CHỌN HỒ SƠ ỨNG TUYỂN */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
              1. Chọn hồ sơ ứng tuyển (CV)
            </Text>
            <Upload {...uploadProps}>
              <Button
                type="link"
                size="small"
                icon={<UploadOutlined />}
                style={{ fontWeight: 700, padding: 0 }}
              >
                + Tải lên CV mới
              </Button>
            </Upload>
          </div>

          <Radio.Group
            value={selectedCvId}
            onChange={(e) => setSelectedCvId(e.target.value)}
            style={{ width: '100%' }}
          >
            {userCvs.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: 10,
                  border: '1px dashed #cbd5e1',
                  background: '#f8fafc',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                Bạn chưa có bản CV nào trong hệ thống. Vui lòng bấm <strong>"+ Tải lên CV mới"</strong> ở trên để nộp hồ sơ.
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {userCvs.map((cv) => {
                  const isChecked = selectedCvId === cv.id;
                  return (
                    <div
                      key={cv.id}
                      onClick={() => setSelectedCvId(cv.id)}
                      style={{
                        border: isChecked ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        background: isChecked ? '#f0f9ff' : '#ffffff',
                        borderRadius: 10,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Radio value={cv.id} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                              {cv.name}
                            </span>
                            {cv.isDefault && (
                              <Tag color="blue" style={{ borderRadius: 4, fontSize: 10, fontWeight: 700, margin: 0 }}>
                                Mặc định
                              </Tag>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Cập nhật: {cv.updatedAt} • Dung lượng: {cv.size}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {getCvTypeBadge(cv.type)}
                        <Tag color="cyan" style={{ borderRadius: 4, fontWeight: 700, fontSize: 11, margin: 0 }}>
                          ATS {cv.atsScore}/100
                        </Tag>
                      </div>
                    </div>
                  );
                })}
              </Space>
            )}
          </Radio.Group>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 2. THÔNG TIN LIÊN HỆ & THƯ GIỚI THIỆU */}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block', marginBottom: 12 }}>
            2. Thông tin liên hệ nhanh
          </Text>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <Form.Item
              name="fullName"
              label={<span style={{ fontSize: 12.5, fontWeight: 600 }}>Họ và tên</span>}
              rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
              style={{ marginBottom: 12 }}
            >
              <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Họ và tên của bạn" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item
              name="email"
              label={<span style={{ fontSize: 12.5, fontWeight: 600 }}>Email liên hệ</span>}
              rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}
              style={{ marginBottom: 12 }}
            >
              <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="email@example.com" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item
              name="phone"
              label={<span style={{ fontSize: 12.5, fontWeight: 600 }}>Số điện thoại</span>}
              rules={[{ required: true, message: 'Vui lòng nhập SĐT' }]}
              style={{ marginBottom: 12 }}
            >
              <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="0912..." style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>

          <Form.Item
            name="coverLetter"
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Thư giới thiệu ngắn (Cover Letter)</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Tùy chọn</span>
              </div>
            }
            style={{ marginBottom: 4 }}
          >
            <Input.TextArea
              rows={3}
              placeholder="Giới thiệu nhanh điểm mạnh, số năm kinh nghiệm hoặc lý do bạn mong muốn cống hiến cho công ty..."
              style={{ borderRadius: 8, fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
