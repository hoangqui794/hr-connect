/**
 * @file JobDiscoveryPage.tsx
 * @description MF-01 · Job discovery backed by GET /jobs. The backend decides which jobs each
 * role may see (can_view per service type), so the UI just renders the page it gets back.
 * Filters live in the URL so results can be shared and survive Back.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Input, InputNumber, Pagination, Select, Skeleton, Tag, Typography } from 'antd';
import { ArrowRightOutlined, CheckCircleFilled, EnvironmentOutlined, FilterOutlined, SearchOutlined, SlidersOutlined } from '@ant-design/icons';
import type { EmploymentType, Job, JobSearchParams } from '@/types/api/jobs';
import { getApiErrorMessage } from '@/services/apiClient';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { useJobSearch, usePublicJobSearch, useServiceTypes } from './useJobQueries';
import { EMPLOYMENT_TYPE_LABEL, SERVICE_TYPE_LABEL, formatDate, formatExperience, formatSalary } from './jobDisplay';

const { Title, Text } = Typography;
const PAGE_SIZE = 12;

const getEstimatedCommission = (job: Job): string => {
  if (job.sourcingPricePerCv && job.sourcingPricePerCv > 0) {
    return `${job.sourcingPricePerCv.toLocaleString('vi-VN')} đ / CV`;
  }
  if (job.feeMultiplier && job.feeMultiplier > 0) {
    if (job.salaryMax && job.salaryMax > 0) {
      const amount = Math.round(job.salaryMax * job.feeMultiplier);
      return `${amount.toLocaleString('vi-VN')} đ`;
    }
    return `${job.feeMultiplier} tháng lương`;
  }
  if (job.salaryMax && job.salaryMax > 0) {
    return `${job.salaryMax.toLocaleString('vi-VN')} đ`;
  }
  if (job.serviceTypeCode === 'HEADHUNT_COD') {
    return '1 tháng lương';
  }
  return '15.000.000 đ';
};

const JobCard: React.FC<{ job: Job; detailBasePath: string; isApplied?: boolean }> = ({ job, detailBasePath, isApplied }) => {
  const isAffiliate = detailBasePath.startsWith('/affiliate');
  return (
    <Card
      hoverable
      className={`candidate-job-card h-full bg-white transition-shadow duration-200 ${isApplied ? 'candidate-job-card--applied border-blue-200' : ''}`}
      styles={{ body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' } }}
    >
      <div className="candidate-job-card__topline">
        <CompanyLogo
          companyName={job.companyName || 'Doanh nghiệp tuyển dụng'}
          logoUrl={job.companyLogoUrl || job.company?.logoUrl || undefined}
          size="md"
          className="candidate-job-card__company-mark !rounded-xl"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <BookmarkButton jobId={job.jobId} jobTitle={job.title} size="sm" />
          {isApplied && (
            <Tag color="blue" icon={<CheckCircleFilled />} className="m-0 shrink-0 font-medium text-[11px]">
              Đã ứng tuyển
            </Tag>
          )}
        </div>
      </div>
      <div className="candidate-job-card__heading">
        <Link
          to={`${detailBasePath}/${job.jobId}`}
          className="candidate-job-card__title font-semibold text-slate-900 hover:text-blue-700 line-clamp-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
        >
          {job.title}
        </Link>
        <Text type="secondary" className="candidate-job-card__company text-sm">
          {job.companyName ?? 'Doanh nghiệp tuyển dụng'}
        </Text>
      </div>

      {isAffiliate ? (
        <div className="rounded-lg bg-emerald-50 border border-solid border-emerald-200/80 p-2.5 my-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Hoa hồng dự kiến</div>
          <div className="text-lg font-extrabold text-emerald-700 font-mono tracking-tight mt-0.5">
            {getEstimatedCommission(job)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Lương: {formatSalary(job)}</div>
        </div>
      ) : (
        <div className="candidate-job-card__salary">{formatSalary(job)}</div>
      )}

      <div className="candidate-job-card__tags flex flex-wrap gap-1.5">
        {job.location && (
          <Tag className="m-0" icon={<EnvironmentOutlined aria-hidden />}>
            {job.location}
          </Tag>
        )}
        {job.employmentType && <Tag className="m-0">{EMPLOYMENT_TYPE_LABEL[job.employmentType]}</Tag>}
        <Tag className="m-0">{formatExperience(job.minExperienceYears, job.maxExperienceYears)}</Tag>
      </div>
      <div className="candidate-job-card__footer mt-auto flex items-center justify-between pt-2 text-xs text-slate-500">
        <div>
          <span>{job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode].label : ''}</span>
          <span> · Đăng {formatDate(job.postedAt)}</span>
        </div>
        <Link
          to={`${detailBasePath}/${job.jobId}`}
          aria-label={`Xem chi tiết ${job.title}`}
          className={isAffiliate ? 'font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1' : undefined}
        >
          {isAffiliate ? 'Giới thiệu ngay' : 'Xem việc'} <ArrowRightOutlined />
        </Link>
      </div>
    </Card>
  );
};

interface JobDiscoveryPageProps {
  /** Where job cards link to, e.g. "/jobs" (public) or "/affiliate/jobs" (in-app). */
  detailBasePath?: string;
  /** Use the anonymous endpoint fixed to Candidate visibility and service permissions. */
  publicAccess?: boolean;
}

