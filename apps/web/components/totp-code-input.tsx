"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@bedrock/sdk-ui/components/input-otp";
import { cn } from "@bedrock/sdk-ui/lib/utils";

type TotpCodeInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  centered?: boolean;
};

export function TotpCodeInput({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  autoFocus = false,
  centered = false,
}: TotpCodeInputProps) {
  return (
    <InputOTP
      id={id}
      value={value}
      onChange={onChange}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      disabled={disabled}
      autoFocus={autoFocus}
      required
      aria-invalid={invalid || undefined}
      containerClassName={cn(centered && "justify-center")}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
