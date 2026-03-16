import { Skeleton } from "@bedrock/sdk-ui/components/skeleton";

export function SectionLoading({
  cards = 3,
  rows = 6,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-sm" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
