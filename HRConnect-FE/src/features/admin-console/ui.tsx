/**
 * @file ui.tsx
 * @description Admin console building blocks ("Slate Command" + soft UI, ui-ux-pro-max):
 * soft surfaces instead of hard borders, coloured initials, status dots with text, pill filters
 * with counts. Colour pairs used for text meet WCAG AA 4.5:1.
 */
import React from 'react';
import './admin-console.css';

// Text/background pairs for initials — all ≥ 4.5:1 (dark text on light tint).
const AVATAR_TONES = [
  { bg: '#DCFCE7', fg: '#14532D' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#FCE7F3', fg: '#831843' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#CCFBF1', fg: '#134E4A' },
  { bg: '#F1F5F9', fg: '#1E293B' },
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

export const Initials: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const tone = AVATAR_TONES[hash(name) % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: tone.bg, color: tone.fg, fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  );
};

/** Soft card: white, 16px radius, layered shadow, no hard border. */
export const Surface: React.FC<{ children: React.ReactNode; className?: string; padded?: boolean }> = ({
  children,
  className = '',
  padded = false,
}) => <section className={`admin-surface ${padded ? 'p-6' : ''} ${className}`}>{children}</section>;

export const PageHero: React.FC<{
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-2xl">
      {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--console-accent-strong)]">{eyebrow}</div>}
      <h1 className="m-0 text-[26px] font-bold leading-tight tracking-[-0.01em] text-slate-900">{title}</h1>
      <p className="m-0 mt-1.5 text-[14.5px] leading-relaxed text-slate-600">{description}</p>
    </div>
    {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const DOT: Record<Tone, string> = {
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  neutral: '#94A3B8',
};
const TEXT: Record<Tone, string> = {
  success: '#065F46',
  warning: '#92400E',
  danger: '#991B1B',
  info: '#1E40AF',
  neutral: '#334155',
};

/** Dot + label: colour never carries meaning alone. */
export const StatusDot: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium" style={{ color: TEXT[tone] }}>
    <span className="h-2 w-2 rounded-full" style={{ background: DOT[tone] }} aria-hidden />
    {children}
  </span>
);

/** Small metric tile for list pages (values are totals from the API). */
export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'neutral', active, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={`admin-surface flex w-full flex-col gap-1 border-0 p-4 text-left transition-shadow duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]' : ''
      } ${active ? 'admin-surface--active' : ''}`}
    >
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
        <span className="h-2 w-2 rounded-full" style={{ background: DOT[tone] }} aria-hidden />
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums text-slate-900">{value}</span>
      {hint && <span className="text-xs text-slate-600">{hint}</span>}
    </Tag>
  );
};

/** Pill tabs with counts; keyboard-friendly radio-like buttons. */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-full border-0 px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`ml-1.5 tabular-nums ${active ? 'text-[color:var(--console-accent-strong)]' : 'text-slate-600'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Name + secondary line with initials, for table cells and lists. */
export const PersonCell: React.FC<{ name: string; secondary?: string | null; size?: number }> = ({ name, secondary, size = 36 }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Initials name={name} size={size} />
    <div className="min-w-0">
      <div className="truncate text-[14px] font-semibold text-slate-900">{name}</div>
      {secondary && <div className="truncate text-[12.5px] text-slate-600">{secondary}</div>}
    </div>
  </div>
);
