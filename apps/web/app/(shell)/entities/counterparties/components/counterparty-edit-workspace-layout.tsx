"use client";

import { useEffect } from "react";

import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";
import { CounterpartyWorkspaceLayout } from "./organization-workspace-layout";

type CounterpartyEditWorkspaceLayoutProps = {
  counterpartyId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function CounterpartyEditWorkspaceLayout({
  counterpartyId,
  initialTitle,
  children,
}: CounterpartyEditWorkspaceLayoutProps) {
  const { registerEditCounterparty, clearEditCounterparty, getEditLabel } =
    useCounterpartyCreateDraftName();

  useEffect(() => {
    registerEditCounterparty(counterpartyId, initialTitle);

    return () => {
      clearEditCounterparty(counterpartyId);
    };
  }, [
    clearEditCounterparty,
    counterpartyId,
    initialTitle,
    registerEditCounterparty,
  ]);

  return (
    <CounterpartyWorkspaceLayout
      title={getEditLabel(counterpartyId, initialTitle)}
      subtitle="Карточка контрагента"
    >
      {children}
    </CounterpartyWorkspaceLayout>
  );
}
