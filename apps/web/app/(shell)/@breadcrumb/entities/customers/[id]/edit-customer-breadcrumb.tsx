"use client";

import { useCustomerDraftName } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

type EditCustomerBreadcrumbProps = {
  customerId: string;
  initialLabel: string;
};

export function EditCustomerBreadcrumb({
  customerId,
  initialLabel,
}: EditCustomerBreadcrumbProps) {
  const { getEditLabel } = useCustomerDraftName();

  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Справочники",
          icon: "book-open",
        },
        {
          label: "Клиенты",
          href: "/entities/customers",
          icon: "users",
        },
        {
          label: getEditLabel(customerId, initialLabel),
          href: `/entities/customers/${customerId}`,
        },
      ]}
    />
  );
}
