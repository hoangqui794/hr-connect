/**
 * @file JobDetailPanel.tsx
 * @description Read-only view of one JobDto, shared by the Client list, the HR review
 * queue and job discovery. Shows exactly what the backend stores — nothing invented.
 */
import React from 'react';
import { Descriptions, Empty, Tag, Timeline, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { Job, JobRequirement, JobSkill, JobStatus, JobStatusHistory } from '@/types/api/jobs';
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_STATUS,
  REASON_CODE_LABEL,
  SERVICE_TYPE_LABEL,
  VISIBILITY_LABEL,
  formatDate,
  formatDateTime,
  formatExperience,
  formatSalary,
} from './jobDisplay';

const { Paragraph, Text, Title } = Typography;

// Fixed colours (text on tinted bg ≥ 4.5:1) so the tag reads the same under every console theme.
const STATUS_TAG_CLASS: Record<Job['status'], string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  PENDING_REVIEW: 'border-sky-200 bg-sky-50 text-sky-800',
  PENDING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-800',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-600',
};

export const JobStatusTag: React.FC<{ status?: Job['status'] }> = ({ status }) => {
  const config = status ? JOB_STATUS[status] : undefined;
  const tagClass = status && STATUS_TAG_CLASS[status] ? STATUS_TAG_CLASS[status] : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <Tag className={`m-0 border border-solid font-medium ${tagClass}`}>
      {config?.label ?? status ?? '—'}
    </Tag>
  );
};

