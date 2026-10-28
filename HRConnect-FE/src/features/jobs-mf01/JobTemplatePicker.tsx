/**
 * @file JobTemplatePicker.tsx
 * @description MF-01 F1 & F2: Job Description Template Library for Client Company.
 * Placed at the top of Step 2 (Job Description) in JobFormPage.
 * Allows Clients to search, preview, and apply predefined JD templates or reuse past jobs.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Empty,
  Input,
  Pagination,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  AppstoreOutlined,
  CheckOutlined,
  DownOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { Job, JobTemplate, JobTemplateIndustry } from '@/types/api/jobs';
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_STATUS,
  formatTemplateIndustry,
  formatTemplateLevel,
} from './jobDisplay';
import { useJobTemplate, useJobTemplates, useMyJobs } from './useJobQueries';
import { jobsApi } from '@/services/api/jobsApi';
import { JobTemplatePreviewDrawer } from './JobTemplatePreviewDrawer';
import { mergeSkillsCaseInsensitive } from './jobTemplateUtils';
import { JD_TEMPLATE_URL, readJdExcel } from './jdExcelImport';

export {
  extractTemplateNonSkillRequirements,
  extractTemplateSkills,
  hasStep2Content,
  mergeSkillsCaseInsensitive,
} from './jobTemplateUtils';

const INDUSTRY_FILTERS: { key?: JobTemplateIndustry; label: string }[] = [
  { key: undefined, label: 'Tất cả' },
  { key: 'IT', label: 'Công nghệ thông tin' },
  { key: 'MARKETING', label: 'Marketing' },
  { key: 'SALES', label: 'Kinh doanh' },
  { key: 'ACCOUNTING', label: 'Kế toán' },
  { key: 'HR', label: 'Nhân sự' },
  { key: 'ADMIN', label: 'Hành chính' },
];

export interface JobTemplatePickerProps {
  /** If false, picker is hidden (e.g. non-editable job status). */
  editable?: boolean;
  /** Whether Step 2 currently has content, used for overwrite confirmation. */
  hasStep2Content: () => boolean;
  /** Current skills tag array in the form. */
  currentSkills?: string[];
  /** Currently selected or active template ID if any. */
  currentTemplateId?: string | null;
  /** Job ID currently being edited (to exclude from past jobs list). */
  currentJobId?: string;
  /** Callback to populate form fields when "Dùng mẫu này" is triggered. */
  /** sourceJob is set when the Client reuses one of their own jobs: its salary, location and quantity are copied too. */
  onApplyTemplate: (template: JobTemplate, mergedSkills: string[], sourceJob?: Partial<Job>) => void;
  /** Initial collapse state: default open if new job without content, collapsed otherwise. */
  defaultOpen?: boolean;
}

