"use client";

import { useEffect } from "react";

import { CurrencyWorkspaceLayout } from "../components/currency-workspace-layout";
import { useCurrencyDraftName } from "../lib/create-draft-name-context";

export default function CreateCurrencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useCurrencyDraftName();

  useEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <CurrencyWorkspaceLayout title={state.createLabel} subtitle="Карточка валюты">
      {children}
    </CurrencyWorkspaceLayout>
  );
}
