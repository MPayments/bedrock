import { describe, expect, it } from "vitest";

import {
  IFRS_DOCUMENT_METADATA,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "../../src/ifrs-documents";

describe("ifrs metadata", () => {
  it("defines all IFRS doc types with required fields", () => {
    expect(IFRS_DOCUMENT_TYPE_ORDER).toHaveLength(6);

    for (const docType of IFRS_DOCUMENT_TYPE_ORDER) {
      const metadata = IFRS_DOCUMENT_METADATA[docType];
      expect(metadata.docType).toBe(docType);
      expect(metadata.label.length).toBeGreaterThan(0);
      expect(["transfers", "ifrs"]).toContain(metadata.family);
      expect(metadata.docNoPrefix.length).toBeGreaterThan(0);
      expect(typeof metadata.creatable).toBe("boolean");
      expect(typeof metadata.hasTypedForm).toBe("boolean");
      expect(typeof metadata.adminOnly).toBe("boolean");
    }
  });

  it("uses unique docNoPrefix values", () => {
    const prefixes = IFRS_DOCUMENT_TYPE_ORDER.map(
      (docType) => IFRS_DOCUMENT_METADATA[docType].docNoPrefix,
    );
    const uniquePrefixes = new Set(prefixes);

    expect(uniquePrefixes.size).toBe(prefixes.length);
  });
});
