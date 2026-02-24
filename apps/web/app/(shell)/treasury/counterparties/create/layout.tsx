"use client";

import { useEffect } from "react";

import { CounterpartyWorkspaceLayout } from "@/app/(shell)/entities/counterparties/components/organization-workspace-layout";
import { useCounterpartyCreateDraftName } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";

export default function TreasuryCreateCounterpartyLayout({
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
