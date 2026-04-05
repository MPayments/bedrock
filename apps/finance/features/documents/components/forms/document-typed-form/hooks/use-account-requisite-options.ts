"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWatch } from "react-hook-form";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  fetchRequisiteOptions,
  type RequisiteOption,
} from "@/features/documents/lib/account-options";
import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";

import {
  buildWatchedValueMap,
  collectAccountDependencyNames,
  resolveAccountRequisiteRequests,
} from "../helpers";

export function useAccountRequisiteOptions(input: {
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>;
  control: {
    _subjects: unknown;
  };
  currencyIdByCode: Map<string, string>;
  currencyCodeById: Map<string, string>;
  currencyLabelById: Map<string, string>;
}) {
  const dependencyFieldNames = useMemo(
    () => collectAccountDependencyNames(input.accountFields),
    [input.accountFields],
  );
  const watchedDependencyValues = useWatch({
    control: input.control as never,
    name: dependencyFieldNames as never[],
  });
  const ownerValuesByField = useMemo(
    () => buildWatchedValueMap(dependencyFieldNames, watchedDependencyValues),
    [dependencyFieldNames, watchedDependencyValues],
  );
  const [requisitesByOwnerKey, setRequisitesByOwnerKey] = useState(
    new Map<string, RequisiteOption[]>(),
  );
  const [loadingOwnerKeys, setLoadingOwnerKeys] = useState(new Set<string>());
  const loadingOwnerKeysRef = useRef(new Set<string>());

  const pendingRequests = useMemo(
    () =>
      resolveAccountRequisiteRequests({
        accountFields: input.accountFields,
        ownerValuesByField,
        cachedOwnerKeys: requisitesByOwnerKey.keys(),
        currencyIdByCode: input.currencyIdByCode,
        loadingOwnerKeys,
      }),
    [
      input.accountFields,
      input.currencyIdByCode,
      loadingOwnerKeys,
      ownerValuesByField,
      requisitesByOwnerKey,
    ],
  );

  useEffect(() => {
    for (const request of pendingRequests) {
      if (loadingOwnerKeysRef.current.has(request.ownerKey)) {
        continue;
      }

      loadingOwnerKeysRef.current.add(request.ownerKey);
      setLoadingOwnerKeys((current) => new Set([...current, request.ownerKey]));

      void fetchRequisiteOptions({
        currencyId: request.currencyId,
        ownerId: request.ownerId,
        ownerType: request.ownerType,
        currencyLabelById: input.currencyLabelById,
      })
        .then((accountOptions) => {
          setRequisitesByOwnerKey((current) => {
            const next = new Map(current);
            next.set(request.ownerKey, accountOptions);
            return next;
          });
        })
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить реквизиты",
          );
        })
        .finally(() => {
          loadingOwnerKeysRef.current.delete(request.ownerKey);
          setLoadingOwnerKeys((current) => {
            const next = new Set(current);
            next.delete(request.ownerKey);
            return next;
          });
        });
    }
  }, [input.currencyLabelById, pendingRequests]);

  const accountCurrencyCodeById = useMemo(() => {
    const next = new Map<string, string>();

    for (const accountOptions of requisitesByOwnerKey.values()) {
      for (const option of accountOptions) {
        const currencyCode = input.currencyCodeById.get(option.currencyId);
        if (currencyCode) {
          next.set(option.id, currencyCode);
        }
      }
    }

    return next;
  }, [input.currencyCodeById, requisitesByOwnerKey]);

  return {
    requisitesByOwnerKey,
    loadingOwnerKeys,
    accountCurrencyCodeById,
  };
}
