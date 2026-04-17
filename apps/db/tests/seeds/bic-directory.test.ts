import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "../../src/schema-registry";
import { seedBicDirectory } from "../../src/seeds/bic-directory";

const FIXTURE_PATH = resolve(
  import.meta.dirname,
  "fixtures",
  "bic-directory-sample.xml",
);

interface MockState {
  existingBics: { providerId: string; normalizedValue: string }[];
  existingPrimaryBranches: { branchId: string; providerId: string }[];
  inserts: Record<string, unknown[]>;
  deletes: Record<string, unknown[]>;
}

function tableName(table: unknown): string {
  if (table === schema.requisiteProviders) return "requisiteProviders";
  if (table === schema.requisiteProviderIdentifiers) {
    return "requisiteProviderIdentifiers";
  }
  if (table === schema.requisiteProviderBranches) {
    return "requisiteProviderBranches";
  }
  if (table === schema.requisiteProviderBranchIdentifiers) {
    return "requisiteProviderBranchIdentifiers";
  }
  return "unknown";
}

function makeChain(state: MockState, name: string, args: unknown) {
  const list = Array.isArray(args) ? args : [args];
  state.inserts[name] = state.inserts[name] ?? [];
  state.inserts[name].push(...list);
  const node: Record<string, unknown> = {
    onConflictDoUpdate: vi.fn(async () => undefined),
    then: (resolveFn: (value: undefined) => unknown) => resolveFn(undefined),
  };
  return node;
}

function createMockDb(state: MockState) {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async () => {
          if (table === schema.requisiteProviderIdentifiers) {
            return state.existingBics;
          }
          if (table === schema.requisiteProviderBranches) {
            return state.existingPrimaryBranches;
          }
          return [];
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => {
      const name = tableName(table);
      return {
        values: vi.fn((values: unknown) => makeChain(state, name, values)),
      };
    }),
    delete: vi.fn((table: unknown) => {
      const name = tableName(table);
      state.deletes[name] = state.deletes[name] ?? [];
      return {
        where: vi.fn(async () => {
          state.deletes[name].push(true);
          return undefined;
        }),
      };
    }),
  };
}

describe("seedBicDirectory", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const originalSkip = process.env.BIC_DIRECTORY_SKIP;

  beforeEach(() => {
    delete process.env.BIC_DIRECTORY_SKIP;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    if (originalSkip === undefined) {
      delete process.env.BIC_DIRECTORY_SKIP;
    } else {
      process.env.BIC_DIRECTORY_SKIP = originalSkip;
    }
  });

  it("inserts active root providers, primary branches, and resolves child branches against parents", async () => {
    const state: MockState = {
      existingBics: [],
      existingPrimaryBranches: [],
      inserts: {},
      deletes: {},
    };
    const db = createMockDb(state);

    await seedBicDirectory(db as never, { sourceFile: FIXTURE_PATH });

    const providers = state.inserts.requisiteProviders ?? [];
    const branches = state.inserts.requisiteProviderBranches ?? [];
    const providerIdentifiers =
      state.inserts.requisiteProviderIdentifiers ?? [];
    const branchIdentifiers =
      state.inserts.requisiteProviderBranchIdentifiers ?? [];

    // 2 root entries with PSAC status; the 1 inactive (PSDL) entry is filtered out
    expect(providers).toHaveLength(2);
    expect(
      providers.map((row) => (row as { displayName: string }).displayName),
    ).toEqual(["Bank One", "Bank Two"]);

    // 2 root primary branches + 1 child branch (parent BIC=044525001 exists)
    // The orphan child (parent BIC=999999999 missing) is skipped
    expect(branches).toHaveLength(3);
    const primaryCount = branches.filter(
      (row) => (row as { isPrimary: boolean }).isPrimary,
    ).length;
    expect(primaryCount).toBe(2);

    // Bank One has CRSA corr account → bic + corr_account identifiers (=2)
    // Bank Two has no Accounts → bic only (=1)
    expect(providerIdentifiers).toHaveLength(3);
    expect(
      providerIdentifiers.filter(
        (row) => (row as { scheme: string }).scheme === "corr_account",
      ),
    ).toHaveLength(1);

    // Branch identifiers: bank one root (bic + corr), bank two root (bic),
    // bank one SPB child (bic + corr) = 5
    expect(branchIdentifiers).toHaveLength(5);

    // Each provider/branch insert is preceded by a delete on its identifiers
    expect(state.deletes.requisiteProviderIdentifiers).toHaveLength(2);
    expect(state.deletes.requisiteProviderBranchIdentifiers).toHaveLength(3);
  });

  it("rebuilds root branch identifiers when the provider BIC already exists", async () => {
    // Pretend Bank One and Bank Two already exist with these provider IDs
    const state: MockState = {
      existingBics: [
        { providerId: "existing-1", normalizedValue: "044525001" },
        { providerId: "existing-2", normalizedValue: "044525002" },
      ],
      existingPrimaryBranches: [
        { branchId: "branch-existing-1", providerId: "existing-1" },
        { branchId: "branch-existing-2", providerId: "existing-2" },
      ],
      inserts: {},
      deletes: {},
    };
    const db = createMockDb(state);

    await seedBicDirectory(db as never, { sourceFile: FIXTURE_PATH });

    // No root providers re-inserted
    expect(state.inserts.requisiteProviders ?? []).toHaveLength(0);
    expect(state.inserts.requisiteProviderIdentifiers ?? []).toHaveLength(3);

    // Root primary branches are refreshed for existing providers, and the
    // active child branch is still upserted against its resolved parent.
    const branches = state.inserts.requisiteProviderBranches ?? [];
    expect(branches).toHaveLength(3);
    expect(
      branches
        .filter((row) => (row as { isPrimary: boolean }).isPrimary)
        .map((row) => (row as { id: string }).id),
    ).toEqual(["branch-existing-1", "branch-existing-2"]);

    expect(state.inserts.requisiteProviderBranchIdentifiers ?? []).toHaveLength(
      5,
    );
    expect(state.deletes.requisiteProviderBranchIdentifiers).toHaveLength(3);
  });

  it("honors BIC_DIRECTORY_SKIP=1 and exits without touching the database", async () => {
    process.env.BIC_DIRECTORY_SKIP = "1";

    const state: MockState = {
      existingBics: [],
      existingPrimaryBranches: [],
      inserts: {},
      deletes: {},
    };
    const db = createMockDb(state);

    await seedBicDirectory(db as never, { sourceFile: FIXTURE_PATH });

    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
});
