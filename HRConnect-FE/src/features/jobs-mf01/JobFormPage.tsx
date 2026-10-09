/**
 * @file JobFormPage.tsx
 * @description MF-01 · Client Company — create (POST /jobs) or edit (PUT /jobs/{id}) a job.
 * The form contains exactly the fields of CreateJobCommand / UpdateJobCommand; nothing the
 * backend cannot store. "Lưu & gửi duyệt" saves first, then calls POST /jobs/{id}/submit.
 * Layout (ui-ux-pro-max, long-form rules): numbered sections, a sticky side rail with a live
 * readiness checklist that mirrors the backend submit rules, section links, a candidate-facing
 * preview and the save actions; a fixed action bar on small screens; focusable error summary.
 */
import '@/features/admin-console/admin-console.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Alert,
  App as AntApp,
  Button,
  Form,
  Input,
  InputNumber,
  Progress,
  Radio,
  Select,
  Skeleton,
  Switch,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
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
const SubmitHint: React.FC = () => <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">cần khi gửi duyệt</span>;

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

// ─── Presentation pieces ─────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'job-service', title: 'Loại dịch vụ', hint: 'Cách HR Connect tìm và sàng lọc ứng viên cho tin này.' },
  { id: 'job-position', title: 'Thông tin vị trí', hint: 'Những gì ứng viên thấy đầu tiên.' },
  { id: 'job-salary', title: 'Mức lương', hint: 'Tin có lương rõ ràng nhận nhiều hồ sơ phù hợp hơn.' },
  { id: 'job-content', title: 'Mô tả và quyền lợi', hint: 'Công việc hằng ngày và lý do ứng viên nên chọn bạn.' },
  { id: 'job-requirements', title: 'Yêu cầu ứng viên', hint: 'AI dùng các yêu cầu này để chấm điểm CV.' },
] as const;

const Section: React.FC<{ index: number; children: React.ReactNode; extra?: React.ReactNode }> = ({ index, children, extra }) => {
  const s = SECTIONS[index];
  return (
    <section id={s.id} aria-labelledby={`${s.id}-title`} className="admin-surface scroll-mt-24 p-5 sm:p-7">
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-sm font-bold text-[color:var(--console-accent-strong)]"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${s.id}-title`} className="m-0 text-[17px] font-semibold text-slate-900">
            {s.title}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-slate-600">{s.hint}</p>
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
};

/** Selectable cards; the native radio stays in the DOM for keyboard and screen readers. */
function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  disabled,
  columns = 'md:grid-cols-3',
  name,
}: {
  value?: T;
  onChange?: (v: T) => void;
  options: { value: T; title: string; summary: string }[];
  disabled?: boolean;
  columns?: string;
  name: string;
}) {
  return (
    <div role="radiogroup" className={`grid gap-3 ${columns}`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            className={`group relative flex cursor-pointer flex-col gap-1 rounded-xl border border-solid p-4 transition-all duration-150 ${
              selected
                ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)] shadow-[0_0_0_1px_var(--console-accent)]'
                : 'border-slate-200 bg-white hover:border-slate-400'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--console-accent)]`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange?.(o.value)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{o.title}</span>
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-solid ${
                  selected ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent)]' : 'border-slate-300 bg-white'
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
            </span>
            <span className="text-[13px] leading-snug text-slate-600">{o.summary}</span>
          </label>
        );
      })}
    </div>
  );
}

const money = (v?: number | null) => (v == null ? null : Number(v).toLocaleString('vi-VN'));
const salaryText = (v: Partial<JobFormValues>) => {
  const unit = v.currencyCode === 'USD' ? 'USD' : '₫';
  const lo = money(v.salaryMin);
  const hi = money(v.salaryMax);
  if (lo && hi) return `${lo} – ${hi} ${unit}`;
  if (lo) return `Từ ${lo} ${unit}`;
  if (hi) return `Đến ${hi} ${unit}`;
  return v.salaryNegotiable ? 'Thỏa thuận' : 'Chưa nhập lương';
};

