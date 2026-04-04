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
import type { DocumentLang, OrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleAcceptanceData(
  deal: Record<string, unknown>,
  calculation: Record<string, unknown>,
  client: Record<string, unknown>,
  contract: Record<string, unknown>,
  organization: Record<string, unknown>,
  organizationRequisite: Record<string, unknown>,
  orgFiles: OrgFiles,
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
  const feeInBase = calculation.feeAmountInBase as string | number;
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
    contractDate: contract.contractDate,
    dealContractNumber,
    dealContractDate: deal.contractDate,
    dealInvoiceNumber,
    dealInvoiceDate: deal.invoiceDate,
    directorName: genitive,
    directorInitials: initials,
    inn: client.inn,
    kpp: client.kpp,
    ogrn: client.ogrn,
    currencyCode: calculation.currencyCode,
    rate: calculation.rate,
    originalAmount: formatCurrencyAmount(calculation.originalAmount as string | number),
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    originalAmountInBase: formatCurrencyAmount(
      calculation.totalInBase as string | number,
    ),
    feeAmountInBase: formatCurrencyAmount(feeInBase),
    feeAmountInBaseWords: formatMoneyInWords(feeInBase, baseCurrency, lang),
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
