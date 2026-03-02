export type BreadcrumbIconName =
  | "home"
  | "landmark"
  | "currency"
  | "credit-card"
  | "arrow-right-left"
  | "building-2"
  | "users"
  | "book-open"
  | "dollar-sign"
  | "chart-candlestick"
  | "wallet";

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
  treasury: { label: "Казначейство", icon: "landmark" },
  fx: { label: "FX", icon: "currency" },
  payments: { label: "Платежи", icon: "credit-card" },
  transfers: { label: "Переводы", icon: "arrow-right-left" },
  accounting: { label: "Бухгалтерия", icon: "book-open" },
  entities: { label: "Справочники", icon: "book-open" },

  customers: {
    label: "Клиенты",
    href: "/entities/customers",
    icon: "users",
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
  providers: {
    label: "Расчетные методы",
    href: "/entities/counterparty-account-providers",
    icon: "landmark",
  },
  create: { label: "Создать" },
  accounts: {
    label: "Счета",
    href: "/entities/counterparty-accounts",
    icon: "wallet",
  },
  operations: { label: "Операции" },
  journal: { label: "Журнал операций" },
  correspondence: { label: "Корреспонденция" },
  "financial-results": { label: "Финрез" },
  rates: { label: "Курсы", icon: "chart-candlestick" },
  quotes: { label: "Котировки" },

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

function getCounterpartiesListHref(
  segments: string[],
  index: number,
): string {
  const parentSegments = segments.slice(0, index);
  if (parentSegments.includes("treasury")) {
    return "/treasury/counterparties";
  }

  return "/entities/counterparties";
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

      const config = segmentMap[segment];
      if (config) {
        if (segment === "counterparties") {
          return {
            ...config,
            href: getCounterpartiesListHref(segments, index),
          };
        }

        if (segment === "accounts" && segments.includes("accounting")) {
          return {
            ...config,
            href: "/accounting/accounts",
          };
        }

        return config;
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
