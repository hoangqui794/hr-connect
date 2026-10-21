/**
 * @file JobFormPage.tsx
 * @description MF-01 · Client Company — create (POST /jobs) or edit (PUT /jobs/{id}) a job.
 * Form structured into 4 Ant Design Steps:
 *   Step 1: Chọn dịch vụ (Card selection with short description and read-only fee rule)
 *   Step 2: Mô tả công việc (Shared JD: title, quantity, desc, benefits, requirements, skills, salary, deadline)
 *   Step 3: Nhu cầu và chi phí (Dynamic by service: CV_APPLICATION posting packages; CV_SOURCING cvCount + proposed fee; HEADHUNT_COD proposed terms)
 *   Step 4: Xem lại và gửi duyệt (JD summary + "Về chi phí" summary + action buttons)
 *
 * Rules:
 *   - Changing service in Step 1 after entering Step 3 triggers a confirm modal and clears old Step 3 data.
 *   - Proposed fee fields in Step 3 are strictly optional; blank fields still allow submission.
 *   - Submitted payload bundles proposed terms into `proposedTerms` (null if all blank).
 *   - Sticky side rail with completion progress and candidate preview is preserved.
 */
import '@/features/admin-console/admin-console.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Radio,
  Select,
  Skeleton,
  Steps,
  Switch,
  Tag,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type {
  EmploymentType,
  Job,
  JobRequirementType,
  JobTemplate,
  JobUpsertInput,
  ProposedTerms,
  ServiceType,
  ServiceTypeCode,
} from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { jobsApi } from '@/services/api/jobsApi';
import { useJobDetail, useJobMutations, usePostingEligibility, usePostingPackages, useServiceTypes } from './useJobQueries';
import {
  EMPLOYMENT_TYPE_LABEL,
  SERVICE_TYPE_LABEL,
  REQUIREMENT_CATEGORY_OPTIONS,
  clientActions,
} from './jobDisplay';
import { JobTemplatePicker } from './JobTemplatePicker';

// ─── Interfaces & Constants ──────────────────────────────────────────────────

interface RequirementRow {
  requirementType: JobRequirementType;
  content: string;
  category?: string;
}

interface JobFormValues {
  // Step 1
  serviceTypeId: string;

  // Step 2 (Shared JD)
  title: string;
  quantity: number;
  employmentType?: EmploymentType;
  location?: string;
  workingTime?: string;
  deadline?: string;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode: string;
  salaryNegotiable: boolean;
  salaryNote?: string;
  description?: string;
  benefits?: string;
  skills?: string[];
  requirements: RequirementRow[];

  // Step 3 (Dynamic)
  // CV_APPLICATION
  postingPackage?: string;

  // CV_SOURCING
  targetCandidateCount?: number | null;
  sourcingPricePerCv?: number | null;

  // HEADHUNT_COD
  feeMultiplier?: number | null;
  annualSalaryPercent?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;

  // Shared fee proposal note
  termsNote?: string;

  // MF-01 Template ID (if created/filled from a template)
  templateId?: string | null;
}

const EMPTY_VALUES: Partial<JobFormValues> = {
  quantity: 1,
  currencyCode: 'VND',
  salaryNegotiable: false,
  postingPackage: 'STANDARD',
  requirements: [{ requirementType: 'MUST_HAVE', content: '' }],
  skills: [],
  templateId: undefined,
};

export interface PostingPackageInfo {
  key: string;
  name: string;
  price: number;
  priceText: string;
  days: number;
  maxCandidates: number;
  tag?: string;
  features: string[];
}


interface ServiceMeta {
  code: ServiceTypeCode;
  tag: string;
  color: string;
  icon: React.ReactNode;
  defaultTitle: string;
  defaultSummary: string;
  feeRule: string;
}

const SERVICE_META: Record<ServiceTypeCode, ServiceMeta> = {
  CV_APPLICATION: {
    code: 'CV_APPLICATION',
    tag: 'Gói đăng tin',
    color: 'blue',
    icon: <RocketOutlined className="text-blue-600 text-lg" />,
    defaultTitle: 'Nhận CV ứng tuyển',
    defaultSummary: 'Đăng tin tuyển dụng trên nền tảng, ứng viên chủ động tìm kiếm và nộp hồ sơ trực tiếp.',
    feeRule: 'Đăng tin, ứng viên tự nộp hồ sơ. Trả theo gói, giá công khai.',
  },
  CV_SOURCING: {
    code: 'CV_SOURCING',
    tag: 'Sourcing theo số lượng',
    color: 'purple',
    icon: <TeamOutlined className="text-purple-600 text-lg" />,
    defaultTitle: 'Tìm nguồn CV (CV Sourcing)',
    defaultSummary: 'HR Connect và mạng lưới Affiliate chủ động tìm kiếm, sàng lọc hồ sơ đạt chuẩn và giao cho bạn.',
    feeRule: 'HR Connect tìm và giao CV đạt yêu cầu. Trả theo số CV bạn chấp nhận; đặt cọc khi tin được duyệt.',
  },
  HEADHUNT_COD: {
    code: 'HEADHUNT_COD',
    tag: 'Phí thành công (COD)',
    color: 'gold',
    icon: <SafetyCertificateOutlined className="text-amber-600 text-lg" />,
    defaultTitle: 'Tuyển dụng trọn gói (Headhunt COD)',
    defaultSummary: 'Quy trình tuyển dụng chuyên sâu qua Headhunter, bảo hành thay người miễn phí, chỉ trả phí khi tuyển thành công.',
    feeRule: 'HR Connect tuyển giúp bạn. Chỉ trả khi ứng viên bắt đầu đi làm, theo lương của người được tuyển. Bảo hành thay người miễn phí.',
  },
};

const SKILL_CATEGORY = 'SKILL';
const isSkillTag = (r: { requirementType: string; category: string | null }) =>
  r.requirementType === 'SHOULD_HAVE' && r.category === SKILL_CATEGORY;

const trimOrNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);

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

const hasStep3Data = (values: Partial<JobFormValues>, code?: ServiceTypeCode): boolean => {
  if (!code) return false;
  if (code === 'CV_APPLICATION') {
    return Boolean(values.postingPackage && values.postingPackage !== 'STANDARD');
  }
  if (code === 'CV_SOURCING') {
    return Boolean(
      (values.targetCandidateCount != null && values.targetCandidateCount > 0) ||
        (values.sourcingPricePerCv != null && values.sourcingPricePerCv > 0) ||
        Boolean(values.termsNote && values.termsNote.trim())
    );
  }
  if (code === 'HEADHUNT_COD') {
    return Boolean(
      (values.feeMultiplier != null && values.feeMultiplier > 0) ||
        (values.annualSalaryPercent != null && values.annualSalaryPercent > 0) ||
        (values.warrantyDays != null && values.warrantyDays > 0) ||
        (values.paymentDueDays != null && values.paymentDueDays > 0) ||
        Boolean(values.termsNote && values.termsNote.trim())
    );
  }
  return false;
};

const toFormValues = (job: Job): JobFormValues => {
  const proposed = job.proposedTerms as ProposedTerms | undefined;

  let annualSalaryPercent: number | undefined;
  if (proposed?.feeMultiplier != null) {
    annualSalaryPercent = Number(((proposed.feeMultiplier / 12) * 100).toFixed(1));
  } else if ((job as any).feeMultiplier != null) {
    annualSalaryPercent = Number((((job as any).feeMultiplier / 12) * 100).toFixed(1));
  }

  return {
    serviceTypeId: job.serviceTypeId,
    title: job.title || '',
    employmentType: job.employmentType ?? undefined,
    location: job.location ?? undefined,
    workingTime: job.workingTime ?? undefined,
    deadline: job.applicationDeadline ? dayjs(job.applicationDeadline).format('YYYY-MM-DD') : undefined,
    quantity: job.quantity ?? 1,
    minExperienceYears: job.minExperienceYears,
    maxExperienceYears: job.maxExperienceYears,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currencyCode: job.currencyCode || 'VND',
    salaryNegotiable: Boolean(job.salaryNegotiable),
    salaryNote: job.salaryNote ?? undefined,
    description: job.description ?? undefined,
    benefits: job.benefits ?? undefined,
    requirements: (job.requirements ?? [])
      .filter((r) => !isSkillTag(r))
      .map((r) => ({
        requirementType: r.requirementType,
        content: r.content,
        category: r.category ?? undefined,
      })),
    // Skill tags are stored as SHOULD_HAVE requirements of category SKILL (see toInput).
    skills: Array.from(
      new Set([
        ...(job.requirements ?? []).filter(isSkillTag).map((r) => r.content),
        ...(job.skills ?? []).map((s) => s.skillName || s.skillId),
      ])
    ),

    // Step 3 values
    postingPackage: job.postingPackageCode ?? 'STANDARD',
    targetCandidateCount: job.sourcingTarget ?? undefined,
    sourcingPricePerCv: proposed?.pricePerCv ?? undefined,
    feeMultiplier: proposed?.feeMultiplier ?? (job as any).feeMultiplier ?? undefined,
    annualSalaryPercent,
    warrantyDays: proposed?.warrantyDays ?? (job as any).warrantyDays ?? undefined,
    paymentDueDays: proposed?.paymentDueDays ?? (job as any).paymentDueDays ?? undefined,
    termsNote: proposed?.note ?? (job as any).termsNote ?? undefined,
    templateId: job.templateId ?? undefined,
  };
};

