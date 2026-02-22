"use client";

import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { useOrganizationCreateDraftName } from "@/app/(shell)/entities/organizations/lib/create-draft-name-context";

export default function CreateOrganizationBreadcrumbPage() {
  const { createLabel } = useOrganizationCreateDraftName();

  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Справочники",
          icon: "book-open",
        },
        {
          label: "Организации",
          href: "/entities/organizations",
          icon: "building-2",
        },
        {
          label: createLabel,
          href: "/entities/organizations/create",
        },
      ]}
    />
  );
}
