/**
 * @file JobFormWizard.tsx
 * @description Multi-step Job Creation/Edit Wizard using react-hook-form + Zod (MF-01).
 * Features:
 *   - Step 1: Service Type selection (from GET /api/v1/service-types)
 *   - Step 2: Basic Info (Title, Location, Employment Type, Salary Min/Max, Currency, Quantity, Visibility)
 *   - Step 3: Detailed Job Description (JD)
 *   - Step 4: Requirements list (Dynamic add/remove, MUST_HAVE / SHOULD_HAVE, weight)
 *   - Action buttons: "Lưu bản nháp" (POST /api/v1/jobs) & "Gửi xét duyệt" (POST /submit)
 */

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Steps, Button, Card, Row, Col, Input, InputNumber,
  Select, Tag, Typography, Space, Popconfirm, message, Result,
} from 'antd';
import {
  CheckCircleOutlined, SaveOutlined, ArrowLeftOutlined,
  ArrowRightOutlined, SendOutlined, PlusOutlined, DeleteOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useServiceTypes,
  useCreateJobDraft,
  useUpdateJob,
  useSubmitJob,
  useJobDetail,
} from '@/services/queries/useJobs';
import type { CreateJobCommand, CreateJobRequirementRequest } from '@/types/mf01';

const { Title, Text, Paragraph } = Typography;

// ─── Zod Schema ──────────────────────────────────────────────────────────────

export const jobFormSchema = z
  .object({
    serviceTypeId: z.string().min(1, 'Vui lòng chọn loại dịch vụ tuyển dụng.'),
    title: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự.').max(150, 'Tiêu đề không quá 150 ký tự.'),
    location: z.string().min(2, 'Vui lòng nhập địa điểm làm việc.'),
    employmentType: z.string().default('FULL_TIME'),
    salaryMin: z.number().min(0, 'Mức lương tối thiểu không được âm.'),
    salaryMax: z.number().min(0, 'Mức lương tối đa không được âm.'),
    currencyCode: z.enum(['VND', 'USD']).default('VND'),
    quantity: z.number().int().min(1, 'Số lượng tuyển dụng tối thiểu là 1.'),
    visibility: z.enum(['PUBLIC', 'AFFILIATE_ONLY']).default('PUBLIC'),
    description: z.string().min(30, 'Mô tả công việc (JD) phải có ít nhất 30 ký tự.'),
    requirements: z
      .array(
        z.object({
          requirementType: z.enum(['MUST_HAVE', 'SHOULD_HAVE']),
          category: z.string().optional(),
          content: z.string().min(2, 'Nội dung kỹ năng/yêu cầu không được để trống.'),
          weight: z.number().min(0.1).max(2.0).default(1.0),
        })
      )
      .min(1, 'Vui lòng thêm ít nhất 1 tiêu chuẩn yêu cầu.'),
  })
  .refine((data) => data.salaryMax >= data.salaryMin, {
    message: 'Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.',
    path: ['salaryMax'],
  });

export type JobFormData = z.infer<typeof jobFormSchema>;

const STEPS = [
  { title: 'Gói Dịch Vụ', description: 'Chọn loại dịch vụ' },
  { title: 'Thông Tin Cơ Bản', description: 'Vị trí, lương, quy mô' },
  { title: 'Mô Tả JD', description: 'Chi tiết công việc' },
  { title: 'Tiêu Chuẩn Tuyển Chọn', description: 'Must-have & Should-have' },
];