const RequirementList: React.FC<{ title: string; items?: JobRequirement[] | null; emptyText: string }> = ({
  title,
  items,
  emptyText,
}) => {
  const safeItems = (items || []) as JobRequirement[];
  return (
    <section aria-label={title}>
      <Text strong className="block mb-2">
        {title}
      </Text>
      {(safeItems?.length ?? 0) === 0 ? (
        <Text type="secondary">{emptyText}</Text>
      ) : (
        <ul className="m-0 pl-0 list-none space-y-1.5">
          {(safeItems || []).map((req, idx) => (
            <li key={req?.requirementId || idx} className="flex gap-2 items-start">
              <CheckCircleOutlined className="text-emerald-700 mt-1 shrink-0" aria-hidden />
              <span>
                {req?.content}
                {req?.category && <Text type="secondary"> · {req.category}</Text>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Multi-line backend text, rendered as plain paragraphs (never as HTML). */
const LongText: React.FC<{ value: string | string[] | null | undefined; emptyText: string }> = ({ value, emptyText }) => {
  if (!value) {
    return <Text type="secondary">{emptyText}</Text>;
  }
  if (Array.isArray(value)) {
    if ((value?.length ?? 0) === 0) return <Text type="secondary">{emptyText}</Text>;
    return (
      <ul className="m-0 pl-4 list-disc space-y-1">
        {(value || []).map((item, idx) => (
          <li key={idx}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }
  return <Paragraph className="whitespace-pre-line mb-0">{value}</Paragraph>;
};

interface JobDetailPanelProps {
  job?: Job | null;
  /** Status history is only useful to the owner and reviewers. */
  showHistory?: boolean;
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({ job, showHistory = false }) => {
  if (!job) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu tin tuyển dụng." />;
  }

  const rawRequirements = (job?.requirements || (job as any)?.jobRequirements || []) as JobRequirement[];
  const requirements = Array.isArray(rawRequirements) ? rawRequirements : [];
  const mustHave = (requirements || []).filter((r) => r?.requirementType === 'MUST_HAVE');
  const shouldHave = (requirements || []).filter((r) => r?.requirementType === 'SHOULD_HAVE');

  const rawSkills = (job?.skills || []) as JobSkill[];
  const skills = Array.isArray(rawSkills) ? rawSkills : [];

  const rawHistory = (job?.statusHistories || (job as any)?.statusHistory || []) as JobStatusHistory[];
  const statusHistories = Array.isArray(rawHistory) ? rawHistory : [];

  const service = job?.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode] : null;
  const visibilityConfig = job?.visibility ? VISIBILITY_LABEL[job.visibility] : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {job?.status && <JobStatusTag status={job.status} />}
          {service && <Tag className="m-0">{service.label}</Tag>}
          {visibilityConfig ? (
            <Tag className="m-0">{visibilityConfig.label}</Tag>
          ) : job?.visibility ? (
            <Tag className="m-0">{job.visibility}</Tag>
          ) : null}
        </div>
        <Title level={4} className="!mb-0">
          {job?.title || 'Vị trí chưa đặt tên'}
        </Title>
        <Text type="secondary">{job?.companyName ?? '—'}</Text>
        {job?.status === 'REJECTED' && job?.statusReason && (
          <div role="note" className="rounded-lg border border-solid border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <Text strong className="text-red-800">
              Lý do từ chối:{' '}
            </Text>
            {job.statusReason}
          </div>
        )}
      </header>

      <Descriptions size="small" column={{ xs: 1, sm: 2 }} colon={false} labelStyle={{ color: '#475569' }}>
        <Descriptions.Item label="Mức lương">{formatSalary(job)}</Descriptions.Item>
        <Descriptions.Item label="Kinh nghiệm">
          {formatExperience(job?.minExperienceYears ?? null, job?.maxExperienceYears ?? null)}
        </Descriptions.Item>
        <Descriptions.Item label="Hình thức">
          {job?.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Số lượng">
          <TeamOutlined aria-hidden className="mr-1" />
          {job?.quantity != null ? `${job.quantity} người` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Địa điểm">
          <EnvironmentOutlined aria-hidden className="mr-1" />
          {job?.location ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Thời gian làm việc">{job?.workingTime ?? '—'}</Descriptions.Item>
        {job?.salaryNote && <Descriptions.Item label="Ghi chú lương">{job.salaryNote}</Descriptions.Item>}
        <Descriptions.Item label="Ngày đăng">{formatDate(job?.postedAt)}</Descriptions.Item>
      </Descriptions>

      <section aria-label="Mô tả công việc">
        <Text strong className="block mb-2">
          Mô tả công việc
        </Text>
        <LongText value={job?.description} emptyText="Chưa có mô tả." />
      </section>

      <RequirementList title="Yêu cầu bắt buộc" items={mustHave} emptyText="Chưa có yêu cầu bắt buộc." />
      <RequirementList title="Yêu cầu ưu tiên" items={shouldHave} emptyText="Không có yêu cầu ưu tiên." />

      {(skills?.length ?? 0) > 0 && (
        <section aria-label="Kỹ năng">
          <Text strong className="block mb-2">
            Kỹ năng
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {(skills || []).map((s, idx) => (
              <Tag key={s?.skillId || idx} color={s?.isMandatory ? 'green' : undefined} className="m-0">
                {s?.skillName ?? s?.skillId}
                {s?.isMandatory ? ' · bắt buộc' : ''}
              </Tag>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Quyền lợi">
        <Text strong className="block mb-2">
          Quyền lợi
        </Text>
        <LongText value={job?.benefits} emptyText="Chưa cập nhật quyền lợi." />
      </section>

      {showHistory && (
        <section aria-label="Lịch sử trạng thái">
          <Text strong className="block mb-3">
            Lịch sử trạng thái
          </Text>
          {(statusHistories?.length ?? 0) === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử." />
          ) : (
            <Timeline
              items={(statusHistories || []).map((h) => ({
                dot: <ClockCircleOutlined aria-hidden />,
                children: (
                  <div>
                    <Text strong>{JOB_STATUS[h.newStatus as JobStatus]?.label ?? h.newStatus}</Text>
                    <Text type="secondary"> · {formatDateTime(h.changedAt)}</Text>
                    {(h.reasonCode || h.reasonText) && (
                      <div className="text-sm text-slate-600">
                        {h.reasonCode ? REASON_CODE_LABEL[h.reasonCode] ?? h.reasonCode : ''}
                        {h.reasonText ? `${h.reasonCode ? ': ' : ''}${h.reasonText}` : ''}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </section>
      )}
    </div>
  );
};

export default JobDetailPanel;
