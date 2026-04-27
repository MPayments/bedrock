"use client";

import { Languages, Loader2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

export type BilingualMode = "ru" | "en" | "all";

type BilingualToolbarProps = {
  completeness: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: BilingualMode) => void;
  onTranslateAll?: () => void;
  translateAllLabel?: string;
  translating?: boolean;
  value: BilingualMode;
};

const MODE_OPTIONS: { value: BilingualMode; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "ru", label: "RU" },
  { value: "en", label: "EN" },
];

export function BilingualToolbar({
  completeness,
  disabled,
  label = "Локализация",
  onChange,
  onTranslateAll,
  translateAllLabel = "Заполнить EN по RU",
  translating,
  value,
}: BilingualToolbarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(completeness * 100)));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Languages className="h-4 w-4" />
          {label}
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-md border bg-background p-1"
          role="tablist"
          aria-label={label}
        >
          {MODE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={value === option.value ? "secondary" : "ghost"}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              role="tab"
              aria-selected={value === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          title="Доля заполненных двуязычных полей"
        >
          <span>Заполнено</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tabular-nums">{pct}%</span>
        </div>
        {onTranslateAll ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onTranslateAll}
            disabled={disabled || translating}
          >
            {translating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
            {translating ? "Переводим..." : translateAllLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
