import { redirect } from "next/navigation";

interface OrganizationRequisitesPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationRequisitesPage({
  params,
}: OrganizationRequisitesPageProps) {
  const { id } = await params;
  redirect(`/treasury/organizations/${id}/requisites`);
}
