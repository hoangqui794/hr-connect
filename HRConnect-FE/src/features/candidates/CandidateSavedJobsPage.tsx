/**
 * @file CandidateSavedJobsPage.tsx
 * @description Candidate's saved jobs (mockup 03/11) on /candidates/me/saved-jobs. The API returns newest first
 * with no other order, so sorting and paging run here over the first 100 saved jobs.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Pagination, Popconfirm, Select, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { CompanyMark, jobHref, salaryText } from '@/features/landing/components/SiteParts';
import { CandidateAccountFrame } from '@/features/portal/candidate/CandidateAccountFrame';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { ApplyModal } from '@/features/portal/JobApplyActions';
import { SAVED_JOBS_CUSTOM_EVENT, SAVED_JOBS_EVENT, SAVED_JOBS_QUERY_KEY } from '@/hooks/useSavedJobs';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Job } from '@/types/api/jobs';
import type { JobListItemDto, SavedJobDto } from '@/types/api/candidateSavedJobs';

const PAGE_SIZE = 10;
/** The API's largest page. */
const MAX_SAVED = 100;
/** From this many days left, the row warns instead of showing the date. */
const SOON_DAYS = 7;

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const ACTION = 'flex h-10 items-center rounded-md px-[14px] text-[14px] font-semibold no-underline';

const idOf = (item: SavedJobDto) => item.job?.jobId || item.jobId || item.savedJobId;
const isOpen = (job: JobListItemDto) =>
  job.status === 'ACTIVE' && job.isAcceptingApplications !== false && (!job.applicationDeadline || dayjs(job.applicationDeadline).isAfter(dayjs()));

const deadlineNote = (job: JobListItemDto): { text: string; color: string } | null => {
  if (job.status && job.status !== 'ACTIVE') return { text: 'Tin đã đóng, không nhận hồ sơ', color: '#6B7280' };
  if (!isOpen(job)) return { text: 'Đã hết hạn nhận hồ sơ', color: '#6B7280' };
  if (!job.applicationDeadline) return null;
  const deadline = dayjs(job.applicationDeadline);
  const days = deadline.startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days <= SOON_DAYS) return { text: days > 0 ? `Còn ${days} ngày để nộp` : 'Hết hạn nộp hôm nay', color: '#9A3412' };
  return { text: `Hạn nộp ${deadline.format('DD/MM/YYYY')}`, color: '#4B5563' };
};

