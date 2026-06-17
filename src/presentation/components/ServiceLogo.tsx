import { useState } from "react";
import { AppIcon } from "./AppIcon";

interface ServiceLogoProps {
  logoUrl?: string;
  iconId?: string;
  nome: string;
  size?: number;
  className?: string;
}

function hashColor(text: string): string {
  const COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const idx = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLORS.length;
  return COLORS[idx];
}

export function ServiceLogo({ logoUrl, iconId, nome, size = 40, className }: ServiceLogoProps) {
  const [imgError, setImgError] = useState(false);

  const initial = nome.trim().charAt(0).toUpperCase();
  const colorClass = hashColor(nome);

  const containerStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: 8,
  };

  if (logoUrl && !imgError) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-white border border-border/40 ${className ?? ""}`}
        style={containerStyle}
      >
        <img
          src={logoUrl}
          alt={nome}
          onError={() => setImgError(true)}
          style={{
            width: size - 8,
            height: size - 8,
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  if (iconId) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className ?? ""}`}
        style={containerStyle}
      >
        <AppIcon iconId={iconId} size={Math.round(size * 0.5)} className="text-foreground/70" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center text-white font-semibold ${colorClass} ${className ?? ""}`}
      style={{ ...containerStyle, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  );
}
