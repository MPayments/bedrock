import { notFound } from "next/navigation";

import { EditOrganizationFormClient } from "@/features/entities/organizations/components/edit-organization-form-client";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";

interface OrganizationPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { id } = await params;
  const organization = await getOrganizationById(id);

  if (!organization) {
    notFound();
  }

  return <EditOrganizationFormClient organization={organization} />;
}
