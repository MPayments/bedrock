import { getCounterpartyById } from "@/app/(shell)/entities/counterparties/lib/queries";
import { getCurrencyById } from "@/app/(shell)/entities/currencies/lib/queries";
import { getCustomerById } from "@/app/(shell)/entities/customers/lib/queries";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import {
  resolveBreadcrumbItems,
} from "@/lib/breadcrumbs";

const dynamicResolvers = {
  counterparties: async ({
    segment,
    segments,
    index,
  }: {
    segment: string;
    segments: string[];
    index: number;
  }) => {
    const counterpartiesBasePath = segments
      .slice(0, index)
      .includes("treasury")
      ? "/treasury/counterparties"
      : "/entities/counterparties";
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        segment,
      );

    if (!isUuid) {
      return null;
    }

    const counterparty = await getCounterpartyById(segment);

    if (!counterparty) {
      return {
        label: "Контрагент",
        href: `${counterpartiesBasePath}/${segment}`,
      };
    }

    return {
      label: counterparty.shortName,
      href: `${counterpartiesBasePath}/${counterparty.id}`,
    };
  },
  customers: async ({ segment }: { segment: string }) => {
    const customer = await getCustomerById(segment);

    if (!customer) {
      return {
        label: "Клиент",
        href: `/entities/customers/${segment}`,
      };
    }

    return {
      label: customer.displayName,
      href: `/entities/customers/${customer.id}`,
    };
  },
  currencies: async ({ segment }: { segment: string }) => {
    const currency = await getCurrencyById(segment);

    if (!currency) {
      return {
        label: "Валюта",
        href: `/entities/currencies/${segment}`,
      };
    }

    return {
      label: currency.name,
      href: `/entities/currencies/${currency.id}`,
    };
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
