import { describe, expect, it } from "vitest";

import { findOrganizationBookOwnershipViolations } from "../../src/organizations/domain/book-ownership";

describe("organization book ownership", () => {
  it("detects missing books and non-organization owners", () => {
    const violations = findOrganizationBookOwnershipViolations({
      bookIds: ["book-1", "book-2", "book-3"],
      books: [
        { id: "book-1", ownerId: "org-1" },
        { id: "book-2", ownerId: "user-1" },
      ],
      organizationIds: ["org-1"],
    });

    expect(violations.missingBookIds).toEqual(["book-3"]);
    expect(violations.nonOrganizationOwners).toEqual([
      {
        bookId: "book-2",
        ownerId: "user-1",
      },
    ]);
  });
});
