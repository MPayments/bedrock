import type { SupportedLang } from "../localized-text";

export type DocumentFormat = "docx" | "pdf";
export type DocumentLang = SupportedLang;

export interface ImageContent {
  _type: "image";
  source: Buffer;
  format: "image/png";
  width?: number;
  height?: number;
}

export interface OrgFiles {
  signature: ImageContent;
  stamp: ImageContent;
}

export function bufferToImageContent(
  buffer: Buffer,
  width?: number,
  height?: number,
): ImageContent {
  return {
    _type: "image",
    source: buffer,
    format: "image/png",
    ...(width != null && { width }),
    ...(height != null && { height }),
  };
}

export function prune<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null),
  ) as Partial<T>;
}

export function formatDateByLang(date: Date, lang: DocumentLang): string {
  const locale = lang === "en" ? "en-US" : "ru-RU";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
