import {
  getDocumentsWorkspaceFamily,
  type DocumentsWorkspaceFamily,
} from "./doc-types";

type DocumentCreateRouteOptions = {
  dealId?: string;
  invoicePurpose?: "combined" | "principal" | "agency_fee" | null;
  reconciliationExceptionId?: string;
  returnTo?: string;
};

type DocumentDetailsRouteOptions = {
  reconciliationExceptionId?: string;
  returnTo?: string;
};

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Return-to URL for a deal workbench. The finance workbench is a single tab-less
 * view after the 2026-04-23 redesign; the legacy `?tab=documents` query is no
 * longer needed. Name preserved for call-site compatibility.
 */
export function buildDealDocumentsTabHref(dealId: string): string {
  return `/treasury/deals/${encodeSegment(dealId)}`;
}

export function normalizeInternalReturnToPath(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//")
  ) {
    return null;
  }

  return normalized;
}

export function buildDocumentsFamilyHref(
  family: DocumentsWorkspaceFamily,
): string {
  return `/documents/${encodeSegment(family)}`;
}

export function buildDocumentTypeHref(docType: string): string | null {
  const family = getDocumentsWorkspaceFamily(docType);
  if (!family) {
    return null;
  }

  return `${buildDocumentsFamilyHref(family)}?docType=${encodeSegment(docType)}`;
}

export function buildDocumentCreateHref(
  docType: string,
  options?: DocumentCreateRouteOptions,
): string | null {
  const family = getDocumentsWorkspaceFamily(docType);
  if (!family) {
    return null;
  }

  const href = `/documents/create/${encodeSegment(docType)}`;
  const query = new URLSearchParams();

  if (options?.dealId) {
    query.set("dealId", options.dealId);
  }

  if (options?.invoicePurpose) {
    query.set("invoicePurpose", options.invoicePurpose);
  }

  if (options?.reconciliationExceptionId) {
    query.set(
      "reconciliationExceptionId",
      options.reconciliationExceptionId,
    );
  }

  if (options?.returnTo) {
    query.set("returnTo", options.returnTo);
  }

  const search = query.toString();
  return search ? `${href}?${search}` : href;
}

export function buildDocumentDetailsHref(
  docType: string,
  id: string,
  options?: DocumentDetailsRouteOptions,
): string | null {
  const family = getDocumentsWorkspaceFamily(docType);
  if (!family) {
    return null;
  }

  const href = `${buildDocumentsFamilyHref(family)}/${encodeSegment(docType)}/${encodeSegment(id)}`;
  const query = new URLSearchParams();

  if (options?.reconciliationExceptionId) {
    query.set(
      "reconciliationExceptionId",
      options.reconciliationExceptionId,
    );
  }

  if (options?.returnTo) {
    query.set("returnTo", options.returnTo);
  }

  const search = query.toString();
  return search ? `${href}?${search}` : href;
}
