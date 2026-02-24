"use client";

import { useEffect } from "react";

import { CounterpartyWorkspaceLayout } from "../components/organization-workspace-layout";
import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";

export default function CreateCounterpartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { createLabel, resetCreateName } = useCounterpartyCreateDraftName();

  useEffect(() => {
    resetCreateName();
  }, [resetCreateName]);

  return (
    <CounterpartyWorkspaceLayout
      title={createLabel}
      subtitle="Карточка контрагента"
      disabledTabs={["accounts", "operations"]}
    >
      {children}
    </CounterpartyWorkspaceLayout>
  );
}
