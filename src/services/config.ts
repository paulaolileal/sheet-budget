export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
  scopes: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
};
