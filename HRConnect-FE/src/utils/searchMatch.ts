/**
 * Vietnamese-friendly search normalization and matching helpers.
 * Handles diacritics (including đ/Đ), case-insensitivity, and whitespace trimming.
 */

export type SearchableField = string | number | null | undefined;

export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

export function matchesSearch(
  query: string,
  ...fields: SearchableField[]
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  for (const field of fields) {
    if (field === null || field === undefined) continue;
    const text = normalizeSearchText(String(field));
    if (text && text.includes(normalizedQuery)) {
      return true;
    }
  }
  return false;
}

export function filterBySearch<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => SearchableField[]
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items as T[];

  return items.filter((item) => matchesSearch(normalizedQuery, ...getFields(item)));
}
