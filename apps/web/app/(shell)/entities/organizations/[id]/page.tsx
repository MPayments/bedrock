import { notFound } from "next/navigation";

import { OrganizationEditForm } from "../components/organization-edit-form";
import { getOrganizationById } from "../lib/queries";

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

  return <OrganizationEditForm organization={organization} />;
}
