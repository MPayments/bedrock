"use client";

export interface EntityOption {
  id: string;
  label: string;
}

export interface RequisiteOption {
  id: string;
  label: string;
  currencyId: string;
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface CounterpartyRow {
  id: string;
  shortName: string;
  fullName: string;
}

interface OrganizationRow {
  id: string;
  shortName: string;
  fullName: string;
}

interface RequisiteRow {
  id: string;
  label: string;
  currencyId: string;
}

interface PaginatedResponse<T> {
  data: T[];
}

export async function listCandidateCounterparties(input?: {
  customerId?: string | null;
}): Promise<EntityOption[]> {
  const params = new URLSearchParams({ limit: "200" });
  if (input?.customerId) params.set("customerId", input.customerId);
  const payload = await fetchJson<PaginatedResponse<CounterpartyRow>>(
    `/v1/counterparties?${params.toString()}`,
  );
  if (!payload?.data) return [];
  return payload.data.map((row) => ({
    id: row.id,
    label: row.shortName.trim().length > 0 ? row.shortName : row.fullName,
  }));
}

export async function listCandidateOrganizations(): Promise<EntityOption[]> {
  const params = new URLSearchParams({ limit: "200" });
  const payload = await fetchJson<PaginatedResponse<OrganizationRow>>(
    `/v1/organizations?${params.toString()}`,
  );
  if (!payload?.data) return [];
  return payload.data.map((row) => ({
    id: row.id,
    label: row.shortName.trim().length > 0 ? row.shortName : row.fullName,
  }));
}

export async function listRequisitesForOwner(input: {
  ownerType: "counterparty" | "organization";
  ownerId: string;
  currencyId: string | null;
}): Promise<RequisiteOption[]> {
  const params = new URLSearchParams({
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    limit: "200",
  });
  if (input.currencyId) {
    // DrizzleRequisiteReads.list accepts currencyId[] as a repeated query param.
    params.append("currencyId", input.currencyId);
  }
  const payload = await fetchJson<PaginatedResponse<RequisiteRow>>(
    `/v1/requisites?${params.toString()}`,
  );
  if (!payload?.data) return [];
  return payload.data.map((row) => ({
    id: row.id,
    label: row.label,
    currencyId: row.currencyId,
  }));
}
