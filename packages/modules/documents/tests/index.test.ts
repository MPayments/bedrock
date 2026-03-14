import { describe, expect, it } from "vitest";

import * as documents from "../src/index";

describe("documents public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(documents.createDocumentsService).toBeTypeOf("function");
    expect("createDocumentRegistry" in documents).toBe(false);
    expect("createDocumentsWorkerDefinition" in documents).toBe(false);
  });
});
