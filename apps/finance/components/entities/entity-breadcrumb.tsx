"use client";

import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import type { BreadcrumbIconName } from "@/lib/breadcrumbs";

type EntityBreadcrumbProps = {
  entityLabel: string;
  entityHref: string;
  entityIcon: BreadcrumbIconName;
  currentLabel: string;
  currentHref: string;
};

function buildEntityBreadcrumbItems({
  entityLabel,
  entityHref,
  entityIcon,
  currentLabel,
  currentHref,
}: EntityBreadcrumbProps) {
  return [
    {
      label: "Справочники",
      icon: "book-open" as const,
    },
    {
      label: entityLabel,
      href: entityHref,
      icon: entityIcon,
    },
    {
      label: currentLabel,
      href: currentHref,
    },
  ];
}

export function EntityCreateBreadcrumb(props: EntityBreadcrumbProps) {
  return <DynamicBreadcrumb items={buildEntityBreadcrumbItems(props)} />;
}

export function EntityEditBreadcrumb(props: EntityBreadcrumbProps) {
  return <DynamicBreadcrumb items={buildEntityBreadcrumbItems(props)} />;
}
