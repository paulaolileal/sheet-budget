import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createWorker } from "tesseract.js";
import { Loader2 } from "lucide-react";
import { TransactionDialog } from "../components/TransactionDialog";
import { takeReceipt } from "@/lib/receiptStore";
import { parseNubankReceipt } from "@/lib/receiptParser";

type ReceiptDraft = {
  descricao?: string;
  valor?: number;
  competencia?: string;
  status?: "PAGO";
};

/**
 * Landing page for the Android Web Share Target flow: `src/sw.ts` stashes the
 * shared receipt image in IndexedDB and redirects here with `?receiptId=`.
 * We read the image back, run on-device OCR (tesseract.js), pull out
 * valor/descrição/competência for the Nubank layout (`parseNubankReceipt`),
 * and open the normal `TransactionDialog` pre-filled — the user still picks
 * categoria/conta and confirms before anything is saved.
 */
export function ShareTargetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const receiptId = searchParams.get("receiptId");
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [draft, setDraft] = useState<ReceiptDraft | undefined>(undefined);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!receiptId) {
      navigate("/transactions", { replace: true });
      return;
    }

    (async () => {
      const blob = await takeReceipt(receiptId);
      if (!blob) {
        setState("error");
        return;
      }

      const worker = await createWorker("por");
      try {
        const {
          data: { text },
        } = await worker.recognize(blob);
        const parsed = parseNubankReceipt(text);
        setDraft({
          descricao: parsed.descricao,
          valor: parsed.valor,
          competencia: parsed.competencia,
          status: "PAGO",
        });
        setState("ready");
      } finally {
        await worker.terminate();
      }
    })().catch(() => setState("error"));
  }, [receiptId, navigate]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Lendo comprovante…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Não consegui ler esse comprovante. Você pode criar o lançamento manualmente.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline underline-offset-4"
          onClick={() => navigate("/transactions", { replace: true })}
        >
          Voltar para lançamentos
        </button>
      </div>
    );
  }

  return (
    <TransactionDialog
      open
      draft={draft}
      onOpenChange={(open) => {
        if (!open) navigate("/transactions", { replace: true });
      }}
    />
  );
}
