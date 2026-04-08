import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "@bedrock/shared/core/errors";

import { createLegalEntitiesService } from "../../src/legal-entities/application";

describe("legal entities service", () => {
  it("rejects duplicate identifier schemes before persistence", async () => {
    const run = vi.fn();
    const service = createLegalEntitiesService({
      commandUow: { run } as any,
      reads: {
        findBundleByOwner: vi.fn(),
        findProfileByOwner: vi.fn(),
        listIdentifiersByOwner: vi.fn(),
        findAddressByOwner: vi.fn(),
        listContactsByOwner: vi.fn(),
        listRepresentativesByOwner: vi.fn(),
        listLicensesByOwner: vi.fn(),
      } as any,
      runtime: {} as any,
    });

    await expect(
      service.commands.replaceIdentifiers({
        ownerType: "organization",
        ownerId: "org-1",
        items: [
          { scheme: "inn", value: "123" },
          { scheme: "inn", value: "456" },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(run).not.toHaveBeenCalled();
  });
});