export const CandidateSavedJobsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const { isApplied, getApplication } = useCandidateAppliedJobs();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'SAVED' | 'DEADLINE'>('SAVED');
  const [applying, setApplying] = useState<JobListItemDto | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const saved = useQuery({
    queryKey: ['candidate-saved-jobs-list', sort],
    queryFn: () =>
      candidateSavedJobApi.getSavedJobs(
        sort === 'DEADLINE'
          ? { page: 1, pageSize: MAX_SAVED, sortBy: 'DEADLINE_ASC' }
          : { page: 1, pageSize: MAX_SAVED }
      ),
    staleTime: 15_000,
  });

  const items = [...(saved.data?.items ?? [])];
  if (sort === 'DEADLINE') {
    // Open jobs by nearest deadline; jobs with no deadline next; closed jobs last.
    const rank = (job: JobListItemDto) => (!isOpen(job) ? Infinity : job.applicationDeadline ? dayjs(job.applicationDeadline).valueOf() : Number.MAX_SAFE_INTEGER);
    items.sort((a, b) => rank(a.job ?? ({} as JobListItemDto)) - rank(b.job ?? ({} as JobListItemDto)));
  }
  const total = saved.data?.totalCount ?? 0;
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const unsave = async (jobId: string, title?: string) => {
    setRemoving(jobId);
    try {
      await candidateSavedJobApi.unsaveJob(jobId);
      message.success(`Đã bỏ lưu${title ? ` "${title}"` : ''}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['candidate-saved-jobs-list'] }),
        queryClient.invalidateQueries({ queryKey: SAVED_JOBS_QUERY_KEY }),
      ]);
      window.dispatchEvent(new Event(SAVED_JOBS_EVENT));
      window.dispatchEvent(new CustomEvent(SAVED_JOBS_CUSTOM_EVENT));
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể bỏ lưu việc làm.'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <CandidateAccountFrame>
      <div className="mb-[14px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-[22px] font-bold text-[#1F2937]">Việc đã lưu</h1>
          <p className="m-0 text-[#4B5563]">{saved.isSuccess ? `${total} việc làm. Tin hết hạn vẫn được giữ để bạn xem lại.` : 'Tin hết hạn vẫn được giữ để bạn xem lại.'}</p>
        </div>
        <div className="flex items-center gap-2 text-[#4B5563]">
          <span id="saved-sort">Sắp xếp</span>
          <Select
            aria-labelledby="saved-sort"
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            options={[
              { value: 'SAVED', label: 'Mới lưu nhất' },
              { value: 'DEADLINE', label: 'Sắp hết hạn' },
            ]}
            className={`${FONT} h-9 w-[150px] [&_.ant-select-selection-item]:!text-[#1F2937] [&_.ant-select-selector]:!rounded-md [&_.ant-select-selector]:!border-[#D1D5DB]`}
            popupMatchSelectWidth={false}
          />
        </div>
      </div>

      {saved.isLoading ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white p-4"><Skeleton active avatar paragraph={{ rows: 5 }} /></div>
      ) : saved.isError ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-12 text-center">
          <h2 className="m-0 text-[16px] font-bold">Không thể tải danh sách việc đã lưu</h2>
          <p className="m-0 mt-2 text-[#4B5563]">{getApiErrorMessage(saved.error)}</p>
          <button type="button" onClick={() => saved.refetch()} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-12 text-center">
          <h2 className="m-0 text-[16px] font-bold">Bạn chưa lưu việc làm nào</h2>
          <p className="m-0 mt-2 text-[#4B5563]">Bấm biểu tượng trái tim ở một việc làm để lưu lại và ứng tuyển sau.</p>
          <Link to="/jobs" className={`mt-3 inline-block font-semibold ${LINK}`}>Tìm việc làm</Link>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white">
            {visible.map((item) => {
              const job = item.job ?? ({} as JobListItemDto);
              const jobId = idOf(item);
              const title = job.title || item.title || 'Việc làm';
              const note = deadlineNote(job);
              const applicationId = isApplied(jobId) ? getApplication(jobId)?.applicationId : undefined;
              return (
                <article key={item.savedJobId || jobId} className="flex flex-wrap items-center gap-[14px] border-0 border-b border-solid border-[#F1F5F9] p-4">
                  <CompanyMark name={job.companyName} logoUrl={job.company?.logoUrl} size={58} />
                  <div className="min-w-0 flex-[1_1_320px]">
                    <Link to={jobHref(jobId)} className="text-[15px] font-semibold text-[#111827] no-underline hover:text-[#075985] hover:underline">{title}</Link>
                    <div className="text-[13px] text-[#4B5563]">{[job.companyName, job.location].filter(Boolean).join(' · ')}</div>
                    <div className="mt-1 flex flex-wrap gap-[14px] text-[13px]">
                      <span className="font-semibold text-[#059669]">{salaryText(job)}</span>
                      {note && <span style={{ color: note.color }}>{note.text}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Popconfirm title="Bỏ lưu việc làm này?" okText="Bỏ lưu" okButtonProps={{ danger: true }} cancelText="Hủy" onConfirm={() => unsave(jobId, title)}>
                      <button type="button" aria-label={`Bỏ lưu ${title}`} disabled={removing === jobId} className={`${FONT} h-10 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60`}>Bỏ lưu</button>
                    </Popconfirm>
                    {isApplied(jobId) ? (
                      <Link to={applicationId ? `/candidate/applications/${applicationId}` : '/candidate/applications'} className={`${ACTION} whitespace-nowrap border border-solid border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800`}>Xem đơn</Link>
                    ) : isOpen(job) ? (
                      <button type="button" aria-label={`Ứng tuyển ${title}`} onClick={() => setApplying(job)} className={`${ACTION} ${FONT} whitespace-nowrap cursor-pointer border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white transition-all hover:from-sky-400 hover:to-blue-500 shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98]`}>Ứng tuyển</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          {items.length > PAGE_SIZE && (
            <div className="mt-4 flex justify-center">
              <Pagination current={page} pageSize={PAGE_SIZE} total={items.length} showSizeChanger={false} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* The apply dialog reads only the job's id, title, company and location. */}
      {applying && <ApplyModal job={applying as unknown as Job} open onClose={() => setApplying(null)} />}
    </CandidateAccountFrame>
  );
};

export default CandidateSavedJobsPage;
