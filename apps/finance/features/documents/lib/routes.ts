import {
  getDocumentsWorkspaceFamily,
  type DocumentsWorkspaceFamily,
} from "./doc-types";

type DocumentCreateRouteOptions = {
  dealId?: string;
  returnTo?: string;
};

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function buildDealDocumentsTabHref(dealId: string): string {
  return `/treasury/deals/${encodeSegment(dealId)}?tab=documents`;
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

  if (options?.returnTo) {
    query.set("returnTo", options.returnTo);
  }

  const search = query.toString();
  return search ? `${href}?${search}` : href;
}

export function buildDocumentDetailsHref(
  docType: string,
  id: string,
): string | null {
  const family = getDocumentsWorkspaceFamily(docType);
  if (!family) {
    return null;
  }

  return `${buildDocumentsFamilyHref(family)}/${encodeSegment(docType)}/${encodeSegment(id)}`;
}
