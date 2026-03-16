import type { z } from "zod";

import { resolvePatchValue } from "@bedrock/shared/core";

import {
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
} from "../../contracts";
import type {
  CreateCustomerProps,
  CustomerSnapshot,
  UpdateCustomerProps,
} from "../../domain/customer";

type CreateCustomerValues = z.output<typeof CreateCustomerInputSchema>;
type UpdateCustomerPatch = z.output<typeof UpdateCustomerInputSchema>;

export function resolveCreateCustomerProps(input: {
  id: string;
  values: CreateCustomerValues;
}): CreateCustomerProps {
  return {
    id: input.id,
    externalRef: input.values.externalRef,
    displayName: input.values.displayName,
    description: input.values.description,
  };
}

export function resolveUpdateCustomerProps(
  snapshot: CustomerSnapshot,
  patch: UpdateCustomerPatch,
): UpdateCustomerProps {
  return {
    externalRef: resolvePatchValue(snapshot.externalRef, patch.externalRef),
    displayName: resolvePatchValue(snapshot.displayName, patch.displayName),
    description: resolvePatchValue(snapshot.description, patch.description),
  };
}