export const JobTemplatePicker: React.FC<JobTemplatePickerProps> = ({
  editable = true,
  hasStep2Content,
  currentSkills = [],
  currentTemplateId,
  currentJobId,
  onApplyTemplate,
  defaultOpen = true,
}) => {
  const { message, modal } = AntApp.useApp();

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultOpen);
  const [sourceType, setSourceType] = useState<'SYSTEM' | 'MY_JOBS'>('SYSTEM');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<JobTemplateIndustry | undefined>(undefined);

  // Pagination states
  const [systemPage, setSystemPage] = useState<number>(1);
  const [systemPageSize, setSystemPageSize] = useState<number>(6);
  const [myJobsPage, setMyJobsPage] = useState<number>(1);
  const [myJobsPageSize, setMyJobsPageSize] = useState<number>(6);

  // Reset pagination on filter change
  useEffect(() => {
    setSystemPage(1);
  }, [debouncedKeyword, selectedIndustry, sourceType]);

  useEffect(() => {
    setMyJobsPage(1);
  }, [debouncedKeyword, sourceType]);

  // Preview Drawer state
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewTemplateData, setPreviewTemplateData] = useState<Partial<JobTemplate> | null>(null);
  const [previewSourceJob, setPreviewSourceJob] = useState<Partial<Job> | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Debounce search input: 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(searchInput.trim().slice(0, 100));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query system templates
  const templatesQuery = useJobTemplates(
    debouncedKeyword,
    selectedIndustry,
    isExpanded && sourceType === 'SYSTEM'
  );

  // Query client's own past jobs
  const myJobsQuery = useMyJobs();

  // Query selected template for preview (system template)
  const templateDetailQuery = useJobTemplate(
    previewTemplateId ?? undefined,
    Boolean(isDrawerOpen && previewTemplateId && !previewTemplateData)
  );

  // Filter client's past jobs
  const clientJobsList = useMemo(() => {
    const all = myJobsQuery.data ?? [];
    return all.filter((j) => {
      if (currentJobId && j.jobId === currentJobId) return false;
      if (!debouncedKeyword) return true;
      return j.title.toLowerCase().includes(debouncedKeyword.toLowerCase());
    });
  }, [myJobsQuery.data, currentJobId, debouncedKeyword]);

  // Handle template not found / deactivated during preview
  useEffect(() => {
    if (isDrawerOpen && previewTemplateId && templateDetailQuery.isError) {
      message.error('Mẫu này không còn khả dụng.');
      setIsDrawerOpen(false);
      setPreviewTemplateId(null);
      templatesQuery.refetch();
    }
  }, [isDrawerOpen, previewTemplateId, templateDetailQuery.isError, message, templatesQuery]);

  if (!editable) {
    return null;
  }

  const scrollToTitleField = () => {
    setTimeout(() => {
      const el = document.getElementById('form-title-item');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = el.querySelector('input');
        input?.focus();
      }
    }, 200);
  };

  const applyTemplateToForm = (template: JobTemplate, sourceJob?: Partial<Job>) => {
    const templateSkills = (template.requirements ?? [])
      .filter((r) => (r.category || '').toUpperCase() === 'SKILL')
      .map((r) => r.content.trim())
      .filter(Boolean);

    const mergedSkills = mergeSkillsCaseInsensitive(currentSkills, templateSkills);

    onApplyTemplate(template, mergedSkills, sourceJob);
    message.success(sourceJob ? `Đã điền nội dung "${template.name}".` : `Đã áp dụng mẫu "${template.name}".`);
    handleCloseDrawer();
    scrollToTitleField();
  };

  const confirmAndApply = (template: JobTemplate, sourceJob?: Partial<Job>) => {
    if (hasStep2Content()) {
      modal.confirm({
        title: 'Thay nội dung hiện tại bằng mẫu này?',
        icon: <ExclamationCircleOutlined className="text-amber-500" />,
        content: sourceJob
          ? 'Nội dung, yêu cầu, kỹ năng, lương, số lượng và địa điểm sẽ được điền theo tin đã đăng.'
          : 'Nội dung mô tả, quyền lợi, yêu cầu và kỹ năng sẽ được điền theo mẫu. Lương, số lượng và địa điểm giữ nguyên.',
        okText: 'Áp dụng',
        cancelText: 'Hủy',
        okButtonProps: { className: 'client-cta' },
        onOk: () => {
          applyTemplateToForm(template, sourceJob);
        },
      });
    } else {
      applyTemplateToForm(template, sourceJob);
    }
  };

  const convertJobToTemplate = (job: Job): JobTemplate => {
    return {
      templateId: job.jobId,
      code: job.jobId,
      name: job.title,
      title: job.title,
      industry: 'IT',
      level: null,
      keywords: null,
      summary: null,
      employmentType: job.employmentType,
      minExperienceYears: job.minExperienceYears,
      maxExperienceYears: job.maxExperienceYears,
      description: job.description || '',
      benefits: job.benefits,
      requirements: (job.requirements ?? []).map((r) => ({
        requirementType: r.requirementType,
        content: r.content,
        category: r.category ?? null,
      })),
      isActive: true,
      usageCount: 1,
      updatedAt: job.updatedAt || new Date().toISOString(),
      concurrencyToken: null,
    };
  };

  const handleApplySystemTemplate = async (tplSummary: { templateId: string }) => {
    try {
      const full = await jobsApi.getTemplate(tplSummary.templateId);
      confirmAndApply(full);
    } catch {
      message.error('Không tải được chi tiết mẫu này.');
    }
  };

  const handleApplyClientJob = async (job: Job) => {
    try {
      const fullJob = await jobsApi.getById(job.jobId);
      confirmAndApply(convertJobToTemplate(fullJob), fullJob);
    } catch {
      confirmAndApply(convertJobToTemplate(job), job);
    }
  };

  const handlePreviewClientJob = async (job: Job) => {
    try {
      const fullJob = await jobsApi.getById(job.jobId);
      setPreviewTemplateData(convertJobToTemplate(fullJob));
      setPreviewSourceJob(fullJob);
    } catch {
      setPreviewTemplateData(convertJobToTemplate(job));
      setPreviewSourceJob(job);
    }
    setPreviewTemplateId(null);
    setIsDrawerOpen(true);
  };

  /** Read the Excel JD in the browser, list problems by row, then open the usual preview. */
  const handleImportExcel = async (file: File) => {
    setImporting(true);
    try {
      const result = await readJdExcel(file);
      if (!result.template) {
        modal.error({
          title: 'Chưa nhập được file JD',
          content: (
            <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-[13px]">
              {result.errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}
              {result.errors.length > 12 && <li>… và {result.errors.length - 12} lỗi khác.</li>}
            </ul>
          ),
        });
        return;
      }
      result.warnings.forEach((w) => message.warning(w));
      setPreviewTemplateId(null);
      setPreviewTemplateData(result.template);
      setPreviewSourceJob(result.terms);
      setIsDrawerOpen(true);
    } finally {
      setImporting(false);
    }
  };

  const handleOpenSystemPreview = (id: string) => {
    setPreviewTemplateId(id);
    setPreviewTemplateData(null);
    setPreviewSourceJob(null);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setPreviewTemplateId(null);
    setPreviewTemplateData(null);
  };

  const handleUseFromDrawer = () => {
    if (previewTemplateData) {
      confirmAndApply(previewTemplateData as JobTemplate, previewSourceJob ?? undefined);
      return;
    }
    const template = templateDetailQuery.data;
    if (template) {
      confirmAndApply(template);
    }
  };

  const templatesList = templatesQuery.data?.items ?? [];

  const paginatedTemplates = useMemo(() => {
    const start = (systemPage - 1) * systemPageSize;
    return templatesList.slice(start, start + systemPageSize);
  }, [templatesList, systemPage, systemPageSize]);

  const paginatedClientJobs = useMemo(() => {
    const start = (myJobsPage - 1) * myJobsPageSize;
    return clientJobsList.slice(start, start + myJobsPageSize);
  }, [clientJobsList, myJobsPage, myJobsPageSize]);

  return (
    <section className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 p-5 shadow-sm transition-all">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <FileTextOutlined className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-base font-semibold text-slate-900">Mẫu tuyển dụng</h2>
              <Tag color="blue" className="rounded-full px-2 text-[11px] font-medium border-0 bg-indigo-100/70 text-indigo-700">
                Thư viện mẫu
              </Tag>
              {currentTemplateId && (
                <Tag color="cyan" className="rounded-full px-2 text-[11px] font-medium border-0">
                  Đã chọn mẫu
                </Tag>
              )}
            </div>
            <p className="m-0 text-xs text-slate-500">
              Chọn mẫu có sẵn, dùng lại tin đã đăng hoặc nhập JD từ file Excel để điền nhanh nội dung.
            </p>
          </div>
        </div>

        <Space size={4} wrap>
          <Button type="text" icon={<DownloadOutlined />} href={JD_TEMPLATE_URL} download className="text-slate-600">
            Tải file mẫu Excel
          </Button>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            maxCount={1}
            beforeUpload={(file) => {
              void handleImportExcel(file);
              return Upload.LIST_IGNORE;
            }}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Nhập từ Excel
            </Button>
          </Upload>
        <Button
          type="text"
          onClick={() => setIsExpanded((prev) => !prev)}
          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
          className="text-slate-600 hover:text-indigo-600 font-medium"
        >
          {isExpanded ? 'Thu gọn' : 'Chọn mẫu'}
        </Button>
        </Space>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="mt-4 space-y-4 pt-3 border-t border-slate-100">
          {/* Source Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={sourceType}
              onChange={(val) => {
                setSourceType(val as 'SYSTEM' | 'MY_JOBS');
                setSearchInput('');
              }}
              options={[
                {
                  label: 'Mẫu hệ thống',
                  value: 'SYSTEM',
                  icon: <AppstoreOutlined />,
                },
                {
                  label: `Tin đã đăng của bạn (${clientJobsList.length})`,
                  value: 'MY_JOBS',
                  icon: <HistoryOutlined />,
                },
              ]}
              className="bg-slate-100/90 font-medium"
            />

            <div className="w-full sm:w-72">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder={sourceType === 'SYSTEM' ? 'Tìm mẫu: .NET, Marketing...' : 'Tìm theo tên tin...'}
                allowClear
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={100}
                className="rounded-lg border-slate-200 shadow-sm"
              />
            </div>
          </div>

          {/* Industry Pills (only for SYSTEM templates) */}
          {sourceType === 'SYSTEM' && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bộ lọc ngành nghề">
              <span className="text-xs text-slate-400 mr-1 font-medium">Ngành:</span>
              {INDUSTRY_FILTERS.map((ind) => {
                const isActive = selectedIndustry === ind.key;
                return (
                  <button
                    key={ind.key ?? 'ALL'}
                    type="button"
                    onClick={() => setSelectedIndustry(isActive && ind.key ? undefined : ind.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    {ind.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Tab 1: System Templates ─────────────────────────────────────── */}
          {sourceType === 'SYSTEM' && (
            <>
              {templatesQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <Skeleton active paragraph={{ rows: 2 }} />
                    </div>
                  ))}
                </div>
              ) : templatesQuery.isError ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Không tải được thư viện mẫu"
                  description="Bạn vẫn có thể tự nhập thông tin ở bên dưới."
                  action={
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => templatesQuery.refetch()}>
                      Thử lại
                    </Button>
                  }
                  className="rounded-xl"
                />
              ) : templatesList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span className="text-sm text-slate-500">Không tìm thấy mẫu phù hợp.</span>}
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {paginatedTemplates.map((tpl) => (
                      <div
                        key={tpl.templateId}
                        className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="m-0 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                              {tpl.name}
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Tag color="blue" className="m-0 text-[11px] border-0 bg-blue-50 text-blue-700">
                              {formatTemplateIndustry(tpl.industry)}
                            </Tag>
                            {tpl.level && (
                              <Tag color="purple" className="m-0 text-[11px] border-0 bg-purple-50 text-purple-700">
                                {formatTemplateLevel(tpl.level)}
                              </Tag>
                            )}
                          </div>

                          <p className="m-0 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {tpl.summary || 'Mẫu chuẩn với đầy đủ tiêu chí yêu cầu và quyền lợi hấp dẫn.'}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>{tpl.requirementCount} yêu cầu</span>
                            <span>•</span>
                            <span>{tpl.usageCount} lượt dùng</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleOpenSystemPreview(tpl.templateId)}
                              className="p-0 text-xs text-slate-500 hover:text-indigo-600"
                            >
                              Xem trước
                            </Button>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => handleApplySystemTemplate(tpl)}
                              className="client-cta text-xs px-2.5 h-6 rounded-md"
                            >
                              Áp dụng
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {templatesList.length > 0 && (
                    <div className="flex justify-center pt-2">
                      <Pagination
                        current={systemPage}
                        pageSize={systemPageSize}
                        total={templatesList.length}
                        onChange={(p, ps) => {
                          setSystemPage(p);
                          setSystemPageSize(ps);
                        }}
                        pageSizeOptions={['4', '6', '10']}
                        showSizeChanger={templatesList.length > 4}
                        size="small"
                        showTotal={(total, range) => `${range[0]}-${range[1]} / ${total} mẫu`}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Tab 2: Client's Own Past Jobs ──────────────────────────────── */}
          {sourceType === 'MY_JOBS' && (
            <>
              {myJobsQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <Skeleton active paragraph={{ rows: 2 }} />
                    </div>
                  ))}
                </div>
              ) : myJobsQuery.isError ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Không tải được danh sách tin của bạn"
                  description="Vui lòng thử lại sau hoặc nhập thông tin trực tiếp vào form."
                  className="rounded-xl"
                />
              ) : clientJobsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span className="text-sm text-slate-500">
                        {debouncedKeyword ? 'Không tìm thấy tin phù hợp.' : 'Bạn chưa có tin tuyển dụng nào trước đây.'}
                      </span>
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {paginatedClientJobs.map((job) => {
                      const statusCfg = JOB_STATUS[job.status] || { label: job.status, color: 'default' };
                      return (
                        <div
                          key={job.jobId}
                          className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="m-0 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {job.title}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <Tag color={statusCfg.color} className="m-0 text-[11px] border-0">
                                {statusCfg.label}
                              </Tag>
                              {job.employmentType && (
                                <Tag color="blue" className="m-0 text-[11px] border-0 bg-blue-50 text-blue-700">
                                  {EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType}
                                </Tag>
                              )}
                            </div>

                            <p className="m-0 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {job.description ? job.description.replace(/<[^>]*>?/gm, '') : 'Không có phần mô tả ngắn.'}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                            <div>
                              <span>Tuyển {job.quantity || 1} người</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="link"
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => handlePreviewClientJob(job)}
                                className="p-0 text-xs text-slate-500 hover:text-indigo-600"
                              >
                                Xem trước
                              </Button>
                              <Button
                                type="primary"
                                size="small"
                                onClick={() => handleApplyClientJob(job)}
                                className="client-cta text-xs px-2.5 h-6 rounded-md"
                              >
                                Dùng tin này
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clientJobsList.length > 0 && (
                    <div className="flex justify-center pt-2">
                      <Pagination
                        current={myJobsPage}
                        pageSize={myJobsPageSize}
                        total={clientJobsList.length}
                        onChange={(p, ps) => {
                          setMyJobsPage(p);
                          setMyJobsPageSize(ps);
                        }}
                        pageSizeOptions={['4', '6', '10']}
                        showSizeChanger={clientJobsList.length > 4}
                        size="small"
                        showTotal={(total, range) => `${range[0]}-${range[1]} / ${total} tin`}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Preview Drawer ─────────────────────────────────────────────────── */}
      <JobTemplatePreviewDrawer
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        templateId={previewTemplateId}
        templateData={previewTemplateData}
        showClientNotice
        copiesTerms={Boolean(previewSourceJob)}
        footer={
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <Button onClick={handleCloseDrawer}>Đóng (Esc)</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleUseFromDrawer}
              disabled={!previewTemplateData && !templateDetailQuery.data}
              className="client-cta px-6 font-semibold"
            >
              Dùng mẫu này
            </Button>
          </div>
        }
      />
    </section>
  );
};
