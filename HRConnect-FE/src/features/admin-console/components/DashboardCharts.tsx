/**
 * @file DashboardCharts.tsx
 * @description Admin overview charts drawn with plain SVG + motion/react (no chart library).
 * Every chart reads real API series; when a period has nothing, it says so instead of drawing
 * empty axes. Points/columns are keyboard reachable (roving tabindex, arrow keys) and focus shows
 * the same tooltip as hover. Amounts are formatted with money() in the API's currency.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { money } from '@/features/finance-mf05/financeLabels';
import type { ActivityPoint, CashflowPoint, RoleBreakdownPoint, RoleCode } from '@/types/api/admin';

const INCOME_COLOR = '#2563EB';
const PAYOUT_COLOR = '#059669';
const NEW_USERS_COLOR = '#059669';
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CHART_HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 8, left: 8 };
/** Used until the container is measured (and in tests, where ResizeObserver does not exist). */
const FALLBACK_WIDTH = 640;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "2026-11-17" → "17/11" without going through Date (the API day is already a Vietnam day). */
export const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const longDay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Short axis label: 1,5 tỷ / 45 tr / 900 k. Tooltips use the full money() value. */
export const compactAmount = (value: number) => {
  const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (value >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${fmt(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${fmt(value / 1_000)} k`;
  return fmt(value);
};

const formatCount = (value: number) => value.toLocaleString('vi-VN');

/** Width of the chart box; charts redraw in real pixels so strokes and dots never stretch. */
const useElementWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

/** Smooth path through the points without overshooting (horizontal-tangent cubic segments). */
const smoothPath = (pts: { x: number; y: number }[]) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const midX = (prev.x + cur.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return d;
};

// ---------------------------------------------------------------------------
// Shared interaction: one focusable target per day, arrow keys move between them
// ---------------------------------------------------------------------------

const useActiveIndex = (count: number) => {
  const [active, setActive] = useState<number | null>(null);
  const targets = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActive((cur) => (cur !== null && cur >= count ? null : cur));
  }, [count]);

  const focusAt = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(count - 1, index));
      setActive(next);
      targets.current[next]?.focus();
    },
    [count]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const moves: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: count - 1,
      };
      if (event.key in moves) {
        event.preventDefault();
        focusAt(moves[event.key]);
      } else if (event.key === 'Escape') {
        setActive(null);
      }
    },
    [count, focusAt]
  );

  return { active, setActive, targets, onKeyDown };
};

/**
 * Splits [0, width] into one band per day around each day's position (point or bar centre), so the
 * day under the cursor is the day that gets highlighted. Edges stretch to the chart borders.
 */
export const hitBands = (centers: number[], width: number) =>
  centers.map((c, i) => {
    const left = i === 0 ? 0 : (centers[i - 1] + c) / 2;
    const right = i === centers.length - 1 ? width : (c + centers[i + 1]) / 2;
    return { left, width: Math.max(0, right - left) };
  });

/** Transparent column per day over the chart: hover, focus and arrow keys all pick the same day. */
const HitLayer: React.FC<{
  centers: number[];
  width: number;
  label: string;
  describe: (index: number) => string;
  interaction: ReturnType<typeof useActiveIndex>;
}> = ({ centers, width, label, describe, interaction }) => {
  const { active, setActive, targets, onKeyDown } = interaction;
  const count = centers.length;
  const bands = hitBands(centers, width);
  const tabStop = active ?? count - 1;

  return (
    <div
      role="group"
      aria-label={`${label}. Dùng phím mũi tên trái/phải để xem từng ngày.`}
      className="absolute inset-0"
      onMouseLeave={() => {
        if (!targets.current.some((el) => el === document.activeElement)) setActive(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(null);
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          ref={(el) => {
            targets.current[index] = el;
          }}
          type="button"
          tabIndex={index === tabStop ? 0 : -1}
          aria-label={describe(index)}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="absolute top-0 h-full cursor-crosshair border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--console-accent)]"
          style={{ left: bands[index].left, width: bands[index].width }}
        />
      ))}
    </div>
  );
};

/** Tooltip card anchored above a day; flips its alignment near the edges so it never overflows. */
const ChartTooltip: React.FC<{ x: number; width: number; children: React.ReactNode }> = ({ x, width, children }) => {
  const align = x < 110 ? 'left' : x > width - 110 ? 'right' : 'center';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1 z-10 min-w-[180px] rounded-xl border border-solid border-black/[0.08] bg-white px-3 py-2 text-xs text-[#111827] shadow-[0_8px_24px_-8px_rgba(17,24,39,0.25)]"
      style={
        align === 'left'
          ? { left: Math.max(0, x - 8) }
          : align === 'right'
            ? { right: Math.max(0, width - x - 8) }
            : { left: x, transform: 'translateX(-50%)' }
      }
    >
      {children}
    </div>
  );
};

const TooltipRow: React.FC<{ label: string; value: string; swatch?: string }> = ({ label, value, swatch }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="flex items-center gap-1.5 text-[#4b5565]">
      {swatch && <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />}
      {label}
    </span>
    <span className="font-mono tabular-nums font-medium text-[#111827]">{value}</span>
  </div>
);

const EmptyChart: React.FC<{ height?: number; message?: string }> = ({ height = CHART_HEIGHT, message = 'Chưa có phát sinh trong kỳ' }) => (
  <div
    className="flex items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-[#F9FAFC] text-[13px] text-[#6b7487]"
    style={{ height }}
  >
    {message}
  </div>
);

const Legend: React.FC<{ items: { label: string; color: string; dashed?: boolean; filled?: boolean }[] }> = ({ items }) => (
  <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-[#4b5565]">
    {items.map((item) => (
      <li key={item.label} className="flex items-center gap-1.5">
        {item.filled ? (
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden />
        ) : (
          <span
            className="h-0 w-4 border-0 border-t-2"
            style={{ borderTopColor: item.color, borderTopStyle: item.dashed ? 'dashed' : 'solid' }}
            aria-hidden
          />
        )}
        {item.label}
      </li>
    ))}
  </ul>
);

const XAxis: React.FC<{ dates: string[] }> = ({ dates }) => {
  if (dates.length === 0) return null;
  const middle = dates[Math.floor((dates.length - 1) / 2)];
  const labels = dates.length > 2 ? [dates[0], middle, dates[dates.length - 1]] : dates;
  return (
    <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-[#6b7487]" aria-hidden>
      {labels.map((d, i) => (
        <span key={`${d}-${i}`}>{shortDay(d)}</span>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cash flow: money in (service + posting fees) vs commission paid out
// ---------------------------------------------------------------------------

export const cashflowIncome = (p: CashflowPoint) => p.serviceFeesPaidAmount + p.postingFeesPaidAmount;

export const CashflowAreaChart: React.FC<{ points: CashflowPoint[]; currencyCode: string }> = ({ points, currencyCode }) => {
  const { ref, width } = useElementWidth<HTMLElement>();
  const reduceMotion = useReducedMotion();
  const gradientId = `cashflow-fill-${useId().replace(/:/g, '')}`;
  const interaction = useActiveIndex(points.length);
  const { active } = interaction;

  const income = useMemo(() => points.map(cashflowIncome), [points]);
  const payouts = useMemo(() => points.map((p) => p.payoutsAmount), [points]);
  const totalIncome = income.reduce((a, b) => a + b, 0);
  const totalPayouts = payouts.reduce((a, b) => a + b, 0);
  const isEmpty = points.length === 0 || points.every((p, i) => income[i] === 0 && p.payoutsAmount === 0 && p.refundsPaidAmount === 0);

  const maxValue = Math.max(1, ...income, ...payouts);
  const plotW = width - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const xAt = (i: number) => (points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (points.length - 1));
  const yAt = (v: number) => PAD.top + (1 - v / maxValue) * plotH;
  const baseline = PAD.top + plotH;

  const incomePts = income.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const payoutPts = payouts.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const incomeLine = smoothPath(incomePts);
  const payoutLine = smoothPath(payoutPts);
  const incomeArea = incomePts.length
    ? `${incomeLine} L ${incomePts[incomePts.length - 1].x} ${baseline} L ${incomePts[0].x} ${baseline} Z`
    : '';

  const draw = reduceMotion
    ? { initial: false as const }
    : {
        initial: { pathLength: 0, opacity: 0.4 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: 0.7, ease: EASE_OUT },
      };

  const summary = `Dòng tiền ${points.length} ngày: tổng thu ${money(totalIncome, currencyCode)}, tổng chi hoa hồng ${money(totalPayouts, currencyCode)}.`;

  const describe = (i: number) => {
    const p = points[i];
    const refund = p.refundsPaidAmount > 0 ? `, hoàn cho Client ${money(p.refundsPaidAmount, currencyCode)}` : '';
    return `${longDay(p.date)}: thu ${money(income[i], currencyCode)}, chi hoa hồng ${money(p.payoutsAmount, currencyCode)}${refund}`;
  };

  return (
    <figure ref={ref} className="m-0" aria-label="Biểu đồ dòng tiền">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legend
          items={[
            { label: 'Thu (phí dịch vụ + phí đăng tin)', color: INCOME_COLOR },
            { label: 'Chi hoa hồng', color: PAYOUT_COLOR, dashed: true },
          ]}
        />
        {!isEmpty && (
          <span className="font-mono text-[11px] tabular-nums text-[#6b7487]" aria-hidden>
            Đỉnh {compactAmount(maxValue)}
          </span>
        )}
      </div>

      {isEmpty ? (
        <EmptyChart />
      ) : (
        <>
          <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
            <svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
              role="img"
              aria-label={summary}
              className="block overflow-visible"
            >
              <title>{summary}</title>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((t) => (
                <line
                  key={t}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={PAD.top + t * plotH}
                  y2={PAD.top + t * plotH}
                  stroke="rgba(17,24,39,0.06)"
                  strokeWidth={1}
                />
              ))}
              <motion.path
                d={incomeArea}
                fill={`url(#${gradientId})`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.25 }}
              />
              <motion.path key={`in-${points.length}`} d={incomeLine} fill="none" stroke={INCOME_COLOR} strokeWidth={2.25} strokeLinecap="round" {...draw} />
              {/* Dashed so the two series differ by more than colour; drawn in by fading, as a dash pattern cannot animate pathLength. */}
              <motion.path
                key={`out-${points.length}`}
                d={payoutLine}
                fill="none"
                stroke={PAYOUT_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
              />
              {active !== null && points[active] && (
                <g aria-hidden>
                  <line
                    x1={xAt(active)}
                    x2={xAt(active)}
                    y1={PAD.top}
                    y2={baseline}
                    stroke="#94A3B8"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <circle cx={xAt(active)} cy={yAt(income[active])} r={4} fill="#fff" stroke={INCOME_COLOR} strokeWidth={2} />
                  <circle cx={xAt(active)} cy={yAt(payouts[active])} r={4} fill="#fff" stroke={PAYOUT_COLOR} strokeWidth={2} />
                </g>
              )}
            </svg>

            <HitLayer centers={points.map((_, i) => xAt(i))} width={width} label="Chi tiết dòng tiền theo ngày" describe={describe} interaction={interaction} />

            {active !== null && points[active] && (
              <ChartTooltip x={xAt(active)} width={width}>
                <div className="mb-1 font-mono font-medium tabular-nums text-[#111827]">{longDay(points[active].date)}</div>
                <TooltipRow label="Tổng thu" value={money(income[active], currencyCode)} swatch={INCOME_COLOR} />
                <TooltipRow label="Chi hoa hồng" value={money(points[active].payoutsAmount, currencyCode)} swatch={PAYOUT_COLOR} />
                {points[active].refundsPaidAmount > 0 && (
                  <TooltipRow label="Hoàn cho Client" value={money(points[active].refundsPaidAmount, currencyCode)} />
                )}
              </ChartTooltip>
            )}
          </div>
          <XAxis dates={points.map((p) => p.date)} />
        </>
      )}
    </figure>
  );
};

// ---------------------------------------------------------------------------
// Activity: audit events and new users per day
// ---------------------------------------------------------------------------

export const ActivityBarChart: React.FC<{ points: ActivityPoint[] }> = ({ points }) => {
  const { ref, width } = useElementWidth<HTMLElement>();
  const reduceMotion = useReducedMotion();
  const interaction = useActiveIndex(points.length);
  const { active } = interaction;
  const height = 160;

  const isEmpty = points.length === 0 || points.every((p) => p.auditEvents === 0 && p.newUsers === 0 && p.approvalsCompleted === 0);
  const maxValue = Math.max(1, ...points.map((p) => Math.max(p.auditEvents, p.newUsers)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(1, Math.min(14, slot * 0.36));
  const gap = Math.min(2, slot * 0.06);
  const baseline = PAD.top + plotH;
  const barH = (v: number) => (v / maxValue) * plotH;
  const slotX = (i: number) => PAD.left + i * slot;
  const center = (i: number) => slotX(i) + slot / 2;

  const totalAudit = points.reduce((a, p) => a + p.auditEvents, 0);
  const totalUsers = points.reduce((a, p) => a + p.newUsers, 0);
  const summary = `Hoạt động ${points.length} ngày: ${formatCount(totalAudit)} sự kiện audit, ${formatCount(totalUsers)} người dùng mới.`;
  const describe = (i: number) => {
    const p = points[i];
    return `${longDay(p.date)}: ${formatCount(p.auditEvents)} sự kiện, ${formatCount(p.newUsers)} người dùng mới, ${formatCount(p.approvalsCompleted)} hồ sơ đã duyệt`;
  };

  return (
    <figure ref={ref} className="m-0" aria-label="Biểu đồ nhịp hoạt động">
      <div className="mb-3">
        <Legend
          items={[
            { label: 'Sự kiện audit', color: INCOME_COLOR, filled: true },
            { label: 'Người dùng mới', color: NEW_USERS_COLOR, filled: true },
          ]}
        />
      </div>
      {isEmpty ? (
        <EmptyChart height={height} />
      ) : (
        <>
          <div className="relative w-full" style={{ height }}>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="block">
              <title>{summary}</title>
              <line x1={PAD.left} x2={width - PAD.right} y1={baseline} y2={baseline} stroke="rgba(17,24,39,0.1)" strokeWidth={1} />
              {active !== null && points[active] && (
                <rect x={slotX(active)} y={PAD.top} width={slot} height={plotH} fill="rgba(37,99,235,0.06)" rx={3} aria-hidden />
              )}
              {points.map((p, i) => {
                const grow = reduceMotion
                  ? { initial: false as const }
                  : {
                      initial: { scaleY: 0 },
                      animate: { scaleY: 1 },
                      transition: { duration: 0.45, ease: EASE_OUT, delay: i * 0.015 },
                    };
                const style = { transformOrigin: 'bottom', transformBox: 'fill-box' as const };
                return (
                  <g key={`${p.date}-${points.length}`}>
                    <motion.rect
                      x={center(i) - barW - gap / 2}
                      y={baseline - barH(p.auditEvents)}
                      width={barW}
                      height={barH(p.auditEvents)}
                      rx={Math.min(2, barW / 2)}
                      fill={INCOME_COLOR}
                      style={style}
                      {...grow}
                    />
                    <motion.rect
                      x={center(i) + gap / 2}
                      y={baseline - barH(p.newUsers)}
                      width={barW}
                      height={barH(p.newUsers)}
                      rx={Math.min(2, barW / 2)}
                      fill={NEW_USERS_COLOR}
                      style={style}
                      {...grow}
                    />
                  </g>
                );
              })}
            </svg>

            <HitLayer centers={points.map((_, i) => center(i))} width={width} label="Chi tiết hoạt động theo ngày" describe={describe} interaction={interaction} />

            {active !== null && points[active] && (
              <ChartTooltip x={center(active)} width={width}>
                <div className="mb-1 font-mono font-medium tabular-nums text-[#111827]">{longDay(points[active].date)}</div>
                <TooltipRow label="Sự kiện audit" value={formatCount(points[active].auditEvents)} swatch={INCOME_COLOR} />
                <TooltipRow label="Người dùng mới" value={formatCount(points[active].newUsers)} swatch={NEW_USERS_COLOR} />
                <TooltipRow label="Hồ sơ đã duyệt" value={formatCount(points[active].approvalsCompleted)} />
              </ChartTooltip>
            )}
          </div>
          <XAxis dates={points.map((p) => p.date)} />
        </>
      )}
    </figure>
  );
};

// ---------------------------------------------------------------------------
// Users by role
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<RoleCode, string> = {
  CANDIDATE: 'Ứng viên',
  AFFILIATE: 'Affiliate',
  CLIENT_COMPANY_USER: 'Doanh nghiệp',
  INTERNAL_HR: 'Internal HR',
  PLATFORM_ADMIN: 'Quản trị viên',
};

const ROLE_COLORS: Record<RoleCode, string> = {
  CANDIDATE: '#2563EB',
  AFFILIATE: '#7C3AED',
  CLIENT_COMPANY_USER: '#059669',
  INTERNAL_HR: '#D97706',
  PLATFORM_ADMIN: '#475569',
};

export const RoleBreakdownBar: React.FC<{ items: RoleBreakdownPoint[] }> = ({ items }) => {
  const reduceMotion = useReducedMotion();
  const total = items.reduce((a, i) => a + i.count, 0);

  if (total === 0) {
    return <EmptyChart height={72} message="Chưa có người dùng theo vai trò" />;
  }

  const percent = (count: number) => Math.round((count / total) * 1000) / 10;

  return (
    <figure className="m-0" aria-label="Phân bổ người dùng theo vai trò">
      <motion.div
        role="img"
        aria-label={items.map((i) => `${ROLE_LABELS[i.role] ?? i.role}: ${formatCount(i.count)}`).join(', ')}
        className="flex h-3 w-full overflow-hidden rounded-full bg-[#ECEFF4]"
        style={{ transformOrigin: 'left' }}
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        {items
          .filter((i) => i.count > 0)
          .map((i) => (
            <span
              key={i.role}
              className="h-full border-0 border-r-2 border-solid border-white last:border-r-0"
              style={{ width: `${(i.count / total) * 100}%`, background: ROLE_COLORS[i.role] ?? '#94A3B8' }}
            />
          ))}
      </motion.div>
      <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.role} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-[#4b5565]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ROLE_COLORS[i.role] ?? '#94A3B8' }} aria-hidden />
              <span className="truncate">{ROLE_LABELS[i.role] ?? i.role}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[#111827]">
              {formatCount(i.count)}
              <span className="ml-1.5 text-[#6b7487]">{percent(i.count).toLocaleString('vi-VN')}%</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
};
