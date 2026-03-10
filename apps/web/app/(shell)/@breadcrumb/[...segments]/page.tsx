import { getCounterpartyById } from "@/features/entities/counterparties/lib/queries";
import { getCurrencyById } from "@/features/entities/currencies/lib/queries";
import { getCustomerById } from "@/features/entities/customers/lib/queries";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";
import { getRequisiteProviderById } from "@/features/entities/requisite-providers/lib/queries";
import { getRequisiteById } from "@/features/entities/requisites/lib/queries";
import {
  getDocumentTypeLabel,
  getDocumentsWorkspaceFamilyLabel,
  isDocumentsWorkspaceFamily,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import {
  buildDocumentCreateHref,
  buildDocumentTypeHref,
  buildDocumentsFamilyHref,
} from "@/features/documents/lib/routes";
import { getUserById } from "@/app/(shell)/users/lib/queries";
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
      href: `/treasury/fx/rates/${base}-${quote}`,
    };
  }

  return null;
}

const dynamicResolvers = {
  rates: resolvePairSegment,
  counterparties: createResourceSegmentResolver({
    singularLabel: "Контрагент",
    hrefPrefix: "/entities/parties/counterparties",
    getById: getCounterpartyById,
    getLabel: (counterparty) => counterparty.shortName,
    getId: (counterparty) => counterparty.id,
  }),
  customers: createResourceSegmentResolver({
    singularLabel: "Клиент",
    hrefPrefix: "/entities/parties/customers",
    getById: getCustomerById,
    getLabel: (customer) => customer.displayName,
    getId: (customer) => customer.id,
  }),
  organizations: createResourceSegmentResolver({
    singularLabel: "Организация",
    hrefPrefix: "/entities/parties/organizations",
    getById: getOrganizationById,
    getLabel: (organization) => organization.shortName,
    getId: (organization) => organization.id,
  }),
  currencies: createResourceSegmentResolver({
    singularLabel: "Валюта",
    hrefPrefix: "/entities/currencies",
    getById: getCurrencyById,
    getLabel: (currency) => currency.name,
    getId: (currency) => currency.id,
  }),
  requisites: createResourceSegmentResolver({
    singularLabel: "Реквизит",
    hrefPrefix: "/entities/parties/requisites",
    getById: getRequisiteById,
    getLabel: (requisite) => requisite.label,
    getId: (requisite) => requisite.id,
  }),
  "requisite-providers": createResourceSegmentResolver({
    singularLabel: "Провайдер реквизитов",
    hrefPrefix: "/entities/parties/requisite-providers",
    getById: getRequisiteProviderById,
    getLabel: (provider) => provider.name,
    getId: (provider) => provider.id,
  }),
  documents: async ({ segment }: { segment: string }) => {
    if (!isDocumentsWorkspaceFamily(segment)) {
      return null;
    }

    return {
      label: getDocumentsWorkspaceFamilyLabel(segment),
      href: buildDocumentsFamilyHref(segment),
    };
  },
  transfers: async ({ segment }: { segment: string }) => {
    if (!isKnownDocumentType(segment)) {
      return null;
    }

    const href = buildDocumentTypeHref(segment);
    if (!href) {
      return null;
    }

    return {
      label: getDocumentTypeLabel(segment),
      href,
    };
  },
  ifrs: async ({ segment }: { segment: string }) => {
    if (!isKnownDocumentType(segment)) {
      return null;
    }

    const href = buildDocumentTypeHref(segment);
    if (!href) {
      return null;
    }

    return {
      label: getDocumentTypeLabel(segment),
      href,
    };
  },
  create: async ({
    segment,
    segments,
  }: {
    segment: string;
    segments: string[];
  }) => {
    if (
      segments.length >= 4 &&
      segments[0] === "documents" &&
      isKnownDocumentType(segment)
    ) {
      const href = buildDocumentCreateHref(segment);
      if (!href) {
        return null;
      }

      return {
        label: getDocumentTypeLabel(segment),
        href,
      };
    }

    return null;
  },
  users: createResourceSegmentResolver({
    singularLabel: "Пользователь",
    hrefPrefix: "/users",
    getById: getUserById,
    getLabel: (user) => user.name,
    getId: (user) => user.id,
  }),
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
