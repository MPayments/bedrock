import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("commercial documents normalization migration", () => {
  it("normalizes legacy invoice and acceptance payloads", async () => {
    const migration = await readFile(
      resolve(
        import.meta.dirname,
        "../../migrations/0009_swanky_galactus.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('WHERE "doc_type" = \'invoice\'');
    expect(migration).toContain('"payload" ->> \'mode\' = \'exchange\'');
    expect(migration).toContain('"payload" ->> \'mode\' = \'direct\'');
    expect(migration).toContain('UPDATE "document_snapshots"');
    expect(migration).toContain('WHERE "doc_type" = \'acceptance\'');
    expect(migration).toContain('"payload" ? \'invoiceMode\'');
  });
});
