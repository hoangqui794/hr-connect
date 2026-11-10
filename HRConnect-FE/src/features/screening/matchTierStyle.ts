/**
 * Colour of each AI match tier, as the topic form fixes it: >=80 red heart, 70-79 teal, 60-69 light green,
 * <60 grey. Tier codes follow match_tier_config (HIGH, MEDIUM_HIGH, MEDIUM, LOW).
 */
export type MatchTierCode = 'HIGH' | 'MEDIUM_HIGH' | 'MEDIUM' | 'LOW';

export interface MatchTierStyle {
  label: string;
  /** Badge classes (background, text, border). */
  badge: string;
  /** Score bar fill. */
  bar: string;
  /** Score number colour. */
  text: string;
  /** Shown before the label of the top tier. */
  heart: boolean;
}

export const MATCH_TIER_STYLE: Record<MatchTierCode, MatchTierStyle> = {
  HIGH: { label: 'Rất phù hợp', badge: 'bg-rose-50 text-rose-700 border-rose-200/80', bar: 'bg-rose-500', text: 'text-rose-700', heart: true },
  MEDIUM_HIGH: { label: 'Khá phù hợp', badge: 'bg-teal-50 text-teal-800 border-teal-200/80', bar: 'bg-teal-500', text: 'text-teal-700', heart: false },
  MEDIUM: { label: 'Phù hợp một phần', badge: 'bg-lime-50 text-lime-800 border-lime-200/80', bar: 'bg-lime-400', text: 'text-lime-700', heart: false },
  LOW: { label: 'Ít phù hợp', badge: 'bg-slate-100 text-slate-600 border-slate-200/80', bar: 'bg-slate-400', text: 'text-slate-600', heart: false },
};

/** Tier from the stored code, or from the score when the code is missing (same bands as the seed). */
export const matchTierOf = (score: number | null | undefined, code?: string | null): MatchTierCode | null => {
  const c = code?.toUpperCase();
  if (c && c in MATCH_TIER_STYLE) return c as MatchTierCode;
  if (score == null) return null;
  return score >= 80 ? 'HIGH' : score >= 70 ? 'MEDIUM_HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';
};
