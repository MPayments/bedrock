"use client";

import { useEffect } from "react";

import { AccountWorkspaceLayout } from "@/features/entities/counterparty-accounts/components/account-workspace-layout";
import { useAccountDraftName } from "@/features/entities/counterparty-accounts/lib/create-draft-name-context";

export default function CreateAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useAccountDraftName();

  useEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <AccountWorkspaceLayout title={state.createLabel} subtitle="Карточка счёта">
      {children}
    </AccountWorkspaceLayout>
  );
}
