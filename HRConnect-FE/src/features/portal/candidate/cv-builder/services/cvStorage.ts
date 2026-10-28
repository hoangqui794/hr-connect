/**
 * @file cvStorage.ts
 * @description LocalStorage persistence service for Candidate CV Builder.
 * Synchronizes draft and saved CVs across all candidate spaces (CV Builder, Kho CV, Dashboard).
 */

import type { CandidateCv } from '@/types/api/mf02';
import type { StructuredCvContent } from '@/types/api/cvBuilder';

export const LOCAL_STORAGE_DRAFT_CVS_KEY = 'candidate_draft_cvs';
export const LOCAL_STORAGE_SAVED_CVS_KEY = 'hrconnect_saved_cvs';
export const LOCAL_STORAGE_SINGLE_CV_PREFIX = 'hrconnect_saved_cv_';
export const LOCAL_STORAGE_DRAFT_SINGLE_PREFIX = 'candidate_draft_cv_';
export const CV_STORAGE_EVENT = 'hrconnect_cv_storage_updated';
export const CANDIDATE_CV_UPDATED_EVENT = 'candidate_cv_updated';

export interface StoredCandidateCv {
  cvId: string;
  id?: string;
  title: string;
  name?: string;
  fileName?: string;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  creationMethod: 'PLATFORM_BUILDER' | 'TEMPLATE_FORM';
  fileSizeBytes: number;
  mimeType: string;
  selectedTemplateCode: string;
  accentColor: string;
  fontFamily: string;
  fontSizeScale: string;
  density: string;
  structuredContent: StructuredCvContent;
  isOnlineCv?: boolean;
  fileUrl?: string;
  previewUrl?: string;
}

export interface SaveCvInput {
  cvId?: string | null;
  title: string;
  isPrimary?: boolean;
  selectedTemplateCode?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSizeScale?: string;
  density?: string;
  structuredContent: StructuredCvContent;
}

/**
 * Dispatches both standard and customized events to notify UI components
 * that candidate CVs were updated, created, or deleted.
 */
export function notifyCvStorageUpdated(cvId?: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event(CANDIDATE_CV_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(CV_STORAGE_EVENT, { detail: { cvId } }));
    } catch (err) {
      console.warn('Failed to dispatch CV update event:', err);
    }
  }
}

/**
 * Validates fundamental CV fields (Full Name, Email).
 */
export function validateCvBasics(content: StructuredCvContent): { isValid: boolean; error?: string } {
  if (!content.fullName || !content.fullName.trim()) {
    return { isValid: false, error: 'Vui lòng nhập Họ và tên ứng viên.' };
  }
  if (!content.email || !content.email.trim()) {
    return { isValid: false, error: 'Vui lòng nhập Địa chỉ Email liên hệ.' };
  }
  return { isValid: true };
}

function normalizeStoredCv(item: StoredCandidateCv): StoredCandidateCv {
  if (item && item.structuredContent) {
    const sc = item.structuredContent;
    if (Array.isArray(sc.certificates)) {
      sc.certificates = sc.certificates.map((c: any) =>
        typeof c === 'string' ? c : c?.name ? `${c.name}${c.year ? ` (${c.year})` : ''}` : String(c)
      );
    }
    if (Array.isArray(sc.languages)) {
      sc.languages = sc.languages.map((l: any) =>
        typeof l === 'string' ? l : l?.name ? `${l.name}${l.level ? ` (${l.level})` : ''}` : String(l)
      );
    }
  }
  if (item) {
    if (!item.id && item.cvId) item.id = item.cvId;
    if (!item.name && item.title) item.name = item.title;
    item.isOnlineCv = true;
  }
  return item;
}

/**
 * Read all saved CV drafts from LocalStorage, checking both primary and secondary storage keys.
 */
export function getSavedCvs(): StoredCandidateCv[] {
  if (typeof window === 'undefined') return [];
  try {
    const listMap = new Map<string, StoredCandidateCv>();

    // 1. Read primary key (candidate_draft_cvs)
    const rawPrimary = localStorage.getItem(LOCAL_STORAGE_DRAFT_CVS_KEY);
    if (rawPrimary) {
      try {
        const parsed = JSON.parse(rawPrimary);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            const normalized = normalizeStoredCv(item);
            const id = normalized.cvId || normalized.id;
            if (id) listMap.set(id, normalized);
          });
        }
      } catch (err) {
        console.warn('Failed to parse primary saved CVs from localStorage:', err);
      }
    }

    // 2. Read secondary key (hrconnect_saved_cvs) for backwards/cross compatibility
    const rawSecondary = localStorage.getItem(LOCAL_STORAGE_SAVED_CVS_KEY);
    if (rawSecondary) {
      try {
        const parsed = JSON.parse(rawSecondary);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            const normalized = normalizeStoredCv(item);
            const id = normalized.cvId || normalized.id;
            if (id && !listMap.has(id)) {
              listMap.set(id, normalized);
            }
          });
        }
      } catch (err) {
        console.warn('Failed to parse secondary saved CVs from localStorage:', err);
      }
    }

    return Array.from(listMap.values());
  } catch (err) {
    console.error('Failed to get saved CVs from localStorage:', err);
    return [];
  }
}

