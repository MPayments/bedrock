import {
  formatFractionDecimal,
  parseDecimalToFraction,
} from "@bedrock/shared/money";

import {
  applyLocalizedTemplateField,
  getLocalizedValue,
  withLocalizedTemplateFields,
} from "../localized-text";
import {
  formatCurrencyAmount,
  formatDirector,
  formatMoneyInWords,
  getCurrencySymbol,
} from "../russian-language";
import { resolveDocumentNumber } from "./document-number";
import type { DocumentLang, PartialOrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

function formatIsoDateByLang(
  value: unknown,
  lang: DocumentLang,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const locale = lang === "en" ? "en-US" : "ru-RU";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function multiplyDecimalStrings(
  amount: string | number | undefined | null,
  rate: string | number | undefined | null,
  scale = 2,
): string {
  if (
    amount === undefined ||
    amount === null ||
    amount === "" ||
    rate === undefined ||
    rate === null ||
    rate === ""
  ) {
    return "0";
  }
  const amountStr = typeof amount === "number" ? amount.toString() : amount;
  const rateStr = typeof rate === "number" ? rate.toString() : rate;
  if (amountStr === "0" || amountStr === "0.00") return "0";
  try {
    const a = parseDecimalToFraction(amountStr);
    const r = parseDecimalToFraction(rateStr);
    return formatFractionDecimal(a.num * r.num, a.den * r.den, {
      scale,
      trimTrailingZeros: false,
    });
  } catch {
    return "0";
  }
}

export function assembleAcceptanceData(
  deal: Record<string, unknown>,
  calculation: Record<string, unknown>,
  client: Record<string, unknown>,
  contract: Record<string, unknown>,
  organization: Record<string, unknown>,
  organizationRequisite: Record<string, unknown>,
  orgFiles: PartialOrgFiles,
  date: Date,
  lang: DocumentLang,
): Record<string, unknown> {
  const formattedDate = formatDateByLang(date, lang);

  const clientDirectorName =
    getLocalizedValue(client, "directorName", lang) || "";
  const agentDirectorName =
    getLocalizedValue(organization, "directorName", lang) || "";

  const { genitive, initials } = formatDirector(clientDirectorName, lang);
  const { initials: agentDirectorInitials, genitive: agentDirectorGenitive } =
    formatDirector(agentDirectorName, lang);

  const baseCurrency = (calculation.baseCurrencyCode as string) || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);
  const totalFeeInBase = calculation.totalFeeAmountInBase as string | number;
  const originalAmountInBaseDecimal = multiplyDecimalStrings(
    calculation.originalAmount as string | number | undefined,
    (calculation.finalRate ?? calculation.rate) as
      | string
      | number
      | undefined,
  );
  const totalAmountInBase = calculation.totalInBase as string | number;
  const acceptanceNumber = resolveDocumentNumber(
    deal.acceptanceNumber,
    deal.id,
  );
  const contractNumber = resolveDocumentNumber(contract.contractNumber, contract.id);
  const dealContractNumber = resolveDocumentNumber(
    deal.contractNumber,
    deal.contractId ?? deal.id,
  );
  const dealInvoiceNumber = resolveDocumentNumber(
    deal.invoiceNumber,
    deal.invoiceId ?? deal.id,
  );

  const raw: Record<string, unknown> = {
    acceptanceNumber,
    number: acceptanceNumber,
    contractNumber,
    contractDate: formatIsoDateByLang(contract.contractDate, lang),
    dealContractNumber,
    dealContractDate: formatIsoDateByLang(deal.contractDate, lang),
    dealInvoiceNumber,
    dealInvoiceDate: formatIsoDateByLang(deal.invoiceDate, lang),
    directorName: genitive,
    directorInitials: initials,
    inn: client.inn,
    kpp: client.kpp,
    ogrn: client.ogrn,
    currencyCode: calculation.currencyCode,
    rate: calculation.rate,
    finalRate: calculation.finalRate ?? calculation.rate,
    originalAmount: formatCurrencyAmount(calculation.originalAmount as string | number),
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    originalAmountInBase: formatCurrencyAmount(originalAmountInBaseDecimal),
    totalAmountInBase: formatCurrencyAmount(totalAmountInBase),
    agreementFeePercentage: calculation.agreementFeePercentage,
    agreementFeeAmount: formatCurrencyAmount(
      calculation.agreementFeeAmount as string | number,
    ),
    quoteMarkupPercentage: calculation.quoteMarkupPercentage,
    quoteMarkupAmount: formatCurrencyAmount(
      calculation.quoteMarkupAmount as string | number,
    ),
    totalFeePercentage: calculation.totalFeePercentage,
    totalFeeAmount: formatCurrencyAmount(
      calculation.totalFeeAmount as string | number,
    ),
    totalFeeAmountInBase: formatCurrencyAmount(totalFeeInBase),
    totalFeeAmountInBaseWords: formatMoneyInWords(
      totalFeeInBase,
      baseCurrency,
      lang,
    ),
    fixedFeeAmount: formatCurrencyAmount(
      calculation.fixedFeeAmount as string | number,
    ),
    fixedFeeCurrencyCode: calculation.fixedFeeCurrencyCode,
    additionalExpensesInBase: formatCurrencyAmount(
      calculation.additionalExpensesInBase as string | number,
    ),
    createdAt: formattedDate,
    date: formattedDate,
    agentTaxId: organization.taxId,
    agentKpp: organization.kpp,
    agentInn: organization.inn,
    agentInitials: agentDirectorInitials,
    agentDirectorName: agentDirectorGenitive,
    agentBankAccount: organizationRequisite.accountNo,
    agentBankBic: organizationRequisite.bic,
    agentBankCorrAccount: organizationRequisite.corrAccount,
    agentBankCurrencyCode: organizationRequisite.currencyCode,
    agentBankName: organizationRequisite.institutionName,
    agentBankSwiftCode: organizationRequisite.swift,
    signature: orgFiles.signature,
    stamp: orgFiles.stamp,
  };

  applyLocalizedTemplateField(raw, "companyName", deal, "companyName", lang);
  applyLocalizedTemplateField(raw, "orgName", client, "orgName", lang);
  applyLocalizedTemplateField(raw, "orgType", client, "orgType", lang);
  applyLocalizedTemplateField(raw, "address", client, "address", lang);
  applyLocalizedTemplateField(raw, "agentName", organization, "name", lang);
  applyLocalizedTemplateField(raw, "agentAddress", organization, "address", lang);
  applyLocalizedTemplateField(raw, "agentCountry", organization, "country", lang);
  applyLocalizedTemplateField(raw, "agentCity", organization, "city", lang);
  applyLocalizedTemplateField(
    raw,
    "agentBankName",
    organizationRequisite,
    "institutionName",
    lang,
  );
  withLocalizedTemplateFields(raw, "directorName", {
    ru: formatDirector(getLocalizedValue(client, "directorName", "ru") || "", "ru").genitive,
    en: getLocalizedValue(client, "directorName", "en") || getLocalizedValue(client, "directorName", "ru"),
  }, lang);

  withLocalizedTemplateFields(raw, "agentDirectorName", {
    ru: formatDirector(getLocalizedValue(organization, "directorName", "ru") || "", "ru").genitive,
    en: getLocalizedValue(organization, "directorName", "en") || getLocalizedValue(organization, "directorName", "ru"),
  }, lang);

  return prune(raw);
}
