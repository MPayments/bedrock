import { describe, expect, it } from "vitest";

import {
    QuoteExpiredError,
    RateNotFoundError,
    RateSourceStaleError,
    RateSourceSyncError,
} from "../src/errors";

describe("Treasury errors", () => {
    it("creates typed domain errors with stable names", () => {
        const notFound = new RateNotFoundError("missing");
        const expired = new QuoteExpiredError("expired");
        const sync = new RateSourceSyncError("cbr", "sync failed");
        const stale = new RateSourceStaleError("cbr");

        expect(notFound.name).toBe("RateNotFoundError");
        expect(expired.name).toBe("QuoteExpiredError");
        expect(sync.name).toBe("RateSourceSyncError");
        expect(stale.name).toBe("RateSourceStaleError");
    });

    it("preserves source-specific context in sync and stale errors", () => {
        const cause = new Error("network timeout");
        const sync = new RateSourceSyncError("cbr", "request failed", cause);
        const stale = new RateSourceStaleError("cbr", cause);

        expect(sync.message).toContain("cbr: request failed");
        expect(stale.message).toContain("cbr");
        expect(sync.cause).toBe(cause);
        expect(stale.cause).toBe(cause);
    });
});
