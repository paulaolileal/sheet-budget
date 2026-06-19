import { CheckCircle2 } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { brl } from "@/utils/format";
import type { AccountTipo } from "@/domain/types";

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

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.round(v * (1 - factor))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function buildCustomStyle(color: string): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color} 0%, ${darken(color, 0.35)} 100%)`,
  };
}

const TIPO_LABEL: Record<AccountTipo, string> = {
  CARTAO: "Fatura",
  CONTA: "Saldo a pagar",
  CARTEIRA: "Saldo",
};

interface CreditCardVisualProps {
  nome: string;
  total: number;
  isPaid: boolean;
  tipo?: AccountTipo;
  iconId?: string;
  extraAmount?: number;
  color?: string;
}

export function CreditCardVisual({
  nome,
  total,
  isPaid,
  tipo = "CARTAO",
  iconId,
  extraAmount,
  color,
}: CreditCardVisualProps) {
  const gradient = pickGradient(nome);
  const label = TIPO_LABEL[tipo];
  const customStyle = color ? buildCustomStyle(color) : undefined;

  return (
    <div
      className={`relative w-full text-white rounded-2xl overflow-hidden select-none${customStyle ? "" : ` bg-gradient-to-br ${gradient}`}`}
      style={{ aspectRatio: "1.586", ...customStyle }}
    >
      {/* decorative circles */}
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute right-2 -bottom-16 w-60 h-60 rounded-full bg-white/[0.07] pointer-events-none" />

      {/* content fills card with even distribution */}
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        {/* top: chip (only for cards) + account icon */}
        <div className="flex items-start justify-between">
          {tipo === "CARTAO" ? (
            <svg width="46" height="36" viewBox="0 0 46 36" fill="none" aria-hidden="true">
              <rect width="46" height="36" rx="5" fill="#d4a843" />
              <rect x="1" y="12" width="44" height="12" fill="#b8922e" />
              <rect x="14" y="1" width="18" height="34" fill="#b8922e" />
              <rect x="14" y="12" width="18" height="12" fill="#c9a33a" />
              <rect x="1" y="12" width="13" height="12" fill="#c8962c" />
              <rect x="32" y="12" width="13" height="12" fill="#c8962c" />
            </svg>
          ) : tipo === "CONTA" ? (
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-60"
              aria-hidden="true"
            >
              <path d="M3 21h18" />
              <path d="M3 10h18" />
              <path d="M5 6l7-3 7 3" />
              <path d="M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" />
            </svg>
          ) : (
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-60"
              aria-hidden="true"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          )}

          <div className="opacity-70">
            {iconId ? (
              <AppIcon iconId={iconId} size={24} className="text-white" />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <circle cx="12" cy="20" r="1" fill="currentColor" />
              </svg>
            )}
          </div>
        </div>

        {/* middle: account name */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest opacity-60 mb-1">
            {label}
          </p>
          <p className="text-base font-bold truncate leading-tight">{nome}</p>
        </div>

        {/* bottom: total + status badge */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] opacity-50 mb-1">Total</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight leading-none">
              {brl(total)}
            </p>
            {extraAmount != null && extraAmount > 0 && (
              <p className="text-xs font-semibold text-amber-300 mt-0.5">
                + {brl(extraAmount)} não catalogado
              </p>
            )}
          </div>
          {isPaid && (
            <div className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 rounded-full px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pago
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
