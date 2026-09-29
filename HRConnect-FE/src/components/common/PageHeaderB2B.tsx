import React from 'react';

interface PageHeaderB2BProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeaderB2B: React.FC<PageHeaderB2BProps> = ({
  title,
  subtitle,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/80 ${className}`}
    >
      {/* Left: Title, Badge & Subtitle */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-500 max-w-2xl leading-relaxed font-normal">
            {subtitle}
          </div>
        )}
      </div>

      {/* Right: Action Buttons Group */}
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
