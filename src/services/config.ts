export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID as string,
  scopes: "https://www.googleapis.com/auth/spreadsheets",
};
