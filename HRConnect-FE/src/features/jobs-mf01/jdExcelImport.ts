/**
 * Import a job description from the HR Connect Excel template (public/templates/HRConnect_JD_Template.xlsx).
 * The file is read in the browser only: cell values are taken as plain data, formulas and macros never run,
 * and nothing is uploaded. The result feeds the same "apply template" flow as system templates.
 */
import type { CellValue, SheetData } from 'read-excel-file/browser';
import type { EmploymentType, Job, JobRequirementType, JobTemplate, JobTemplateRequirement } from '@/types/api/jobs';
import { EMPLOYMENT_TYPE_LABEL, REQUIREMENT_CATEGORY_OPTIONS } from './jobDisplay';

export const JD_TEMPLATE_URL = '/templates/HRConnect_JD_Template.xlsx';
export const JD_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const GENERAL_SHEET = 'Thông tin chung';
export const REQUIREMENT_SHEET = 'Yêu cầu';

/** Job terms that system templates never carry but a JD file may: salary, location, quantity. */
export type JdSourceTerms = Partial<
  Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryNegotiable' | 'salaryNote' | 'currencyCode' | 'location' | 'workingTime' | 'quantity'>
>;

export interface JdImportResult {
  template: JobTemplate | null;
  terms: JdSourceTerms;
  errors: string[];
  warnings: string[];
}

const FIELD = {
  title: 'Tên vị trí',
  employmentType: 'Hình thức',
  minExp: 'Kinh nghiệm từ (năm)',
  maxExp: 'Kinh nghiệm đến (năm)',
  quantity: 'Số lượng tuyển',
  location: 'Địa điểm',
  workingTime: 'Thời gian làm việc',
  salaryMin: 'Lương từ',
  salaryMax: 'Lương đến',
  currency: 'Tiền tệ',
  negotiable: 'Lương thỏa thuận',
  salaryNote: 'Ghi chú lương',
  description: 'Mô tả công việc',
  benefits: 'Quyền lợi',
  skills: 'Kỹ năng',
} as const;

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const text = (v: CellValue | null | undefined): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

const LEVELS: Record<string, JobRequirementType> = {
  'bắt buộc': 'MUST_HAVE',
  must_have: 'MUST_HAVE',
  'ưu tiên': 'SHOULD_HAVE',
  should_have: 'SHOULD_HAVE',
};

const CATEGORIES: Record<string, string> = Object.fromEntries(
  REQUIREMENT_CATEGORY_OPTIONS.flatMap((o) => [
    [norm(o.label), o.value],
    [norm(o.value), o.value],
  ])
);

const EMPLOYMENT: Record<string, EmploymentType> = Object.fromEntries(
  (Object.entries(EMPLOYMENT_TYPE_LABEL) as [EmploymentType, string][]).flatMap(([code, label]) => [
    [norm(label), code],
    [norm(code), code],
  ])
);

function pickSheet(sheets: { sheet: string; data: SheetData }[], name: string, index: number) {
  return sheets.find((s) => norm(s.sheet) === norm(name)) ?? sheets[index];
}

function toNumber(raw: CellValue | null | undefined, label: string, errors: string[], opts: { integer?: boolean } = {}) {
  const s = text(raw).replace(/[.,\s](?=\d{3}(\D|$))/g, '');
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || (opts.integer && !Number.isInteger(n))) {
    errors.push(`Sheet "${GENERAL_SHEET}", ô "${label}": "${text(raw)}" không phải số hợp lệ.`);
    return undefined;
  }
  return n;
}