export const JobFormWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editJobId = searchParams.get('jobId') || searchParams.get('edit') || null;

  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(editJobId);

  // Queries & Mutations
  const { data: serviceTypesData, isLoading: isLoadingServices } = useServiceTypes({ isActive: true });
  const { data: existingJob } = useJobDetail(editJobId || '');
  const createJobDraftMutation = useCreateJobDraft();
  const updateJobMutation = useUpdateJob();
  const submitJobMutation = useSubmitJob();

  const serviceTypes = serviceTypesData?.data?.items || [];

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      serviceTypeId: '',
      title: '',
      location: 'Hồ Chí Minh, Việt Nam',
      employmentType: 'FULL_TIME',
      salaryMin: 20000000,
      salaryMax: 40000000,
      currencyCode: 'VND',
      quantity: 1,
      visibility: 'PUBLIC',
      description: '',
      requirements: [
        { requirementType: 'MUST_HAVE', content: 'Có ít nhất 2 năm kinh nghiệm thực tế', weight: 1.0 },
        { requirementType: 'SHOULD_HAVE', content: 'Kỹ năng giao tiếp và làm việc nhóm', weight: 0.5 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'requirements',
  });

  const watchedServiceTypeId = watch('serviceTypeId');

  // Populate data when editing an existing job
  useEffect(() => {
    if (existingJob) {
      setValue('serviceTypeId', existingJob.serviceTypeId);
      setValue('title', existingJob.title);
      setValue('location', existingJob.location || 'Hồ Chí Minh');
      setValue('employmentType', existingJob.employmentType || 'FULL_TIME');
      setValue('salaryMin', existingJob.salaryMin || 0);
      setValue('salaryMax', existingJob.salaryMax || 0);
      setValue('currencyCode', (existingJob.currencyCode as 'VND' | 'USD') || 'VND');
      setValue('quantity', existingJob.quantity || 1);
      setValue('visibility', (existingJob.visibility as 'PUBLIC' | 'AFFILIATE_ONLY') || 'PUBLIC');
      setValue('description', existingJob.description || '');
      if (existingJob.requirements && existingJob.requirements.length > 0) {
        setValue(
          'requirements',
          existingJob.requirements.map((r) => ({
            requirementType: (r.requirementType as 'MUST_HAVE' | 'SHOULD_HAVE') || 'MUST_HAVE',
            category: r.category || undefined,
            content: r.content,
            weight: r.weight || 1.0,
          }))
        );
      }
    }
  }, [existingJob, setValue]);

  // Set default service type once loaded
  useEffect(() => {
    if (!watchedServiceTypeId && serviceTypes.length > 0) {
      setValue('serviceTypeId', serviceTypes[0].id);
    }
  }, [serviceTypes, watchedServiceTypeId, setValue]);

  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 0) {
      isValid = await trigger(['serviceTypeId']);
    } else if (currentStep === 1) {
      isValid = await trigger(['title', 'location', 'salaryMin', 'salaryMax', 'currencyCode', 'quantity', 'visibility']);
    } else if (currentStep === 2) {
      isValid = await trigger(['description']);
    } else if (currentStep === 3) {
      isValid = await trigger(['requirements']);
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const toCreateCommand = (data: JobFormData): CreateJobCommand => {
    return {
      serviceTypeId: data.serviceTypeId,
      title: data.title,
      description: data.description,
      location: data.location,
      employmentType: data.employmentType,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      currencyCode: data.currencyCode,
      quantity: data.quantity,
      visibility: data.visibility,
      requirements: data.requirements as CreateJobRequirementRequest[],
    };
  };

  // Action 1: Lưu bản nháp (POST /api/v1/jobs hoặc PUT /api/v1/jobs/{jobId})
  const onSaveDraft = async () => {
    const data = watch();
    if (!data.title || !data.serviceTypeId) {
      message.warning('Vui lòng chọn loại dịch vụ và nhập tiêu đề tin tuyển dụng trước khi lưu nháp.');
      return;
    }

    try {
      const command = toCreateCommand(data);
      if (editJobId) {
        await updateJobMutation.mutateAsync({ jobId: editJobId, command });
        message.success('Đã cập nhật bản nháp tin tuyển dụng (PUT /api/v1/jobs/{jobId})!');
      } else {
        const res = await createJobDraftMutation.mutateAsync(command);
        setCreatedJobId(res.data.jobId);
        message.success('Đã lưu bản nháp tin tuyển dụng thành công (POST /api/v1/jobs)!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu nháp thất bại.';
      message.error(msg);
    }
  };

  // Action 2: Gửi xét duyệt (POST /api/v1/jobs/{jobId}/submit)
  const onSubmitForReview = async (data: JobFormData) => {
    try {
      const command = toCreateCommand(data);
      let targetJobId = editJobId || createdJobId;

      if (!targetJobId) {
        const res = await createJobDraftMutation.mutateAsync(command);
        targetJobId = res.data.jobId;
        setCreatedJobId(targetJobId);
      } else {
        await updateJobMutation.mutateAsync({ jobId: targetJobId, command });
      }

      await submitJobMutation.mutateAsync(targetJobId);
      setSubmitted(true);
      message.success('Tin tuyển dụng đã gửi xét duyệt thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi xét duyệt thất bại.';
      message.error(msg);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <Result
          status="success"
          title="Gửi Tin Tuyển Dụng Thành Công! 🎉"
          subTitle="Tin tuyển dụng của bạn đã được chuyển vào hàng đợi xét duyệt của Internal HR. Bạn sẽ nhận thông báo khi tin được kích hoạt."
          extra={[
            <Button type="primary" key="my-jobs" onClick={() => navigate('/client/jobs')} className="rounded-xl font-bold bg-blue-600 h-10 px-6">
              Quản lý danh sách tin của tôi
            </Button>,
            <Button key="new" onClick={() => window.location.reload()} className="rounded-xl font-semibold h-10">
              Tạo thêm tin tuyển dụng khác
            </Button>,
          ]}
        />
      </div>
    );
  }

  const isMutating =
    createJobDraftMutation.isPending ||
    updateJobMutation.isPending ||
    submitJobMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
            {editJobId ? 'Chỉnh Sửa Tin Tuyển Dụng' : 'Tạo Tin Tuyển Dụng Mới'}
          </Title>
          <Text className="text-slate-500 text-xs block mt-1">
            Quy trình tạo tin tuyển dụng chuẩn MF-01 tích hợp API Backend và xác thực Zod.
          </Text>
        </div>

        <Space>
          <Button
            icon={<SaveOutlined />}
            onClick={onSaveDraft}
            loading={createJobDraftMutation.isPending || updateJobMutation.isPending}
            disabled={isMutating}
            className="rounded-xl font-semibold"
          >
            Lưu bản nháp
          </Button>
        </Space>
      </div>

      {/* ── Wizard Card ── */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs overflow-hidden" styles={{ body: { padding: 0 } }}>
        <div className="p-6 border-b border-slate-100 bg-slate-50/60">
          <Steps current={currentStep} items={STEPS} size="small" className="max-w-2xl mx-auto" />
        </div>

        <form onSubmit={handleSubmit(onSubmitForReview)} className="p-8">
          {/* ── Bước 1: Chọn Service Type ── */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">Bước 1: Chọn Gói Dịch Vụ Tuyển Dụng</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Dữ liệu được nạp trực tiếp từ endpoint GET /api/v1/service-types.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {serviceTypes.map((st) => {
                  const isSelected = watchedServiceTypeId === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setValue('serviceTypeId', st.id)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <CheckCircleOutlined className="absolute top-4 right-4 text-blue-600 text-base" />
                      )}
                      <Tag color={isSelected ? 'blue' : 'default'} className="font-bold text-[10px] uppercase rounded-md mb-2">
                        {st.code || 'PACKAGE'}
                      </Tag>
                      <div className="font-bold text-sm text-slate-900 mb-1">{st.name}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{st.description}</div>
                      {st.code === 'HEADHUNT_COD' && (
                        <div className="mt-3 text-[11px] text-sky-600 font-semibold flex items-center gap-1">
                          <SafetyCertificateOutlined /> Bảo hành 60 ngày
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {errors.serviceTypeId && (
                <span className="text-xs text-red-500 block">{errors.serviceTypeId.message}</span>
              )}
            </div>
          )}

          {/* ── Bước 2: Thông tin cơ bản ── */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">Bước 2: Thông Tin Tuyển Dụng Cơ Bản</h3>
                <p className="text-xs text-slate-500 mt-1">Thiết lập vị trí, mức lương và chế độ hiển thị việc làm.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tiêu đề vị trí tuyển dụng <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <Input {...field} placeholder="Ví dụ: Senior Backend Java Engineer (Microservices)" className="rounded-xl h-10" />
                    )}
                  />
                  {errors.title && <span className="text-xs text-red-500 block mt-1">{errors.title.message}</span>}
                </div>

                <Row gutter={16}>
                  <Col span={14}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Địa điểm làm việc <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      control={control}
                      name="location"
                      render={({ field }) => (
                        <Input {...field} placeholder="Ví dụ: TP. Hồ Chí Minh" className="rounded-xl h-10" />
                      )}
                    />
                    {errors.location && <span className="text-xs text-red-500 block mt-1">{errors.location.message}</span>}
                  </Col>
                  <Col span={10}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Hình thức làm việc</label>
                    <Controller
                      control={control}
                      name="employmentType"
                      render={({ field }) => (
                        <Select
                          {...field}
                          className="w-full h-10"
                          options={[
                            { value: 'FULL_TIME', label: 'Toàn thời gian (Full-time)' },
                            { value: 'PART_TIME', label: 'Bán thời gian (Part-time)' },
                            { value: 'CONTRACT', label: 'Hợp đồng dự án (Contract)' },
                            { value: 'REMOTE', label: 'Từ xa (Remote)' },
                          ]}
                        />
                      )}
                    />
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={9}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Lương tối thiểu</label>
                    <Controller
                      control={control}
                      name="salaryMin"
                      render={({ field }) => (
                        <InputNumber
                          {...field}
                          className="w-full h-10 rounded-xl"
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') || 0)}
                        />
                      )}
                    />
                    {errors.salaryMin && <span className="text-xs text-red-500 block mt-1">{errors.salaryMin.message}</span>}
                  </Col>
                  <Col span={9}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Lương tối đa</label>
                    <Controller
                      control={control}
                      name="salaryMax"
                      render={({ field }) => (
                        <InputNumber
                          {...field}
                          className="w-full h-10 rounded-xl"
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') || 0)}
                        />
                      )}
                    />
                    {errors.salaryMax && <span className="text-xs text-red-500 block mt-1">{errors.salaryMax.message}</span>}
                  </Col>
                  <Col span={6}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Tiền tệ</label>
                    <Controller
                      control={control}
                      name="currencyCode"
                      render={({ field }) => (
                        <Select
                          {...field}
                          className="w-full h-10"
                          options={[
                            { value: 'VND', label: 'VND' },
                            { value: 'USD', label: 'USD' },
                          ]}
                        />
                      )}
                    />
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Số lượng tuyển dụng</label>
                    <Controller
                      control={control}
                      name="quantity"
                      render={({ field }) => <InputNumber {...field} min={1} className="w-full h-10 rounded-xl" />}
                    />
                  </Col>
                  <Col span={12}>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Phạm vi hiển thị (Visibility)</label>
                    <Controller
                      control={control}
                      name="visibility"
                      render={({ field }) => (
                        <Select
                          {...field}
                          className="w-full h-10"
                          options={[
                            { value: 'PUBLIC', label: 'Công khai toàn hệ thống (PUBLIC)' },
                            { value: 'AFFILIATE_ONLY', label: 'Chỉ mạng lưới Headhunter (AFFILIATE_ONLY)' },
                          ]}
                        />
                      )}
                    />
                  </Col>
                </Row>
              </div>
            </div>
          )}

          {/* ── Bước 3: Nội dung JD chi tiết ── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">Bước 3: Bản Mô Tả Công Việc (Job Description)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Mô tả chi tiết trách nhiệm, quyền lợi và môi trường làm việc để ứng viên nắm bắt rõ.
                </p>
              </div>

              <div>
                <Controller
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <Input.TextArea
                      {...field}
                      rows={10}
                      placeholder="Nhập mô tả chi tiết công việc, quyền lợi, phúc lợi và quy trình phỏng vấn..."
                      className="rounded-xl p-3 text-xs"
                      showCount
                      maxLength={5000}
                    />
                  )}
                />
                {errors.description && (
                  <span className="text-xs text-red-500 block mt-1">{errors.description.message}</span>
                )}
              </div>
            </div>
          )}

          {/* ── Bước 4: Tiêu chuẩn Must-have / Should-have ── */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Bước 4: Tiêu Chuẩn Sàng Lọc ATS (Must-Have / Should-Have)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Hệ thống Sentence-BERT sẽ dựa vào các tiêu chuẩn này để tự động chấm điểm và xếp hạng ứng viên.
                  </p>
                </div>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => append({ requirementType: 'MUST_HAVE', content: '', weight: 1.0 })}
                  className="rounded-xl font-semibold"
                >
                  Thêm yêu cầu
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-3">
                    <Controller
                      control={control}
                      name={`requirements.${index}.requirementType`}
                      render={({ field }) => (
                        <Select
                          {...field}
                          className="w-48"
                          options={[
                            { value: 'MUST_HAVE', label: 'Bắt buộc (Must-Have)' },
                            { value: 'SHOULD_HAVE', label: 'Ưu tiên (Should-Have)' },
                          ]}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`requirements.${index}.content`}
                      render={({ field }) => (
                        <Input {...field} placeholder="Nội dung kỹ năng hoặc tiêu chuẩn cụ thể (ví dụ: 3+ năm React)" className="flex-1 rounded-lg" />
                      )}
                    />
                    <div className="flex items-center gap-1.5 w-32">
                      <span className="text-xs text-slate-400">Weight:</span>
                      <Controller
                        control={control}
                        name={`requirements.${index}.weight`}
                        render={({ field }) => (
                          <InputNumber {...field} min={0.1} max={2.0} step={0.1} className="w-16 rounded-lg" />
                        )}
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(index)}
                      />
                    )}
                  </div>
                ))}
              </div>
              {errors.requirements && (
                <span className="text-xs text-red-500 block">{errors.requirements.message}</span>
              )}
            </div>
          )}

          {/* ── Footer Navigation ── */}
          <div className="flex items-center justify-between pt-8 border-t border-slate-100 mt-8">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              disabled={currentStep === 0 || isMutating}
              className="rounded-xl font-semibold"
            >
              Quay lại
            </Button>

            <div className="flex items-center gap-3">
              <Button
                icon={<SaveOutlined />}
                onClick={onSaveDraft}
                loading={createJobDraftMutation.isPending || updateJobMutation.isPending}
                disabled={isMutating}
                className="rounded-xl font-semibold"
              >
                Lưu nháp
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={handleNext}
                  className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 h-10 px-6 border-none"
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={submitJobMutation.isPending}
                  disabled={isMutating}
                  className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 h-10 px-6 border-none text-white shadow-sm"
                >
                  Gửi xét duyệt
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default JobFormWizard;
