/**
 * @file CandidateAffiliateCvsPage.tsx
 * @description Candidate's Partner CV vault tab (mockup 03/11, Page 21) on GET /candidates/me/affiliate-cvs
 * and Partner CV detail page (mockup 03/11, Page 32) on GET /candidates/me/affiliate-cvs/:cvId.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Pagination, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { candidateAffiliateCvApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateAffiliateCv } from '@/types/api/mf02';
import { fileSize } from './mf02Labels';
import { candidateKeys, useCandidateCvs, useOpenSignedUrl } from './CandidatePages';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline transition-colors duration-200 hover:text-[#075985] hover:underline';
const ACTION = `${FONT} inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white px-3.5 text-[14px] text-[#1F2937] no-underline transition-all duration-200 hover:bg-[#F9FAFB] hover:text-[#111827] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const PRIMARY_ROW_BTN = `${FONT} inline-flex h-10 cursor-pointer items-center justify-center rounded-md border-0 bg-[#0C4A6E] px-4 text-[14px] font-semibold text-white no-underline transition-all duration-200 hover:bg-[#075985] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const PRIMARY_BTN = `${FONT} inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md border-0 bg-[#0C4A6E] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-[#075985] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const SECONDARY_BTN = `${FONT} inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white px-4 text-[14px] font-medium text-[#1F2937] transition-all duration-200 hover:bg-[#F9FAFB] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`;
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white';

export const candidateAffiliateCvKeys = {
  all: ['candidate-affiliate-cvs'] as const,
  list: (page: number) => ['candidate-affiliate-cvs', 'list', page] as const,
  detail: (cvId: string) => ['candidate-affiliate-cvs', 'detail', cvId] as const,
  usages: (cvId: string, page: number) => ['candidate-affiliate-cvs', 'usages', cvId, page] as const,
  previewUrl: (cvId: string) => ['candidate-affiliate-cvs', 'preview-url', cvId] as const,
};

const PartnerCvRow: React.FC<{
  cv: CandidateAffiliateCv;
  canAdopt: boolean;
  alreadySaved: boolean;
  adopting: boolean;
  onAdopt: () => void;
}> = ({ cv, canAdopt, alreadySaved, adopting, onAdopt }) => {
  const displayTitle = cv.fileName || cv.title || 'CV được giới thiệu.pdf';
  const usages = useQuery({
    queryKey: candidateAffiliateCvKeys.usages(cv.cvId, 1),
    queryFn: () => candidateAffiliateCvApi.usages(cv.cvId, 1, 1),
    staleTime: 60_000,
  });
  const latestUsage = usages.data?.items?.[0];
  const sentDate = dayjs(latestUsage?.submittedAt || cv.lastSubmittedAt || cv.createdAt).format('DD/MM/YYYY');

  const jobHref = latestUsage
    ? latestUsage.applicationId
      ? `/candidate/applications/${latestUsage.applicationId}`
      : `/jobs/${latestUsage.jobId}`
    : undefined;

  return (
    <article className="flex flex-wrap items-center gap-[14px] border-0 border-b border-solid border-[#F1F5F9] p-4 transition-colors duration-200 last:border-b-0 hover:bg-[#F8FAFC]/60">
      <span
        aria-hidden
        className="flex h-14 w-11 shrink-0 items-end justify-center rounded border border-solid border-[#CBD5E1] bg-white pb-1.5 text-[10px] font-bold text-[#475569]"
      >
        PDF
      </span>
      <div className="min-w-0 flex-[1_1_200px]">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/candidate/affiliate-cvs/${cv.cvId}`}
            className="truncate text-[15px] font-semibold text-[#1F2937] no-underline transition-colors duration-200 hover:text-[#0369A1]"
          >
            {displayTitle}
          </Link>
        </div>
        <div className="mt-0.5 text-[13px] text-[#4B5563]">
          {latestUsage && jobHref ? (
            <>
              Gửi kèm khi giới thiệu vào{' '}
              <Link to={jobHref} className={`font-medium ${LINK}`}>
                {[latestUsage.jobTitle, latestUsage.companyName].filter(Boolean).join(' – ')}
              </Link>{' '}
              · {sentDate}
            </>
          ) : (
            <>
              Gửi kèm khi được {cv.affiliateDisplayName} giới thiệu · {sentDate}
            </>
          )}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <Link to={`/candidate/affiliate-cvs/${cv.cvId}`} className={ACTION}>
          Xem
        </Link>
        {alreadySaved ? (
          <span className="inline-flex h-10 items-center rounded-md bg-[#DCFCE7] px-3.5 text-[13px] font-semibold text-[#166534]">
            Đã lưu vào kho
          </span>
        ) : (
          canAdopt && (
            <button type="button" disabled={adopting} onClick={onAdopt} className={PRIMARY_ROW_BTN}>
              {adopting ? 'Đang lưu…' : 'Lưu vào kho của tôi'}
            </button>
          )
        )}
      </div>
    </article>
  );
};

export const CandidateAffiliateCvsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canView = hasPermission('cv.view_own');
  const canAdopt = hasPermission('cv.create');
  const myCvs = useCandidateCvs();
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(() => new Set());
  const [adoptingId, setAdoptingId] = useState<string>();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = 10;
  const query = useQuery({
    queryKey: candidateAffiliateCvKeys.list(page),
    queryFn: () => candidateAffiliateCvApi.list(page, pageSize),
    enabled: canView,
    placeholderData: (previous) => previous,
  });

  const adopt = useMutation({
    mutationFn: (cv: CandidateAffiliateCv) => {
      setAdoptingId(cv.cvId);
      return candidateAffiliateCvApi.adopt(cv.cvId, cv.title);
    },
    onSuccess: async (result, cv) => {
      setAdoptedIds((prev) => new Set(prev).add(cv.cvId));
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      message.success(result.data.alreadyAdopted ? 'CV này đã có trong kho cá nhân của bạn.' : result.message || 'Đã lưu vào kho CV của bạn.');
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể nhận CV vào kho cá nhân.')),
    onSettled: () => setAdoptingId(undefined),
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.total ?? items.length;
  const myCvList = myCvs.data ?? [];
  const myCvCount = myCvList.length;

  const isAlreadyInVault = (cv: CandidateAffiliateCv) =>
    adoptedIds.has(cv.cvId) ||
    myCvList.some(
      (mine) =>
        (cv.fileName && mine.fileName && mine.fileName === cv.fileName) ||
        (cv.title && mine.title && mine.title === cv.title)
    );

  return (
    <CandidateAccountFrame>
      <div className="mb-4">
        <h1 className="m-0 mb-1 text-[22px] font-bold text-[#1F2937]">Kho CV</h1>
        <p className="m-0 text-[#4B5563]">
          CV mà Affiliate gửi kèm khi giới thiệu bạn. Bạn có thể giữ lại một bản trong kho của mình để dùng ứng tuyển sau.
        </p>
      </div>

      {!canView && <Alert className="!mb-3" type="error" showIcon message="Bạn không có quyền xem CV do đối tác tuyển dụng gửi." />}

      <nav aria-label="Loại CV" className="mb-3 flex flex-wrap gap-1 border-0 border-b border-solid border-[#E5E7EB]">
        <Link
          to="/candidate/cvs"
          className="relative -mb-px flex h-11 items-center border-0 border-b-2 border-solid border-transparent px-3 text-[#4B5563] no-underline transition-colors duration-200 hover:text-[#075985]"
        >
          <span className="relative inline-flex flex-col items-center">
            <span aria-hidden="true" className="invisible select-none font-semibold">
              CV của tôi ({myCvCount})
            </span>
            <span className="absolute inset-0 flex items-center font-medium">
              CV của tôi ({myCvCount})
            </span>
          </span>
        </Link>
        <span
          aria-current="page"
          className="relative -mb-px flex h-11 items-center border-0 border-b-2 border-solid border-[#0369A1] px-3 font-semibold text-[#075985]"
        >
          CV đối tác gửi kèm giới thiệu ({totalCount})
        </span>
      </nav>

      {!canView ? null : query.isLoading ? (
        <div className={`${CARD} p-4`}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      ) : query.isError ? (
        <Alert type="error" showIcon message="Không tải được danh sách CV" description={getApiErrorMessage(query.error)} />
      ) : items.length === 0 ? (
        <div className={`${CARD} px-6 py-10 text-center`}>
          <h2 className="m-0 text-[16px] font-bold text-[#1F2937]">Chưa có CV nào do đối tác tuyển dụng gửi kèm</h2>
          <p className="m-0 mt-2 text-[#4B5563]">
            Khi một Affiliate giới thiệu bạn vào vị trí tuyển dụng, CV gửi kèm sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className={CARD}>
          {items.map((cv) => (
            <PartnerCvRow
              key={cv.cvId}
              cv={cv}
              canAdopt={canAdopt}
              alreadySaved={isAlreadyInVault(cv)}
              adopting={adoptingId === cv.cvId && adopt.isPending}
              onAdopt={() => adopt.mutate(cv)}
            />
          ))}
        </div>
      )}

      {(query.data?.totalPages ?? 0) > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={query.data?.total ?? 0}
            showSizeChanger={false}
            onChange={(nextPage) => setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })}
          />
        </div>
      )}
    </CandidateAccountFrame>
  );
};

export const CandidateAffiliateCvDetailPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSigned = useOpenSignedUrl();
  const { cvId = '' } = useParams();
  const canView = useAuthStore((state) => state.hasPermission('cv.view_own'));
  const canAdopt = useAuthStore((state) => state.hasPermission('cv.create'));
  const myCvs = useCandidateCvs();

  const detail = useQuery({
    queryKey: candidateAffiliateCvKeys.detail(cvId),
    queryFn: () => candidateAffiliateCvApi.detail(cvId),
    enabled: Boolean(cvId) && canView,
  });

  const previewUrlQuery = useQuery({
    queryKey: candidateAffiliateCvKeys.previewUrl(cvId),
    queryFn: () => candidateAffiliateCvApi.downloadUrl(cvId),
    enabled: Boolean(cvId) && canView && Boolean(detail.data),
    staleTime: 4 * 60_000,
    retry: false,
  });

  const usages = useQuery({
    queryKey: candidateAffiliateCvKeys.usages(cvId, 1),
    queryFn: () => candidateAffiliateCvApi.usages(cvId, 1, 5),
    enabled: Boolean(cvId) && canView,
  });

  const adopt = useMutation({
    mutationFn: () => candidateAffiliateCvApi.adopt(cvId, detail.data?.title),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      message.success(result.data.alreadyAdopted ? 'CV này đã có trong kho cá nhân của bạn.' : result.message);
      navigate('/candidate/cvs');
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể nhận CV vào kho cá nhân.')),
  });

  const backLink = (
    <Link
      to="/candidate/affiliate-cvs"
      className="group inline-flex items-center gap-1 self-start text-[13px] text-[#0369A1] no-underline transition-colors duration-200 hover:text-[#075985] hover:underline"
    >
      <span className="transition-transform duration-200 group-hover:-translate-x-0.5">‹</span>
      <span>Quay lại CV đối tác gửi</span>
    </Link>
  );

  if (!canView) {
    return (
      <div className={`${FONT} flex flex-col gap-4 text-[14px] text-[#1F2937]`}>
        {backLink}
        <Alert type="error" showIcon message="Bạn không có quyền xem CV do đối tác tuyển dụng gửi." />
      </div>
    );
  }

  if (detail.isLoading) {
    return (
      <div className={`${FONT} flex flex-col gap-4 text-[14px] text-[#1F2937]`}>
        {backLink}
        <div className={`${CARD} p-6`}>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className={`${FONT} flex flex-col gap-4 text-[14px] text-[#1F2937]`}>
        {backLink}
        <div className={`${CARD} px-6 py-12 text-center`}>
          <h1 className="m-0 text-[18px] font-bold text-[#1F2937]">Không tải được chi tiết CV</h1>
          <p className="m-0 mt-2 text-[#4B5563]">{getApiErrorMessage(detail.error)}</p>
          <div className="mt-4 flex justify-center gap-2.5">
            <button type="button" onClick={() => detail.refetch()} className={ACTION}>
              Thử lại
            </button>
            <Link to="/candidate/affiliate-cvs" className={ACTION}>
              Về danh sách CV đối tác
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cv = detail.data;
  const fileName = cv.fileName || cv.title || 'CV_DoiTac.pdf';
  const size = fileSize(cv.fileSizeBytes);
  const previewUrl = previewUrlQuery.data?.downloadUrl;
  const latestUsage = usages.data?.items?.[0];
  const sentDate = dayjs(latestUsage?.submittedAt || cv.lastSubmittedAt || cv.createdAt).format('DD/MM/YYYY');
  const alreadyInVault = (myCvs.data ?? []).some(
    (mine) =>
      (cv.fileName && mine.fileName && mine.fileName === cv.fileName) ||
      (cv.title && mine.title && mine.title === cv.title)
  );
  const jobHref = latestUsage
    ? latestUsage.applicationId
      ? `/candidate/applications/${latestUsage.applicationId}`
      : `/jobs/${latestUsage.jobId}`
    : undefined;

  return (
    <div className={`${FONT} flex flex-col gap-3.5 text-[14px] text-[#1F2937] [line-height:normal]`}>
      {backLink}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left Column: PDF Preview Document Sheet */}
        <section aria-label="Xem trước bản CV" className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-0 border-b border-solid border-[#E5E7EB] bg-white px-5 py-3.5">
            <span className="truncate text-[15px] font-bold text-[#1F2937]">{fileName}</span>
            <span className="shrink-0 text-[13px] text-[#6B7280]">Trang 1 / 2</span>
          </div>

          <div className="bg-[#EEF0F4] p-4 sm:p-8">
            {previewUrlQuery.isLoading ? (
              <div className="mx-auto flex min-h-[520px] max-w-[560px] items-center justify-center rounded border border-solid border-[#E2E8F0] bg-white p-8 sm:min-h-[680px]">
                <Skeleton active paragraph={{ rows: 12 }} />
              </div>
            ) : previewUrl ? (
              <div className="mx-auto max-w-[640px] overflow-hidden rounded border border-solid border-[#E2E8F0] bg-white shadow-xs">
                <iframe
                  src={previewUrl}
                  title={`Xem trước ${fileName}`}
                  className="block h-[540px] w-full border-0 bg-white sm:h-[680px]"
                />
              </div>
            ) : (
              <div className="mx-auto flex min-h-[520px] max-w-[560px] flex-col items-center justify-center rounded border border-solid border-[#E2E8F0] bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:min-h-[680px]">
                <span className="text-[13px] text-[#4B5563]">[Trình xem PDF – mở bằng link ký có hạn ngắn]</span>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Thông tin CV & Giữ CV này? */}
        <aside className="flex flex-col gap-4">
          <section aria-labelledby="cv-info-heading" className={`${CARD} p-5`}>
            <h2 id="cv-info-heading" className="m-0 mb-3.5 text-[16px] font-bold text-[#1F2937]">
              Thông tin CV
            </h2>
            <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px]">
              <dt className="text-[#6B7280]">Gửi kèm khi</dt>
              <dd className="m-0 text-[#1F2937]">
                {latestUsage && jobHref ? (
                  <>
                    Giới thiệu vào{' '}
                    <Link to={jobHref} className={`font-medium ${LINK}`}>
                      {[latestUsage.jobTitle, latestUsage.companyName].filter(Boolean).join(' – ')}
                    </Link>
                  </>
                ) : (
                  <>Giới thiệu bởi {cv.affiliateDisplayName}</>
                )}
              </dd>

              <dt className="text-[#6B7280]">Ngày gửi</dt>
              <dd className="m-0 text-[#1F2937]">{sentDate}</dd>

              <dt className="text-[#6B7280]">Kích thước</dt>
              <dd className="m-0 text-[#1F2937]">{size ? `${size} · PDF` : 'PDF'}</dd>

              <dt className="text-[#6B7280]">Trạng thái</dt>
              <dd className="m-0 text-[#1F2937]">
                {alreadyInVault ? 'Đã có trong kho của bạn' : 'Chưa có trong kho của bạn'}
              </dd>
            </dl>
          </section>

          <section aria-labelledby="cv-keep-heading" className={`${CARD} p-5`}>
            <h2 id="cv-keep-heading" className="m-0 text-[16px] font-bold text-[#1F2937]">
              Giữ CV này?
            </h2>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#4B5563]">
              Lưu vào Kho CV để dùng ứng tuyển các việc khác. Bản gốc của đối tác không thay đổi.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {canAdopt && (
                <button
                  type="button"
                  disabled={adopt.isPending || alreadyInVault}
                  onClick={() => adopt.mutate()}
                  className={PRIMARY_BTN}
                >
                  {alreadyInVault ? 'Đã lưu vào kho của tôi' : adopt.isPending ? 'Đang lưu vào kho…' : 'Lưu vào kho của tôi'}
                </button>
              )}
              <button
                type="button"
                onClick={() => openSigned(() => candidateAffiliateCvApi.downloadUrl(cvId))}
                className={SECONDARY_BTN}
              >
                Tải về
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
