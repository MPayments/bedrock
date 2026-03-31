import {
  applyLocalizedTemplateField,
} from "../localized-text";
import {
  formatCurrencyAmount,
  formatMoneyInWords,
  getCurrencySymbol,
} from "../russian-language";
import type { DocumentLang, OrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleInvoiceData(
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

  const baseCurrency = (calculation.baseCurrencyCode as string) || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);
  const totalInBase = calculation.totalWithExpensesInBase as string | number;

  const raw: Record<string, unknown> = {
    invoiceNumber: deal.id,
    contractNumber: contract.contractNumber,
    contractDate: contract.contractDate,
    dealContractNumber: deal.contractNumber,
    dealContractDate: deal.contractDate,
    inn: client.inn,
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    totalWithExpensesInBase: formatCurrencyAmount(totalInBase),
    totalBaseInWords: formatMoneyInWords(totalInBase, baseCurrency, lang),
    date: formattedDate,
    agentTaxId: organization.taxId,
    agentKpp: organization.kpp,
    agentInn: organization.inn,
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
  applyLocalizedTemplateField(raw, "agentName", organization, "name", lang);
  applyLocalizedTemplateField(raw, "agentAddress", organization, "address", lang);
  applyLocalizedTemplateField(raw, "agentCountry", organization, "country", lang);
  applyLocalizedTemplateField(raw, "agentCity", organization, "city", lang);
  return prune(raw);
}
