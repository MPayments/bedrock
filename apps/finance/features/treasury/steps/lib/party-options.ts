"use client";

export type PartyKind = "organization" | "counterparty" | "customer";

export interface PartyOption {
  id: string;
  label: string;
}

export interface RequisiteOption {
  id: string;
  label: string;
  currencyId: string;
}

interface OptionsResponse {
  data: Array<{
    id: string;
    label?: string;
    name?: string;
    displayName?: string;
    currencyId?: string;
  }>;
}

const PARTY_ENDPOINT: Record<PartyKind, string> = {
  counterparty: "/v1/counterparties/options",
  customer: "/v1/customers/options",
  organization: "/v1/organizations/options",
};

async function readOptions(url: string): Promise<OptionsResponse | null> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as OptionsResponse;
  } catch {
    return null;
  }
}

const partyCache = new Map<PartyKind, PartyOption[]>();
const partyInflight = new Map<PartyKind, Promise<PartyOption[]>>();

export async function listPartyOptions(kind: PartyKind): Promise<PartyOption[]> {
  const cached = partyCache.get(kind);
  if (cached) return cached;
  const running = partyInflight.get(kind);
  if (running) return running;
  const promise = (async () => {
    try {
      const payload = await readOptions(PARTY_ENDPOINT[kind]);
      const options = payload
        ? payload.data.map((row) => ({
            id: row.id,
            label: row.label ?? row.displayName ?? row.name ?? row.id,
          }))
        : [];
      partyCache.set(kind, options);
      return options;
    } finally {
      partyInflight.delete(kind);
    }
  })();
  partyInflight.set(kind, promise);
  return promise;
}

export async function resolvePartyDisplayName(
  partyId: string,
): Promise<string | null> {
  const kinds: PartyKind[] = ["organization", "counterparty", "customer"];
  const lookups = await Promise.all(kinds.map((kind) => listPartyOptions(kind)));
  for (const options of lookups) {
    const match = options.find((opt) => opt.id === partyId);
    if (match) return match.label;
  }
  return null;
}

export async function listRequisiteOptions(input: {
  ownerType: PartyKind;
  ownerId: string;
}): Promise<RequisiteOption[]> {
  const query = new URLSearchParams({
    ownerType: input.ownerType,
    ownerId: input.ownerId,
  });
  const payload = await readOptions(`/v1/requisites/options?${query.toString()}`);
  if (!payload) return [];
  return payload.data
    .filter((row): row is typeof row & { currencyId: string } =>
      Boolean(row.currencyId),
    )
    .map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      currencyId: row.currencyId,
    }));
}
