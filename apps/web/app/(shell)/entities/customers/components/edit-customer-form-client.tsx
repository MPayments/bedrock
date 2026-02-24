"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CustomerEditGeneralForm,
  type CustomerGeneralFormValues,
} from "./customer-general-form";
import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";
import type { CustomerDetails } from "../lib/queries";

function toFormValues(customer: CustomerDetails): CustomerGeneralFormValues {
  return {
    displayName: customer.displayName,
    externalRef: customer.externalRef ?? "",
  };
}

type EditCustomerFormClientProps = {
  customer: CustomerDetails;
};

export function EditCustomerFormClient({ customer }: EditCustomerFormClientProps) {
  const router = useRouter();
  const { setEditName, clearEditCustomer } = useCustomerDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(customer));

  const handleDisplayNameChange = useCallback(
    (name: string) => {
      setEditName(customer.id, name);
    },
    [customer.id, setEditName],
  );

  async function handleSubmit(
    values: CustomerGeneralFormValues,
  ): Promise<CustomerGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiClient.v1.customers[":id"].$patch({
        param: { id: customer.id },
        json: {
          displayName: values.displayName,
          externalRef: values.externalRef || null,
        },
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
          "Не удалось обновить клиента",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const updated = await res.json();
      const nextValues = toFormValues(updated);
      setInitialValues(nextValues);
      toast.success("Клиент обновлен");
      router.refresh();
      return nextValues;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить клиента";
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
      const res = await apiClient.v1.customers[":id"].$delete({
        param: { id: customer.id },
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
          "Не удалось удалить клиента",
        );
        setError(message);
        toast.error(message);
        return false;
      }

      clearEditCustomer(customer.id);
      router.push("/entities/customers");
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить клиента";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CustomerEditGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onDisplayNameChange={handleDisplayNameChange}
    />
  );
}
