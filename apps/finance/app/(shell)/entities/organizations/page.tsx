import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildRedirectHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      query.append(key, value);
      return;
    }

    value?.forEach((item) => {
      query.append(key, item);
    });
  });

  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  redirect(buildRedirectHref("/treasury/organizations", await searchParams));
}
