import type { BreadcrumbItem } from "@/lib/breadcrumbs";

import { getDocumentTypeLabel } from "./doc-types";
import { buildDocumentTypeHref } from "./routes";

export function buildDocumentCreateBreadcrumbItems(
  docType: string,
): BreadcrumbItem[] {
  return [
    {
      label: "Документы",
      href: "/documents",
      icon: "book-open",
    },
    {
      label: getDocumentTypeLabel(docType),
      href: buildDocumentTypeHref(docType) ?? "/documents",
    },
    {
      label: "Новый документ",
    },
  ];
}
