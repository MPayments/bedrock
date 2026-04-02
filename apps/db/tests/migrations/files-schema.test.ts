import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("files migration baseline", () => {
  it("creates attachment visibility enum and column for file links", async () => {
    const migration = await readFile(
      resolve(
        import.meta.dirname,
        "../../migrations/0003_fancy_jack_power.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE TYPE "public"."file_attachment_visibility"');
    expect(migration).toContain(
      'ALTER TABLE "file_links" ADD COLUMN "attachment_visibility" "file_attachment_visibility";',
    );
    expect(migration).toContain('"file_links"."attachment_visibility" is not null');
    expect(migration).toContain('"file_links"."attachment_visibility" is null');
  });
});
