import { getCounterpartyById } from "@/features/entities/counterparties/lib/queries";
import { getCurrencyById } from "@/features/entities/currencies/lib/queries";
import { getCustomerById } from "@/features/entities/customers/lib/queries";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";
import { getRequisiteProviderById } from "@/features/entities/requisite-providers/lib/queries";
import { getRequisiteById } from "@/features/entities/requisites/lib/queries";
import { getFinanceDealDisplayTitle } from "@/features/treasury/deals/labels";
import { getFinanceDealBreadcrumbById } from "@/features/treasury/deals/lib/queries";
import { getFinanceRouteTemplateById } from "@/features/treasury/route-templates/lib/queries";
import {
  getTreasuryOperationDisplayTitle,
} from "@/features/treasury/operations/lib/labels";
import { getTreasuryOperationById } from "@/features/treasury/operations/lib/queries";
import {
  getDocumentTypeLabel,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import {
  buildDocumentDetailsBreadcrumbItems,
  getDocumentDetailsBreadcrumbParams,
  resolveDocumentCreateBreadcrumbItems,
} from "@/features/documents/lib/breadcrumbs";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
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
      href: `/treasury/rates/${base}-${quote}`,
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
  deals: createResourceSegmentResolver({
    singularLabel: "Сделка",
    hrefPrefix: "/treasury/deals",
    getById: getFinanceDealBreadcrumbById,
    getLabel: (deal) =>
      getFinanceDealDisplayTitle({
        applicantDisplayName: deal.summary.applicantDisplayName,
        id: deal.summary.id,
        type: deal.summary.type,
      }),
    getId: (deal) => deal.summary.id,
  }),
  "route-templates": async ({ segment }: { segment: string }) => {
    if (segment === "new") {
      return {
        label: "Новый шаблон маршрута",
        href: "/route-templates/new",
      };
    }

    const template = await getFinanceRouteTemplateById(segment);

    if (!template) {
      return {
        label: "Шаблон маршрута",
        href: `/route-templates/${segment}`,
      };
    }

    return {
      label: template.name,
      href: `/route-templates/${template.id}`,
    };
  },
  operations: createResourceSegmentResolver({
    singularLabel: "Операция",
    hrefPrefix: "/treasury/operations",
    getById: getTreasuryOperationById,
    getLabel: (operation) =>
      getTreasuryOperationDisplayTitle({
        applicantName: operation.dealRef?.applicantName,
        dealId: operation.dealRef?.dealId,
        id: operation.id,
        kind: operation.kind,
      }),
    getId: (operation) => operation.id,
  }),
  customers: createResourceSegmentResolver({
    singularLabel: "Клиент",
    hrefPrefix: "/entities/customers",
    getById: getCustomerById,
    getLabel: (customer) => customer.name,
    getId: (customer) => customer.id,
  }),
  organizations: createResourceSegmentResolver({
    singularLabel: "Организация",
    hrefPrefix: "/treasury/organizations",
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
    hrefPrefix: "/entities/requisites",
    getById: getRequisiteById,
    getLabel: (requisite) => requisite.label,
    getId: (requisite) => requisite.id,
  }),
  "requisite-providers": createResourceSegmentResolver({
    singularLabel: "Провайдер реквизитов",
    hrefPrefix: "/entities/requisite-providers",
    getById: getRequisiteProviderById,
    getLabel: (provider) => provider.displayName,
    getId: (provider) => provider.id,
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
  create: async ({
    segment,
    segments,
  }: {
    segment: string;
    segments: string[];
  }) => {
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
  const documentCreateItems = resolveDocumentCreateBreadcrumbItems(segments);

  if (documentCreateItems) {
    return <DynamicBreadcrumb items={documentCreateItems} />;
  }

  const documentDetailsParams = getDocumentDetailsBreadcrumbParams(segments);
  if (documentDetailsParams) {
    const details = await getDocumentDetails(
      documentDetailsParams.docType,
      documentDetailsParams.id,
    );

    if (details) {
      return (
        <DynamicBreadcrumb
          items={buildDocumentDetailsBreadcrumbItems(details.document)}
        />
      );
    }
  }

  const items = await resolveBreadcrumbItems(segments, {
    resolvers: dynamicResolvers,
  });

  return <DynamicBreadcrumb items={items} />;
}
