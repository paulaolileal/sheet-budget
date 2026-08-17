/**
 * Pure amortization math — no domain types, no I/O. Consumed by
 * `src/domain/purchasePlanning.ts` to simulate a purchase plan's installment schedule.
 */

export type AmortizationMethodInput = "PRICE" | "SAC" | "SEM_JUROS";
export type RatePeriodicityInput = "MENSAL" | "ANUAL";

export interface AmortizationInstallment {
  /** 1-based installment number. */
  numero_parcela: number;
  valor_parcela: number;
  juros: number;
  amortizacao: number;
  /** Remaining balance after this installment is paid. */
  saldo_devedor: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Converts a user-entered rate to its monthly-effective equivalent. Annual rates compound monthly. */
export function toMonthlyRate(taxa: number, periodicidade: RatePeriodicityInput): number {
  if (periodicidade === "MENSAL") return taxa;
  return Math.pow(1 + taxa, 1 / 12) - 1;
}

/** Forces the last row to zero out the residual balance left by per-row rounding. */
function closeResidual(
  rows: AmortizationInstallment[],
  principal: number,
): AmortizationInstallment[] {
  if (rows.length === 0) return rows;
  const last = rows[rows.length - 1];
  const saldoAntes = rows.length >= 2 ? rows[rows.length - 2].saldo_devedor : principal;
  const amortizacao = round2(saldoAntes);
  const valor_parcela = round2(last.juros + amortizacao);
  rows[rows.length - 1] = { ...last, amortizacao, valor_parcela, saldo_devedor: 0 };
  return rows;
}

/** French system (Price table): fixed installment, decreasing interest, increasing amortization. */
export function buildPriceTable(
  principal: number,
  taxaMensal: number,
  n: number,
): AmortizationInstallment[] {
  if (n <= 0 || principal <= 0) return [];
  if (taxaMensal === 0) return buildLinearTable(principal, n);

  const fator = Math.pow(1 + taxaMensal, n);
  const parcelaFixa = round2((principal * (taxaMensal * fator)) / (fator - 1));

  const rows: AmortizationInstallment[] = [];
  let saldo = principal;
  for (let i = 1; i <= n; i++) {
    const juros = round2(saldo * taxaMensal);
    const amortizacao = round2(parcelaFixa - juros);
    saldo = round2(saldo - amortizacao);
    rows.push({
      numero_parcela: i,
      valor_parcela: parcelaFixa,
      juros,
      amortizacao,
      saldo_devedor: saldo,
    });
  }
  return closeResidual(rows, principal);
}

/** Constant amortization (SAC): fixed amortization, decreasing interest and installment. */
export function buildSacTable(
  principal: number,
  taxaMensal: number,
  n: number,
): AmortizationInstallment[] {
  if (n <= 0 || principal <= 0) return [];
  if (taxaMensal === 0) return buildLinearTable(principal, n);

  const amortizacaoFixa = round2(principal / n);
  const rows: AmortizationInstallment[] = [];
  let saldo = principal;
  for (let i = 1; i <= n; i++) {
    const juros = round2(saldo * taxaMensal);
    const amortizacao = i === n ? round2(saldo) : amortizacaoFixa;
    saldo = round2(saldo - amortizacao);
    const valor_parcela = round2(amortizacao + juros);
    rows.push({ numero_parcela: i, valor_parcela, juros, amortizacao, saldo_devedor: saldo });
  }
  return rows;
}

/** No-interest linear split — same math as today's simple "parcelado" flow, used as a baseline. */
export function buildLinearTable(principal: number, n: number): AmortizationInstallment[] {
  if (n <= 0 || principal <= 0) return [];

  const parcela = round2(principal / n);
  const rows: AmortizationInstallment[] = [];
  let saldo = principal;
  for (let i = 1; i <= n; i++) {
    const amortizacao = i === n ? round2(saldo) : parcela;
    saldo = round2(saldo - amortizacao);
    rows.push({
      numero_parcela: i,
      valor_parcela: amortizacao,
      juros: 0,
      amortizacao,
      saldo_devedor: saldo,
    });
  }
  return rows;
}

export function buildAmortizationTable(params: {
  principal: number;
  taxaMensal: number;
  parcelas: number;
  metodo: AmortizationMethodInput;
}): AmortizationInstallment[] {
  const { principal, taxaMensal, parcelas, metodo } = params;
  switch (metodo) {
    case "PRICE":
      return buildPriceTable(principal, taxaMensal, parcelas);
    case "SAC":
      return buildSacTable(principal, taxaMensal, parcelas);
    case "SEM_JUROS":
      return buildLinearTable(principal, parcelas);
  }
}

/** Sum of all `juros` rows — the total interest paid over the whole schedule. */
export function totalInterest(rows: AmortizationInstallment[]): number {
  return round2(rows.reduce((sum, r) => sum + r.juros, 0));
}
