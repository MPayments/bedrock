import { notFound } from "next/navigation";

import { OrganizationWorkspaceLayout } from "../components/organization-workspace-layout";
import { getOrganizationById } from "../lib/queries";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organization = await getOrganizationById(id);

  if (!organization) {
    notFound();
  }

  return (
    <OrganizationWorkspaceLayout
      title={organization.name}
      subtitle="Карточка организации"
    >
      {children}
    </OrganizationWorkspaceLayout>
  );
}
