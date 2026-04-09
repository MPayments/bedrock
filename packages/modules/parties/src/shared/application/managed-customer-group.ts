import type { UuidGenerator } from "@bedrock/shared/core";

import type { CounterpartyGroupRepository } from "../../counterparties/application/ports/counterparty-group.repository";
import { CounterpartyGroup } from "../../counterparties/domain/counterparty-group";

export async function ensureManagedCustomerGroup(input: {
  generateUuid: UuidGenerator;
  groups: Pick<CounterpartyGroupRepository, "findManagedCustomerGroup" | "save">;
  customerId: string;
  name: string;
  now: Date;
}): Promise<CounterpartyGroup> {
  const existing = await input.groups.findManagedCustomerGroup(input.customerId);
  if (!existing) {
    return input.groups.save(
      CounterpartyGroup.createManagedCustomerGroup(
        {
          id: input.generateUuid(),
          customerId: input.customerId,
          displayName: input.name,
        },
        {
          now: input.now,
        },
      ),
    );
  }

  const synced = existing.syncManagedCustomerDisplayName({
    displayName: input.name,
    now: input.now,
  });

  return synced === existing ? existing : input.groups.save(synced);
}
