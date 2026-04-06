import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../context";

type PartyOwnerRecord = {
  kind: "individual" | "legal_entity";
};

type PartyOwnerType = "counterparty" | "organization";

export async function replacePartyLegalEntityBundle(input: {
  bundle: PartyLegalEntityBundleInput;
  ctx: AppContext;
  ownerId: string;
  ownerType: PartyOwnerType;
  party: PartyOwnerRecord;
}) {
  if (input.party.kind !== "legal_entity") {
    throw new ValidationError(
      `${input.ownerType} ${input.ownerId} does not support legal entity master data`,
    );
  }

  return input.ctx.partiesModule.legalEntities.commands.replaceBundle({
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    bundle: input.bundle,
  });
}

export function mapPartyLegalEntityMutationError<TNotFound extends Error>(
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
