"use client";

import {
  Field,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";

import {
  type LocaleTextMap,
  type LocalizedTextVariant,
  readLocalizedTextVariant,
  updateLocalizedTextVariant,
} from "../lib/localized-text";

type LocalizedTextInputFieldProps = {
  disabled?: boolean;
  label: string;
  localeMap: LocaleTextMap;
  onChange: (value: { localeMap: LocaleTextMap; value: string }) => void;
  placeholder?: string;
  value: string;
  variant: LocalizedTextVariant;
};

export function LocalizedTextInputField({
  disabled,
  label,
  localeMap,
  onChange,
  placeholder,
  value,
  variant,
}: LocalizedTextInputFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={readLocalizedTextVariant({
          baseValue: value,
          localeMap,
          variant,
        })}
        onChange={(event) => {
          const nextValue = updateLocalizedTextVariant({
            baseValue: value,
            localeMap,
            nextValue: event.target.value,
            variant,
          });

          onChange({
            value: nextValue.baseValue,
            localeMap: nextValue.localeMap,
          });
        }}
        disabled={disabled}
        placeholder={placeholder}
      />
    </Field>
  );
}
