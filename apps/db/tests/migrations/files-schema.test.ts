import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("files migration baseline", () => {
  it("creates attachment visibility enum and column for file links", async () => {
    const migrationsDir = resolve(import.meta.dirname, "../../migrations");
    const [migrationFile] = (await readdir(migrationsDir))
      .filter((entry) => entry.endsWith(".sql"))
      .sort();
    const migration = await readFile(
      resolve(migrationsDir, migrationFile),
      "utf8",
    );

    expect(migration).toContain('CREATE TYPE "public"."file_attachment_visibility"');
    expect(migration).toContain('CREATE TYPE "public"."file_attachment_purpose"');
    expect(migration).toContain(
      '"attachment_visibility" "file_attachment_visibility"',
    );
    expect(migration).toContain('"file_links"."attachment_visibility" is not null');
    expect(migration).toContain('"file_links"."attachment_visibility" is null');
  });
});
