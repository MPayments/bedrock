import { OrganizationCreateWorkspaceLayout } from "@/features/entities/organizations/components/organization-create-workspace-layout";

export default function TreasuryCreateOrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganizationCreateWorkspaceLayout>{children}</OrganizationCreateWorkspaceLayout>;
}
