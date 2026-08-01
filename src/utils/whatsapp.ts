import type { Debt } from "@/domain/types";
import { brl } from "./format";

export function buildChargeMessage(
  debtorNome: string,
  debts: Pick<Debt, "descricao" | "valor">[],
): string {
  const lines = debts.map((d) => `- ${d.descricao}: ${brl(d.valor)}`);
  const total = debts.reduce((sum, d) => sum + d.valor, 0);
  return [
    `Oi ${debtorNome}! Segue o que está pendente:`,
    "",
    ...lines,
    "",
    "──────────",
    `Total: ${brl(total)}`,
  ].join("\n");
}

export function whatsappChargeUrl(telefone: string, message: string): string {
  const digits = telefone.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
