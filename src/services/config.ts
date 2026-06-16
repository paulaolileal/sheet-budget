/**
 * Configuração centralizada. NÃO espalhar essas chaves por componentes.
 * O spreadsheetId é "segredo de aplicação" — vem de env, nunca hardcoded.
 */

export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID as string | undefined,
  scopes: "https://www.googleapis.com/auth/spreadsheets",
  /** Quando true, usa MockRepository com seed CSV + localStorage. */
  useMock:
    import.meta.env.VITE_USE_MOCK !== "false" &&
    (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_SPREADSHEET_ID),
};
