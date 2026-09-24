/**
 * @file CreateJobWizard.tsx
 * @description Production-grade 4-step Job Creation Wizard for HR Connect.
 * Implements MF-01 | SCR-CLI-01 (Client Portal — Post New Job).
 *
 * Architecture:
 *   - Single Ant Design <Form> instance owns all 4 steps' field state.
 *   - Each step validates only its own fields before allowing advancement.
 *   - Draft is persisted to Zustand store (useJobStore) with 1s auto-save debounce.
 *   - Service type selection in Step 1 is reflected live in Step 4 (commission logic).
 *   - On final submission, a 300ms simulated API call is made (mock-first contract).
 *   - On success, a Result screen is shown with navigation options.
 *
 * Step definitions (MF-01):
 *   Step 1 → Details      (Service Type + Job Metadata)
 *   Step 2 → Instructions (Must-Have + Should-Have Tag Filters + Description)
 *   Step 3 → Objectives   (Recruitment Goals, KPIs, Success Criteria)
 *   Step 4 → Engagement   (Commission Rate, Retainer, Timeline, Notes)
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Steps, Button, Card, Space, Typography, Tag, message,
  Result, Spin, Form, theme,
} from 'antd';
import {
  FileTextOutlined, TagsOutlined, TrophyOutlined, DollarOutlined,
  SaveOutlined, CheckCircleOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useJobStore } from '@/stores/jobStore';
import { useAuthStore } from '@/stores/authStore';
import { ServiceType, JobStatus, SERVICE_TYPE_LABELS } from '@/types/job';
import type { JobWizardDraft, Job } from '@/types/job';
import { saveClientJob } from '@/stores/clientJobStore';
import { saveJobToAllJobs } from '@/services/localStorageService';
import { WizardStep1ServiceType } from './CreateJobWizard/WizardStep1ServiceType';
import { WizardStep2TagFilters } from './CreateJobWizard/WizardStep2TagFilters';
import { WizardStep3Objectives } from './CreateJobWizard/WizardStep3Objectives';
import { WizardStep4Engagement } from './CreateJobWizard/WizardStep4Engagement';

const { Title, Text } = Typography;

// ─── Step metadata ────────────────────────────────────────────────────────────

interface StepMeta {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Names of Form.Items validated before advancing past this step */
  validateFields: string[];
}

const STEPS: StepMeta[] = [
  {
    title: '1. Thông tin vị trí',
    description: 'Vị trí & Dịch vụ tuyển dụng',
    icon: <FileTextOutlined />,
    validateFields: [
      'serviceType',
      'title',
      'company',
      'location',
      'headcount',
      'experienceMin',
      'experienceMax',
      'salaryMin',
      'salaryMax',
    ],
  },
  {
    title: '2. Tiêu chuẩn sàng lọc',
    description: 'Bắt buộc có & Ưu tiên có',
    icon: <TagsOutlined />,
    validateFields: ['mustHaveTags', 'description'],
  },
  {
    title: '3. Mục tiêu thử việc',
    description: 'KPIs & Tiêu chí đánh giá',
    icon: <TrophyOutlined />,
    validateFields: ['objectives'],
  },
  {
    title: '4. Chế độ đãi ngộ',
    description: 'Hoa hồng & Thời gian tuyển',
    icon: <DollarOutlined />,
    validateFields: ['timeline'],
  },
];

// ─── Mock API layer (src/services/mock contract, 300ms latency) ───────────────

interface PublishJobPayload {
  draft: JobWizardDraft;
}

interface PublishJobResponse {
  success: boolean;
  jobId: string;
}

async function mockPublishJob(_payload: PublishJobPayload): Promise<PublishJobResponse> {
  await new Promise<void>((r) => setTimeout(r, 300));
  return {
    success: true,
    jobId: `job-${Date.now().toString(36)}`,
  };
}

// ─── CreateJobWizard ──────────────────────────────────────────────────────────