/**
 * Retrieve a specific CV by ID.
 */
export function getSavedCvById(cvId: string): StoredCandidateCv | null {
  if (typeof window === 'undefined' || !cvId) return null;
  const cleanId = cvId.trim();
  try {
    // 1. Direct keys
    const directRaw1 = localStorage.getItem(`${LOCAL_STORAGE_SINGLE_CV_PREFIX}${cleanId}`);
    if (directRaw1) {
      return normalizeStoredCv(JSON.parse(directRaw1));
    }
    const directRaw2 = localStorage.getItem(`${LOCAL_STORAGE_DRAFT_SINGLE_PREFIX}${cleanId}`);
    if (directRaw2) {
      return normalizeStoredCv(JSON.parse(directRaw2));
    }

    // 2. From array
    const list = getSavedCvs();
    const found = list.find((item) => item.cvId === cleanId || item.id === cleanId);
    return found ? normalizeStoredCv(found) : null;
  } catch (err) {
    console.error(`Failed to get CV with id ${cleanId}:`, err);
    return null;
  }
}

/**
 * Save or update CV draft in LocalStorage (synchronizes across both storage keys).
 */
export function saveCandidateCv(input: SaveCvInput): StoredCandidateCv {
  const validation = validateCvBasics(input.structuredContent);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Dữ liệu CV chưa hợp lệ.');
  }

  const existingList = getSavedCvs();
  const now = new Date().toISOString();
  const targetId = input.cvId && input.cvId.trim() ? input.cvId.trim() : `cv_builder_${Date.now()}`;
  const existingItem = existingList.find((item) => item.cvId === targetId || item.id === targetId);

  const cleanTitle = (input.title || input.structuredContent.fullName || 'Bản CV Online').trim();
  const templateCode = input.selectedTemplateCode || input.structuredContent.selectedTemplateCode || 'STANDARD';
  const accent = input.accentColor || input.structuredContent.accentColor || '#2563EB';
  const font = input.fontFamily || input.structuredContent.fontFamily || 'Inter';
  const sizeScale = input.fontSizeScale || input.structuredContent.fontSizeScale || 'normal';
  const lineDensity = input.density || input.structuredContent.density || 'normal';

  const isPrimary = input.isPrimary !== undefined
    ? input.isPrimary
    : (existingItem ? existingItem.isPrimary : existingList.length === 0);

  const updatedCv: StoredCandidateCv = {
    cvId: targetId,
    id: targetId,
    title: cleanTitle,
    name: cleanTitle,
    fileName: `${cleanTitle.replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
    isPrimary,
    status: 'READY',
    createdAt: existingItem ? existingItem.createdAt : now,
    updatedAt: now,
    creationMethod: 'PLATFORM_BUILDER',
    fileSizeBytes: 1024 * 75, // ~75KB mock PDF size
    mimeType: 'application/pdf',
    selectedTemplateCode: templateCode,
    accentColor: accent,
    fontFamily: font,
    fontSizeScale: sizeScale,
    density: lineDensity,
    isOnlineCv: true,
    fileUrl: `/candidate/cv-builder/${targetId}`,
    previewUrl: `/candidate/cv-builder/${targetId}`,
    structuredContent: {
      ...input.structuredContent,
      selectedTemplateCode: templateCode,
      accentColor: accent,
      fontFamily: font,
      fontSizeScale: sizeScale as 'small' | 'normal' | 'large',
      density: lineDensity as 'compact' | 'normal' | 'spacious',
    },
  };

  // If set to primary, update others
  let newList: StoredCandidateCv[];
  if (isPrimary) {
    newList = existingList.map((item) =>
      (item.cvId === targetId || item.id === targetId) ? updatedCv : { ...item, isPrimary: false }
    );
  } else {
    newList = existingList.filter((item) => item.cvId !== targetId && item.id !== targetId);
  }

  if (!newList.some((item) => item.cvId === targetId || item.id === targetId)) {
    newList.unshift(updatedCv);
  }

  // Persist synchronously to both storage keys
  try {
    const serializedList = JSON.stringify(newList);
    const serializedItem = JSON.stringify(updatedCv);
    localStorage.setItem(LOCAL_STORAGE_DRAFT_CVS_KEY, serializedList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CVS_KEY, serializedList);
    localStorage.setItem(`${LOCAL_STORAGE_SINGLE_CV_PREFIX}${targetId}`, serializedItem);
    localStorage.setItem(`${LOCAL_STORAGE_DRAFT_SINGLE_PREFIX}${targetId}`, serializedItem);

    notifyCvStorageUpdated(targetId);
  } catch (err) {
    console.error('Failed to write CV to localStorage:', err);
  }

  return updatedCv;
}

/**
 * Delete a CV from LocalStorage.
 */
export function deleteSavedCv(cvId: string): void {
  if (typeof window === 'undefined' || !cvId) return;
  const cleanId = cvId.trim();
  try {
    const list = getSavedCvs().filter((item) => item.cvId !== cleanId && item.id !== cleanId);
    const serializedList = JSON.stringify(list);

    localStorage.setItem(LOCAL_STORAGE_DRAFT_CVS_KEY, serializedList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CVS_KEY, serializedList);
    localStorage.removeItem(`${LOCAL_STORAGE_SINGLE_CV_PREFIX}${cleanId}`);
    localStorage.removeItem(`${LOCAL_STORAGE_DRAFT_SINGLE_PREFIX}${cleanId}`);

    notifyCvStorageUpdated(cleanId);
  } catch (err) {
    console.error(`Failed to delete CV ${cleanId}:`, err);
  }
}

/**
 * Set a CV as primary in LocalStorage.
 */
export function setPrimarySavedCv(cvId: string): void {
  if (typeof window === 'undefined' || !cvId) return;
  const cleanId = cvId.trim();
  try {
    const list = getSavedCvs().map((item) => ({
      ...item,
      isPrimary: item.cvId === cleanId || item.id === cleanId,
    }));
    const serializedList = JSON.stringify(list);

    localStorage.setItem(LOCAL_STORAGE_DRAFT_CVS_KEY, serializedList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CVS_KEY, serializedList);

    const target = list.find((item) => item.cvId === cleanId || item.id === cleanId);
    if (target) {
      const serializedItem = JSON.stringify(target);
      localStorage.setItem(`${LOCAL_STORAGE_SINGLE_CV_PREFIX}${cleanId}`, serializedItem);
      localStorage.setItem(`${LOCAL_STORAGE_DRAFT_SINGLE_PREFIX}${cleanId}`, serializedItem);
    }

    notifyCvStorageUpdated(cleanId);
  } catch (err) {
    console.error(`Failed to set primary CV ${cleanId}:`, err);
  }
}

/**
 * Updates the title of an online CV in LocalStorage.
 */
export function updateSavedCvTitle(cvId: string, newTitle: string): StoredCandidateCv | null {
  if (typeof window === 'undefined' || !cvId) return null;
  const cleanId = cvId.trim();
  const cleanTitle = newTitle.trim();
  try {
    const list = getSavedCvs();
    const target = list.find((item) => item.cvId === cleanId || item.id === cleanId);
    if (!target) return null;

    target.title = cleanTitle;
    target.name = cleanTitle;
    target.fileName = `${cleanTitle.replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
    target.updatedAt = new Date().toISOString();

    const serializedList = JSON.stringify(list);
    const serializedItem = JSON.stringify(target);

    localStorage.setItem(LOCAL_STORAGE_DRAFT_CVS_KEY, serializedList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CVS_KEY, serializedList);
    localStorage.setItem(`${LOCAL_STORAGE_SINGLE_CV_PREFIX}${cleanId}`, serializedItem);
    localStorage.setItem(`${LOCAL_STORAGE_DRAFT_SINGLE_PREFIX}${cleanId}`, serializedItem);

    notifyCvStorageUpdated(cleanId);
    return target;
  } catch (err) {
    console.error(`Failed to update title for CV ${cleanId}:`, err);
    return null;
  }
}