/** Parse the sheets returned by read-excel-file into a template + job terms, with row-level messages. */
export function parseJdWorkbook(sheets: { sheet: string; data: SheetData }[]): JdImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const general = pickSheet(sheets, GENERAL_SHEET, 0);
  const reqSheet = pickSheet(sheets, REQUIREMENT_SHEET, 1);
  if (!general) {
    return { template: null, terms: {}, errors: [`Không tìm thấy sheet "${GENERAL_SHEET}". Hãy dùng file mẫu của HR Connect.`], warnings };
  }

  // "Thông tin chung": column A = field name, column B = value.
  const values = new Map<string, CellValue | null>();
  for (const row of general.data) {
    const key = norm(row[0]);
    if (key && !values.has(key)) values.set(key, row[1] ?? null);
  }
  const get = (label: string) => values.get(norm(label)) ?? null;

  const title = text(get(FIELD.title));
  const description = text(get(FIELD.description));
  if (!title) errors.push(`Sheet "${GENERAL_SHEET}": thiếu "${FIELD.title}".`);
  if (!description) errors.push(`Sheet "${GENERAL_SHEET}": thiếu "${FIELD.description}".`);

  let employmentType: EmploymentType | null = null;
  const empRaw = text(get(FIELD.employmentType));
  if (empRaw) {
    employmentType = EMPLOYMENT[norm(empRaw)] ?? null;
    if (!employmentType) {
      errors.push(`Sheet "${GENERAL_SHEET}", ô "${FIELD.employmentType}": "${empRaw}" không hợp lệ (chọn ${Object.values(EMPLOYMENT_TYPE_LABEL).join(', ')}).`);
    }
  }

  const minExp = toNumber(get(FIELD.minExp), FIELD.minExp, errors, { integer: true });
  const maxExp = toNumber(get(FIELD.maxExp), FIELD.maxExp, errors, { integer: true });
  if (minExp !== undefined && maxExp !== undefined && minExp > maxExp) {
    errors.push(`"${FIELD.minExp}" không được lớn hơn "${FIELD.maxExp}".`);
  }
  const quantity = toNumber(get(FIELD.quantity), FIELD.quantity, errors, { integer: true });
  if (quantity === 0) errors.push(`"${FIELD.quantity}" phải lớn hơn 0.`);
  const salaryMin = toNumber(get(FIELD.salaryMin), FIELD.salaryMin, errors);
  const salaryMax = toNumber(get(FIELD.salaryMax), FIELD.salaryMax, errors);
  if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
    errors.push(`"${FIELD.salaryMin}" không được lớn hơn "${FIELD.salaryMax}".`);
  }
  const negotiableRaw = norm(get(FIELD.negotiable));
  const salaryNegotiable = ['có', 'yes', 'true', 'x', '1'].includes(negotiableRaw)
    ? true
    : ['không', 'no', 'false', '0', ''].includes(negotiableRaw)
      ? false
      : undefined;
  if (salaryNegotiable === undefined) errors.push(`Ô "${FIELD.negotiable}" chỉ nhận "Có" hoặc "Không".`);
  const currency = text(get(FIELD.currency)).toUpperCase();

  // "Yêu cầu": header row, then Mức độ | Nội dung | Nhóm.
  const requirements: JobTemplateRequirement[] = [];
  const rows = reqSheet?.data ?? [];
  rows.forEach((row, i) => {
    if (i === 0) return;
    const level = text(row[0]);
    const content = text(row[1]);
    const group = text(row[2]);
    if (!level && !content && !group) return;
    const line = `Sheet "${REQUIREMENT_SHEET}", dòng ${i + 1}`;
    const requirementType = LEVELS[norm(level)];
    if (!requirementType) errors.push(`${line}: "Mức độ" phải là "Bắt buộc" hoặc "Ưu tiên".`);
    if (!content) errors.push(`${line}: thiếu "Nội dung".`);
    else if (content.length > 1000) errors.push(`${line}: "Nội dung" quá 1000 ký tự.`);
    const category = group ? CATEGORIES[norm(group)] : 'OTHER';
    if (!category) errors.push(`${line}: "Nhóm" không hợp lệ (${REQUIREMENT_CATEGORY_OPTIONS.map((o) => o.label).join(', ')}).`);
    if (requirementType && content && category) requirements.push({ requirementType, content, category });
  });

  const skills = text(get(FIELD.skills))
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  skills.forEach((s) => requirements.push({ requirementType: 'SHOULD_HAVE', content: s, category: 'SKILL' }));

  const nonSkill = requirements.filter((r) => r.category !== 'SKILL');
  if (nonSkill.length === 0) errors.push(`Sheet "${REQUIREMENT_SHEET}": cần ít nhất 1 yêu cầu.`);
  else if (!nonSkill.some((r) => r.requirementType === 'MUST_HAVE')) {
    warnings.push('Chưa có yêu cầu "Bắt buộc" nào; tin cần ít nhất 1 yêu cầu bắt buộc khi gửi duyệt.');
  }

  if (errors.length) return { template: null, terms: {}, errors, warnings };

  const template: JobTemplate = {
    templateId: '',
    code: '',
    name: title,
    title,
    industry: '',
    level: null,
    keywords: null,
    summary: null,
    description,
    benefits: text(get(FIELD.benefits)) || null,
    employmentType,
    minExperienceYears: minExp ?? null,
    maxExperienceYears: maxExp ?? null,
    requirements,
    isActive: true,
    usageCount: 0,
    updatedAt: new Date().toISOString(),
    concurrencyToken: null,
  };
  const terms: JdSourceTerms = {
    ...(salaryMin !== undefined && { salaryMin }),
    ...(salaryMax !== undefined && { salaryMax }),
    ...(salaryNegotiable !== undefined && { salaryNegotiable }),
    ...(text(get(FIELD.salaryNote)) && { salaryNote: text(get(FIELD.salaryNote)) }),
    ...(currency && { currencyCode: currency }),
    ...(text(get(FIELD.location)) && { location: text(get(FIELD.location)) }),
    ...(text(get(FIELD.workingTime)) && { workingTime: text(get(FIELD.workingTime)) }),
    ...(quantity !== undefined && { quantity }),
  };
  return { template, terms, errors, warnings };
}

/** Check type/size, read every sheet and parse. */
export async function readJdExcel(file: File): Promise<JdImportResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    return { template: null, terms: {}, errors: ['Chỉ nhận file Excel .xlsx (dùng file mẫu của HR Connect).'], warnings: [] };
  }
  if (file.size > JD_MAX_FILE_BYTES) {
    return { template: null, terms: {}, errors: ['File quá 2 MB.'], warnings: [] };
  }
  try {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    return parseJdWorkbook(sheets);
  } catch {
    return { template: null, terms: {}, errors: ['Không đọc được file. Hãy kiểm tra file .xlsx còn mở được bằng Excel.'], warnings: [] };
  }
}
