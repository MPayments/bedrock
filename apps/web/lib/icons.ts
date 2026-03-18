import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  ChartCandlestick,
  Cpu,
  CreditCard,
  Currency,
  DollarSign,
  Home,
  Landmark,
  Settings,
  TicketPercent,
  Users,
  Vault,
  Wallet,
  Workflow,
  Handshake,
  type LucideIcon,
  User,
} from "lucide-react";

const appIconMap = {
  "arrow-right-left": ArrowRightLeft,
  bell: Bell,
  "book-open": BookOpen,
  "building-2": Building2,
  calculator: Calculator,
  "chart-candlestick": ChartCandlestick,
  "credit-card": CreditCard,
  currency: Currency,
  "dollar-sign": DollarSign,
  home: Home,
  landmark: Landmark,
  settings: Settings,
  "ticket-percent": TicketPercent,
  users: Users,
  vault: Vault,
  wallet: Wallet,
  workflow: Workflow,
  cpu: Cpu,
  handshake: Handshake,
  user: User,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof appIconMap;

export function resolveAppIcon(icon?: AppIconName): LucideIcon | undefined {
  if (!icon) {
    return undefined;
  }

  return appIconMap[icon];
}
