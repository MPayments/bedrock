import type { Counterparty, CounterpartyListItem } from "@bedrock/parties/contracts";
import type { PartyProfileBundleSource } from "@bedrock/sdk-parties-ui/lib/party-profile";

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
  "createdAt" | "updatedAt" | "partyProfile"
> & {
  partyProfile: PartyProfileBundleSource | null;
  createdAt: string;
  updatedAt: string;
};

export type CounterpartiesListResult = ListResult<SerializedCounterparty>;
