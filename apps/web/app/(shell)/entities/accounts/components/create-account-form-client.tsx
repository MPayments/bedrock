"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  AccountCreateGeneralForm,
  type AccountGeneralFormValues,
} from "./account-general-form";
import { useAccountDraftName } from "../lib/create-draft-name-context";
import type { AccountFormOptions } from "../lib/queries";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreatedAccount = {
  id: string;
};

type CreateAccountFormClientProps = {
  options: AccountFormOptions;
};

const INITIAL_VALUES: AccountGeneralFormValues = {
  label: "",
  description: "",
  stableKey: "",
  counterpartyId: "",
  currencyId: "",
  accountProviderId: "",
  accountNo: "",
  corrAccount: "",
  address: "",
  iban: "",
};

export function CreateAccountFormClient({ options }: CreateAccountFormClientProps) {
  const router = useRouter();
  const { actions } = useAccountDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: AccountGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedAccount>({
      request: () =>
        apiClient.v1.accounts.$post({
          json: {
            label: values.label,
            description: values.description || null,
            stableKey: values.stableKey,
            counterpartyId: values.counterpartyId,
            currencyId: values.currencyId,
            accountProviderId: values.accountProviderId,
            accountNo: values.accountNo || null,
            corrAccount: values.corrAccount || null,
            address: values.address || null,
            iban: values.iban || null,
          },
        }),
      fallbackMessage: "Не удалось создать счёт",
      parseData: async (response) => (await response.json()) as CreatedAccount,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Счёт создан");
    router.push(`/entities/accounts/${result.data.id}`);
  }

  return (
    <AccountCreateGeneralForm
      initialValues={INITIAL_VALUES}
      options={options}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onLabelChange={actions.setCreateName}
    />
  );
}
