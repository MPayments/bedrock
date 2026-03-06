"use client";

import { useLayoutEffect } from "react";

import { ProviderWorkspaceLayout } from "@/features/entities/counterparty-account-providers/components/provider-workspace-layout";
import { useProviderDraftName } from "@/features/entities/counterparty-account-providers/lib/create-draft-name-context";

export default function CreateProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useProviderDraftName();

  useLayoutEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <ProviderWorkspaceLayout title={state.createLabel} subtitle="Карточка провайдера">
      {children}
    </ProviderWorkspaceLayout>
  );
}
