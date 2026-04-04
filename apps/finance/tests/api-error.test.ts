import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resolveApiErrorMessage } from "@/lib/api-error";

describe("resolveApiErrorMessage", () => {
  it("extracts legacy field validation messages", () => {
    expect(
      resolveApiErrorMessage(400, {
        details: {
          fieldErrors: {
            counterpartyId: ["Counterparty is required"],
          },
        },
        error: "Validation error",
      }, "fallback"),
    ).toBe("Counterparty is required");
  });

  it("extracts the first message from treeified zod errors", () => {
    const schema = z.object({
      dimensionFilters: z.object({
        counterpartyId: z.array(z.string().uuid()).min(1),
      }),
    });
    const parsed = schema.safeParse({
      dimensionFilters: {
        counterpartyId: ["not-a-uuid"],
      },
    });

    if (parsed.success) {
      throw new Error("Expected invalid parse result");
    }

    expect(
      resolveApiErrorMessage(
        400,
        {
          details: z.treeifyError(parsed.error),
          error: "Validation error",
        },
        "fallback",
      ),
    ).toContain("Invalid UUID");
  });
});
