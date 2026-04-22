"use client";

import type { Path, PathValue, UseFormReturn } from "react-hook-form";

import {
  CustomerBankingFields,
  type CustomerBankingFieldErrors,
  type CustomerBankingFieldName,
  type CustomerBankingFieldValue,
  type CustomerBankingFieldsValue,
} from "@bedrock/sdk-parties-ui/components/customer-banking-fields";

import {
  createManualBankProvider,
  searchCustomerBankProviders,
  type CustomerBankingFormValues,
} from "@/lib/customer-banking";

function getNestedError(errors: Record<string, unknown>, path: string) {
  const segments = path.split(".");
  let current: unknown = errors;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (!current || typeof current !== "object" || !("message" in current)) {
    return null;
  }

  return typeof current.message === "string" ? current.message : null;
}

function getBankingErrors(
  errors: Record<string, unknown>,
): CustomerBankingFieldErrors {
  return {
    "bankProvider.address": getNestedError(errors, "bankProvider.address"),
    "bankProvider.country": getNestedError(errors, "bankProvider.country"),
    "bankProvider.name": getNestedError(errors, "bankProvider.name"),
    "bankProvider.routingCode": getNestedError(
      errors,
      "bankProvider.routingCode",
    ),
    bankProviderId: getNestedError(errors, "bankProviderId"),
    "bankRequisite.accountNo": getNestedError(
      errors,
      "bankRequisite.accountNo",
    ),
    "bankRequisite.beneficiaryName": getNestedError(
      errors,
      "bankRequisite.beneficiaryName",
    ),
    "bankRequisite.iban": getNestedError(errors, "bankRequisite.iban"),
  };
}

function getBankingValue(
  form: UseFormReturn<CustomerBankingFormValues>,
): CustomerBankingFieldsValue {
  return {
    bankMode: form.watch("bankMode"),
    bankProvider: {
      address: form.watch("bankProvider.address") ?? "",
      country: form.watch("bankProvider.country") ?? "",
      name: form.watch("bankProvider.name") ?? "",
      routingCode: form.watch("bankProvider.routingCode") ?? "",
    },
    bankProviderId: form.watch("bankProviderId") ?? null,
    bankRequisite: {
      accountNo: form.watch("bankRequisite.accountNo") ?? "",
      beneficiaryName: form.watch("bankRequisite.beneficiaryName") ?? "",
      iban: form.watch("bankRequisite.iban") ?? "",
    },
  };
}

export function CustomerBankingSection(props: {
  disabled?: boolean;
  form: UseFormReturn<CustomerBankingFormValues>;
}) {
  const { disabled = false, form } = props;
  const errors = form.formState.errors as Record<string, unknown>;

  function setField<TPath extends Path<CustomerBankingFormValues>>(
    name: TPath,
    value: PathValue<CustomerBankingFormValues, TPath>,
  ) {
    form.setValue(name, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleChange(
    name: CustomerBankingFieldName,
    value: CustomerBankingFieldValue,
  ) {
    setField(
      name as Path<CustomerBankingFormValues>,
      value as PathValue<
        CustomerBankingFormValues,
        Path<CustomerBankingFormValues>
      >,
    );
  }

  return (
    <CustomerBankingFields
      disabled={disabled}
      errors={getBankingErrors(errors)}
      onChange={handleChange}
      searchBankProviders={searchCustomerBankProviders}
      toBankProviderSnapshot={createManualBankProvider}
      value={getBankingValue(form)}
    />
  );
}
