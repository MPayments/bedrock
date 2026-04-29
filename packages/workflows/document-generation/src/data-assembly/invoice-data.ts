import {
  applyLocalizedTemplateField,
} from "../localized-text";
import {
  formatCurrencyAmount,
  formatMoneyInWords,
  getCurrencySymbol,
} from "../russian-language";
import { resolveDocumentNumber } from "./document-number";
import type { DocumentLang, PartialOrgFiles } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleInvoiceData(
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

  const baseCurrency = (calculation.currencyCode as string) || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);
  const totalInBase = calculation.totalAmount as string | number;
  const invoiceNumber = resolveDocumentNumber(deal.invoiceNumber, deal.id);
  const contractNumber = resolveDocumentNumber(contract.contractNumber, contract.id);
  const dealContractNumber = resolveDocumentNumber(
    deal.contractNumber,
    deal.contractId ?? deal.id,
  );

  const agentKind = organization.kind as
    | "individual"
    | "legal_entity"
    | undefined;
  const isIndividualEntrepreneur = agentKind === "individual";
  const isOrganization = agentKind === "legal_entity";

  const raw: Record<string, unknown> = {
    invoiceNumber,
    number: invoiceNumber,
    contractNumber,
    contractDate: contract.contractDate,
    dealContractNumber,
    dealContractDate: deal.contractDate,
    inn: client.inn,
    clientKpp: client.kpp,
    memo: deal.memo,
    isIndividualEntrepreneur,
    isOrganization,
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
    showSignature: orgFiles.signature != null,
    showStamp: orgFiles.stamp != null,
  };

  applyLocalizedTemplateField(raw, "orgName", client, "orgName", lang);
  applyLocalizedTemplateField(raw, "orgType", client, "orgType", lang);
  applyLocalizedTemplateField(raw, "orgAddress", client, "address", lang);
  applyLocalizedTemplateField(raw, "companyName", deal, "companyName", lang);
  applyLocalizedTemplateField(raw, "agentName", organization, "name", lang);
  applyLocalizedTemplateField(
    raw,
    "agentDirectorName",
    organization,
    "directorName",
    lang,
  );
  applyLocalizedTemplateField(
    raw,
    "agentDirectorTitle",
    organization,
    "directorTitle",
    lang,
  );
  applyLocalizedTemplateField(
    raw,
    "agentDirectorBasis",
    organization,
    "directorBasis",
    lang,
  );
  applyLocalizedTemplateField(raw, "agentAddress", organization, "address", lang);
  applyLocalizedTemplateField(raw, "agentCountry", organization, "country", lang);
  applyLocalizedTemplateField(raw, "agentCity", organization, "city", lang);
  applyLocalizedTemplateField(
    raw,
    "agentBankCity",
    organizationRequisite,
    "city",
    lang,
  );
  applyLocalizedTemplateField(
    raw,
    "agentBankName",
    organizationRequisite,
    "institutionName",
    lang,
  );
  applyLocalizedTemplateField(
    raw,
    "agentBankAddress",
    organizationRequisite,
    "address",
    lang,
  );
  return prune(raw);
}
