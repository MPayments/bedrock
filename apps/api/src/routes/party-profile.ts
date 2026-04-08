import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../context";

type PartyOwnerRecord = {
  kind: "individual" | "legal_entity";
};

type PartyOwnerType = "counterparty" | "organization";

export async function replacePartyProfileBundle(input: {
  bundle: PartyProfileBundleInput;
  ctx: AppContext;
  ownerId: string;
  ownerType: PartyOwnerType;
  party: PartyOwnerRecord;
}) {
  return input.ctx.partiesModule.partyProfiles.commands.replaceBundle({
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    bundle: input.bundle,
    partyKind: input.party.kind,
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