export const CreateJobWizard: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const {
    draft,
    setStep,
    updateStep1,
    updateStep2,
    updateStep3,
    updateStep4,
    saveDraft,
    resetDraft,
    lastSaved,
    isDirty,
  } = useJobStore();

  const currentStep = draft.step;
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [publishedJobId, setPublishedJobId] = React.useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync form initial values from Zustand draft on mount
  useEffect(() => {
    const defaultCompanyName = draft.step1.company || user?.companyName || (user as any)?.company || '';
    if (!draft.step1.company && defaultCompanyName) {
      updateStep1({ company: defaultCompanyName });
    }

    form.setFieldsValue({
      // Step 1
      serviceType: draft.step1.serviceType,
      title: draft.step1.title,
      company: defaultCompanyName,
      industryCode: draft.step1.industryCode,
      location: draft.step1.location,
      remote: draft.step1.remote,
      headcount: draft.step1.headcount,
      experienceMin: draft.step1.experienceMin,
      experienceMax: draft.step1.experienceMax,
      salaryMin: draft.step1.salaryMin,
      salaryMax: draft.step1.salaryMax,
      currency: draft.step1.currency,
      negotiable: draft.step1.negotiable,
      // Step 2
      mustHaveTags: draft.step2.mustHaveTags,
      shouldHaveTags: draft.step2.shouldHaveTags,
      description: draft.step2.description,
      // Step 3
      objectives: draft.step3.objectives,
      successCriteria: draft.step3.successCriteria,
      // Step 4
      commissionRate: draft.step4.commissionRate,
      retainerFee: draft.step4.retainerFee,
      timeline: draft.step4.timeline,
      budget: draft.step4.budget,
      notes: draft.step4.notes,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Auto-save: debounce 1s after any form change
  const handleFormValuesChange = useCallback(
    (changed: Record<string, unknown>) => {
      // Route changed values to the appropriate step store slice
      const s1Keys: Array<keyof JobWizardDraft['step1']> = [
        'title', 'company', 'industryCode', 'location', 'remote',
        'headcount', 'experienceMin', 'experienceMax',
        'salaryMin', 'salaryMax', 'currency', 'negotiable', 'deadline',
      ];
      const s2Keys: Array<keyof JobWizardDraft['step2']> = [
        'mustHaveTags', 'shouldHaveTags', 'description',
      ];
      const s3Keys: Array<keyof JobWizardDraft['step3']> = [
        'objectives', 'successCriteria',
      ];
      const s4Keys: Array<keyof JobWizardDraft['step4']> = [
        'commissionRate', 'retainerFee', 'timeline', 'budget', 'notes',
      ];

      const pick = <T extends Record<string, unknown>>(
        obj: Record<string, unknown>,
        keys: string[]
      ): Partial<T> =>
        Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]])) as Partial<T>;

      const d1 = pick<JobWizardDraft['step1']>(changed, s1Keys as string[]);
      const d2 = pick<JobWizardDraft['step2']>(changed, s2Keys as string[]);
      const d3 = pick<JobWizardDraft['step3']>(changed, s3Keys as string[]);
      const d4 = pick<JobWizardDraft['step4']>(changed, s4Keys as string[]);

      if (Object.keys(d1).length > 0) updateStep1(d1);
      if (Object.keys(d2).length > 0) updateStep2(d2);
      if (Object.keys(d3).length > 0) updateStep3(d3);
      if (Object.keys(d4).length > 0) updateStep4(d4);

      // Debounce auto-save
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 1000);
    },
    [updateStep1, updateStep2, updateStep3, updateStep4, saveDraft]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleServiceTypeChange = useCallback(
    (type: ServiceType) => {
      updateStep1({ serviceType: type });
      form.setFieldValue('serviceType', type);
      form.validateFields(['serviceType']).catch(() => void 0);
    },
    [updateStep1, form]
  );

  const handleNext = async () => {
    try {
      await form.validateFields(STEPS[currentStep].validateFields);
      setStep(currentStep + 1);
      // Scroll to top of wizard card
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Validation errors displayed inline by Ant Design
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const result = await mockPublishJob({ draft });
      const newJobId = result.jobId;
      setPublishedJobId(newJobId);
      saveDraft();

      // ─── Persist job to localStorage for HR review ───────────────────────
      const industryLabels: Record<string, string> = {
        IT: 'Công nghệ thông tin',
        FINANCE: 'Tài chính – Ngân hàng',
        MARKETING: 'Marketing – Truyền thông',
        SALES: 'Kinh doanh – Bán hàng',
        ENGINEERING: 'Kỹ thuật – Sản xuất',
        HR: 'Nhân sự',
        HEALTHCARE: 'Y tế – Dược phẩm',
        EDUCATION: 'Giáo dục – Đào tạo',
        LOGISTICS: 'Logistics – Vận tải',
        LEGAL: 'Pháp lý',
        OTHER: 'Khác',
      };
      const serviceType = draft.step1.serviceType || ServiceType.HEADHUNT_COD;
      const formattedJob: Job = {
        id: newJobId,
        title: draft.step1.title || 'Vị trí chưa đặt tên',
        company: draft.step1.company || user?.company || 'Công ty',
        companyId: user?.id || 'client-unknown',
        industryCode: draft.step1.industryCode || 'IT',
        industryLabel: industryLabels[draft.step1.industryCode] || 'Khác',
        serviceType,
        status: JobStatus.PENDING,
        location: draft.step1.location || 'Hồ Chí Minh, Việt Nam',
        remote: draft.step1.remote || false,
        salaryRange: {
          min: (draft.step1.salaryMin || 0) * (draft.step1.currency === 'USD' ? 1 : 1),
          max: (draft.step1.salaryMax || 0) * (draft.step1.currency === 'USD' ? 1 : 1),
          currency: draft.step1.currency || 'VND',
          negotiable: draft.step1.negotiable ?? true,
        },
        mustHaveTags: draft.step2.mustHaveTags || [],
        shouldHaveTags: draft.step2.shouldHaveTags || [],
        objectives: draft.step3.objectives || '',
        description: draft.step2.description || '',
        headcount: draft.step1.headcount || 1,
        experienceYears: {
          min: draft.step1.experienceMin || 0,
          max: draft.step1.experienceMax || 5,
        },
        engagementTerms: {
          timeline: draft.step4.timeline || 30,
          commissionRate: draft.step4.commissionRate || 15,
          retainerFee: draft.step4.retainerFee || 0,
          budget: draft.step4.budget || 0,
        },
        requirements: draft.step2.requirements || [],
        clientContactId: user?.id || 'client-unknown',
        clientId: user?.id,
        clientEmail: user?.email,
        applicationCount: 0,
        shortlistedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deadline: draft.step1.deadline || undefined,
        servicePackage: SERVICE_TYPE_LABELS[serviceType] || 'Tuyển dụng trọn gói (COD)',
      };

      // Single Source of Truth: Save directly into hrconnect_all_jobs
      saveJobToAllJobs(formattedJob);

      // Backward-compat: also save to legacy client jobs store
      saveClientJob({
        ...formattedJob,
        status: 'PENDING',
        postedByName: user?.name || 'Client',
        postedByEmail: user?.email,
        clientId: user?.id,
        clientEmail: user?.email,
      });
      // ─────────────────────────────────────────────────────────────────────

      setSubmitted(true);
      message.success({
        content: 'Tin tuyển dụng đã được gửi và đang chờ HR phê duyệt. Bạn sẽ nhận thông báo khi tin được kích hoạt.',
        duration: 5,
      });
    } catch {
      message.error('Đăng tin thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    resetDraft();
    form.resetFields();
    setSubmitted(false);
    setPublishedJobId(null);
  };

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto' }}>
        <Result
          status="success"
          title="Tin tuyển dụng đã được gửi thành công! 🎉"
          subTitle={
            <div>
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Tag
                  color="warning"
                  style={{ borderRadius: 6, fontWeight: 700, fontSize: 12, padding: '3px 10px' }}
                >
                  ⏳ Chờ HR Phê duyệt
                </Tag>
                <span style={{ fontSize: 13, color: '#92400e' }}>
                  Tin đang chờ HR nội bộ xem xét và phê duyệt. Sau khi được duyệt, tin sẽ tự động hiển thị trên sàn.
                </span>
              </div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                Gói dịch vụ:{' '}
                <strong>
                  {draft.step1.serviceType === ServiceType.HEADHUNT_COD
                    ? 'Tuyển dụng trọn gói (COD)'
                    : draft.step1.serviceType === ServiceType.CV_SOURCING
                    ? 'Cung cấp hồ sơ (CV Sourcing)'
                    : 'Ứng tuyển mở (CV Application)'}
                </strong>
              </div>
              {publishedJobId && (
                <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                  Mã tin tuyển dụng: <code>{publishedJobId}</code>
                </div>
              )}
            </div>
          }
          extra={[
            <Button
              key="manage"
              onClick={() => navigate('/client/jobs')}
              size="large"
            >
              Quản lý tin tuyển dụng của tôi
            </Button>,
            <Button key="new" onClick={handleReset} size="large">
              Tạo thêm tin tuyển dụng khác
            </Button>,
          ]}
        />
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleFormValuesChange}
      requiredMark="optional"
    >
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Tạo tin tuyển dụng mới
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Hoàn thành biểu mẫu 4 bước để phát hành tin tuyển dụng lên nền tảng HR Connect.
            </Text>
          </div>
          <Space>
            {isDirty ? (
              <Tag
                color="warning"
                icon={<SaveOutlined />}
                style={{ borderRadius: 6, padding: '3px 10px', fontSize: 12 }}
              >
                Có thay đổi chưa lưu…
              </Tag>
            ) : lastSaved ? (
              <Tag
                color="success"
                icon={<CheckCircleOutlined />}
                style={{ borderRadius: 6, padding: '3px 10px', fontSize: 12 }}
              >
                Tự động lưu lúc {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Tag>
            ) : null}
          </Space>
        </div>
      </div>

      {/* Wizard card */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(0,0,0,0.07)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Steps header */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #f1f5f9',
            background: '#fafafa',
          }}
        >
          <Steps
            current={currentStep}
            items={STEPS.map(({ title, description, icon }) => ({
              title,
              description,
              icon,
            }))}
            size="small"
            style={{ maxWidth: 720, margin: '0 auto' }}
          />
        </div>

        {/* Step content */}
        <div style={{ padding: '32px 32px 24px' }}>
          <Spin spinning={submitting} tip="Đang xuất bản tin tuyển dụng…">
            {currentStep === 0 && (
              <WizardStep1ServiceType
                form={form}
                serviceType={draft.step1.serviceType}
                onServiceTypeChange={handleServiceTypeChange}
              />
            )}
            {currentStep === 1 && <WizardStep2TagFilters form={form} />}
            {currentStep === 2 && <WizardStep3Objectives form={form} />}
            {currentStep === 3 && <WizardStep4Engagement form={form} />}
          </Spin>
        </div>

        {/* Footer navigation */}
        <div
          style={{
            padding: '16px 32px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bước {currentStep + 1} / {STEPS.length}
            </Text>
            {currentStep < STEPS.length - 1 ? (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                onClick={handleNext}
                style={{ borderRadius: 8 }}
              >
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                style={{
                  borderRadius: 8,
                  background: '#10b981',
                  borderColor: '#10b981',
                  fontWeight: 600,
                  paddingInline: 24,
                }}
              >
                Đăng tin tuyển dụng
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Form>
  );
};

export default CreateJobWizard;

