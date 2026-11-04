import React from 'react';
import { CheckOutlined } from '@ant-design/icons';

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

// The shell's top bar already shows the page title, so the h1 stays for screen readers only.
export const AffiliatePageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <header className="affiliate-page-header">
    <div className="affiliate-page-header__copy">
      <h1 className="sr-only">{title}</h1>
      <p>{description}</p>
    </div>
    {actions ? <div className="affiliate-page-header__actions">{actions}</div> : null}
  </header>
);

const TONE_CHIP: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-orange-50 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-50 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  neutral: 'bg-gray-100 text-gray-700',
};

export const StatusChip: React.FC<{ tone?: string; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${TONE_CHIP[tone] ?? TONE_CHIP.neutral}`}>{children}</span>
);

export const AffiliateSectionHeading: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="affiliate-section-heading">
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    {action}
  </div>
);

export const AffiliateStatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  color?: string;
  softColor?: string;
}> = ({ label, value, hint, icon, color = '#0369A1', softColor = '#eff6ff' }) => (
  <article
    className="affiliate-stat-card"
    style={{ '--stat-color': color, '--stat-soft': softColor } as React.CSSProperties}
  >
    <span className="affiliate-stat-card__icon" aria-hidden>{icon}</span>
    <span className="affiliate-stat-card__label">{label}</span>
    <span className="affiliate-stat-card__value">{value}</span>
    <span className="affiliate-stat-card__hint">{hint}</span>
  </article>
);

export const AffiliateFlowSteps: React.FC<{ active?: 1 | 2 | 3 }> = ({ active = 1 }) => {
  const steps = [
    { title: 'Chọn việc làm', desc: 'Chọn cơ hội tuyển dụng' },
    { title: 'Thông tin & CV', desc: 'Hồ sơ ứng viên giới thiệu' },
    { title: 'Xác nhận giới thiệu', desc: 'Kiểm tra và gửi yêu cầu' },
  ];

  return (
    <div className="mb-6 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm" aria-label="Các bước giới thiệu ứng viên">
      <div className="relative flex items-center justify-between">
        {/* Continuous connecting line */}
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />

        {steps.map((step, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          const isDone = number < active;
          const isCurrent = number === active;

          return (
            <div
              key={step.title}
              className="relative z-10 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white px-2 sm:px-3"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  isDone
                    ? 'bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50'
                    : isCurrent
                    ? 'bg-sky-700 text-white shadow-sm ring-4 ring-sky-50'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {isDone ? <CheckOutlined className="text-white text-xs sm:text-sm" /> : number}
              </span>
              <div className="text-center sm:text-left">
                <div
                  className={`text-xs sm:text-sm font-semibold leading-tight ${
                    isCurrent ? 'text-sky-700' : isDone ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-400 mt-0.5">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
