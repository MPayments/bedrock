export type BreadcrumbIconName =
  | "home"
  | "landmark"
  | "currency"
  | "credit-card"
  | "arrow-right-left"
  | "building-2"
  | "book-open"
  | "dollar-sign"
  | "chart-candlestick";

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
  entities: { label: "Справочники", icon: "book-open" },

  customers: {
    label: "Клиенты",
    href: "/treasury/customers",
  },
  organizations: {
    label: "Организации",
    href: "/entities/organizations",
    icon: "building-2",
  },
  currencies: { label: "Валюты", icon: "dollar-sign" },
  accounts: { label: "Счета" },
  operations: { label: "Операции" },

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
