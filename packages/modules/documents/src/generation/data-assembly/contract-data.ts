import type { ClientContractAgreement, DocumentLocalizedText } from "../contracts";
import {
  applyLocalizedTemplateField,
  getLocalizedValue,
  withLocalizedTemplateFields,
} from "../localized-text";
import { declineBasisToGenitive, formatDirector } from "../russian-language";
import { resolveDocumentNumber } from "./document-number";
import type { DocumentLang, PartialOrgFiles } from "./types";
import { prune } from "./types";

export interface ContractClientData {
  account: string | null;
  address: string | null;
  addressI18n?: DocumentLocalizedText | null;
  bankAddress: string | null;
  bankAddressI18n?: DocumentLocalizedText | null;
  bankName: string | null;
  bankNameI18n?: DocumentLocalizedText | null;
  bic: string | null;
  corrAccount: string | null;
  directorBasis: string | null;
  directorBasisI18n?: DocumentLocalizedText | null;
  directorName: string | null;
  directorNameI18n?: DocumentLocalizedText | null;
  id: string;
  inn: string | null;
  kpp: string | null;
  orgName: string;
  orgNameI18n?: DocumentLocalizedText | null;
  orgType: string | null;
  orgTypeI18n?: DocumentLocalizedText | null;
}

export interface ContractOrganizationData {
  address: string | null;
  addressI18n?: DocumentLocalizedText | null;
  city: string | null;
  cityI18n?: DocumentLocalizedText | null;
  country: string | null;
  countryI18n?: DocumentLocalizedText | null;
  directorName: string | null;
  directorNameI18n?: DocumentLocalizedText | null;
  id: string;
  inn: string | null;
  kpp: string | null;
  name: string | null;
  nameI18n?: DocumentLocalizedText | null;
  sealKey: string | null;
  signatureKey: string | null;
  taxId: string | null;
}

export interface ContractOrganizationRequisiteData {
  accountNo: string | null;
  bic: string | null;
  corrAccount: string | null;
  currencyCode: string;
  id: string;
  institutionName: string | null;
  institutionNameI18n?: DocumentLocalizedText | null;
  ownerId: string;
  swift: string | null;
}

export function assembleClientContractData(
  client: ContractClientData,
  agreement: ClientContractAgreement,
  organization: ContractOrganizationData,
  organizationRequisite: ContractOrganizationRequisiteData,
  orgFiles: PartialOrgFiles,
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
    agentAddress: organization.address,
    agentCity: organization.city,
    agentCountry: organization.country,
    agentName: organization.name,
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
    showSignature: Boolean(orgFiles.signature),
    showStamp: Boolean(orgFiles.stamp),
    ...(orgFiles.signature ? { signature: orgFiles.signature } : {}),
    ...(orgFiles.stamp ? { stamp: orgFiles.stamp } : {}),
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
  applyLocalizedTemplateField(
    raw,
    "agentBankName",
    organizationRequisite,
    "institutionName",
    lang,
  );

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
