"use client";

import { useEffect } from "react";

import { CounterpartyWorkspaceLayout } from "../components/organization-workspace-layout";
import { useCounterpartyDraftName } from "../lib/create-draft-name-context";

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
