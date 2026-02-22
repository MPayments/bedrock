import { getOrganizationById } from "@/app/(shell)/entities/organizations/lib/queries";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import {
  resolveBreadcrumbItems,
} from "@/lib/breadcrumbs";

const dynamicResolvers = {
  organizations: async ({ segment }: { segment: string }) => {
    const organization = await getOrganizationById(segment);

    if (!organization) {
      return {
        label: "Организация",
        href: `/entities/organizations/${segment}`,
      };
    }

    return {
      label: organization.name,
      href: `/entities/organizations/${organization.id}`,
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
