import {
  Wallet,
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CircleDollarSign,
  Home,
  Building2,
  Lamp,
  Paintbrush,
  Car,
  Bus,
  Train,
  Bike,
  Fuel,
  Plane,
  Heart,
  Stethoscope,
  Pill,
  Dumbbell,
  Activity,
  UtensilsCrossed,
  Utensils,
  Coffee,
  ShoppingCart,
  ShoppingBag,
  Tv,
  Music,
  Headphones,
  Camera,
  Film,
  Gamepad2,
  GraduationCap,
  BookOpen,
  Briefcase,
  Laptop,
  Monitor,
  Globe,
  Gift,
  Shirt,
  Package,
  Scissors,
  Phone,
  Wrench,
  Zap,
  Baby,
  PawPrint,
  Users,
  Smile,
  Flower2,
  Tag,
  Star,
  Repeat2,
  Sparkles,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { PixIcon } from "@/components/ui/PixIcon";

type IconComponent = ComponentType<LucideProps>;

export const ICON_REGISTRY: Record<string, IconComponent> = {
  // Financeiro
  Wallet,
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CircleDollarSign,
  // PIX (custom)
  Pix: PixIcon as IconComponent,
  // Casa / moradia / decoração
  Home,
  Building2,
  Lamp,
  Paintbrush,
  // Transporte
  Car,
  Bus,
  Train,
  Bike,
  Fuel,
  Plane,
  // Saúde
  Heart,
  Stethoscope,
  Pill,
  Dumbbell,
  Activity,
  // Alimentação
  UtensilsCrossed,
  Utensils,
  Coffee,
  ShoppingCart,
  // Compras
  ShoppingBag,
  Gift,
  Shirt,
  Package,
  Scissors,
  // Entretenimento
  Tv,
  Music,
  Headphones,
  Camera,
  Film,
  Gamepad2,
  // Educação / trabalho
  GraduationCap,
  BookOpen,
  Briefcase,
  Laptop,
  Monitor,
  Globe,
  // Tecnologia / comunicação
  Phone,
  Wrench,
  Zap,
  // Pessoas / família / estética
  Baby,
  PawPrint,
  Users,
  Smile,
  Flower2,
  // Genérico
  Tag,
  Star,
  Repeat2,
  Sparkles,
};

export interface IconEntry {
  id: string;
  component: IconComponent;
}

export const ICON_LIST: IconEntry[] = Object.entries(ICON_REGISTRY).map(([id, component]) => ({
  id,
  component,
}));

export function getIcon(id: string): IconComponent | null {
  return ICON_REGISTRY[id] ?? null;
}
