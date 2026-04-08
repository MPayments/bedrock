"use client";

import { Button } from "@bedrock/sdk-ui/components/button";

import {
  LOCALIZED_TEXT_VARIANTS,
  type LocalizedTextVariant,
} from "../lib/localized-text";

type LocalizedTextModeSwitcherProps = {
  disabled?: boolean;
  onChange: (value: LocalizedTextVariant) => void;
  value: LocalizedTextVariant;
};

export function LocalizedTextModeSwitcher({
  disabled,
  onChange,
  value,
}: LocalizedTextModeSwitcherProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border bg-muted/20 p-1"
      role="tablist"
      aria-label="Режим локализуемых полей"
    >
      {LOCALIZED_TEXT_VARIANTS.map((option) => (
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
  );
}
