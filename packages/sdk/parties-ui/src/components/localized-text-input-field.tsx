"use client";

import {
  Field,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import {
  type LocaleTextMap,
  type LocalizedTextVariant,
  readLocalizedTextVariant,
  updateLocalizedTextVariant,
} from "../lib/localized-text";

type LocalizedTextInputFieldProps = {
  className?: string;
  disabled?: boolean;
  label: string;
  localeMap: LocaleTextMap;
  multiline?: boolean;
  onChange: (value: { localeMap: LocaleTextMap; value: string }) => void;
  placeholder?: string;
  rows?: number;
  value: string;
  variant: LocalizedTextVariant;
};

export function LocalizedTextInputField({
  className,
  disabled,
  label,
  localeMap,
  multiline = false,
  onChange,
  placeholder,
  rows = 3,
  value,
  variant,
}: LocalizedTextInputFieldProps) {
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

    onChange({
      value: nextValue.baseValue,
      localeMap: nextValue.localeMap,
    });
  };

  return (
    <Field className={className}>
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          value={fieldValue}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <Input
          value={fieldValue}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}
