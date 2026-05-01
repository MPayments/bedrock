import {
  applyLocalizedTemplateField,
  getLocalizedValue,
  withLocalizedTemplateFields,
} from "../localized-text";
import {
  declineBasisToGenitive,
  formatCurrencyAmount,
  formatDirector,
  getCurrencySymbol,
} from "../russian-language";
import { resolveDocumentNumber } from "./document-number";
import type { DocumentLang, PartialOrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleApplicationData(
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
  const clientDirectorBasis =
    getLocalizedValue(client, "directorBasis", lang) || "";
  const agentDirectorName =
    getLocalizedValue(organization, "directorName", lang) || "";

  const { genitive, initials } = formatDirector(clientDirectorName, lang);
  const directorBasisGenitive = declineBasisToGenitive(clientDirectorBasis, lang);
  const { initials: agentDirectorInitials, genitive: agentDirectorGenitive } =
    formatDirector(agentDirectorName, lang);

  const baseCurrency = (calculation.baseCurrencyCode as string) || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);
  const paymentCurrency =
    (calculation.paymentCurrencyCode as string | undefined) ??
    (calculation.currencyCode as string) ??
    "RUB";
  const paymentAmount =
    (calculation.paymentAmount as string | number | undefined) ??
    (calculation.originalAmount as string | number | undefined) ??
    "0";
  const applicationNumber = resolveDocumentNumber(deal.applicationNumber, deal.id);
  const contractNumber = resolveDocumentNumber(contract.contractNumber, contract.id);
  const dealContractNumber = resolveDocumentNumber(
    deal.contractNumber,
    deal.contractId ?? deal.id,
  );
  const dealInvoiceNumberRaw = resolveDocumentNumber(
    deal.invoiceNumber,
    deal.invoiceId ?? deal.id,
  );
  const dealInvoiceNumber =
    typeof dealInvoiceNumberRaw === "string"
      ? dealInvoiceNumberRaw.toUpperCase()
      : dealInvoiceNumberRaw;

  const raw: Record<string, unknown> = {
    applicationNumber,
    number: applicationNumber,
    directorName: genitive,
    directorInitials: initials,
    directorBasis: directorBasisGenitive,
    contractNumber,
    contractDate: contract.contractDate,
    dealContractNumber,
    dealContractDate: deal.contractDate,
    dealInvoiceNumber,
    dealInvoiceDate: deal.invoiceDate,
    account: deal.account,
    bankName: deal.bankName,
    swiftCode: deal.swiftCode,
    siwftCode: deal.swiftCode,
    iban: deal.iban,
    beneficiaryName: deal.beneficiaryName,
    beneficiaryAccount: deal.beneficiaryAccount,
    paymentPurpose: deal.paymentPurpose,
    currencyCode: paymentCurrency,
    originalAmount: formatCurrencyAmount(paymentAmount),
    totalAmount: formatCurrencyAmount(calculation.totalAmount as string | number),
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
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    additionalExpensesInBase: formatCurrencyAmount(
      calculation.additionalExpensesInBase as string | number,
    ),
    totalWithExpensesInBase: formatCurrencyAmount(
      calculation.totalWithExpensesInBase as string | number,
    ),
    totalWithExpensesInRub: formatCurrencyAmount(
      calculation.totalWithExpensesInBase as string | number,
    ),
    totalFeeAmountInBase: formatCurrencyAmount(
      calculation.totalFeeAmountInBase as string | number,
    ),
    fixedFeeAmount: formatCurrencyAmount(
      calculation.fixedFeeAmount as string | number,
    ),
    fixedFeeCurrencyCode: calculation.fixedFeeCurrencyCode,
    finalRate: calculation.finalRate ?? calculation.rate,
    rate: calculation.rate,
    originalInBase: formatCurrencyAmount(
      calculation.totalInBase as string | number,
    ),
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

  applyLocalizedTemplateField(raw, "orgName", client, "orgName", lang);
  applyLocalizedTemplateField(raw, "orgType", client, "orgType", lang);
  applyLocalizedTemplateField(raw, "companyName", deal, "companyName", lang);
  applyLocalizedTemplateField(raw, "bankName", deal, "bankName", lang);
  applyLocalizedTemplateField(raw, "bankAddress", client, "bankAddress", lang);
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

  withLocalizedTemplateFields(raw, "directorBasis", {
    ru: declineBasisToGenitive(getLocalizedValue(client, "directorBasis", "ru") || "", "ru"),
    en: getLocalizedValue(client, "directorBasis", "en") || getLocalizedValue(client, "directorBasis", "ru"),
  }, lang);

  withLocalizedTemplateFields(raw, "agentDirectorName", {
    ru: formatDirector(getLocalizedValue(organization, "directorName", "ru") || "", "ru").genitive,
    en: getLocalizedValue(organization, "directorName", "en") || getLocalizedValue(organization, "directorName", "ru"),
  }, lang);

  withLocalizedTemplateFields(raw, "agentDirectorBasis", {
    ru: declineBasisToGenitive(getLocalizedValue(organization, "directorBasis", "ru") || "", "ru"),
    en: getLocalizedValue(organization, "directorBasis", "en") || getLocalizedValue(organization, "directorBasis", "ru"),
  }, lang);

  return prune(raw);
}
