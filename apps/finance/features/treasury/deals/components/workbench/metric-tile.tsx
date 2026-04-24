import { cn } from "@bedrock/sdk-ui/lib/utils";

export type MetricTileTone = "default" | "positive" | "negative";

export interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: MetricTileTone;
  footer?: React.ReactNode;
  testId?: string;
}

export function MetricTile({
  label,
  sublabel,
  tone = "default",
  value,
  footer,
  testId,
}: MetricTileProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-xl border bg-background px-4 py-3",
        tone === "positive" ? "border-emerald-200 bg-emerald-50/80" : null,
        tone === "negative" ? "border-destructive/30 bg-destructive/10" : null,
      )}
    >
      <div
        className={cn(
          "text-muted-foreground text-xs uppercase tracking-wide",
          tone === "positive" ? "text-emerald-700/80" : null,
          tone === "negative" ? "text-destructive/80" : null,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 whitespace-nowrap text-base font-semibold tabular-nums",
          tone === "positive" ? "text-emerald-900" : null,
          tone === "negative" ? "text-destructive" : null,
        )}
      >
        {value}
      </div>
      {sublabel ? (
        <div
          className={cn(
            "text-muted-foreground mt-1 text-[11px]",
            tone === "positive" ? "text-emerald-700/70" : null,
            tone === "negative" ? "text-destructive/70" : null,
          )}
        >
          {sublabel}
        </div>
      ) : null}
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
