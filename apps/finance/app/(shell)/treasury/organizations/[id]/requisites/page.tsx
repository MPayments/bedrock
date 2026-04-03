import { OrganizationRequisitesPageContent } from "@/features/entities/organizations/components/organization-requisites-page";

interface TreasuryOrganizationRequisitesPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryOrganizationRequisitesPage({
  params,
}: TreasuryOrganizationRequisitesPageProps) {
  const { id } = await params;

  return await OrganizationRequisitesPageContent({ organizationId: id });
}
