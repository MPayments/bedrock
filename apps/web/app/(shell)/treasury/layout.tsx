import { requirePageAudience } from "@/lib/auth/session";

export default async function TreasurySectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAudience("admin");
  return children;
}
