"use client";

import { useEffect } from "react";

import { CounterpartyWorkspaceLayout } from "@/app/(shell)/entities/counterparties/components/organization-workspace-layout";
import { useCounterpartyDraftName } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";

export default function TreasuryCreateCounterpartyLayout({
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
