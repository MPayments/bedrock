"use client";

import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";

import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";

import {
  buildWatchedValueMap,
  collectAccountDependencyNames,
  findInvalidAccountFieldUpdates,
} from "../helpers";

export function useResetIncompatibleAccountFields(input: {
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>;
  control: {
    _subjects: unknown;
  };
  currencyIdByCode: Map<string, string>;
  loadingOwnerKeys: Iterable<string>;
  requisitesByOwnerKey: ReadonlyMap<string, Array<{ id: string }>>;
  setValue: (
    name: string,
    value: string,
    options?: {
      shouldDirty?: boolean;
    },
  ) => void;
}) {
  const dependencyFieldNames = useMemo(
    () => collectAccountDependencyNames(input.accountFields),
    [input.accountFields],
  );
  const watchedDependencyValues = useWatch({
    control: input.control as never,
    name: dependencyFieldNames as never[],
  });
  const values = useMemo(
    () => buildWatchedValueMap(dependencyFieldNames, watchedDependencyValues),
    [dependencyFieldNames, watchedDependencyValues],
  );
  const {
    accountFields,
    currencyIdByCode,
    loadingOwnerKeys,
    requisitesByOwnerKey,
    setValue,
  } = input;

  useEffect(() => {
    const updates = findInvalidAccountFieldUpdates({
      accountFields,
      currencyIdByCode,
      loadingOwnerKeys,
      requisitesByOwnerKey,
      values,
    });

    for (const update of updates) {
      setValue(update.name, update.value, { shouldDirty: true });
    }
  }, [accountFields, currencyIdByCode, loadingOwnerKeys, requisitesByOwnerKey, setValue, values]);
}
