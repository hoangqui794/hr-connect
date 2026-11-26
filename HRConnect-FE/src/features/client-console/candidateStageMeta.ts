/**
 * @file candidateStageMeta.ts
 * @description Canonical 5-step hiring pipeline metadata and stage-grouping helpers
 * for the Client Candidates view so high-volume application lists are scannable at a glance.
 */

export type HiringStageKey = 'review' | 'shortlisted' | 'interview' | 'offer' | 'placed' | 'closed';

export interface HiringStageMeta {
  key: HiringStageKey;
  /** 1..5 for active/completed pipeline steps, 0 for stopped/terminal applications. */
  step: number;
  total: 5;
  /** Canonical ordering from top of funnel (1) to hired (5) to stopped (6). */
  order: number;
  /** Badge text rendered on each row (e.g. "Bước 3 · Phỏng vấn"). */
  stageLabel: string;
  /** Compact stage name (e.g. "Phỏng vấn"). */
  shortLabel: string;
  /** Section header title used when grouping rows by stage on the "Tất cả" tab. */
  groupHeading: string;
  /** Tailwind classes for the stage pill badge. */
  badgeClass: string;
  /** Accent hex color for the dot and mini 5-segment progress bar. */
  barColor: string;
  /** Tailwind classes for the grouped section header strip. */
  groupHeaderClass: string;
}

const STAGE_GROUPS: Record<HiringStageKey, Omit<HiringStageMeta, 'stageLabel'>> = {
  review: {
    key: 'review',
    step: 1,
    total: 5,
    order: 1,
    shortLabel: 'Sàng lọc CV',
    groupHeading: 'Bước 1/5 · Cần xem & Sàng lọc CV',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    barColor: '#0284c7',
    groupHeaderClass: 'bg-sky-50/80 text-sky-900 border-sky-200/80',
  },
  shortlisted: {
    key: 'shortlisted',
    step: 2,
    total: 5,
    order: 2,
    shortLabel: 'Đã chọn CV',
    groupHeading: 'Bước 2/5 · Đã chọn chờ phỏng vấn',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    barColor: '#4f46e5',
    groupHeaderClass: 'bg-indigo-50/80 text-indigo-900 border-indigo-200/80',
  },
  interview: {
    key: 'interview',
    step: 3,
    total: 5,
    order: 3,
    shortLabel: 'Phỏng vấn',
    groupHeading: 'Bước 3/5 · Phỏng vấn & Dự phòng',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    barColor: '#7c3aed',
    groupHeaderClass: 'bg-purple-50/80 text-purple-900 border-purple-200/80',
  },
  offer: {
    key: 'offer',
    step: 4,
    total: 5,
    order: 4,
    shortLabel: 'Offer',
    groupHeading: 'Bước 4/5 · Thư mời nhận việc (Offer)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    barColor: '#d97706',
    groupHeaderClass: 'bg-amber-50/80 text-amber-950 border-amber-200/80',
  },
  placed: {
    key: 'placed',
    step: 5,
    total: 5,
    order: 5,
    shortLabel: 'Đã đi làm',
    groupHeading: 'Bước 5/5 · Đã đi làm thành công',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    barColor: '#16a34a',
    groupHeaderClass: 'bg-emerald-50/80 text-emerald-950 border-emerald-200/80',
  },
  closed: {
    key: 'closed',
    step: 0,
    total: 5,
    order: 6,
    shortLabel: 'Dừng tuyển',
    groupHeading: 'Dừng tuyển (Không đạt · Rút đơn · Nghỉ việc)',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    barColor: '#94a3b8',
    groupHeaderClass: 'bg-slate-100/90 text-slate-700 border-slate-200',
  },
};

export const STAGE_GROUP_ORDER: HiringStageKey[] = [
  'review',
  'shortlisted',
  'interview',
  'offer',
  'placed',
  'closed',
];

/** Maps any recruitment application status code to its canonical 5-step pipeline metadata. */
export const stageMetaOf = (status?: string | null): HiringStageMeta => {
  const s = (status ?? '').trim().toUpperCase();
  if (s === 'SUBMITTED' || s === 'SCREENING') {
    return {
      ...STAGE_GROUPS.review,
      stageLabel: s === 'SUBMITTED' ? 'Bước 1 · Mới nộp' : 'Bước 1 · Sàng lọc CV',
    };
  }
  if (s === 'SHORTLISTED') {
    return {
      ...STAGE_GROUPS.shortlisted,
      stageLabel: 'Bước 2 · Đã chọn CV',
    };
  }
  if (s === 'INTERVIEW' || s === 'BACKUP') {
    return {
      ...STAGE_GROUPS.interview,
      stageLabel: s === 'BACKUP' ? 'Bước 3 · Dự phòng' : 'Bước 3 · Phỏng vấn',
    };
  }
  if (s === 'OFFER_PENDING' || s === 'OFFER_ACCEPTED') {
    return {
      ...STAGE_GROUPS.offer,
      stageLabel: s === 'OFFER_ACCEPTED' ? 'Bước 4 · Đã nhận Offer' : 'Bước 4 · Chờ Offer',
    };
  }
  if (s === 'PLACED') {
    return {
      ...STAGE_GROUPS.placed,
      stageLabel: 'Bước 5 · Đã đi làm',
    };
  }
  return {
    ...STAGE_GROUPS.closed,
    stageLabel: 'Dừng tuyển',
  };
};

export interface StageApplicationGroup<T> {
  key: HiringStageKey;
  meta: Omit<HiringStageMeta, 'stageLabel'>;
  items: T[];
}

/**
 * Groups an application list into ordered hiring stages (Bước 1 -> Bước 5 -> Dừng tuyển),
 * omitting empty stages while preserving each stage's internal row order.
 */
export const groupApplicationsByStage = <T extends { status: string }>(
  items: readonly T[]
): StageApplicationGroup<T>[] => {
  const buckets = new Map<HiringStageKey, T[]>();
  for (const item of items) {
    const key = stageMetaOf(item.status).key;
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return STAGE_GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    meta: STAGE_GROUPS[key],
    items: buckets.get(key)!,
  }));
};
