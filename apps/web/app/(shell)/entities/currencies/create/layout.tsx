"use client";

import { useEffect } from "react";

import { CurrencyWorkspaceLayout } from "@/features/entities/currencies/components/currency-workspace-layout";
import { useCurrencyDraftName } from "@/features/entities/currencies/lib/create-draft-name-context";

export default function CreateCurrencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useCurrencyDraftName();

  useEffect(() => {
    return () => {
      actions.resetCreateName();
    };
  }, [actions]);

  return (
    <CurrencyWorkspaceLayout title={state.createLabel} subtitle="Карточка валюты">
      {children}
    </CurrencyWorkspaceLayout>
  );
}
