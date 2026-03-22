import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import {
  AccountingPackVersion,
  CompiledPack,
  compilePack,
  hydrateCompiledPack,
  serializeCompiledPack,
} from "../../src/packs/domain";
import { rawPackDefinition } from "../../src/packs/bedrock-core-default";

describe("accounting packs domain", () => {
  it("compiles and hydrates into a compiled pack entity", () => {
    const compiled = compilePack(rawPackDefinition);
    const hydrated = hydrateCompiledPack(
      serializeCompiledPack(compiled).compiledJson,
      compiled.checksum,
    );

    expect(compiled).toBeInstanceOf(CompiledPack);
    expect(hydrated).toBeInstanceOf(CompiledPack);
    expect(hydrated.checksum).toBe(compiled.checksum);
  });

  it("rejects replacing an assigned version with a different checksum", () => {
    const compiled = compilePack(rawPackDefinition);
    const version = AccountingPackVersion.fromCompiledPack(compiled);

    expect(() =>
      version.assertCanReplace("different-checksum", true),
    ).toThrowError(DomainError);
  });
});
