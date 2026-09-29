import React from 'react';

interface FintechMetricCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  statusBadge?: string;
  statusType?: 'warranty' | 'eligible' | 'paid' | 'neutral' | 'info';
  icon?: React.ReactNode;
  iconColor?: string;
  onClick?: () => void;
  className?: string;
}

export const FintechMetricCard: React.FC<FintechMetricCardProps> = ({
  label,
  value,
  subLabel,
  statusBadge,
  statusType = 'neutral',
  icon,
  iconColor = '#2563eb',
  onClick,
  className = '',
}) => {
  const getBadgeClasses = () => {
    switch (statusType) {
      case 'warranty':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'eligible':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'paid':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'info':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`b2b-card p-5 group cursor-pointer relative overflow-hidden ${className}`}
    >
      {/* Top row: Label & Icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `${iconColor}12`,
              color: iconColor,
              border: `1px solid ${iconColor}25`,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Metric value: large bold charcoal text-slate-900 font-mono */}
      <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono mb-2 whitespace-nowrap tabular-nums currency-kpi">
        {value}
      </div>

      {/* Sub-label & status badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-slate-100 mt-1">
        {subLabel && (
          <span className="text-xs text-slate-500 truncate max-w-[70%] font-normal">
            {subLabel}
          </span>
        )}
        {statusBadge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeClasses()}`}>
            {statusBadge}
          </span>
        )}
      </div>
    </div>
  );
};