/**
 * Convert StoredCandidateCv to CandidateCv contract for dashboard and list compatibility.
 */
export function mapStoredCvToCandidateCv(stored: StoredCandidateCv): CandidateCv {
  const id = stored.cvId || stored.id || `cv_${Date.now()}`;
  const title = (stored.title || stored.name || 'Bản CV Online').trim();
  const fileUrl = `/candidate/cv-builder/${id}`;

  return {
    cvId: id,
    id,
    title,
    name: title,
    fileName: stored.fileName || `${title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
    mimeType: stored.mimeType || 'application/pdf',
    fileSizeBytes: stored.fileSizeBytes || 76800,
    isPrimary: Boolean(stored.isPrimary),
    status: stored.status || 'READY',
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt || stored.createdAt || new Date().toISOString(),
    submissionUsageCount: 0,
    applicationUsageCount: 0,
    isReferenced: false,
    deleteBehavior: 'HARD_DELETE',
    creationMethod: stored.creationMethod || 'PLATFORM_BUILDER',
    cvTemplateId: stored.selectedTemplateCode || 'STANDARD',
    isOnlineCv: true,
    fileUrl,
    previewUrl: fileUrl,
  };
}

/**
 * Unified cvStorage service object providing standard API.
 */
export const cvStorage = {
  getAll: getSavedCvs,
  getById: getSavedCvById,
  save: saveCandidateCv,
  remove: deleteSavedCv,
  delete: deleteSavedCv,
  setPrimary: setPrimarySavedCv,
  updateTitle: updateSavedCvTitle,
  mapToCandidateCv: mapStoredCvToCandidateCv,
  notifyUpdated: notifyCvStorageUpdated,
};
