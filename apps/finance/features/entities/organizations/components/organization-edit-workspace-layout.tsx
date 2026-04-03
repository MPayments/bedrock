"use client";

import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import { OrganizationWorkspaceLayout } from "./organization-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

type OrganizationEditWorkspaceLayoutProps = {
  organizationId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function OrganizationEditWorkspaceLayout({
  organizationId,
  initialTitle,
  children,
}: OrganizationEditWorkspaceLayoutProps) {
  const { actions, meta } = useOrganizationDraftName();

  const title = useEntityEditTitle({
    id: organizationId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <OrganizationWorkspaceLayout
      title={title}
      subtitle="Карточка организации"
    >
      {children}
    </OrganizationWorkspaceLayout>
  );
}
