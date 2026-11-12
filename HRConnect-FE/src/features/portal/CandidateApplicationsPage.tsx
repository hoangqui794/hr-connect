/**
 * @file CandidateApplicationsPage.tsx
 * @description Candidate's applications (mockup 03/11) on GET /candidates/applications and the pending
 * Affiliate referrals. The API filters by one status group, while the tabs join several and show counts,
 * so tabs and paging run here over the first 100 applications.
 */
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, DatePicker, Input, Pagination, Popconfirm, Select, Skeleton } from 'antd';
import { CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CompanyMark } from '@/features/landing/components/SiteParts';
import { candidateApplicationsApi, candidateConsentApi } from '@/services/api/mf02Api';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import type { CandidateApplication, CandidateApplicationDisplayGroup, CandidateSubmissionConsent } from '@/types/api/mf02';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';
import { candidateDisplayStage } from './mf02Labels';
import { candidateKeys } from './candidate/candidateKeys';

const PAGE_SIZE = 10;
/** The API's largest page. */
const MAX_APPLICATIONS = 100;
const STEP_COUNT = 5;

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-sky-600 no-underline hover:text-sky-700 hover:underline font-semibold';

type Tab = 'ALL' | 'PROCESSING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'ENDED';
type Group = CandidateApplicationDisplayGroup;

const TABS: { key: Tab; label: string; groups?: Group[] }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PROCESSING', label: 'Đang xử lý', groups: ['SUBMITTED', 'IN_REVIEW', 'SELECTED'] },
  { key: 'INTERVIEW', label: 'Phỏng vấn', groups: ['INTERVIEW'] },
  { key: 'OFFER', label: 'Offer', groups: ['OFFER'] },
  { key: 'HIRED', label: 'Đang làm việc', groups: ['HIRED'] },
  { key: 'ENDED', label: 'Đã kết thúc', groups: ['ENDED', 'NOT_SELECTED', 'WITHDRAWN'] },
];

/** Older links pass one status group in `status`; it opens the tab holding that group. */
const tabFromParam = (value: string | null): Tab =>
  TABS.find((tab) => tab.key === value || tab.groups?.includes(value as Group))?.key ?? 'ALL';

const NEUTRAL = { text: '#374151', background: '#F3F4F6' };
const INFO = { text: '#075985', background: '#E0F2FE' };
const GOOD = { text: '#166534', background: '#DCFCE7' };

/** Display of each status group: progress steps reached, colours, next-step line and link. */
const GROUP_VIEW: Record<Group, { steps: number; ended?: boolean; color: { text: string; background: string }; next?: string; action: string }> = {
  SUBMITTED: { steps: 1, color: NEUTRAL, next: 'Hồ sơ đã gửi, chờ sàng lọc', action: 'Xem chi tiết' },
  IN_REVIEW: { steps: 2, color: INFO, next: 'Nhà tuyển dụng đang xem hồ sơ của bạn', action: 'Xem chi tiết' },
  SELECTED: { steps: 2, color: GOOD, next: 'Bạn được chọn phỏng vấn, chờ nhà tuyển dụng gửi lịch', action: 'Xem chi tiết' },
  INTERVIEW: { steps: 3, color: { text: '#9A3412', background: '#FFEDD5' }, next: 'Ngày giờ và hình thức phỏng vấn có trong đơn', action: 'Xem lịch phỏng vấn' },
  OFFER: { steps: 4, color: GOOD, next: 'Điều khoản và hạn trả lời có trong đơn', action: 'Xem offer' },
  HIRED: { steps: 5, color: GOOD, next: 'Chúc mừng bạn đã nhận việc', action: 'Xem chi tiết' },
  ENDED: { steps: 5, ended: true, color: NEUTRAL, next: 'Hồ sơ nhận việc tại vị trí này đã kết thúc', action: 'Xem chi tiết' },
  NOT_SELECTED: { steps: 2, ended: true, color: NEUTRAL, action: 'Xem việc tương tự' },
  WITHDRAWN: { steps: 1, ended: true, color: NEUTRAL, action: 'Xem chi tiết' },
};

