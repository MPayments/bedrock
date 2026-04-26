"use client";

import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";

import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";

import {
  buildWatchedValueMap,
  deriveAccountCurrencyFieldUpdates,
} from "../helpers";

export function useDerivedAccountCurrencyFields(input: {
  control: {
    _subjects: unknown;
  };
  derivedFields: DocumentFormField[];
  accountCurrencyCodeById: Map<string, string>;
  setValue: (name: string, value: unknown, options?: Record<string, boolean>) => void;
}) {
  const dependencyFieldNames = useMemo(() => {
    const names = new Set<string>();

    for (const field of input.derivedFields) {
      names.add(field.name);

      if (field.deriveFrom?.kind !== "accountCurrency") {
        continue;
      }

      for (const accountFieldName of field.deriveFrom.accountFieldNames) {
        names.add(accountFieldName);
      }
    }

    return [...names];
  }, [input.derivedFields]);
  const watchedDependencyValues = useWatch({
    control: input.control as never,
    name: dependencyFieldNames as never[],
  });
  const dependencyValuesByField = useMemo<DocumentFormValues>(
    () => buildWatchedValueMap(dependencyFieldNames, watchedDependencyValues),
    [dependencyFieldNames, watchedDependencyValues],
  );

  const pendingUpdates = useMemo(
    () =>
      deriveAccountCurrencyFieldUpdates({
        derivedFields: input.derivedFields,
        values: dependencyValuesByField,
        accountCurrencyCodeById: input.accountCurrencyCodeById,
      }),
    [
      dependencyValuesByField,
      input.accountCurrencyCodeById,
      input.derivedFields,
    ],
  );

  useEffect(() => {
    for (const update of pendingUpdates) {
      input.setValue(update.name, update.value, {
        shouldDirty: false,
      });
    }
  }, [input, pendingUpdates]);
}
