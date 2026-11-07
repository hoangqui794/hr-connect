/**
 * @file AffiliateJobPages.tsx
 * @description Affiliate "Việc làm" list and job detail (mockup 03/11). The list shows each job's
 * service, place, salary and the estimated commission from GET /affiliates/jobs/{id}/commission-estimate;
 * nothing about money is hard-coded here.
 */
import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Pagination, Select, Skeleton } from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { jobsApi, serviceTypesApi } from '@/services/api/jobsApi';
import { affiliateApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Job } from '@/types/api/jobs';
import { formatSalary } from '@/features/jobs-mf01/jobDisplay';
import { renderFormattedMultilineText } from '@/features/jobs-mf01/RichTextEditor';
import { useJobDetail } from '@/features/jobs-mf01/useJobQueries';
import { CommissionEstimateCard, commissionEstimateApi, formatEstimate } from './CommissionEstimateCard';
import { AffiliatePageHeader } from './affiliate/AffiliateUi';
import { CompanyLogo as SharedCompanyLogo } from '@/components/common/CompanyLogo';

const PAGE_SIZE = 10;

export const AFFILIATE_SERVICE_LABEL: Record<string, string> = {
  HEADHUNT_COD: 'Tuyển qua Affiliate',
  CV_SOURCING: 'Mua CV',
  CV_APPLICATION: 'Đăng tin',
};
export const affiliateServiceLabel = (code?: string | null) => (code ? AFFILIATE_SERVICE_LABEL[code] ?? code : '—');