const moneyInputProps = {
  min: 0,
  step: 1000000,
  className: 'w-full',
  formatter: (v?: number | string) => (v ? Number(v).toLocaleString('vi-VN') : ''),
  parser: (v?: string) => Number((v ?? '').replace(/\D/g, '')),
};

const STANDARD_CATEGORIES = [
  'Kỹ thuật / Chuyên môn',
  'Kinh nghiệm làm việc',
  'Ngoại ngữ',
  'Học vấn / Bằng cấp',
  'Chứng chỉ nghề nghiệp',
  'Kỹ năng mềm',
] as const;

const OTHER_CATEGORY_VALUE = '__OTHER__';

const RequirementCategoryField: React.FC<{
  value?: string;
  onChange?: (val: string | undefined) => void;
}> = ({ value, onChange }) => {
  const isStandard = Boolean(value && (STANDARD_CATEGORIES as readonly string[]).includes(value));
  const isCustom = Boolean(value && !isStandard);

  const [selectedType, setSelectedType] = useState<string | undefined>(() => {
    if (!value) return undefined;
    if (isStandard) return value;
    return OTHER_CATEGORY_VALUE;
  });

  const [customText, setCustomText] = useState<string>(() => (isCustom ? value! : ''));

  useEffect(() => {
    if (!value) {
      setSelectedType(undefined);
      setCustomText('');
    } else if ((STANDARD_CATEGORIES as readonly string[]).includes(value)) {
      setSelectedType(value);
      setCustomText('');
    } else {
      setSelectedType(OTHER_CATEGORY_VALUE);
      setCustomText(value);
    }
  }, [value]);

  const handleSelectChange = (newVal?: string) => {
    setSelectedType(newVal);
    if (!newVal) {
      onChange?.(undefined);
    } else if (newVal === OTHER_CATEGORY_VALUE) {
      onChange?.(customText.trim() ? customText.trim() : undefined);
    } else {
      onChange?.(newVal);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange?.(text.trim() ? text.trim() : undefined);
  };

  return (
    <div className="space-y-1.5">
      <Select
        placeholder="Chọn nhóm…"
        value={selectedType}
        onChange={handleSelectChange}
        allowClear
        className="w-full"
        options={[
          ...STANDARD_CATEGORIES.map((c) => ({ value: c, label: c })),
          { value: OTHER_CATEGORY_VALUE, label: 'Khác (Tự nhập…)' },
        ]}
      />
      {selectedType === OTHER_CATEGORY_VALUE && (
        <Input
          placeholder="Nhập tên nhóm khác…"
          value={customText}
          onChange={handleCustomTextChange}
          className="text-xs"
          autoFocus
        />
      )}
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

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

  // Whole form, watched once: drives the readiness checklist and the preview.
  const watched = (Form.useWatch((v) => v, form) ?? {}) as Partial<JobFormValues>;
  const serviceTypeId = watched.serviceTypeId;
  const selectedCode = useMemo(
    () => serviceTypes.data?.find((s) => s.id === serviceTypeId)?.code,
    [serviceTypes.data, serviceTypeId]
  );
  // INTERNAL_ONLY is hidden until Internal HR can submit candidates on a job's behalf: today such a job
  // is seen by no Candidate or Affiliate, so it could never receive an application. A job already saved
  // as INTERNAL_ONLY keeps the option so editing it does not silently change who sees it.
  const savedAsInternal = existing.data?.visibility === 'INTERNAL_ONLY';
  const visibilityOptions = allowedVisibilities(selectedCode).filter(
    (v) => v !== 'INTERNAL_ONLY' || savedAsInternal
  );
  const hasMustHave = (watched.requirements ?? []).some((r) => r?.requirementType === 'MUST_HAVE' && r.content?.trim());

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

  // Readiness = the backend's submit rules (submitBlockers) plus the always-required fields.
  const checklist = [
    { label: 'Chọn loại dịch vụ', done: Boolean(watched.serviceTypeId), section: 'job-service' },
    { label: 'Tên vị trí', done: Boolean(watched.title?.trim()), section: 'job-position' },
    { label: 'Hình thức làm việc', done: Boolean(watched.employmentType), section: 'job-position' },
    { label: 'Địa điểm', done: Boolean(watched.location?.trim()), section: 'job-position' },
    { label: 'Mô tả công việc', done: Boolean(watched.description?.trim()), section: 'job-content' },
    { label: 'Quyền lợi', done: Boolean(watched.benefits?.trim()), section: 'job-content' },
    { label: 'Ít nhất 1 yêu cầu bắt buộc', done: hasMustHave, section: 'job-requirements' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checklist.length) * 100);
  const ready = doneCount === checklist.length;

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

  const submitButton = (block?: boolean) => (
    <Button
      type="primary"
      size="large"
      block={block}
      className="client-cta"
      onClick={() => save(true)}
      loading={saving === 'submit'}
      disabled={saving === 'draft'}
    >
      Lưu và gửi duyệt
    </Button>
  );
  const draftButton = (block?: boolean) => (
    <Button size="large" block={block} onClick={() => save(false)} loading={saving === 'draft'} disabled={saving === 'submit'}>
      Lưu nháp
    </Button>
  );

  return (
    <div className="pb-24 lg:pb-0">
      {/* Header */}
      <Button type="link" icon={<ArrowLeftOutlined />} className="!mb-2 !px-0" onClick={() => navigate('/client/jobs')}>
        Tin tuyển dụng của tôi
      </Button>
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--console-accent-strong)]">Tuyển dụng</div>
        <h1 className="m-0 text-[28px] font-bold leading-tight tracking-[-0.01em] text-slate-900">
          {isEdit ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng mới'}
        </h1>
        <p className="m-0 mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">
          Bạn có thể lưu nháp bất cứ lúc nào. Khi gửi duyệt, HR Connect kiểm tra nội dung trước khi tin được hiển thị cho ứng viên.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Form column ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {!editable && existing.data && (
            <Alert type="info" showIcon message="Tin này không sửa được ở trạng thái hiện tại" description="Chỉ sửa được tin ở trạng thái Bản nháp hoặc Bị từ chối." />
          )}
          {existing.data?.status === 'REJECTED' && existing.data.statusReason && (
            <Alert type="warning" showIcon message="HR Connect đã từ chối tin này" description={existing.data.statusReason} />
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
            requiredMark={false}
            initialValues={EMPTY_VALUES}
            disabled={!editable || saving !== null}
            validateTrigger="onBlur"
            scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
            className="space-y-5"
          >
            {/* 1. Service type */}
            <Section index={0}>
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
                    <ChoiceCards
                      name="serviceTypeId"
                      disabled={serviceTypeLocked || !editable}
                      options={(serviceTypes.data ?? []).map((st: ServiceType) => ({
                        value: st.id,
                        title: SERVICE_TYPE_LABEL[st.code]?.label ?? st.name,
                        summary: SERVICE_TYPE_LABEL[st.code]?.summary ?? st.description ?? '',
                      }))}
                    />
                  )}
                </Form.Item>
              )}
              <Form.Item
                name="visibility"
                label="Ai được thấy tin"
                className="mb-0"
                rules={[{ required: true, message: 'Chọn phạm vi hiển thị.' }]}
                extra={
                  !selectedCode
                    ? 'Chọn loại dịch vụ trước.'
                    : savedAsInternal
                      ? undefined
                      : 'Tin "Nội bộ" tạm ẩn: hiện chưa có cách nhận hồ sơ cho tin chỉ nội bộ thấy.'
                }
              >
                {selectedCode ? (
                  <ChoiceCards
                    name="visibility"
                    columns={visibilityOptions.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}
                    disabled={!editable}
                    options={visibilityOptions.map((v) => ({ value: v, title: VISIBILITY_LABEL[v].label, summary: VISIBILITY_LABEL[v].summary }))}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-[13px] text-slate-500">Phạm vi hiển thị phụ thuộc loại dịch vụ.</div>
                )}
              </Form.Item>
            </Section>

            {/* 2. Position */}
            <Section index={1}>
              <Form.Item
                name="title"
                label="Tên vị trí"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập tên vị trí.' },
                  { max: 255, message: 'Tối đa 255 ký tự.' },
                ]}
              >
                <Input size="large" placeholder="Ví dụ: Kỹ sư Backend .NET (Senior)" />
              </Form.Item>
              <div className="grid gap-x-4 md:grid-cols-2">
                <Form.Item name="employmentType" label={<>Hình thức làm việc<SubmitHint /></>}>
                  <Select
                    size="large"
                    allowClear
                    placeholder="Chọn hình thức"
                    options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((k) => ({ value: k, label: EMPLOYMENT_TYPE_LABEL[k] }))}
                  />
                </Form.Item>
                <Form.Item
                  name="quantity"
                  label="Số lượng cần tuyển"
                  rules={[{ required: true, type: 'number', min: 1, max: 1000, message: 'Từ 1 đến 1000 người.' }]}
                >
                  <InputNumber size="large" min={1} max={1000} className="w-full" addonAfter="người" />
                </Form.Item>
                <Form.Item name="location" label={<>Địa điểm<SubmitHint /></>} rules={[{ max: 255, message: 'Tối đa 255 ký tự.' }]}>
                  <Input size="large" prefix={<EnvironmentOutlined className="text-slate-400" />} placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh" />
                </Form.Item>
                <Form.Item name="workingTime" label="Thời gian làm việc" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                  <Input size="large" placeholder="Ví dụ: Thứ 2 – Thứ 6, 9:00 – 18:00" />
                </Form.Item>
              </div>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 p-0 text-sm text-slate-900">Kinh nghiệm yêu cầu (năm)</legend>
                <div className="grid grid-cols-2 gap-x-4">
                  <Form.Item name="minExperienceYears" className="mb-0" rules={[{ type: 'number', min: 0, max: 50, message: 'Từ 0 đến 50.' }]}>
                    <InputNumber size="large" min={0} max={50} className="w-full" addonBefore="Từ" aria-label="Kinh nghiệm tối thiểu (năm)" />
                  </Form.Item>
                  <Form.Item
                    name="maxExperienceYears"
                    className="mb-0"
                    dependencies={['minExperienceYears']}
                    rules={[
                      { type: 'number', min: 0, max: 50, message: 'Từ 0 đến 50.' },
                      ({ getFieldValue }) => ({
                        validator: (_, v) => {
                          const min = getFieldValue('minExperienceYears');
                          return v == null || min == null || v >= min ? Promise.resolve() : Promise.reject(new Error('Phải lớn hơn hoặc bằng mức tối thiểu.'));
                        },
                      }),
                    ]}
                  >
                    <InputNumber size="large" min={0} max={50} className="w-full" addonBefore="Đến" aria-label="Kinh nghiệm tối đa (năm)" />
                  </Form.Item>
                </div>
              </fieldset>
            </Section>

            {/* 3. Salary */}
            <Section index={2}>
              <div className="grid gap-x-4 md:grid-cols-[1fr_1fr_120px]">
                <Form.Item name="salaryMin" label="Từ" rules={[{ type: 'number', min: 0, message: 'Không được âm.' }]}>
                  <InputNumber<number> size="large" {...moneyInputProps} placeholder="15.000.000" />
                </Form.Item>
                <Form.Item
                  name="salaryMax"
                  label="Đến"
                  dependencies={['salaryMin']}
                  rules={[
                    { type: 'number', min: 0, message: 'Không được âm.' },
                    ({ getFieldValue }) => ({
                      validator: (_, v) => {
                        const min = getFieldValue('salaryMin');
                        return v == null || min == null || v >= min ? Promise.resolve() : Promise.reject(new Error('Phải lớn hơn hoặc bằng mức "Từ".'));
                      },
                    }),
                  ]}
                >
                  <InputNumber<number> size="large" {...moneyInputProps} placeholder="25.000.000" />
                </Form.Item>
                <Form.Item name="currencyCode" label="Tiền tệ" rules={[{ required: true, message: 'Chọn tiền tệ.' }]}>
                  <Select size="large" options={['VND', 'USD'].map((c) => ({ value: c, label: c }))} />
                </Form.Item>
              </div>
              <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Có thể thỏa thuận</div>
                  <div className="text-[13px] text-slate-600">Ứng viên thấy nhãn “Thỏa thuận” bên cạnh mức lương.</div>
                </div>
                <Form.Item name="salaryNegotiable" valuePropName="checked" noStyle>
                  <Switch aria-label="Có thể thỏa thuận" />
                </Form.Item>
              </div>
              <Form.Item name="salaryNote" label="Ghi chú về lương" className="mb-0" rules={[{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}>
                <Input size="large" placeholder="Ví dụ: Gross, thêm thưởng hiệu suất theo quý" />
              </Form.Item>
            </Section>

            {/* 4. Description & benefits */}
            <Section index={3}>
              <Form.Item name="description" label={<>Mô tả công việc<SubmitHint /></>}>
                <Input.TextArea rows={7} showCount placeholder={'• Công việc hằng ngày\n• Đội ngũ bạn sẽ làm cùng\n• Mục tiêu của vị trí trong 6 tháng đầu'} />
              </Form.Item>
              <Form.Item name="benefits" label={<>Quyền lợi<SubmitHint /></>} className="mb-0" rules={[{ max: 10000, message: 'Tối đa 10000 ký tự.' }]}>
                <Input.TextArea rows={5} showCount maxLength={10000} placeholder={'• Bảo hiểm sức khỏe\n• 15 ngày phép/năm\n• Ngân sách học tập'} />
              </Form.Item>
            </Section>

            {/* 5. Requirements */}
            <Section
              index={4}
              extra={
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${hasMustHave ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {hasMustHave ? 'Đã có yêu cầu bắt buộc' : 'Cần ≥ 1 yêu cầu bắt buộc'}
                </span>
              }
            >
              <Form.List name="requirements">
                {(fields, { add, remove }) => (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.key} className="rounded-xl bg-slate-50 p-3 sm:p-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 md:grid-cols-[max-content_minmax(0,1fr)_205px_auto]">
                          <Form.Item name={[field.name, 'requirementType']} label="Mức độ" className="mb-2 md:mb-0" rules={[{ required: true, message: 'Chọn mức độ.' }]}>
                            <Radio.Group optionType="button" buttonStyle="solid" size="middle" className="flex whitespace-nowrap">
                              <Radio.Button value="MUST_HAVE">Bắt buộc</Radio.Button>
                              <Radio.Button value="SHOULD_HAVE">Ưu tiên</Radio.Button>
                            </Radio.Group>
                          </Form.Item>
                          <div className="order-3 col-span-2 md:order-none md:col-span-1">
                            <Form.Item
                              name={[field.name, 'content']}
                              label={`Yêu cầu ${index + 1}`}
                              className="mb-2 md:mb-0"
                              rules={[{ required: true, whitespace: true, message: 'Nhập nội dung yêu cầu hoặc xóa dòng này.' }]}
                            >
                              <Input placeholder="Ví dụ: 3+ năm kinh nghiệm ASP.NET Core" />
                            </Form.Item>
                          </div>
                          <div className="order-4 col-span-2 md:order-none md:col-span-1">
                            <Form.Item name={[field.name, 'category']} label="Nhóm" className="mb-0">
                              <RequirementCategoryField />
                            </Form.Item>
                          </div>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Xóa yêu cầu ${index + 1}`}
                            onClick={() => remove(field.name)}
                            className="order-2 mt-7 md:order-none"
                          />
                        </div>
                      </div>
                    ))}
                    <Button icon={<PlusOutlined />} onClick={() => add({ requirementType: 'SHOULD_HAVE', content: '' })} block type="dashed" size="large">
                      Thêm yêu cầu
                    </Button>
                  </div>
                )}
              </Form.List>
            </Section>
          </Form>
        </div>

        {/* ── Side rail (sticky) ──────────────────────────────────────── */}
        <aside aria-label="Tiến độ và xem trước" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="admin-surface p-5">
            <div className="flex items-center gap-4">
              <Progress type="circle" percent={percent} size={64} strokeColor="var(--console-accent)" format={(p) => <span className="text-sm font-bold text-slate-900">{p}%</span>} />
              <div>
                <div className="text-[15px] font-semibold text-slate-900">{ready ? 'Sẵn sàng gửi duyệt' : 'Mức độ hoàn thiện'}</div>
                <div className="text-[13px] text-slate-600">
                  {doneCount}/{checklist.length} mục cần khi gửi duyệt
                </div>
              </div>
            </div>
            <ul className="m-0 mt-4 list-none space-y-0.5 p-0">
              {checklist.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => goTo(c.section)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-[13.5px] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                  >
                    {c.done ? (
                      <CheckCircleFilled className="text-emerald-700" aria-label="Đã xong" />
                    ) : (
                      <ExclamationCircleOutlined className="text-amber-700" aria-label="Còn thiếu" />
                    )}
                    <span className={c.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}>{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Candidate-facing preview */}
          <div className="admin-surface overflow-hidden">
            <div className="border-0 border-b border-solid border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {watched.visibility === 'PARTNER_ONLY'
                ? 'Affiliate sẽ thấy'
                : watched.visibility === 'INTERNAL_ONLY'
                ? 'Chỉ nội bộ thấy'
                : 'Ứng viên và khách sẽ thấy'}
            </div>
            <div className="p-5">
              <div className="text-[16px] font-semibold leading-snug text-slate-900">{watched.title?.trim() || 'Tên vị trí'}</div>
              <div className="mt-3 space-y-1.5 text-[13.5px] text-slate-700">
                <div className="flex items-center gap-2">
                  <WalletOutlined className="text-slate-400" aria-hidden />
                  <span className="font-medium text-[color:var(--console-accent-strong)]">{salaryText(watched)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvironmentOutlined className="text-slate-400" aria-hidden />
                  {watched.location?.trim() || 'Địa điểm'}
                </div>
                <div className="flex items-center gap-2">
                  <TeamOutlined className="text-slate-400" aria-hidden />
                  {watched.employmentType ? EMPLOYMENT_TYPE_LABEL[watched.employmentType] : 'Hình thức'} · {watched.quantity ?? 1} người
                </div>
              </div>
              {selectedCode && (
                <span className="mt-3 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{SERVICE_TYPE_LABEL[selectedCode]?.label}</span>
              )}
            </div>
          </div>

          {editable && (
            <div className="hidden space-y-2 lg:block">
              {submitButton(true)}
              <div className="grid grid-cols-2 gap-2">
                {draftButton(true)}
                <Button size="large" block onClick={() => navigate('/client/jobs')} disabled={saving !== null}>
                  Hủy
                </Button>
              </div>
            </div>
          )}

        </aside>
      </div>

      {/* Fixed action bar on small screens */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-0 border-t border-solid border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-[640px] items-center gap-2">
            <div className="mr-auto text-xs text-slate-600">
              <b className="text-slate-900">{percent}%</b> hoàn thiện
            </div>
            {draftButton()}
            {submitButton()}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobFormPage;
