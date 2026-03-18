import { describe, expect, it } from "vitest";

import { relabelOrganizationBookNames } from "../../src/composition/book-labels";

describe("book label composition", () => {
  it("relabels UUID-based default organization book names with short names", () => {
    const result = relabelOrganizationBookNames({
      books: [
        {
          id: "book-1",
          name: "Organization 00000000-0000-4000-8000-000000000310 default book",
          ownerId: "00000000-0000-4000-8000-000000000310",
        },
        {
          id: "book-2",
          name: "Treasury operational book",
          ownerId: "00000000-0000-4000-8000-000000000310",
        },
      ],
      organizationShortNamesById: new Map([
        ["00000000-0000-4000-8000-000000000310", "BEDROCK"],
      ]),
    });

    expect(result).toEqual([
      {
        id: "book-1",
        name: "Organization BEDROCK default book",
        ownerId: "00000000-0000-4000-8000-000000000310",
      },
      {
        id: "book-2",
        name: "Treasury operational book",
        ownerId: "00000000-0000-4000-8000-000000000310",
      },
    ]);
  });
});
