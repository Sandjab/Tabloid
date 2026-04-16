import { create } from 'zustand';
import type { Relation, Table } from '@/types/schema';
import type { BaselineSource } from '@/types/diff';

export interface DiffBaseline {
  tables: Table[];
  relations: Relation[];
  source: BaselineSource;
}

interface DiffStoreState {
  baseline: DiffBaseline | null;
  setBaseline: (baseline: DiffBaseline) => void;
  clearBaseline: () => void;
}

export const useDiffStore = create<DiffStoreState>((set) => ({
  baseline: null,
  setBaseline: (baseline) => set({ baseline }),
  clearBaseline: () => set({ baseline: null }),
}));