/** Form values → POST/PUT /jobs body, using the backend field names (proposedTerms.pricePerCv, sourcingTarget, ...). */
const toInput = (v: JobFormValues, selectedCode?: ServiceTypeCode, postingPackageId?: string | null): JobUpsertInput => {
  let proposedTerms: ProposedTerms | null = null;

  if (selectedCode === 'HEADHUNT_COD') {
    const hasAnyFee =
      v.feeMultiplier != null ||
      v.warrantyDays != null ||
      v.paymentDueDays != null ||
      Boolean(v.termsNote && v.termsNote.trim());

    if (hasAnyFee) {
      proposedTerms = {
        feeMultiplier: v.feeMultiplier != null ? Number(v.feeMultiplier) : null,
        warrantyDays: v.warrantyDays != null ? Number(v.warrantyDays) : null,
        paymentDueDays: v.paymentDueDays != null ? Number(v.paymentDueDays) : null,
        note: trimOrNull(v.termsNote),
      };
    }
  } else if (selectedCode === 'CV_SOURCING') {
    const hasAnyFee =
      v.sourcingPricePerCv != null ||
      Boolean(v.termsNote && v.termsNote.trim());

    if (hasAnyFee) {
      proposedTerms = {
        pricePerCv: v.sourcingPricePerCv != null ? Number(v.sourcingPricePerCv) : null,
        note: trimOrNull(v.termsNote),
      };
    }
  } else {
    proposedTerms = null;
  }

  return {
    serviceTypeId: v.serviceTypeId,
    title: v.title ? v.title.trim() : 'Tin tuyển dụng',
    employmentType: v.employmentType ?? null,
    location: trimOrNull(v.location),
    workingTime: trimOrNull(v.workingTime),
    quantity: v.quantity ?? 1,
    minExperienceYears: v.minExperienceYears ?? null,
    maxExperienceYears: v.maxExperienceYears ?? null,
    salaryMin: v.salaryMin ?? null,
    salaryMax: v.salaryMax ?? null,
    currencyCode: v.currencyCode || 'VND',
    salaryNegotiable: Boolean(v.salaryNegotiable),
    salaryNote: trimOrNull(v.salaryNote),
    description: trimOrNull(v.description),
    benefits: trimOrNull(v.benefits),
    requirements: [
      ...(v.requirements ?? [])
        .filter((r) => r && r.content?.trim())
        .map((r) => ({
          requirementType: r.requirementType,
          content: r.content.trim(),
          category: trimOrNull(r.category),
        })),
      // The skills catalog (GET /skills) is candidate-only, so a Client cannot send skill ids.
      // Each tag becomes a SHOULD_HAVE SKILL requirement: kept with the job and read by AI scoring.
      ...Array.from(new Set((v.skills ?? []).map((name) => name.trim()).filter(Boolean))).map((name) => ({
        requirementType: 'SHOULD_HAVE' as const,
        content: name,
        category: SKILL_CATEGORY,
      })),
    ],
    skills: [],
    // End of the chosen local day, sent as UTC: the API stores timestamptz and rejects dates without an offset.
    applicationDeadline: trimOrNull(v.deadline) ? dayjs(v.deadline).endOf('day').toISOString() : null,
    postingPackageId: selectedCode === 'CV_APPLICATION' ? postingPackageId ?? null : null,
    sourcingTarget: selectedCode === 'CV_SOURCING' ? (v.targetCandidateCount ?? null) : null,
    proposedTerms,
    templateId: v.templateId ?? null,
  };
};

/** Fields required before PENDING_REVIEW can be approved/submitted. */
const submitBlockers = (
  v: JobFormValues,
  serviceCode?: ServiceTypeCode,
  hasServiceSelected?: boolean
): { field: (string | number)[]; message: string; step: number }[] => {
  const missing: { field: (string | number)[]; message: string; step: number }[] = [];

  // Step 1
  if (!v.serviceTypeId && !hasServiceSelected) {
    missing.push({ field: ['serviceTypeId'], message: 'Chọn loại dịch vụ.', step: 0 });
  }

  // Step 2
  if (!trimOrNull(v.title)) {
    missing.push({ field: ['title'], message: 'Nhập tên vị trí tuyển dụng.', step: 1 });
  }
  if (!v.quantity || v.quantity < 1) {
    missing.push({ field: ['quantity'], message: 'Nhập số lượng cần tuyển (tối thiểu 1).', step: 1 });
  }
  if (!v.employmentType) {
    missing.push({ field: ['employmentType'], message: 'Chọn hình thức làm việc.', step: 1 });
  }
  if (!trimOrNull(v.location)) {
    missing.push({ field: ['location'], message: 'Nhập địa điểm làm việc.', step: 1 });
  }
  if (!trimOrNull(v.description)) {
    missing.push({ field: ['description'], message: 'Nhập mô tả công việc.', step: 1 });
  }
  if (!trimOrNull(v.benefits)) {
    missing.push({ field: ['benefits'], message: 'Nhập quyền lợi cho ứng viên.', step: 1 });
  }
  if (!(v.requirements ?? []).some((r) => r?.requirementType === 'MUST_HAVE' && r.content?.trim())) {
    missing.push({ field: ['requirements'], message: 'Thêm ít nhất một yêu cầu bắt buộc (Must-have).', step: 1 });
  }

  // Step 3
  if (serviceCode === 'CV_SOURCING') {
    if (!v.targetCandidateCount || v.targetCandidateCount < 1) {
      missing.push({ field: ['targetCandidateCount'], message: 'Nhập số lượng CV muốn nhận (bắt buộc).', step: 2 });
    }
  }

  return missing;
};

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
  form.setFields(fields as Parameters<typeof form.setFields>[0]);
  return fields.length > 0;
};

