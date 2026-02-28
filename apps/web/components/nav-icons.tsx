import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  ChartCandlestick,
  CreditCard,
  Currency,
  Home,
  Landmark,
  Vault,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { AppNavIcon } from "@/lib/navigation/config";

const navIconMap: Record<AppNavIcon, LucideIcon> = {
  "arrow-right-left": ArrowRightLeft,
  bell: Bell,
  "book-open": BookOpen,
  "building-2": Building2,
  calculator: Calculator,
  "chart-candlestick": ChartCandlestick,
  "credit-card": CreditCard,
  currency: Currency,
  home: Home,
  landmark: Landmark,
  vault: Vault,
  wallet: Wallet,
  workflow: Workflow,
};

export function resolveNavIcon(icon?: AppNavIcon): LucideIcon | undefined {
  if (!icon) {
    return undefined;
  }

  return navIconMap[icon];
}
