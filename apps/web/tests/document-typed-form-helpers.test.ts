import { describe, expect, it } from "vitest";

import { filterFxDestinationRequisiteOptions } from "@/features/documents/components/forms/document-typed-form/helpers";

describe("document typed form helpers", () => {
  it("filters fx destination requisites to different ids and different currencies", () => {
    const options = [
      {
        id: "req-usd-source",
        label: "Source USD",
        currencyId: "currency-usd",
      },
      {
        id: "req-usd-other",
        label: "Other USD",
        currencyId: "currency-usd",
      },
      {
        id: "req-eur",
        label: "Destination EUR",
        currencyId: "currency-eur",
      },
    ];

    const filtered = filterFxDestinationRequisiteOptions({
      accountCurrencyCodeById: new Map([
        ["req-usd-source", "USD"],
        ["req-usd-other", "USD"],
        ["req-eur", "EUR"],
      ]),
      docType: "fx_execute",
      fieldName: "destinationRequisiteId",
      options,
      sourceRequisiteId: "req-usd-source",
    });

    expect(filtered).toEqual([
      {
        id: "req-eur",
        label: "Destination EUR",
        currencyId: "currency-eur",
      },
    ]);
  });

  it("does not filter unrelated account fields", () => {
    const options = [
      {
        id: "req-1",
        label: "Same currency is okay outside FX destination",
        currencyId: "currency-usd",
      },
    ];

    expect(
      filterFxDestinationRequisiteOptions({
        accountCurrencyCodeById: new Map([["req-1", "USD"]]),
        docType: "payment_order",
        fieldName: "sourceRequisiteId",
        options,
        sourceRequisiteId: "req-1",
      }),
    ).toEqual(options);
  });
});
