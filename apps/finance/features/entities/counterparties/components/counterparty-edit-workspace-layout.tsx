"use client";

import { useCounterpartyDraftName } from "../lib/create-draft-name-context";
import { CounterpartyWorkspaceLayout } from "./organization-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

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
  const { actions, meta } = useCounterpartyDraftName();

  const title = useEntityEditTitle({
    id: counterpartyId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <CounterpartyWorkspaceLayout title={title} subtitle="Карточка контрагента">
      {children}
    </CounterpartyWorkspaceLayout>
  );
}
