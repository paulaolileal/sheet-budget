import { Tag, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { getIcon } from "@/utils/iconRegistry";

interface AppIconProps {
  iconId?: string | null;
  fallback?: ComponentType<LucideProps>;
  size?: number;
  className?: string;
}

export function AppIcon({ iconId, fallback: Fallback = Tag, size = 16, className }: AppIconProps) {
  const Icon = iconId ? (getIcon(iconId) ?? Fallback) : Fallback;
  return <Icon size={size} className={className} />;
}
