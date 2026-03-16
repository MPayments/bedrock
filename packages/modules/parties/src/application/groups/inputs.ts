import type { z } from "zod";

import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  CreateCounterpartyGroupInputSchema,
  UpdateCounterpartyGroupInputSchema,
} from "../../contracts";
import type {
  CreateCounterpartyGroupProps,
  CounterpartyGroupSnapshot,
  UpdateCounterpartyGroupProps,
} from "../../domain/counterparty-group";

type CreateCounterpartyGroupValues = z.output<
  typeof CreateCounterpartyGroupInputSchema
>;
type UpdateCounterpartyGroupPatch = z.output<
  typeof UpdateCounterpartyGroupInputSchema
>;

export function resolveCreateCounterpartyGroupProps(input: {
  id: string;
  values: CreateCounterpartyGroupValues;
}): CreateCounterpartyGroupProps {
  return {
    id: input.id,
    code: input.values.code,
    name: input.values.name,
    description: input.values.description,
    parentId: input.values.parentId,
    customerId: input.values.customerId,
    isSystem: false,
  };
}

export function resolveUpdateCounterpartyGroupProps(
  snapshot: CounterpartyGroupSnapshot,
  patch: UpdateCounterpartyGroupPatch,
): UpdateCounterpartyGroupProps {
  return {
    code: resolvePatchValue(snapshot.code, patch.code),
    name: resolvePatchValue(snapshot.name, patch.name),
    description: resolvePatchValue(snapshot.description, patch.description),
    parentId: resolvePatchValue(snapshot.parentId, patch.parentId),
    customerId: resolvePatchValue(snapshot.customerId, patch.customerId),
  };
}
