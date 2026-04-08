import {
  CounterpartyNotFoundError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../context";

interface PartyOwnerRecord {
  kind: "individual" | "legal_entity";
}

type PartyOwnerType = "counterparty" | "organization";

function requirePartyOwner(input: {
  ownerId: string;
  ownerType: PartyOwnerType;
  party: PartyOwnerRecord | null;
}) {
  if (input.party) {
    return input.party;
  }

  if (input.ownerType === "counterparty") {
    throw new CounterpartyNotFoundError(input.ownerId);
  }

  throw new OrganizationNotFoundError(input.ownerId);
}

export async function replacePartyProfileBundle(input: {
  bundle: PartyProfileBundleInput;
  ctx: AppContext;
  ownerId: string;
  ownerType: PartyOwnerType;
  party: PartyOwnerRecord | null;
}) {
  const party = requirePartyOwner(input);

  return input.ctx.partiesModule.partyProfiles.commands.replaceBundle({
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    bundle: input.bundle,
    partyKind: party.kind,
  });
}

export function mapPartyProfileMutationError<TNotFound extends Error>(
  error: unknown,
  notFoundCtor: new (...args: never[]) => TNotFound,
) {
  if (error instanceof notFoundCtor) {
    return { status: 404 as const, body: { error: error.message } };
  }

  if (error instanceof ValidationError) {
    return { status: 400 as const, body: { error: error.message } };
  }

  return null;
}
