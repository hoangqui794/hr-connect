/** Candidate-facing, explainable job recommendations. */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Skeleton, Tag } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { CandidateJobMatchFeed } from '@/types/api/candidateJobMatch';
import CompanyLogo from '@/components/common/CompanyLogo';
import { CandidateSurface } from './CandidateUi';

interface CandidateJobMatchesSectionProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
  viewAllLink?: string;
}

export const formatMatchScore = (rawScore: number): number => {
  if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) return 0;
  if (rawScore > 0 && rawScore <= 1) return Math.round(rawScore * 100);
  return Math.min(100, Math.max(0, Math.round(rawScore)));
};

export const getMatchScoreConfig = (scorePercent: number) => {
  if (scorePercent >= 80) return { label: 'Rất phù hợp', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800', barClass: 'bg-emerald-500' };
  if (scorePercent >= 70) return { label: 'Khá phù hợp', badgeClass: 'border-sky-200 bg-sky-50 text-sky-800', barClass: 'bg-sky-500' };
  return { label: 'Có tiềm năng', badgeClass: 'border-amber-200 bg-amber-50 text-amber-800', barClass: 'bg-amber-500' };
};

const formatSalary = (min?: number | null, max?: number | null, negotiable?: boolean, currency = 'VND') => {
  if (negotiable && min == null && max == null) return 'Lương thương lượng';
  if (min == null && max == null) return 'Chưa công bố mức lương';
  const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const symbol = currency === 'VND' ? '₫' : currency;
  if (min != null && max != null) return `${formatter.format(min)} – ${formatter.format(max)} ${symbol}`;
  if (min != null) return `Từ ${formatter.format(min)} ${symbol}`;
  return `Đến ${formatter.format(max!)} ${symbol}`;
};

export const CandidateJobMatchesSection: React.FC<CandidateJobMatchesSectionProps> = ({ limit, showHeader = true, className = '', viewAllLink }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = AntApp.useApp();
  const query = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    staleTime: 5 * 60 * 1000,
  });
  const feed = query.data ?? { items: [], meta: { hasPrimaryCv: true, lastGeneratedAt: null, scoringVersion: 'HYBRID_V1' } };
  const displayedMatches = limit ? feed.items.slice(0, limit) : feed.items;

  const dismissMutation = useMutation({
    mutationFn: candidateJobMatchApi.dismissJobMatch,
    onSuccess: (_, matchId) => {
      queryClient.setQueryData<CandidateJobMatchFeed>(['candidate-job-matches'], (current) =>
        current ? { ...current, items: current.items.filter((item) => item.candidateJobMatchId !== matchId) } : current
      );
      message.success('Đã ẩn gợi ý.');
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể ẩn gợi ý. Vui lòng thử lại.')),
  });

  const confirmDismiss = (matchId: string, title: string) => {
    modal.confirm({
      title: 'Ẩn gợi ý việc làm này?',
      content: `“${title}” sẽ không còn xuất hiện trong danh sách hiện tại.`,
      okText: 'Ẩn gợi ý',
      cancelText: 'Giữ lại',
      okButtonProps: { danger: true },
      onOk: () => dismissMutation.mutateAsync(matchId),
    });
  };

  if (query.isLoading) {
    return (
      <section aria-busy="true" aria-label="Đang tìm việc làm phù hợp" className={`space-y-4 ${className}`}>
        <span className="sr-only">Đang phân tích các cơ hội phù hợp với hồ sơ của bạn.</span>
        {[0, 1].map((item) => <CandidateSurface key={item} className="p-6"><Skeleton active avatar paragraph={{ rows: 4 }} /></CandidateSurface>)}
      </section>
    );
  }

  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Chưa tải được việc làm phù hợp"
        description={getApiErrorMessage(query.error, 'Kết nối đang gián đoạn. Bạn có thể thử tải lại ngay.')}
        action={<Button onClick={() => query.refetch()}>Tải lại</Button>}
        className={`rounded-2xl ${className}`}
      />
    );
  }

  if (feed.items.length === 0) {
    const needsCv = !feed.meta.hasPrimaryCv;
    return (
      <CandidateSurface className={`px-7 py-10 text-center sm:px-12 ${className}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-solid border-blue-100 bg-blue-50 text-blue-700">
          {needsCv ? <FolderOpenOutlined className="text-2xl" /> : <ThunderboltFilled className="text-2xl" />}
        </div>
        <h3 className="mb-2 mt-5 text-xl font-bold tracking-tight text-slate-950">
          {needsCv ? 'Chọn CV chính để nhận gợi ý' : 'Chúng tôi đang tìm cơ hội phù hợp cho bạn'}
        </h3>
        <p className="mx-auto mb-6 max-w-xl text-sm leading-6 text-slate-600">
          {needsCv
            ? 'CV chính giúp hệ thống hiểu kỹ năng và kinh nghiệm của bạn. Hồ sơ không cần bật công khai để sử dụng tính năng này.'
            : 'Hiện chưa có công việc nào vượt ngưỡng phù hợp. Bạn vẫn có thể khám phá toàn bộ việc làm hoặc cập nhật hồ sơ nghề nghiệp.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="primary" size="large" icon={needsCv ? <FolderOpenOutlined /> : <ArrowRightOutlined />} onClick={() => navigate(needsCv ? '/candidate/cvs' : '/candidate/jobs?tab=all')} className="rounded-xl bg-blue-600 font-semibold">
            {needsCv ? 'Đến kho CV' : 'Xem tất cả việc làm'}
          </Button>
          <Button size="large" onClick={() => navigate('/candidate/profile')} className="rounded-xl font-semibold">Cập nhật hồ sơ</Button>
        </div>
      </CandidateSurface>
    );
  }

  return (
    <section className={`space-y-5 ${className}`} aria-labelledby="candidate-job-match-title">
      {showHeader && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="candidate-job-match-title" className="m-0 text-2xl font-bold tracking-tight text-slate-950">Việc làm phù hợp với bạn</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{feed.items.length} gợi ý</span>
            </div>
            <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">
              Dựa trên CV chính, kỹ năng và mong muốn nghề nghiệp. Điểm phù hợp là thông tin tham khảo, không phải quyết định tuyển dụng.
            </p>
          </div>
          {viewAllLink && feed.items.length > (limit || 0) && (
            <Button type="link" onClick={() => navigate(viewAllLink)} className="h-auto p-0 font-bold text-blue-700">Xem tất cả gợi ý <ArrowRightOutlined /></Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {displayedMatches.map((match) => {
          const score = formatMatchScore(match.matchScore);
          const scoreConfig = getMatchScoreConfig(score);
          const reasons = match.matchingReasons ?? [];
          const gaps = match.missingRequirements ?? [];
          return (
            <article key={match.candidateJobMatchId} className="group min-w-0 overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_20px_44px_-28px_rgba(37,99,235,0.4)]">
              <div className={`h-1.5 w-full ${scoreConfig.barClass}`} aria-hidden="true" />
              <div className="p-5 sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <CompanyLogo companyName={match.companyName} logoUrl={match.companyLogoUrl ?? undefined} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="m-0 line-clamp-2 text-lg font-bold leading-6 text-slate-950">{match.jobTitle}</h3>
                        <p className="mb-0 mt-1 truncate text-sm font-medium text-slate-600">{match.companyName}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-solid px-3 py-1.5 text-xs font-extrabold ${scoreConfig.badgeClass}`}>
                        <ThunderboltFilled aria-hidden="true" />{match.matchTierLabel || scoreConfig.label} · {score}%
                      </span>
                    </div>
                    <p className="mb-0 mt-3 text-base font-bold text-blue-800">{formatSalary(match.salaryMin, match.salaryMax, match.salaryNegotiable, match.currencyCode)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><EnvironmentOutlined />{match.location || 'Địa điểm linh hoạt'}</span>
                  {match.employmentType && <span className="inline-flex items-center gap-1.5"><ClockCircleOutlined />{match.employmentType}</span>}
                  {match.applicationDeadline && <span className="inline-flex items-center gap-1.5"><CalendarOutlined />Hạn {new Date(match.applicationDeadline).toLocaleDateString('vi-VN')}</span>}
                </div>

                {reasons.length > 0 && (
                  <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3.5">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><SafetyCertificateOutlined className="text-emerald-600" /> Vì sao công việc này phù hợp</p>
                    <div className="flex flex-wrap gap-2">
                      {reasons.slice(0, 3).map((reason) => <Tag key={reason} className="m-0 whitespace-normal rounded-lg border-emerald-100 bg-white px-2.5 py-1 text-emerald-800">{reason}</Tag>)}
                    </div>
                  </div>
                )}

                {gaps.length > 0 && (
                  <details className="mt-3 rounded-xl border border-solid border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                    <summary className="cursor-pointer font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Điểm bạn nên xem thêm ({gaps.length})</summary>
                    <ul className="mb-0 mt-2 space-y-1 pl-5 leading-6">{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
                  </details>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><InfoCircleOutlined /> Cập nhật {new Date(match.generatedAt).toLocaleDateString('vi-VN')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<CloseOutlined />} disabled={dismissMutation.isPending} onClick={() => confirmDismiss(match.candidateJobMatchId, match.jobTitle)} aria-label={`Ẩn gợi ý ${match.jobTitle}`} className="rounded-xl">Ẩn gợi ý</Button>
                    <Button type="primary" onClick={() => navigate(`/candidate/jobs/${match.jobId}`)} className="rounded-xl bg-blue-600 font-bold">Xem việc làm <ArrowRightOutlined /></Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CandidateJobMatchesSection;
