import { describe, expect, it } from "vitest";

import { RequisiteProvider } from "../src/domain/requisite-provider";

describe("requisite provider domain", () => {
  it("requires swift for non-Russian banks", () => {
    expect(() =>
      RequisiteProvider.create({
        id: "00000000-0000-4000-8000-000000000001",
        now: new Date("2026-03-15T00:00:00.000Z"),
        kind: "bank",
        name: "Core Bank",
        description: null,
        country: "US",
        address: null,
        contact: null,
        bic: null,
        swift: null,
      }),
    ).toThrow(/swift is required for non-Russian banks/);
  });

  it("rejects bic for blockchain providers", () => {
    const provider = RequisiteProvider.create({
      id: "00000000-0000-4000-8000-000000000001",
      now: new Date("2026-03-15T00:00:00.000Z"),
      kind: "blockchain",
      name: "Chain Desk",
      description: null,
      country: null,
      address: null,
      contact: null,
      bic: null,
      swift: null,
    });
    const current = provider.toSnapshot();

    expect(() =>
      provider.update({
        kind: current.kind,
        name: current.name,
        description: current.description,
        country: current.country,
        address: current.address,
        contact: current.contact,
        bic: "044525225",
        swift: current.swift,
        now: new Date("2026-03-16T00:00:00.000Z"),
      }),
    ).toThrow(/bic is only allowed for bank providers/);
  });
});
