export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const competenciaLabel = (c: string) => {
  const [y, m] = c.split("-");
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${months[Number(m) - 1] ?? m}/${y}`;
};

export const shiftCompetencia = (c: string, months: number): string => {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const currentCompetencia = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthRange = (months: number, from = new Date()): string[] => {
  const out: string[] = [];
  const start = new Date(from.getFullYear(), from.getMonth() - months + 1, 1);
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

/** Number of months from `a` to `b` (both YYYY-MM); positive when `b` is later. */
export const monthsBetween = (a: string, b: string): number => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

export const centeredMonthRange = (competencia: string, radius: number): string[] => {
  const year = Number(competencia.slice(0, 4));
  const month = Number(competencia.slice(5));
  const out: string[] = [];
  for (let i = -radius; i <= radius; i++) {
    const d = new Date(year, month - 1 + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};
