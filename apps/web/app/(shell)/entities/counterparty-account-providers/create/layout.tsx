"use client";

import { useEffect } from "react";

import { ProviderWorkspaceLayout } from "../components/provider-workspace-layout";
import { useProviderDraftName } from "../lib/create-draft-name-context";

export default function CreateProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useProviderDraftName();

  useEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <ProviderWorkspaceLayout title={state.createLabel} subtitle="Карточка провайдера">
      {children}
    </ProviderWorkspaceLayout>
  );
}
