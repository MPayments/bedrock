import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@bedrock/sdk-ui/lib/utils"

type SupportedInputMode = "decimal" | "numeric"

export function sanitizeInputValue(
  value: string,
  inputMode?: React.ComponentProps<"input">["inputMode"]
) {
  if (inputMode === "numeric") {
    return value.replace(/\D+/g, "")
  }

  if (inputMode === "decimal") {
    const normalized = value.replace(/,/g, ".")
    let result = ""
    let hasDecimalSeparator = false

    for (const char of normalized) {
      if (/\d/.test(char)) {
        result += char
        continue
      }

      if (char === "." && !hasDecimalSeparator) {
        result += char
        hasDecimalSeparator = true
      }
    }

    return result.startsWith(".") ? `0${result}` : result
  }

  return value
}

function shouldSanitizeInput(
  inputMode?: React.ComponentProps<"input">["inputMode"]
): inputMode is SupportedInputMode {
  return inputMode === "decimal" || inputMode === "numeric"
}

function Input({
  className,
  inputMode,
  onChange,
  type,
  ...props
}: React.ComponentProps<"input">) {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (shouldSanitizeInput(inputMode)) {
        const sanitizedValue = sanitizeInputValue(
          event.currentTarget.value,
          inputMode
        )

        if (sanitizedValue !== event.currentTarget.value) {
          event.currentTarget.value = sanitizedValue
        }
      }

      onChange?.(event)
    },
    [inputMode, onChange]
  )

  return (
    <InputPrimitive
      type={type}
      inputMode={inputMode}
      data-slot="input"
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  )
}

export { Input }
