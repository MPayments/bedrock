import type { CounterpartyGroupRootCode } from "@multihansa/counterparties/contracts";

import type { CounterpartyGroupOption } from "./queries";

function buildGroupById(groupOptions: CounterpartyGroupOption[]) {
  return new Map(groupOptions.map((group) => [group.id, group]));
}

function resolveRootCodeForGroup(
  groupId: string,
  groupById: Map<string, CounterpartyGroupOption>,
): CounterpartyGroupRootCode | null {
  const visited = new Set<string>();
  let cursor = groupById.get(groupId);

  while (cursor) {
    if (visited.has(cursor.id)) {
      return null;
    }
    visited.add(cursor.id);

    if (!cursor.parentId) {
      if (cursor.code === "treasury" || cursor.code === "customers") {
        return cursor.code;
      }
      return null;
    }

    cursor = groupById.get(cursor.parentId);
  }

  return null;
}

export function getRootCodeByGroupId(
  groupOptions: CounterpartyGroupOption[],
): Map<string, CounterpartyGroupRootCode | null> {
  const groupById = buildGroupById(groupOptions);
  const rootCodeByGroupId = new Map<string, CounterpartyGroupRootCode | null>();

  for (const group of groupOptions) {
    rootCodeByGroupId.set(
      group.id,
      resolveRootCodeForGroup(group.id, groupById),
    );
  }

  return rootCodeByGroupId;
}

export function filterGroupsByRootCode(
  groupOptions: CounterpartyGroupOption[],
  rootCode: CounterpartyGroupRootCode,
): CounterpartyGroupOption[] {
  const rootCodeByGroupId = getRootCodeByGroupId(groupOptions);

  return groupOptions.filter((group) => rootCodeByGroupId.get(group.id) === rootCode);
}

export function findSystemRootGroupByCode(
  groupOptions: CounterpartyGroupOption[],
  rootCode: CounterpartyGroupRootCode,
): CounterpartyGroupOption | null {
  return (
    groupOptions.find(
      (group) => !group.parentId && group.code === rootCode,
    ) ?? null
  );
}
