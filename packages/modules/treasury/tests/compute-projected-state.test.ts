import { describe, expect, it } from "vitest";

import { computeOperationProjectedState } from "../src/operations/domain/compute-projected-state";

describe("computeOperationProjectedState", () => {
  it("returns planned when no relevant documents have been posted", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payin",
        postedDocuments: [],
      }),
    ).toBe("planned");
  });

  it("ignores documents that don't apply to the operation kind", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payin",
        postedDocuments: [
          { docType: "transfer_intra" },
          { docType: "fx_execute" },
        ],
      }),
    ).toBe("planned");
  });

  it("promotes payin to in_progress once an invoice is posted", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payin",
        postedDocuments: [{ docType: "invoice" }],
      }),
    ).toBe("in_progress");
  });

  it("promotes payin to settled when payin_funding is posted", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payin",
        postedDocuments: [
          { docType: "invoice" },
          { docType: "payin_funding" },
        ],
      }),
    ).toBe("settled");
  });

  it("promotes fx_conversion from in_progress (fx_execute) to settled (fx_resolution)", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "fx_conversion",
        postedDocuments: [{ docType: "fx_execute" }],
      }),
    ).toBe("in_progress");

    expect(
      computeOperationProjectedState({
        operationKind: "fx_conversion",
        postedDocuments: [
          { docType: "fx_execute" },
          { docType: "fx_resolution" },
        ],
      }),
    ).toBe("settled");
  });

  it("projects transfer_intra → intracompany_transfer settled", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "intracompany_transfer",
        postedDocuments: [{ docType: "transfer_intra" }],
      }),
    ).toBe("settled");
  });

  it("projects transfer_intercompany → intercompany_funding settled", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "intercompany_funding",
        postedDocuments: [{ docType: "transfer_intercompany" }],
      }),
    ).toBe("settled");
  });

  it("projects payout void over settle (void wins precedence)", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payout",
        postedDocuments: [
          { docType: "payout_initiate" },
          { docType: "payout_settle" },
          { docType: "payout_void" },
        ],
      }),
    ).toBe("voided");
  });

  it("projects payout settled when only initiate + settle are posted", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payout",
        postedDocuments: [
          { docType: "payout_initiate" },
          { docType: "payout_settle" },
        ],
      }),
    ).toBe("settled");
  });

  it("projects payout in_progress when only initiate is posted", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payout",
        postedDocuments: [{ docType: "payout_initiate" }],
      }),
    ).toBe("in_progress");
  });

  it("ignores unknown docTypes without throwing", () => {
    expect(
      computeOperationProjectedState({
        operationKind: "payin",
        postedDocuments: [
          { docType: "unknown_doctype" },
          { docType: "invoice" },
        ],
      }),
    ).toBe("in_progress");
  });
});
