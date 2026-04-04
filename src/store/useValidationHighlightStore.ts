import { create } from 'zustand';

export interface HighlightTarget {
  tableId: string;
  columnId?: string;
  severity: 'error' | 'warning';
}

interface ValidationHighlightState {
  highlights: HighlightTarget[];
  activeWarningKey: string | null;

  setHighlights: (targets: HighlightTarget[], key: string) => void;
  clearHighlights: () => void;
}

export const useValidationHighlightStore = create<ValidationHighlightState>(
  (set, get) => ({
    highlights: [],
    activeWarningKey: null,

    setHighlights: (targets, key) => {
      if (get().activeWarningKey === key) {
        set({ highlights: [], activeWarningKey: null });
        return;
      }
      set({ highlights: targets, activeWarningKey: key });
    },

    clearHighlights: () => set({ highlights: [], activeWarningKey: null }),
  }),
);
