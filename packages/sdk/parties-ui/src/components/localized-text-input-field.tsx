"use client";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import {
  type LocaleTextMap,
  type LocalizedTextLocale,
  type LocalizedTextVariant,
  readLocalizedTextLocale,
  readLocalizedTextVariant,
  updateLocalizedTextLocale,
  updateLocalizedTextVariant,
} from "../lib/localized-text";

type LocalizedTextInputFieldProps = {
  className?: string;
  disabled?: boolean;
  error?: string;
  label: string;
  localeMap: LocaleTextMap;
  multiline?: boolean;
  onChange: (value: { localeMap: LocaleTextMap; value: string }) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  value: string;
  variant: LocalizedTextVariant;
};

export function LocalizedTextInputField({
  className,
  disabled,
  error,
  label,
  localeMap,
  multiline = false,
  onChange,
  placeholder,
  required,
  rows = 3,
  value,
  variant,
}: LocalizedTextInputFieldProps) {
  const labelContent = (
    <>
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </>
  );
  const errorNode = error ? (
    <FieldError errors={[{ message: error }]} />
  ) : null;
  const invalid = Boolean(error);
  if (variant === "all") {
    const handleLocaleChange = (
      locale: LocalizedTextLocale,
      nextRawValue: string,
    ) => {
      const nextValue = updateLocalizedTextLocale({
        baseValue: value,
        localeMap,
        nextValue: nextRawValue,
        locale,
      });

      // Mirror the RU cell into `baseValue` — most callers treat RU as the
      // canonical/legacy value and server schemas often require the flat
      // `baseValue` to be non-empty. `en` cell leaves `baseValue` alone.
      const nextBaseValue =
        locale === "ru" ? nextRawValue : nextValue.baseValue;

      onChange({
        value: nextBaseValue,
        localeMap: nextValue.localeMap,
      });
    };

    const ruValue = readLocalizedTextLocale({ localeMap, locale: "ru" });
    const enValue = readLocalizedTextLocale({ localeMap, locale: "en" });

    return (
      <Field
        className={cn("md:col-span-2", className)}
        data-invalid={invalid}
      >
        <FieldLabel>{labelContent}</FieldLabel>
        <div className="grid gap-3 md:grid-cols-2">
          <LocalizedCell
            disabled={disabled}
            invalid={invalid}
            label="RU"
            multiline={multiline}
            onChange={(next) => handleLocaleChange("ru", next)}
            placeholder={placeholder}
            rows={rows}
            value={ruValue}
          />
          <LocalizedCell
            disabled={disabled}
            label="EN"
            multiline={multiline}
            onChange={(next) => handleLocaleChange("en", next)}
            placeholder={placeholder}
            rows={rows}
            value={enValue}
          />
        </div>
        {errorNode}
      </Field>
    );
  }

  const fieldValue = readLocalizedTextVariant({
    baseValue: value,
    localeMap,
    variant,
  });

  const handleChange = (nextRawValue: string) => {
    const nextValue = updateLocalizedTextVariant({
      baseValue: value,
      localeMap,
      nextValue: nextRawValue,
      variant,
    });

    // Same rationale as in the "all" branch — RU is canonical, so mirror it
    // into `baseValue` for required server schemas.
    const nextBaseValue =
      variant === "ru" ? nextRawValue : nextValue.baseValue;

    onChange({
      value: nextBaseValue,
      localeMap: nextValue.localeMap,
    });
  };

  return (
    <Field className={className} data-invalid={invalid}>
      <FieldLabel>{labelContent}</FieldLabel>
      {multiline ? (
        <Textarea
          value={fieldValue}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={invalid}
        />
      ) : (
        <Input
          value={fieldValue}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid}
        />
      )}
      {errorNode}
    </Field>
  );
}

type LocalizedCellProps = {
  invalid?: boolean;
  disabled?: boolean;
  label: string;
  multiline: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  rows: number;
  value: string;
};

function LocalizedCell({
  disabled,
  invalid,
  label,
  multiline,
  onChange,
  placeholder,
  rows,
  value,
}: LocalizedCellProps) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={invalid}
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid}
        />
      )}
    </div>
  );
}