export const hasStep2Content = (values: Partial<JobFormValues>): boolean => {
  if (values.title && values.title.trim().length > 0) return true;
  if (values.description && values.description.trim().length > 0) return true;
  if (values.benefits && values.benefits.trim().length > 0) return true;
  if (values.skills && values.skills.length > 0) return true;
  if (
    values.requirements &&
    values.requirements.some((r) => r && r.content && r.content.trim().length > 0)
  ) {
    return true;
  }
  return false;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const JobFormPage: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const isEdit = Boolean(jobId);
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const [form] = Form.useForm<JobFormValues>();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleApplyTemplate = (template: JobTemplate, mergedSkills: string[]) => {
    const nonSkillRequirements = (template.requirements ?? [])
      .filter((r) => (r.category || '').toUpperCase() !== 'SKILL')
      .map((r) => ({
        requirementType: r.requirementType,
        content: r.content,
        category: r.category ?? undefined,
      }));

    form.setFieldsValue({
      title: template.title || '',
      employmentType: template.employmentType ?? undefined,
      minExperienceYears: template.minExperienceYears,
      maxExperienceYears: template.maxExperienceYears,
      description: template.description || '',
      benefits: template.benefits || '',
      requirements:
        nonSkillRequirements.length > 0
          ? nonSkillRequirements
          : [{ requirementType: 'MUST_HAVE', content: '' }],
      skills: mergedSkills,
      templateId: template.templateId,
    });
  };

  // Dedicated Component State for selected service to ensure robustness across steps
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedServiceCode, setSelectedServiceCode] = useState<ServiceTypeCode | undefined>();

  const serviceTypes = useServiceTypes();
  const existing = useJobDetail(jobId);
  const { create, update } = useJobMutations();
  // Packages, prices and limits come from the backend (admin-configurable), never from the FE.
  const postingPackages = usePostingPackages();
  // FREE is limited per company (active jobs / cooldown); the backend decides who may use it.
  const eligibility = usePostingEligibility();
  const freeBlocked = eligibility.data ? !eligibility.data.canUseFreePackage : false;
  const freeBlockedReason = (() => {
    const e = eligibility.data;
    if (!e || e.canUseFreePackage) return null;
    if (e.reason) return e.reason;
    if (e.nextFreeAvailableDate) return `Dùng lại được từ ${dayjs(e.nextFreeAvailableDate).format('DD/MM/YYYY')}`;
    return `Đã dùng ${e.activeJobsCount}/${e.freeActiveLimit} tin miễn phí đang hoạt động`;
  })();
  const packageCards: PostingPackageInfo[] = useMemo(
    () =>
      (postingPackages.data ?? [])
        .filter((p) => p.isActive)
        .map((p) => ({
          key: p.code,
          name: p.name,
          price: p.price,
          priceText: p.price > 0 ? `${p.price.toLocaleString('vi-VN')}đ` : 'Miễn phí',
          days: p.durationDays,
          maxCandidates: p.maxApplications ?? 0,
          features: p.description ? [p.description] : [],
        })),
    [postingPackages.data]
  );

  // Only real service types from the API: their ids are what POST /jobs needs.
  const availableServiceTypes = useMemo(() => serviceTypes.data ?? [], [serviceTypes.data]);

  // Watch entire form for live readiness and preview
  const watchedValues = Form.useWatch((v) => v, form) as Partial<JobFormValues> | undefined;
  const watched = useMemo(() => watchedValues ?? {}, [watchedValues]);

  // Effective Service ID and Code (from React State or form watch)
  const effectiveServiceId = selectedServiceId || watched.serviceTypeId || '';
  const effectiveCode: ServiceTypeCode | undefined = useMemo(() => {
    if (selectedServiceCode) return selectedServiceCode;
    if (effectiveServiceId) {
      const match = availableServiceTypes.find((s) => s.id === effectiveServiceId || s.code === (effectiveServiceId as any));
      return match?.code;
    }
    return undefined;
  }, [selectedServiceCode, effectiveServiceId, availableServiceTypes]);

  const hasMustHave = (watched.requirements ?? []).some((r) => r?.requirementType === 'MUST_HAVE' && r.content?.trim());

  // Load existing job details
  useEffect(() => {
    if (existing.data) {
      const job = existing.data;
      form.setFieldsValue(toFormValues(job));

      if (job.serviceTypeId) {
        setSelectedServiceId(job.serviceTypeId);
      }
      if (job.serviceTypeCode) {
        setSelectedServiceCode(job.serviceTypeCode);
      } else if (job.serviceTypeId) {
        const found = availableServiceTypes.find((s) => s.id === job.serviceTypeId || s.code === (job.serviceTypeId as any));
        if (found) setSelectedServiceCode(found.code);
      }
    }
  }, [existing.data, form, availableServiceTypes]);

  const editable = !isEdit || (existing.data ? clientActions(existing.data.status).canEdit : false);
  const serviceTypeLocked = isEdit && existing.data?.status !== 'DRAFT';

  // Checklist items mapping to steps and fields
  const checklist = useMemo(() => {
    const hasService = Boolean(selectedServiceId || watched.serviceTypeId || selectedServiceCode);
    const base = [
      { label: 'Chọn loại dịch vụ', done: hasService, step: 0, field: 'form-service-section' },
      { label: 'Tên vị trí', done: Boolean(watched.title?.trim()), step: 1, field: 'form-title-item' },
      { label: 'Hình thức làm việc', done: Boolean(watched.employmentType), step: 1, field: 'form-employment-item' },
      { label: 'Địa điểm', done: Boolean(watched.location?.trim()), step: 1, field: 'form-location-item' },
      { label: 'Mô tả công việc', done: Boolean(watched.description?.trim()), step: 1, field: 'form-desc-item' },
      { label: 'Quyền lợi', done: Boolean(watched.benefits?.trim()), step: 1, field: 'form-benefits-item' },
      { label: 'Ít nhất 1 yêu cầu bắt buộc', done: hasMustHave, step: 1, field: 'form-requirements-item' },
    ];
    if (effectiveCode === 'CV_SOURCING') {
      base.push({
        label: 'Số lượng CV muốn nhận',
        done: Boolean(watched.targetCandidateCount && watched.targetCandidateCount > 0),
        step: 2,
        field: 'form-cv-count-item',
      });
    }
    return base;
  }, [watched, selectedServiceId, selectedServiceCode, effectiveCode, hasMustHave]);

  const doneCount = checklist.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checklist.length) * 100);
  const ready = doneCount === checklist.length;

  // Jump from checklist or review to specific step & field
  const goToStep = (stepIdx: number, fieldId?: string) => {
    setCurrentStep(stepIdx);
    if (fieldId) {
      setTimeout(() => {
        document.getElementById(fieldId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  };

  // ─── Step 1 Service Selection with Change Confirmation ───────────────────────

  const handleSelectService = (st: ServiceType) => {
    if (serviceTypeLocked || !editable) return;
    const currentId = selectedServiceId || form.getFieldValue('serviceTypeId');
    if (currentId === st.id) return;

    const currentValues = form.getFieldsValue();
    const currentCode = effectiveCode;
    const hasOldStep3 = hasStep3Data(currentValues, currentCode);

    const applyChange = () => {
      setSelectedServiceId(st.id);
      setSelectedServiceCode(st.code);

      form.setFieldsValue({
        serviceTypeId: st.id,
        postingPackage: 'STANDARD',
        targetCandidateCount: undefined,
        sourcingPricePerCv: undefined,
        feeMultiplier: undefined,
        annualSalaryPercent: undefined,
        warrantyDays: undefined,
        paymentDueDays: undefined,
        termsNote: undefined,
      });

    };

    if (hasOldStep3) {
      modal.confirm({
        title: 'Xác nhận thay đổi loại dịch vụ?',
        icon: <ExclamationCircleOutlined className="text-amber-500" />,
        content:
          'Bạn đã nhập thông tin nhu cầu & chi phí ở Bước 3. Nếu chuyển đổi sang dịch vụ khác, các thông tin chi phí của dịch vụ cũ sẽ bị xóa.',
        okText: 'Đổi dịch vụ & xóa dữ liệu cũ',
        cancelText: 'Giữ nguyên',
        onOk: applyChange,
      });
    } else {
      applyChange();
    }
  };

  // ─── Step Navigation ────────────────────────────────────────────────────────

  const validateStep = (step: number): boolean => {
    const values = form.getFieldsValue();
    if (step === 0) {
      if (!selectedServiceId && !values.serviceTypeId) {
        message.warning('Vui lòng chọn loại dịch vụ trước khi tiếp tục.');
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (!values.title?.trim()) {
        message.warning('Vui lòng nhập tên vị trí tuyển dụng.');
        return false;
      }
      if (!values.quantity || values.quantity < 1) {
        message.warning('Số lượng cần tuyển phải từ 1 người trở lên.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (effectiveCode === 'CV_SOURCING') {
        if (!values.targetCandidateCount || values.targetCandidateCount < 1) {
          message.warning('Vui lòng nhập số lượng CV muốn nhận (bắt buộc với dịch vụ Sourcing).');
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 3));
    }
  };

  const handleStepClick = (target: number) => {
    if (target === currentStep) return;
    if (target > currentStep) {
      if (!validateStep(currentStep)) return;
    }
    setCurrentStep(target);
  };

  // ─── Save & Submit ──────────────────────────────────────────────────────────

  const save = async (andSubmit: boolean) => {
    setErrorSummary([]);
    const formValues = form.getFieldsValue();
    const newStepErrors: Record<number, boolean> = {};

    // Ensure serviceTypeId is synced from React state if needed
    if (!formValues.serviceTypeId && effectiveServiceId) {
      formValues.serviceTypeId = effectiveServiceId;
      form.setFieldValue('serviceTypeId', effectiveServiceId);
    }

    if (andSubmit) {
      const blockers = submitBlockers(formValues, effectiveCode, Boolean(effectiveServiceId));
      if (blockers.length > 0) {
        blockers.forEach((b) => {
          newStepErrors[b.step] = true;
        });
        setStepErrors(newStepErrors);

        form.setFields(
          blockers
            .filter((b) => b.field[0] !== 'requirements')
            .map((b) => ({ name: b.field, errors: [b.message] })) as Parameters<typeof form.setFields>[0]
        );

        setErrorSummary([
          'Chưa đủ thông tin bắt buộc để gửi duyệt (bạn vẫn có thể chọn "Lưu nháp"):',
          ...blockers.map((b) => b.message),
        ]);

        const firstErrorStep = blockers[0]?.step;
        if (firstErrorStep !== undefined && firstErrorStep !== currentStep) {
          setCurrentStep(firstErrorStep);
        }

        requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
    }

    setSaving(andSubmit ? 'submit' : 'draft');
    try {
      const packageCode = formValues.postingPackage || 'STANDARD';
      const packageId = postingPackages.data?.find((p) => p.code === packageCode)?.packageId ?? null;
      const input = toInput(formValues, effectiveCode, packageId);
      let savedId: string;

      if (isEdit && existing.data) {
        const res = await update.mutateAsync({
          jobId: existing.data.jobId,
          input,
          token: existing.data.concurrencyToken,
        });
        savedId = res.data.jobId;
      } else {
        const res = await create.mutateAsync(input);
        savedId = res.data.jobId;
      }

      if (andSubmit) {
        const fresh = await jobsApi.getById(savedId);
        const res = await jobsApi.submit(savedId, fresh.concurrencyToken);
        message.success(res.message || 'Đã gửi duyệt tin tuyển dụng thành công.');
      } else {
        message.success('Đã lưu bản nháp tin tuyển dụng.');
      }
      navigate('/client/jobs');
    } catch (err) {
      const mapped = applyServerFieldErrors(form, err);
      const text = getApiErrorMessage(err);
      setErrorSummary([mapped ? 'Một số thông tin chưa hợp lệ, xem chi tiết ở từng ô bên dưới.' : text]);
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } finally {
      setSaving(null);
    }
  };

  // ─── Render States ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (freeBlocked && watched.postingPackage === 'FREE') form.setFieldValue('postingPackage', 'STANDARD');
  }, [freeBlocked, watched.postingPackage, form]);

  if (isEdit && existing.isLoading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }
  if (isEdit && existing.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được tin tuyển dụng"
        description={getApiErrorMessage(existing.error)}
      />
    );
  }

  const selectedPkg = packageCards.find((p) => p.key === (watched.postingPackage || 'STANDARD')) ?? packageCards[0];

  const submitButton = (block?: boolean) => (
    <Button
      type="primary"
      size="large"
      block={block}
      className="client-cta font-medium shadow-sm"
      onClick={() => save(true)}
      loading={saving === 'submit'}
      disabled={saving === 'draft'}
    >
      Lưu và gửi duyệt
    </Button>
  );

  const draftButton = (block?: boolean) => (
    <Button
      size="large"
      block={block}
      onClick={() => save(false)}
      loading={saving === 'draft'}
      disabled={saving === 'submit'}
    >
      Lưu nháp
    </Button>
  );

  // ─── Step Items ─────────────────────────────────────────────────────────────

  const stepsConfig = [
    {
      title: 'Chọn dịch vụ',
      description: effectiveCode ? SERVICE_META[effectiveCode]?.tag : '1 trong 3 dịch vụ',
      status: stepErrors[0] ? ('error' as const) : undefined,
    },
    {
      title: 'Mô tả công việc',
      description: 'JD tiêu chuẩn',
      status: stepErrors[1] ? ('error' as const) : undefined,
    },
    {
      title: 'Nhu cầu & chi phí',
      description: effectiveCode === 'CV_APPLICATION' ? 'Gói tin đăng' : 'Đề xuất & số lượng',
      status: stepErrors[2] ? ('error' as const) : undefined,
    },
    {
      title: 'Xem lại & gửi duyệt',
      description: 'Tổng quan & xác nhận',
      status: stepErrors[3] ? ('error' as const) : undefined,
    },
  ];

  return (
    <div className="pb-24 lg:pb-0">
      {/* Back button */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        className="!mb-2 !px-0 text-slate-600 hover:text-slate-900"
        onClick={() => navigate('/client/jobs')}
      >
        Tin tuyển dụng của tôi
      </Button>

      {/* Header */}
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--console-accent-strong)]">
          Tuyển dụng
        </div>
        <h1 className="m-0 text-[28px] font-bold leading-tight tracking-[-0.01em] text-slate-900">
          {isEdit ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng mới'}
        </h1>
        <p className="m-0 mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">
          Tạo tin tuyển dụng theo 4 bước tinh gọn. Bạn có thể lưu nháp bất cứ lúc nào và gửi duyệt khi đã hoàn thiện đầy đủ.
        </p>
      </header>

      {/* 4-Step Navigation Bar */}
      <div className="mb-6 rounded-2xl border border-solid border-slate-200 bg-white p-4 shadow-sm">
        <Steps
          current={currentStep}
          onChange={handleStepClick}
          items={stepsConfig}
          className="job-form-steps"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Main Form Column ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {!editable && existing.data && (
            <Alert
              type="info"
              showIcon
              message="Tin này không sửa được ở trạng thái hiện tại"
              description="Chỉ sửa được tin ở trạng thái Bản nháp hoặc Bị từ chối."
            />
          )}
          {existing.data?.status === 'REJECTED' && existing.data.statusReason && (
            <Alert
              type="warning"
              showIcon
              message="HR Connect đã từ chối tin này"
              description={existing.data.statusReason}
            />
          )}

          {errorSummary.length > 0 && (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="outline-none">
              <Alert
                type="error"
                showIcon
                message="Chưa lưu được tin tuyển dụng"
                description={
                  <ul className="m-0 pl-4 space-y-1">
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
            preserve={true}
            requiredMark={(label, info) =>
              info.required ? (
                <span>
                  {label} <span className="text-red-500 font-bold ml-0.5">*</span>
                </span>
              ) : (
                label
              )
            }
            initialValues={EMPTY_VALUES}
            disabled={!editable || saving !== null}
            validateTrigger="onBlur"
            className="space-y-5"
          >
            {/* Hidden field to keep serviceTypeId registered in Form */}
            <Form.Item name="serviceTypeId" hidden noStyle>
              <Input type="hidden" />
            </Form.Item>
            {/* Registered so getFieldsValue() keeps it: the backend counts template usage from it. */}
            <Form.Item name="templateId" hidden noStyle>
              <Input type="hidden" />
            </Form.Item>

            {/* ═════════════════════════════════════════════════════════════════
                BƯỚC 1: CHỌN DỊCH VỤ
                ═════════════════════════════════════════════════════════════════ */}
            <div className={currentStep === 0 ? 'space-y-5' : 'hidden'}>
              <section id="form-service-section" className="admin-surface p-5 sm:p-7 space-y-6">
                <header>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                      1
                    </span>
                    <h2 className="m-0 text-[18px] font-semibold text-slate-900">
                      Chọn loại dịch vụ tuyển dụng <span className="text-red-500 font-bold ml-1">*</span>
                    </h2>
                  </div>
                  <p className="m-0 text-[13.5px] text-slate-600">
                    Mỗi dịch vụ được thiết kế cho mục tiêu tuyển dụng riêng biệt. Vui lòng chọn dịch vụ phù hợp nhất:
                  </p>
                </header>

                <div>
                  {serviceTypes.isLoading ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Skeleton.Button active block style={{ height: 180 }} />
                      <Skeleton.Button active block style={{ height: 180 }} />
                      <Skeleton.Button active block style={{ height: 180 }} />
                    </div>
                  ) : serviceTypes.isError || availableServiceTypes.length === 0 ? (
                    <Alert
                      type={serviceTypes.isError ? 'error' : 'warning'}
                      showIcon
                      message={serviceTypes.isError ? 'Không tải được loại dịch vụ tuyển dụng' : 'Chưa có loại dịch vụ nào đang mở'}
                      description={
                        serviceTypes.isError
                          ? getApiErrorMessage(serviceTypes.error)
                          : 'Vui lòng liên hệ HR Connect để được hỗ trợ.'
                      }
                      action={
                        <Button size="small" onClick={() => serviceTypes.refetch()} loading={serviceTypes.isFetching}>
                          Thử lại
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      {availableServiceTypes.map((st: ServiceType) => {
                        const meta = SERVICE_META[st.code] ?? {
                          code: st.code,
                          tag: 'Dịch vụ',
                          color: 'blue',
                          icon: <RocketOutlined />,
                          defaultTitle: st.name,
                          defaultSummary: st.description ?? '',
                          feeRule: 'Theo quy định của HR Connect.',
                        };
                        const isSelected =
                          selectedServiceId === st.id ||
                          selectedServiceCode === st.code ||
                          watched.serviceTypeId === st.id;

                        return (
                          <div
                            key={st.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() => handleSelectService(st)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSelectService(st)}
                            className={`group relative flex flex-col justify-between rounded-2xl border-2 border-solid p-5 text-left transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)]/40 shadow-md ring-2 ring-[color:var(--console-accent)]/20'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            } ${serviceTypeLocked || !editable ? 'opacity-65 cursor-not-allowed' : ''}`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-white transition-colors">
                                    {meta.icon}
                                  </div>
                                  <Tag color={meta.color} className="m-0 min-w-0 truncate font-medium" title={meta.tag}>
                                    {meta.tag}
                                  </Tag>
                                </div>
                                <div
                                  aria-hidden
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-solid transition-colors ${
                                    isSelected
                                      ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent)]'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                              </div>

                              <h3 className="m-0 text-[16px] font-bold text-slate-900 leading-snug">
                                {st.name || meta.defaultTitle}
                              </h3>
                              <p className="mt-2 text-[13px] text-slate-600 leading-relaxed min-h-[40px]">
                                {meta.defaultSummary}
                              </p>
                            </div>

                            {/* Read-only Fee Rule Block */}
                            <div className="mt-4 rounded-xl border border-solid border-slate-200/90 bg-white/90 p-3 text-[12px] text-slate-700">
                              <span className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                                <WalletOutlined className="text-[color:var(--console-accent)]" />
                                Cách tính phí (chỉ đọc):
                              </span>
                              <span className="text-slate-600 leading-normal">{meta.feeRule}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {serviceTypeLocked && (
                    <div className="mt-2 text-xs text-slate-500">Chỉ đổi được loại dịch vụ khi tin còn là bản nháp.</div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-0 border-t border-solid border-slate-100">
                  <Button
                    type="primary"
                    size="large"
                    className="client-cta px-8"
                    onClick={handleNext}
                    disabled={!effectiveServiceId}
                  >
                    Tiếp tục sang Mô tả công việc
                  </Button>
                </div>
              </section>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                BƯỚC 2: MÔ TẢ CÔNG VIỆC (JD DÙNG CHUNG)
                ═════════════════════════════════════════════════════════════════ */}
            <div className={currentStep === 1 ? 'space-y-5' : 'hidden'}>
              {/* F1 & F2: Bắt đầu nhanh từ mẫu JD */}
              <JobTemplatePicker
                editable={editable}
                hasStep2Content={() => hasStep2Content(form.getFieldsValue())}
                currentSkills={watched.skills ?? []}
                currentTemplateId={watched.templateId}
                onApplyTemplate={handleApplyTemplate}
                defaultOpen={!isEdit && !hasStep2Content(existing.data ? toFormValues(existing.data) : {})}
              />

              {/* 1. Basic Info */}
              <section className="admin-surface p-5 sm:p-7 space-y-5">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                    2.1
                  </span>
                  <h2 className="m-0 text-[17px] font-semibold text-slate-900">Thông tin vị trí tuyển dụng</h2>
                </header>

                <div id="form-title-item">
                  <Form.Item
                    name="title"
                    label="Tên vị trí tuyển dụng"
                    rules={[
                      { required: true, whitespace: true, message: 'Vui lòng nhập tên vị trí.' },
                      { max: 255, message: 'Tối đa 255 ký tự.' },
                    ]}
                  >
                    <Input size="large" placeholder="Ví dụ: Kỹ sư Backend .NET (Senior) hoặc Chuyên viên Marketing" />
                  </Form.Item>
                </div>

                <div className="grid gap-x-4 md:grid-cols-2">
                  <div id="form-employment-item">
                    <Form.Item
                      name="employmentType"
                      label="Hình thức làm việc"
                      rules={[{ required: true, message: 'Chọn hình thức làm việc.' }]}
                    >
                      <Select
                        size="large"
                        placeholder="Chọn hình thức làm việc"
                        options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((k) => ({
                          value: k,
                          label: EMPLOYMENT_TYPE_LABEL[k],
                        }))}
                      />
                    </Form.Item>
                  </div>

                  <Form.Item
                    name="quantity"
                    label="Số lượng cần tuyển"
                    rules={[{ required: true, type: 'number', min: 1, max: 1000, message: 'Từ 1 đến 1000 người.' }]}
                  >
                    <InputNumber size="large" min={1} max={1000} className="w-full" addonAfter="người" />
                  </Form.Item>

                  <div id="form-location-item">
                    <Form.Item
                      name="location"
                      label="Địa điểm làm việc"
                      rules={[
                        { required: true, message: 'Vui lòng nhập địa điểm làm việc.' },
                        { max: 255, message: 'Tối đa 255 ký tự.' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<EnvironmentOutlined className="text-slate-400" />}
                        placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh (hoặc Hybrid)"
                      />
                    </Form.Item>
                  </div>

                  <Form.Item name="workingTime" label="Thời gian làm việc" rules={[{ max: 2000, message: 'Tối đa 2000 ký tự.' }]}>
                    <Input size="large" placeholder="Ví dụ: Thứ 2 – Thứ 6, 8:30 – 17:30" />
                  </Form.Item>
                </div>

                <div className="grid gap-x-4 md:grid-cols-2">
                  <Form.Item
                    name="deadline"
                    label="Hạn nhận hồ sơ"
                    getValueProps={(val) => ({
                      value: val ? (dayjs.isDayjs(val) ? val : dayjs(val)) : null,
                    })}
                    normalize={(val) => (val ? val.format('YYYY-MM-DD') : null)}
                  >
                    <DatePicker
                      size="large"
                      className="w-full"
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày hết hạn nhận hồ sơ"
                      disabledDate={(cur) => cur && cur.isBefore(dayjs().startOf('day'))}
                    />
                  </Form.Item>

                  <div>
                    <label className="mb-2 block text-sm text-slate-900 font-medium">Yêu cầu số năm kinh nghiệm</label>
                    <div className="grid grid-cols-2 gap-x-3">
                      <Form.Item name="minExperienceYears" className="mb-0" rules={[{ type: 'number', min: 0, max: 50, message: '0-50.' }]}>
                        <InputNumber size="large" min={0} max={50} className="w-full" addonBefore="Từ" placeholder="0" />
                      </Form.Item>
                      <Form.Item
                        name="maxExperienceYears"
                        className="mb-0"
                        dependencies={['minExperienceYears']}
                        rules={[
                          { type: 'number', min: 0, max: 50, message: '0-50.' },
                          ({ getFieldValue }) => ({
                            validator: (_, v) => {
                              const min = getFieldValue('minExperienceYears');
                              return v == null || min == null || v >= min
                                ? Promise.resolve()
                                : Promise.reject(new Error('Phải ≥ mức tối thiểu.'));
                            },
                          }),
                        ]}
                      >
                        <InputNumber size="large" min={0} max={50} className="w-full" addonBefore="Đến" placeholder="10" />
                      </Form.Item>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Salary */}
              <section className="admin-surface p-5 sm:p-7 space-y-4">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                    2.2
                  </span>
                  <h2 className="m-0 text-[17px] font-semibold text-slate-900">Mức lương và chế độ đãi ngộ</h2>
                </header>

                <div className="grid gap-x-4 md:grid-cols-[1fr_1fr_120px]">
                  <Form.Item name="salaryMin" label="Mức lương từ" rules={[{ type: 'number', min: 0, message: 'Không âm.' }]}>
                    <InputNumber<number> size="large" {...moneyInputProps} placeholder="15.000.000" />
                  </Form.Item>
                  <Form.Item
                    name="salaryMax"
                    label="Đến mức"
                    dependencies={['salaryMin']}
                    rules={[
                      { type: 'number', min: 0, message: 'Không âm.' },
                      ({ getFieldValue }) => ({
                        validator: (_, v) => {
                          const min = getFieldValue('salaryMin');
                          return v == null || min == null || v >= min
                            ? Promise.resolve()
                            : Promise.reject(new Error('Phải ≥ mức "Từ".'));
                        },
                      }),
                    ]}
                  >
                    <InputNumber<number> size="large" {...moneyInputProps} placeholder="30.000.000" />
                  </Form.Item>
                  <Form.Item name="currencyCode" label="Tiền tệ" rules={[{ required: true, message: 'Chọn tiền tệ.' }]}>
                    <Select size="large" options={['VND', 'USD'].map((c) => ({ value: c, label: c }))} />
                  </Form.Item>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 border border-solid border-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Mức lương có thể thỏa thuận</div>
                    <div className="text-[13px] text-slate-600">Hiển thị nhãn “Thỏa thuận” bên cạnh mức lương đối với ứng viên.</div>
                  </div>
                  <Form.Item name="salaryNegotiable" valuePropName="checked" noStyle>
                    <Switch aria-label="Mức lương có thể thỏa thuận" />
                  </Form.Item>
                </div>

                <Form.Item name="salaryNote" label="Ghi chú về lương" className="mb-0" rules={[{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}>
                  <Input size="large" placeholder="Ví dụ: Lương Gross, thưởng hiệu suất hàng quý, tháng 13..." />
                </Form.Item>
              </section>

              {/* 3. Description & Benefits */}
              <section className="admin-surface p-5 sm:p-7 space-y-4">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                    2.3
                  </span>
                  <h2 className="m-0 text-[17px] font-semibold text-slate-900">Mô tả công việc & Quyền lợi</h2>
                </header>

                <div id="form-desc-item">
                  <Form.Item
                    name="description"
                    label="Mô tả công việc (Job Description)"
                    rules={[{ required: true, message: 'Vui lòng nhập mô tả công việc.' }]}
                  >
                    <Input.TextArea
                      rows={6}
                      showCount
                      placeholder={'• Công việc hàng ngày của vị trí\n• Dự án và đội ngũ làm việc cùng\n• Kết quả mong đợi trong 3 - 6 tháng đầu'}
                    />
                  </Form.Item>
                </div>

                <div id="form-benefits-item">
                  <Form.Item
                    name="benefits"
                    label="Quyền lợi ứng viên"
                    className="mb-0"
                    rules={[
                      { required: true, message: 'Vui lòng nhập quyền lợi ứng viên.' },
                      { max: 10000, message: 'Tối đa 10000 ký tự.' },
                    ]}
                  >
                    <Input.TextArea
                      rows={5}
                      showCount
                      maxLength={10000}
                      placeholder={'• Chế độ bảo hiểm sức khỏe cao cấp\n• 15 ngày phép/năm, review lương định kỳ\n• Môi trường làm việc năng động, lộ trình thăng tiến rõ ràng'}
                    />
                  </Form.Item>
                </div>
              </section>

              {/* 4. Requirements & Skills */}
              <section id="form-requirements-item" className="admin-surface p-5 sm:p-7 space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                      2.4
                    </span>
                    <h2 className="m-0 text-[17px] font-semibold text-slate-900">Yêu cầu tuyển dụng & Kỹ năng</h2>
                  </div>
                  <Tag color={hasMustHave ? 'green' : 'orange'} className="m-0 font-medium">
                    {hasMustHave ? 'Đã có yêu cầu bắt buộc' : 'Cần ít nhất 1 yêu cầu bắt buộc'}
                  </Tag>
                </header>

                <Form.Item
                  name="skills"
                  label="Kỹ năng chính (Skills Tag)"
                  extra="Nhập kỹ năng và nhấn Enter hoặc chọn từ danh sách gợi ý."
                >
                  <Select
                    mode="tags"
                    size="large"
                    placeholder="Ví dụ: ReactJS, ASP.NET Core, SQL Server, Docker, English..."
                    options={[
                      { value: 'ASP.NET Core', label: 'ASP.NET Core' },
                      { value: 'C#', label: 'C#' },
                      { value: 'ReactJS', label: 'ReactJS' },
                      { value: 'TypeScript', label: 'TypeScript' },
                      { value: 'Java', label: 'Java' },
                      { value: 'Python', label: 'Python' },
                      { value: 'SQL / PostgreSQL', label: 'SQL / PostgreSQL' },
                      { value: 'Docker & DevOps', label: 'Docker & DevOps' },
                      { value: 'Tiếng Anh giao tiếp', label: 'Tiếng Anh giao tiếp' },
                      { value: 'Kỹ năng giao tiếp', label: 'Kỹ năng giao tiếp' },
                    ]}
                  />
                </Form.Item>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">
                    Danh sách tiêu chí yêu cầu ứng viên <span className="text-red-500 font-bold ml-0.5">*</span>:
                  </div>
                  <Form.List name="requirements">
                    {(fields, { add, remove }) => (
                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.key} className="rounded-xl border border-solid border-slate-200 bg-slate-50/70 p-3.5">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 md:grid-cols-[auto_minmax(0,1fr)_185px_auto]">
                              <Form.Item
                                name={[field.name, 'requirementType']}
                                label="Mức độ"
                                className="mb-2 md:mb-0"
                                rules={[{ required: true, message: 'Chọn mức độ.' }]}
                              >
                                <Radio.Group optionType="button" buttonStyle="solid" size="middle" className="inline-flex whitespace-nowrap">
                                  <Radio.Button value="MUST_HAVE" className="px-3 text-center">Bắt buộc</Radio.Button>
                                  <Radio.Button value="SHOULD_HAVE" className="px-3 text-center">Ưu tiên</Radio.Button>
                                </Radio.Group>
                              </Form.Item>

                              <div className="order-3 col-span-2 md:order-none md:col-span-1">
                                <Form.Item
                                  name={[field.name, 'content']}
                                  label={`Nội dung yêu cầu ${index + 1}`}
                                  className="mb-2 md:mb-0"
                                  rules={[{ required: true, whitespace: true, message: 'Nhập nội dung yêu cầu hoặc xóa dòng này.' }]}
                                >
                                  <Input placeholder="Ví dụ: Tối thiểu 3 năm kinh nghiệm xây dựng RESTful API" />
                                </Form.Item>
                              </div>

                              <div className="order-4 col-span-2 md:order-none md:col-span-1">
                                <Form.Item name={[field.name, 'category']} label="Phân nhóm" className="mb-0">
                                  <Select
                                    placeholder="Chọn phân nhóm"
                                    allowClear
                                    showSearch
                                    options={REQUIREMENT_CATEGORY_OPTIONS}
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                                      (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                  />
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

                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => add({ requirementType: 'SHOULD_HAVE', content: '' })}
                          block
                          type="dashed"
                          size="large"
                          className="text-slate-700"
                        >
                          Thêm tiêu chí yêu cầu
                        </Button>
                      </div>
                    )}
                  </Form.List>
                </div>
              </section>

              {/* Bottom Step Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Button size="large" onClick={() => setCurrentStep(0)}>
                  Quay lại: Chọn dịch vụ
                </Button>
                <div className="flex items-center gap-2">
                  {draftButton()}
                  <Button type="primary" size="large" className="client-cta px-6" onClick={handleNext}>
                    Tiếp tục: Nhu cầu & Chi phí
                  </Button>
                </div>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                BƯỚC 3: NHU CẦU VÀ CHI PHÍ (ĐỘNG THEO DỊCH VỤ)
                ═════════════════════════════════════════════════════════════════ */}
            <div className={currentStep === 2 ? 'space-y-5' : 'hidden'}>
              {/* Fallback if user somehow reached Step 3 without selecting service */}
              {!effectiveCode && (
                <section className="admin-surface p-8 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-2">
                    <ExclamationCircleOutlined className="text-2xl" />
                  </div>
                  <h3 className="m-0 text-[18px] font-bold text-slate-900">Vui lòng chọn loại dịch vụ ở Bước 1 trước</h3>
                  <p className="m-0 max-w-md mx-auto text-sm text-slate-600 leading-relaxed">
                    Nội dung về gói đăng tin, hạn mức tuyển dụng và đề xuất chi phí sẽ được tải tự động dựa trên dịch vụ bạn lựa chọn (Nhận CV ứng tuyển, Tìm nguồn CV, hoặc Headhunt COD).
                  </p>
                  <Button
                    type="primary"
                    size="large"
                    className="client-cta px-8 mt-2"
                    onClick={() => setCurrentStep(0)}
                  >
                    Quay lại Bước 1: Chọn loại dịch vụ
                  </Button>
                </section>
              )}

              {/* Case 1: CV_APPLICATION */}
              {effectiveCode === 'CV_APPLICATION' && (
                <section className="admin-surface p-5 sm:p-7 space-y-6">
                  <header>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                        3
                      </span>
                      <h2 className="m-0 text-[18px] font-semibold text-slate-900">
                        Chọn gói đăng tin tuyển dụng <span className="text-red-500 font-bold ml-1">*</span>
                      </h2>
                    </div>
                    <p className="m-0 text-[13.5px] text-slate-600">
                      Chọn gói dịch vụ hiển thị phù hợp với nhu cầu tiếp cận ứng viên. Bạn thanh toán <b>sau khi tin được duyệt</b>.
                    </p>
                  </header>

                  <Form.Item name="postingPackage" className="mb-0">
                    <div className="grid gap-4 md:grid-cols-3">
                      {packageCards.length === 0 && (
                        <Alert type={postingPackages.isError ? 'error' : 'info'} showIcon className="md:col-span-3"
                          message={postingPackages.isError ? 'Không tải được danh sách gói đăng tin' : 'Đang tải gói đăng tin...'} />
                      )}
                      {packageCards.map((pkg) => {
                        const isPkgSelected = (watched.postingPackage || 'STANDARD') === pkg.key;
                        const isBlocked = pkg.key === 'FREE' && freeBlocked;
                        const choose = () => !isBlocked && form.setFieldValue('postingPackage', pkg.key);
                        return (
                          <div
                            key={pkg.key}
                            role="button"
                            tabIndex={isBlocked ? -1 : 0}
                            aria-disabled={isBlocked}
                            onClick={choose}
                            onKeyDown={(e) => e.key === 'Enter' && choose()}
                            className={`relative flex flex-col justify-between rounded-2xl border-2 border-solid p-5 text-left transition-all ${
                              isBlocked ? 'cursor-not-allowed opacity-60 border-slate-200 bg-slate-50' : 'cursor-pointer'
                            } ${
                              isBlocked
                                ? ''
                                : isPkgSelected
                                ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)]/40 shadow-md ring-2 ring-[color:var(--console-accent)]/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div>
                              {pkg.tag && (
                                <div className="absolute -top-3 right-4">
                                  <span className="rounded-full bg-[color:var(--console-accent-strong)] px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                                    {pkg.tag}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-900 text-[16px]">{pkg.name}</span>
                                <Radio checked={isPkgSelected} className="pointer-events-none" />
                              </div>

                              <div className="my-3 pb-3 border-0 border-b border-solid border-slate-200">
                                <div className="text-[24px] font-extrabold text-slate-900">{pkg.priceText}</div>
                                <div className="text-xs text-slate-600">Thời hạn {pkg.days} ngày{pkg.maxCandidates > 0 ? ` · Tối đa ${pkg.maxCandidates} hồ sơ` : ''}</div>
                              </div>

                              {isBlocked && freeBlockedReason && (
                                <div role="note" className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
                                  Chưa dùng được gói này: {freeBlockedReason}
                                </div>
                              )}
                              <ul className="m-0 p-0 list-none space-y-2 text-[12.5px] text-slate-700">
                                {pkg.features.map((feat, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <CheckCircleOutlined className="text-emerald-600 mt-0.5 shrink-0" />
                                    <span>{feat}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="mt-5 text-center">
                              <Button
                                type={isPkgSelected ? 'primary' : 'default'}
                                disabled={isBlocked}
                                block
                                className={isPkgSelected ? 'client-cta' : ''}
                              >
                                {isBlocked ? 'Chưa đủ điều kiện' : isPkgSelected ? 'Đang chọn gói này' : 'Chọn gói'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Form.Item>

                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    message="Quy tắc thanh toán gói đăng tin"
                    description="Với dịch vụ Nhận CV ứng tuyển, giá dịch vụ là công khai và không có ô đề xuất phí. Khoản phí sẽ được kích hoạt thanh toán khi tin tuyển dụng của bạn được HR Connect xét duyệt."
                  />
                </section>
              )}

              {/* Case 2: CV_SOURCING */}
              {effectiveCode === 'CV_SOURCING' && (
                <section className="admin-surface p-5 sm:p-7 space-y-6">
                  <header>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                        3
                      </span>
                      <h2 className="m-0 text-[18px] font-semibold text-slate-900">Nhu cầu cung cấp hồ sơ ứng viên</h2>
                    </div>
                    <p className="m-0 text-[13.5px] text-slate-600">
                      Nhập số lượng hồ sơ bạn cần và đề xuất mức phí mong muốn cho mỗi CV tiếp nhận.
                    </p>
                  </header>

                  {/* Target CV Count (Required) */}
                  <div id="form-cv-count-item" className="rounded-2xl border border-solid border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-900">
                        Số lượng CV bạn muốn nhận <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        Bắt buộc
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">
                      HR Connect sẽ cam kết tìm kiếm và giao đủ số lượng hồ sơ đạt yêu cầu theo tiêu chuẩn đã thỏa thuận.
                    </p>
                    <Form.Item
                      name="targetCandidateCount"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số CV muốn nhận.' },
                        { type: 'number', min: 1, max: 1000, message: 'Số lượng từ 1 đến 1000 CV.' },
                      ]}
                      className="mb-0"
                    >
                      <InputNumber
                        size="large"
                        min={1}
                        max={1000}
                        className="w-full max-w-xs"
                        placeholder="Ví dụ: 10"
                        addonAfter="hồ sơ CV"
                      />
                    </Form.Item>
                  </div>

                  {/* Proposed Fee Block (Optional) */}
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 sm:p-6 space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="m-0 text-[16px] font-bold text-slate-900">Mức phí bạn đề xuất (không bắt buộc)</h3>
                        <Badge count="Tùy chọn" style={{ backgroundColor: '#64748b' }} />
                      </div>
                      <p className="m-0 mt-1.5 text-[13px] text-slate-600 leading-relaxed italic">
                        Chuyên viên HR Connect sẽ liên hệ để thống nhất mức phí trước khi đăng tin. Mức phí chính thức là mức được xác nhận khi tin được duyệt.
                      </p>
                    </div>

                    <div className="grid gap-x-4 md:grid-cols-2">
                      <Form.Item
                        name="sourcingPricePerCv"
                        label="Mức phí bạn đề xuất cho mỗi CV (VNĐ)"
                        rules={[{ type: 'number', min: 0, message: 'Không được âm.' }]}
                      >
                        <InputNumber<number>
                          size="large"
                          {...moneyInputProps}
                          placeholder="Ví dụ: 500.000"
                          addonAfter="₫ / CV"
                        />
                      </Form.Item>

                      {/* Quick Estimated Calculation */}
                      <div className="rounded-xl border border-solid border-slate-100 bg-slate-50 p-3.5 flex flex-col justify-center">
                        <span className="text-xs text-slate-600">Ước tính tổng chi phí đề xuất:</span>
                        <span className="text-lg font-bold text-[color:var(--console-accent-strong)] mt-0.5">
                          {watched.targetCandidateCount && watched.sourcingPricePerCv
                            ? `${(watched.targetCandidateCount * watched.sourcingPricePerCv).toLocaleString('vi-VN')} ₫`
                            : 'Chưa có đề xuất'}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1">
                          Tiền đặt cọc và mức phí chính thức sẽ được xác nhận khi duyệt tin.
                        </span>
                      </div>
                    </div>

                    <Form.Item
                      name="termsNote"
                      label="Ghi chú đề xuất phí hoặc yêu cầu bổ sung"
                      className="mb-0"
                      rules={[{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Ví dụ: Mong muốn nhận đợt 1 trong 5 ngày đầu tiên, ưu tiên ứng viên có thể phỏng vấn ngay..."
                      />
                    </Form.Item>
                  </div>
                </section>
              )}

              {/* Case 3: HEADHUNT_COD */}
              {effectiveCode === 'HEADHUNT_COD' && (
                <section className="admin-surface p-5 sm:p-7 space-y-6">
                  <header>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                        3
                      </span>
                      <h2 className="m-0 text-[18px] font-semibold text-slate-900">Điều khoản chi phí tuyển dụng Headhunt</h2>
                    </div>
                    <p className="m-0 text-[13.5px] text-slate-600">
                      Dịch vụ Headhunt COD tính phí dựa trên mức lương thực tế khi ứng viên nhận việc. Bạn có thể đề xuất mức phí mong muốn bên dưới:
                    </p>
                  </header>

                  {/* Proposed Fee Block (Optional) */}
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 sm:p-6 space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="m-0 text-[16px] font-bold text-slate-900">Mức phí bạn đề xuất (không bắt buộc)</h3>
                        <Badge count="Tùy chọn" style={{ backgroundColor: '#64748b' }} />
                      </div>
                      <p className="m-0 mt-1.5 text-[13px] text-slate-600 leading-relaxed italic">
                        Chuyên viên HR Connect sẽ liên hệ để thống nhất mức phí trước khi đăng tin. Mức phí chính thức là mức được xác nhận khi tin được duyệt.
                      </p>
                    </div>

                    {/* Fee Multiplier & Annual Salary Percent (Synchronized) */}
                    <div className="grid gap-x-4 md:grid-cols-2">
                      <Form.Item
                        name="feeMultiplier"
                        label="Mức phí đề xuất (Số tháng lương)"
                        rules={[{ type: 'number', min: 0, max: 12, message: 'Từ 0 đến 12 tháng.' }]}
                        extra="Số tháng lương theo mức offer của ứng viên đi làm."
                      >
                        <InputNumber
                          size="large"
                          min={0}
                          max={12}
                          step={0.1}
                          className="w-full"
                          placeholder="Ví dụ: 1.5"
                          addonAfter="tháng lương"
                          onChange={(val) => {
                            if (val != null) {
                              form.setFieldValue('annualSalaryPercent', Number(((val / 12) * 100).toFixed(1)));
                            } else {
                              form.setFieldValue('annualSalaryPercent', undefined);
                            }
                          }}
                        />
                      </Form.Item>

                      <Form.Item
                        name="annualSalaryPercent"
                        label="Quy đổi tương đương (% lương năm)"
                        rules={[{ type: 'number', min: 0, max: 100, message: 'Từ 0% đến 100%.' }]}
                        extra="Tự động đồng bộ theo số tháng lương (1.5 tháng = 12.5% năm)."
                      >
                        <InputNumber
                          size="large"
                          min={0}
                          max={100}
                          step={0.5}
                          className="w-full"
                          placeholder="Ví dụ: 12.5"
                          addonAfter="% lương năm"
                          onChange={(val) => {
                            if (val != null) {
                              form.setFieldValue('feeMultiplier', Number(((val * 12) / 100).toFixed(2)));
                            } else {
                              form.setFieldValue('feeMultiplier', undefined);
                            }
                          }}
                        />
                      </Form.Item>
                    </div>

                    {/* Warranty Days & Payment Due Days */}
                    <div className="grid gap-x-4 md:grid-cols-2">
                      <Form.Item
                        name="warrantyDays"
                        label="Thời hạn bảo hành đề xuất (ngày)"
                        rules={[{ type: 'number', min: 0, max: 365, message: 'Từ 0 đến 365 ngày.' }]}
                        extra="Bảo hành tuyển thay thế miễn phí nếu ứng viên nghỉ việc. Để trống để dùng mức mặc định của HR Connect."
                      >
                        <InputNumber
                          size="large"
                          min={0}
                          max={365}
                          className="w-full"
                          placeholder="Theo mặc định"
                          addonAfter="ngày"
                        />
                      </Form.Item>

                      <Form.Item
                        name="paymentDueDays"
                        label="Hạn thanh toán đề xuất (ngày)"
                        rules={[{ type: 'number', min: 0, max: 180, message: 'Từ 0 đến 180 ngày.' }]}
                        extra="Số ngày thanh toán kể từ ngày ứng viên bắt đầu đi làm."
                      >
                        <InputNumber
                          size="large"
                          min={0}
                          max={180}
                          className="w-full"
                          placeholder="Ví dụ: 20"
                          addonAfter="ngày"
                        />
                      </Form.Item>
                    </div>

                    <Form.Item
                      name="termsNote"
                      label="Ghi chú đề xuất phí hoặc điều khoản thỏa thuận"
                      className="mb-0"
                      rules={[{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Ví dụ: Tuyển 2 người cùng vị trí, mong muốn hạn thanh toán dài hơn..."
                      />
                    </Form.Item>
                  </div>
                </section>
              )}

              {/* Bottom Step Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Button size="large" onClick={() => setCurrentStep(1)}>
                  Quay lại: Mô tả công việc
                </Button>
                <div className="flex items-center gap-2">
                  {draftButton()}
                  <Button type="primary" size="large" className="client-cta px-6" onClick={handleNext}>
                    Tiếp tục: Xem lại & Gửi duyệt
                  </Button>
                </div>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                BƯỚC 4: XEM LẠI VÀ GỬI DUYỆT (TỔNG HỢP)
                ═════════════════════════════════════════════════════════════════ */}
            <div className={currentStep === 3 ? 'space-y-5' : 'hidden'}>
              {/* 1. Job Description Summary */}
              <section className="admin-surface p-5 sm:p-7 space-y-5">
                <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--console-accent-soft)] text-xs font-bold text-[color:var(--console-accent-strong)]">
                      4.1
                    </span>
                    <h2 className="m-0 text-[17px] font-semibold text-slate-900">Tóm tắt tin tuyển dụng (JD)</h2>
                  </div>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => goToStep(1)}
                    className="text-sm font-medium"
                  >
                    Sửa JD
                  </Button>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {effectiveCode && (
                      <Tag color={SERVICE_META[effectiveCode]?.color} className="m-0 font-medium text-xs">
                        {SERVICE_TYPE_LABEL[effectiveCode]?.label}
                      </Tag>
                    )}
                    {watched.employmentType && (
                      <Tag className="m-0 text-xs">
                        {EMPLOYMENT_TYPE_LABEL[watched.employmentType]}
                      </Tag>
                    )}
                  </div>

                  <h3 className="m-0 text-[20px] font-bold text-slate-900">
                    {watched.title?.trim() || 'Chưa đặt tên vị trí'}
                  </h3>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[13.5px] text-slate-700 bg-slate-50 p-4 rounded-xl border border-solid border-slate-100">
                    <div className="flex items-center gap-2">
                      <WalletOutlined className="text-slate-400" />
                      <span>Mức lương: <b>{salaryText(watched)}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TeamOutlined className="text-slate-400" />
                      <span>Số lượng tuyển: <b>{watched.quantity ?? 1} người</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <EnvironmentOutlined className="text-slate-400" />
                      <span>Địa điểm: {watched.location?.trim() || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">📅</span>
                      <span>Hạn nộp: {watched.deadline || 'Không giới hạn'}</span>
                    </div>
                  </div>
                </div>

                {watched.description?.trim() && (
                  <div>
                    <div className="font-semibold text-slate-900 text-sm mb-1">Mô tả công việc:</div>
                    <div className="whitespace-pre-line text-sm text-slate-700 bg-slate-50/60 p-3.5 rounded-xl border border-solid border-slate-100">
                      {watched.description}
                    </div>
                  </div>
                )}

                {watched.benefits?.trim() && (
                  <div>
                    <div className="font-semibold text-slate-900 text-sm mb-1">Quyền lợi:</div>
                    <div className="whitespace-pre-line text-sm text-slate-700 bg-slate-50/60 p-3.5 rounded-xl border border-solid border-slate-100">
                      {watched.benefits}
                    </div>
                  </div>
                )}

                {/* Requirements List */}
                {(watched.requirements ?? []).filter((r) => r.content?.trim()).length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 text-sm mb-2">Yêu cầu ứng viên:</div>
                    <ul className="m-0 pl-0 list-none space-y-1.5 text-sm text-slate-700">
                      {(watched.requirements ?? [])
                        .filter((r) => r.content?.trim())
                        .map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircleFilled
                              className={r.requirementType === 'MUST_HAVE' ? 'text-emerald-600 mt-1' : 'text-slate-400 mt-1'}
                            />
                            <div>
                              <span className={r.requirementType === 'MUST_HAVE' ? 'font-medium text-slate-900' : 'text-slate-700'}>
                                {r.content}
                              </span>
                              <span className="ml-2 text-xs text-slate-500">
                                ({r.requirementType === 'MUST_HAVE' ? 'Bắt buộc' : 'Ưu tiên'}
                                {r.category ? ` · ${r.category}` : ''})
                              </span>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Skills tags */}
                {(watched.skills ?? []).length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 text-sm mb-1.5">Kỹ năng yêu cầu:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(watched.skills ?? []).map((skill, idx) => (
                        <Tag key={idx} color="processing" className="m-0">
                          {skill}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 2. Commercial Terms Summary Block (Về chi phí) */}
              <section className="rounded-2xl border-2 border-solid border-[color:var(--console-accent)] bg-emerald-50/20 p-5 sm:p-7 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-0 border-b border-solid border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--console-accent)] text-white">
                      <WalletOutlined />
                    </div>
                    <h2 className="m-0 text-[18px] font-bold text-slate-900">Về chi phí</h2>
                  </div>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => goToStep(2)}
                    className="text-sm font-medium"
                  >
                    Sửa chi phí
                  </Button>
                </div>

                {/* Fallback if no service selected */}
                {!effectiveCode && (
                  <Empty
                    description="Chưa chọn loại dịch vụ tuyển dụng"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}

                {/* CV_APPLICATION Summary */}
                {effectiveCode === 'CV_APPLICATION' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white p-4 border border-solid border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {selectedPkg ? `${selectedPkg.name}: ${selectedPkg.priceText} / ${selectedPkg.days} ngày` : 'Chưa tải được gói đăng tin'}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-emerald-800 m-0">
                        Bạn thanh toán <b>sau khi tin được duyệt</b>.
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 m-0">
                      Dịch vụ đăng tin áp dụng theo bảng giá công khai. Sau khi chuyên viên HR Connect duyệt tin tuyển dụng, quý công ty sẽ nhận thông báo hoàn tất thanh toán để tin hiển thị công khai.
                    </p>
                  </div>
                )}

                {/* CV_SOURCING Summary */}
                {effectiveCode === 'CV_SOURCING' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white p-4 border border-solid border-slate-200 space-y-2">
                      <p className="text-sm text-slate-800 leading-relaxed m-0">
                        Bạn muốn nhận <b>{watched.targetCandidateCount ?? '—'} CV</b>. Giá mỗi CV và tiền đặt cọc sẽ được chuyên viên HR Connect xác nhận với bạn trước khi đăng tin.
                      </p>
                      {watched.sourcingPricePerCv ? (
                        <div className="pt-2 border-0 border-t border-solid border-slate-100">
                          <span className="text-sm text-slate-900">
                            Bạn đề xuất: <b>{watched.sourcingPricePerCv.toLocaleString('vi-VN')}đ / CV</b>.
                          </span>
                          {watched.targetCandidateCount && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              Tổng chi phí đề xuất ước tính: <b>{(watched.targetCandidateCount * watched.sourcingPricePerCv).toLocaleString('vi-VN')}đ</b>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-0 border-t border-solid border-slate-100 text-xs text-slate-500 italic">
                          Bạn không đề xuất mức phí cụ thể. Chuyên viên HR Connect sẽ liên hệ tư vấn mức phí theo tiêu chuẩn ngành.
                        </div>
                      )}
                      {watched.termsNote?.trim() && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-solid border-slate-100">
                          <b>Ghi chú đề xuất:</b> {watched.termsNote}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* HEADHUNT_COD Summary */}
                {effectiveCode === 'HEADHUNT_COD' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white p-4 border border-solid border-slate-200 space-y-2">
                      <p className="text-sm text-slate-800 leading-relaxed m-0">
                        Phí tính khi ứng viên bắt đầu đi làm, theo lương trong offer. Chuyên viên HR Connect sẽ liên hệ thống nhất mức phí, bảo hành và hạn thanh toán trước khi đăng tin.
                      </p>
                      {watched.feeMultiplier != null || watched.warrantyDays != null || watched.paymentDueDays != null ? (
                        <div className="pt-2 border-0 border-t border-solid border-slate-100 space-y-1">
                          {watched.feeMultiplier != null && (
                            <div className="text-sm text-slate-900">
                              Bạn đề xuất: <b>{watched.feeMultiplier} tháng lương</b>
                              {watched.annualSalaryPercent ? ` (tương đương ${watched.annualSalaryPercent}% lương năm)` : ''}.
                            </div>
                          )}
                          {watched.warrantyDays != null && (
                            <div className="text-xs text-slate-700">
                              Thời gian bảo hành đề xuất: <b>{watched.warrantyDays} ngày</b>.
                            </div>
                          )}
                          {watched.paymentDueDays != null && (
                            <div className="text-xs text-slate-700">
                              Hạn thanh toán đề xuất: <b>{watched.paymentDueDays} ngày</b> sau khi nhận việc.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-0 border-t border-solid border-slate-100 text-xs text-slate-500 italic">
                          Bạn không đề xuất mức phí cụ thể. Mức phí và các điều khoản bảo hành sẽ được HR Connect thống nhất chi tiết qua email hoặc hợp đồng.
                        </div>
                      )}
                      {watched.termsNote?.trim() && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-solid border-slate-100">
                          <b>Ghi chú đề xuất:</b> {watched.termsNote}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Bottom Step Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Button size="large" onClick={() => setCurrentStep(2)}>
                  Quay lại: Nhu cầu & Chi phí
                </Button>
                <div className="flex items-center gap-2">
                  {draftButton()}
                  {submitButton()}
                </div>
              </div>
            </div>
          </Form>
        </div>

        {/* ── Side Rail (Sticky Progress & Preview) ────────────────────────── */}
        <aside aria-label="Tiến độ và xem trước" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* Progress & Checklist Card */}
          <div className="admin-surface p-5">
            <div className="flex items-center gap-4">
              <Progress
                type="circle"
                percent={percent}
                size={64}
                strokeColor="var(--console-accent)"
                format={(p) => <span className="text-sm font-bold text-slate-900">{p}%</span>}
              />
              <div>
                <div className="text-[15px] font-semibold text-slate-900">
                  {ready ? 'Sẵn sàng gửi duyệt' : 'Mức độ hoàn thiện'}
                </div>
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
                    onClick={() => goToStep(c.step, c.field)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-[13.5px] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
                  >
                    {c.done ? (
                      <CheckCircleFilled className="text-emerald-700" aria-label="Đã xong" />
                    ) : (
                      <ExclamationCircleOutlined className="text-amber-700" aria-label="Còn thiếu" />
                    )}
                    <span className={c.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}>
                      {c.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Candidate-Facing Preview */}
          <div className="admin-surface overflow-hidden">
            <div className="border-0 border-b border-solid border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Xem trước tin tuyển dụng
            </div>
            <div className="p-5">
              <div className="text-[16px] font-semibold leading-snug text-slate-900">
                {watched.title?.trim() || 'Tên vị trí tuyển dụng'}
              </div>
              <div className="mt-3 space-y-1.5 text-[13.5px] text-slate-700">
                <div className="flex items-center gap-2">
                  <WalletOutlined className="text-slate-400" aria-hidden />
                  <span className="font-medium text-[color:var(--console-accent-strong)]">{salaryText(watched)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvironmentOutlined className="text-slate-400" aria-hidden />
                  {watched.location?.trim() || 'Địa điểm làm việc'}
                </div>
                <div className="flex items-center gap-2">
                  <TeamOutlined className="text-slate-400" aria-hidden />
                  {watched.employmentType ? EMPLOYMENT_TYPE_LABEL[watched.employmentType] : 'Hình thức'} ·{' '}
                  {watched.quantity ?? 1} người
                </div>
              </div>
              {effectiveCode && (
                <span className="mt-3 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {SERVICE_TYPE_LABEL[effectiveCode]?.label}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Save Actions */}
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
