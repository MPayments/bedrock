import type { BreadcrumbItem } from "@/lib/breadcrumbs";

import {
  getDocumentTypeLabel,
  isDocumentsWorkspaceFamily,
  isKnownDocumentType,
} from "./doc-types";
import { buildDocumentDetailsHref, buildDocumentTypeHref } from "./routes";

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

export function buildDocumentDetailsBreadcrumbItems(document: {
  docType: string;
  id: string;
  docNo: string;
  title: string;
  payload?: Record<string, unknown>;
}): BreadcrumbItem[] {
  const currentLabel =
    document.docNo.trim() || document.title.trim() || document.id;

  return [
    {
      label: "Документы",
      href: "/documents",
      icon: "book-open",
    },
    {
      label: getDocumentTypeLabel(document.docType, document.payload),
      href: buildDocumentTypeHref(document.docType) ?? "/documents",
    },
    {
      label: currentLabel,
      href: buildDocumentDetailsHref(document.docType, document.id) ?? undefined,
    },
  ];
}

export function resolveDocumentCreateBreadcrumbItems(
  segments: string[],
): BreadcrumbItem[] | null {
  const docType = segments[2];

  if (
    segments.length >= 3 &&
    segments[0] === "documents" &&
    segments[1] === "create" &&
    docType !== undefined &&
    isKnownDocumentType(docType)
  ) {
    return buildDocumentCreateBreadcrumbItems(docType);
  }

  return null;
}

export function getDocumentDetailsBreadcrumbParams(
  segments: string[],
): { docType: string; id: string } | null {
  const family = segments[1];
  const docType = segments[2];
  const id = segments[3];

  if (
    segments.length >= 4 &&
    segments[0] === "documents" &&
    family !== undefined &&
    isDocumentsWorkspaceFamily(family) &&
    docType !== undefined &&
    isKnownDocumentType(docType) &&
    id !== undefined
  ) {
    return { docType, id };
  }

  return null;
}
