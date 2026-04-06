import type { Counterparty, CounterpartyListItem } from "@bedrock/parties/contracts";
import type { PartyLegalEntityBundleSource } from "@bedrock/sdk-parties-ui/lib/legal-entity";

import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedCounterparty = Omit<
  CounterpartyListItem,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedCounterpartyDetails = Omit<
  Counterparty,
  "createdAt" | "updatedAt" | "legalEntity"
> & {
  legalEntity: PartyLegalEntityBundleSource | null;
  createdAt: string;
  updatedAt: string;
};

export type CounterpartiesListResult = ListResult<SerializedCounterparty>;
