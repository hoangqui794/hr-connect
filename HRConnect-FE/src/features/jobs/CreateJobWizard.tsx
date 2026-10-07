/**
 * @file CreateJobWizard.tsx
 * @description Production-grade 4-step Job Creation Wizard for HR Connect.
 * Implements MF-01 | SCR-CLI-01 (Client Portal — Post New Job).
 *
 * Architecture:
 *   - Single Ant Design <Form> instance owns all 4 steps' field state.
 *   - Each step validates only its own fields before allowing advancement.
 *   - Draft is persisted to Zustand store (useJobStore) with 1s auto-save debounce.
 *   - Service type selection in Step 0 is reflected live in Step 3 (commission logic).
 *   - On final submission, a simulated API call is made (mock-first contract).
 *   - On success, a Result screen is shown with navigation options.
 *
 * Step definitions:
 *   Bước 0 (currentStep === 0) → Thông tin vị trí & Dịch vụ tuyển dụng (Chức danh, Service type: COD / Sourcing / Application)
 *   Bước 1 (currentStep === 1) → Tiêu chuẩn sàng lọc (Must-have & Should-have keywords, Mô tả công việc)
 *   Bước 2 (currentStep === 2) → Mục tiêu thử việc (KPIs & Tiêu chí đánh giá)
 *   Bước 3 (currentStep === 3) → Chế độ đãi ngộ & Hoa hồng (Mức lương, % Hoa hồng CTV 20.5%, Đặt cọc, Bảo hành 60 ngày)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Steps, Button, Card, Space, Typography, Tag, message,
  Result, Spin, Form, theme,
} from 'antd';
import {
  FileTextOutlined, TagsOutlined, TrophyOutlined, DollarOutlined,
  SaveOutlined, CheckCircleOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useJobStore } from '@/stores/jobStore';
import { useAuthStore } from '@/stores/authStore';
import { ServiceType, JobStatus, SERVICE_TYPE_LABELS } from '@/types/job';
import type { JobWizardDraft, Job } from '@/types/job';
import { saveClientJob } from '@/stores/clientJobStore';
import { saveJobToAllJobs } from '@/services/localStorageService';
import {
  useCreateJobDraft,
  useUpdateJob,
  useSubmitJob,
  useJobDetail,
} from '@/services/queries/useJobs';
import type { CreateJobCommand, CreateJobRequirementRequest } from '@/types/mf01';
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

// ─── Mock API layer (300ms latency) ──────────────────────────────────────────

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

// ─── CreateJobWizard Component ────────────────────────────────────────────────

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

  // 1. currentStep luôn khởi tạo bằng 0: đảm bảo vào trang luôn ở Bước 1 (Thông tin vị trí & Dịch vụ)
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [publishedJobId, setPublishedJobId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchParams] = useSearchParams();
  const editJobId = searchParams.get('jobId') || searchParams.get('edit') || null;
  const { data: existingJob } = useJobDetail(editJobId || '');

  const createJobDraftMutation = useCreateJobDraft();
  const updateJobMutation = useUpdateJob();
  const submitJobMutation = useSubmitJob();

  // Sync form initial values from Zustand draft on mount & force start at Step 0
  useEffect(() => {
    setCurrentStep(0);
    setStep(0);

    const defaultCompanyName = draft.step1.company || user?.companyName || (user as any)?.company || '';
    if (!draft.step1.company && defaultCompanyName) {
      updateStep1({ company: defaultCompanyName });
    }

    form.setFieldsValue({
      // Bước 0: Thông tin vị trí & Dịch vụ tuyển dụng
      serviceType: draft.step1.serviceType || ServiceType.HEADHUNT_COD,
      title: draft.step1.title,
      company: defaultCompanyName,
      industryCode: draft.step1.industryCode || 'IT',
      location: draft.step1.location || 'Hồ Chí Minh, Việt Nam',
      remote: draft.step1.remote ?? false,
      headcount: draft.step1.headcount || 1,
      experienceMin: draft.step1.experienceMin ?? 3,
      experienceMax: draft.step1.experienceMax ?? 5,
      salaryMin: draft.step1.salaryMin ?? 25000000,
      salaryMax: draft.step1.salaryMax ?? 40000000,
      currency: draft.step1.currency || 'VND',
      negotiable: draft.step1.negotiable ?? true,
      // Bước 1: Tiêu chuẩn sàng lọc
      mustHaveTags: draft.step2.mustHaveTags || [],
      shouldHaveTags: draft.step2.shouldHaveTags || [],
      description: draft.step2.description || '',
      // Bước 2: Mục tiêu thử việc
      objectives: draft.step3.objectives || '',
      successCriteria: draft.step3.successCriteria || '',
      // Bước 3: Chế độ đãi ngộ & Hoa hồng
      commissionRate: draft.step4.commissionRate || 20.5,
      retainerFee: draft.step4.retainerFee || 0,
      timeline: draft.step4.timeline || 30,
      budget: draft.step4.budget || 0,
      notes: draft.step4.notes || '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Auto-save: debounce 1s after any form change
  const handleFormValuesChange = useCallback(
    (changed: Record<string, unknown>) => {
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

  // 4. Hai hàm điều hướng: handleNextStep (validate fields trước khi chuyển) và handlePrevStep
  const handleNextStep = async () => {
    try {
      const fieldsToValidate = STEPS[currentStep]?.validateFields || [];
      await form.validateFields(fieldsToValidate);
      const nextStep = Math.min(currentStep + 1, STEPS.length - 1);
      setCurrentStep(nextStep);
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Validation errors are displayed inline by Ant Design
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setStep(prevStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const buildCommand = (): CreateJobCommand => {
    const vals = form.getFieldsValue(true);
    const requirements: CreateJobRequirementRequest[] = [
      ...(vals.mustHaveTags || []).map((t: string) => ({
        requirementType: 'MUST_HAVE',
        content: t,
        weight: 1.0,
      })),
      ...(vals.shouldHaveTags || []).map((t: string) => ({
        requirementType: 'SHOULD_HAVE',
        content: t,
        weight: 0.5,
      })),
    ];
    return {
      serviceTypeId: vals.serviceTypeId || vals.serviceType || 'st-001',
      title: vals.title || 'Vị trí tuyển dụng',
      description: vals.description || '',
      location: vals.location || 'Hồ Chí Minh, Việt Nam',
      employmentType: vals.remote ? 'REMOTE' : 'FULL_TIME',
      salaryMin: Number(vals.salaryMin) || 0,
      salaryMax: Number(vals.salaryMax) || 0,
      currencyCode: vals.currency || 'VND',
      quantity: Number(vals.headcount) || 1,
      visibility: 'PUBLIC',
      requirements,
    };
  };

  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      const command = buildCommand();
      if (editJobId) {
        await updateJobMutation.mutateAsync({ jobId: editJobId, command });
        message.success('Đã cập nhật bản nháp tin tuyển dụng (PUT /api/v1/jobs/{jobId})');
      } else {
        const res = await createJobDraftMutation.mutateAsync(command);
        setPublishedJobId(res.data.jobId);
        message.success('Đã lưu bản nháp thành công! (POST /api/v1/jobs)');
      }
      saveDraft();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lưu nháp thất bại';
      message.error(errMsg);
    } finally {
      setIsSavingDraft(false);
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
      const command = buildCommand();
      let targetJobId = editJobId || publishedJobId;
      if (!targetJobId) {
        const res = await createJobDraftMutation.mutateAsync(command);
        targetJobId = res.data.jobId;
        setPublishedJobId(targetJobId);
      } else {
        await updateJobMutation.mutateAsync({ jobId: targetJobId, command });
      }

      // POST /api/v1/jobs/{jobId}/submit
      await submitJobMutation.mutateAsync(targetJobId);
      saveDraft();
      setSubmitted(true);
      message.success({
        content: 'Tin tuyển dụng đã gửi xét duyệt thành công (POST /api/v1/jobs/{jobId}/submit) và đang chờ HR duyệt!',
        duration: 5,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Đăng tin thất bại. Vui lòng thử lại.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    resetDraft();
    form.resetFields();
    setCurrentStep(0);
    setStep(0);
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

  // ── Wizard Form ────────────────────────────────────────────────────────────

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
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={isSavingDraft || createJobDraftMutation.isPending || updateJobMutation.isPending}
              disabled={submitting || submitJobMutation.isPending}
              size="middle"
              style={{ borderRadius: 8 }}
            >
              Lưu bản nháp
            </Button>
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
        {/* Steps header: Hiển thị 4 bước rõ ràng */}
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

        {/* Step content: Render tuần tự đúng bước 0, 1, 2, 3 */}
        <div style={{ padding: '32px 32px 24px' }}>
          <Spin spinning={submitting} tip="Đang xuất bản tin tuyển dụng…">
            {/* Bước 0: Thông tin vị trí & Dịch vụ tuyển dụng */}
            {currentStep === 0 && (
              <WizardStep1ServiceType
                form={form}
                serviceType={draft.step1.serviceType}
                onServiceTypeChange={handleServiceTypeChange}
              />
            )}

            {/* Bước 1: Tiêu chuẩn sàng lọc */}
            {currentStep === 1 && <WizardStep2TagFilters form={form} />}

            {/* Bước 2: Mục tiêu thử việc */}
            {currentStep === 2 && <WizardStep3Objectives form={form} />}

            {/* Bước 3: Chế độ đãi ngộ & Hoa hồng (Thẻ Card hoa hồng CHỈ render ở đây khi currentStep === 3) */}
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
            onClick={handlePrevStep}
            disabled={currentStep === 0}
            style={{ borderRadius: 8 }}
          >
            Quay lại
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={isSavingDraft || createJobDraftMutation.isPending || updateJobMutation.isPending}
              disabled={submitting || submitJobMutation.isPending}
              style={{ borderRadius: 8 }}
            >
              Lưu bản nháp
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bước {currentStep + 1} / {STEPS.length}
            </Text>
            {currentStep < STEPS.length - 1 ? (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                onClick={handleNextStep}
                disabled={isSavingDraft || submitting}
                style={{ borderRadius: 8, background: '#00b14f', borderColor: '#00b14f' }}
              >
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={handleSubmit}
                loading={submitting || submitJobMutation.isPending}
                disabled={isSavingDraft}
                style={{
                  borderRadius: 8,
                  background: '#00b14f',
                  borderColor: '#00b14f',
                  fontWeight: 600,
                  paddingInline: 24,
                }}
              >
                Gửi xét duyệt
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Form>
  );
};

export default CreateJobWizard;
