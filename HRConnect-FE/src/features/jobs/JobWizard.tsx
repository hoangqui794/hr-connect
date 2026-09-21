import React, { useState } from 'react';
import { Steps, Button, Card, Space, Typography, Tag, message, Result, Spin } from 'antd';
import {
  FileTextOutlined, TagsOutlined, TrophyOutlined, DollarOutlined,
  SaveOutlined, CheckCircleOutlined, ArrowLeftOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { Step1Details } from './JobWizardSteps/Step1Details';
import { Step2Instructions } from './JobWizardSteps/Step2Instructions';
import { Step3Objectives } from './JobWizardSteps/Step3Objectives';
import { Step4Engagement } from './JobWizardSteps/Step4Engagement';
import { useJobStore } from '@/stores/jobStore';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

const STEPS = [
  { title: '1. Thông tin vị trí', description: 'Vị trí & Dịch vụ tuyển dụng', icon: <FileTextOutlined /> },
  { title: '2. Tiêu chuẩn sàng lọc', description: 'Bắt buộc có & Ưu tiên có', icon: <TagsOutlined /> },
  { title: '3. Mục tiêu thử việc', description: 'KPIs & Tiêu chí đánh giá', icon: <TrophyOutlined /> },
  { title: '4. Chế độ đãi ngộ', description: 'Hoa hồng & Thời gian tuyển', icon: <DollarOutlined /> },
];

export const JobWizard: React.FC = () => {
  const { draft, setStep, lastSaved, isDirty, resetDraft } = useJobStore();
  const { } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const currentStep = draft.step;

  const handleNext = () => {
    if (currentStep < 3) setStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
    message.success('Đăng tin tuyển dụng thành công! Các bên liên quan đã có thể xem và gửi hồ sơ.');
  };

  const handleReset = () => {
    resetDraft();
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="success"
          title="Đăng tin tuyển dụng thành công! 🎉"
          subTitle={`Tin tuyển dụng của bạn đã được kích hoạt và hiển thị cho ${
            draft.step1.serviceType === 'HEADHUNT_COD' ? 'mạng lưới cộng tác viên (Headhunter)' : 'ứng viên'
          }. Bạn sẽ nhận được thông báo trực tiếp khi có hồ sơ ứng tuyển.`}
          extra={[
            <Button type="primary" key="dashboard" onClick={() => window.location.href = '/jobs'}>
              Xem tin tuyển dụng đang mở
            </Button>,
            <Button key="new" onClick={handleReset}>Tạo thêm tin tuyển dụng khác</Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Tạo tin tuyển dụng mới
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Hoàn thành biểu mẫu 4 bước để phát hành tin tuyển dụng lên nền tảng HR Connect
            </Text>
          </div>
          <Space>
            {isDirty ? (
              <Tag color="warning" icon={<SaveOutlined />} style={{ borderRadius: 6, padding: '2px 10px' }}>
                Có thay đổi chưa lưu
              </Tag>
            ) : lastSaved ? (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, padding: '2px 10px' }}>
                Tự động lưu lúc {new Date(lastSaved).toLocaleTimeString()}
              </Tag>
            ) : null}
          </Space>
        </div>
      </div>

      {/* Wizard Card */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 24px rgb(0 0 0 / 0.06)', border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Steps Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '16px 16px 0 0' }}>
          <Steps
            current={currentStep}
            items={STEPS}
            size="small"
            style={{ maxWidth: 700, margin: '0 auto' }}
          />
        </div>

        {/* Step Content */}
        <div style={{ padding: '32px' }}>
          <Spin spinning={submitting} tip="Đang xuất bản tin tuyển dụng...">
            {currentStep === 0 && <Step1Details />}
            {currentStep === 1 && <Step2Instructions />}
            {currentStep === 2 && <Step3Objectives />}
            {currentStep === 3 && <Step4Engagement />}
          </Spin>
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: '16px 32px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa',
            borderRadius: '0 0 16px 16px',
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{ borderRadius: 8 }}
          >
            Quay lại
          </Button>

          <div style={{ display: 'flex', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
              Bước {currentStep + 1} / 4
            </Text>
            {currentStep < 3 ? (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                onClick={handleNext}
                disabled={currentStep === 0 && !draft.step1.serviceType}
                style={{ borderRadius: 8 }}
              >
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                style={{ borderRadius: 8, background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
              >
                Đăng tin tuyển dụng
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
