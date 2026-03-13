import { describe, expect, it } from "vitest";

import * as documents from "../src/index";

describe("documents public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(documents.createDocumentsService).toBeTypeOf("function");
    expect(documents.createDocumentRegistry).toBeTypeOf("function");
    expect("createDocumentsWorkerDefinition" in documents).toBe(false);
  });
});
