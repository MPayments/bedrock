type ValidationDetails = {
  formErrors?: unknown;
  fieldErrors?: unknown;
};

function extractValidationMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const parsed = details as ValidationDetails;

  if (Array.isArray(parsed.formErrors)) {
    const firstFormError = parsed.formErrors.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (firstFormError) {
      return firstFormError;
    }
  }

  if (parsed.fieldErrors && typeof parsed.fieldErrors === "object") {
    for (const value of Object.values(parsed.fieldErrors)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const firstFieldError = value.find(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      );
      if (firstFieldError) {
        return firstFieldError;
      }
    }
  }

  return null;
}

export function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const parsed = payload as {
    error?: unknown;
    message?: unknown;
    details?: unknown;
  };

  const validationMessage = extractValidationMessage(parsed.details);
  if (validationMessage) {
    return validationMessage;
  }

  if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
    return parsed.error;
  }

  if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
    return parsed.message;
  }

  return null;
}

export function resolveApiErrorMessage(
  status: number,
  payload: unknown,
  fallback: string,
) {
  const extracted = extractApiErrorMessage(payload);

  if (status === 400 || status === 422) {
    return extracted ?? "Ошибка валидации. Проверьте заполненные поля.";
  }

  if (status === 401) {
    return extracted ?? "Требуется авторизация.";
  }

  if (status === 403) {
    return extracted ?? "Недостаточно прав для выполнения действия.";
  }

  if (status >= 500) {
    if (extracted && extracted !== "Internal server error") {
      return extracted;
    }
    return "Ошибка сервера. Попробуйте позже.";
  }

  return extracted ?? `${fallback} (${status})`;
}
