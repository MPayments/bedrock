import {
  PrintFormDescriptorsSchema,
  type PrintFormDescriptor,
  type PrintFormFormat,
} from "./schemas";

export type PrintFormOwner =
  | {
      type: "agreement_version";
      agreementId: string;
      versionId: string;
    }
  | {
      type: "calculation";
      calculationId: string;
    }
  | {
      type: "deal";
      dealId: string;
    }
  | {
      type: "document";
      docType: string;
      documentId: string;
    };

export interface PrintFormClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
}

function ownerPath(owner: PrintFormOwner): string {
  switch (owner.type) {
    case "agreement_version":
      return `/agreements/${encodeURIComponent(owner.agreementId)}/versions/${encodeURIComponent(owner.versionId)}/print-forms`;
    case "calculation":
      return `/calculations/${encodeURIComponent(owner.calculationId)}/print-forms`;
    case "deal":
      return `/deals/${encodeURIComponent(owner.dealId)}/print-forms`;
    case "document":
      return `/documents/${encodeURIComponent(owner.docType)}/${encodeURIComponent(owner.documentId)}/print-forms`;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function buildPrintFormUrl(input: {
  baseUrl: string;
  format?: PrintFormFormat;
  formId?: string;
  owner: PrintFormOwner;
}): string {
  const path = ownerPath(input.owner);
  const suffix = input.formId ? `/${encodeURIComponent(input.formId)}` : "";
  const query = input.format ? `?format=${encodeURIComponent(input.format)}` : "";

  return joinUrl(input.baseUrl, `${path}${suffix}${query}`);
}

export async function listPrintForms(input: {
  client: PrintFormClientOptions;
  owner: PrintFormOwner;
}): Promise<PrintFormDescriptor[]> {
  const response = await fetch(
    buildPrintFormUrl({
      baseUrl: input.client.baseUrl,
      owner: input.owner,
    }),
    {
      credentials: input.client.credentials ?? "include",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load print forms");
  }

  return PrintFormDescriptorsSchema.parse(await response.json());
}

export function readFilenameFromContentDisposition(
  disposition: string | null,
): string | null {
  if (!disposition) {
    return null;
  }

  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    return decodeURIComponent(utf8[1]);
  }

  const simple = disposition.match(/filename="?([^";]+)"?/i);
  return simple?.[1] ? decodeURIComponent(simple[1]) : null;
}

export async function downloadResponseAsFile(input: {
  fallbackFileName: string;
  response: Response;
}): Promise<void> {
  const blob = await input.response.blob();
  const filename =
    readFilenameFromContentDisposition(
      input.response.headers.get("Content-Disposition"),
    ) ?? input.fallbackFileName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadPrintForm(input: {
  client: PrintFormClientOptions;
  fallbackFileName?: string;
  form: Pick<PrintFormDescriptor, "id" | "title">;
  format: PrintFormFormat;
  owner: PrintFormOwner;
}): Promise<void> {
  const response = await fetch(
    buildPrintFormUrl({
      baseUrl: input.client.baseUrl,
      formId: input.form.id,
      format: input.format,
      owner: input.owner,
    }),
    {
      credentials: input.client.credentials ?? "include",
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
      message?: unknown;
    } | null;
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : "Failed to download print form";
    throw new Error(message);
  }

  await downloadResponseAsFile({
    fallbackFileName:
      input.fallbackFileName ?? `${input.form.title}.${input.format}`,
    response,
  });
}
