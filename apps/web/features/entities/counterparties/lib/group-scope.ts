import type { CounterpartyGroupOption } from "./queries";

function buildGroupById(groupOptions: CounterpartyGroupOption[]) {
  return new Map(groupOptions.map((group) => [group.id, group]));
}

export function getCustomerScopeByGroupId(
  groupOptions: CounterpartyGroupOption[],
): Map<string, string | null> {
  const groupById = buildGroupById(groupOptions);
  const customerScopeByGroupId = new Map<string, string | null>();

  for (const group of groupOptions) {
    const visited = new Set<string>();
    let cursor: CounterpartyGroupOption | undefined = group;

    while (cursor) {
      if (visited.has(cursor.id)) {
        customerScopeByGroupId.set(group.id, null);
        break;
      }
      visited.add(cursor.id);

      if (cursor.customerId) {
        customerScopeByGroupId.set(group.id, cursor.customerId);
        break;
      }

      cursor = cursor.parentId ? groupById.get(cursor.parentId) : undefined;
    }

    if (!customerScopeByGroupId.has(group.id)) {
      customerScopeByGroupId.set(group.id, null);
    }
  }

  return customerScopeByGroupId;
}
