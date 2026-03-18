"use client";

import { createContext, use, useMemo } from "react";
import { useWatch } from "react-hook-form";
import type { ReactNode } from "react";

import type { DocumentFormSection } from "@/features/documents/lib/document-form-registry";

import {
  buildWatchedValueMap,
  collectVisibilityDependencyNames,
  findHiddenSectionCurrencyField,
  isFieldVisible,
} from "./helpers";

type DocumentTypedFormSectionContextValue = {
  section: DocumentFormSection;
  hiddenDerivedCurrencyFieldName: string | null;
};

const DocumentTypedFormSectionContext =
  createContext<DocumentTypedFormSectionContextValue | null>(null);

export function DocumentTypedFormSectionProvider({
  children,
  section,
}: {
  children: ReactNode;
  section: DocumentFormSection;
}) {
  const hiddenDerivedCurrencyField = useMemo(
    () => findHiddenSectionCurrencyField(section),
    [section],
  );
  const dependencyNames = useMemo(
    () =>
      hiddenDerivedCurrencyField
        ? collectVisibilityDependencyNames([hiddenDerivedCurrencyField])
        : [],
    [hiddenDerivedCurrencyField],
  );
  const watchedDependencyValues = useWatch({
    name: dependencyNames as never[],
  });
  const dependencyValues = useMemo(
    () => buildWatchedValueMap(dependencyNames, watchedDependencyValues),
    [dependencyNames, watchedDependencyValues],
  );
  const hiddenDerivedCurrencyFieldName =
    hiddenDerivedCurrencyField &&
    isFieldVisible(hiddenDerivedCurrencyField, dependencyValues)
      ? hiddenDerivedCurrencyField.name
      : null;

  const value = useMemo(
    () => ({
      section,
      hiddenDerivedCurrencyFieldName,
    }),
    [hiddenDerivedCurrencyFieldName, section],
  );

  return (
    <DocumentTypedFormSectionContext value={value}>
      {children}
    </DocumentTypedFormSectionContext>
  );
}

export function useDocumentTypedFormSection() {
  const context = use(DocumentTypedFormSectionContext);

  if (!context) {
    throw new Error(
      "useDocumentTypedFormSection must be used inside a document typed form section provider",
    );
  }

  return context;
}