export const JobDiscoveryPage: React.FC<JobDiscoveryPageProps> = ({ detailBasePath = '/jobs', publicAccess = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceTypes = useServiceTypes();
  const { isApplied } = useCandidateAppliedJobs();

  const parseOptionalNumber = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const params: JobSearchParams = useMemo(
    () => ({
      search: searchParams.get('q') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      employmentType: (searchParams.get('type') as EmploymentType | null) ?? undefined,
      serviceTypeId: searchParams.get('service') ?? undefined,
      salaryMin: parseOptionalNumber(searchParams.get('salaryMin')),
      salaryMax: parseOptionalNumber(searchParams.get('salaryMax')),
      experienceYears: parseOptionalNumber(searchParams.get('experience')),
      sortBy: (searchParams.get('sortBy') as JobSearchParams['sortBy']) ?? 'POSTED_AT',
      sortDirection: (searchParams.get('sortDirection') as JobSearchParams['sortDirection']) ?? 'DESC',
      page: Number(searchParams.get('page')) || 1,
      pageSize: PAGE_SIZE,
    }),
    [searchParams]
  );

  const authenticatedJobs = useJobSearch(params, !publicAccess);
  const publicJobs = usePublicJobSearch(params, publicAccess);
  const { data, isLoading, isError, error, isFetching } = publicAccess ? publicJobs : authenticatedJobs;

  const [keywordDraft, setKeywordDraft] = useState(params.search ?? '');
  const [locationDraft, setLocationDraft] = useState(params.location ?? '');
  const [filtersOpen, setFiltersOpen] = useState(Boolean(params.employmentType || params.serviceTypeId || params.salaryMin || params.salaryMax || params.experienceYears));

  useEffect(() => {
    setKeywordDraft(params.search ?? '');
    setLocationDraft(params.location ?? '');
  }, [params.location, params.search]);

  const setParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next);
  };

  const setParam = (key: string, value: string | undefined) => setParams({ [key]: value });

  const clearFilters = () => {
    const next = new URLSearchParams();
    const tab = searchParams.get('tab');
    if (tab) next.set('tab', tab);
    setSearchParams(next);
  };

  const applyPrimarySearch = () => {
    setParams({
      q: keywordDraft.trim() || undefined,
      location: locationDraft.trim() || undefined,
    });
  };

  const activeFilterCount = [params.employmentType, params.serviceTypeId, params.salaryMin, params.salaryMax, params.experienceYears]
    .filter((value) => value !== undefined && value !== null && value !== '').length;
  const hasAnyFilter = Boolean(params.search || params.location || activeFilterCount);
  const sortValue = `${params.sortBy ?? 'POSTED_AT'}_${params.sortDirection ?? 'DESC'}`;

  return (
    <div className="job-discovery space-y-5">
      <section className="job-search-panel" aria-label="Tìm và lọc việc làm">
        <form
          className="job-search-panel__primary"
          onSubmit={(event) => {
            event.preventDefault();
            applyPrimarySearch();
          }}
        >
          <Input
            size="large"
            allowClear
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            placeholder="Vị trí, kỹ năng hoặc tên công ty"
            prefix={<SearchOutlined aria-hidden />}
            aria-label="Từ khóa tìm việc"
          />
          <Input
            size="large"
            allowClear
            value={locationDraft}
            onChange={(event) => setLocationDraft(event.target.value)}
            placeholder="Tỉnh, thành phố hoặc khu vực"
            prefix={<EnvironmentOutlined aria-hidden />}
            aria-label="Địa điểm"
          />
          <Button type="primary" size="large" htmlType="submit" icon={<SearchOutlined />}>
            Tìm việc
          </Button>
        </form>

        <div className="job-search-panel__toolbar">
          <Button
            type="text"
            icon={<SlidersOutlined />}
            className={filtersOpen || activeFilterCount ? 'is-active' : ''}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            Bộ lọc nâng cao{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          {hasAnyFilter && <Button type="link" onClick={clearFilters}>Xóa tất cả bộ lọc</Button>}
        </div>

        {filtersOpen && (
          <div className="job-search-panel__advanced">
            <label className="job-filter-field">
              <span>Hình thức làm việc</span>
              <Select
                size="large"
                allowClear
                value={params.employmentType}
                placeholder="Tất cả hình thức"
                onChange={(v) => setParam('type', v)}
                options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((k) => ({ value: k, label: EMPLOYMENT_TYPE_LABEL[k] }))}
                aria-label="Hình thức làm việc"
              />
            </label>
            <label className="job-filter-field">
              <span>Kinh nghiệm tối thiểu</span>
              <InputNumber
                size="large"
                min={0}
                max={60}
                value={params.experienceYears}
                placeholder="Không yêu cầu"
                addonAfter="năm"
                onChange={(value) => setParam('experience', value === null ? undefined : String(value))}
                aria-label="Số năm kinh nghiệm tối thiểu"
              />
            </label>
            <label className="job-filter-field">
              <span>Lương từ</span>
              <InputNumber
                size="large"
                min={0}
                value={params.salaryMin ? params.salaryMin / 1_000_000 : undefined}
                placeholder="0"
                addonAfter="triệu"
                onChange={(value) => setParam('salaryMin', value === null ? undefined : String(Number(value) * 1_000_000))}
                aria-label="Mức lương tối thiểu"
              />
            </label>
            <label className="job-filter-field">
              <span>Lương đến</span>
              <InputNumber
                size="large"
                min={0}
                value={params.salaryMax ? params.salaryMax / 1_000_000 : undefined}
                placeholder="Không giới hạn"
                addonAfter="triệu"
                onChange={(value) => setParam('salaryMax', value === null ? undefined : String(Number(value) * 1_000_000))}
                aria-label="Mức lương tối đa"
              />
            </label>
            <label className="job-filter-field">
              <span>Loại dịch vụ tuyển dụng</span>
              <Select
                size="large"
                allowClear
                value={params.serviceTypeId}
                placeholder="Tất cả dịch vụ"
                loading={serviceTypes.isLoading}
                onChange={(v) => setParam('service', v)}
                options={(serviceTypes.data ?? []).map((s) => ({ value: s.id, label: SERVICE_TYPE_LABEL[s.code]?.label ?? s.name }))}
                aria-label="Loại dịch vụ tuyển dụng"
              />
            </label>
          </div>
        )}

        {hasAnyFilter && (
          <div className="job-search-panel__active" aria-label="Bộ lọc đang áp dụng">
            <FilterOutlined aria-hidden />
            {params.search && <Tag closable onClose={() => setParam('q', undefined)}>Từ khóa: {params.search}</Tag>}
            {params.location && <Tag closable onClose={() => setParam('location', undefined)}>Địa điểm: {params.location}</Tag>}
            {params.employmentType && <Tag closable onClose={() => setParam('type', undefined)}>{EMPLOYMENT_TYPE_LABEL[params.employmentType]}</Tag>}
            {params.experienceYears !== undefined && <Tag closable onClose={() => setParam('experience', undefined)}>Từ {params.experienceYears} năm kinh nghiệm</Tag>}
            {params.salaryMin !== undefined && <Tag closable onClose={() => setParam('salaryMin', undefined)}>Lương từ {params.salaryMin / 1_000_000} triệu</Tag>}
            {params.salaryMax !== undefined && <Tag closable onClose={() => setParam('salaryMax', undefined)}>Lương đến {params.salaryMax / 1_000_000} triệu</Tag>}
            {params.serviceTypeId && <Tag closable onClose={() => setParam('service', undefined)}>Dịch vụ tuyển dụng</Tag>}
          </div>
        )}
      </section>

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
            {hasAnyFilter && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
          </Empty>
        </div>
      ) : (
        <>
          <div className="job-results-toolbar">
            <Text type="secondary" aria-live="polite">
              {data.totalCount} việc làm{isFetching ? ' · đang cập nhật...' : ''}
            </Text>
            <Select
              aria-label="Sắp xếp việc làm"
              value={sortValue}
              className="min-w-48"
              onChange={(value) => {
                const [sortBy, sortDirection] = value.split('_') as [NonNullable<JobSearchParams['sortBy']>, NonNullable<JobSearchParams['sortDirection']>];
                setParams({ sortBy, sortDirection });
              }}
              options={[
                { value: 'POSTED_AT_DESC', label: 'Mới đăng gần đây' },
                { value: 'SALARY_DESC', label: 'Lương cao đến thấp' },
                { value: 'SALARY_ASC', label: 'Lương thấp đến cao' },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={isFetching}>
            {data.items.map((job) => (
              <JobCard
                key={job.jobId}
                job={job}
                detailBasePath={detailBasePath}
                isApplied={isApplied(job.jobId)}
              />
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
