import { z } from "zod";

import {
  CustomerLegalEntitiesQuerySchema,
  ParticipantLookupQuerySchema,
  ParticipantLookupResponseSchema,
} from "./contracts";
import { getRouteComposerLookupContext } from "./lookup-context";
import type { ParticipantReads } from "./ports/participant.reads";

const CustomerIdSchema = z.uuid();

export interface ParticipantsServiceDeps {
  reads: ParticipantReads;
}

export function createParticipantsService(deps: ParticipantsServiceDeps) {
  async function lookup(input: unknown) {
    const query = ParticipantLookupQuerySchema.parse(input);
    return ParticipantLookupResponseSchema.parse({
      data: await deps.reads.lookup(query),
    });
  }

  async function listCustomerLegalEntities(input: {
    customerId: string;
    query: unknown;
  }) {
    const customerId = CustomerIdSchema.parse(input.customerId);
    const query = CustomerLegalEntitiesQuerySchema.parse(input.query);

    return ParticipantLookupResponseSchema.parse({
      data: await deps.reads.listCustomerLegalEntities({
        customerId,
        query,
      }),
    });
  }

  async function getLookupContext() {
    return getRouteComposerLookupContext();
  }

  return {
    queries: {
      getLookupContext,
      listCustomerLegalEntities,
      lookup,
    },
  };
}

export type ParticipantsService = ReturnType<typeof createParticipantsService>;
