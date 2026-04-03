import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
  DEFAULT_REPORT_LINE_MAPPINGS,
} from "../src/constants";
import { validatePackDefinition } from "../src/packs/application";
import { rawPackDefinition } from "../src/packs/raw-pack";

describe("accounting reference data", () => {
  it("keeps report line mappings bound to known accounts", () => {
    const accountNos = new Set(
      DEFAULT_CHART_TEMPLATE_ACCOUNTS.map((account) => account.accountNo),
    );

    for (const mapping of DEFAULT_REPORT_LINE_MAPPINGS) {
      expect(accountNos.has(mapping.accountNo)).toBe(true);
    }
  });

  it("validates the default pack against owned reference data", () => {
    const result = validatePackDefinition(rawPackDefinition, {
      knownAccountNos: DEFAULT_CHART_TEMPLATE_ACCOUNTS.map(
        (account) => account.accountNo,
      ),
      knownPostingCodes: DEFAULT_GLOBAL_CORRESPONDENCE_RULES.map(
        (rule) => rule.postingCode,
      ),
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });
});
