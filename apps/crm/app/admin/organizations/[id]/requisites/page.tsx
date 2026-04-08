import { redirect } from "next/navigation";

type OrganizationRequisitesRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrganizationRequisitesRedirectPage({
  params,
}: OrganizationRequisitesRedirectPageProps) {
  const { id } = await params;
  redirect(`/admin/organizations/${id}?tab=requisites`);
}
