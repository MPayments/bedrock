import type { Transaction } from "@bedrock/platform/persistence";

import type { RequisiteOwnerType } from "../../contracts";

export interface RequisitesCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface RequisitesOwnersPort {
  assertOrganizationExists: (organizationId: string) => Promise<void>;
  assertCounterpartyExists: (counterpartyId: string) => Promise<void>;
}

export interface RequisitesOrganizationBindingsPort {
  syncOrganizationRequisiteBinding: (
    tx: Transaction,
    input: {
      requisiteId: string;
      organizationId: string;
      currencyCode: string;
    },
  ) => Promise<void>;
}

export interface RequisitesOwnerDirectoryPort {
  assertOwnerExists: (
    ownerType: RequisiteOwnerType,
    ownerId: string,
  ) => Promise<void>;
}
