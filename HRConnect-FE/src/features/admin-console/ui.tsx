/**
 * @file ui.tsx
 * @description Admin console building blocks ("Slate Command" + soft UI, ui-ux-pro-max):
 * soft surfaces instead of hard borders, coloured initials, status dots with text, pill filters
 * with counts. Colour pairs used for text meet WCAG AA 4.5:1.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { AnimatePresence, animate, motion } from 'motion/react';
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

// Tolerate a missing name (an API row without it) instead of crashing the whole page.
const hash = (s: string) => [...(s ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const initialsOf = (name: string) =>
  (name ?? '')
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
  /** Move the description into a small (i) tooltip after the title instead of a line under it. */
  tip?: boolean;
}> = ({ eyebrow, title, description, actions, tip }) => (
  <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="flex max-w-2xl items-start gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium tracking-[0.01em] text-[color:var(--console-accent-strong)]">{eyebrow}</div>}
        <h1 className="m-0 flex items-center gap-2 text-[26px] font-semibold leading-tight tracking-[-0.015em] text-[#111827]">
          {title}
          {tip && (
            <Tooltip title={description} placement="bottomLeft">
              <button
                type="button"
                aria-label={`Giải thích: ${title}`}
                className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 text-[15px] text-slate-400 transition-colors hover:text-slate-700 focus-visible:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--console-accent)]"
              >
                <InfoCircleOutlined />
              </button>
            </Tooltip>
          )}
        </h1>
        {!tip && <p className="m-0 mt-1.5 text-[14.5px] leading-relaxed text-[#4b5565]">{description}</p>}
      </div>
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

const AnimatedCount: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <>{display}</>;
};

/** Small metric tile for list pages (values are totals from the API). */
export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'neutral', active, onClick }) => {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-[#4b5565]">
          <span className="h-2 w-2 rounded-full" style={{ background: DOT[tone] }} aria-hidden />
          {label}
        </span>
        <AnimatePresence>
          {active && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.16 }}
              className="rounded-full bg-[color:var(--console-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--console-accent-strong)]"
            >
              Đang lọc
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="text-[28px] font-semibold leading-none tabular-nums tracking-[-0.025em] text-[#111827]">
        {typeof value === 'number' ? <AnimatedCount value={value} /> : value}
      </span>
      {hint && <span className="text-xs text-[#6b7487]">{hint}</span>}
    </>
  );

  const baseCls = `admin-surface relative flex w-full flex-col gap-1.5 p-4 text-left transition-[background-color,border-color,box-shadow] duration-150 ${
    onClick
      ? 'cursor-pointer select-none border border-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]'
      : 'border border-solid border-black/[0.08]'
  } ${
    active
      ? 'border-[color:var(--console-accent)] bg-[color:var(--console-accent-soft)]/50 admin-surface--active'
      : onClick
        ? 'border-black/[0.08] bg-white hover:border-black/[0.18] hover:bg-[#F9FAFC]'
        : 'border-black/[0.08] bg-white'
  }`;

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-pressed={Boolean(active)}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={baseCls}
      >
        {content}
      </motion.button>
    );
  }

  return <div className={baseCls}>{content}</div>;
};

/** Pill tabs with counts; keyboard-friendly radio-like buttons. */
/** Status filter. Each pill is at least 44px tall on phones and 36px on wider screens (C-08). */
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
  const pillGroupId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-2 rounded-3xl border border-solid border-black/[0.06] bg-[#ECEFF4] p-1 sm:gap-1 sm:rounded-full">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full border-0 bg-transparent px-3.5 py-1.5 text-[13px] sm:min-h-9 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
              active ? 'text-[#111827]' : 'text-[#4b5565] hover:text-[#111827]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`filter-pill-${pillGroupId}`}
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(17,24,39,0.06)]"
                aria-hidden
              />
            )}
            <span className="relative z-10 inline-flex items-center">
              {o.label}
              {o.count !== undefined && (
                <span className={`ml-1.5 tabular-nums ${active ? 'text-[color:var(--console-accent-strong)]' : 'text-[#6b7487]'}`}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Motion-enabled AntD table body row for smooth data reveal on mount & page/filter changes. */
export const MotionTableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = (props) => {
  const { children, ...rest } = props;
  return (
    <motion.tr
      {...(rest as Record<string, unknown>)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.tr>
  );
};

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
