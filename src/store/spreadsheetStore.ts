import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SpreadsheetState {
  byEmail: Record<string, string>;
  setSpreadsheetId: (email: string, id: string) => void;
  clearSpreadsheetId: (email: string) => void;
}

export const useSpreadsheetStore = create<SpreadsheetState>()(
  persist(
    (set) => ({
      byEmail: {},
      setSpreadsheetId: (email, id) => set((s) => ({ byEmail: { ...s.byEmail, [email]: id } })),
      clearSpreadsheetId: (email) =>
        set((s) => {
          const { [email]: _, ...rest } = s.byEmail;
          return { byEmail: rest };
        }),
    }),
    { name: "lealtek:spreadsheets" },
  ),
);
