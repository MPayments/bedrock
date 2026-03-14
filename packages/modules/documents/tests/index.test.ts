import { describe, expect, it } from "vitest";

import * as documents from "../src/index";

describe("documents public exports", () => {
  it("keeps non-root surfaces off the root barrel", () => {
    expect(documents.createDocumentsService).toBeTypeOf("function");
    expect("createDocumentRegistry" in documents).toBe(false);
    expect("DocumentModuleRuntime" in documents).toBe(false);
    expect("DocumentModule" in documents).toBe(false);
    expect("createDocumentsWorkerDefinition" in documents).toBe(false);
  });
});
