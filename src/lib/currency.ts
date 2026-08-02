export function parseCurrency(raw: string): number {
  // Handles "20,9" (BR decimal) and plain "20.9"
  return Number(raw.trim().replace(/\./g, "").replace(",", ".")) || 0;
}
