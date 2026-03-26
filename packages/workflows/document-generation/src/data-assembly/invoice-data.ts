import {
  formatCurrencyAmount,
  formatMoneyInWords,
  getCurrencySymbol,
} from "../russian-language";
import { applyLocalizedTemplateField } from "../localized-text";
import type { DocumentLang, OrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleInvoiceData(
  deal: Record<string, unknown>,
  calculation: Record<string, unknown>,
  client: Record<string, unknown>,
  contract: Record<string, unknown>,
  organization: Record<string, unknown>,
  organizationBank: Record<string, unknown>,
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
    agentBankAccount: organizationBank.account,
    agentBankBic: organizationBank.bic,
    agentBankCorrAccount: organizationBank.corrAccount,
    agentBankSwiftCode: organizationBank.swiftCode,
    agentBankCurrencyCode: organizationBank.currencyCode,
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
  applyLocalizedTemplateField(raw, "agentBankName", organizationBank, "bankName", lang);

  return prune(raw);
}
