"use client";

import { useCurrencyDraftName } from "../lib/create-draft-name-context";
import { CurrencyWorkspaceLayout } from "./currency-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

type CurrencyEditWorkspaceLayoutProps = {
  currencyId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function CurrencyEditWorkspaceLayout({
  currencyId,
  initialTitle,
  children,
}: CurrencyEditWorkspaceLayoutProps) {
  const { actions, meta } = useCurrencyDraftName();

  const title = useEntityEditTitle({
    id: currencyId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <CurrencyWorkspaceLayout title={title} subtitle="Карточка валюты">
      {children}
    </CurrencyWorkspaceLayout>
  );
}
