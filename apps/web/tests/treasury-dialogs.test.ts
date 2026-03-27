import { describe, expect, it } from "vitest";

import {
  buildExecutionEventDescriptors,
  buildExecutionInstructionDialogModel,
  buildInstructionSelectOption,
  buildPositionSettlementDialogModel,
} from "@/features/treasury/workbench/lib/dialogs";
import { getAllowedDestinationAccounts } from "@/features/treasury/workbench/lib/flows";

const accounts = [
  {
    id: "account-usd-org-a",
    assetId: "asset-usd",
    ownerEntityId: "org-a",
    operatorEntityId: "org-a",
    kind: "bank",
    provider: "provider-1",
    networkOrRail: null,
    accountReference: "main-usd",
    reconciliationMode: null,
    finalityModel: null,
    segregationModel: null,
    canReceive: true,
    canSend: true,
    metadata: { label: "Main USD" },
    createdAt: new Date("2026-03-27T10:00:00.000Z"),
    updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    archivedAt: null,
  },
  {
    id: "account-usd-org-b",
    assetId: "asset-usd",
    ownerEntityId: "org-b",
    operatorEntityId: "org-b",
    kind: "bank",
    provider: "provider-1",
    networkOrRail: null,
    accountReference: "group-usd",
    reconciliationMode: null,
    finalityModel: null,
    segregationModel: null,
    canReceive: true,
    canSend: true,
    metadata: { label: "Group USD" },
    createdAt: new Date("2026-03-27T10:00:00.000Z"),
    updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    archivedAt: null,
  },
  {
    id: "account-eur-org-a",
    assetId: "asset-eur",
    ownerEntityId: "org-a",
    operatorEntityId: "org-a",
    kind: "bank",
    provider: "provider-1",
    networkOrRail: null,
    accountReference: "main-eur",
    reconciliationMode: null,
    finalityModel: null,
    segregationModel: null,
    canReceive: true,
    canSend: true,
    metadata: { label: "Main EUR" },
    createdAt: new Date("2026-03-27T10:00:00.000Z"),
    updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    archivedAt: null,
  },
] as const;

describe("treasury dialog helpers", () => {
  it("keeps non-fx destination filtering inside domain-safe same-asset rules", () => {
    const sameEntity = getAllowedDestinationAccounts({
      accounts: [...accounts],
      kind: "intracompany_transfer",
      sourceAccountId: "account-usd-org-a",
      sourceAccount: accounts[0],
    });
    const crossEntity = getAllowedDestinationAccounts({
      accounts: [...accounts],
      kind: "intercompany_funding",
      sourceAccountId: "account-usd-org-a",
      sourceAccount: accounts[0],
    });
    const none = getAllowedDestinationAccounts({
      accounts: [...accounts],
      kind: "payout",
      sourceAccountId: "account-usd-org-a",
      sourceAccount: accounts[0],
    });

    expect(sameEntity.map((account) => account.id)).toEqual([]);
    expect(crossEntity.map((account) => account.id)).toEqual(["account-usd-org-b"]);
    expect(none).toEqual([]);
  });

  it("builds instruction dialog options only for same-asset endpoints", () => {
    const model = buildExecutionInstructionDialogModel({
      accounts: [...accounts],
      assetLabels: {
        "asset-usd": "USD",
        "asset-eur": "EUR",
      },
      counterpartyEndpoints: [
        {
          id: "cp-endpoint-usd",
          counterpartyId: "cp-1",
          endpointType: "iban",
          assetId: "asset-usd",
          label: "Counterparty USD",
          value: "AE00TESTUSD",
          memoTag: null,
          metadata: null,
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          archivedAt: null,
        },
        {
          id: "cp-endpoint-eur",
          counterpartyId: "cp-1",
          endpointType: "iban",
          assetId: "asset-eur",
          label: "Counterparty EUR",
          value: "AE00TESTEUR",
          memoTag: null,
          metadata: null,
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          archivedAt: null,
        },
      ],
      counterpartyLabels: {
        "cp-1": "Vendor",
      },
      operationTimeline: {
        operation: {
          id: "op-1",
          operationKind: "payout",
          sourceAmountMinor: "100000",
          sourceAssetId: "asset-usd",
          sourceAccountId: "account-usd-org-a",
        },
      } as any,
      treasuryEndpoints: [
        {
          id: "treasury-endpoint-usd",
          accountId: "account-usd-org-b",
          endpointType: "internal",
          label: "USD treasury route",
          value: "treasury-usd",
          memoTag: null,
          metadata: null,
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          archivedAt: null,
        },
        {
          id: "treasury-endpoint-eur",
          accountId: "account-eur-org-a",
          endpointType: "internal",
          label: "EUR treasury route",
          value: "treasury-eur",
          memoTag: null,
          metadata: null,
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          archivedAt: null,
        },
      ],
    });

    expect(model.endpointOptions.map((option) => option.id)).toEqual([
      "cp-endpoint-usd",
      "treasury-endpoint-usd",
    ]);
    expect(model.amountMajor).toBe("1000");
    expect(model.amountLabel).toContain("USD");
  });

  it("describes execution events and settlement dialogs in operator language", () => {
    const eventKinds = buildExecutionEventDescriptors().map((item) => item.kind);
    const instructionOption = buildInstructionSelectOption({
      amountMinor: "250000",
      assetCode: "USD",
      id: "instruction-1",
      routeLabel: "Контрагент · Vendor · iban",
      scenarioLabel: "Выплата",
      status: "reserved",
    });
    const settlementModel = buildPositionSettlementDialogModel({
      amountMinor: "125000",
      assetCode: "USD",
      kindLabel: "Обязательство перед клиентом",
      meaning: "Позиция держит остаток до внутреннего закрытия.",
      ownerLabel: "Multihansa",
      relatedPartyLabel: "Customer A",
    });

    expect(eventKinds).toEqual([
      "submitted",
      "accepted",
      "settled",
      "failed",
      "returned",
      "voided",
      "fee_charged",
      "manual_adjustment",
    ]);
    expect(instructionOption.label).toContain("Выплата");
    expect(instructionOption.description).toContain("USD");
    expect(settlementModel.facts[3]?.value).toContain("USD");
    expect(settlementModel.explanation.title).toContain("погашение");
  });
});
