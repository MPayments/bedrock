import { redirect } from "next/navigation";

interface OrganizationDocumentsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrganizationDocumentsPage({
  params,
  searchParams,
}: OrganizationDocumentsPageProps) {
  const { id } = await params;
  void searchParams;
  redirect(`/treasury/organizations/${id}/documents`);
}
