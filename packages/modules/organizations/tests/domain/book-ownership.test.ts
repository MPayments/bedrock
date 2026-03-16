import { describe, expect, it } from "vitest";

import {
  findOrganizationBookOwnershipViolations,
} from "../../src/domain/book-ownership";

describe("findOrganizationBookOwnershipViolations", () => {
  it("returns missing and non-organization-owned books", () => {
    const violations = findOrganizationBookOwnershipViolations({
      bookIds: ["book-1", "book-2", "book-3", "book-1"],
      books: [
        { id: "book-1", ownerId: "org-1" },
        { id: "book-2", ownerId: "counterparty-1" },
      ],
      organizationIds: ["org-1"],
    });

    expect(violations).toEqual({
      missingBookIds: ["book-3"],
      nonOrganizationOwners: [
        {
          bookId: "book-2",
          ownerId: "counterparty-1",
        },
      ],
    });
  });

  it("returns no violations for organization-owned books", () => {
    const violations = findOrganizationBookOwnershipViolations({
      bookIds: ["book-1"],
      books: [{ id: "book-1", ownerId: "org-1" }],
      organizationIds: ["org-1"],
    });

    expect(violations).toEqual({
      missingBookIds: [],
      nonOrganizationOwners: [],
    });
  });
});
