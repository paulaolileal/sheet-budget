import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "../components/PageHeader";
import { AccountDialog } from "../components/AccountDialog";
import {
  useAccounts,
  useBulkPayByAccount,
  useDeleteAccount,
  useInvoiceAmounts,
  useSaveInvoiceAmount,
  useTransactions,
} from "@/hooks/queries";
import { brl, competenciaLabel, currentCompetencia } from "@/utils/format";
import type { Account, Transaction } from "@/domain/types";
import { CalendarIcon, ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../components/AppIcon";
import { CreditCardVisual } from "../components/CreditCardVisual";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DerivedFatura {
  key: string;
  payment_account_id: string;
  competencia: string;
  nome: string;
  isPaid: boolean;
  total: number;
  transactions: Transaction[];
  valorReal: number | null;
  extraAmount: number;
}

function addMonths(competencia: string, delta: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.split("-")[0]));

  const selectedYear = Number(value.split("-")[0]);
  const selectedMonth = Number(value.split("-")[1]) - 1;

  const select = (monthIndex: number) => {
    onChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-2 text-base font-semibold px-3">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {competenciaLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => (
            <Button
              key={label}
              variant={year === selectedYear && i === selectedMonth ? "default" : "ghost"}
              size="sm"
              className="text-xs h-8"
              onClick={() => select(i)}
            >
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const TIPO_LABELS: Record<string, string> = {
  CONTA: "Conta bancária",
  CARTAO: "Cartão de crédito",
  CARTEIRA: "Carteira",
};

const MAX_STACK = 2;
const STACK_OFFSET = 10;
const HORZ_INSET = 8;

export function CardsPage() {
  const { data: txs, isLoading } = useTransactions();
  const { data: accounts } = useAccounts();
  const { data: invoiceAmounts } = useInvoiceAmounts();
  const bulkPay = useBulkPayByAccount();
  const deleteAccount = useDeleteAccount();
  const saveInvoiceAmount = useSaveInvoiceAmount();

  const [competencia, setCompetencia] = useState(() => currentCompetencia());
  const [selected, setSelected] = useState<DerivedFatura | null>(null);
  const [confirming, setConfirming] = useState<DerivedFatura | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [editingInvoiceKey, setEditingInvoiceKey] = useState<string | null>(null);
  const [invoiceInputValue, setInvoiceInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => setActiveIndex(0), [competencia]);

  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a])),
    [accounts],
  );

  const invoiceAmountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ia of invoiceAmounts ?? []) {
      map.set(`${ia.payment_account_id}:${ia.competencia}`, ia.valor_real);
    }
    return map;
  }, [invoiceAmounts]);

  const installmentLabels = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of txs ?? []) {
      if (t.tipo_lancamento !== "PARCELADO") continue;
      if (!groups.has(t.descricao)) groups.set(t.descricao, []);
      groups.get(t.descricao)!.push(t);
    }
    const labels = new Map<string, string>();
    for (const group of groups.values()) {
      const sorted = [...group].sort((a, b) => a.competencia.localeCompare(b.competencia));
      sorted.forEach((t, i) => labels.set(t.transaction_id, `(${i + 1}/${sorted.length})`));
    }
    return labels;
  }, [txs]);

  const faturas = useMemo<DerivedFatura[]>(() => {
    const grouped = new Map<string, Transaction[]>();
    for (const t of txs ?? []) {
      if (!t.payment_account_id) continue;
      const key = `${t.payment_account_id}:${t.competencia}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }
    return Array.from(grouped.entries())
      .map(([key, txList]) => {
        const [accountId, comp] = key.split(":");
        const account = accMap[accountId];
        const total = txList.reduce((s, t) => s + t.valor, 0);
        const valorReal = invoiceAmountMap.get(key) ?? null;
        const extraAmount = valorReal != null ? Math.max(0, valorReal - total) : 0;
        return {
          key,
          payment_account_id: accountId,
          competencia: comp,
          nome: `Fatura ${account?.nome ?? accountId} ${comp}`,
          isPaid: txList.every(
            (t) => t.status === "PAGO" || t.status === "ADIANTADO" || t.status === "IGNORADO",
          ),
          total,
          transactions: txList,
          valorReal,
          extraAmount,
        };
      })
      .sort((a, b) => b.competencia.localeCompare(a.competencia));
  }, [txs, accMap, invoiceAmountMap]);

  const allMonths = useMemo(
    () => [...new Set(faturas.map((f) => f.competencia))].sort(),
    [faturas],
  );

  const monthFaturas = useMemo(
    () => faturas.filter((f) => f.competencia === competencia),
    [faturas, competencia],
  );

  const canGoPrev = allMonths.length > 0 && competencia > allMonths[0];

  async function handleSaveInvoiceAmount(fatura: DerivedFatura) {
    const valor = parseFloat(invoiceInputValue.replace(",", "."));
    if (isNaN(valor) || valor < 0) return;
    await saveInvoiceAmount.mutateAsync({
      payment_account_id: fatura.payment_account_id,
      competencia: fatura.competencia,
      valor_real: valor,
    });
    setEditingInvoiceKey(null);
    setInvoiceInputValue("");
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Cartões & Faturas" description="Gerencie faturas e contas de pagamento." />

      <Tabs defaultValue="faturas">
        <TabsList className="mb-6">
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="faturas">
          <div className="flex items-center justify-center gap-1 mb-8">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canGoPrev}
              onClick={() => setCompetencia((c) => addMonths(c, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <MonthPicker value={competencia} onChange={setCompetencia} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCompetencia((c) => addMonths(c, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <div className="w-px h-5 bg-border mx-0.5" />
            <Button
              variant={competencia === currentCompetencia() ? "default" : "ghost"}
              size="sm"
              className="text-xs px-2.5 h-8"
              onClick={() => setCompetencia(currentCompetencia())}
            >
              Hoje
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : monthFaturas.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nenhuma fatura</CardTitle>
                <CardDescription>
                  Não há transações de cartão em {competenciaLabel(competencia)}.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Card stack */}
              <div
                className="relative max-w-sm mx-auto"
                style={{
                  paddingTop: `${(1 / 1.586) * 100}%`,
                  marginBottom: `${Math.min(monthFaturas.length - 1, MAX_STACK) * STACK_OFFSET}px`,
                }}
              >
                {monthFaturas.map((f, i) => {
                  const relIdx = i - activeIndex;
                  if (relIdx > MAX_STACK || relIdx < -1) return null;

                  const account = accMap[f.payment_account_id];
                  const isGone = relIdx < 0;

                  return (
                    <div
                      key={f.key}
                      className="absolute top-0 left-0 right-0 transition-all duration-300 ease-out"
                      style={
                        isGone
                          ? {
                              opacity: 0,
                              transform: "translateY(-16px)",
                              zIndex: 15,
                              pointerEvents: "none",
                            }
                          : {
                              top: `${relIdx * STACK_OFFSET}px`,
                              left: `${relIdx * HORZ_INSET}px`,
                              right: `${relIdx * HORZ_INSET}px`,
                              zIndex: 10 - relIdx,
                            }
                      }
                    >
                      <CreditCardVisual
                        nome={account?.nome ?? "Conta"}
                        total={f.total}
                        isPaid={f.isPaid}
                        tipo={account?.tipo}
                        iconId={account?.icon_id}
                        extraAmount={f.extraAmount}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Carousel navigation */}
              {monthFaturas.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((idx) => idx - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1.5 items-center">
                    {monthFaturas.map((_, i) => (
                      <button
                        key={i}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-200",
                          i === activeIndex
                            ? "bg-foreground w-4"
                            : "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50",
                        )}
                        onClick={() => setActiveIndex(i)}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={activeIndex === monthFaturas.length - 1}
                    onClick={() => setActiveIndex((idx) => idx + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Active card actions */}
              {(() => {
                const f = monthFaturas[activeIndex];
                if (!f) return null;
                const isEditingThis = editingInvoiceKey === f.key;
                return (
                  <div className="space-y-2 max-w-sm mx-auto px-1">
                    {isEditingThis ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Valor real da fatura"
                          value={invoiceInputValue}
                          onChange={(e) => setInvoiceInputValue(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveInvoiceAmount(f);
                            if (e.key === "Escape") {
                              setEditingInvoiceKey(null);
                              setInvoiceInputValue("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 shrink-0"
                          onClick={() => handleSaveInvoiceAmount(f)}
                          disabled={saveInvoiceAmount.isPending}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 shrink-0"
                          onClick={() => {
                            setEditingInvoiceKey(null);
                            setInvoiceInputValue("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : f.valorReal != null ? (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Fatura real:{" "}
                          <span className="font-medium text-foreground">{brl(f.valorReal)}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingInvoiceKey(f.key);
                            setInvoiceInputValue(String(f.valorReal));
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7 text-muted-foreground"
                        onClick={() => {
                          setEditingInvoiceKey(f.key);
                          setInvoiceInputValue("");
                        }}
                      >
                        + Informar valor real da fatura
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelected(f)}
                      >
                        Ver transações
                      </Button>
                      {!f.isPaid && (
                        <Button size="sm" className="flex-1" onClick={() => setConfirming(f)}>
                          Pagar fatura
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contas">
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => {
                setEditingAccount(null);
                setAccountDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova conta
            </Button>
          </div>

          {!accounts || accounts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nenhuma conta cadastrada</CardTitle>
                <CardDescription>Crie contas bancárias, cartões ou carteiras.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Nome
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.account_id} className="border-t">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <AppIcon
                            iconId={a.icon_id}
                            size={15}
                            className="text-muted-foreground shrink-0"
                          />
                          <span className="font-medium">{a.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {TIPO_LABELS[a.tipo] ?? a.tipo}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingAccount(a);
                              setAccountDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-7 w-7",
                              deletingAccountId === a.account_id
                                ? "text-destructive hover:text-destructive"
                                : "text-muted-foreground",
                            )}
                            disabled={deleteAccount.isPending}
                            onClick={async () => {
                              if (deletingAccountId !== a.account_id) {
                                setDeletingAccountId(a.account_id);
                                return;
                              }
                              await deleteAccount.mutateAsync(a.account_id);
                              setDeletingAccountId(null);
                            }}
                            onBlur={() => {
                              if (deletingAccountId === a.account_id) setDeletingAccountId(null);
                            }}
                            title={
                              deletingAccountId === a.account_id ? "Confirmar exclusão" : "Excluir"
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={(o) => {
          setAccountDialogOpen(o);
          if (!o) setEditingAccount(null);
        }}
        account={editingAccount}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
            <DialogDescription>
              {selected &&
                `${selected.transactions.length} transações — total ${brl(selected.total)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {(selected?.transactions ?? []).map((t) => (
                  <tr key={t.transaction_id} className="border-t">
                    <td className="px-3 py-2">
                      {t.descricao}
                      {installmentLabels.has(t.transaction_id) && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {installmentLabels.get(t.transaction_id)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(t.valor)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            {selected && !selected.isPaid && (
              <Button onClick={() => setConfirming(selected)}>Pagar fatura</Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              As transações abaixo serão marcadas como <strong>PAGO</strong>. Itens com status
              ADIANTADO ou IGNORADO não serão alterados.
            </DialogDescription>
          </DialogHeader>
          {confirming &&
            (() => {
              const toChange = confirming.transactions.filter(
                (t) => t.status !== "ADIANTADO" && t.status !== "IGNORADO",
              );
              return toChange.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nenhuma transação será alterada.
                </p>
              ) : (
                <div className="max-h-[240px] overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                          Descrição
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                          Valor
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                          Status atual
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {toChange.map((t) => (
                        <tr key={t.transaction_id} className="border-t">
                          <td className="px-3 py-2">
                            {t.descricao}
                            {installmentLabels.has(t.transaction_id) && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {installmentLabels.get(t.transaction_id)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(t.valor)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{t.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!confirming) return;
                await bulkPay.mutateAsync({
                  payment_account_id: confirming.payment_account_id,
                  competencia: confirming.competencia,
                });
                setConfirming(null);
                setSelected(null);
              }}
              disabled={bulkPay.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
