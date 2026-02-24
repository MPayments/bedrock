"use client";

import { useEffect } from "react";

import { CurrencyWorkspaceLayout } from "../components/currency-workspace-layout";
import { useCurrencyDraftName } from "../lib/create-draft-name-context";

export default function CreateCurrencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { createLabel, resetCreateName } = useCurrencyDraftName();

  useEffect(() => {
    resetCreateName();
  }, [resetCreateName]);

  return (
    <CurrencyWorkspaceLayout title={createLabel} subtitle="Карточка валюты">
      {children}
    </CurrencyWorkspaceLayout>
  );
}
