"use client";

import { useEffect } from "react";

import { CounterpartyWorkspaceLayout } from "@/features/entities/counterparties/components/organization-workspace-layout";
import { useCounterpartyDraftName } from "@/features/entities/counterparties/lib/create-draft-name-context";

export default function CreateCounterpartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useCounterpartyDraftName();

  useEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <CounterpartyWorkspaceLayout
      title={state.createLabel}
      subtitle="Карточка контрагента"
      disabledTabs={["accounts", "operations"]}
    >
      {children}
    </CounterpartyWorkspaceLayout>
  );
}
