"use client";

import { useCustomerDraftName } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

export default function CreateCustomerBreadcrumbPage() {
  const { createLabel } = useCustomerDraftName();

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
          label: createLabel,
          href: "/entities/customers/create",
        },
      ]}
    />
  );
}
