import React, { useMemo } from 'react';
import {
  DollarOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  GiftOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ServiceType } from '@/types/job';
import { CompanyLogo } from './CompanyLogo';
import { BookmarkButton } from './BookmarkButton';
import { useSavedJobs } from '@/hooks/useSavedJobs';

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workMode: 'Hybrid' | 'Remote' | 'On-site' | string;
  level: string;
  salaryMin: number;
  salaryMax: number;
  serviceType?: ServiceType | string;
  commissionRate?: number;
  estimatedCommission?: string;
  tags: string[];
  isUrgent?: boolean;
  deadline?: string;
  updatedAt?: string;
  aiMatchScore?: number;
}

export interface JobCardProps {
  job: JobCardData;
  isSaved?: boolean;
  onToggleSave?: (jobId: string, e: React.MouseEvent) => void;
  onViewDetail?: (job: JobCardData) => void;
  onQuickApply?: (job: JobCardData, e: React.MouseEvent) => void;
  className?: string;
}

// Format salary into compact VND (triệu)
export const formatSalaryVND = (min: number, max: number): string => {
  if (!min && !max) return 'Thỏa thuận';
  const minM = Math.round(min / 1000000);
  const maxM = Math.round(max / 1000000);
  if (minM === maxM) return `${minM} Triệu`;
  return `${minM} - ${maxM} Triệu`;
};

/**
 * Standard tag dictionary for fixing typos, normalizing acronyms, and tech stack names
 */
export const TAG_CORRECTION_MAP: Record<string, string> = {
  typescipt: 'TypeScript',
  typescrit: 'TypeScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  javascipt: 'JavaScript',
  js: 'JavaScript',
  useai: 'AI Tools',
  'use ai': 'AI Tools',
  use_ai: 'AI Tools',
  'use-ai': 'AI Tools',
  aitools: 'AI Tools',
  'ai tools': 'AI Tools',
  'ai tool': 'AI Tools',
  'ai/ml': 'AI/ML',
  aiml: 'AI/ML',
  'ai-ml': 'AI/ML',
  ai: 'AI/ML',
  genai: 'Generative AI',
  'gen ai': 'Generative AI',
  'generative ai': 'Generative AI',
  react: 'ReactJS',
  reactjs: 'ReactJS',
  'react.js': 'ReactJS',
  'react native': 'React Native',
  reactnative: 'React Native',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  angular: 'Angular',
  angularjs: 'Angular',
  svelte: 'Svelte',
  redux: 'Redux',
  zustand: 'Zustand',
  tailwind: 'TailwindCSS',
  tailwindcss: 'TailwindCSS',
  'tailwind css': 'TailwindCSS',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  node: 'Node.js',
  express: 'Express.js',
  expressjs: 'Express.js',
  nest: 'NestJS',
  nestjs: 'NestJS',
  java: 'Java',
  'spring boot': 'Spring Boot',
  springboot: 'Spring Boot',
  'java spring boot': 'Java Spring Boot',
  'java spring': 'Java Spring Boot',
  golang: 'Golang',
  go: 'Golang',
  python: 'Python',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  '.net': '.NET',
  dotnet: '.NET',
  'c#': 'C#',
  csharp: 'C#',
  'c++': 'C++',
  cpp: 'C++',
  php: 'PHP',
  laravel: 'Laravel',
  ruby: 'Ruby',
  rails: 'Ruby on Rails',
  'ruby on rails': 'Ruby on Rails',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  snowflake: 'Snowflake',
  bigquery: 'BigQuery',
  spark: 'Apache Spark',
  airflow: 'Apache Airflow',
  kafka: 'Apache Kafka',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  ci_cd: 'CI/CD',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  terraform: 'Terraform',
  helm: 'Helm',
  argocd: 'ArgoCD',
  devops: 'DevOps',
  graphql: 'GraphQL',
  rest: 'REST API',
  'rest api': 'REST API',
  restful: 'RESTful API',
  microservices: 'Microservices',
  'ui/ux': 'UI/UX',
  uiux: 'UI/UX',
  figma: 'Figma',
  agile: 'Agile/Scrum',
  scrum: 'Agile/Scrum',
  'agile/scrum': 'Agile/Scrum',
  okr: 'OKR',
  fulltime: 'Fulltime',
  'full-time': 'Fulltime',
  parttime: 'Parttime',
  'part-time': 'Parttime',
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  'on-site': 'On-site',
  'công nghệ': 'Công nghệ',
  'full time': 'Fulltime',
};

