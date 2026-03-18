import { OrganizationEditWorkspaceLayout } from "@/features/entities/organizations/components/organization-edit-workspace-layout";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: organization } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getOrganizationById,
  });

  return (
    <OrganizationEditWorkspaceLayout
      organizationId={organization.id}
      initialTitle={organization.shortName}
    >
      {children}
    </OrganizationEditWorkspaceLayout>
  );
}
