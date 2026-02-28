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

import type { AppAudience, FeatureFlagMap, UserSessionSnapshot } from "@/lib/auth/types";

export type AppNavItem = {
  id: string;
  title: string;
  href: string;
  icon?: LucideIcon;
  audience: AppAudience;
  requiredPermissions?: string[];
  featureFlag?: string;
  children?: AppNavItem[];
};

export type AppSecondaryNavItem =
  | {
      kind: "link";
      id: string;
      title: string;
      href: string;
      icon?: LucideIcon;
      audience: AppAudience;
      featureFlag?: string;
    }
  | {
      kind: "notifications";
      id: string;
      title: string;
      icon: LucideIcon;
      audience: AppAudience;
      featureFlag?: string;
    };

const navItems: AppNavItem[] = [
  {
    id: "dashboard",
    title: "Дашборд",
    href: "/",
    icon: Home,
    audience: "shared",
  },
  {
    id: "payments",
    title: "Платежи",
    href: "/payments",
    icon: CreditCard,
    audience: "shared",
    children: [
      {
        id: "payments-orders",
        title: "Ордера",
        href: "/payments/orders",
        audience: "shared",
      },
      {
        id: "payments-settlements",
        title: "Расчеты",
        href: "/payments/settlements",
        audience: "shared",
      },
    ],
  },
  {
    id: "transfers",
    title: "Переводы",
    href: "/transfers",
    icon: ArrowRightLeft,
    audience: "shared",
  },
  {
    id: "operations",
    title: "Операции",
    href: "/operations",
    icon: Workflow,
    audience: "shared",
    children: [
      {
        id: "operations-documents",
        title: "Документы",
        href: "/operations",
        icon: BookOpen,
        audience: "shared",
      },
      {
        id: "operations-journal",
        title: "Журнал",
        href: "/operations/journal",
        icon: BookOpen,
        audience: "shared",
      },
    ],
  },
  {
    id: "treasury",
    title: "Казначейство",
    href: "/treasury",
    icon: Vault,
    audience: "admin",
    children: [
      {
        id: "treasury-counterparties",
        title: "Контрагенты",
        href: "/treasury/counterparties",
        icon: Building2,
        audience: "admin",
      },
    ],
  },
  {
    id: "fx",
    title: "FX",
    href: "/fx",
    icon: Currency,
    audience: "admin",
    children: [
      {
        id: "fx-rates",
        title: "Курсы",
        href: "/fx/rates",
        icon: ChartCandlestick,
        audience: "admin",
      },
    ],
  },
  {
    id: "accounting",
    title: "Бухгалтерия",
    href: "/accounting",
    icon: Calculator,
    audience: "admin",
    children: [
      {
        id: "accounting-accounts",
        title: "Счета",
        href: "/accounting/accounts",
        audience: "admin",
      },
      {
        id: "accounting-correspondence",
        title: "Корреспонденция",
        href: "/accounting/correspondence",
        audience: "admin",
      },
      {
        id: "accounting-financial-results",
        title: "Финрез",
        href: "/accounting/financial-results",
        audience: "admin",
      },
    ],
  },
  {
    id: "entities",
    title: "Справочники",
    href: "/entities",
    icon: BookOpen,
    audience: "admin",
    children: [
      {
        id: "entities-customers",
        title: "Клиенты",
        href: "/entities/customers",
        icon: Building2,
        audience: "admin",
      },
      {
        id: "entities-counterparties",
        title: "Контрагенты",
        href: "/entities/counterparties",
        icon: Building2,
        audience: "admin",
      },
      {
        id: "entities-providers",
        title: "Расчетные методы",
        href: "/entities/providers",
        icon: Landmark,
        audience: "admin",
      },
      {
        id: "entities-accounts",
        title: "Счета",
        href: "/entities/accounts",
        icon: Wallet,
        audience: "admin",
      },
      {
        id: "entities-currencies",
        title: "Валюты",
        href: "/entities/currencies",
        icon: Currency,
        audience: "admin",
      },
    ],
  },
];

const secondaryItems: AppSecondaryNavItem[] = [
  {
    kind: "notifications",
    id: "notifications",
    title: "Уведомления",
    icon: Bell,
    audience: "shared",
  },
];

function isFeatureEnabled(flags: FeatureFlagMap, featureFlag?: string) {
  if (!featureFlag) {
    return true;
  }

  return flags[featureFlag] === true;
}

function isItemVisible(
  item: Pick<AppNavItem, "audience" | "featureFlag">,
  session: UserSessionSnapshot,
) {
  if (!isFeatureEnabled(session.featureFlags, item.featureFlag)) {
    return false;
  }

  if (item.audience === "shared" || item.audience === "user") {
    return true;
  }

  return session.role === "admin";
}

function filterNavChildren(
  children: AppNavItem[] | undefined,
  session: UserSessionSnapshot,
) {
  return (children ?? []).filter((item) => isItemVisible(item, session));
}

export function getPrimaryNavigation(session: UserSessionSnapshot): AppNavItem[] {
  return navItems
    .filter((item) => isItemVisible(item, session))
    .map((item) => ({
      ...item,
      children: filterNavChildren(item.children, session),
    }))
    .filter((item) => (item.children?.length ?? 0) > 0 || item.href.length > 0);
}

export function getSecondaryNavigation(
  session: UserSessionSnapshot,
): AppSecondaryNavItem[] {
  return secondaryItems.filter((item) => isItemVisible(item, session));
}
