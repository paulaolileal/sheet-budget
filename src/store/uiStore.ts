import { create } from "zustand";
import { currentCompetencia } from "@/utils/format";

export type SyncState = "idle" | "syncing" | "saved" | "error";

interface UiState {
  competencia: string;
  setCompetencia: (c: string) => void;
  sync: SyncState;
  setSync: (s: SyncState) => void;
  isGenerating: boolean;
  setGenerating: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  competencia: currentCompetencia(),
  setCompetencia: (competencia) => set({ competencia }),
  sync: "idle",
  setSync: (sync) => set({ sync }),
  isGenerating: false,
  setGenerating: (isGenerating) => set({ isGenerating }),
}));
