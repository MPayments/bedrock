import { redirect } from "next/navigation";

import { getCounterpartyRequisiteById } from "@/features/entities/counterparty-requisites/lib/queries";
import { getOrganizationRequisiteById } from "@/features/entities/organization-requisites/lib/queries";

interface AccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyAccountPage({ params }: AccountPageProps) {
  const { id } = await params;
  const [counterpartyRequisite, organizationRequisite] = await Promise.all([
    getCounterpartyRequisiteById(id),
    getOrganizationRequisiteById(id),
  ]);

  if (counterpartyRequisite) {
    redirect(`/entities/counterparty-requisites/${counterpartyRequisite.id}`);
  }

  if (organizationRequisite) {
    redirect(`/entities/organization-requisites/${organizationRequisite.id}`);
  }

  redirect("/entities/counterparty-requisites");
}
