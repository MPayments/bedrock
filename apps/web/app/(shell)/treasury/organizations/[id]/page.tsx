import { notFound } from "next/navigation";

import { EditOrganizationFormClient } from "@/features/entities/organizations/components/edit-organization-form-client";
import { getOrganizationById } from "@/features/entities/organizations/lib/queries";

interface TreasuryOrganizationPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryOrganizationPage({
  params,
}: TreasuryOrganizationPageProps) {
  const { id } = await params;
  const organization = await getOrganizationById(id);

  if (!organization) {
    notFound();
  }

  return (
    <EditOrganizationFormClient
      organization={organization}
      listPath="/treasury/organizations"
    />
  );
}
