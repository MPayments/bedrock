import { OrganizationsTable } from "./(table)";

const API_URL = process.env.API_URL ?? "http://localhost:3002";

async function getOrganizations() {
  const res = await fetch(`${API_URL}/v1/organizations?limit=100`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export default async function OrganizationsPage() {
  const data = await getOrganizations();

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="font-semibold text-2xl tracking-tight">Организации</h1>
      <OrganizationsTable data={data} />
    </div>
  );
}
