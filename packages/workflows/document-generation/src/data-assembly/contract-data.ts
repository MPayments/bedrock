import {
  applyLocalizedTemplateField,
  getLocalizedValue,
  withLocalizedTemplateFields,
} from "../localized-text";
import { declineBasisToGenitive, formatDirector } from "../russian-language";
import type {
  ClientContractAgreement,
  ClientContractClient,
  ClientContractOrganization,
  ClientContractOrganizationBankRequisite,
} from "../contracts";
import { resolveDocumentNumber } from "./document-number";
import type { DocumentLang, OrgFiles } from "./types";
import { prune } from "./types";

export function assembleClientContractData(
  client: ClientContractClient,
  agreement: ClientContractAgreement,
  organization: ClientContractOrganization,
  organizationRequisite: ClientContractOrganizationBankRequisite,
  orgFiles: OrgFiles,
  lang: DocumentLang,
): Record<string, unknown> {
  const contractNumber = resolveDocumentNumber(
    agreement.contractNumber,
    agreement.id,
  );
  const contractDate = agreement.contractDate || "";

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
    number: contractNumber,
    directorName: genitive,
    directorInitials: initials,
    directorBasis: directorBasisGenitive,
    inn: client.inn,
    kpp: client.kpp,
    account: client.account,
    corrAccount: client.corrAccount,
    bic: client.bic,
    agentFee: agreement.agentFee,
    fixedFee: agreement.fixedFee,
    date: contractDate,
    agentTaxId: organization.taxId,
    agentKpp: organization.kpp,
    agentInn: organization.inn,
    agentInitials,
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

  return prune(raw);
}
