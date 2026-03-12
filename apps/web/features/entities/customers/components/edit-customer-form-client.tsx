"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@multihansa/ui/components/sonner";

import {
  CustomerEditGeneralForm,
  type CustomerGeneralFormValues,
} from "./customer-general-form";
import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type { CustomerDetails } from "../lib/queries";
import { executeMutation } from "@/lib/resources/http";

function toFormValues(customer: CustomerDetails): CustomerGeneralFormValues {
  return {
    displayName: customer.displayName,
    externalRef: customer.externalRef ?? "",
    description: customer.description ?? "",
  };
}

type EditCustomerFormClientProps = {
  customer: CustomerDetails;
};

export function EditCustomerFormClient({ customer }: EditCustomerFormClientProps) {
  const router = useRouter();
  const { actions } = useCustomerDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(customer));
  const [createdAt, setCreatedAt] = useState<string | null>(customer.createdAt);
  const [updatedAt, setUpdatedAt] = useState<string | null>(customer.updatedAt);

  const handleDisplayNameChange = useCallback(
    (name: string) => {
      actions.setEditName(customer.id, name);
    },
    [actions, customer.id],
  );

  async function handleSubmit(
    values: CustomerGeneralFormValues,
  ): Promise<CustomerGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);
    const payload = {
      displayName: values.displayName,
      externalRef: values.externalRef || null,
      description: values.description || null,
    };

    const result = await executeMutation<CustomerDetails>({
      request: () =>
        apiClient.v1.customers[":id"].$patch({
          param: { id: customer.id },
          json: payload,
        }),
      fallbackMessage: "Не удалось обновить клиента",
      parseData: async (response) => (await response.json()) as CustomerDetails,
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
    toast.success("Клиент обновлен");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.customers[":id"].$delete({
          param: { id: customer.id },
        }),
      fallbackMessage: "Не удалось удалить клиента",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(customer.id);
    router.push("/entities/customers");
    return true;
  }

  return (
    <CustomerEditGeneralForm
      initialValues={initialValues}
      createdAt={createdAt}
      updatedAt={updatedAt}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onDisplayNameChange={handleDisplayNameChange}
    />
  );
}
