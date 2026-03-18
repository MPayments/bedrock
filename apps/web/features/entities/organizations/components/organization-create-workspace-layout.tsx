"use client";

import * as React from "react";

import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import { OrganizationWorkspaceLayout } from "./organization-workspace-layout";

export function OrganizationCreateWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useOrganizationDraftName();

  React.useLayoutEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <OrganizationWorkspaceLayout
      title={state.createLabel}
      subtitle="Карточка организации"
      disabledTabs={["accounts", "documents"]}
    >
      {children}
    </OrganizationWorkspaceLayout>
  );
}
