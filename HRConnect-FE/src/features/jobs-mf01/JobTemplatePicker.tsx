/**
 * @file JobTemplatePicker.tsx
 * @description MF-01 F1 & F2: Job Description Template Library for Client Company.
 * Placed at the top of Step 2 (Job Description) in JobFormPage.
 * Allows Clients to search, preview, and apply predefined JD templates.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Divider,
  Drawer,
  Empty,
  Input,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { JobTemplate, JobTemplateIndustry } from '@/types/api/jobs';
import {
  EMPLOYMENT_TYPE_LABEL,
  formatExperience,
  formatTemplateCategory,
  formatTemplateIndustry,
  formatTemplateLevel,
} from './jobDisplay';
import { useJobTemplate, useJobTemplates } from './useJobQueries';
import { JobTemplatePreviewDrawer } from './JobTemplatePreviewDrawer';

const { Text, Paragraph, Title } = Typography;

export {
  extractTemplateNonSkillRequirements,
  extractTemplateSkills,
  hasStep2Content,
  mergeSkillsCaseInsensitive,
} from './jobTemplateUtils';
import {
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
  /** Callback to populate form fields when "Dùng mẫu này" is triggered. */
  onApplyTemplate: (template: JobTemplate, mergedSkills: string[]) => void;
  /** Initial collapse state: default open if new job without content, collapsed otherwise. */
  defaultOpen?: boolean;
}

export const JobTemplatePicker: React.FC<JobTemplatePickerProps> = ({
  editable = true,
  hasStep2Content,
  currentSkills = [],
  currentTemplateId,
  onApplyTemplate,
  defaultOpen = true,
}) => {
  const { message, modal } = AntApp.useApp();

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultOpen);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<JobTemplateIndustry | undefined>(undefined);

  // Preview Drawer state
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Debounce search input: 300ms, max 100 characters
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim().slice(0, 100);
      setDebouncedKeyword(trimmed);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query templates list
  const templatesQuery = useJobTemplates(debouncedKeyword, selectedIndustry, isExpanded);

  // Query selected template for preview
  const templateDetailQuery = useJobTemplate(previewTemplateId ?? undefined, isDrawerOpen);

  // Handle template not found / deactivated during preview
  useEffect(() => {
    if (isDrawerOpen && templateDetailQuery.isError) {
      message.error('Mẫu này không còn được sử dụng. Vui lòng chọn mẫu khác.');
      setIsDrawerOpen(false);
      setPreviewTemplateId(null);
      templatesQuery.refetch();
    }
  }, [isDrawerOpen, templateDetailQuery.isError, message, templatesQuery]);

  if (!editable) {
    return null;
  }

  const handleOpenPreview = (id: string) => {
    setPreviewTemplateId(id);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setPreviewTemplateId(null);
  };

  const applyTemplateToForm = (template: JobTemplate) => {
    const templateSkills = (template.requirements ?? [])
      .filter((r) => (r.category || '').toUpperCase() === 'SKILL')
      .map((r) => r.content.trim())
      .filter(Boolean);

    const mergedSkills = mergeSkillsCaseInsensitive(currentSkills, templateSkills);

    onApplyTemplate(template, mergedSkills);
    message.success(`Đã điền từ mẫu "${template.name}". Bạn có thể chỉnh sửa trước khi gửi duyệt.`);
    handleCloseDrawer();
  };

  const handleUseTemplate = () => {
    const template = templateDetailQuery.data;
    if (!template) return;

    if (hasStep2Content()) {
      modal.confirm({
        title: 'Thay nội dung hiện tại bằng mẫu?',
        icon: <ExclamationCircleOutlined className="text-amber-500" />,
        content: 'Thay nội dung hiện tại bằng mẫu? Các ô lương, địa điểm, số lượng và phí giữ nguyên.',
        okText: 'Thay bằng mẫu',
        cancelText: 'Hủy',
        okButtonProps: { className: 'client-cta' },
        onOk: () => {
          applyTemplateToForm(template);
        },
      });
    } else {
      applyTemplateToForm(template);
    }
  };

  const templatesList = templatesQuery.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 p-5 shadow-sm transition-all">
      {/* Header / Toggle Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <FileTextOutlined className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-base font-semibold text-slate-900">Bắt đầu nhanh từ mẫu JD</h2>
              <Tag color="blue" className="rounded-full px-2 text-[11px] font-medium border-0 bg-indigo-100/70 text-indigo-700">
                Thư viện chuẩn
              </Tag>
              {currentTemplateId && (
                <Tag color="cyan" className="rounded-full px-2 text-[11px] font-medium border-0">
                  Đã chọn mẫu
                </Tag>
              )}
            </div>
            <p className="m-0 text-xs text-slate-500">
              Chọn mẫu có sẵn để điền nhanh mô tả, quyền lợi, yêu cầu và kỹ năng. Lương và phí giữ nguyên.
            </p>
          </div>
        </div>

        <Button
          type="text"
          onClick={() => setIsExpanded((prev) => !prev)}
          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
          className="text-slate-600 hover:text-indigo-600 font-medium"
        >
          {isExpanded ? 'Thu gọn' : 'Mở rộng mẫu JD'}
        </Button>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="mt-4 space-y-4 pt-3 border-t border-slate-100">
          {/* Search bar & Industry filters */}
          <div className="space-y-3">
            <Input
              size="large"
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm mẫu: .NET, React, Marketing, Kế toán, Chuyên viên..."
              allowClear
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
              className="rounded-xl border-slate-200 shadow-sm hover:border-indigo-400 focus:border-indigo-500"
            />

            {/* Industry Filter Pills */}
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
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    {ind.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards List / Loading / Empty / Error */}
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
              message="Không thể kết nối đến thư viện mẫu JD"
              description="Hệ thống gặp sự cố tạm thời khi tải mẫu. Bạn vẫn có thể tiếp tục tự nhập nội dung JD ở bên dưới."
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
                description={
                  <span className="text-sm text-slate-500">
                    Không tìm thấy mẫu cho &quot;
                    <strong className="text-slate-700">{debouncedKeyword || selectedIndustry || ''}</strong>
                    &quot;. Bạn vẫn có thể tự nhập JD bên dưới.
                  </span>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {templatesList.map((tpl) => (
                <div
                  key={tpl.templateId}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem trước mẫu ${tpl.name}`}
                  onClick={() => handleOpenPreview(tpl.templateId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenPreview(tpl.templateId);
                    }
                  }}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
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
                      {tpl.summary || 'Mẫu chuẩn được cấu hình với đầy đủ tiêu chí yêu cầu và quyền lợi hấp dẫn.'}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{tpl.requirementCount} yêu cầu</span>
                      <span>•</span>
                      <span>{tpl.usageCount} lượt dùng</span>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      className="p-0 text-xs text-indigo-600 group-hover:underline"
                    >
                      Xem trước
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer note */}
          <div className="text-center pt-1 text-xs text-slate-400">
            Không thấy mẫu phù hợp? Bạn vẫn có thể tự nhập nội dung vào form bên dưới.
          </div>
        </div>
      )}

      {/* ── F2: Preview Drawer ────────────────────────────────────────────── */}
      <JobTemplatePreviewDrawer
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        templateId={previewTemplateId}
        showClientNotice
        footer={
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <Button onClick={handleCloseDrawer}>Đóng (Esc)</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleUseTemplate}
              disabled={!templateDetailQuery.data}
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
