import { describe, expect, it, vi } from "vitest";

import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "../../src/errors";
import { CreateOrganizationCommand } from "../../src/organizations/application/commands/create-organization";
import { RemoveOrganizationCommand } from "../../src/organizations/application/commands/remove-organization";
import { UpdateOrganizationCommand } from "../../src/organizations/application/commands/update-organization";

function createRuntime(overrides?: Record<string, unknown>) {
  return {
    generateUuid: () => "00000000-0000-4000-8000-000000000999",
    log: { info: vi.fn() },
    now: () => new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("organization command handlers", () => {
  it("creates an organization", async () => {
    const create = new CreateOrganizationCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            organizationStore: {
              create: vi.fn(async (organization: any) => ({
                ...organization,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              })),
            },
          } as any)),
      } as any,
    );

    const created = await create.execute({
      shortName: "Acme",
      fullName: "Acme Incorporated",
    });

    expect(created.shortName).toBe("Acme");
  });

  it("throws not found on update", async () => {
    const update = new UpdateOrganizationCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            organizationStore: {
              findById: vi.fn(async () => null),
            },
          } as any)),
      } as any,
    );

    await expect(
      update.execute("missing", { shortName: "Acme Updated" }),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
  });

  it("maps foreign key violations on remove", async () => {
    const remove = new RemoveOrganizationCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            organizationStore: {
              remove: vi.fn(async () => "conflict"),
            },
          } as any)),
      } as any,
    );

    await expect(remove.execute("org-1")).rejects.toBeInstanceOf(
      OrganizationDeleteConflictError,
    );
  });
});