const remainingText = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  return hours >= 1 ? `${hours} giờ` : `${Math.max(1, Math.ceil(seconds / 60))} phút`;
};

const PendingReferral: React.FC<{ consent: CandidateSubmissionConsent }> = ({ consent }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const respond = useMutation({
    mutationFn: async (decision: 'CONFIRM' | 'DECLINE') => {
      // Agreeing here must not change an earlier choice about reusing the CV, so it is read first.
      const allowReuse = decision === 'CONFIRM' && (await candidateConsentApi.review(consent.submissionId)).affiliateReuseStatus === 'ALLOWED';
      return candidateConsentApi.respond(consent.submissionId, decision, allowReuse);
    },
    onSuccess: async (result) => {
      message.success(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['candidate-submission-consents'] }),
        queryClient.invalidateQueries({ queryKey: candidateKeys.applications }),
        queryClient.invalidateQueries({ queryKey: ['candidate-menu', 'applications-count'] }),
      ]);
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Không thể ghi nhận lựa chọn của bạn.');
      message.error(
        apiError.status === 429 && apiError.retryAfterSeconds
          ? `${apiError.message} Vui lòng thử lại sau ${apiError.retryAfterSeconds} giây.`
          : apiError.message,
      );
      if (apiError.status === 409) await queryClient.invalidateQueries({ queryKey: ['candidate-submission-consents'] });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-solid border-[#FED7AA] bg-white p-3">
      <CompanyMark name={consent.companyName} size={50} />
      <div className="min-w-0 flex-[1_1_260px]">
        <Link to={`/candidate/submission-consents/${consent.submissionId}`} className="font-semibold text-[#1F2937] no-underline hover:text-[#075985] hover:underline">{consent.jobTitle}</Link>
        <div className="text-[13px] text-[#4B5563]">
          {consent.companyName} · Hết hạn xác nhận sau {remainingText(consent.remainingSeconds)}
        </div>
      </div>
      <Popconfirm title="Từ chối lời giới thiệu này?" okText="Từ chối" cancelText="Quay lại" disabled={respond.isPending} onConfirm={() => respond.mutate('DECLINE')}>
        <button type="button" disabled={respond.isPending} className={`${FONT} h-10 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-[14px] text-[14px] text-[#1F2937] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60`}>
          Từ chối
        </button>
      </Popconfirm>
      <button type="button" disabled={respond.isPending} onClick={() => respond.mutate('CONFIRM')} className={`${FONT} h-10 cursor-pointer rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-[14px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:from-sky-400 hover:to-blue-500 hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}>
        Đồng ý
      </button>
    </div>
  );
};

const ApplicationRow: React.FC<{ application: CandidateApplication }> = ({ application: a }) => {
  const view = GROUP_VIEW[a.displayGroup] ?? GROUP_VIEW.IN_REVIEW;
  const stage = candidateDisplayStage(a.displayGroup, a.displayLabel);
  const detailHref = `/candidate/applications/${a.applicationId}`;
  const actionHref = a.displayGroup === 'NOT_SELECTED' ? `/jobs?keyword=${encodeURIComponent(a.jobTitle)}` : detailHref;
  return (
    <article className="flex flex-wrap gap-[14px] rounded-lg border border-solid border-[#E5E7EB] bg-white p-4">
      <CompanyMark name={a.companyName} size={54} />
      <div className="min-w-0 flex-[1_1_380px]">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0">
            <Link to={detailHref} className="text-[15px] font-semibold text-[#111827] no-underline hover:text-[#075985] hover:underline">{a.jobTitle}</Link>
            <div className="text-[13px] text-[#4B5563]">
              {a.companyName} · Nộp {dayjs(a.appliedAt).format('DD/MM/YYYY')} · {a.submissionSource === 'AFFILIATE' ? 'Được Affiliate giới thiệu' : 'Tự ứng tuyển'}
            </div>
          </div>
          <span className="self-start rounded px-2 py-[3px] text-[12px] font-semibold" style={{ color: view.color.text, background: view.color.background }}>
            {a.displayGroup === 'HIRED' ? 'Đang làm việc' : stage.label}
          </span>
        </div>
        <div role="img" aria-label={`Tiến độ: ${stage.label}`} className="mt-3 flex gap-1">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span key={index} className="h-1.5 flex-1 rounded-[3px]" style={{ background: index < view.steps ? (view.ended ? '#94A3B8' : 'linear-gradient(90deg, #0284C7, #2563EB)') : '#E2E8F0' }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-3 text-[13px]">
          <span className="text-[#4B5563]">{stage.terminalMessage ?? view.next}</span>
          <Link to={actionHref} className={`font-semibold ${LINK}`}>{view.action}</Link>
        </div>
      </div>
    </article>
  );
};

export const CandidateApplicationsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const statusParam = params.get('status') || undefined;
  const tab = tabFromParam(statusParam || null);
  const source = (params.get('submissionSource') || undefined) as 'CANDIDATE' | 'AFFILIATE' | undefined;
  const jobId = params.get('jobId') || undefined;
  const searchParam = params.get('search') || undefined;
  const fromDateParam = params.get('fromDate') || undefined;
  const toDateParam = params.get('toDate') || undefined;

  const [searchDraft, setSearchDraft] = useState(searchParam ?? '');

  // Đồng bộ searchDraft khi query param thay đổi từ ngoài (VD reset bộ lọc hoặc back/forward URL)
  React.useEffect(() => {
    setSearchDraft(searchParam ?? '');
  }, [searchParam]);

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setParams(next);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchDraft('');
    const next = new URLSearchParams();
    setParams(next);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchParam ||
    (statusParam && statusParam !== 'ALL') ||
    source ||
    fromDateParam ||
    toDateParam ||
    jobId
  );

  const filters = {
    jobId,
    submissionSource: source,
    search: searchParam,
    fromDate: fromDateParam,
    toDate: toDateParam,
    page: 1,
    pageSize: MAX_APPLICATIONS,
  };

  const applications = useQuery({
    queryKey: [...candidateKeys.applications, filters],
    queryFn: () => candidateApplicationsApi.list(filters),
    placeholderData: (previous) => previous,
  });
  const pending = useQuery({
    queryKey: candidateKeys.submissionConsents('PENDING'),
    queryFn: () => candidateConsentApi.list({ status: 'PENDING', page: 1, pageSize: 5 }),
  });

  const all = applications.data?.items ?? [];
  const inTab = (key: Tab) => {
    const groups = TABS.find((item) => item.key === key)?.groups;
    const base = groups ? all.filter((a) => groups.includes(a.displayGroup)) : all;
    return base.filter((a) => {
      if (searchParam) {
        const q = searchParam.toLowerCase().trim();
        const matchTitle = a.jobTitle?.toLowerCase().includes(q);
        const matchCompany = a.companyName?.toLowerCase().includes(q);
        if (!matchTitle && !matchCompany) return false;
      }
      if (fromDateParam && dayjs(a.appliedAt).isBefore(dayjs(fromDateParam), 'day')) {
        return false;
      }
      if (toDateParam && dayjs(a.appliedAt).isAfter(dayjs(toDateParam), 'day')) {
        return false;
      }
      return true;
    });
  };

  const shown = inTab(tab);
  const visible = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = pending.data?.total ?? 0;

  return (
    <CandidateAccountFrame>
      <h1 className="m-0 mb-1 text-[22px] font-bold text-[#1F2937]">Đơn ứng tuyển</h1>
      <p className="m-0 mb-4 text-[#4B5563]">Theo dõi trạng thái các việc bạn đã ứng tuyển hoặc được Affiliate giới thiệu.</p>

      {pending.isError && (
        <Alert className="!mb-4" type="warning" showIcon message="Chưa tải được lời giới thiệu đang chờ" description={getApiErrorMessage(pending.error)} />
      )}
      {pendingCount > 0 && (
        <section aria-labelledby="pending" className="mb-4 rounded-lg border border-solid border-[#FED7AA] bg-[#FFF7ED] p-4">
          <h2 id="pending" className="m-0 mb-1 text-[15px] font-bold text-[#7C2D12]">{pendingCount} lời giới thiệu đang chờ bạn xác nhận</h2>
          <p className="m-0 mb-3 text-[13px] text-[#7C2D12]">Một Affiliate muốn giới thiệu bạn vào việc dưới đây. Hồ sơ chỉ được gửi khi bạn đồng ý.</p>
          <div className="flex flex-col gap-2">
            {pending.data?.items.map((consent) => <PendingReferral key={consent.submissionId} consent={consent} />)}
          </div>
        </section>
      )}

      {/* Khối card bộ lọc "Tìm đơn ứng tuyển" */}
      <section aria-label="Tìm đơn ứng tuyển" className="mb-5 rounded-2xl border border-solid border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-slate-100 pb-3">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-800">Tìm đơn ứng tuyển</h2>
            <p className="m-0 mt-0.5 text-xs text-slate-500 sm:text-sm">Lọc theo công việc, trạng thái hoặc thời gian bạn đã nộp hồ sơ.</p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
            >
              <CloseCircleOutlined className="text-xs text-slate-400" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {/* 1. Công việc hoặc doanh nghiệp (lg:col-span-4) */}
          <div className="flex flex-col gap-1.5 lg:col-span-4">
            <label htmlFor="candidate-app-search" className="text-xs font-semibold text-slate-700">
              Công việc hoặc doanh nghiệp
            </label>
            <Input
              id="candidate-app-search"
              aria-label="Tìm theo công việc hoặc doanh nghiệp"
              allowClear
              placeholder="Ví dụ: Backend Developer"
              prefix={<SearchOutlined className="mr-1 text-slate-400" />}
              value={searchDraft}
              onChange={(e) => {
                const val = e.target.value;
                setSearchDraft(val);
                if (!val) {
                  updateFilters({ search: undefined });
                }
              }}
              onPressEnter={() => {
                updateFilters({ search: searchDraft.trim() || undefined });
              }}
              className="!h-10 w-full !rounded-xl !border-slate-200/80 text-sm shadow-none hover:!border-sky-400 focus:!border-sky-500"
            />
          </div>

          {/* 2. Trạng thái hiện tại (lg:col-span-3) */}
          <div className="flex flex-col gap-1.5 lg:col-span-3">
            <label htmlFor="candidate-app-status" className="text-xs font-semibold text-slate-700">
              Trạng thái hiện tại
            </label>
            <Select
              id="candidate-app-status"
              aria-label="Lọc theo trạng thái"
              allowClear
              placeholder="Tất cả trạng thái"
              value={tab === 'ALL' ? undefined : tab}
              onChange={(value) => updateFilters({ status: value || undefined })}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'PROCESSING', label: 'Đang xử lý' },
                { value: 'INTERVIEW', label: 'Phỏng vấn' },
                { value: 'OFFER', label: 'Offer' },
                { value: 'HIRED', label: 'Đang làm việc' },
                { value: 'ENDED', label: 'Đã kết thúc' },
              ]}
              className="!h-10 w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-slate-200/80 [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] hover:[&_.ant-select-selector]:!border-sky-400"
              popupMatchSelectWidth={false}
            />
          </div>

          {/* 3. Nguồn ứng tuyển (lg:col-span-2) */}
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label htmlFor="candidate-app-source" className="text-xs font-semibold text-slate-700">
              Nguồn ứng tuyển
            </label>
            <Select
              id="candidate-app-source"
              aria-label="Nguồn"
              allowClear
              placeholder="Tất cả nguồn"
              value={source || undefined}
              onChange={(value) => updateFilters({ submissionSource: value || undefined })}
              options={[
                { value: '', label: 'Tất cả nguồn' },
                { value: 'CANDIDATE', label: 'Tôi tự ứng tuyển' },
                { value: 'AFFILIATE', label: 'Affiliate giới thiệu' },
              ]}
              className="!h-10 w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-slate-200/80 [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] hover:[&_.ant-select-selector]:!border-sky-400"
              popupMatchSelectWidth={false}
            />
          </div>

          {/* 4. Ngày ứng tuyển (lg:col-span-3) */}
          <div className="flex flex-col gap-1.5 lg:col-span-3">
            <label htmlFor="candidate-app-dates" className="text-xs font-semibold text-slate-700">
              Ngày ứng tuyển
            </label>
            <DatePicker.RangePicker
              id="candidate-app-dates"
              aria-label="Lọc theo khoảng ngày nộp hồ sơ"
              placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}
              format="DD/MM/YYYY"
              value={fromDateParam && toDateParam ? [dayjs(fromDateParam), dayjs(toDateParam)] : null}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  updateFilters({
                    fromDate: dates[0].startOf('day').toISOString(),
                    toDate: dates[1].endOf('day').toISOString(),
                  });
                } else {
                  updateFilters({
                    fromDate: undefined,
                    toDate: undefined,
                  });
                }
              }}
              className="!h-10 w-full !rounded-xl !border-slate-200/80 hover:!border-sky-400 [&_.ant-picker-input_input]:!text-sm"
            />
          </div>
        </div>
      </section>

      {/* Tabs trạng thái */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-[#E5E7EB]">
        <div role="tablist" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-1">
          {TABS.map((item) => {
            const selected = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => updateFilters({ status: item.key === 'ALL' ? undefined : item.key })}
                className={`${FONT} h-11 cursor-pointer border-0 bg-transparent px-3 text-[14px] transition-colors ${selected ? 'border-b-2 border-solid border-sky-600 font-bold text-sky-700' : 'text-slate-600 hover:text-sky-600'}`}
              >
                {item.label} ({inTab(item.key).length})
              </button>
            );
          })}
        </div>
      </div>

      {applications.isLoading ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white p-4"><Skeleton active avatar paragraph={{ rows: 5 }} /></div>
      ) : applications.isError ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-12 text-center">
          <h2 className="m-0 text-[16px] font-bold">Không tải được đơn ứng tuyển</h2>
          <p className="m-0 mt-2 text-[#4B5563]">{getApiErrorMessage(applications.error)}</p>
          <button type="button" onClick={() => applications.refetch()} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Thử lại</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-solid border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="m-0 text-[16px] font-bold text-slate-800">
            {all.length === 0 && !hasActiveFilters ? 'Bạn chưa ứng tuyển việc nào' : 'Không có đơn nào phù hợp bộ lọc'}
          </h2>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className={`mt-3 inline-block cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}
            >
              Xóa bộ lọc để xem tất cả
            </button>
          ) : (
            <Link to="/jobs" className={`mt-3 inline-block font-semibold ${LINK}`}>
              Tìm việc làm
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {visible.map((application) => <ApplicationRow key={application.applicationId} application={application} />)}
          </div>
          {shown.length > PAGE_SIZE && (
            <div className="mt-4 flex justify-center">
              <Pagination current={page} pageSize={PAGE_SIZE} total={shown.length} showSizeChanger={false} onChange={setPage} />
            </div>
          )}
          <p className="m-0 mt-[14px] text-[13px] text-[#6B7280]">Thanh tiến trình: Đã nộp → Sàng lọc → Phỏng vấn → Offer → Nhận việc.</p>
        </>
      )}
    </CandidateAccountFrame>
  );
};
