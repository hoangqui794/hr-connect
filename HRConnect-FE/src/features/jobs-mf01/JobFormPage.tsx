/**
 * @file JobFormPage.tsx
 * @description MF-01 · Client Company — create (POST /jobs) or edit (PUT /jobs/{id}) a job.
 * The form contains exactly the fields of CreateJobCommand / UpdateJobCommand; nothing the
 * backend cannot store. "Lưu & gửi duyệt" saves first, then calls POST /jobs/{id}/submit.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Skeleton,
  Switch,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type {
  EmploymentType,
  Job,
  JobRequirementType,
  JobUpsertInput,
  JobVisibility,
  ServiceType,
} from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { jobsApi } from '@/services/api/jobsApi';
import { useJobDetail, useJobMutations, useServiceTypes } from './useJobQueries';
import {
  EMPLOYMENT_TYPE_LABEL,
  SERVICE_TYPE_LABEL,
  VISIBILITY_LABEL,
  allowedVisibilities,
  clientActions,
} from './jobDisplay';

const { Title, Text } = Typography;

interface RequirementRow {
  requirementType: JobRequirementType;
  content: string;
  category?: string;
}

interface JobFormValues {
  serviceTypeId: string;
  visibility: JobVisibility;
  title: string;
  employmentType?: EmploymentType;
  location?: string;
  workingTime?: string;
  quantity: number;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode: string;
  salaryNegotiable: boolean;
  salaryNote?: string;
  description?: string;
  benefits?: string;
  requirements: RequirementRow[];
}

const EMPTY_VALUES: Partial<JobFormValues> = {
  quantity: 1,
  currencyCode: 'VND',
  salaryNegotiable: false,
  requirements: [{ requirementType: 'MUST_HAVE', content: '' }],
};

const toFormValues = (job: Job): JobFormValues => ({
  serviceTypeId: job.serviceTypeId,
  visibility: job.visibility,
  title: job.title,
  employmentType: job.employmentType ?? undefined,
  location: job.location ?? undefined,
  workingTime: job.workingTime ?? undefined,
  quantity: job.quantity,
  minExperienceYears: job.minExperienceYears,
  maxExperienceYears: job.maxExperienceYears,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  currencyCode: job.currencyCode,
  salaryNegotiable: job.salaryNegotiable,
  salaryNote: job.salaryNote ?? undefined,
  description: job.description ?? undefined,
  benefits: job.benefits ?? undefined,
  requirements: job.requirements.map((r) => ({
    requirementType: r.requirementType,
    content: r.content,
    category: r.category ?? undefined,
  })),
});

const trimOrNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);

/** Mirrors SubmitJobCommandHandler: fields the backend requires before PENDING_REVIEW. */
const submitBlockers = (v: JobFormValues): { field: (string | number)[]; message: string }[] => {
  const missing: { field: (string | number)[]; message: string }[] = [];
  const need = (field: keyof JobFormValues, message: string) => {
    if (!trimOrNull(v[field] as string | undefined)) missing.push({ field: [field], message });
  };
  need('title', 'Nhập tên vị trí.');
  need('description', 'Nhập mô tả công việc.');
  need('benefits', 'Nhập quyền lợi.');
  need('location', 'Nhập địa điểm làm việc.');
  if (!v.employmentType) missing.push({ field: ['employmentType'], message: 'Chọn hình thức làm việc.' });
  if (!(v.requirements ?? []).some((r) => r?.requirementType === 'MUST_HAVE' && r.content?.trim()))
    missing.push({ field: ['requirements'], message: 'Thêm ít nhất một yêu cầu bắt buộc.' });
  return missing;
};

/** Label suffix for fields only required when submitting for review. */
const SubmitHint: React.FC = () => <span className="ml-1 text-xs font-normal text-slate-500">(cần khi gửi duyệt)</span>;

