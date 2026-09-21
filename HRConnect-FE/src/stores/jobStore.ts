import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JobWizardDraft, DEFAULT_WIZARD_DRAFT } from '@/types/job';

interface JobStore {
  draft: JobWizardDraft;
  lastSaved: string | null;
  isDirty: boolean;
  updateStep1: (data: Partial<JobWizardDraft['step1']>) => void;
  updateStep2: (data: Partial<JobWizardDraft['step2']>) => void;
  updateStep3: (data: Partial<JobWizardDraft['step3']>) => void;
  updateStep4: (data: Partial<JobWizardDraft['step4']>) => void;
  setStep: (step: number) => void;
  saveDraft: () => void;
  resetDraft: () => void;
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      draft: DEFAULT_WIZARD_DRAFT,
      lastSaved: null,
      isDirty: false,

      updateStep1: (data) => {
        set((state) => ({
          draft: { ...state.draft, step1: { ...state.draft.step1, ...data } },
          isDirty: true,
        }));
        // Auto-save debounce
        setTimeout(() => get().saveDraft(), 1000);
      },

      updateStep2: (data) => {
        set((state) => ({
          draft: { ...state.draft, step2: { ...state.draft.step2, ...data } },
          isDirty: true,
        }));
        setTimeout(() => get().saveDraft(), 1000);
      },

      updateStep3: (data) => {
        set((state) => ({
          draft: { ...state.draft, step3: { ...state.draft.step3, ...data } },
          isDirty: true,
        }));
        setTimeout(() => get().saveDraft(), 1000);
      },

      updateStep4: (data) => {
        set((state) => ({
          draft: { ...state.draft, step4: { ...state.draft.step4, ...data } },
          isDirty: true,
        }));
        setTimeout(() => get().saveDraft(), 1000);
      },

      setStep: (step) => {
        set((state) => ({ draft: { ...state.draft, step } }));
      },

      saveDraft: () => {
        set({ lastSaved: new Date().toISOString(), isDirty: false });
      },

      resetDraft: () => {
        set({ draft: DEFAULT_WIZARD_DRAFT, lastSaved: null, isDirty: false });
      },
    }),
    {
      name: 'hr-connect-job-draft',
    }
  )
);
