import type { KnownDocumentType } from "./doc-types";
import {
  getDocumentsWorkspaceFamily,
  type DocumentsWorkspaceFamily,
} from "./doc-types";

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
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

export function buildDocumentCreateHref(docType: string): string | null {
  const family = getDocumentsWorkspaceFamily(docType);
  if (!family) {
    return null;
  }

  return `${buildDocumentsFamilyHref(family)}/${encodeSegment(docType)}/create`;
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

export function isDocumentInFamily(
  docType: string,
  family: DocumentsWorkspaceFamily,
): docType is KnownDocumentType {
  return getDocumentsWorkspaceFamily(docType) === family;
}
