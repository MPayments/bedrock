import type { LucideIcon } from "lucide-react";

export type WorkspaceTabCount = number | string | null | undefined;

type WorkspaceTabLabelProps = {
  count?: WorkspaceTabCount;
  icon: LucideIcon;
  label: string;
};

export function WorkspaceTabLabel({
  count,
  icon: Icon,
  label,
}: WorkspaceTabLabelProps) {
  const showCount =
    count !== null && count !== undefined && count !== 0 && count !== "0";

  return (
    <>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {showCount ? (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {count}
        </span>
      ) : null}
    </>
  );
}
