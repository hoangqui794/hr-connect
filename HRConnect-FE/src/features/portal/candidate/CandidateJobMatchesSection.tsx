/**
 * @file CandidateJobMatchesSection.tsx
 * @description Component displaying AI-suggested job matches for the authenticated Candidate (SF-07).
 * Endpoint: GET /api/v1/candidates/me/job-matches
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  AimOutlined,
  ArrowRightOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { CandidateJobMatchDto } from '@/types/api/candidateJobMatch';
import { CandidateSurface } from './CandidateUi';

const { Text, Title, Paragraph } = Typography;

interface CandidateJobMatchesSectionProps {
  /** Maximum number of items to show (useful when embedding in dashboard overview). Omit for all. */
  limit?: number;
  /** Whether to show full header banner. */
  showHeader?: boolean;
  /** Custom class name */
  className?: string;
  /** Optional callback or view all link */
  viewAllLink?: string;
}

/** Formats match score into an integer percentage string (e.g. 83%). */
export const formatMatchScore = (rawScore: number): number => {
  if (typeof rawScore !== 'number' || isNaN(rawScore)) return 0;
  // If score is normalized between 0 and 1
  if (rawScore > 0 && rawScore <= 1) {
    return Math.round(rawScore * 100);
  }
  return Math.min(100, Math.max(0, Math.round(rawScore)));
};

/** Returns styling and label based on match score percentage. */
export const getMatchScoreConfig = (scorePercent: number) => {
  if (scorePercent >= 80) {
    return {
      label: 'Rất phù hợp',
      color: 'emerald',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      tagColor: '#059669',
    };
  }
  if (scorePercent >= 65) {
    return {
      label: 'Phù hợp tốt',
      color: 'blue',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
      tagColor: '#2563eb',
    };
  }
  return {
    label: 'Tiềm năng',
    color: 'amber',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    tagColor: '#d97706',
  };
};

export const CandidateJobMatchesSection: React.FC<CandidateJobMatchesSectionProps> = ({
  limit,
  showHeader = true,
  className = '',
  viewAllLink,
}) => {
  const navigate = useNavigate();

  const {
    data: matches = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache since backend updates hourly
  });

  const displayedMatches = limit ? matches.slice(0, limit) : matches;

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không thể tải danh sách việc làm phù hợp"
        description={getApiErrorMessage(error, 'Vui lòng kiểm tra lại kết nối mạng.')}
        className="rounded-2xl"
      />
    );
  }

  // ── Empty State ──
  if (matches.length === 0) {
    return (
      <CandidateSurface className={`p-8 text-center sm:p-10 ${className}`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
          <AimOutlined className="text-3xl" />
        </div>

        <h3 className="mb-2 mt-4 text-xl font-bold text-slate-900">
          Chưa có việc làm phù hợp được gợi ý
        </h3>

        <Paragraph className="mx-auto mb-6 max-w-lg text-slate-600">
          <strong>Bật hồ sơ công khai và đặt CV chính</strong> để hệ thống AI tự động phân tích và
          gợi ý những cơ hội việc làm sát nhất với năng lực của bạn.
        </Paragraph>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="primary"
            icon={<IdcardOutlined />}
            size="large"
            onClick={() => navigate('/candidate/profile')}
            className="rounded-xl bg-blue-600 font-semibold"
          >
            Hồ sơ cá nhân
          </Button>

          <Button
            icon={<FolderOpenOutlined />}
            size="large"
            onClick={() => navigate('/candidate/cvs')}
            className="rounded-xl font-semibold"
          >
            Kho CV & Đặt CV chính
          </Button>
        </div>

        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-xl border border-solid border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-500">
          <InfoCircleOutlined className="text-slate-400" />
          <span>Dữ liệu gợi ý được hệ thống tính toán định kỳ (~1 giờ/lần) từ Backend.</span>
        </div>
      </CandidateSurface>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-xl font-bold tracking-tight text-slate-900">
                Việc làm phù hợp với bạn
              </h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                {matches.length} gợi ý
              </span>
            </div>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              Được AI tính toán dựa trên kỹ năng trong CV chính của bạn. Cập nhật định kỳ ~1 giờ/lần.
            </p>
          </div>

          {viewAllLink && matches.length > (limit || 0) && (
            <Button
              type="link"
              onClick={() => navigate(viewAllLink)}
              className="font-bold text-blue-600 hover:text-blue-700"
            >
              Xem tất cả {matches.length} việc phù hợp <ArrowRightOutlined />
            </Button>
          )}
        </div>
      )}

      {/* Grid of matched jobs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {displayedMatches.map((match) => {
          const scorePercent = formatMatchScore(match.matchScore);
          const scoreConfig = getMatchScoreConfig(scorePercent);

          return (
            <div
              key={match.candidateJobMatchId}
              onClick={() => navigate(`/candidate/jobs/${match.jobId}`)}
              className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-solid border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div>
                {/* Header: Score Tag */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="m-0 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                      {match.jobTitle}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
                      <BankOutlined className="text-slate-400" />
                      <span className="truncate">{match.companyName}</span>
                    </div>
                  </div>

                  {/* Highlighted Match Score Badge */}
                  <div
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-solid px-3 py-1 text-xs font-extrabold shadow-sm ${scoreConfig.badgeClass}`}
                  >
                    <ThunderboltFilled />
                    <span>Phù hợp {scorePercent}%</span>
                  </div>
                </div>

                {/* Location and Info */}
                <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <EnvironmentOutlined className="text-slate-400" />
                    <span>{match.location || 'Toàn quốc'}</span>
                  </div>

                  {match.expiresAt && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <CalendarOutlined />
                      <span>
                        Hạn: {new Date(match.expiresAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Footer Actions */}
              <div className="mt-5 flex items-center justify-between border-0 border-t border-solid border-slate-100 pt-3">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {scoreConfig.label}
                </span>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition-colors group-hover:text-blue-700">
                  Xem chi tiết <ArrowRightOutlined className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateJobMatchesSection;
