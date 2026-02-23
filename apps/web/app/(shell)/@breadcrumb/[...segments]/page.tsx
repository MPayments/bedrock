import { getCounterpartyById } from "@/app/(shell)/entities/counterparties/lib/queries";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import {
  resolveBreadcrumbItems,
} from "@/lib/breadcrumbs";

const dynamicResolvers = {
  counterparties: async ({ segment }: { segment: string }) => {
    const counterparty = await getCounterpartyById(segment);

    if (!counterparty) {
      return {
        label: "Контрагент",
        href: `/entities/counterparties/${segment}`,
      };
    }

    return {
      label: counterparty.shortName,
      href: `/entities/counterparties/${counterparty.id}`,
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
