"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  AccountEditGeneralForm,
  type AccountGeneralFormValues,
} from "./account-general-form";
import { useAccountDraftName } from "../lib/create-draft-name-context";
import type { AccountDetails, AccountFormOptions } from "../lib/queries";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

function toFormValues(account: AccountDetails): AccountGeneralFormValues {
  return {
    label: account.label,
    description: account.description ?? "",
    counterpartyId: account.counterpartyId,
    currencyId: account.currencyId,
    accountProviderId: account.accountProviderId,
    accountNo: account.accountNo ?? "",
    corrAccount: account.corrAccount ?? "",
    address: account.address ?? "",
    iban: account.iban ?? "",
  };
}

type EditAccountFormClientProps = {
  account: AccountDetails;
  options: AccountFormOptions;
};

export function EditAccountFormClient({ account, options }: EditAccountFormClientProps) {
  const router = useRouter();
  const { actions } = useAccountDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(account));
  const [createdAt, setCreatedAt] = useState<string | null>(account.createdAt);
  const [updatedAt, setUpdatedAt] = useState<string | null>(account.updatedAt);

  const handleLabelChange = useCallback(
    (label: string) => {
      actions.setEditName(account.id, label);
    },
    [actions, account.id],
  );

  async function handleSubmit(
    values: AccountGeneralFormValues,
  ): Promise<AccountGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<AccountDetails>({
      request: () =>
        apiClient.v1["counterparty-accounts"][":id"].$patch({
          param: { id: account.id },
          json: {
            label: values.label,
            description: values.description || null,
            accountNo: values.accountNo || null,
            corrAccount: values.corrAccount || null,
            address: values.address || null,
            iban: values.iban || null,
          },
        }),
      fallbackMessage: "Не удалось обновить счёт",
      parseData: async (response) => (await response.json()) as AccountDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setInitialValues(nextValues);
    setCreatedAt(result.data.createdAt);
    setUpdatedAt(result.data.updatedAt);
    toast.success("Счёт обновлён");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1["counterparty-accounts"][":id"].$delete({
          param: { id: account.id },
        }),
      fallbackMessage: "Не удалось удалить счёт",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(account.id);
    router.push("/entities/counterparty-accounts");
    return true;
  }

  return (
    <AccountEditGeneralForm
      initialValues={initialValues}
      options={options}
      createdAt={createdAt}
      updatedAt={updatedAt}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onLabelChange={handleLabelChange}
    />
  );
}
