import { getAccountById } from "@/features/entities/counterparty-accounts/lib/queries";
import { getCounterpartyById } from "@/features/entities/counterparties/lib/queries";
import { getCurrencyById } from "@/features/entities/currencies/lib/queries";
import { getCustomerById } from "@/features/entities/customers/lib/queries";
import { getProviderById } from "@/features/entities/counterparty-account-providers/lib/queries";
import {
  getDocumentTypeLabel,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { resolveBreadcrumbItems } from "@/lib/breadcrumbs";

type ResourceResolverConfig<TEntity> = {
  singularLabel: string;
  hrefPrefix: string;
  getById: (id: string) => Promise<TEntity | null>;
  getLabel: (entity: TEntity) => string;
  getId: (entity: TEntity) => string;
};

function createResourceSegmentResolver<TEntity>(
  config: ResourceResolverConfig<TEntity>,
) {
  return async ({ segment }: { segment: string }) => {
    const entity = await config.getById(segment);

    if (!entity) {
      return {
        label: config.singularLabel,
        href: `${config.hrefPrefix}/${segment}`,
      };
    }

    return {
      label: config.getLabel(entity),
      href: `${config.hrefPrefix}/${config.getId(entity)}`,
    };
  };
}

function resolvePairSegment({ segment }: { segment: string }) {
  const parts = segment.split("-");
  if (parts.length === 2 && parts[0] && parts[1]) {
    const base = parts[0].toUpperCase();
    const quote = parts[1].toUpperCase();
    return {
      label: `${base} / ${quote}`,
      href: `/fx/rates/${base}-${quote}`,
    };
  }
  return null;
}

const dynamicResolvers = {
  rates: resolvePairSegment,
  counterparties: createResourceSegmentResolver({
    singularLabel: "Контрагент",
    hrefPrefix: "/entities/counterparties",
    getById: getCounterpartyById,
    getLabel: (counterparty) => counterparty.shortName,
    getId: (counterparty) => counterparty.id,
  }),
  customers: createResourceSegmentResolver({
    singularLabel: "Клиент",
    hrefPrefix: "/entities/customers",
    getById: getCustomerById,
    getLabel: (customer) => customer.displayName,
    getId: (customer) => customer.id,
  }),
  currencies: createResourceSegmentResolver({
    singularLabel: "Валюта",
    hrefPrefix: "/entities/currencies",
    getById: getCurrencyById,
    getLabel: (currency) => currency.name,
    getId: (currency) => currency.id,
  }),
  providers: createResourceSegmentResolver({
    singularLabel: "Провайдер",
    hrefPrefix: "/entities/counterparty-account-providers",
    getById: getProviderById,
    getLabel: (provider) => provider.name,
    getId: (provider) => provider.id,
  }),
  accounts: createResourceSegmentResolver({
    singularLabel: "Счёт",
    hrefPrefix: "/entities/counterparty-accounts",
    getById: getAccountById,
    getLabel: (account) => account.label,
    getId: (account) => account.id,
  }),
  documents: async ({ segment }: { segment: string }) => {
    if (!isKnownDocumentType(segment)) {
      return null;
    }

    return {
      label: getDocumentTypeLabel(segment),
      href: `/documents/${segment}`,
    };
  },
  create: async ({ segment, segments }: { segment: string; segments: string[] }) => {
    if (
      segments.length >= 3 &&
      segments[0] === "documents" &&
      isKnownDocumentType(segment)
    ) {
      return {
        label: getDocumentTypeLabel(segment),
        href: `/documents/create/${segment}`,
      };
    }

    return null;
  },
};

interface BreadcrumbSegmentsPageProps {
  params: Promise<{ segments: string[] }>;
}

export default async function BreadcrumbSegmentsPage({
  params,
}: BreadcrumbSegmentsPageProps) {
  const { segments } = await params;

  const items = await resolveBreadcrumbItems(segments, {
    resolvers: dynamicResolvers,
  });

  return <DynamicBreadcrumb items={items} />;
}
