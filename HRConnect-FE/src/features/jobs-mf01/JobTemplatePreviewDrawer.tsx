/**
 * @file JobTemplatePreviewDrawer.tsx
 * @description Reusable drawer for previewing Job Description Templates (MF-01 F2 & F3).
 * Shared by Client JobTemplatePicker (F2) and Internal HR / Admin JobTemplatesAdminPage (F3).
 */
import React from 'react';
import { Alert, Button, Divider, Drawer, Skeleton, Tag, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { JobTemplate } from '@/types/api/jobs';
import {
  EMPLOYMENT_TYPE_LABEL,
  formatExperience,
  formatMultilineText,
  formatTemplateCategory,
  formatTemplateIndustry,
  formatTemplateLevel,
} from './jobDisplay';
import { useJobTemplate } from './useJobQueries';

const { Text, Paragraph } = Typography;

export interface JobTemplatePreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Pass templateId to fetch via API */
  templateId?: string | null;
  /** Or directly pass template data (useful for previewing form drafts) */
  templateData?: Partial<JobTemplate> | null;
  /** Optional custom footer CTA (e.g. "Dùng mẫu này" for Client) */
  footer?: React.ReactNode;
  /** Optional notice message at the bottom */
  showClientNotice?: boolean;
  /** True for a past job or an Excel JD: salary, location and quantity are copied as well. */
  copiesTerms?: boolean;
}

export const JobTemplatePreviewDrawer: React.FC<JobTemplatePreviewDrawerProps> = ({
  open,
  onClose,
  templateId,
  templateData,
  footer,
  showClientNotice = false,
  copiesTerms = false,
}) => {
  const query = useJobTemplate(templateId ?? undefined, Boolean(open && templateId && !templateData));
  const isLoading = Boolean(templateId && !templateData && query.isLoading);
  const template: Partial<JobTemplate> | undefined = templateData || query.data;

  const requirements = template?.requirements ?? [];
  const nonSkillRequirements = requirements.filter((r) => (r.category || '').toUpperCase() !== 'SKILL');
  const skillRequirements = requirements.filter((r) => (r.category || '').toUpperCase() === 'SKILL');

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-sky-600" />
          <span>Xem trước mẫu tuyển dụng</span>
        </div>
      }
      placement="right"
      width={620}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={footer}
    >
      {isLoading ? (
        <div className="space-y-4 p-2">
          <Skeleton active paragraph={{ rows: 4 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ) : template ? (
        <div className="space-y-6 text-sm text-slate-700">
          {/* Meta summary card */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color="blue">{formatTemplateIndustry(template.industry)}</Tag>
              {template.level && <Tag color="purple">{formatTemplateLevel(template.level)}</Tag>}
              {template.employmentType && (
                <Tag color="default">
                  {EMPLOYMENT_TYPE_LABEL[template.employmentType] || template.employmentType}
                </Tag>
              )}
            </div>
            <div className="text-xs text-slate-500">
              Kinh nghiệm yêu cầu:{' '}
              <strong className="text-slate-800">
                {formatExperience(
                  template.minExperienceYears ?? null,
                  template.maxExperienceYears ?? null
                )}
              </strong>
            </div>
            {template.summary && <p className="m-0 text-xs italic text-slate-600">{template.summary}</p>}
          </div>

          {/* Position Title */}
          <div>
            <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Tên vị trí tuyển dụng</h4>
            <p className="mt-1 text-base font-semibold text-slate-900">{template.title || template.name || '—'}</p>
          </div>

          <Divider className="my-2" />

          {/* Description */}
          <div>
            <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Mô tả công việc</h4>
            <div className="mt-2 whitespace-pre-line rounded-lg bg-slate-50/50 p-3 leading-relaxed text-slate-800">
              {template.description ? formatMultilineText(template.description) : <Text type="secondary">Chưa có mô tả</Text>}
            </div>
          </div>

          {/* Benefits */}
          {template.benefits && (
            <div>
              <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Quyền lợi ứng viên</h4>
              <div className="mt-2 whitespace-pre-line rounded-lg bg-slate-50/50 p-3 leading-relaxed text-slate-800">
                {formatMultilineText(template.benefits)}
              </div>
            </div>
          )}

          <Divider className="my-2" />

          {/* Requirements (Must have / Should have) */}
          <div>
            <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Yêu cầu ứng viên</h4>
            {nonSkillRequirements.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400 italic">Chưa có yêu cầu nào</p>
            ) : (
              <div className="mt-3 space-y-2">
                {nonSkillRequirements.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs shadow-2xs"
                  >
                    <Tag
                      color={r.requirementType === 'MUST_HAVE' ? 'red' : 'orange'}
                      className="m-0 flex-shrink-0 text-[10px]"
                    >
                      {r.requirementType === 'MUST_HAVE' ? 'Bắt buộc' : 'Ưu tiên'}
                    </Tag>
                    <div className="flex-1">
                      <span className="whitespace-pre-line break-words text-slate-800">{formatMultilineText(r.content)}</span>
                      {r.category && (
                        <span className="ml-2 text-[11px] text-slate-400">
                          ({formatTemplateCategory(r.category)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skills */}
          {skillRequirements.length > 0 && (
            <div>
              <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Kỹ năng chính ({skillRequirements.length})
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skillRequirements.map((s, idx) => (
                  <Tag key={idx} color="geekblue" className="rounded-md px-2.5 py-0.5 text-xs">
                    {s.content}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {showClientNotice && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-900">
              💡 <strong>Lưu ý:</strong> Khi chọn &quot;Dùng mẫu này&quot;, các trường mô tả, quyền lợi, yêu cầu và kỹ năng sẽ được điền vào form. {copiesTerms ? (<>Lương, địa điểm và số lượng cũng được điền theo nội dung này; điều khoản phí ở Bước 3 được <strong>giữ nguyên</strong>.</>) : (<>Các thông tin về lương, địa điểm, số lượng và điều khoản phí ở Bước 3 được <strong>giữ nguyên</strong>.</>)} Bạn hoàn toàn có thể chỉnh sửa lại nội dung sau khi điền.
            </div>
          )}
        </div>
      ) : (
        <Alert type="warning" message="Không tìm thấy mẫu tuyển dụng hoặc mẫu đã bị xóa." showIcon />
      )}
    </Drawer>
  );
};
