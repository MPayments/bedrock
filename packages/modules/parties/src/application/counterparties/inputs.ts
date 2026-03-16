import type { z } from "zod";

import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  CreateCounterpartyInputSchema,
  UpdateCounterpartyInputSchema,
} from "../../contracts";
import type {
  CreateCounterpartyProps,
  CounterpartySnapshot,
  UpdateCounterpartyProps,
} from "../../domain/counterparty";
import type { GroupHierarchy } from "../../domain/group-hierarchy";

type CreateCounterpartyValues = z.output<typeof CreateCounterpartyInputSchema>;
type UpdateCounterpartyPatch = z.output<typeof UpdateCounterpartyInputSchema>;

export function resolveCreateCounterpartyProps(input: {
  id: string;
  values: CreateCounterpartyValues;
}): CreateCounterpartyProps {
  return {
    id: input.id,
    externalId: input.values.externalId,
    customerId: input.values.customerId,
    shortName: input.values.shortName,
    fullName: input.values.fullName,
    description: input.values.description,
    country: input.values.country,
    kind: input.values.kind,
    groupIds: input.values.groupIds,
  };
}

export function resolveUpdateCounterpartyProps(
  snapshot: CounterpartySnapshot,
  patch: UpdateCounterpartyPatch,
  hierarchy: GroupHierarchy,
): UpdateCounterpartyProps {
  return {
    externalId: resolvePatchValue(snapshot.externalId, patch.externalId),
    customerId: resolvePatchValue(snapshot.customerId, patch.customerId),
    shortName: resolvePatchValue(snapshot.shortName, patch.shortName),
    fullName: resolvePatchValue(snapshot.fullName, patch.fullName),
    description: resolvePatchValue(snapshot.description, patch.description),
    country: resolvePatchValue(snapshot.country, patch.country),
    kind: resolvePatchValue(snapshot.kind, patch.kind),
    groupIds:
      patch.groupIds !== undefined
        ? patch.groupIds
        : patch.customerId !== undefined
          ? hierarchy.withoutCustomerScopedGroups(snapshot.groupIds)
          : snapshot.groupIds,
  };
}
