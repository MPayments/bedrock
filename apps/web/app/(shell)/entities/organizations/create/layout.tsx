"use client";

import { useEffect } from "react";

import { OrganizationWorkspaceLayout } from "../components/organization-workspace-layout";
import { useOrganizationCreateDraftName } from "../lib/create-draft-name-context";

export default function CreateOrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { createLabel, resetCreateName } = useOrganizationCreateDraftName();

  useEffect(() => {
    resetCreateName();
    return () => {
      resetCreateName();
    };
  }, [resetCreateName]);

  return (
    <OrganizationWorkspaceLayout
      title={createLabel}
      subtitle="Карточка организации"
      disabledTabs={["accounts", "operations"]}
    >
      {children}
    </OrganizationWorkspaceLayout>
  );
}
