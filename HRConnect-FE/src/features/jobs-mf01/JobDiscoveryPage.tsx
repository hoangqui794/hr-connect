/**
 * @file JobDiscoveryPage.tsx
 * @description MF-01 · Job discovery backed by GET /jobs. The backend decides which jobs each
 * role may see (visibility × service type), so the UI just renders the page it gets back.
 * Filters live in the URL so results can be shared and survive Back.
 */
import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Input, Pagination, Select, Skeleton, Tag, Typography } from 'antd';
import { EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';
import type { EmploymentType, Job, JobSearchParams } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useJobSearch, usePublicJobSearch, useServiceTypes } from './useJobQueries';
import { EMPLOYMENT_TYPE_LABEL, SERVICE_TYPE_LABEL, formatDate, formatExperience, formatSalary } from './jobDisplay';

const { Title, Text } = Typography;
const PAGE_SIZE = 12;

const JobCard: React.FC<{ job: Job; detailBasePath: string }> = ({ job, detailBasePath }) => (
  <Card
    hoverable
    className="h-full transition-shadow duration-200"
    styles={{ body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' } }}
  >
    <Link
      to={`${detailBasePath}/${job.jobId}`}
      className="font-semibold text-slate-900 hover:text-blue-700 line-clamp-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
    >
      {job.title}
    </Link>
    <Text type="secondary" className="text-sm">
      {job.companyName ?? '—'}
    </Text>
    <div className="text-sm font-medium text-blue-800">{formatSalary(job)}</div>
    <div className="flex flex-wrap gap-1.5">
      {job.location && (
        <Tag className="m-0" icon={<EnvironmentOutlined aria-hidden />}>
          {job.location}
        </Tag>
      )}
      {job.employmentType && <Tag className="m-0">{EMPLOYMENT_TYPE_LABEL[job.employmentType]}</Tag>}
      <Tag className="m-0">{formatExperience(job.minExperienceYears, job.maxExperienceYears)}</Tag>
    </div>
    <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-500">
      <span>{job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode].label : ''}</span>
      <span>Đăng {formatDate(job.postedAt)}</span>
    </div>
  </Card>
);

interface JobDiscoveryPageProps {
  /** Where job cards link to, e.g. "/jobs" (public) or "/affiliate/jobs" (in-app). */
  detailBasePath?: string;
  /** Use the anonymous endpoint fixed to Candidate visibility and service permissions. */
  publicAccess?: boolean;
}

export const JobDiscoveryPage: React.FC<JobDiscoveryPageProps> = ({ detailBasePath = '/jobs', publicAccess = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceTypes = useServiceTypes();

  const params: JobSearchParams = useMemo(
    () => ({
      search: searchParams.get('q') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      employmentType: (searchParams.get('type') as EmploymentType | null) ?? undefined,
      serviceTypeId: searchParams.get('service') ?? undefined,
      page: Number(searchParams.get('page')) || 1,
      pageSize: PAGE_SIZE,
    }),
    [searchParams]
  );

  const authenticatedJobs = useJobSearch(params, !publicAccess);
  const publicJobs = usePublicJobSearch(params, publicAccess);
  const { data, isLoading, isError, error, isFetching } = publicAccess ? publicJobs : authenticatedJobs;

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="space-y-5">
      {/* key remounts the uncontrolled inputs when the URL filters change (e.g. "Xóa bộ lọc"). */}
      <div key={searchParams.toString()} className="rounded-xl border border-solid border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Input.Search
            size="large"
            allowClear
            defaultValue={params.search}
            placeholder="Tên vị trí, kỹ năng, công ty..."
            enterButton={<SearchOutlined aria-label="Tìm" />}
            onSearch={(v) => setParam('q', v.trim() || undefined)}
            aria-label="Từ khóa tìm việc"
          />
          <Input
            size="large"
            allowClear
            defaultValue={params.location}
            placeholder="Địa điểm"
            prefix={<EnvironmentOutlined aria-hidden />}
            onPressEnter={(e) => setParam('location', e.currentTarget.value.trim() || undefined)}
            onBlur={(e) => setParam('location', e.currentTarget.value.trim() || undefined)}
            aria-label="Địa điểm"
          />
          <Select
            size="large"
            allowClear
            value={params.employmentType}
            placeholder="Hình thức"
            onChange={(v) => setParam('type', v)}
            options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((k) => ({ value: k, label: EMPLOYMENT_TYPE_LABEL[k] }))}
            aria-label="Hình thức làm việc"
          />
          <Select
            size="large"
            allowClear
            value={params.serviceTypeId}
            placeholder="Loại dịch vụ"
            loading={serviceTypes.isLoading}
            onChange={(v) => setParam('service', v)}
            options={(serviceTypes.data ?? []).map((s) => ({ value: s.id, label: SERVICE_TYPE_LABEL[s.code]?.label ?? s.name }))}
            aria-label="Loại dịch vụ"
          />
        </div>
      </div>

      {isError ? (
        <Alert type="error" showIcon message="Không tải được danh sách việc làm" description={getApiErrorMessage(error)} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-solid border-slate-200 bg-white py-14">
          <Empty description="Không tìm thấy việc làm phù hợp. Thử bỏ bớt bộ lọc.">
            {searchParams.toString() && <Button onClick={() => setSearchParams(new URLSearchParams())}>Xóa bộ lọc</Button>}
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Text type="secondary" aria-live="polite">
              {data.totalCount} việc làm{isFetching ? ' · đang cập nhật...' : ''}
            </Text>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={isFetching}>
            {data.items.map((job) => (
              <JobCard key={job.jobId} job={job} detailBasePath={detailBasePath} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                current={data.page}
                pageSize={data.pageSize}
                total={data.totalCount}
                showSizeChanger={false}
                onChange={(p) => setParam('page', String(p))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobDiscoveryPage;
