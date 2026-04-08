import { redirect } from "next/navigation";

type OrganizationRequisiteRedirectPageProps = {
  params: Promise<{
    id: string;
    requisiteId: string;
  }>;
};

export default async function OrganizationRequisiteRedirectPage({
  params,
}: OrganizationRequisiteRedirectPageProps) {
  const { id, requisiteId } = await params;
  redirect(`/admin/organizations/${id}?tab=requisites&requisite=${requisiteId}`);
}
