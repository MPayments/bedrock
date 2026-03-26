import {
  formatDirector,
  declineBasisToGenitive,
} from "../russian-language";
import {
  applyLocalizedTemplateField,
  getLocalizedValue,
  withLocalizedTemplateFields,
} from "../localized-text";
import type { DocumentLang, OrgFiles } from "./types";
import { prune } from "./types";

export function assembleClientContractData(
  client: Record<string, unknown>,
  contract: Record<string, unknown>,
  organization: Record<string, unknown>,
  organizationBank: Record<string, unknown>,
  orgFiles: OrgFiles,
  lang: DocumentLang,
): Record<string, unknown> {
  const contractNumber =
    (contract.contractNumber as string) || String(client.id);
  const contractDate =
    (contract.contractDate as string) || "";

  const clientDirectorName =
    getLocalizedValue(client, "directorName", lang) || "";
  const clientDirectorBasis =
    getLocalizedValue(client, "directorBasis", lang) || "";
  const agentDirectorName =
    getLocalizedValue(organization, "directorName", lang) || "";

  const { genitive, initials } = formatDirector(clientDirectorName, lang);
  const directorBasisGenitive = declineBasisToGenitive(
    clientDirectorBasis,
    lang,
  );
  const { initials: agentInitials } = formatDirector(agentDirectorName, lang);

  const raw: Record<string, unknown> = {
    contractNumber,
    directorName: genitive,
    directorInitials: initials,
    directorBasis: directorBasisGenitive,
    inn: client.inn,
    kpp: client.kpp,
    account: client.account,
    corrAccount: client.corrAccount,
    bic: client.bic,
    agentFee: contract.agentFee,
    fixedFee: contract.fixedFee,
    date: contractDate,
    agentTaxId: organization.taxId,
    agentKpp: organization.kpp,
    agentInn: organization.inn,
    agentInitials,
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
  applyLocalizedTemplateField(raw, "address", client, "address", lang);
  applyLocalizedTemplateField(raw, "bankName", client, "bankName", lang);
  applyLocalizedTemplateField(raw, "bankAddress", client, "bankAddress", lang);

  withLocalizedTemplateFields(raw, "directorName", {
    ru: formatDirector(
      getLocalizedValue(client, "directorName", "ru") || "",
      "ru",
    ).genitive,
    en:
      getLocalizedValue(client, "directorName", "en") ||
      getLocalizedValue(client, "directorName", "ru"),
  }, lang);

  withLocalizedTemplateFields(raw, "directorBasis", {
    ru: declineBasisToGenitive(
      getLocalizedValue(client, "directorBasis", "ru") || "",
      "ru",
    ),
    en:
      getLocalizedValue(client, "directorBasis", "en") ||
      getLocalizedValue(client, "directorBasis", "ru"),
  }, lang);

  applyLocalizedTemplateField(raw, "agentName", organization, "name", lang);
  applyLocalizedTemplateField(raw, "agentAddress", organization, "address", lang);
  applyLocalizedTemplateField(raw, "agentCountry", organization, "country", lang);
  applyLocalizedTemplateField(raw, "agentCity", organization, "city", lang);

  withLocalizedTemplateFields(raw, "agentDirectorName", {
    ru: formatDirector(
      getLocalizedValue(organization, "directorName", "ru") || "",
      "ru",
    ).genitive,
    en:
      getLocalizedValue(organization, "directorName", "en") ||
      getLocalizedValue(organization, "directorName", "ru"),
  }, lang);

  applyLocalizedTemplateField(raw, "agentBankName", organizationBank, "bankName", lang);

  return prune(raw);
}
