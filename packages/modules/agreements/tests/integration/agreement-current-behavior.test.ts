import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_CORE_ACTOR_USER_ID,
  createAgreementFixture,
} from "../../../../../tests/integration/commercial-core/fixtures";

describe("agreements integration characterization", () => {
  it("creates an agreement from a bound organization requisite and versions on update", async () => {
    const fixture = await createAgreementFixture();

    expect(fixture.agreement.customerId).toBe(fixture.customer.id);
    expect(fixture.agreement.organizationId).toBe(fixture.organization.id);
    expect(fixture.agreement.organizationRequisiteId).toBe(
      fixture.organizationRequisite.id,
    );
    expect(fixture.agreement.currentVersion.versionNumber).toBe(1);
    expect(fixture.agreement.currentVersion.feeRules).toHaveLength(1);

    const updated = await fixture.runtime.modules.agreements.agreements.commands.update({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      contractNumber: "AGR-UPDATED",
      feeRules: [
        {
          kind: "fixed_fee",
          currencyId: fixture.currencies.eur.id,
          unit: "money",
          value: "25.00",
        },
      ],
      id: fixture.agreement.id,
      idempotencyKey: randomUUID(),
    });

    expect(updated.currentVersion.versionNumber).toBe(2);
    expect(updated.currentVersion.contractNumber).toBe("AGR-UPDATED");
    expect(updated.currentVersion.feeRules[0]?.currencyId).toBe(
      fixture.currencies.eur.id,
    );

    const active = await fixture.runtime.modules.agreements.agreements.queries.findActiveByCustomerId(
      fixture.customer.id,
    );
    expect(active?.id).toBe(fixture.agreement.id);
    expect(active?.currentVersion.versionNumber).toBe(2);
  });
});