const toInput = (v: JobFormValues): JobUpsertInput => ({
  serviceTypeId: v.serviceTypeId,
  visibility: v.visibility,
  title: v.title.trim(),
  employmentType: v.employmentType ?? null,
  location: trimOrNull(v.location),
  workingTime: trimOrNull(v.workingTime),
  quantity: v.quantity,
  minExperienceYears: v.minExperienceYears ?? null,
  maxExperienceYears: v.maxExperienceYears ?? null,
  salaryMin: v.salaryMin ?? null,
  salaryMax: v.salaryMax ?? null,
  currencyCode: v.currencyCode,
  salaryNegotiable: v.salaryNegotiable,
  salaryNote: trimOrNull(v.salaryNote),
  description: trimOrNull(v.description),
  benefits: trimOrNull(v.benefits),
  requirements: (v.requirements ?? [])
    .filter((r) => r.content?.trim())
    .map((r) => ({ requirementType: r.requirementType, content: r.content.trim(), category: trimOrNull(r.category) })),
  skills: [],
});

/** Maps ASP.NET ValidationProblem keys ("Title", "Requirements[0].Content") onto form fields. */
const applyServerFieldErrors = (form: FormInstance<JobFormValues>, error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const errors = (error.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors;
  if (!errors) return false;
  const fields = Object.entries(errors).map(([key, messages]) => {
    const path = key
      .split('.')
      .flatMap((part) => {
        const m = part.match(/^(\w+)\[(\d+)\]$/);
        const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
        return m ? [camel(m[1]), Number(m[2])] : [camel(part)];
      });
    return { name: path as (string | number)[], errors: messages };
  });
  // Server paths are dynamic, so they cannot satisfy antd's literal NamePath union.
  form.setFields(fields as Parameters<typeof form.setFields>[0]);
  return fields.length > 0;
};

const ServiceTypePicker: React.FC<{
  value?: string;
  onChange?: (id: string) => void;
  options: ServiceType[];
  disabled: boolean;
}> = ({ value, onChange, options, disabled }) => (
  <Radio.Group value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} className="w-full">
    <div className="grid gap-3 md:grid-cols-3">
      {options.map((st) => {
        const meta = SERVICE_TYPE_LABEL[st.code];
        const selected = value === st.id;
        return (
          <label
            key={st.id}
            className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors duration-200 ${
              selected ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 hover:border-slate-400'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <Radio value={st.id}>
              <span className="font-semibold text-slate-900">{meta?.label ?? st.name}</span>
            </Radio>
            <span className="pl-6 text-xs text-slate-600">{meta?.summary ?? st.description}</span>
          </label>
        );
      })}
    </div>
  </Radio.Group>
);

export const JobFormPage: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const isEdit = Boolean(jobId);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<JobFormValues>();
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const serviceTypes = useServiceTypes();
  const existing = useJobDetail(jobId);
  const { create, update } = useJobMutations();

  const serviceTypeId = Form.useWatch('serviceTypeId', form);
  const requirementRows = Form.useWatch('requirements', form) as RequirementRow[] | undefined;
  const selectedCode = useMemo(
    () => serviceTypes.data?.find((s) => s.id === serviceTypeId)?.code,
    [serviceTypes.data, serviceTypeId]
  );
  const visibilityOptions = allowedVisibilities(selectedCode);
  const hasMustHave = (requirementRows ?? []).some((r) => r?.requirementType === 'MUST_HAVE' && r.content?.trim());

  useEffect(() => {
    if (existing.data) form.setFieldsValue(toFormValues(existing.data));
  }, [existing.data, form]);

  // Keep visibility valid for the chosen service type (backend rejects other combinations).
  useEffect(() => {
    const current = form.getFieldValue('visibility') as JobVisibility | undefined;
    if (selectedCode && (!current || !visibilityOptions.includes(current))) {
      form.setFieldValue('visibility', visibilityOptions[0]);
    }
  }, [selectedCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = !isEdit || (existing.data ? clientActions(existing.data.status).canEdit : false);
  const serviceTypeLocked = isEdit && existing.data?.status !== 'DRAFT';

  const save = async (andSubmit: boolean) => {
    setErrorSummary([]);
    let values: JobFormValues;
    try {
      values = await form.validateFields();
    } catch (info) {
      const fields = (info as { errorFields?: { errors: string[] }[] }).errorFields ?? [];
      setErrorSummary(fields.flatMap((f) => f.errors));
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (andSubmit) {
      const blockers = submitBlockers(values);
      if (blockers.length > 0) {
        form.setFields(
          blockers
            .filter((b) => b.field[0] !== 'requirements')
            .map((b) => ({ name: b.field, errors: [b.message] })) as Parameters<typeof form.setFields>[0]
        );
        setErrorSummary(['Chưa đủ thông tin để gửi duyệt (bạn vẫn có thể "Lưu nháp"):', ...blockers.map((b) => b.message)]);
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
    }

    setSaving(andSubmit ? 'submit' : 'draft');
    try {
      const input = toInput(values);
      let savedId: string;
      if (isEdit && existing.data) {
        const res = await update.mutateAsync({ jobId: existing.data.jobId, input, token: existing.data.concurrencyToken });
        savedId = res.data.jobId;
      } else {
        const res = await create.mutateAsync(input);
        savedId = res.data.jobId;
      }

      if (andSubmit) {
        // Create does not return a token; read the fresh job before submitting.
        const fresh = await jobsApi.getById(savedId);
        const res = await jobsApi.submit(savedId, fresh.concurrencyToken);
        message.success(res.message);
      } else {
        message.success('Đã lưu bản nháp.');
      }
      navigate('/client/jobs');
    } catch (err) {
      const mapped = applyServerFieldErrors(form, err);
      const text = getApiErrorMessage(err);
      setErrorSummary([mapped ? 'Một số thông tin chưa hợp lệ, xem chi tiết ở từng ô bên dưới.' : text]);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(null);
    }
  };

  if (isEdit && existing.isLoading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }
  if (isEdit && existing.isError) {
    return <Alert type="error" showIcon message="Không tải được tin tuyển dụng" description={getApiErrorMessage(existing.error)} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-1">
        <Button type="link" icon={<ArrowLeftOutlined />} className="!px-0" onClick={() => navigate('/client/jobs')}>
          Tin tuyển dụng của tôi
        </Button>
        <Title level={3} className="!mb-0">
          {isEdit ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng mới'}
        </Title>
        <Text type="secondary">
          Tin được lưu dưới dạng bản nháp. Khi gửi duyệt, Internal HR sẽ kiểm tra trước khi tin được hiển thị.
        </Text>
      </header>

      {!editable && existing.data && (
        <Alert
          type="info"
          showIcon
          message="Tin này không sửa được ở trạng thái hiện tại"
          description="Chỉ sửa được tin ở trạng thái Bản nháp hoặc Bị từ chối."
        />
      )}
      {existing.data?.status === 'REJECTED' && existing.data.statusReason && (
        <Alert type="warning" showIcon message="Internal HR đã từ chối tin này" description={existing.data.statusReason} />
      )}

      {errorSummary.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="job-form-errors" className="outline-none">
          <Alert
            type="error"
            showIcon
            message={<span id="job-form-errors">Chưa lưu được tin tuyển dụng</span>}
            description={
              <ul className="m-0 pl-4">
                {errorSummary.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            }
          />
        </div>
      )}

      <Form<JobFormValues>
        form={form}
        layout="vertical"
        initialValues={EMPTY_VALUES}
        disabled={!editable || saving !== null}
        validateTrigger="onBlur"
        requiredMark="optional"
        scrollToFirstError
      >
        <Card title="1. Loại dịch vụ và phạm vi hiển thị" className="mb-5">
          {serviceTypes.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(serviceTypes.error)} />
          ) : (
            <Form.Item
              name="serviceTypeId"
              label="Loại dịch vụ"
              rules={[{ required: true, message: 'Chọn loại dịch vụ.' }]}
              extra={serviceTypeLocked ? 'Chỉ đổi được loại dịch vụ khi tin còn là bản nháp.' : undefined}
            >
              {serviceTypes.isLoading ? (
                <Skeleton.Input active block />
              ) : (
                <ServiceTypePicker options={serviceTypes.data ?? []} disabled={serviceTypeLocked} />
              )}
            </Form.Item>
          )}
          <Form.Item
            name="visibility"
            label="Ai được thấy tin"
            rules={[{ required: true, message: 'Chọn phạm vi hiển thị.' }]}
            extra={!selectedCode ? 'Chọn loại dịch vụ trước.' : undefined}
          >
            <Radio.Group disabled={!selectedCode}>
              {visibilityOptions.map((v) => (
                <Radio key={v} value={v}>
                  {VISIBILITY_LABEL[v].label}
                  <Text type="secondary" className="ml-1 text-xs">
                    — {VISIBILITY_LABEL[v].summary}
                  </Text>
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        </Card>

        <Card title="2. Thông tin vị trí" className="mb-5">
          <Form.Item
            name="title"
            label="Tên vị trí"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên vị trí.' },
              { max: 255, message: 'Tối đa 255 ký tự.' },
            ]}
          >
            <Input placeholder="Ví dụ: Kỹ sư Backend .NET (Senior)" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="employmentType" label={<>Hình thức làm việc<SubmitHint /></>}>
                <Select
                  allowClear
                  placeholder="Chọn hình thức"
                  options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((k) => ({
                    value: k,
                    label: EMPLOYMENT_TYPE_LABEL[k],
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="quantity"
                label="Số lượng cần tuyển"
                rules={[{ required: true, type: 'number', min: 1, max: 1000, message: 'Từ 1 đến 1000 người.' }]}
              >
                <InputNumber min={1} max={1000} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="location" label={<>Địa điểm<SubmitHint /></>} rules={[{ max: 255, message: 'Tối đa 255 ký tự.' }]}>
                <Input placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="workingTime" label="Thời gian làm việc" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                <Input placeholder="Ví dụ: Thứ 2 – Thứ 6, 9:00 – 18:00" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item
                name="minExperienceYears"
                label="Kinh nghiệm tối thiểu (năm)"
                rules={[{ type: 'number', min: 0, max: 50, message: 'Từ 0 đến 50.' }]}
              >
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item
                name="maxExperienceYears"
                label="Tối đa (năm)"
                dependencies={['minExperienceYears']}
                rules={[
                  { type: 'number', min: 0, max: 50, message: 'Từ 0 đến 50.' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) => {
                      const min = getFieldValue('minExperienceYears');
                      return v == null || min == null || v >= min
                        ? Promise.resolve()
                        : Promise.reject(new Error('Phải lớn hơn hoặc bằng mức tối thiểu.'));
                    },
                  }),
                ]}
              >
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="3. Mức lương" className="mb-5">
          <Row gutter={16}>
            <Col xs={24} md={9}>
              <Form.Item name="salaryMin" label="Từ" rules={[{ type: 'number', min: 0, message: 'Không được âm.' }]}>
                <InputNumber<number> min={0} step={1000000} className="w-full" formatter={(v) => (v ? Number(v).toLocaleString('vi-VN') : '')} parser={(v) => Number((v ?? '').replace(/\D/g, ''))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={9}>
              <Form.Item
                name="salaryMax"
                label="Đến"
                dependencies={['salaryMin']}
                rules={[
                  { type: 'number', min: 0, message: 'Không được âm.' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) => {
                      const min = getFieldValue('salaryMin');
                      return v == null || min == null || v >= min
                        ? Promise.resolve()
                        : Promise.reject(new Error('Phải lớn hơn hoặc bằng mức "Từ".'));
                    },
                  }),
                ]}
              >
                <InputNumber<number> min={0} step={1000000} className="w-full" formatter={(v) => (v ? Number(v).toLocaleString('vi-VN') : '')} parser={(v) => Number((v ?? '').replace(/\D/g, ''))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="currencyCode" label="Tiền tệ" rules={[{ required: true, message: 'Chọn tiền tệ.' }]}>
                <Select options={['VND', 'USD'].map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="salaryNegotiable" label="Có thể thỏa thuận" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="salaryNote" label="Ghi chú về lương" rules={[{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}>
            <Input placeholder="Ví dụ: Gross, thêm thưởng hiệu suất theo quý" />
          </Form.Item>
        </Card>

        <Card title="4. Mô tả và quyền lợi" className="mb-5">
          <Form.Item name="description" label={<>Mô tả công việc<SubmitHint /></>}>
            <Input.TextArea rows={6} placeholder="Công việc hằng ngày, đội ngũ, mục tiêu của vị trí..." />
          </Form.Item>
          <Form.Item name="benefits" label={<>Quyền lợi<SubmitHint /></>} rules={[{ max: 10000, message: 'Tối đa 10000 ký tự.' }]}>
            <Input.TextArea rows={4} placeholder="Bảo hiểm, ngày phép, đào tạo..." />
          </Form.Item>
        </Card>

        <Card
          title="5. Yêu cầu ứng viên"
          className="mb-5"
          extra={
            <Text type={hasMustHave ? 'secondary' : 'warning'} className="text-xs">
              {hasMustHave ? 'AI dùng các yêu cầu này để chấm điểm CV.' : 'Cần ít nhất 1 yêu cầu bắt buộc để gửi duyệt.'}
            </Text>
          }
        >
          <Form.List name="requirements">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.key} className="rounded-lg border border-slate-200 p-3">
                    <Row gutter={12} align="top">
                      <Col xs={24} md={6}>
                        <Form.Item name={[field.name, 'requirementType']} label="Mức độ" className="mb-2" rules={[{ required: true, message: 'Chọn mức độ.' }]}>
                          <Select
                            options={[
                              { value: 'MUST_HAVE', label: 'Bắt buộc' },
                              { value: 'SHOULD_HAVE', label: 'Ưu tiên' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name={[field.name, 'content']}
                          label={`Yêu cầu ${index + 1}`}
                          className="mb-2"
                          rules={[{ required: true, whitespace: true, message: 'Nhập nội dung yêu cầu hoặc xóa dòng này.' }]}
                        >
                          <Input placeholder="Ví dụ: 3+ năm kinh nghiệm ASP.NET Core" />
                        </Form.Item>
                      </Col>
                      <Col xs={20} md={5}>
                        <Form.Item name={[field.name, 'category']} label="Nhóm" className="mb-2">
                          <Input placeholder="Kỹ năng, ngoại ngữ..." />
                        </Form.Item>
                      </Col>
                      <Col xs={4} md={1} className="flex md:pt-7">
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`Xóa yêu cầu ${index + 1}`}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add({ requirementType: 'SHOULD_HAVE', content: '' })} block type="dashed">
                  Thêm yêu cầu
                </Button>
              </div>
            )}
          </Form.List>
        </Card>
      </Form>

      {editable && (
        <div className="sticky bottom-0 z-20 -mx-1 rounded-t-xl border border-b-0 border-slate-200 bg-white/95 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
            <Button onClick={() => navigate('/client/jobs')} disabled={saving !== null}>
              Hủy
            </Button>
            <Button onClick={() => save(false)} loading={saving === 'draft'} disabled={saving === 'submit'}>
              Lưu nháp
            </Button>
            <Button type="primary" onClick={() => save(true)} loading={saving === 'submit'} disabled={saving === 'draft'}>
              Lưu và gửi duyệt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobFormPage;