const initials = (name?: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'HR';

const CompanyLogo: React.FC<{ job: Pick<Job, 'companyName' | 'companyLogoUrl'>; size?: number }> = ({ job, size = 52 }) => (
  <div style={{ width: size, height: size }} className="shrink-0">
    <SharedCompanyLogo
      companyName={job.companyName || ''}
      logoUrl={job.companyLogoUrl ?? undefined}
      className="!w-full !h-full !rounded-md border border-solid border-gray-200"
    />
  </div>
);

const ServiceChip: React.FC<{ code?: string | null }> = ({ code }) => (
  <span className="rounded bg-sky-100 px-2 py-px text-xs font-medium text-sky-800">{affiliateServiceLabel(code)}</span>
);

/** One line about how much of the job is left to fill. */
const progressLine = (job: Job) => {
  if (job.serviceTypeCode === 'CV_SOURCING' && job.sourcingTarget) return `Cần ${job.sourcingTarget} CV`;
  const parts = [`Cần ${job.quantity} người`];
  if (job.warrantyDays != null) parts.push(`bảo hành ${job.warrantyDays} ngày`);
  return parts.join(' · ');
};

export const AffiliateJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const serviceTypeId = params.get('service') || undefined;
  const location = params.get('location') || undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = React.useState(search);

  const serviceTypes = useQuery({ queryKey: ['service-types', 'active'], queryFn: () => serviceTypesApi.getActive(), staleTime: 10 * 60_000 });
  const jobs = useQuery({
    queryKey: ['aff-jobs', 'list', search, serviceTypeId, location, page],
    queryFn: () => jobsApi.search({ search: search || undefined, serviceTypeId, location, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });
  const items = jobs.data?.items ?? [];
  const estimates = useQueries({
    queries: items.map((job) => ({
      queryKey: ['affiliate-commission-estimate', job.jobId],
      queryFn: () => commissionEstimateApi.get(job.jobId),
      staleTime: 5 * 60_000,
    })),
  });

  const update = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in next)) p.delete('page');
    setParams(p);
  };

  // Affiliates refer into HEADHUNT_COD and CV_SOURCING jobs only, so those are the useful filters.
  const serviceOptions = (serviceTypes.data ?? [])
    .filter((s) => s.code !== 'CV_APPLICATION')
    .map((s) => ({ value: s.id, label: affiliateServiceLabel(s.code) }));

  return (
    <div>
      <AffiliatePageHeader title="Việc làm" description="Việc làm đang nhận ứng viên từ Affiliate, kèm hoa hồng ước tính theo quy tắc hiện hành." />
      <form
        role="search"
        className="mb-3.5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: draft.trim() || undefined });
        }}
      >
        <Input
          aria-label="Tìm việc"
          allowClear
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Vị trí, kỹ năng, công ty"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value) update({ q: undefined });
          }}
          className="!h-10 min-w-[240px] flex-[2_1_260px]"
        />
        <Select
          aria-label="Dịch vụ"
          allowClear
          placeholder="Tất cả dịch vụ"
          value={serviceTypeId}
          options={serviceOptions}
          loading={serviceTypes.isLoading}
          onChange={(v) => update({ service: v })}
          className="!h-10 min-w-[180px] flex-[1_1_180px]"
        />
        <Input
          aria-label="Địa điểm"
          allowClear
          placeholder="Địa điểm"
          defaultValue={location}
          onPressEnter={(e) => update({ location: (e.target as HTMLInputElement).value.trim() || undefined })}
          onChange={(e) => !e.target.value && update({ location: undefined })}
          className="!h-10 min-w-[160px] flex-[1_1_160px]"
        />
        <Button htmlType="submit" type="primary" className="!bg-[color:var(--affiliate-brand)]">Lọc</Button>
      </form>

      <p className="m-0 mb-2.5 text-sm text-gray-600">
        {jobs.isLoading ? 'Đang tải…' : `${jobs.data?.totalCount ?? 0} việc làm đang mở`}
      </p>

      {jobs.isError ? (
        <Alert type="error" showIcon message="Không tải được việc làm" description={getApiErrorMessage(jobs.error)} action={<Button onClick={() => jobs.refetch()}>Thử lại</Button>} />
      ) : (
        <div className="rounded-lg border border-solid border-gray-200 bg-white">
          {jobs.isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="border-0 border-b border-solid border-slate-100 p-4">
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              </div>
            ))}
          {!jobs.isLoading && items.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="font-semibold text-gray-900">Không có việc làm khớp bộ lọc</div>
              <p className="m-0 mt-1 text-sm text-gray-600">Thử bỏ bớt địa điểm hoặc loại dịch vụ.</p>
              <Button className="mt-3" onClick={() => { setDraft(''); setParams({}); }}>Xóa bộ lọc</Button>
            </div>
          )}
          {items.map((job, i) => {
            const est = estimates[i];
            return (
              <article key={job.jobId} className="flex flex-wrap items-center gap-3.5 border-0 border-b border-solid border-slate-100 p-4 last:border-b-0">
                <CompanyLogo job={job} />
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/affiliate/jobs/${job.jobId}`} className="text-[15px] font-semibold text-gray-900 hover:text-sky-800">{job.title}</Link>
                    <ServiceChip code={job.serviceTypeCode} />
                  </div>
                  <div className="text-[13px] text-gray-600">
                    {[job.companyName, job.location, formatSalary(job)].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-0.5 text-[13px] text-gray-500">{progressLine(job)}</div>
                </div>
                <div className="shrink-0 text-right max-sm:w-full max-sm:text-left">
                  <div className="text-xs text-gray-500">Hoa hồng ước tính</div>
                  <div className="whitespace-nowrap text-[15px] font-bold tabular-nums text-[color:var(--affiliate-cta)]">
                    {est?.isLoading ? <Skeleton.Input active size="small" /> : (est?.data && formatEstimate(est.data)) || '—'}
                  </div>
                </div>
                <Button type="primary" className="!bg-[color:var(--affiliate-brand)]" onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)}>
                  Giới thiệu
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {(jobs.data?.totalPages ?? 0) > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination current={page} pageSize={PAGE_SIZE} total={jobs.data?.totalCount ?? 0} showSizeChanger={false} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </div>
  );
};

const RequirementList: React.FC<{ title: string; items: Job['requirements'] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <section className="min-w-0 max-w-full">
      <h2 className="m-0 mb-2 text-base font-bold text-gray-900">{title}</h2>
      <ul className="m-0 space-y-1 pl-5">
        {items.map((r) => <li key={r.requirementId} className="whitespace-pre-line break-words">{r.content}</li>)}
      </ul>
    </section>
  );

const LongText: React.FC<{ title: string; value?: string | null }> = ({ title, value }) =>
  !value ? null : (
    <section>
      <h2 className="m-0 mb-2 text-base font-bold text-gray-900">{title}</h2>
      <p className="m-0 whitespace-pre-line break-words">{renderFormattedMultilineText(value)}</p>
    </section>
  );

export const AffiliateJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const detail = useJobDetail(jobId);
  const mine = useQuery({
    queryKey: ['aff-submissions', 'count', 'job', jobId],
    queryFn: async () => (await affiliateApi.submissions({ jobId, page: 1, pageSize: 1 })).totalCount,
    enabled: Boolean(jobId),
  });
  const job = detail.data;

  return (
    <div className="space-y-4">
      <Link to="/affiliate/jobs" className="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:text-sky-900">
        <ArrowLeftOutlined aria-hidden /> Việc làm
      </Link>
      <h1 className="sr-only">{job?.title ?? 'Chi tiết việc làm'}</h1>
      {detail.isError ? (
        <Alert type="error" showIcon message="Không xem được việc làm này" description={getApiErrorMessage(detail.error)} />
      ) : detail.isLoading || !job ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <div className="grid grid-cols-1 gap-5 w-full max-w-full min-w-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="w-full min-w-0 max-w-full space-y-4">
            <section className="flex flex-wrap gap-4 rounded-lg border border-solid border-gray-200 bg-white p-5">
              <CompanyLogo job={job} size={72} />
              <div className="min-w-0 flex-[1_1_300px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold text-gray-900">{job.title}</span>
                  <ServiceChip code={job.serviceTypeCode} />
                </div>
                <div className="mt-0.5 text-gray-600">{[job.companyName, job.location].filter(Boolean).join(' · ')}</div>
                <dl className="m-0 mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-2.5 text-[13px]">
                  <div><dt className="text-gray-500">Lương</dt><dd className="m-0 font-semibold">{formatSalary(job) || '—'}</dd></div>
                  <div><dt className="text-gray-500">Cần tuyển</dt><dd className="m-0 font-semibold">{job.serviceTypeCode === 'CV_SOURCING' && job.sourcingTarget ? `${job.sourcingTarget} CV` : `${job.quantity} người`}</dd></div>
                  <div><dt className="text-gray-500">Hạn nhận hồ sơ</dt><dd className="m-0 font-semibold">{job.applicationDeadline ? dayjs(job.applicationDeadline).format('DD/MM/YYYY') : '—'}</dd></div>
                </dl>
              </div>
            </section>
            <article className="min-w-0 max-w-full space-y-5 overflow-hidden rounded-lg border border-solid border-gray-200 bg-white p-5 leading-relaxed sm:p-6">
              <RequirementList title="Yêu cầu bắt buộc" items={job.requirements.filter((r) => r.requirementType === 'MUST_HAVE')} />
              <RequirementList title="Ưu tiên" items={job.requirements.filter((r) => r.requirementType === 'SHOULD_HAVE')} />
              {job.skills.length > 0 && (
                <section>
                  <h2 className="m-0 mb-2 text-base font-bold text-gray-900">Kỹ năng</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((skill) => (
                      <span key={skill.skillId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{skill.skillName}</span>
                    ))}
                  </div>
                </section>
              )}
              <LongText title="Mô tả công việc" value={job.description} />
              <LongText title="Quyền lợi" value={job.benefits} />
              <LongText title="Thời gian làm việc" value={job.workingTime} />
            </article>
          </div>
          <aside className="w-full min-w-0 max-w-full space-y-4 xl:sticky xl:top-24 xl:self-start">
            <CommissionEstimateCard jobId={job.jobId} />
            <Button type="primary" size="large" block className="affiliate-cta" onClick={() => navigate(`/affiliate/submit-candidate?job=${job.jobId}`)}>
              Giới thiệu ứng viên
            </Button>
            <section className="rounded-lg border border-solid border-gray-200 bg-white p-4">
              <h2 className="m-0 mb-1 text-[15px] font-bold text-gray-900">Lượt của bạn ở job này</h2>
              <p className="m-0 text-[13px] text-gray-600">
                {mine.isLoading ? 'Đang tải…' : mine.data ? <>{mine.data} lượt giới thiệu · <Link to={`/affiliate/submissions?jobId=${job.jobId}`}>Xem</Link></> : 'Bạn chưa giới thiệu ai vào job này.'}
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};
