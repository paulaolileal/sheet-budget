import { CheckCircle2 } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { brl } from "@/utils/format";

const GRADIENTS = [
  "from-slate-700 to-slate-900",
  "from-indigo-700 to-violet-900",
  "from-emerald-600 to-teal-900",
  "from-rose-600 to-red-900",
  "from-amber-600 to-orange-800",
  "from-cyan-600 to-blue-900",
];

function pickGradient(nome: string): string {
  const idx = nome.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

interface CreditCardVisualProps {
  nome: string;
  total: number;
  isPaid: boolean;
  iconId?: string;
}

export function CreditCardVisual({ nome, total, isPaid, iconId }: CreditCardVisualProps) {
  const gradient = pickGradient(nome);

  return (
    <div
      className={`relative w-full bg-gradient-to-br ${gradient} text-white rounded-2xl p-5 overflow-hidden select-none`}
      style={{ aspectRatio: "1.586" }}
    >
      {/* decorative circle */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -right-4 -bottom-10 w-52 h-52 rounded-full bg-white/5" />

      {/* top row */}
      <div className="relative flex items-start justify-between mb-auto">
        {/* chip SVG */}
        <svg width="32" height="24" viewBox="0 0 32 24" fill="none" aria-hidden="true">
          <rect width="32" height="24" rx="4" fill="#d4a843" />
          <rect x="1" y="8" width="30" height="8" fill="#b8922e" />
          <rect x="10" y="1" width="12" height="22" fill="#b8922e" />
          <rect x="10" y="8" width="12" height="8" fill="#c9a33a" />
        </svg>

        <div className="flex items-center gap-1.5 opacity-80">
          {iconId ? (
            <AppIcon iconId={iconId} size={18} className="text-white/90" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="opacity-80"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
          )}
        </div>
      </div>

      {/* account name */}
      <div className="relative mt-6 mb-2">
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">Fatura</p>
        <p className="text-sm font-semibold truncate text-white/90">{nome}</p>
      </div>

      {/* bottom row: total + status */}
      <div className="relative flex items-end justify-between">
        <div>
          <p className="text-xs text-white/50 mb-0.5">Total</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{brl(total)}</p>
        </div>
        {isPaid && (
          <div className="flex items-center gap-1 text-xs font-medium bg-white/20 rounded-full px-2.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Pago
          </div>
        )}
      </div>
    </div>
  );
}
