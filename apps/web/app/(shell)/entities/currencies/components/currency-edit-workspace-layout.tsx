"use client";

import { useEffect } from "react";

import { useCurrencyDraftName } from "../lib/create-draft-name-context";
import { CurrencyWorkspaceLayout } from "./currency-workspace-layout";

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
  const { registerEditCurrency, clearEditCurrency, getEditLabel } =
    useCurrencyDraftName();

  useEffect(() => {
    registerEditCurrency(currencyId, initialTitle);

    return () => {
      clearEditCurrency(currencyId);
    };
  }, [
    clearEditCurrency,
    currencyId,
    initialTitle,
    registerEditCurrency,
  ]);

  return (
    <CurrencyWorkspaceLayout
      title={getEditLabel(currencyId, initialTitle)}
      subtitle="Карточка валюты"
    >
      {children}
    </CurrencyWorkspaceLayout>
  );
}