export const normalizeJobTag = (rawTag: string): string => {
  if (!rawTag) return '';
  const trimmed = rawTag.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (TAG_CORRECTION_MAP[lower]) {
    return TAG_CORRECTION_MAP[lower];
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const deduplicateTags = (tags: string[] = []): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeJobTag(tag);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(normalized);
    }
  }
  return result;
};

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isSaved: controlledIsSaved,
  onToggleSave,
  onViewDetail,
  onQuickApply,
  className = '',
}) => {
  const navigate = useNavigate();
  const { isSaved: checkIsSaved, toggleSave } = useSavedJobs();

  // If controlled isSaved is passed, respect it; otherwise use custom hook's real-time state
  const isSaved = controlledIsSaved !== undefined ? controlledIsSaved : checkIsSaved(job.id);

  const isCOD =
    job.serviceType === ServiceType.HEADHUNT_COD ||
    String(job.serviceType).toUpperCase() === 'HEADHUNT_COD' ||
    Boolean(job.estimatedCommission);

  const deadlineText = job.deadline || (job.isUrgent ? 'Còn 3 ngày' : 'Còn 12 ngày');
  const uniqueTags = useMemo(() => deduplicateTags(job.tags), [job.tags]);

  const handleClickCard = () => {
    if (onViewDetail) {
      onViewDetail(job);
    } else {
      navigate(`/jobs/${job.id}`);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSave) {
      onToggleSave(job.id, e);
    } else {
      toggleSave(job.id, job.title);
    }
  };

  return (
    <div
      onClick={handleClickCard}
      className={`group relative flex flex-col justify-between h-full bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-400 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-left ${className}`}
    >
      {/* ── Top Header: Real Company Logo + Title + Company + Bookmark ── */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Real Company Logo (TopCV Standard) */}
            <CompanyLogo
              companyName={job.company}
              logoUrl={job.companyLogo}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-500 truncate hover:text-slate-800 transition-colors">
                {job.company}
              </div>
              <h3 className="line-clamp-2 min-h-[44px] flex items-center font-bold text-slate-900 text-sm sm:text-base leading-snug tracking-tight group-hover:text-blue-600 transition-colors mt-0.5">
                {job.title}
              </h3>
            </div>
          </div>

          {/* Bookmark Button: Tích hợp toggleSave với real-time update & Antd Toast */}
          {onToggleSave ? (
            <button
              type="button"
              onClick={handleBookmark}
              title={isSaved ? 'Bỏ lưu tin' : 'Lưu việc làm'}
              aria-label={isSaved ? 'Bỏ lưu tin' : 'Lưu việc làm'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 border cursor-pointer ${
                isSaved
                  ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200/70 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'
              }`}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-150 ${
                  isSaved ? 'text-rose-500 fill-rose-500 scale-110' : 'text-slate-400 fill-none'
                }`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={isSaved ? 0 : 1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          ) : (
            <BookmarkButton jobId={job.id} jobTitle={job.title} />
          )}
        </div>

        {/* ── Salary Badge (Emerald Green TopCV standard) ── */}
        <div className="mb-2">
          <span className="text-emerald-600 font-bold text-sm bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1.5 shadow-2xs">
            <DollarOutlined className="text-emerald-600 text-xs" />
            {formatSalaryVND(job.salaryMin, job.salaryMax)} / tháng
          </span>
        </div>

        {/* ── Gom cụm Metadata: [Địa điểm • Hình thức • Cấp bậc] trên cùng 1 hàng ── */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap mb-3">
          <span className="truncate max-w-[130px] font-medium">{job.location}</span>
          <span className="text-slate-300">•</span>
          <span>{job.workMode}</span>
          {job.level && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-600">{job.level}</span>
            </>
          )}
        </div>

        {/* ── HR Connect Badges: COD Bounty + AI ATS Match ── */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          {isCOD && (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80">
              <GiftOutlined className="text-amber-600" />
              Thưởng COD: {job.estimatedCommission || `${job.commissionRate || 15}%`}
            </span>
          )}

          {job.aiMatchScore ? (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
              <ThunderboltOutlined className="text-blue-500" />
              AI Match: {job.aiMatchScore}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
              <SafetyCertificateOutlined className="text-indigo-500" />
              Khớp ATS 90%+
            </span>
          )}
        </div>

        {/* ── Deduplicated Skills Tags ── */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {uniqueTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-2xs text-slate-600 bg-slate-100/90 border border-slate-200/70 px-2 py-0.5 rounded-md font-medium group-hover:border-slate-300 transition-colors"
            >
              {tag}
            </span>
          ))}
          {uniqueTags.length > 3 && (
            <span className="text-2xs text-slate-400 px-1 py-0.5 font-medium">
              +{uniqueTags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* ── Footer: Deadline + Quick Actions ── */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 inline-flex items-center gap-1 font-normal">
          <ClockCircleOutlined className="text-slate-400 text-2xs" />
          {deadlineText}
        </span>

        <div className="flex items-center gap-2">
          {onQuickApply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickApply(job, e);
              }}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 rounded-lg transition-colors cursor-pointer"
            >
              Nộp nhanh
            </button>
          )}

          <span className="text-blue-600 font-semibold group-hover:text-blue-700 inline-flex items-center gap-1 transition-colors">
            Chi tiết
            <ArrowRightOutlined className="text-2xs transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
};

export { BookmarkButton };
export default JobCard;
