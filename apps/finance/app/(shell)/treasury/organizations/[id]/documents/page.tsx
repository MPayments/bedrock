import { OrganizationDocumentsPageContent } from "@/features/entities/organizations/components/organization-documents-page";

interface TreasuryOrganizationDocumentsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TreasuryOrganizationDocumentsPage({
  params,
  searchParams,
}: TreasuryOrganizationDocumentsPageProps) {
  const { id } = await params;

  return await OrganizationDocumentsPageContent({
    organizationId: id,
    searchParams,
  });
}
