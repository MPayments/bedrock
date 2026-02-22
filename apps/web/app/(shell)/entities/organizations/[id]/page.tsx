import { notFound } from "next/navigation";

import { OrganizationGeneralForm } from "../components/organization-general-form";
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

  return (
    <OrganizationGeneralForm
      mode="edit"
      initialValues={{
        name: organization.name,
        country: organization.country ?? "",
        baseCurrency: organization.baseCurrency,
        externalId: organization.externalId ?? "",
        isTreasury: organization.isTreasury,
        customerId: organization.customerId ?? "",
      }}
    />
  );
}
