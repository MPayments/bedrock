import { describe, expect, it } from "vitest";

import {
  AccountingPeriod,
  CalendarMonth,
} from "../../src/domain/periods";

describe("accounting periods domain", () => {
  it("normalizes calendar month boundaries", () => {
    const month = CalendarMonth.fromDate(new Date("2026-03-15T12:30:00.000Z"));

    expect(month.start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(month.endExclusive.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(month.previous().label).toBe("2026-02");
  });

  it("plans reopen transitions and supersedes the latest close package", () => {
    const month = CalendarMonth.fromDate(new Date("2026-03-10T00:00:00.000Z"));
    const period = AccountingPeriod.reconstitute({
      organizationId: "org-1",
      month,
      lock: null,
      latestClosePackage: {
        id: "pkg-1",
        organizationId: "org-1",
        periodStart: month.start,
        periodEnd: month.endExclusive,
        revision: 3,
        state: "closed",
        closeDocumentId: "doc-close",
        reopenDocumentId: null,
        checksum: "checksum-1",
        payload: {},
        generatedAt: new Date("2026-04-01T00:00:00.000Z"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    const plan = period.planReopen({
      reopenedBy: "user-1",
      reopenReason: "late adjustment",
      reopenedAt: new Date("2026-04-02T00:00:00.000Z"),
      reopenDocumentId: "doc-reopen",
    });

    expect(plan.lock).toEqual({
      organizationId: "org-1",
      periodStart: month.start,
      periodEnd: month.endExclusive,
      reopenedBy: "user-1",
      reopenReason: "late adjustment",
      reopenedAt: new Date("2026-04-02T00:00:00.000Z"),
    });
    expect(plan.supersededClosePackage).toEqual(
      expect.objectContaining({
        id: "pkg-1",
        state: "superseded",
        reopenDocumentId: "doc-reopen",
      }),
    );
  });
});
