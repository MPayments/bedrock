import { EditOrganizationFormClient } from "@/features/entities/organizations/components/edit-organization-form-client";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface OrganizationPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { entity: organization } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getOrganizationById,
  });

  return <EditOrganizationFormClient organization={organization} />;
}
