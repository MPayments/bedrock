"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CounterpartyEditGeneralForm,
  type CounterpartyGeneralFormValues,
} from "./organization-general-form";
import { dedupeGroupIds } from "../lib/group-scope";
import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";
import type {
  CounterpartyDetails,
  CounterpartyGroupOption,
} from "../lib/queries";

type CounterpartyEditFormProps = {
  counterparty: CounterpartyDetails;
  initialGroupOptions: CounterpartyGroupOption[];
  initialLoadError?: string | null;
  allowedRootCode?: "treasury" | "customers";
  lockedGroupIds?: string[];
  listPath?: string;
  disableSubmit?: boolean;
};

function toFormValues(
  counterparty: CounterpartyEditFormProps["counterparty"],
  lockedGroupIds: string[] = [],
): CounterpartyGeneralFormValues {
  return {
    shortName: counterparty.shortName,
    fullName: counterparty.fullName,
    kind: counterparty.kind,
    country: counterparty.country ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: dedupeGroupIds([...counterparty.groupIds, ...lockedGroupIds]),
  };
}

export function CounterpartyEditForm({
  counterparty,
  initialGroupOptions,
  initialLoadError = null,
  allowedRootCode,
  lockedGroupIds = [],
  listPath = "/entities/counterparties",
  disableSubmit = false,
}: CounterpartyEditFormProps) {
  const router = useRouter();
  const { setEditName, clearEditCounterparty } =
    useCounterpartyCreateDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(counterparty, lockedGroupIds),
  );
  const handleShortNameChange = useCallback(
    (name: string) => {
      setEditName(counterparty.id, name);
    },
    [counterparty.id, setEditName],
  );

  async function handleSubmit(
    values: CounterpartyGeneralFormValues,
  ): Promise<CounterpartyGeneralFormValues | void> {
    setError(null);
    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const payload = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim() || null,
      description: values.description.trim() || null,
      customerId: customerId || null,
      groupIds: values.groupIds,
    };

    setSubmitting(true);

    try {
      const res = await apiClient.v1.counterparties[":id"].$patch({
        param: {
          id: counterparty.id,
        },
        json: payload,
      });

      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          // Ignore non-JSON error payloads.
        }

        const message = resolveApiErrorMessage(
          res.status,
          payload,
          "Не удалось обновить контрагента",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const updated = await res.json();
      const nextValues = toFormValues(updated, lockedGroupIds);
      setInitialValues(nextValues);
      toast.success("Контрагент обновлен");
      router.refresh();
      return nextValues;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить контрагента";
      setError(message);
      toast.error(message);
      return;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    try {
      const res = await apiClient.v1.counterparties[":id"].$delete({
        param: { id: counterparty.id },
      });

      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          // Ignore non-JSON error payloads.
        }

        const message = resolveApiErrorMessage(
          res.status,
          payload,
          "Не удалось удалить контрагента",
        );
        setError(message);
        toast.error(message);
        return false;
      }

      clearEditCounterparty(counterparty.id);
      router.push(listPath);
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить контрагента";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CounterpartyEditGeneralForm
      initialValues={initialValues}
      groupOptions={initialGroupOptions}
      allowedRootCode={allowedRootCode}
      lockedGroupIds={lockedGroupIds}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={disableSubmit ? undefined : handleSubmit}
      onDelete={handleDelete}
      onShortNameChange={handleShortNameChange}
    />
  );
}
