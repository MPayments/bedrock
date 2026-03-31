import type {
  AppAudience,
  FeatureFlagMap,
  UserSessionSnapshot,
} from "@/lib/auth/types";
import type { AppIconName } from "@/lib/icons";

export type AppNavIcon = AppIconName;

export type AppNavItem = {
  id: string;
  title: string;
  href: string;
  icon?: AppNavIcon;
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
      icon?: AppNavIcon;
      audience: AppAudience;
      featureFlag?: string;
    }
  | {
      kind: "notifications";
      id: string;
      title: string;
      icon: AppNavIcon;
      audience: AppAudience;
      featureFlag?: string;
    };

const navItems: AppNavItem[] = [
  {
    id: "dashboard",
    title: "Дашборд",
    href: "/",
    icon: "home",
    audience: "shared",
  },
  {
    id: "documents",
    title: "Документы",
    href: "/documents",
    icon: "book-open",
    audience: "shared",
    children: [
      {
        id: "documents-transfers",
        title: "Переводы",
        href: "/documents/transfers",
        icon: "arrow-right-left",
        audience: "shared",
      },
      {
        id: "documents-ifrs",
        title: "Учетные документы",
        href: "/documents/ifrs",
        icon: "book-open",
        audience: "shared",
      },
      {
        id: "documents-commercial",
        title: "Коммерческие документы",
        href: "/documents/commercial",
        icon: "book-open",
        audience: "shared",
      },
      {
        id: "documents-journal",
        title: "Журнал",
        href: "/documents/journal",
        icon: "book-open",
        audience: "shared",
      },
    ],
  },
  {
    id: "treasury",
    title: "Казначейство",
    href: "/treasury",
    icon: "vault",
    audience: "admin",
    children: [
      {
        id: "treasury-organizations",
        title: "Организации",
        href: "/treasury/organizations",
        icon: "landmark",
        audience: "admin",
      },
      {
        id: "treasury-rates",
        title: "Курсы",
        href: "/treasury/rates",
        icon: "chart-candlestick",
        audience: "admin",
      },
      {
        id: "treasury-quotes",
        title: "Котировки",
        href: "/treasury/quotes",
        icon: "ticket-percent",
        audience: "admin",
      },
    ],
  },
  {
    id: "accounting",
    title: "Бухгалтерия",
    href: "/accounting",
    icon: "calculator",
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
        id: "accounting-reports",
        title: "Отчеты",
        href: "/accounting/reports",
        audience: "admin",
      },
    ],
  },
  {
    id: "entities",
    title: "Справочники",
    href: "/entities",
    icon: "book-open",
    audience: "admin",
    children: [
      {
        id: "entities-customers",
        title: "Клиенты",
        href: "/entities/customers",
        icon: "handshake",
        audience: "admin",
      },
      {
        id: "entities-organizations",
        title: "Организации",
        href: "/entities/organizations",
        icon: "landmark",
        audience: "admin",
      },
      {
        id: "entities-counterparties",
        title: "Контрагенты",
        href: "/entities/counterparties",
        icon: "building-2",
        audience: "admin",
      },
      {
        id: "entities-requisites",
        title: "Реквизиты",
        href: "/entities/requisites",
        icon: "wallet",
        audience: "admin",
      },
      {
        id: "entities-requisite-providers",
        title: "Провайдеры реквизитов",
        href: "/entities/requisite-providers",
        icon: "vault",
        audience: "admin",
      },
      {
        id: "entities-currencies",
        title: "Валюты",
        href: "/entities/currencies",
        icon: "currency",
        audience: "admin",
      },
    ],
  },
  {
    id: "users",
    title: "Пользователи",
    href: "/users",
    icon: "users",
    audience: "admin",
  },
  {
    id: "settings",
    title: "Настройки",
    href: "/settings",
    icon: "settings",
    audience: "shared",
    children: [
      {
        id: "settings-profile",
        title: "Профиль",
        href: "/settings/profile",
        icon: "user",
        audience: "shared",
      },
    ],
  },
];

const secondaryItems: AppSecondaryNavItem[] = [
  {
    kind: "notifications",
    id: "notifications",
    title: "Уведомления",
    icon: "bell",
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

  if (item.audience === "shared" || item.audience === "finance") {
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

export function getPrimaryNavigation(
  session: UserSessionSnapshot,
): AppNavItem[] {
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
