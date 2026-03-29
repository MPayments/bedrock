import type {
  RelationOption,
  RequisiteOwnerType,
} from "@/features/entities/requisites-shared/lib/constants";

import type { RequisiteFormOptions } from "./types";

type RequisiteOwnerPresentation = {
  ownerLabel: string;
  ownerDescription: string;
};

const OWNER_PRESENTATION_BY_TYPE: Record<
  RequisiteOwnerType,
  RequisiteOwnerPresentation
> = {
  counterparty: {
    ownerLabel: "Контрагент",
    ownerDescription:
      "Внешний получатель или контрагент, которому принадлежат реквизиты.",
  },
  organization: {
    ownerLabel: "Организация",
    ownerDescription:
      "Собственная организация, для которой хранятся реквизиты.",
  },
};

const DEFAULT_OWNER_PRESENTATION: RequisiteOwnerPresentation = {
  ownerLabel: "Владелец",
  ownerDescription: "Сначала выберите тип владельца.",
};

export function getRequisiteOwnerOptions(
  options: RequisiteFormOptions,
  ownerType?: RequisiteOwnerType,
): RelationOption[] {
  if (ownerType === "counterparty") {
    return options.counterpartyOwners;
  }

  if (ownerType === "organization") {
    return options.organizationOwners;
  }

  return [];
}

export function getRequisiteOwnerPresentation(
  ownerType?: RequisiteOwnerType,
): RequisiteOwnerPresentation {
  if (!ownerType) {
    return DEFAULT_OWNER_PRESENTATION;
  }

  return OWNER_PRESENTATION_BY_TYPE[ownerType];
}
