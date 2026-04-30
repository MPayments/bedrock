import type { Logger } from "@bedrock/platform/observability/logger";

import {
  formatGost56042Payload,
  type GostPayloadInput,
} from "./gost-r-56042";
import { renderGost56042Qr } from "./render";
import { TRANSPARENT_QR_FALLBACK } from "./transparent-fallback";
import {
  bufferToImageContent,
  type ImageContent,
} from "../data-assembly/types";

export interface BuildInvoiceQrInput {
  lang: "ru" | "en";
  deal: Record<string, unknown>;
  calculation: Record<string, unknown>;
  organization: Record<string, unknown>;
  organizationRequisite: Record<string, unknown>;
}

export interface BuildInvoiceQrDeps {
  logger: Logger;
}

const BIC_RE = /^04\d{7}$/;
const ACCOUNT_RE = /^\d{20}$/;
const CORR_ACCOUNT_RE = /^301\d{17}$/;
const INN_RE = /^\d{10}$|^\d{12}$/;

const QR_PLACEHOLDER_WIDTH = 217;
const QR_PLACEHOLDER_HEIGHT = 217;

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export async function buildInvoiceQrIfEligible(
  input: BuildInvoiceQrInput,
  deps: BuildInvoiceQrDeps,
): Promise<ImageContent> {
  if (input.lang !== "ru") {
    return TRANSPARENT_QR_FALLBACK;
  }

  const currencyCode = asString(input.calculation.currencyCode);
  if (currencyCode !== "RUB") {
    return TRANSPARENT_QR_FALLBACK;
  }

  const bic = asString(input.organizationRequisite.bic);
  const accountNo = asString(input.organizationRequisite.accountNo);
  const corrAccount = asString(input.organizationRequisite.corrAccount);
  const inn = asString(input.organization.inn);
  const name = asString(input.organization.name);
  const bankName = asString(input.organizationRequisite.institutionName);

  if (
    bic == null ||
    !BIC_RE.test(bic) ||
    accountNo == null ||
    !ACCOUNT_RE.test(accountNo) ||
    corrAccount == null ||
    !CORR_ACCOUNT_RE.test(corrAccount) ||
    inn == null ||
    !INN_RE.test(inn) ||
    name == null ||
    bankName == null
  ) {
    return TRANSPARENT_QR_FALLBACK;
  }

  const payloadInput: GostPayloadInput = {
    name,
    personalAcc: accountNo,
    bankName,
    bic,
    correspAcc: corrAccount,
    payeeINN: inn,
    kpp: asString(input.organization.kpp) ?? undefined,
    sum: asString(input.calculation.totalAmount) ?? undefined,
    purpose: asString(input.deal.memo) ?? undefined,
    docNo: asString(input.deal.invoiceNumber) ?? undefined,
  };

  try {
    const payload = formatGost56042Payload(payloadInput);
    const buffer = await renderGost56042Qr(payload);
    return bufferToImageContent(
      buffer,
      QR_PLACEHOLDER_WIDTH,
      QR_PLACEHOLDER_HEIGHT,
    );
  } catch (error) {
    deps.logger.warn(
      "Failed to build invoice QR, falling back to transparent placeholder",
      {
        error: error instanceof Error ? error.message : "Unknown QR error",
        dealId: asString(input.deal.id),
        organizationId: asString(input.organization.id),
        organizationRequisiteId: asString(input.organizationRequisite.id),
      },
    );
    return TRANSPARENT_QR_FALLBACK;
  }
}
