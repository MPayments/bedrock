import { invariant } from "@bedrock/shared/core/domain";

import type {
  CounterpartyEndpointRecord,
  TreasuryAccountRecord,
  TreasuryEndpointRecord,
} from "../../shared/application/core-ports";

export function assertTreasuryAccountValid(account: {
  accountReference: string;
  ownerEntityId: string;
  operatorEntityId: string;
}) {
  invariant(account.accountReference.trim().length > 0, "accountReference is required", {
    code: "treasury.account.reference_required",
  });
  invariant(account.ownerEntityId.trim().length > 0, "ownerEntityId is required", {
    code: "treasury.account.owner_required",
  });
  invariant(
    account.operatorEntityId.trim().length > 0,
    "operatorEntityId is required",
    {
      code: "treasury.account.operator_required",
    },
  );
}

export function assertTreasuryEndpointValid(endpoint: {
  accountId: string;
  endpointType: string;
  value: string;
}) {
  invariant(endpoint.accountId.trim().length > 0, "accountId is required", {
    code: "treasury.endpoint.account_required",
  });
  invariant(endpoint.endpointType.trim().length > 0, "endpointType is required", {
    code: "treasury.endpoint.type_required",
  });
  invariant(endpoint.value.trim().length > 0, "value is required", {
    code: "treasury.endpoint.value_required",
  });
}

export function assertCounterpartyEndpointValid(endpoint: {
  counterpartyId: string;
  endpointType: string;
  value: string;
}) {
  invariant(
    endpoint.counterpartyId.trim().length > 0,
    "counterpartyId is required",
    {
      code: "treasury.counterparty_endpoint.counterparty_required",
    },
  );
  invariant(endpoint.endpointType.trim().length > 0, "endpointType is required", {
    code: "treasury.counterparty_endpoint.type_required",
  });
  invariant(endpoint.value.trim().length > 0, "value is required", {
    code: "treasury.counterparty_endpoint.value_required",
  });
}

export function computeAvailableBalance(input: {
  pendingMinor: bigint;
  reservedMinor: bigint;
  bookedMinor: bigint;
}) {
  return input.bookedMinor + input.pendingMinor + input.reservedMinor;
}

export type TreasuryAccountSnapshot = TreasuryAccountRecord;
export type TreasuryEndpointSnapshot = TreasuryEndpointRecord;
export type CounterpartyEndpointSnapshot = CounterpartyEndpointRecord;
