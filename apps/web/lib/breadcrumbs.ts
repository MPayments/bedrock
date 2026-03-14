import type { AppIconName } from "@/lib/icons";

export type BreadcrumbIconName = AppIconName;

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: BreadcrumbIconName;
};

type SegmentConfig = BreadcrumbItem;

type DynamicBreadcrumbResolverContext = {
  segment: string;
  parentSegment: string;
  segments: string[];
  index: number;
};

type DynamicBreadcrumbResolver = (
  context: DynamicBreadcrumbResolverContext,
) => Promise<BreadcrumbItem | null> | BreadcrumbItem | null;

type DynamicBreadcrumbResolvers = Partial<
  Record<string, DynamicBreadcrumbResolver>
>;

type ResolveBreadcrumbItemsOptions = {
  resolvers?: DynamicBreadcrumbResolvers;
};

const segmentMap: Record<string, SegmentConfig> = {
  treasury: { label: "Казначейство", href: "/treasury", icon: "landmark" },
  fx: { label: "FX", href: "/fx", icon: "currency" },
  transfers: {
    label: "Переводы",
    href: "/documents/transfers",
    icon: "arrow-right-left",
  },
  ifrs: { label: "Учетные документы", href: "/documents/ifrs", icon: "book-open" },
  commercial: {
    label: "Коммерческие документы",
    href: "/documents/commercial",
    icon: "book-open",
  },
  documents: { label: "Документы", href: "/documents", icon: "book-open" },
  settings: { label: "Настройки", href: "/settings", icon: "settings" },
  accounting: { label: "Бухгалтерия", href: "/accounting", icon: "book-open" },
  entities: { label: "Справочники", href: "/entities", icon: "book-open" },
  users: { label: "Пользователи", href: "/users", icon: "users" },

  customers: {
    label: "Клиенты",
    href: "/entities/customers",
    icon: "handshake",
  },
  organizations: {
    label: "Организации",
    href: "/entities/organizations",
    icon: "landmark",
  },
  counterparties: {
    label: "Контрагенты",
    icon: "building-2",
  },
  currencies: {
    label: "Валюты",
    href: "/entities/currencies",
    icon: "dollar-sign",
  },
  requisites: {
    label: "Реквизиты",
    href: "/entities/requisites",
    icon: "wallet",
  },
  "requisite-providers": {
    label: "Провайдеры реквизитов",
    href: "/entities/requisite-providers",
    icon: "vault",
  },
  create: { label: "Создать" },
  type: { label: "Тип" },
  accounts: { label: "Реквизиты", icon: "wallet" },
  operations: { label: "Операции" },
  journal: { label: "Журнал операций" },
  system: { label: "Система", icon: "cpu" },
  profile: { label: "Профиль", href: "/settings/profile" },
  correspondence: { label: "Корреспонденция" },
  reports: { label: "Отчеты" },
  "trial-balance": { label: "ОСВ" },
  "general-ledger": { label: "Главная книга" },
  "balance-sheet": { label: "Бухгалтерский баланс" },
  "income-statement": { label: "ОФР" },
  "cash-flow": { label: "ОДДС" },
  liquidity: { label: "Ликвидность" },
  "fx-revaluation": { label: "Переоценка валюты" },
  "fee-revenue": { label: "Комиссионные доходы" },
  "close-package": { label: "Пакет закрытия" },
  rates: { label: "Курсы", href: "/fx/rates", icon: "chart-candlestick" },
  quotes: { label: "Котировки", href: "/fx/quotes", icon: "ticket-percent" },

  orders: { label: "Ордера" },
  settlements: { label: "Расчетные операции" },
};

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getCounterpartiesListHref(): string {
  return "/entities/counterparties";
}

function getOrganizationsListHref(segments: string[], index: number): string {
  const parentSegments = segments.slice(0, index);
  if (parentSegments.includes("treasury")) {
    return "/treasury/organizations";
  }

  return "/entities/organizations";
}

function resolveStaticSegment(
  segment: string,
  segments: string[],
  index: number,
): BreadcrumbItem | null {
  const config = segmentMap[segment];
  if (!config) {
    return null;
  }

  if (segment === "counterparties") {
    return {
      ...config,
      href: getCounterpartiesListHref(),
    };
  }

  if (segment === "organizations") {
    return {
      ...config,
      href: getOrganizationsListHref(segments, index),
    };
  }

  if (segment === "accounts" && segments.includes("accounting")) {
    return {
      ...config,
      label: "Счета",
      href: "/accounting/accounts",
    };
  }

  return config;
}

export async function resolveBreadcrumbItems(
  segments: string[],
  options: ResolveBreadcrumbItemsOptions = {},
): Promise<BreadcrumbItem[]> {
  return Promise.all(
    segments.map(async (segment, index) => {
      const parentSegment = segments[index - 1];

      if (parentSegment) {
        const resolver = options.resolvers?.[parentSegment];
        if (resolver) {
          const resolved = await resolver({
            segment,
            parentSegment,
            segments,
            index,
          });

          if (resolved) {
            return resolved;
          }
        }
      }

      const staticSegment = resolveStaticSegment(segment, segments, index);
      if (staticSegment) {
        return staticSegment;
      }

      if (parentSegment) {
        return {
          label: "Раздел",
        };
      }

      return {
        label: decodeSegment(segment),
      };
    }),
  );
}
