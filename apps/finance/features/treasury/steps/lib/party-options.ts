"use client";

/**
 * Client-side fetchers that power the inline party / requisite selects inside
 * {@link ./step-route-editor.tsx}. Each fetcher returns a minimal `{id, label}`
 * shape so the editor can render Selects without caring about the underlying
 * entity schema.
 *
 * The finance app talks to the API over same-origin cookies, so we use
 * `credentials: "include"` and skip ad-hoc fetch wrappers.
 */

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

export async function listPartyOptions(kind: PartyKind): Promise<PartyOption[]> {
  const payload = await readOptions(PARTY_ENDPOINT[kind]);
  if (!payload) return [];
  return payload.data.map((row) => ({
    id: row.id,
    label: row.label ?? row.displayName ?? row.name ?? row.id,
  }));
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
